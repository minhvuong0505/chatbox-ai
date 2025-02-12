require('dotenv').config();

const config = {
    port: process.env.PORT,
    geminiApiKey: process.env.GEMINI_API_KEY,
    initialChatbotTopic: process.env.INITIAL_CHATBOT_TOPIC,
    initialDatabase: process.env.INITIAL_DATABASE,
    debug: process.env.DEBUG === 'true',
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    socketOptions: {
        transports: ["websocket"]
    }
};

module.exports = config;
