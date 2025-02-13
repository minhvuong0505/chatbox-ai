const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');  // Add this for generateSessionId



const config = require('./config/config');
const ModelService = require('./services/modelService');
const VectorDatabaseService = require('./services/vectorDatabaseService');
const SessionService = require('./services/sessionService');
const MessageService = require('./services/messageService');
const ChatController = require('./controllers/chatController');
const Logger = require('./utils/logger');
const logMemoryUsage = require('./utils/memoryMonitor'); // Import the memory monitor
class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: config.cors,
            transports: config.socketOptions.transports
        });

        this.upload = multer({ dest: "database/upload_databases/" });
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        logMemoryUsage()
    }

    async initializeServices() {
        this.modelService = new ModelService(config);
        await this.modelService.initialize();

        this.vectorDatabaseService = new VectorDatabaseService(this.modelService);
        if(config.initialDatabase){
            await this.vectorDatabaseService.loadFromCsv(config.initialDatabase);
        }

        this.sessionService = new SessionService();
        this.messageService = new MessageService();

        this.chatController = new ChatController(this.messageService, 
            this.sessionService, 
            this.modelService,
            this.vectorDatabaseService
        );
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(cookieParser());
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/view/index.html'));
        });

        // Upload csv file to vector DB. Disable for now
        // this.app.get('/upload_csv', (req, res) => {
        //     res.sendFile(path.join(__dirname, 'public/view/upload_csv.html'));
        // });

        // this.app.post("/handle_csv", this.upload.single("file"), async (req, res) => {
        //     if (!req.file) {
        //         return res.status(400).json({ error: "No file uploaded" });
        //     }

        //     try {
        //         await this.vectorDatabaseService.loadFromCsv(req.file.path);
        //         res.json({ 
        //             message: "File uploaded and processed", 
        //             total: this.vectorDatabaseService.database.length 
        //         });
        //     } catch (error) {
        //         res.status(500).json({ error: "Failed to upload file" });
        //     }
        // });

        // this.app.post("/search", async (req, res) => {
        //     const { query } = req.body;
        //     if (!query) {
        //         return res.status(400).json({ error: "Missing query" });
        //     }

        //     try {
        //         const result = await this.vectorDatabaseService.search(query);
        //         res.json({ best_match: result });
        //     } catch (error) {
        //         res.status(500).json({ error: "Search failed" });
        //     }
        // });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            this.handleSocketConnection(socket);
        });
    }

    async handleSocketConnection(socket) {
        let sessionId = await this.sessionService.getSessionId(socket);
        console.log('sessionId', sessionId);    

        if (typeof sessionId == 'undefined') {
            sessionId = await this.sessionService.generateSessionId();
            console.log('sessionId', sessionId);  
            socket.emit('set-cookie', { name: 'sessionId', value: sessionId });
            await this.sessionService.createSession(sessionId);
        } else {
            await this.recoverUserSession(sessionId, socket.id);
        }

        this.sessionService.sessions[sessionId].socketids.push(socket.id)
        Logger.log('User connected', { socketId: socket.id, sessionId }, sessionId, 'info');
        socket.join(sessionId);
        
        socket.on('disconnect', () => {
            socket.leave(sessionId);
            let index = this.sessionService.sessions[sessionId].socketids.indexOf(socket.id);
            if (index !== -1) {
                this.sessionService.sessions[sessionId].socketids.splice(index, 1);
                if(this.sessionService.sessions[sessionId].socketids.length == 0)
                    delete this.sessionService.sessions[sessionId];
            }
            Logger.log('User disconnected', { socketId: socket.id, sessionId }, sessionId, 'info');
        });

        socket.on('chat_message', async (data, callback) => {
            this.io.to(sessionId).emit('bot_status', { status: 'typing' });
            let botMessageParam = await this.chatController.handleMessage(sessionId, data, callback, socket);
            if(botMessageParam)
                this.io.to(sessionId).emit('chat_message', botMessageParam);
            this.io.to(sessionId).emit('bot_status', { status: 'idle' });
        });
    }

    async recoverUserSession(sessionId, socketId) {
        try {
            const conversation = await this.messageService.loadConversation(sessionId);
            this.io.to(socketId).emit('load_chat', conversation);
            await this.sessionService.loadSession(sessionId);
        } catch (error) {
            Logger.log('Error recovering session', error, sessionId, 'error');
        }
    }

    async start() {
        try {
            await this.initializeServices();
            await new Promise((resolve, reject) => {
                this.server.listen(config.port, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            Logger.log('Server is running', `on port: ${config.port}`, '', 'system');
        } catch (error) {
            Logger.log('Server error', error, '', 'error');
            process.exit(1);
        }
    }
}

module.exports = App;