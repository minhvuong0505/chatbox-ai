require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // File system module for saving conversations
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for sessions
const sessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname, 'public/view/index.html'));
});

io.on('connection', (socket) => {
    let sessionId = socket.handshake.headers.cookie && socket.handshake.headers.cookie.split('; ').find(row => row.startsWith('sessionId='))?.split('=')[1];
    if (!sessionId) {
        sessionId = uuidv4();
        socket.emit('set-cookie', { name: 'sessionId', value: sessionId });
        sessions[sessionId] = {messages : []};
        sessions[sessionId].messages.previousTopic = '';
        sessions[sessionId].messages.summary = '';
        sessions[sessionId].messages.botQuestion = '';
    }
    console.log(`User connected with session ID: ${sessionId}`);

    socket.on('disconnect', () => {
        console.log(`User disconnected with session ID: ${sessionId}`);
    });

    socket.on('chat_message', async (data, callback) => {
        const { msgId, userMessage } = data;
        const askTime = new Date().toISOString();
        
        // sessions[sessionId].messages.push({ msgId, askTime, user: userMessage });
        sessions[sessionId].messages.previousTopic;
        
        try {
            previousTopic = sessions[sessionId].messages.previousTopic;
            summary = sessions[sessionId].messages.summary;
            // const prompt = "Explain how AI works";

            formattedUserMessage = santinizeMessage(sessionId,userMessage);

            console.log("Sending to Gemini API: ", formattedUserMessage);
            const result = await model.generateContent(formattedUserMessage);
            console.log(result.response.text());
            responseMessage = handleBotMessage(sessionId,result.response.text());
            const botMessage =  responseMessage
            // const botMessage = "Uncomment and configure the following lines to integrate with Gemini API <br> df"; // Placeholder response
            const answerTime = new Date().toISOString();
            // sessions[sessionId].messages.push({ msgId, answerTime, bot: botMessage });
            io.to(socket.id).emit('chat_message', botMessage);
            callback({ message: botMessage });

            // Save the conversation to a log file
            saveConversationToLog(sessionId, msgId, askTime, formattedUserMessage, answerTime, botMessage);
        } catch (error) {
            console.error('Error communicating with Gemini API:', error);
            callback({ error: 'Sorry, something went wrong.' });
        }
    });
    socket.on('load chat', (chatId, callback) => {
        const filePath = path.join(__dirname, 'logs/chat', `${chatId}.log`);
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading chat file:', err);
                callback([]);
                return;
            }
            const messages = JSON.parse(`[${data}]`);
            callback(messages);
        });
    });
});

function santinizeMessage(sessionId,userMessage) {
    previousTopic = sessions[sessionId].messages.previousTopic;
    summary = sessions[sessionId].messages.summary;
    botQuestion = sessions[sessionId].messages.botQuestion;

    // formattedUserMessage = "Previous Bot's question: "+botQuestion+ "\n\nUser Prompt: " + userMessage+". \n\nYou are an assistant, give short and clearly answer, examples. Answer the Bot's question to user if User Prompt relate to that. \n\nPrevious Topic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Input an answer without any additional question in this area] End_ChatBot_Answer \n\nChatBot_Question: [Input a related topic question here] End_ChatBot_Question \n\nChatBot_Summary: [Summary of the entire converstation, including previous summary and lastest bot question] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic]";

    // formattedUserMessage = "Your previous response question: "+botQuestion+ "\n\nPrompt: " + userMessage+". \n\nRole description: I do not know anything, you are an assistant, give short and clearly explain. give short example for complex question. Answer your lastest question to user if my prompt possibly relate to that.\n\nPrevious Topic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Enter the answer but there are no additional questions here] End_ChatBot_Answer \n\nChatBot_Question: [Ask yourself do i need another question] End_ChatBot_Question \n\nChatBot_Summary: [Summary of the entire converstation, including all previous summary and bot question] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic]";


    // formattedUserMessage =  "Prompt: " + userMessage + "\n\nRole description: You are an assistant, give short and clearly explain. give short example for complex problem. Answer your lastest question in summary to user if my prompt possibly relate to that. Ask again if you do not understand the question.\n\nPrevious Topic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Your answer here] End_ChatBot_Answer \n\nChatBot_Summary: [Summarize all interactions, including questions, answers, intention and your thinking as a human] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic] \n\n  ";
    
    // formattedUserMessage = "User Prompt: " + userMessage+". \n\nYou are an assistant, give short and clearly explain, examples. Answer the Bot's question in summary to user if User Prompt relate to that. Hashtag [Question] before every questions in answer. \n\nPrevious Topic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Input an answer without any additional question in this area] End_ChatBot_Answer \n\nChatBot_Summary: [Summary of the entire converstation, including previous summary and lastest bot question] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic]";

    formattedUserMessage =  "Prompt: " + userMessage + "\n\nRole description: think and give concise answer \n\nPrevious Topic: "+previousTopic +"\n\nPrevious summary converstation: "+summary+"\n\nSample answer: \n\nChatBot_Answer: [Your answer here] End_ChatBot_Answer \n\nChatBot_Summary: [Summarize all interactions, including questions, answers, intention and your thinking as a human] End_ChatBot_Summary \n\nChatBot_Topic: [Converstation topic] \n\n";

    return formattedUserMessage
}
function handleBotMessage(sessionId,botMessage) {
    const botAnswerMatch = botMessage.match(/ChatBot_Answer:\s*(.*?)\s*End_ChatBot_Answer/s);
    const botQuestionMatch = botMessage.match(/ChatBot_Question:\s*(.*?)\s*End_ChatBot_Question/s);
    const summaryMatch = botMessage.match(/ChatBot_Summary:\s*(.*?)\s*End_ChatBot_Summary/s);
    const previousTopicMatch = botMessage.match(/ChatBot_Topic:\s*(.*?)\s*$/m);
    
    const botAnswer = botAnswerMatch ? botAnswerMatch[1] : '';
    sessions[sessionId].messages.previousTopic = previousTopicMatch ? previousTopicMatch[1] : '';
    sessions[sessionId].messages.summary = summaryMatch ? summaryMatch[1] : '';
    const botQuestion = sessions[sessionId].messages.botQuestion = botQuestionMatch ? botQuestionMatch[1] : '';
    const response = botAnswer +'<br>'+ botQuestion;
    console.log(sessions[sessionId])
    return response.replace(/\n/g, '<br>');
}
// Method to save conversation to a log file
function saveConversationToLog(sessionId, msgId, askTime, userMessage, answerTime, botMessage) {
    const filePath = path.join(__dirname, 'logs/chat', `${sessionId}.log`);
    const logEntry = JSON.stringify({ msgId, askTime, user: userMessage, answerTime, bot: botMessage });

    fs.appendFile(filePath, `${logEntry},`, (err) => {
        if (err) {
            console.error('Error saving conversation to log:', err);
        } else {
            console.log(`Conversation saved to ${filePath}`);
        }
    });
}

server.listen(port, function(error){
    if (error) {
        console.log("Something went wrong");
    }
    console.log("Server is running on port: " + port);
});