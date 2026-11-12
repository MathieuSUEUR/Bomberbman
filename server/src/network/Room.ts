import { WebSocket } from 'ws';
import {
    LobbyPlayer,
    ServerMessage,
    ActionType,
    RoomSummary
} from '@bomberman/shared';
import { GameEngine } from '../engine/GameEngine.js';

/**
 * Représente un salon de jeu isolé (Room).
 * Chaque salle possède son propre moteur GameEngine, ses propres joueurs et sa boucle de jeu.
 */
export class Room {
    public readonly id: string;
    public name: string;
    public readonly engine: GameEngine;
    public readonly isPermanent: boolean;
    public readonly maxPlayers: number;

    private clients: Map<string, WebSocket> = new Map();
    private lobbyPlayers: LobbyPlayer[] = [];

    constructor(
        id: string,
        name?: string,
        engine?: GameEngine,
        isPermanent: boolean = false,
        maxPlayers: number = 4
    ) {
        this.id = id;
        this.name = name || (id === 'default' ? 'Salon Principal' : `Salon ${id}`);
        this.engine = engine || new GameEngine();
        this.isPermanent = isPermanent;
        this.maxPlayers = maxPlayers;

        this.setupEngineListeners();
    }

    /**
     * Configure les écouteurs sur le GameEngine de cette salle pour diffuser
     * les événements uniquement aux clients présents dans cette salle.
     */
    private setupEngineListeners(): void {
        this.engine.on('tick', (state) => {
            this.broadcast({
                type: 'GAME_STATE',
                payload: state
            });
        });

        this.engine.on('bombExploded', (payload) => {
            this.broadcast({
                type: 'BOMB_EXPLODED',
                payload
            });
        });

        this.engine.on('playerEliminated', (payload) => {
            this.broadcast({
                type: 'PLAYER_ELIMINATED',
                payload
            });
        });

        this.engine.on('gameOver', (payload) => {
            this.broadcast({
                type: 'GAME_OVER',
                payload
            });
            this.lobbyPlayers.forEach(p => {
                p.isReady = false;
            });
            this.broadcastLobbyState();
        });
    }

    /**
     * Ajoute un joueur dans le salon d'attente de cette salle.
     */
    public addPlayer(clientId: string, ws: WebSocket, name: string): boolean {
        if (!this.canJoin()) {
            return false;
        }

        this.clients.set(clientId, ws);
        this.lobbyPlayers.push({
            id: clientId,
            name,
            isReady: false
        });

        this.broadcastLobbyState();
        return true;
    }

    /**
     * Retire un joueur de la salle (déconnexion ou abandon).
     */
    public removePlayer(clientId: string): void {
        this.clients.delete(clientId);
        this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== clientId);
        this.broadcastLobbyState();

        if (this.engine.obtenirEtatActuel().status === 'IN_PROGRESS') {
            this.engine.deconnecterJoueur(clientId);
        }
    }

    /**
     * Met à jour le statut 'prêt' d'un joueur dans le salon.
     */
    public setPlayerReady(clientId: string, isReady: boolean): void {
        const player = this.lobbyPlayers.find(p => p.id === clientId);
        if (player) {
            player.isReady = isReady;
            this.broadcastLobbyState();
            this.checkGameStart();
        }
    }

    /**
     * Transmet une action de joueur au moteur de cette salle.
     */
    public handleAction(clientId: string, actionType: ActionType): void {
        this.engine.ajouterAction({
            playerId: clientId,
            actionType
        });
    }

    /**
     * Diffuse l'état du lobby à tous les clients connectés à cette salle.
     */
    public broadcastLobbyState(): void {
        const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);

        this.broadcast({
            type: 'LOBBY_STATE',
            payload: {
                players: this.lobbyPlayers,
                canStart,
                roomId: this.id
            }
        });
    }

    /**
     * Démarre la partie si tous les joueurs sont prêts.
     */
    public checkGameStart(): void {
        const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);
        const engineStatus = this.engine.obtenirEtatActuel().status;

        if (canStart && (engineStatus === 'WAITING' || engineStatus === 'FINISHED')) {
            if (engineStatus === 'FINISHED') {
                this.engine.reset();
            }

            this.engine.initPlayers(this.lobbyPlayers);
            const initialState = this.engine.obtenirEtatActuel();

            this.broadcast({
                type: 'GAME_START',
                payload: { initialState, roomId: this.id }
            });

            console.info(`Room [${this.id}]: All players ready, GAME_START broadcasted!`);
        }
    }

    /**
     * Diffuse un message à tous les clients de cette salle.
     */
    public broadcast(message: ServerMessage): void {
        const data = JSON.stringify(message);
        for (const ws of this.clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }

    /**
     * Vérifie si de nouveaux joueurs peuvent encore rejoindre cette salle.
     */
    public canJoin(): boolean {
        const status = this.engine.obtenirEtatActuel().status;
        return this.lobbyPlayers.length < this.maxPlayers && status === 'WAITING';
    }

    /**
     * Indique si la salle est vide (aucun client connecté).
     */
    public isEmpty(): boolean {
        return this.clients.size === 0;
    }

    /**
     * Retourne le résumé public de la salle pour l'affichage de la liste des salons.
     */
    public getSummary(): RoomSummary {
        return {
            id: this.id,
            name: this.name,
            playerCount: this.lobbyPlayers.length,
            maxPlayers: this.maxPlayers,
            canJoin: this.canJoin(),
            status: this.engine.obtenirEtatActuel().status
        };
    }

    /**
     * Retourne la liste des joueurs dans le salon.
     */
    public getLobbyPlayers(): LobbyPlayer[] {
        return [...this.lobbyPlayers];
    }

    /**
     * Détruit proprement la salle et arrête la boucle de jeu.
     */
    public destroy(): void {
        this.engine.reset();
        this.clients.clear();
        this.lobbyPlayers = [];
    }
}

