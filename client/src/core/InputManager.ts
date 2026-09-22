import { eventBus } from './EventBus';

export class InputManager {
    constructor() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    private handleKeyDown(event: KeyboardEvent) {
        let direction = null;
        
        switch (event.key) {
            case 'ArrowUp': direction = 'UP'; break;
            case 'ArrowDown': direction = 'DOWN'; break;
            case 'ArrowLeft': direction = 'LEFT'; break;
            case 'ArrowRight': direction = 'RIGHT'; break;
            case ' ': // Touche Espace pour la bombe
                eventBus.emit('USER_ACTION', { type: 'PLACE_BOMB', payload: {} });
                return;
        }

        if (direction) {
            eventBus.emit('USER_ACTION', { type: 'MOVE', payload: { direction } });
        }
    }
}