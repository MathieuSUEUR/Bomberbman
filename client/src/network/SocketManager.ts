import { eventBus } from '../core/EventBus';

export class SocketManager {
  private socket: WebSocket;

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
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'LOBBY_STATE') {
          eventBus.emit('LOBBY_STATE', message.payload);
        } else if (message.type === 'GAME_START') {
          eventBus.emit('GAME_START', message.payload);
        } else if (message.type === 'GAME_STATE') {
          eventBus.emit('GAME_STATE_UPDATE', message.payload);
        }
      } catch (err) {
        console.warn('Erreur de parsing du message WebSocket :', err);
      }
    };

    eventBus.on('USER_ACTION', (message: unknown) => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
        console.info('📡 Envoyé au serveur:', message);
      } else {
        console.info("🔒 Impossible d'envoyer, serveur déconnecté:", message);
      }
    });

    eventBus.on('JOIN_LOBBY', (payload: unknown) => {
      const data = payload as { name: string };
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'JOIN', payload: { name: data.name } }));
      }
    });

    eventBus.on('SET_READY', (payload: unknown) => {
      const data = payload as { isReady: boolean };
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'READY', payload: { isReady: data.isReady } }));
      }
    });
  }

  public isConnected(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }
}
