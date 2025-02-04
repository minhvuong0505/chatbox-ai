const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique session IDs
const app = express();
const port = 3000;

const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for sessions
const sessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.get('/', function(req, res){
    if (!req.cookies.sessionId) {
        res.cookie('sessionId', uuidv4(), { httpOnly: true });
    }
    res.sendFile(path.join(__dirname, 'public/view/index.html'));
});

io.on('connection', (socket) => {
    const cookies = socket.handshake.headers.cookie;
    let sessionId;

    if (cookies) {
        const sessionIdCookie = cookies.split('; ').find(row => row.startsWith('sessionId='));
        if (sessionIdCookie) {
            sessionId = sessionIdCookie.split('=')[1];
        }
    }

    if (!sessionId) {
        sessionId = uuidv4();
        socket.emit('set-cookie', { name: 'sessionId', value: sessionId });
    }

    console.log(`User connected with session ID: ${sessionId}`);

    if (!sessions[sessionId]) {
        sessions[sessionId] = { messages: [] };
    }

    socket.on('disconnect', () => {
        console.log(`User disconnected with session ID: ${sessionId}`);
    });

    socket.on('chat message', async (msg) => {
        sessions[sessionId].messages.push({ sender: 'user', message: msg });

        try {
            // Uncomment and configure the following lines to integrate with Gemini API
            // const response = await axios.post('https://gemini-api-url.com/generate', {
            //     prompt: msg,
            //     sessionId: sessionId
            // }, {
            //     headers: {
            //         'Authorization': `Bearer YOUR_GEMINI_API_KEY`
            //     }
            // });

            // const botMessage = response.data.message;
            const botMessage = "Uncomment and configure the following lines to integrate with Gemini API <br> df"; // Placeholder response
            sessions[sessionId].messages.push({ sender: 'bot', message: botMessage });
            io.to(socket.id).emit('chat message', botMessage);
        } catch (error) {
            console.error('Error communicating with Gemini API:', error);
            io.to(socket.id).emit('chat message', 'Sorry, something went wrong.');
        }
    });
});

server.listen(port, function(error){
    if (error) {
        console.log("Something went wrong");
    }
    console.log("Server is running on port: " + port);
});