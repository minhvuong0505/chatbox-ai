$(document).ready(function() {
    const ChatWidget = {
        init: function() {
            this.appendHtml();
            this.cacheDom();
            this.bindEvents();
            this.socket = io( {transports: ["websocket"]});
            this.initializeSocketEvents();
            // this.loadMessagesFromStorage();
            // window.addEventListener('storage', this.syncMessages.bind(this));
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
                // this.saveMessageToStorage(userMessage, 'user');
                this.socket.emit('chat_message', { msgId, userMessage }, (response) => {
                    if (response.error) {
                        this.displayErrorMessage('user', response.error);
                    } else {
                        messageElement.removeClass('blurred');
                    }
                    this.autoResizeTextarea(); // Reset the height after sending the message
                });
                this.$chatInput.val('');
            }
        },
        displayMessage: function(message, sender, isSending = false) {
            const messageElement = $('<div>').addClass('message').addClass(sender).html(message);
            if(isSending)
                messageElement.addClass('blurred');
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            return messageElement;
        },
        displayTyping: function() {
            const messageElement = $('<div>').addClass('message').addClass('typing-indicator')
            .html(`<span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>`);
         
            this.$chatBody.append(messageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
            return messageElement;
        },
        displaySuggestivePrompts: function(message, sender, blurred = false) {
     
        },
        displayErrorMessage: function(sender, errorMessage) {
            const errorMessageElement = $('<div>').addClass('message').addClass('error-label').addClass(sender).html(errorMessage);
            this.$chatBody.append(errorMessageElement);
            this.$chatBody.scrollTop(this.$chatBody[0].scrollHeight);
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
                    this.displayTyping( );
                } else if (data.status === 'idle') {
                    $('.message.typing-indicator').remove(); // Remove the "Bot is typing..." message
                }
            });
            this.socket.on('chat_message', (res) => this.displayMessage(res.message, res.sender));
            this.socket.on('set-cookie', (data) => this.setCookie(data.name, data.value));
            this.socket.on('load_chat', (data) => this.loadMessagesFromStorage(data));
        },
        // saveMessageToStorage: function(message, sender) {
        //     const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
        //     messages.push({ message, sender });
        //     localStorage.setItem('chatMessages', JSON.stringify(messages));
        //     this.syncMessages();
        // },
        loadMessagesFromStorage: function(messages) {
            // const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
            console.log(messages);
            messages.forEach(msg => this.displayMessage(msg.message, msg.sender));
        },
        // syncMessages: function() {
        //     const messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
        //     this.$chatBody.empty();
        //     messages.forEach(msg => this.displayMessage(msg.message, msg.sender));
        // }
    };

    ChatWidget.init();
});