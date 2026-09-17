import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import {
  ClientMessage,
  ServerMessage,
  LobbyPlayer
} from '@bomberman/shared';
import { GameEngine } from '../engine/GameEngine.js';

/**
 * Gère l'ensemble de la couche réseau (WebSockets) du serveur.
 * Sert de pont entre les clients et le moteur de jeu (GameEngine).
 */
export class SocketManager {

  private wss: WebSocketServer;

  /**
   * Dictionnaire liant l'UUID unique de chaque joueur à sa connexion WebSocket active.
   */
  private clients: Map<string, WebSocket> = new Map();

  /**
   * Liste des joueurs actuellement dans le salon d'attente (Lobby).
   */
  private lobbyPlayers: LobbyPlayer[] = [];

  /**
   * Référence sur le moteur de jeu.
   */
  private engine: GameEngine;

  /**
   * Initialise le serveur WebSocket et le lie au moteur de jeu.
   *
   * @param port - Le port sur lequel le serveur écoute.
   * @param engine - L'instance du GameEngine, utilisée pour transmettre les actions des joueurs.
   */
  constructor(port: number, engine: GameEngine) {
    this.engine = engine;
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
  private handleConnection(ws: WebSocket) {
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
        // Traitement du message mal formé
        this.sendMessage(ws, {
          type: 'ERROR',
          payload: { message: 'Invalid JSON or message structure' }
        });
      }
    });

    // Gestion de la déconnexion du client
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== clientId);
      this.broadcastLobbyState(); // Mise à jour de l'état du lobby pour les autres joueurs
    });
  }

  /**
   * Traite les requêtes (JOIN, READY, ACTION, PING) envoyées par un client.
   *
   * @param clientId - L'UUID du client expéditeur.
   * @param message - Le message typé reçu du client.
   */
  private handleClientMessage(clientId: string, message: ClientMessage) {
    switch (message.type) {
      case 'JOIN':
        // Le joueur rejoint le lobby
        this.lobbyPlayers.push({
          id: clientId,
          name: message.payload.name,
          isReady: false
        });
        // Notification de l'arrivée aux autres clients
        this.broadcastLobbyState();
        break;

      case 'READY': {
        // Le joueur confirme qu'il est prêt à démarrer
        const player = this.lobbyPlayers.find(p => p.id === clientId);
        if (player) {
          player.isReady = message.payload?.isReady ?? true;
          this.broadcastLobbyState();
          // Vérification si tous les joueurs sont prêts pour lancer la partie
          this.checkGameStart();
        }
        break;
      }

      case 'ACTION': {
        // Transmission de l'action réseau (ex: poser une bombe) à la file d'attente du GameEngine
        this.engine.ajouterAction({
          playerId: clientId,
          actionType: message.payload.actionType
        });
        break;
      }

      case 'PING': {
        // Réponse au PING pour maintenir la connexion ou calculer la latence
        const ws = this.clients.get(clientId);
        if (ws) {
          this.sendMessage(ws, {
            type: 'PONG',
            payload: { timestamp: message.payload?.timestamp || Date.now() }
          });
        }
        break;
      }
    }
  }

  /**
   * Diffuse l'état actuel du salon d'attente à tous les clients connectés.
   * Permet aux interfaces clientes d'afficher la liste des joueurs et d'activer le bouton 'Prêt'.
   */
  private broadcastLobbyState() {
    // La partie peut démarrer si au moins 2 joueurs sont présents et tous sont en statut 'READY'
    const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);
    
    this.broadcast({
      type: 'LOBBY_STATE',
      payload: {
        players: this.lobbyPlayers,
        canStart
      }
    });
  }

  /**
   * Vérifie si les conditions de lancement sont réunies et déclenche le démarrage du jeu.
   */
  private checkGameStart() {
    const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);

    if (canStart && this.engine.obtenirEtatActuel().status === 'WAITING') {
      // Transmission de la position et des informations des joueurs au moteur
      this.engine.initPlayers(this.lobbyPlayers);

      // Récupération de l'état initial du jeu (joueurs à leur point d'apparition)
      const initialState = this.engine.obtenirEtatActuel();

      // Notification aux clients du début de la partie
      this.broadcast({
        type: 'GAME_START',
        payload: { initialState }
      });
      
      console.info('SocketManager: All players ready, GAME_START broadcasted!');
    }
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
   * Ferme le serveur WebSocket et toutes les connexions actives.
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      for (const ws of this.clients.values()) {
        ws.terminate();
      }
      this.clients.clear();
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
  public sendMessage(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Méthode utilitaire pour diffuser un message à tous les clients simultanément.
   * (Utilisée fréquemment, au minimum à chaque tick du serveur).
   *
   * @param message - Le message typé à diffuser.
   */
  public broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

}
