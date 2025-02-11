require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require("cors");
const cookieParser = require('cookie-parser');
const csv = require("csv-parser");
const fs = require('fs'); // File system module for saving conversations
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(cors());
app.use(express.json());
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const { pipeline } = require("@xenova/transformers");
const multer = require("multer");
const upload = multer({ dest: "upload_databases/" });
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
      origin: "*", // Hoặc cấu hình domain cụ thể
      methods: ["GET", "POST"]
    },
    transports: ["websocket"] // Chỉ sử dụng WebSocket, tắt polling
  });

let model_transformers;
let vectorDatabase = [];

// Load mô hình khi khởi động server
async function loadModel() {
    model_transformers = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    log('Model loaded successfully!', '', '', 'system');
}
// In-memory storage for sessions
const sessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname, 'public/view/index.html'));
});

app.get('/upload_csv', function(req, res){
    res.sendFile(path.join(__dirname, 'public/view/upload_csv.html'));
});

app.post("/handle_csv", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = req.file.path;
    const uploadResult = await loadVectorDatabase(filePath);
    if(uploadResult){
        res.json({ message: "File uploaded and processed", total: vectorDatabase.length });
    }else{
        res.json({ error: "Failed to upload file" });
    }
});

// app.get('/sendtest', function(req, res){
//     res.sendFile(path.join(__dirname, 'public/view/upload_csv.html'));
// });


// API: Search
app.post("/search", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });
    const result = await similaritySearch(query, vectorDatabase);
    res.json({ best_match: result });
});

io.on('connection', (socket) => {
    let sessionId = socket.handshake.headers.cookie && socket.handshake.headers.cookie.split('; ').find(row => row.startsWith('sessionId='))?.split('=')[1];
    if(sessionId){
        recoverConversation(sessionId, socket.id);
        recoverSession(sessionId);
        sessions[sessionId] = {conversation : {}};
    } else {
        let timeId = new Date().toISOString();
        let id = timeId.slice(0, 10).replace(/-/g, "-") +'-'+ timeId.slice(11, 16).replace(":", "-");
        sessionId = id+'_'+uuidv4();
        socket.emit('set-cookie', { name: 'sessionId', value: sessionId });
        sessions[sessionId] = {conversation : {}};
        sessions[sessionId].conversation.previousTopic = '';
        sessions[sessionId].conversation.summary = '';
    }
    log('User connected', { socketId: socket.id, sessionId }, sessionId, 'info');
    socket.join(sessionId);

    socket.on('disconnect', () => {
        socket.leave(sessionId);
        log('User disconnected', { socketId: socket.id, sessionId }, sessionId, 'info');
    });
    
    socket.on('chat_message', async (data, callback) => {
        try {
            if(sessions[sessionId].isProcessing){
                throw new Error('Chatbot is processing the previous message');
            }
            sessions[sessionId].isProcessing = true;
            let userMessage = await preProcessMessage(sessionId, data);
            socket.broadcast.to(sessionId).emit('chat_message', userMessage);

            let responseMessage = await processMessage(sessionId, userMessage);
            postProcessMessage(sessionId, responseMessage);
            sessions[sessionId].isProcessing = false;
            // callback({ status: 1, suggestive_prompts: responseMessage.suggestivePrompts });
            callback({ status: 1 });
        } catch (error) {
            log('Error sending response', error, sessionId, 'error');
            callback({ status: -1 , error : error});
        }
    });
});

async function generateMsgId() {  
    return Date.now();
}

async function preProcessMessage(sessionId, data) {
    let { userMessage } = data;
    let msgId = await generateMsgId();
    let sendingMessage = { msgId, message: userMessage, sender: 'user' };
    let askingTime = new Date().toISOString();
    let userData = { msgId, time: askingTime, message: userMessage, sender: 'user' };
    saveMessage(sessionId, userData);
    log('Pre-processed message', userData, sessionId, 'info');
    return sendingMessage;
}

async function processMessage(sessionId, userMessageParam) {
    io.to(sessionId).emit('bot_status', { status: 'typing' });
    let userMessage = userMessageParam.message;
    let responseMessage = {};
    try {
        const retrievedInfo = await similaritySearch(userMessage, vectorDatabase, 0.6, 4);
        log('Retrieved info', retrievedInfo, sessionId, 'info');
        const formattedUserMessage = await tuningMessage(sessionId, userMessage, retrievedInfo);

        log('Sending to Gemini API', formattedUserMessage, sessionId, 'info');
        const result = await model.generateContent(formattedUserMessage);
        responseMessage = await handleBotMessage(sessionId, result.response.text());

        log('responseMessage', result.response.text(), sessionId, 'info');
        log('Suggestive Prompts', responseMessage.suggestivePrompts, sessionId, 'info');
    } catch (error) {
        log('Error communicating with Gemini API', error, sessionId, 'error');
        responseMessage.message = 'Sorry, something went wrong!';
    }
    return responseMessage;
}

