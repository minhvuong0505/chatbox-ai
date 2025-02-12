const { pipeline } = require("@xenova/transformers");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Logger = require('../utils/logger');

class ModelService {
    constructor(config) {
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        this.transformersModel = null;
    }

    async initialize() {
        try {
            this.transformersModel = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
            Logger.log('Model loaded successfully!', '', '', 'system');
        } catch (error) {
            Logger.log('Error loading model', error, '', 'error');
            throw error;
        }
    }

    async generateEmbeddings(text, options = { pooling: "mean", normalize: true }) {
        return this.transformersModel(text, options);
    }

    async generateContent(prompt) {
        return this.model.generateContent(prompt);
    }
}

module.exports = ModelService;
