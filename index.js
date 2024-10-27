import { WebSocket, WebSocketServer } from 'ws';
import { httpServer } from './src/index.js';
import { registerPlayer } from './src/utils/utils.js';
import { rooms, games, players } from './db.js';

const HTTP_PORT = 8181;
const WS_PORT = 3000;

httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP server started on port ${HTTP_PORT}`);
});

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on port ${WS_PORT}`);

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let { type, data, id } = JSON.parse(message);
        let response;

        console.log(`Received command: ${type}, Data: ${data}, ID: ${id}`);

        switch (type) {
            case 'reg':
                response = handlePlayerRegistration(JSON.parse(data), ws); // Pass ws to capture playerId
                break;
            case 'create_room':
                response = handleCreateRoom(ws); // Pass ws to link room to player
                break;
            case 'add_user_to_room':
                response = handleAddUserToRoom(JSON.parse(data), ws); // Pass ws for player details
                break;
            case 'add_ships':
                response = handleAddShips(JSON.parse(data));
                break;
            case 'attack':
                response = handleAttack(JSON.parse(data));
                break;
            default:
                response = { type: 'error', data: JSON.stringify({ errorText: 'Unknown command' }), id: 0 };
        }

        if (response) {
            ws.send(JSON.stringify({ ...response, id }));
        }
    });
});

function handlePlayerRegistration({ name, password }, ws) {
    const result = registerPlayer(name, password);
    if (!result.error) {
        ws.playerId = result.playerId; // Store the playerId on the ws instance
    }
    const data = JSON.stringify({
        name,
        index: result.error ? null : ws.playerId,
        error: result.error,
        errorText: result.errorText || '',
    });
    return { type: 'reg', data, id: 0 };
}

function handleCreateRoom(ws) {
    const roomId = Date.now().toString();
    rooms[roomId] = { players: [] };
    ws.roomId = roomId; // Track which room the socket belongs to

    broadcastUpdateRoom();
    const data = JSON.stringify(formatRoomData());
    return { type: 'update_room', data, id: 0 };
}

function getPlayerDetails(playerId) {
    return players[playerId] || { name: 'Unknown', index: playerId };
}

function handleAddUserToRoom({ indexRoom }, ws) {
    const playerId = ws.playerId;
    const room = rooms[indexRoom];
    const playerDetails = getPlayerDetails(playerId.toString());

    console.log(playerId)
    console.log(players)
    // console.log(playerDetails);

    if (!room) {
        return { type: 'error', data: JSON.stringify({ errorText: 'Room does not exist' }), id: 0 };
    }

    if (room.players.length >= 2) {
        return { type: 'error', data: JSON.stringify({ errorText: 'Room is full' }), id: 0 };
    }

    room.players.push({ name: playerDetails.name, index: playerId });

    if (room.players.length === 2) {
        const gameId = Date.now().toString();
        games[gameId] = { players: room.players, board: {} };

        room.players.forEach((player) => {
            const playerSocket = [...wss.clients].find(
                (client) => client.readyState === WebSocket.OPEN && client.playerId === player.index
            );
            if (playerSocket) {
                playerSocket.send(
                    JSON.stringify({
                        type: 'create_game',
                        data: JSON.stringify({
                            idGame: gameId,
                            idPlayer: player.index,
                        }),
                        id: 0,
                    })
                );
            }
        });
        return;
    }

    broadcastUpdateRoom();
    return { type: 'update_room', data: JSON.stringify(formatRoomData()), id: 0 };
}



function handleAddShips({ gameId, ships, indexPlayer }) {
    const game = games[gameId];
    if (!game) return { type: 'error', data: JSON.stringify({ errorText: 'Game not found' }), id: 0 };

    game.board[indexPlayer] = ships;

    if (Object.keys(game.board).length === 2) {
        const data = JSON.stringify({
            ships,
            currentPlayerIndex: indexPlayer,
        });
        return {
            type: 'start_game',
            data,
            id: 0,
        };
    }
    return { type: 'waiting_for_opponent', data: JSON.stringify({}), id: 0 };
}

function handleAttack({ gameId, x, y, indexPlayer }) {
    const game = games[gameId];
    const result = checkHit(game, x, y, indexPlayer);
    const data = JSON.stringify({
        position: { x, y },
        currentPlayer: indexPlayer,
        status: result,
    });
    return { type: 'attack', data, id: 0 };
}

function checkHit(game, x, y, indexPlayer) {
    return 'miss'; // Placeholder
}

function broadcastUpdateRoom() {
    const roomData = JSON.stringify(formatRoomData());
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update_room', data: roomData, id: 0 }));
        }
    });
}

function formatRoomData() {
    return Object.keys(rooms).map((roomId) => ({
        roomId,
        roomUsers: rooms[roomId].players.map((player) => ({
            name: player.name,
            index: player.index,
        })),
    }));
}

process.on('SIGINT', () => {
    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit();
    });
});