function postProcessMessage(sessionId, responseMessage) {
    let botData = { msgId: responseMessage.msgId, time: responseMessage.answerTime, message: responseMessage.message, sender: 'bot' };
    saveMessage(sessionId, botData);
    saveSession(sessionId, sessions[sessionId].conversation);
    log('Save session', sessions[sessionId].conversation, sessionId, 'info');
    io.to(sessionId).emit('chat_message', responseMessage);
    io.to(sessionId).emit('bot_status', { status: 'idle' });
}

async function similaritySearch(query, database, similarityThreshold = 0.7, limit = 1) {
    const queryEmbedding = await model_transformers(query, { pooling: "mean", normalize: true });
    const queryVector = Array.from(queryEmbedding.data); 
    
    const cosineSimilarity = (vecA, vecB) => {
        if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
            log('Invalid vectors', { vecA, vecB }, '', 'error');
            return null;
        }
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : null;
    };

    const rawResults = database.map(d => {
        const similarity = cosineSimilarity(queryVector, d.embedding);
        return { question: d.question, answer: d.answer, similarity };
    });

    // Log raw results before filtering
    // log('Raw results before filtering', rawResults, '', 'info');

    const filteredResults = rawResults.filter(d => d.similarity >= similarityThreshold * 1);

    // Log filtered results
    // log('Filtered results', filteredResults, '', 'info');

    const sortedResults = filteredResults.sort((a, b) => b.similarity - a.similarity);
    let returnResults = sortedResults.slice(0, limit);
    if (returnResults.length > 0) {
        return returnResults;
    }
    return { question: '' , answer: '' , similarity: 0 };
}

async function loadVectorDatabase(filePath) {
    let data = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (row) => {
                if (row.Question && row.Answer) {
                    data.push({ question: row.Question, answer: row.Answer });
                }
            })
            .on("end", async () => {
                const embeddings = await model_transformers(data.map(d => d.question), { pooling: "mean", normalize: true });
                vectorDatabase = data.map((d, i) => ({
                    ...d,
                    embedding: Array.isArray(embeddings[i].data) ? embeddings[i].data : Array.from(embeddings[i].data)
                }));
                // log('Database loaded', vectorDatabase, '', 'system');
                log('Database loaded', true, '', 'system');
                resolve(true);
            })
            .on("error", (error) => {
                log('Error loading vector database', error, '', 'error');
                reject(false);
            });
    });
}

async function tuningMessage(sessionId, userMessage, retrievedInfo) {
    let previousTopic = sessions[sessionId].conversation.previousTopic;
    let summary = sessions[sessionId].conversation.summary;
    // let suggestivePromptsOption = sessions[sessionId].conversation.suggestivePromptsOption;
    if(previousTopic == '' || typeof previousTopic == 'undefined'){
        previousTopic = process.env.INITIAL_CHATBOT_TOPIC;
        // suggestivePromptsOption = "yes";
    }
    let ragPrompt = '';
    if(retrievedInfo.length > 0){
        retrievedInfo.map((info) => {    
            const retrievedQuestion = info.question;
            const retrievedAnswered = info.answer;
            if(info.similarity >= 0.7){
                ragPrompt += "using exsting RAG_Question and RAG_Answer.\n\nRAG_Question: "+retrievedQuestion+" \n\nRAG_Answer: "+retrievedAnswered+".\n\n Create new suggestive questions follow these questions: \n\n";
            } else {
                ragPrompt += "Question: "+ retrievedQuestion+'\n\n';
            }
        });
        
    }
    const formattedUserMessage =  "User prompt: [" + userMessage + "]\n\nRole description: you should follow the rules, you should follow demand of user, if use give questions then give user concise meaningful and accurate answer "+ragPrompt+".No cumbersome, The answer should include user side's suggestive questions ready to copy to use, questions should start with *.\n\nTopic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Your answer here] End_ChatBot_Answer \n\nChatBot_Summary: [Summarize interactions] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic]";

    // const formattedUserMessage =  "User prompt: " + userMessage + "\n\nRole description: you are assistant, should follow demand of user, if use give questions then give user concise meaningful and accurate answer "+ragPrompt+".\n\nTopic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Your answer here] End_ChatBot_Answer \n\nChatBot_Summary: [Summarize interactions] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic] \n\nAllowed_Craft_Prompts:"+suggestivePromptsOption+" \n\nSuggestive_Prompts: [If user allowed, craft suggestive questions as user angle that incorporate data from the topic. Separeate by asterisk] \n\n";

    return formattedUserMessage;
}

