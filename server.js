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
// const io = socketIo(server);
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
    console.log("✅ Model loaded successfully!");
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
    uploadResult = await loadVectorDatabase(filePath);
    if(uploadResult){
        res.json({ message: "File uploaded and processed", total: vectorDatabase.length });
    }else{
        res.json({ error: "Failed to upload file" });
    }
});

// API: Search
app.post("/search", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query" });
    result = await similaritySearch(query,vectorDatabase);
    res.json({ best_match: result });
});


io.on('connection', (socket) => {
    let sessionId = socket.handshake.headers.cookie && socket.handshake.headers.cookie.split('; ').find(row => row.startsWith('sessionId='))?.split('=')[1];
    if (!sessionId|| !sessions[sessionId]) {
        let timeId = new Date().toISOString();
        let id = timeId.slice(0, 10).replace(/-/g, "-") +'-'+ timeId.slice(11, 16).replace(":", "-");
        sessionId = id+'_'+uuidv4();
        socket.emit('set-cookie', { name: 'sessionId', value: sessionId });
        sessions[sessionId] = {conversation : []};
        sessions[sessionId].conversation.previousTopic = '';
        sessions[sessionId].conversation.summary = '';
        sessions[sessionId].conversation.botQuestion = '';
    } else {
     
    }
    // New user connected
    console.log(`Socket id  ${socket.id}`);
    socket.join(sessionId);
  
    console.log(`User connected with session ID: ${sessionId}`);
    // console.log(`User connected with session ID: ${sessions[sessionId].tabs}`);
    socket.on('disconnect', () => {
        socket.leave(sessionId)
        console.log(`User disconnected with session ID: ${sessionId}`);
    });

    socket.on('chat_message', async (data, callback) => {
        const { msgId, userMessage } = data;
        sendingMessge = { msgId, message: userMessage, sender: 'user' };
        saveMessage(sessionId, msgId, new Date().toISOString(), userMessage, 'user');
        // let userSession = sessions[sessionId];
        // userSession.conversation.push({ msgId, askTime, user: userMessage });
        
        try {
            io.to(sessionId).emit('bot_status', {status: 'typing'});
            retrievedInfo = await similaritySearch(userMessage,vectorDatabase);
            console.log(retrievedInfo);
            formattedUserMessage = santinizeMessage(sessionId,userMessage,retrievedInfo);
            console.log("Sending to Gemini API: ", formattedUserMessage);
            const result = await model.generateContent(formattedUserMessage);
            console.log(result.response.text());
            console.log(result)
            responseMessage = handleBotMessage(sessionId,result.response.text());
            console.log("Suggestive Prompts: ", responseMessage.suggestivePrompts);
            const answerTime = new Date().toISOString();
            // userSession.conversation.push({ msgId, answerTime, bot: botMessage });

            socket.broadcast.to(sessionId).emit('chat_message', sendingMessge);
            io.to(sessionId).emit('chat_message', responseMessage);
            io.to(sessionId).emit('bot_status', {status: 'idle'});
            // Save the conversation to a log file
            saveMessage(sessionId, msgId, new Date().toISOString(), responseMessage.message, 'bot');
            answerTime, responseMessage.message
            log(sessionId);
            callback({ success: 1, suggestive_prompts: responseMessage.suggestivePrompts });
        } catch (error) {
            console.error('Error communicating with Gemini API:', error);
            callback({ error: 'Sorry, something went wrong.' });
        }
    });
    // socket.on('load_chat', (sessionId, callback) => {
    //     const conversation = loadConversation(sessionId);
    //     if (!conversation) {
    //         callback({ error: 'Conversation not found' });
    //         return;
    //     }
    //     callback(conversation);
    // });
});

io.on('connected', async (socket) => {
    const conversation = await loadConversation(sessionId).then((conversation) => {
        console.log('Loaded conversation 2:', conversation);
        io.to(socket.id).emit('load_chat', [conversation]);
    });
    console.log('Loaded conversation 2:', conversation);
    io.to(socket.id).emit('load_chat', [conversation]);
});

