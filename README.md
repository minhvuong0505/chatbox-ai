# Gemini Chatbot

## Overview

The Gemini Chatbot is an OWASP domain expert chatbot designed to assist users with OWASP-related questions. It leverages advanced AI models to provide concise, meaningful, and accurate answers, along with ready-to-use follow-up questions.

## Technologies Used

- **Node.js**: JavaScript runtime for building the server-side application.
- **Express.js**: Web framework for Node.js.
- **Socket.io**: Real-time, bidirectional communication between web clients and servers.
- **Google Generative AI**: For generating responses using the Gemini model.
- **Xenova Transformers**: For feature extraction and similarity search.
- **Multer**: Middleware for handling `multipart/form-data` for file uploads.
- **CSV-Parser**: For parsing CSV files.
- **Sanitize-HTML**: For sanitizing user inputs.
- **UUID**: For generating unique session IDs.

## Project Structure

|-- .env
|-- .env_example
|-- .gitignore
|-- README.md
|-- app.js
|-- config
|   |-- config.js
|-- controllers
|   |-- chatController.js
|-- database
|   |-- conversations
|   |-- owasp_qa_with_answers.csv
|   |-- sessions
|   |-- upload_databases
|       |-- vectorDB
|           |-- owasp_qa_with_answers.csv
|-- index.js
|-- logs
|   |-- debug_conversations
|   |-- error.log
|   |-- system.log
|-- old_server.js
|-- package.json
|-- public
|   |-- images
|   |-- js
|       |-- chat.js
|   |-- styles
|       |-- style.css
|   |-- view
|       |-- index.html
|-- services
|   |-- messageService.js
|   |-- modelService.js
|   |-- sessionService.js
|   |-- vectorDatabaseService.js
|-- test.js
|-- utils
    |-- logger.js
    |-- memoryMonitor.js

## Frontend Description

The frontend of the Gemini Chatbot is a simple web interface that allows users to interact with the chatbot. It is built using HTML, CSS, and JavaScript, and it leverages Socket.io for real-time communication with the server.

### Key Components

- **HTML**: The structure of the web interface is defined in the `public/view/index.html` file.
- **CSS**: The styles for the web interface are defined in the `public/styles/style.css` file.
- **JavaScript**: The client-side logic for the chatbot is implemented in the `public/js/chat.js` file.

### Features

- **Chat Widget**: A floating chat widget that users can open to interact with the chatbot.
- **Real-time Communication**: Uses Socket.io to send and receive messages in real-time.
- **Bot Typing Indicator**: Displays a typing indicator when the bot is processing a message.
- **Message Display**: Displays user and bot messages in the chat widget.
- **Error Handling**: Displays error messages if there are issues with the WebSocket connection.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup

1. **Clone the repository:**
    ```sh
    git clone https://github.com/yourusername/gemini-chatbot.git
    cd gemini-chatbot
    ```

2. **Install dependencies:**
    ```sh
    npm install
    ```

3. **Set up environment variables:**
    - Copy [.env_example](http://_vscodecontentref_/7) to [.env](http://_vscodecontentref_/8):
        ```sh
        cp .env_example .env
        ```
    - Fill in the required environment variables in the [.env](http://_vscodecontentref_/9) file:
        ```
        PORT=3000
        GEMINI_API_KEY=your_gemini_api_key
        INITIAL_DATABASE=database/owasp_qa_with_answers.csv
        INITIAL_CHATBOT_TOPIC=Welcome to OWSAP QA Chatbot.
        DEBUG=true
        ```

4. **Run the application locally:**
    ```sh
    npm start
    ```

    The server will start on the port specified in the [.env](http://_vscodecontentref_/10) file (default is 3000).

5. **Access the application:**
    Open your browser and navigate to `http://localhost:3000`.

## Deployment

To deploy the application, follow these steps:

1. **Set up your server environment:**
    - Ensure Node.js and npm are installed on your server.
    - Clone the repository to your server.
    - Install the dependencies using `npm install`.

2. **Configure environment variables:**
    - Set up the [.env](http://_vscodecontentref_/11) file with the appropriate values for your production environment.

3. **Start the server:**
    - Use a process manager like `pm2` to keep your application running:
        ```sh
        pm2 start index.js --name gemini-chatbot
        ```

## Gemini API Setup

1. **Obtain API Key:**
    - Sign up for the Google Generative AI service and obtain your API key.

2. **Configure API Key:**
    - Add your API key to the [.env](http://_vscodecontentref_/12) file:
        ```
        GEMINI_API_KEY=your_gemini_api_key
        ```

## Additional Information

- **Logs:**
    - Application logs are stored in the [logs](http://_vscodecontentref_/13) directory.
    - Debug conversations are logged in [debug_conversations](http://_vscodecontentref_/14).

- **Database:**
    - The initial database is loaded from [owasp_qa_with_answers.csv](http://_vscodecontentref_/15).
    - Conversations and sessions are stored in the [conversations](http://_vscodecontentref_/16) and [sessions](http://_vscodecontentref_/17) directories, respectively.

- **File Uploads:**
    - CSV files can be uploaded via the `/upload_csv` endpoint.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.