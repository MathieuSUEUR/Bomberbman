export class EventBus {
    private listeners: { [event: string]: Function[] } = {};

    // Pour écouter un événement (ex: la vue écoute "GAME_STATE_UPDATE")
    on(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Pour envoyer un événement (ex: le réseau dit "GAME_STATE_UPDATE")
    emit(event: string, data?: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// On exporte une instance unique pour tout le projet
export const eventBus = new EventBus();