async function similaritySearch(query, database) {
    const queryEmbedding = await model_transformers(query, { pooling: "mean", normalize: true });
    const queryVector = Array.from(queryEmbedding.data); 
    
    const cosineSimilarity = (vecA, vecB) => {
        if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
            console.error("❌ Lỗi: Vectors không hợp lệ", vecA, vecB);
            return null;
        }
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : null;
    };

    const results = database.map(d => {
        const similarity = cosineSimilarity(queryVector, d.embedding);
        return { question: d.question, answer: d.answer, similarity };
    }).filter(d => d.similarity !== null)  // ✅ Loại bỏ kết quả lỗi
      .sort((a, b) => b.similarity - a.similarity);

    if(results[0].similarity > 0.7)
        return results[0];

    return { question: "Sorry, I don't understand your question", answer: "Sorry, I don't understand your question", similarity: 0 };
}
async function loadVectorDatabase(filePath){
    let data = [];
    fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
            if (row.Question && row.Answer) {
                data.push({ question: row.Question, answer: row.Answer });
            }
        })
        .on("end", async () => {
            const embeddings = await model_transformers(data.map(d => d.question), { pooling: "mean", normalize: true });
        
            // console.log("🔍 Raw Embeddings:", embeddings);

            vectorDatabase = data.map((d, i) => ({
                ...d,
                embedding: Array.isArray(embeddings[i].data) ? embeddings[i].data : Array.from(embeddings[i].data)
            }));
        
            console.log("✅ Database loaded:");
            return true;
        });
}
function santinizeMessage(sessionId,userMessage,retrievedInfo) {
    previousTopic = sessions[sessionId].conversation.previousTopic;
    summary = sessions[sessionId].conversation.summary;
    if(previousTopic == ''){
        previousTopic = process.env.INITIAL_CHATBOT_TOPIC;
    }
    ragPrompt = '';
    if(retrievedInfo.similarity >= 0.7){
        retrievedQuestion = retrievedInfo.question;
        retrievedAnswered = retrievedInfo.answer;
        ragPrompt = " using exsting RAG_Question and RAG_Answer. \n\n RAG_Question: "+retrievedQuestion+" \n\nRAG_Answer: "+retrievedAnswered+" \n\n";
    }

    formattedUserMessage =  "Prompt: " + userMessage + "\n\nRole description: give concise meaningful and accurate answer "+ragPrompt+"\n\nTopic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Your answer here] End_ChatBot_Answer \n\nChatBot_Summary: [Summarize all interactions] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic] \n\nSuggestive_Prompts: [Craft suggestive prompts as user angle that incorporate data from the topic. Separeate by asterisk] \n\n";

    return formattedUserMessage
}
function handleBotMessage(sessionId,botMessage) {
    const botAnswerMatch = botMessage.match(/ChatBot_Answer:\s*(.*?)\s*End_ChatBot_Answer/s);
    const summaryMatch = botMessage.match(/ChatBot_Summary:\s*(.*?)\s*End_ChatBot_Summary/s);
    const previousTopicMatch = botMessage.match(/ChatBot_Topic:\s*(.*?)\s*$/m);
    const suggestivePrompts = botMessage.match(/Suggestive_Prompts:\s*(.*?)\s*$/m);
    const result = {};
    result.message = botAnswerMatch ? botAnswerMatch[1].replace(/\n/g, '<br>') : '';
    result.suggestivePrompts = suggestivePrompts ? suggestivePrompts[1].split("*") : ''; 
    result.sender = 'bot'; 
    sessions[sessionId].conversation.previousTopic = previousTopicMatch ? previousTopicMatch[1] : '';
    sessions[sessionId].conversation.summary = summaryMatch ? summaryMatch[1] : '';
    return result;
}
// Method to save conversation to a log file
function saveMessage(sessionId, msgId, time, message, sender) {
    const filePath = path.join(__dirname, 'logs/conversations', `${sessionId}.log`);
    const logEntry = JSON.stringify({ msgId, time, message, sender});
    // if (!fs.existsSync(filePath))  fs.appendFile(filePath, `[`, (err) => {});
    fs.appendFile(filePath, `${logEntry},`, (err) => {
        if (err) {
            console.error('Error saving conversation to log:', err);
        } else {
            console.log(`Conversation saved to ${filePath}`);
        }
    });
}
async function loadConversation(sessionId) {
    const filePath = path.join(__dirname, 'logs/conversations', `${sessionId}.log`);
    // Kiểm tra xem file có tồn tại không
    if (!fs.existsSync(filePath)) {
        console.error(`File ${filePath} không tồn tại`);
        return;
    }
    // Đọc nội dung file
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }
        // Loại bỏ dấu phẩy cuối cùng và đóng mảng JSON bằng dấu ]
        const cleanedData = data.trim().replace(/,$/, '') + ']';
        console.log('Cleaned data:', cleanedData);
        try {
            // Chuyển đổi dữ liệu thành mảng JSON
            const conversation = JSON.parse(`[${cleanedData}`);
            console.log('Loaded conversation:', conversation);
            return conversation;
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
}
function log(sessionId, label, value) {
    // const filePath = path.join(__dirname, 'logs/debug_conversations', `${sessionId}.log`);
    // const logEntry = JSON.stringify({ msgId, askTime, user: userMessage, answerTime, bot: botMessage });

    // fs.appendFile(filePath, `${logEntry},`, (err) => {
    //     if (err) {
    //         console.error('Error saving conversation to log:', err);
    //     } else {
    //         console.log(`Conversation saved to ${filePath}`);
    //     }
    // });
}

server.listen(process.env.PORT, async function(error){
    if (error) {
        console.log("Something went wrong");
    }
    await loadModel();
    await loadVectorDatabase(process.env.INITIAL_DATABASE);
    console.log("Server is running on port: " + process.env.PORT);
});