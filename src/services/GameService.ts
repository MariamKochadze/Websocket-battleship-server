import { Game } from '../models/Game';
import { IShip } from '../types';
import { Player } from '../models/Player';
import WebSocket from 'ws';

export class GameService {
    private games: Map<string, Game> = new Map();

    createGame(roomId: string, players: Player[]): Game {
        const game = new Game(roomId, players, players[0].index);
        this.games.set(roomId, game);
        return game;
    }

    addShips(gameId: string, playerIndex: string, ships: IShip[]): boolean {
        const game = this.games.get(gameId);
        if (game) {
            game.ships.set(playerIndex, ships);
            if (game.ships.size === 2) {
                this.startGame(game);
            }
            return true;
        }
        return false;
    }

    private startGame(game: Game) {
        game.players.forEach(player => {
            const ships = game.ships.get(player.index);
            this.broadcast({
                type: 'start_game',
                data: {
                    ships,
                    currentPlayerIndex: player.index
                },
                id: 0
            }, [player.socket]);
        });

        this.broadcastTurn(game);
    }

    attack(gameId: string, playerIndex: string, x: number, y: number) {
        const game = this.games.get(gameId);
        if (!game || game.currentPlayer !== playerIndex) return;

        const opponent = game.players.find(p => p.index !== playerIndex);
        if (!opponent) return;

        const result = this.processAttack(game, opponent.index, x, y);
        this.broadcastAttackResult(game, x, y, result);

        if (result !== 'miss') {
            if (this.checkWinCondition(game, opponent.index)) {
                this.endGame(game, playerIndex);
            }
        } else {
            game.currentPlayer = opponent.index;
            this.broadcastTurn(game);
        }
    }

    private processAttack(game: Game, targetPlayerIndex: string, x: number, y: number): 'miss' | 'shot' | 'killed' {
        const targetShips = game.ships.get(targetPlayerIndex);
        if (!targetShips) return 'miss';

        // Check if hit any ship
        for (const ship of targetShips) {
            if (this.isHit(ship, x, y)) {
                if (this.isShipKilled(game.board.get(targetPlayerIndex)!, ship)) {
                    return 'killed';
                }
                return 'shot';
            }
        }
        return 'miss';
    }

    private isHit(ship: IShip, x: number, y: number): boolean {
        if (ship.direction) { // horizontal
            return y === ship.position.y && 
                   x >= ship.position.x && 
                   x < ship.position.x + ship.length;
        } else { // vertical
            return x === ship.position.x && 
                   y >= ship.position.y && 
                   y < ship.position.y + ship.length;
        }
    }

    private isShipKilled(board: boolean[][], ship: IShip): boolean {
        if (ship.direction) {
            for (let x = ship.position.x; x < ship.position.x + ship.length; x++) {
                if (!board[x][ship.position.y]) return false;
            }
        } else {
            for (let y = ship.position.y; y < ship.position.y + ship.length; y++) {
                if (!board[ship.position.x][y]) return false;
            }
        }
        return true;
    }

    private checkWinCondition(game: Game, playerIndex: string): boolean {
        const ships = game.ships.get(playerIndex);
        const board = game.board.get(playerIndex);
        if (!ships || !board) return false;

        return ships.every(ship => this.isShipKilled(board, ship));
    }

    private broadcastAttackResult(game: Game, x: number, y: number, status: 'miss' | 'shot' | 'killed') {
        game.players.forEach(player => {
            this.broadcast({
                type: 'attack',
                data: {
                    position: { x, y },
                    currentPlayer: game.currentPlayer,
                    status
                },
                id: 0
            }, [player.socket]);
        });
    }

    private endGame(game: Game, winnerIndex: string) {
        this.broadcast({
            type: 'finish',
            data: { winPlayer: winnerIndex },
            id: 0
        }, game.players.map(p => p.socket));  // Add the sockets array as second argument
    }
    
    private broadcastTurn(game: Game) {
        this.broadcast({
            type: 'turn',
            data: { currentPlayer: game.currentPlayer },
            id: 0
        }, game.players.map(p => p.socket));  // Add the sockets array as second argument
    }
    

    private broadcast(message: any, sockets: WebSocket[]) {
        const messageStr = JSON.stringify(message);
        sockets.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(messageStr);
            }
        });
    }
}
