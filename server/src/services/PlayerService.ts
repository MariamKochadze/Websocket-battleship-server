import WebSocket from 'ws';
import { Player } from '../models/Player';

export class PlayerService {
    private players: Map<string, Player> = new Map();

    registerPlayer(name: string, password: string, socket: WebSocket): Player {
        const index = Math.random().toString(36).substr(2, 9);
        const player = new Player(name, password, index, 0, socket);
        this.players.set(index, player);
        return player;
    }

    getPlayer(index: string): Player | undefined {
        return this.players.get(index);
    }

    getPlayers(): Map<string, Player> {
        return this.players;
    }

    findPlayerBySocket(ws: WebSocket): Player | undefined {
        return Array.from(this.players.values()).find(player => player.socket === ws);
    }

    updateWins(playerIndex: string) {
        const player = this.players.get(playerIndex);
        if (player) {
            player.wins += 1;
        }
    }

    getWinners() {
        return Array.from(this.players.values())
            .map(({ name, wins }) => ({ name, wins }))
            .sort((a, b) => b.wins - a.wins);
    }
}
