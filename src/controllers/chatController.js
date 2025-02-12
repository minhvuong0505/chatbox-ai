const Logger = require('../utils/logger');

class ChatController {
    constructor(messageService, sessionService, modelService,vectorDatabaseService) {  
        this.messageService = messageService;
        this.sessionService = sessionService;
        this.modelService = modelService;  
        this.vectorDatabaseService = vectorDatabaseService;
    }

    async handleMessage(sessionId,data, callback, sessionSocket, ioSocketServer) {
        const session = this.sessionService.sessions[sessionId];
        try {
            if (session.isProcessing) {
                throw new Error('Chatbot is processing the previous message');
            }
            session.isProcessing = true;
            const sanitizedMessage = await this.messageService.sanitizeInput(data.userMessage);
            if(sanitizedMessage == 'test') throw new Error('Invalid message');
            if (!sanitizedMessage) 
                throw new Error('Invalid message');
            const userMessageParam = {sender: 'user',answerTime: new Date().toISOString(), message: sanitizedMessage}

            this.messageService.saveMessage(sessionId,userMessageParam);
            sessionSocket.broadcast.to(sessionId).emit('chat_message',userMessageParam);

            const retrievedInfoRAG = await this.vectorDatabaseService.search(sanitizedMessage,0.5,3);
            Logger.log('retrieved Info RAG', retrievedInfoRAG, sessionId, 'info');

            const processedMessage = await this.messageService.processMessage(
                session,
                sanitizedMessage,
                retrievedInfoRAG
            );
            
            const botResponse = await this.generateBotResponse(sessionId, processedMessage);
            const botMessageParam = {sender: 'bot',answerTime: botResponse.answerTime, message: botResponse.message}
            this.messageService.saveMessage(sessionId, botMessageParam );
            if(!botResponse.error)
                this.sessionService.saveSession(sessionId, botResponse);
            
            session.isProcessing = false;
            Logger.log('Bot response', botResponse, sessionId, 'info');
            ioSocketServer.to(sessionId).emit('chat_message', botMessageParam);
            ioSocketServer.to(sessionId).emit('bot_status', { status: 'idle' });

            callback({ status: 1, sanitize: sanitizedMessage });
        } catch (error) {
            this.sessionService.sessions[sessionId].isProcessing = false
            session.isProcessing = false;
            Logger.log('Error handling message', error, sessionId, 'error');
            callback({ status: -1, error: error.message });
        }
        return false;
    }

    async generateBotResponse(sessionId, processedMessage) {
        Logger.log('Send to AI', processedMessage.formattedMessage, sessionId, 'info');
        try {
            const result = await this.modelService.generateContent(processedMessage.formattedMessage);

            Logger.log('AI response', result.response.text(), sessionId, 'info');
            const response = await this.parseBotResponse(result.response.text());
            if(response.message == ''){
                // Logger.log('Bot response syntax error', response.message, sessionId, 'error');
                // Logger.log('Switch to raw result', result.response.text(), sessionId, 'error');
                // response.message = result.response.text();
                throw new Error("Bot response syntax error");
            }
            return {
                msgId: Date.now(),
                message: response.message,
                sender: 'bot',
                answerTime: new Date().toISOString(),
                previousTopic: response.previousTopic,
                summary: response.summary,
                error : false,
            };
        } catch (error) {
            Logger.log('Error generating bot response', error, sessionId, 'error');
            return this.handleResponseErrorException(error);
        }
    }

    parseBotResponse(botMessage) {
        const botAnswerMatch = botMessage.match(/ChatBot_Answer:\s*(.*?)\s*End_ChatBot_Answer/s);
        const summaryMatch = botMessage.match(/ChatBot_Summary:\s*(.*?)\s*End_ChatBot_Summary/s);
        const previousTopicMatch = botMessage.match(/ChatBot_Topic:\s*(.*?)\s*$/m);

        return {
            message: botAnswerMatch ? botAnswerMatch[1].replace(/\n/g, '<br>') : '',
            previousTopic: previousTopicMatch ? previousTopicMatch[1] : '',
            summary: summaryMatch ? summaryMatch[1] : ''
        };
    }

    handleResponseErrorException (error) {
        let errorParams = {
            msgId: Date.now(),
            message: 'Sorry, something went wrong! Please try again.',
            sender: 'bot',
            answerTime: new Date().toISOString(),
            previousTopic: '',
            summary: '',
            error : true,
        };

        // if(typeof error.response.candidates != undefined ){
        //     if(error.response.candidates[0].finishReason == "RECITATION")
        //         errorParams.message = error.response.candidates[0].citationMetadata.citationSources[0].uri;
        // }
        return errorParams;
    }

 
}

module.exports = ChatController;