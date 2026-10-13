import { eventBus } from '../core/EventBus';
import type { ServerMessage, ActionType } from '@bomberman/shared';

/**
 * Gère la connexion WebSocket avec le serveur de jeu.
 * Traduit les événements internes (eventBus) en messages réseau,
 * et les messages réseau en événements internes.
 */
export class SocketManager {
  private socket: WebSocket;

  /** ID unique du joueur attribué par le serveur lors du WELCOME */
  private playerId: string | null = null;

  /** Directions actuellement enfoncées pour l'envoi continu d'actions */
  private activeDirections = new Set<string>();

  /** Intervalle d'envoi des actions de déplacement au serveur */
  private moveInterval: ReturnType<typeof setInterval> | null = null;

  /** Indique si la partie est en cours (pour filtrer les actions) */
  private isGameActive = false;

  constructor(url: string) {
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.info('✅ Connecté au serveur WebSocket !');
      eventBus.emit('SERVER_STATUS', { connected: true });
    };

    this.socket.onerror = () => {
      console.warn('⚠️ Le serveur backend est indisponible ou éteint.');
      eventBus.emit('SERVER_STATUS', { connected: false });
    };

    this.socket.onclose = () => {
      console.info('🔌 Connexion WebSocket fermée.');
      eventBus.emit('SERVER_STATUS', { connected: false });
      this.stopMoveLoop();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.handleServerMessage(message);
      } catch (err) {
        console.warn('Erreur de parsing du message WebSocket :', err);
      }
    };

    this.setupEventListeners();
  }

  /**
   * Traite les messages reçus du serveur et les redistribue via l'eventBus.
   */
  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'WELCOME':
        this.playerId = message.payload.playerId;
        console.info('🎮 Identifié par le serveur avec l\'ID :', this.playerId);
        eventBus.emit('PLAYER_ID_ASSIGNED', { playerId: this.playerId });
        break;

      case 'LOBBY_STATE':
        eventBus.emit('LOBBY_STATE', message.payload);
        break;

      case 'GAME_START':
        this.isGameActive = true;
        this.startMoveLoop();
        eventBus.emit('GAME_START', message.payload);
        break;

      case 'GAME_STATE':
        eventBus.emit('GAME_STATE_UPDATE', message.payload);
        break;

      case 'BOMB_EXPLODED':
        eventBus.emit('BOMB_EXPLODED', message.payload);
        break;

      case 'PLAYER_ELIMINATED':
        eventBus.emit('PLAYER_ELIMINATED', message.payload);
        break;

      case 'GAME_OVER':
        this.isGameActive = false;
        this.stopMoveLoop();
        eventBus.emit('GAME_OVER', message.payload);
        break;

      case 'ERROR':
        console.warn('⚠️ Erreur serveur :', message.payload.message);
        eventBus.emit('SERVER_ERROR', message.payload);
        break;

      case 'PONG':
        // Latence reçue, rien à faire ici
        break;
    }
  }

  /**
   * Configure les écouteurs d'événements internes à transmettre au serveur.
   */
  private setupEventListeners(): void {
    // Rejoindre le lobby
    eventBus.on('JOIN_LOBBY', (payload: unknown) => {
      const data = payload as { name: string };
      this.sendToServer({ type: 'JOIN', payload: { name: data.name } });
    });

    // Mettre à jour le statut prêt
    eventBus.on('SET_READY', (payload: unknown) => {
      const data = payload as { isReady: boolean };
      this.sendToServer({ type: 'READY', payload: { isReady: data.isReady } });
    });

    // Écoute des touches directionnelles
    eventBus.on('USER_ACTION', (action: unknown) => {
      const kbAction = action as { type: string; payload: { direction?: string } };

      if (kbAction.type === 'MOVE_START' && kbAction.payload.direction) {
        this.activeDirections.add(kbAction.payload.direction);
      } else if (kbAction.type === 'MOVE_END' && kbAction.payload.direction) {
        this.activeDirections.delete(kbAction.payload.direction);
      } else if (kbAction.type === 'PLACE_BOMB') {
        // Pose de bombe : action immédiate
        this.sendAction('PLACE_BOMB');
      }
    });
  }

  /**
   * Démarre la boucle d'envoi des déplacements au serveur (calée sur le tick rate du serveur).
   * Le serveur tourne à 20 ticks/s → on envoie toutes les 50ms.
   */
  private startMoveLoop(): void {
    if (this.moveInterval) return;
    this.moveInterval = setInterval(() => {
      if (!this.isGameActive) return;

      // Priorité : UP > DOWN > LEFT > RIGHT (une seule direction par tick)
      if (this.activeDirections.has('UP')) {
        this.sendAction('MOVE_UP');
      } else if (this.activeDirections.has('DOWN')) {
        this.sendAction('MOVE_DOWN');
      } else if (this.activeDirections.has('LEFT')) {
        this.sendAction('MOVE_LEFT');
      } else if (this.activeDirections.has('RIGHT')) {
        this.sendAction('MOVE_RIGHT');
      }
    }, 50); // 20 fois par seconde = 50ms
  }

  /**
   * Arrête la boucle d'envoi des déplacements.
   */
  private stopMoveLoop(): void {
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
    this.activeDirections.clear();
  }

  /**
   * Envoie une action de jeu au serveur (déplacement, pose de bombe).
   */
  private sendAction(actionType: ActionType): void {
    this.sendToServer({ type: 'ACTION', payload: { actionType } });
  }

  /**
   * Envoie un message au serveur si la connexion est ouverte.
   */
  private sendToServer(message: object): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public isConnected(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
