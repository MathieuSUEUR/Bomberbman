import { eventBus } from '../core/EventBus';

export class SocketManager {
    private socket: WebSocket;

    constructor(url: string) {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => console.info('✅ Connecté au serveur WebSocket !');
        this.socket.onerror = () => console.warn('⚠️ Le serveur backend est éteint.');

        eventBus.on('USER_ACTION', (message: unknown) => {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(message));
                console.info('📡 Envoyé au serveur:', message);
            } else {
                console.info('🔒 Impossible d\'envoyer, serveur déconnecté:', message);
            }
        });
    }
}