async function handleBotMessage(sessionId, botMessage) {
    let botAnswerMatch = botMessage.match(/ChatBot_Answer:\s*(.*?)\s*End_ChatBot_Answer/s);
    let summaryMatch = botMessage.match(/ChatBot_Summary:\s*(.*?)\s*End_ChatBot_Summary/s);
    let previousTopicMatch = botMessage.match(/ChatBot_Topic:\s*(.*?)\s*$/m);
    let allowedSuggestivePromptsMatch = botMessage.match(/Allowed_Craft_Prompts:\s*(.*?)\s*$/m);
    // let suggestivePrompts = botMessage.match(/Suggestive_Prompts:\s*(.*?)\s*$/m);
    let result = {};
    result.message = botAnswerMatch ? botAnswerMatch[1].replace(/\n/g, '<br>') : '';
    // result.suggestivePrompts = suggestivePrompts ? suggestivePrompts[1].split("*").filter(prompt => prompt.trim().endsWith('?')) : '';
    result.sender = 'bot'; 
    result.answerTime = new Date().toISOString();
    result.msgId = await generateMsgId();
    sessions[sessionId].conversation.previousTopic = previousTopicMatch ? previousTopicMatch[1] : '';
    sessions[sessionId].conversation.summary = summaryMatch ? summaryMatch[1] : '';
    // sessions[sessionId].conversation.suggestivePromptsOption = allowedSuggestivePromptsMatch ? allowedSuggestivePromptsMatch[1] : '';
    return result;
}

function saveMessage(sessionId, params) {
    const filePath = path.join(__dirname, 'database/conversations', `${sessionId}`);
    const logEntry = JSON.stringify(params) + ',';
    writeDataToFile(filePath, logEntry);
}

function recoverConversation(sessionId, socketId) {
    const filePath = path.join(__dirname, 'database/conversations', `${sessionId}`);
    if (!fs.existsSync(filePath)) {
        log('File does not exist', filePath, sessionId, 'error');
        return;
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            log('Error reading file', err, sessionId, 'error');
            return;
        }
        const cleanedData = data.trim().replace(/,$/, '') + ']';
        // log('Cleaned data', cleanedData, sessionId, 'info');
        try {
            const conversation = JSON.parse(`[${cleanedData}`);
            io.to(socketId).emit('load_chat', conversation);
            log('Loaded conversation', true , sessionId, 'info');
            // log('Loaded conversation', conversation, sessionId, 'info');
        } catch (e) {
            log('Error parsing JSON', e, sessionId, 'error');
        }
    });
}

function saveSession(sessionId, logEntry) {
    let filePath = path.join(__dirname, 'database/sessions', `${sessionId}`);
    console.log('Saving session 1', logEntry);
    logEntry = JSON.stringify(logEntry);
    console.log('Saving session 2', logEntry);
    fs.writeFile(filePath, logEntry, (err) => {
        if (err) {
            log('Error saving session to log', err, sessionId, 'error');
        } else {
            log('Session saved', filePath, sessionId, 'info');
        }
    });
}

function recoverSession(sessionId) {
    const filePath = path.join(__dirname, 'database/sessions', `${sessionId}`);
    if (!fs.existsSync(filePath)) {
        log('File does not exist', filePath, sessionId, 'error');
        return;
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            log('Error reading file', err, sessionId, 'error');
            return;
        }
        const cleanedData = data.trim();
        try {
            const session = JSON.parse(`${cleanedData}`);
            sessions[sessionId].conversation = session;
            log('Loaded session', session, sessionId, 'info');
        } catch (e) {
            log('Error parsing JSON', e, sessionId, 'error');
        }
    });
}

function log(label, value, sessionId = '', type = 'info') {
    let time = new Date().toISOString();
    if (process.env.DEBUG) 
        console.log(`${time} ${type} [${label}]`, value);  
    let filePath = '';
    value = JSON.stringify(value);
    let logEntry = `${time} [${label}] ` + value + '\n';
    switch (type) {
        case 'error':
            console.log(`${time} ${type} [${label}]`, value);  
            filePath = path.join(__dirname, 'logs/', `${type}.log`);
            break;
        case 'info':
            filePath = path.join(__dirname, 'logs/debug_conversations', `${sessionId}.${type}.log`);
            break;
        case 'system':
            filePath = path.join(__dirname, 'logs/', `${type}.log`);
            break;
    }
    writeDataToFile(filePath, logEntry);
}

function writeDataToFile(filePath, logEntry) {
    fs.appendFile(filePath, `${logEntry}`, (err) => {
        if (err) {
            console.error('Error saving conversation to log:', err);
        } else {
            // console.log(`Conversation saved to ${filePath}`);
        }
    });
}

server.listen(process.env.PORT, async function(error){
    if (error) {
        log('Server error', error, '', 'error');
    }
    await loadModel();
    await loadVectorDatabase(process.env.INITIAL_DATABASE);
    log('Server is running', `on port: ${process.env.PORT}`, '', 'system');
});