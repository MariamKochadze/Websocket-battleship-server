import { IRoom, IPlayer } from '../types';

export class Room implements IRoom {
    constructor(
        public roomId: string,
        public players: IPlayer[] = []
    ) {}
}
