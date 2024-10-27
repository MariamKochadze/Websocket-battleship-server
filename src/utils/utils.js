import { players } from "../../db.js";

export function registerPlayer(name, password) {
    if (players[name]) {
        return { error: true, errorText: 'Player already exists' };
    }
    const playerId = Date.now();
    players[playerId] = { name, password, playerId, wins: 0 };
    return { error: false, playerId };
}