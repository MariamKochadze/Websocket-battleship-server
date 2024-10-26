import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IMessage, IPlayer, IRoom, IShip, IGame } from './src/types/index';

const PORT = 5500;


// Create HTTP server
const httpServer = http.createServer((req, res) => {
    const __dirname = path.resolve(path.dirname(''));
    const filePath = path.join(__dirname, req.url === '/' ? '/front/index.html' : '/front' + req.url);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }
        const contentType = getContentType(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

function getContentType(filePath: string): string {
    const ext = path.extname(filePath);
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'text/javascript';
        case '.json': return 'application/json';
        default: return 'text/plain';
    }
}
// Add at the top with other imports
const WebSocket = require('ws');


// Add these connection options
const wsOptions = {
    server: httpServer,
    clientTracking: true,
    handleProtocols: true
};

// Update WebSocket server creation
const wss = new WebSocket.Server(wsOptions);

// Add connection retry logic
wss.on('connection', (ws: WebSocket) => {
    console.log("New client connected");
    
    // Add heartbeat to keep connection alive
    const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('pong', () => {
        // Client is alive
    });

    ws.on('close', () => {
        clearInterval(interval);
        handlePlayerDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.log('WebSocket error:', error);
        clearInterval(interval);
    });

    // Rest of your existing connection handler code...
});


// Create WebSocket server
const wss = new WebSocket.Server({ server: httpServer });

// Store players, rooms, and games in memory
const players = new Map<string, IPlayer>();
const rooms = new Map<string, IRoom>();
const games = new Map<string, IGame>();

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
    console.log("New client connected");

    ws.on('message', (message) => {
        try {
            const msg: IMessage = JSON.parse(message.toString());
            console.log('Received message:', msg);
            handleClientMessage(ws, msg);
        } catch (error) {
            console.error("Invalid message received:", message);
            ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format', id: 0 }));
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(ws);
    });
});

function handlePlayerDisconnect(ws: WebSocket) {
    const player = findPlayerBySocket(ws);
    if (player) {
        players.delete(player.name);
        updateRooms();
        updateWinners();
    }
    console.log("Client disconnected");
}

// Function to handle different client messages
function handleClientMessage(ws: WebSocket, msg: IMessage) {
    switch (msg.type) {
        case "reg":
            registerPlayer(ws, msg);
            break;
        case "create_room":
            createRoom(ws, msg);
            break;
        case "add_user_to_room":
            addUserToRoom(ws, msg);
            break;
        case "add_ships":
            addShips(ws, msg);
            break;
        case "attack":
            handleAttack(ws, msg);
            break;
        case "randomAttack":
            handleRandomAttack(ws, msg);
            break;
        default:
            ws.send(JSON.stringify({ type: 'error', data: 'Unknown command', id: msg.id }));
    }
}

// Register a new player
function registerPlayer(ws: WebSocket, msg: IMessage) {
    const { name, password } = msg.data;

    if (players.has(name)) {
        ws.send(JSON.stringify({
            type: 'reg',
            data: {
                name,
                error: true,
                errorText: 'Username already exists'
            },
            id: msg.id
        }));
        return;
    }

    const player: IPlayer = {
        name,
        password,
        index: generateId(),
        wins: 0,
        socket: ws
    };
    
    players.set(name, player);
    
    ws.send(JSON.stringify({
        type: 'reg',
        data: {
            name,
            index: player.index,
            error: false,
            errorText: ''
        },
        id: msg.id
    }));
    updateWinners();
}

// Create a game room
function createRoom(ws: WebSocket, msg: IMessage) {
    const player = findPlayerBySocket(ws);
    if (!player) return;

    const roomId = generateId();
    const room: IRoom = { roomId, players: [player] };
    rooms.set(roomId, room);
    updateRooms();
}

// Add player to an existing room
function addUserToRoom(ws: WebSocket, msg: IMessage) {
    const player = findPlayerBySocket(ws);
    if (!player) return;

    const room = rooms.get(msg.data.indexRoom);
    if (room && room.players.length < 2) {
        room.players.push(player);
        if (room.players.length === 2) startGame(room);
    }
    updateRooms();
}

// Start the game when the room has 2 players
function startGame(room: IRoom) {
    const gameId = generateId();
    const game: IGame = {
        gameId,
        players: room.players,
        ships: new Map(),
        currentPlayer: room.players[0].index,
        board: new Map()
    };
    games.set(gameId, game);

    room.players.forEach((p) => {
        p.socket.send(JSON.stringify({
            type: 'create_game',
            data: { idGame: gameId, idPlayer: p.index },
            id: 0
        }));
    });
}

