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
                        <img src="images/bot-avatar.svg">
                        <span>I am Hooman</span>
                    </div>
                    <div class="chat-body" id="chatBody"></div>
                    <div class="chat-footer">
                        <textarea id="chatInput" placeholder="Type a message..."></textarea>
                        <button id="sendButton">➤</button>
                    </div>
                </div>
                <button id="chatButton">
                    <div class="open-icon show">
                        <img src="images/chat-bubble.svg">
                    </div>
                    <div class="close-icon" >
                        <img src="images/close-chat.svg">
                    </div>
                </button>
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
        },
        bindEvents: function() {
            this.$chatButton.on('click', this.openChat.bind(this));
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
            if(this.$chatWidget.hasClass('open')) {
                this.$chatWidget.removeClass('open');
                this.$chatButton.find('.close-icon').removeClass('show');
                this.$chatButton.find('.open-icon').addClass('show');
                return;
            }
            this.$chatWidget.addClass('open');
            this.$chatButton.find('.close-icon').addClass('show');
            this.$chatButton.find('.open-icon').removeClass('show');
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            // if(this.$chatBody.find('div').length == 0){
                // this.displayBotTyping();
                // setTimeout(() => {
                //     this.removeBotTyping();
                //     this.displayMessage('Hello! How can I help you today?', 'bot');
                // }, 1000);
            // }
            if(this.detectDevice() == 'desktop')
                this.$chatInput.focus();
        },
        initChat: function() {
            this.displayBotTyping();
            setTimeout(() => {
                this.removeBotTyping();
                this.displayMessage('Hello! How can I help you today?', 'bot');
            }, 1000);
        },
        sendMessage: function() {
            const userMessage = this.$chatInput.val();
            if (userMessage.trim() !== '') {
                const messageElement = this.displayMessage(userMessage, 'user', true);
                this.socket.emit('chat_message', { userMessage }, (response) => {
                    if (response.status == 1) {
                        messageElement.html(response.sanitize);
                    } else {
                        this.displayErrorMessage('user', response.error);
                    }
                });
                this.$chatInput.val('');
            }
        },
        quickQuestionsEmbedding: function(message) {
            // const questionPattern = /\*([^*?]*(?!<br>)[^*?]*)\?/g;
            const questionPattern = /\*([^*?\n<>]*(?:<(?!br>)[^<>]*>[^*?\n<>]*)*)\?/g;
            
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
                    if(typeof part === 'string') 
                            part = this.escapeHtml(part);

                    messageElement.append(part);
                });
                let currentHeight = this.$chatBody[0].scrollHeight;
                let lastMessageHeight = this.$chatBody.find('div:last').length ? this.$chatBody.find('div:last')[0].scrollHeight : 0;
                newScrollingPosistion = currentHeight - lastMessageHeight;
            } else {
                messageElement.html(message);
            }
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(newScrollingPosistion);
            return messageElement;
        },
        escapeHtml : function(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/&lt;br&gt;/g, "<br>")
                .replace(/&lt;code&gt;/g, "<code>")
                .replace(/&lt;\/code&gt;/g, "</code>");
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
            if(messages.length == 0) return;
            messages.forEach((msg) => {
                this.displayMessage(msg.message, msg.sender);
            });
        },
        detectDevice: function() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                return 'phone';
            }
            if (/android/i.test(userAgent)) {
                return 'phone';
            }
            return 'desktop';
        },
    };

    ChatWidget.init();
});