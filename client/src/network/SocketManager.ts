import { eventBus } from '../core/EventBus';

export class SocketManager {
    private socket: WebSocket;

    constructor(url: string) {
        // Se connecte au serveur (ici une adresse locale par défaut)
        this.socket = new WebSocket(url);

        this.socket.onopen = () => console.log('✅ Connecté au serveur WebSocket !');
        this.socket.onerror = () => console.warn('⚠️ Le serveur backend est éteint (Normal si tes collègues ne l\'ont pas lancé).');

        // Le réseau écoute le Bus, respectant la séparation stricte !
        eventBus.on('USER_ACTION', (message: any) => {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(message));
                console.log('📡 Envoyé au serveur:', message);
            } else {
                console.log('🔒 Impossible d\'envoyer, serveur déconnecté:', message);
            }
        });
    }
}