// Add ships to the game board
function addShips(ws: WebSocket, msg: IMessage) {
    const game = games.get(msg.data.gameId);
    if (game) {
        game.ships.set(msg.data.indexPlayer, msg.data.ships);
        if (game.ships.size === 2) {
            game.players.forEach((p) => {
                p.socket.send(JSON.stringify({
                    type: 'start_game',
                    data: {
                        ships: game.ships.get(p.index),
                        currentPlayerIndex: game.currentPlayer
                    },
                    id: 0
                }));
            });
            updateTurn(game);
        }
    }
}

// Process attack
function processAttack(game: IGame, attackData: { x: number; y: number; targetPlayerId: string }): { status: string; position: { x: number; y: number } } {
    const { x, y, targetPlayerId } = attackData;
    const targetBoard = game.board.get(targetPlayerId);
    const targetShips = game.ships.get(targetPlayerId);

    if (!targetBoard || !targetShips) {
        return { status: 'error', position: { x, y } };
    }

    for (const ship of targetShips) {
        for (let i = 0; i < ship.length; i++) {
            const shipX = ship.direction ? ship.position.x + i : ship.position.x;
            const shipY = ship.direction ? ship.position.y : ship.position.y + i;
            if (shipX === x && shipY === y) {
                targetBoard[x][y] = true;
                const isShipSunk = checkIfShipSunk(targetBoard, ship);
                return {
                    status: isShipSunk ? 'killed' : 'shot',
                    position: { x, y }
                };
            }
        }
    }

    targetBoard[x][y] = false;
    return { status: 'miss', position: { x, y } };
}

function checkIfShipSunk(board: boolean[][], ship: IShip): boolean {
    for (let i = 0; i < ship.length; i++) {
        const x = ship.direction ? ship.position.x + i : ship.position.x;
        const y = ship.direction ? ship.position.y : ship.position.y + i;
        if (!board[x][y]) return false;
    }
    return true;
}

function handleAttack(ws: WebSocket, msg: IMessage) {
    const game = games.get(msg.data.gameId);
    if (game) {
        const player = findPlayerBySocket(ws);
        if (!player || game.currentPlayer !== msg.data.indexPlayer) return;

        const attackResult = processAttack(game, msg.data);
        game.players.forEach((p) => {
            p.socket.send(JSON.stringify({
                type: 'attack',
                data: attackResult,
                id: 0
            }));
        });

        if (attackResult.status !== 'shot') {
            updateTurn(game);
        }
    }
}

function handleRandomAttack(ws: WebSocket, msg: IMessage) {
    const game = games.get(msg.data.gameId);
    if (!game) return;

    const x = Math.floor(Math.random() * 10);
    const y = Math.floor(Math.random() * 10);
    
    const attackData = {
        x,
        y,
        targetPlayerId: msg.data.indexPlayer
    };

    const attackResult = processAttack(game, attackData);
    game.players.forEach((p) => {
        p.socket.send(JSON.stringify({
            type: 'attack',
            data: attackResult,
            id: 0
        }));
    });
}

// Utility functions
function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
}

function findPlayerBySocket(ws: WebSocket): IPlayer | undefined {
    return Array.from(players.values()).find((p) => p.socket === ws);
}

function updateRooms() {
    const roomList = Array.from(rooms.values())
        .filter((room) => room.players.length === 1)
        .map(room => ({
            roomId: room.roomId,
            roomUsers: room.players.map((p) => ({
                name: p.name,
                index: p.index
            }))
        }));
    broadcast({ type: 'update_room', data: roomList, id: 0 });
}

function updateWinners() {
    const winners = Array.from(players.values())
        .map(p => ({ name: p.name, wins: p.wins }));
    broadcast({ type: 'update_winners', data: winners, id: 0 });
}

function broadcast(message: any) {
    const messageString = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

function updateTurn(game: IGame) {
    game.currentPlayer = game.players.find(p => p.index !== game.currentPlayer)?.index || game.currentPlayer;
    game.players.forEach((p) => {
        p.socket.send(JSON.stringify({
            type: 'turn',
            data: { currentPlayer: game.currentPlayer },
            id: 0
        }));
    });
}

// Start the server
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server is ready at ws://localhost:${PORT}`);
});
