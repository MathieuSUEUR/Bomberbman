//Gere les actions et les joueurs

import { GameMessage } from '@bomberman/shared';

export enum GameState {
    LOBBY = 'LOBBY',
    IN_GAME = 'IN_GAME',
    GAME_OVER = 'GAME_OVER'
}

export interface PlayerData {
    id: string;
    name: string;
}

export interface QueuedAction {
    playerId: string;
    message: GameMessage;
    timestamp: number;
}

export class GameManager {

    private state: GameState = GameState.LOBBY;
    private players: Map<string, PlayerData> = new Map();

    // File d'attente pour que le moteur de jeu puisse lire les actions
    private actionQueue: QueuedAction[] = [];

    constructor() { }

    public getState(): GameState {
        return this.state;
    }

    public startGame() {
        this.state = GameState.IN_GAME;
        console.log("[GameManager] La partie a commencé !");
    }

    public getPlayersCount(): number {
        return this.players.size;
    }

    public addPlayer(id: string, name: string): boolean {
        if (this.state !== GameState.LOBBY) {
            console.log(`[GameManager] Impossible d'ajouter ${name}, la partie est en cours.`);
            return false;
        }

        if (this.players.size >= 4) {
            console.log(`[GameManager] Impossible d'ajouter ${name}, le salon est plein.`);
            return false;
        }

        this.players.set(id, { id, name });
        console.log(`[GameManager] ${name} a rejoint. Total: ${this.players.size}/4`);
        return true;
    }

    public removePlayer(id: string) {
        if (this.players.has(id)) {
            const player = this.players.get(id)!;
            this.players.delete(id);
            console.log(`[GameManager] ${player.name} a quitté la partie.`);
        }
    }

    public getPlayer(id: string): PlayerData | undefined {
        return this.players.get(id);
    }

    // Ajoute l'action reçue par le WebSocket dans la file d'attente du Moteur
    public queueAction(playerId: string, message: GameMessage) {
        this.actionQueue.push({
            playerId,
            message,
            timestamp: Date.now()
        });
        console.log(`[GameManager] Action ajoutée à la file pour ${playerId}: ${message.type}`);
    }

    // appel a chaque tickrate pour récupérer les inputs
    public consumeActions(): QueuedAction[] {
        const actions = [...this.actionQueue];
        this.actionQueue = []; // On vide la file après l'avoir lue
        return actions;
    }
}
