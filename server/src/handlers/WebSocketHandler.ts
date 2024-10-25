import WebSocket from 'ws';
import { PlayerService } from '../services/PlayerService';
import { RoomService } from '../services/RoomService';
import { GameService } from '../services/GameService';
import { IMessage } from '../types/index';
import { Player } from '../models/Player';

export class WebSocketHandler {
    private connectedClients: Set<WebSocket> = new Set();

    constructor(
        private playerService: PlayerService,
        private roomService: RoomService,
        private gameService: GameService
    ) {}

    handleConnection(ws: WebSocket) {
        this.connectedClients.add(ws);
    }

    handleDisconnection(ws: WebSocket) {
        this.connectedClients.delete(ws);
    }

    handleMessage(ws: WebSocket, message: IMessage) {
        console.log('Received message:', message);

        switch (message.type) {
            case 'reg':
                this.handleRegistration(ws, message.data);
                break;
            case 'create_room':
                this.handleCreateRoom(ws, message.data);
                break;
            case 'add_user_to_room':
                this.handleJoinRoom(ws, message.data);
                break;
            case 'add_ships':
                this.handleAddShips(message.data);
                break;
            case 'attack':
                this.handleAttack(message.data);
                break;
            case 'randomAttack':
                this.handleRandomAttack(message.data);
                break;
        }
    }

    private handleRegistration(ws: WebSocket, data: { name: string; password: string }) {
        try {
            const player = this.playerService.registerPlayer(data.name, data.password, ws);
            
            ws.send(JSON.stringify({
                type: 'reg',
                data: {
                    name: player.name,
                    index: player.index,
                    error: false,
                    errorText: ''
                },
                id: 0
            }));

            this.broadcastMessage({
                type: 'update_winners',
                data: this.playerService.getWinners(),
                id: 0
            });
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'reg',
                data: {
                    error: true,
                    errorText: 'Registration failed'
                },
                id: 0
            }));
        }
    }

    private handleCreateRoom(ws: WebSocket, data: any) {
        const player = this.findPlayerBySocket(ws);
        if (player) {
            const room = this.roomService.createRoom(player);
            ws.send(JSON.stringify({
                type: 'create_game',
                data: {
                    idGame: room.roomId,
                    idPlayer: player.index
                },
                id: 0
            }));
        }
    }

    private handleJoinRoom(ws: WebSocket, data: { indexRoom: string }) {
        const player = this.findPlayerBySocket(ws);
        if (player) {
            const room = this.roomService.addPlayerToRoom(data.indexRoom, player);
            if (room) {
                room.players.forEach(p => {
                    p.socket.send(JSON.stringify({
                        type: 'create_game',
                        data: {
                            idGame: room.roomId,
                            idPlayer: p.index
                        },
                        id: 0
                    }));
                });
            }
        }
    }

    private handleAddShips(data: { gameId: string; ships: any[]; indexPlayer: string }) {
        this.gameService.addShips(data.gameId, data.indexPlayer, data.ships);
    }

    private handleAttack(data: { gameId: string; x: number; y: number; indexPlayer: string }) {
        this.gameService.attack(data.gameId, data.indexPlayer, data.x, data.y);
    }

    private handleRandomAttack(data: { gameId: string; indexPlayer: string }) {
        const randomX = Math.floor(Math.random() * 10);
        const randomY = Math.floor(Math.random() * 10);
        this.gameService.attack(data.gameId, data.indexPlayer, randomX, randomY);
    }

    private findPlayerBySocket(ws: WebSocket): Player | undefined {
        return this.playerService.findPlayerBySocket(ws);
    }

    public broadcastMessage(message: IMessage, sockets?: WebSocket[]) {
        const messageStr = JSON.stringify(message);
        if (sockets) {
            sockets.forEach(socket => socket.send(messageStr));
        } else {
            this.connectedClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(messageStr);
                }
            });
        }
    }
}
