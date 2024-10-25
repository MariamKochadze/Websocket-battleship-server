import WebSocket from 'ws';
import { config } from './config/config';

const PORT = 8181;
console.log(`WebSocket Server starting on ws://localhost:${PORT}`);

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message.toString());
        console.log('Received command:', parsedMessage);
        // Your message handling logic here
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

process.on('SIGTERM', () => {
    console.log('Closing WebSocket server');
    wss.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
    });
});
