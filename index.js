const App = require('./app.js'); 

async function startServer() {
    try {
        const app = new App();
        await app.start();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();