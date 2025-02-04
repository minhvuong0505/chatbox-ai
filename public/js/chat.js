
$(document).ready(function() {
    const ChatWidget = {
        init: function() {
            this.appendHtml();
            this.cacheDom();
            this.bindEvents();
            this.socket = io();
            this.socket.on('chat message', (msg) => this.displayMessage(msg, 'bot'));
            this.socket.on('set-cookie', (data) => this.setCookie(data.name, data.value));
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
        openChat: function() {
            this.$chatWidget.css('display', 'flex');
            this.$chatButton.hide();
        },
        closeChat: function() {
            this.$chatWidget.hide();
            this.$chatButton.show();
        },
        sendMessage: function() {
            const userMessage = this.$chatInput.val();
            if (userMessage.trim() !== '') {
                this.displayMessage(userMessage, 'user');
                this.socket.emit('chat message', userMessage);
                this.$chatInput.val('');
                this.autoResizeTextarea(); // Reset the height after sending the message
            }
        },
        displayMessage: function(message, sender) {
            const messageElement = $('<div>').addClass('message').addClass(sender).text(message);
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
        },
        autoResizeTextarea: function() {
            this.$chatInput.css('height', 'auto');
            // this.$chatInput.css('height', this.$chatInput[0].scrollHeight + 'px');
            this.$chatInput.css('height', '20px');
        },
        setCookie: function(name, value) {
            document.cookie = `${name}=${value}; path=/`;
        }
    };

    ChatWidget.init();
});