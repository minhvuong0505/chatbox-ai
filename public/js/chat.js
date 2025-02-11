$(document).ready(function() {
    const ChatWidget = {
        init: function() {
            this.appendHtml();
            this.cacheDom();
            this.bindEvents();
            this.socket = io({ transports: ["websocket"] });
            this.initializeSocketEvents();
            this.showChatButton();
        },
        appendHtml: function() {
            const chatHtml = `
                <div class="chat-widget" id="chatWidget">
                    <div class="chat-header" id="chatHeader">
                        <span>Chat with us!</span>
                        <button id="closeChatButton">✖</button>
                    </div>
                    <div class="chat-body" id="chatBody"></div>
                    <div class="chat-footer">
                        <textarea id="chatInput" placeholder="Type a message..."></textarea>
                        <button id="sendButton">➤</button>
                    </div>
                </div>
                <button id="chatButton">💬</button>
            `;
            $('body').append(chatHtml);
        },
        cacheDom: function() {
            this.$chatButton = $('#chatButton');
            this.$chatWidget = $('#chatWidget');
            this.$chatHeader = $('#chatHeader');
            this.$chatBody = $('#chatBody');
            this.$chatInput = $('#chatInput');
            this.$sendButton = $('#sendButton');
            this.$closeChatButton = $('#closeChatButton');
        },
        bindEvents: function() {
            this.$chatButton.on('click', this.openChat.bind(this));
            this.$closeChatButton.on('click', this.closeChat.bind(this));
            this.$sendButton.on('click', this.sendMessage.bind(this));
            // this.$chatInput.on('input', this.autoResizeTextarea.bind(this));
            this.$chatInput.on('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        },
        showChatButton: function() {
            setTimeout(() => {
                this.$chatButton.addClass('show');
            }, 100);
        },
        openChat: function() {
            this.$chatWidget.addClass('open');
            this.$chatWidget.css('display', 'flex');
            this.$chatButton.removeClass('show');
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            if(this.$chatBody.find('div').length == 0){
                this.displayBotTyping();
                setTimeout(() => {
                    this.removeBotTyping();
                    this.displayMessage('Hello! How can I help you today?', 'bot');
                }, 1000);
            }
            this.$chatInput.focus();
        },
        closeChat: function() {
            this.$chatWidget.removeClass('open');
            this.$chatWidget.css('display', 'none');
            this.$chatButton.addClass('show');
        },
        sendMessage: function() {
            const userMessage = this.$chatInput.val();
            if (userMessage.trim() !== '') {
                const messageElement = this.displayMessage(userMessage, 'user', true);
                this.socket.emit('chat_message', { userMessage }, (response) => {
                    if (response.status == 1) {
                        // this.displaySuggestivePrompts(response.suggestive_prompts);
                    } else {
                        this.displayErrorMessage('user', response.error);
                    }
                    this.autoResizeTextarea(); // Reset the height after sending the message
                });
                this.$chatInput.val('');
            }
        },
        quickQuestionsEmbedding: function(message) {
            const questionPattern = /\*([^*?]+)\?/g;
            let match;
            const parts = [];
            let lastIndex = 0;

            while ((match = questionPattern.exec(message)) !== null) {
                const question = match[0];
                const questionText = match[1].trim() + '?';
                const startIndex = match.index;
                const endIndex = questionPattern.lastIndex;

                // Add the text before the question
                if (startIndex > lastIndex) {
                    parts.push(message.substring(lastIndex, startIndex));
                }

                // Add the clickable question
                const questionElement = $('<a>').addClass('quick-question').text('* '+ questionText).attr('href', '#');
                questionElement.on('click', (e) => {
                    e.preventDefault();
                    this.sendMessageFromPrompt(questionText);
                });
                parts.push(questionElement);

                lastIndex = endIndex;
            }

            // Add the remaining text after the last question
            if (lastIndex < message.length) {
                parts.push(message.substring(lastIndex));
            }

            return parts;
        },
        displayMessage: function(message, sender) {
            const messageElement = $('<div>').addClass('message').addClass(sender);
            newScrollingPosistion = this.$chatBody[0].scrollHeight;
            if (sender === 'bot') {
                const embeddedMessage = this.quickQuestionsEmbedding(message);
                embeddedMessage.forEach(part => {
                    messageElement.append(part);
                });
                let currentHeight = this.$chatBody[0].scrollHeight;
                let lastMessageHeight = this.$chatBody.find('div:last')[0].scrollHeight;
                newScrollingPosistion = currentHeight - lastMessageHeight;
            } else {
                messageElement.html(message);
            }
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(newScrollingPosistion);
            return messageElement;
        },
        displayBotTyping: function() {
            const messageElement = $('<div>').addClass('message').addClass('bot').addClass('typing-indicator')
                .html(`<span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>`);
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            return messageElement;
        },
        removeBotTyping: function() {
            $('.message.typing-indicator').remove(); // Remove the "Bot is typing..." message
        },
        // Ghost function
        // displaySuggestivePrompts: function(suggestivePrompts) {
        //     const suggestivePromptsContainer = $('<div>').addClass('suggestive-prompts');
        //     if (suggestivePrompts.length == 0) return;
        //     suggestivePrompts.forEach(prompt => {
        //         const promptElement = $('<a>').addClass('suggestive-prompt').text(prompt.trim()).attr('href', '#');
        //         promptElement.on('click', (e) => {
        //             e.preventDefault();
        //             this.sendMessageFromPrompt(prompt);
        //             suggestivePromptsContainer.remove();
        //         });
        //         suggestivePromptsContainer.append(promptElement);
        //     });
        //     this.$chatBody.append(suggestivePromptsContainer);
        //     this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
        // },
        sendMessageFromPrompt: function(prompt) {
            this.$chatInput.val(prompt);
            this.sendMessage();
        },
        displayErrorMessage: function(sender, errorMessage) {
            const errorMessageElement = $('<div>').addClass('message').addClass('error-label').addClass(sender).html(errorMessage);
            this.$chatBody.append(errorMessageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            this.removeBotTyping();
            return errorMessageElement;
        },
        autoResizeTextarea: function() {
            this.$chatInput.css('height', 'auto');
            this.$chatInput.css('height', this.$chatInput[0].scrollHeight + 'px');
        },
        setCookie: function(name, value) {
            document.cookie = `${name}=${value}; path=/`;
        },
        initializeSocketEvents: function() {
            this.socket.on('bot_status', (data) => {
                if (data.status === 'typing') {
                    this.displayBotTyping();
                } else if (data.status === 'idle') {
                    this.removeBotTyping();
                }
            });
            this.socket.on('chat_message', (res) => this.displayMessage(res.message, res.sender));
            this.socket.on('set-cookie', (data) => this.setCookie(data.name, data.value));
            this.socket.on('load_chat', (data) => this.loadMessagesFromStorage(data));

            this.socket.on('connect', () => {
                console.log('Connected to server');
            });
            this.socket.on("connect_error", (err) => {
                console.error("WebSocket connection error:", err);
                this.displayErrorMessage("user", "Lost connect to server. Reconnecting...");
            });

            this.socket.on("disconnect", (reason) => {
                console.warn("Disconnected from server:", reason);
                this.displayErrorMessage("user", "Lost connect to server. Reconnecting...");
            });
        },
        loadMessagesFromStorage: function(messages) {
            messages.forEach((msg) => {
                this.displayMessage(msg.message, msg.sender);
            });
        }
    };

    ChatWidget.init();
});