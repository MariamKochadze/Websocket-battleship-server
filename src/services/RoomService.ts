import { Room } from '../models/Room';
import { Player } from '../models/Player';
import WebSocket from 'ws';

export class RoomService {
    private rooms: Map<string, Room> = new Map();
    private connectedSockets: Set<WebSocket> = new Set();

    constructor() {
        this.rooms = new Map();
    }

    addSocket(socket: WebSocket) {
        this.connectedSockets.add(socket);
    }

    removeSocket(socket: WebSocket) {
        this.connectedSockets.delete(socket);
    }

    createRoom(player: Player): Room {
        const roomId = Math.random().toString(36).substring(7);
        const room = new Room(roomId, [player]);
        this.rooms.set(roomId, room);
        this.broadcastRoomUpdate();
        return room;
    }

    addPlayerToRoom(roomId: string, player: Player): Room | null {
        const room = this.rooms.get(roomId);
        if (room && room.players.length < 2) {
            room.players.push(player);
            this.broadcastRoomUpdate();
            return room;
        }
        return null;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    private broadcastRoomUpdate() {
        const availableRooms = Array.from(this.rooms.values())
            .filter(room => room.players.length === 1)
            .map(room => ({
                roomId: room.roomId,
                roomUsers: room.players.map(p => ({
                    name: p.name,
                    index: p.index
                }))
            }));

        const message = JSON.stringify({
            type: 'update_room',
            data: availableRooms,
            id: 0
        });

        this.connectedSockets.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(message);
            }
        });
    }
}
