//gere la connection, ecoute des joueurs et envoie les actions au game manager

import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { MessageType, type GameMessage } from '@bomberman/shared';
import { GameManager, GameState } from '../game/GameManager.js';

export class WebSocketManager {

    private wss: WebSocketServer;
    private gameManager: GameManager;
    private clients: Map<WebSocket, string> = new Map(); //pour lier un ws au playerId

    constructor(gameManager: GameManager, port: number) {
        this.gameManager = gameManager;
        this.wss = new WebSocketServer({ port, host: '127.0.0.1' });

        console.log(`[WebSocketManager] Serveur démarré sur le port ${port}`);

        this.wss.on('connection', this.handleConnection.bind(this));
    }

    private broadcast(message: GameMessage, excludeWs?: WebSocket) {
        const data = JSON.stringify(message);
        for (const [clientWs, _] of this.clients.entries()) {
            if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(data);
            }
        }
    }

    private handleConnection(ws: WebSocket) {
        console.log("[WebSocketManager] Nouvelle connexion établie");

        ws.on('message', (message: Buffer) => {
            try {
                const messageParsee: GameMessage = JSON.parse(message.toString());

                //selon le type d'entree json
                switch (messageParsee.type) {

                    case MessageType.JOIN_LOBBY: {
                        const playerName = messageParsee.payload.playerName;
                        const playerId = crypto.randomUUID();

                        // On délègue la vérification au GameManager
                        const added = this.gameManager.addPlayer(playerId, playerName);

                        if (!added) {
                            //salon plein ou partie commencé
                            ws.close();
                            break;
                        }

                        // Enregistre le client
                        this.clients.set(ws, playerId);

                        ws.send(JSON.stringify({
                            type: MessageType.PLAYER_JOINED,
                            payload: { playerId, playerName }
                        }));

                        this.broadcast({
                            type: MessageType.PLAYER_JOINED,
                            payload: { playerId, playerName }
                        }, ws);

                        break;
                    }

                    //intercepte les inputs pour les mettre dans la queue
                    case MessageType.MOVE:
                    case MessageType.PLACE_BOMB: {
                        const playerId = this.clients.get(ws);
                        if (!playerId) return;

                        this.gameManager.queueAction(playerId, messageParsee);//stock dans la queue 
                        break;
                    }

                    default:
                        console.log(`[WebSocketManager] Message non géré : ${messageParsee.type}`);
                }
            } catch (e) {
                console.error('[WebSocketManager] Erreur de parsing JSON', e);
            }
        });

        ws.on('close', () => {
            const playerId = this.clients.get(ws);
            if (playerId) {
                this.clients.delete(ws);
                this.gameManager.removePlayer(playerId);

                this.broadcast({
                    type: MessageType.PLAYER_LEFT,
                    payload: { playerId }
                });
            } else {
                console.log("[WebSocketManager] Connexion non identifiée fermée.");
            }
        });
    }

    //le moteur envoie l'état du jeu
    public broadcastGameState(gameState: any) {
        const message: GameMessage = {
            type: MessageType.GAME_TICK,
            payload: gameState
        };
        this.broadcast(message);
    }
}
