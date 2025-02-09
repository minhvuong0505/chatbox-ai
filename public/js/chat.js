$(document).ready(function() {
    const ChatWidget = {
        init: function() {
            this.appendHtml();
            this.cacheDom();
            this.bindEvents();
            this.socket = io();
            this.socket.on('chat_message', (msg) => this.displayMessage(msg, 'bot'));
            this.socket.on('set-cookie', (data) => this.setCookie(data.name, data.value));
            this.loadMessagesFromStorage();
            window.addEventListener('storage', this.syncMessages.bind(this));
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
            this.$chatInput.on('input', this.autoResizeTextarea.bind(this));
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
        },
        closeChat: function() {
            this.$chatWidget.removeClass('open');
            this.$chatWidget.css('display', 'none');
            this.$chatButton.addClass('show');
        },
        sendMessage: function() {
            const userMessage = this.$chatInput.val();
            if (userMessage.trim() !== '') {
                const msgId = Date.now(); // Generate a unique msgId based on the current timestamp
                const messageElement = this.displayMessage(userMessage, 'user', true);
                this.saveMessageToStorage(userMessage, 'user');
                this.socket.emit('chat_message', { msgId, userMessage }, (response) => {
                    if (response.error) {
                        this.displayErrorMessage(messageElement, 'Failed to send message');
                    } else {
                        this.displayMessage(response.message, 'bot');
                        this.saveMessageToStorage(response.message, 'bot');
                        messageElement.removeClass('blurred');
                    }
                });
                this.$chatInput.val('');
                this.autoResizeTextarea(); // Reset the height after sending the message
            }
        },
        displayMessage: function(message, sender, blurred = false) {
            const messageElement = $('<div>').addClass('message').addClass(sender).html(message);
            if (blurred) {
                messageElement.addClass('blurred');
            }
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            return messageElement;
        },
        displayErrorMessage: function(messageElement, errorMessage) {
            messageElement.removeClass('blurred').addClass('error');
            const errorLabel = $('<div>').addClass('error-label').html(errorMessage);
            messageElement.append(errorLabel);
        },
        autoResizeTextarea: function() {
            this.$chatInput.css('height', 'auto');
            this.$chatInput.css('height', this.$chatInput[0].scrollHeight + 'px');
        },
        setCookie: function(name, value) {
            document.cookie = `${name}=${value}; path=/`;
        },
        saveMessageToStorage: function(message, sender) {
            const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
            messages.push({ message, sender });
            localStorage.setItem('chatMessages', JSON.stringify(messages));
            this.syncMessages();
        },
        loadMessagesFromStorage: function() {
            const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
            messages.forEach(msg => this.displayMessage(msg.message, msg.sender));
        },
        syncMessages: function() {
            const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
            this.$chatBody.empty();
            messages.forEach(msg => this.displayMessage(msg.message, msg.sender));
        }
    };

    ChatWidget.init();
});