const fs = require('fs');
const path = require('path');
const config = require('../config/config');  // Add this import

class Logger {
    static log(label, value, sessionId = '', type = 'info') {
        const time = new Date().toISOString();
        const logEntry = `${time} [${label}] ${JSON.stringify(value)}\n`;
        
        if (config.debug) {
            console.log(`${time} ${type} [${label}]`, value);
        }

        const logPath = this.getLogPath(type, sessionId);
        this.writeToFile(logPath, logEntry);
    }

    static getLogPath(type, sessionId) {
        const baseDir = path.join(__dirname, '../logs');
        switch (type) {
            case 'error':
            case 'system':
                return path.join(baseDir, `${type}.log`);
            case 'info':
                return path.join(baseDir, 'debug_conversations', `${sessionId}.${type}.log`);
            default:
                return path.join(baseDir, 'default.log');
        }
    }

    static writeToFile(filePath, content) {
        fs.appendFile(filePath, content, (err) => {
            if (err) console.error('Error writing to log:', err);
        });
    }
}

module.exports = Logger;