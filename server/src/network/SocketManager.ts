import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import {
    ClientMessage,
    ServerMessage
} from '@bomberman/shared';
import { GameEngine } from '../engine/GameEngine.js';
import { RoomManager } from './RoomManager.js';

/**
 * Gère l'ensemble de la couche réseau (WebSockets) du serveur.
 * Délègue la gestion des parties et des salons au RoomManager.
 */
export class SocketManager {
    private wss: WebSocketServer;

    /**
     * Dictionnaire liant l'UUID unique de chaque joueur à sa connexion WebSocket active.
     */
    private clients: Map<string, WebSocket> = new Map();

    /**
     * Gestionnaire des salles (multi-room).
     */
    private roomManager: RoomManager;

    /**
     * Initialise le serveur WebSocket et le lie au gestionnaire de salles.
     *
     * @param port - Le port sur lequel le serveur écoute (0 pour port aléatoire dans les tests).
     * @param engine - Moteur de jeu optionnel pour le salon 'default' (maintient la rétrocompatibilité).
     */
    constructor(port: number, engine?: GameEngine) {
        this.roomManager = new RoomManager();
        // Création du salon par défaut permanent pour préserver la rétrocompatibilité totale
        this.roomManager.getOrCreateRoom('default', 'Salon Principal', engine, true);

        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        console.info(`SocketManager: WebSocket server started on port ${port}`);
    }

    /**
     * Gère une nouvelle connexion WebSocket entrante.
     * Assigne un UUID au client et met en place les écouteurs de messages et de déconnexion.
     *
     * @param ws - L'instance WebSocket représentant la connexion du client.
     */
    private handleConnection(ws: WebSocket): void {
        const clientId = randomUUID();
        this.clients.set(clientId, ws);

        // Envoi du message de bienvenue avec l'ID généré pour que le client s'identifie
        this.sendMessage(ws, {
            type: 'WELCOME',
            payload: { playerId: clientId }
        });

        // Gestion de la réception d'un message depuis ce client
        ws.on('message', (data: string) => {
            try {
                const message = JSON.parse(data.toString()) as ClientMessage;
                this.handleClientMessage(clientId, message);
            } catch (error) {
                console.error(`SocketManager: Invalid message from ${clientId}`, error);
                this.sendMessage(ws, {
                    type: 'ERROR',
                    payload: { message: 'Invalid JSON or message structure' }
                });
            }
        });

        // Gestion de la déconnexion du client
        ws.on('close', () => {
            this.clients.delete(clientId);
            this.roomManager.leaveRoom(clientId);
        });
    }

    /**
     * Traite les requêtes reçues d'un client en déléguant à la Room appropriée.
     *
     * @param clientId - L'UUID du client expéditeur.
     * @param message - Le message typé reçu du client.
     */
    private handleClientMessage(clientId: string, message: ClientMessage): void {
        const ws = this.clients.get(clientId);

        switch (message.type) {
            case 'JOIN': {
                if (!ws) return;
                const result = this.roomManager.joinRoom(
                    clientId,
                    ws,
                    message.payload.name,
                    message.payload.roomId
                );

                if (!result.success) {
                    this.sendMessage(ws, {
                        type: 'ERROR',
                        payload: { message: result.reason || 'Impossible de rejoindre la salle' }
                    });
                }
                break;
            }

            case 'READY': {
                const room = this.roomManager.getRoomByClientId(clientId);
                if (room) {
                    room.setPlayerReady(clientId, message.payload?.isReady ?? true);
                }
                break;
            }

            case 'ACTION': {
                const room = this.roomManager.getRoomByClientId(clientId) || this.roomManager.getDefaultRoom();
                room?.handleAction(clientId, message.payload.actionType);
                break;
            }

            case 'PING': {
                if (ws) {
                    this.sendMessage(ws, {
                        type: 'PONG',
                        payload: { timestamp: message.payload?.timestamp || Date.now() }
                    });
                }
                break;
            }

            case 'LIST_ROOMS': {
                if (ws) {
                    this.sendMessage(ws, {
                        type: 'ROOM_LIST',
                        payload: { rooms: this.roomManager.listRooms() }
                    });
                }
                break;
            }

            case 'CREATE_ROOM': {
                const createdRoom = this.roomManager.createRoom({
                    name: message.payload?.name
                });
                if (ws) {
                    this.sendMessage(ws, {
                        type: 'ROOM_CREATED',
                        payload: { roomId: createdRoom.id, name: createdRoom.name }
                    });
                }
                break;
            }
        }
    }

    /**
     * Retourne l'instance de RoomManager pour les besoins avancés ou les tests.
     */
    public getRoomManager(): RoomManager {
        return this.roomManager;
    }

    /**
     * Attend que le serveur WebSocket soit prêt et en écoute.
     */
    public waitUntilReady(): Promise<void> {
        return new Promise((resolve) => {
            if (this.wss.address()) {
                resolve();
            } else {
                this.wss.once('listening', () => {
                    resolve();
                });
            }
        });
    }

    /**
     * Retourne le port sur lequel écoute le serveur WebSocket.
     */
    public getPort(): number {
        const address = this.wss.address();
        if (address && typeof address === 'object') {
            return address.port;
        }
        return 0;
    }

    /**
     * Ferme le serveur WebSocket, détruit toutes les salles et termine toutes les connexions.
     */
    public close(): Promise<void> {
        return new Promise((resolve) => {
            for (const ws of this.clients.values()) {
                ws.terminate();
            }
            this.clients.clear();
            this.roomManager.destroyAll();
            this.wss.close(() => {
                resolve();
            });
        });
    }

    /**
     * Méthode utilitaire pour envoyer un message à un client précis.
     *
     * @param ws - La connexion WebSocket destinataire.
     * @param message - Le message typé à transmettre.
     */
    public sendMessage(ws: WebSocket, message: ServerMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Méthode utilitaire pour diffuser un message à tous les clients connectés.
     *
     * @param message - Le message typé à diffuser.
     */
    public broadcast(message: ServerMessage): void {
        const data = JSON.stringify(message);
        for (const ws of this.clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }
}
