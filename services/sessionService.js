const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

class SessionService {
    constructor() {
        this.sessions = {};
    }

    createSession(sessionId) {
        this.sessions[sessionId] = {
            conversation: {
                previousTopic: '',
                summary: ''
            },
            isProcessing: false
            ,
            socketids: []
        };
        return sessionId;
    }

    getSession(sessionId) {
        if(!this.sessions[sessionId]) { 
            this.createSession(sessionId); 
        }
        return this.sessions[sessionId];
    }

    async saveSession(sessionId, data) {
        const session = {previousTopic: data.previousTopic, summary: data.summary};
        const filePath = path.join(__dirname, '../database/sessions', sessionId);
        try {
            await fs.promises.writeFile(filePath, JSON.stringify(session));
            Logger.log('Session saved', filePath, sessionId, 'info');
        } catch (error) {
            Logger.log('Error saving session', error, sessionId, 'error');
            throw error;
        }
    }

    async loadSession(sessionId) {
        const filePath = path.join(__dirname, '../database/sessions', sessionId);
        try {
            this.sessions[sessionId] = this.getSession(sessionId);
            if(!fs.existsSync(filePath))
                    return;
            const data = await fs.promises.readFile(filePath, 'utf8');
            this.sessions[sessionId].conversation = JSON.parse(data);
            Logger.log('Session loaded', this.sessions[sessionId].conversation, sessionId, 'info');
        } catch (error) {
            Logger.log('Error loading session', error, sessionId, 'error');
            throw error;
        }
    }

    generateSessionId() {
        const timeId = new Date().toISOString();
        const id = timeId.slice(0, 10).replace(/-/g, "-") + '-' + 
                  timeId.slice(11, 16).replace(":", "-");
        return `${id}_${require('uuid').v4()}`;
    }
}

module.exports = SessionService;