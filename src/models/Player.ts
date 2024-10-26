import { IPlayer } from '../types/index';
import WebSocket from 'ws';

export class Player implements IPlayer {
    constructor(
        public name: string,
        public password: string,
        public index: string,
        public wins: number = 0,
        public socket: WebSocket
    ) {}
}
