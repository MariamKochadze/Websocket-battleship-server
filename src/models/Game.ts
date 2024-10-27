import { IGame, IPlayer, IShip } from '../types';

export class Game implements IGame {
    public ships: Map<string, IShip[]>;
    public board: Map<string, boolean[][]>;

    constructor(
        public gameId: string,
        public players: IPlayer[],
        public currentPlayer: string
    ) {
        this.ships = new Map();
        this.board = new Map();
        players.forEach(player => {
            this.board.set(player.index, Array(10).fill(null).map(() => Array(10).fill(false)));
        });
    }
}
