import { WebSocket } from 'ws';

export interface IPlayer {
    name: string;
    password: string;
    index: string;
    wins: number;
    socket: WebSocket;
}


export interface IRoom {
    roomId: string;
    players: IPlayer[];
}

export interface IShip {
    position: {
        x: number;
        y: number;
    };
    direction: boolean;
    length: number;
    type: 'small' | 'medium' | 'large' | 'huge';
}

export interface IGame {
    gameId: string;
    players: IPlayer[];
    ships: Map<string, IShip[]>;
    currentPlayer: string;
    board: Map<string, boolean[][]>;
}

export interface IMessage {
    type: string;
    data: any;
    id: string|number;
}
