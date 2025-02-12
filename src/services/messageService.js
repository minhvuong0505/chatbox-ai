const sanitizeHtml = require('sanitize-html');
const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');
const config = require('../config/config'); 

class MessageService {
    constructor() {
    }

    async processMessage(session, sanitizedMessage, retrievedInfo) {
        const msgId = Date.now();
        const formattedMessage = await this.formatMessage(session, sanitizedMessage, retrievedInfo);       
        return {
            msgId,
            message: sanitizedMessage,
            formattedMessage,
            timestamp: new Date().toISOString()
        };
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        return sanitizeHtml(input.trim(), {
            allowedTags: [],
            allowedAttributes: {}
        })
        .replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, '\\$&')
        .replace(/[;&|$><`{}]/g, '');
    }

    async saveMessage(sessionId, message) {
        const filePath = path.join(__dirname, '../database/conversations', sessionId);
        const logEntry = JSON.stringify(message) + ',';
        
        try {
            await fs.promises.appendFile(filePath, logEntry);
            Logger.log('Message saved', message, sessionId, 'info');
        } catch (error) {
            Logger.log('Error saving message', error, sessionId, 'error');
            throw error;
        }
    }

    async loadConversation(sessionId) {
        const filePath = path.join(__dirname, '../database/conversations', sessionId);
        if(!fs.existsSync(filePath))
            return;

        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            const cleanedData = data.trim().replace(/,$/, '');
            return JSON.parse(`[${cleanedData}]`);
        } catch (error) {
            Logger.log('Error loading conversation', error, sessionId, 'error');
            throw error;
        }
    }

    formatMessage(session, message, retrievedInfo) {
        const { previousTopic = '', summary = '' } = session.conversation;

        let ragPrompt = retrievedInfo.map((info, i) => {
            if (i === 0) {
                return `Here is relevant background information that may help answer the user's question. Summarize and explain it in your own words:\n\n RAG_Question: ${info.question} \n\nRAG_Answer: ${info.answer}.\n\nGenerate **ready-to-use follow-up questions** that user can send immediately to clarify the answer, ask for examples or explore related topics. The questions **must be intended for the user to ask the bot, not for the user to answer**. Each question must start with '*'.\n\n`;
            }
            return `Another related topic to consider: ${info.question}\n\n`;
        }).join('');

        return `User prompt: "${message}"\n\n` +
               `Role description: You are an OWASP domain expert. Follow the user's demand strictly. If the user provides a question, give a **concise, meaningful, and accurate answer**.\n\n` +
               ragPrompt +
               `The answer **must include ready-to-use follow-up questions** that the user can copy and send immediately. These questions must start with '*'.\n\n` +
               `If the answer includes programming code, wrap it with \`<code>\` and \`</code>\` tags.\n\n` +
               `Reserve Topic: ${config.initialChatbotTopic}. Topic: ${previousTopic}\n\n` +
               `Previous conversation summary: ${summary}\n\n` +
               `Sample output:\n\n` +
               `ChatBot_Answer: [Your answer here] End_ChatBot_Answer\n\n` +
               `ChatBot_Summary: [Summarize interactions] End_ChatBot_Summary\n\n` +
               `ChatBot_Topic: [Conversation topic]`;
    }
}

module.exports = MessageService;