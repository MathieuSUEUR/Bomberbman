import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import {
  ClientMessage,
  ServerMessage,
  LobbyPlayer,
  GameState
} from '@bomberman/shared';
import { GameEngine } from '../engine/GameEngine.js';


//Ce fichier gère l'ensemble de la couche réseau (WebSockets) du serveur, sert de pont entre clients/moteur (GameEngine).


export class SocketManager {

  private wss: WebSocketServer;

  // dictio. qui lie UUID unique de chaque joueur à sa connexion WebSocket active
  private clients: Map<string, WebSocket> = new Map();

  private lobbyPlayers: LobbyPlayer[] = [];

  // référence sur le moteur de jeu
  private engine: GameEngine;



  //Initialise le serveur WebSocket et le lie au moteur de jeu.
  //parametre 1 - 'port' est le port sur lequel le serveur écoute
  //parametre 2 - 'engine' est l'instance du GameEngine, utilisée pour envoyer les actions des joueurs

  constructor(port: number, engine: GameEngine) {
    this.engine = engine;
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
    console.log(`SocketManager: WebSocket server started on port ${port}`);
  }




  //Gère une nouvelle connexion WebSocket entrante. Assigne un UUID au client et met en place les écouteurs de messages et de déconnexion.

  private handleConnection(ws: WebSocket) {
    const clientId = randomUUID();
    this.clients.set(clientId, ws);

    //On envoie le message de bienvenue avec l'ID généré pour que le client se reconnaisse
    this.sendMessage(ws, {
      type: 'WELCOME',
      payload: { playerId: clientId }
    });

    //gere la réception d'un message depuis ce client
    ws.on('message', (data: string) => {
      try {

        const message = JSON.parse(data.toString()) as ClientMessage;
        this.handleClientMessage(clientId, message);

      } catch (error) {

        console.error(`SocketManager: Invalid message from ${clientId}`, error);
        //message mal formé
        this.sendMessage(ws, {
          type: 'ERROR',
          payload: { message: 'Invalid JSON or message structure' }

        });
      }
    });

    //gestion de la deconnexion
    ws.on('close', () => {
      this.clients.delete(clientId);//retirer du lobby
      this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== clientId);
      this.broadcastLobbyState();//partage de l'etat du nouveau lobby
    });
  }




  //Traite les requêtes (JOIN, READY, ACTION, PING) envoyées par un client.
  //prend en parametre 1 "clientId" L'UUID du client expéditeur
  //prend en 2e paramatre "message" Le message typé reçu

  private handleClientMessage(clientId: string, message: ClientMessage) {
    switch (message.type) {

      case 'JOIN':
        // rejoint le lobby
        this.lobbyPlayers.push({
          id: clientId,
          name: message.payload.name,
          isReady: false
        });
        //notif de l'arrivé
        this.broadcastLobbyState();
        break;

      case 'READY':
        //joueur confirme qu'il est prêt à démarrer
        const player = this.lobbyPlayers.find(p => p.id === clientId);
        if (player) {
          player.isReady = message.payload?.isReady ?? true;
          this.broadcastLobbyState();
          //verification si tout le monde est prêt pour lancer la partie
          this.checkGameStart();
        }
        break;

      case 'ACTION':
        //action réseau (ex: poser une bombe) directement passée à la file d'attente du GameEngine.
        this.engine.ajouterAction({
          playerId: clientId,
          actionType: message.payload.actionType
        });
        break;

      case 'PING':
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




  //Diffuse l'état actuel du salon d'attente à tous les clients connectés et permet aux interfaces clientes d'afficher la liste des joueurs et le bouton 'Prêt'.
  private broadcastLobbyState() {
    //La partie peut démarrer si au moins 2 joueurs sont présents et tous sont en statut 'READY'
    const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);
    this.broadcast({
      type: 'LOBBY_STATE',
      payload: {
        players: this.lobbyPlayers,
        canStart
      }
    });
  }




  //Vérifie si les conditions de lancement sont réunies et déclenche le démarrage.
  private checkGameStart() {

    const canStart = this.lobbyPlayers.length >= 2 && this.lobbyPlayers.every(p => p.isReady);//deux joueurs min et tous prêts

    if (canStart && this.engine.obtenirEtatActuel().status === 'WAITING') {

      this.engine.initPlayers(this.lobbyPlayers);//donne a engine la position des joueurs

      const initialState = this.engine.obtenirEtatActuel();//On récupère le tout premier état du jeu (joueurs à leur spawn)

      //Notifie tous les clients que le jeu commence avec l'etat.
      //les clients peuvent afficher la grille au lieu du lobby
      this.broadcast({
        type: 'GAME_START',
        payload: { initialState }
      });
      console.log('SocketManager: All players ready, GAME_START broadcasted!');

    }
  }




  //Méthode utilitaire pour envoyer un message à un client précis.
  public sendMessage(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }




  //Méthode utilitaire pour diffuser un message à tous les clients simultanément.
  //fonction très utilisé ( a chaque tick minimum )
  public broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }



}
