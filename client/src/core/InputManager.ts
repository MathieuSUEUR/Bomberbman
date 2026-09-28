import { eventBus } from './EventBus';

export class InputManager {
    constructor() {
        // On écoute la pression ET le relâchement
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    }

    private handleKey(event: KeyboardEvent, isPressed: boolean) {
        let direction = null;
        
        switch (event.key) {
            case 'ArrowUp': direction = 'UP'; break;
            case 'ArrowDown': direction = 'DOWN'; break;
            case 'ArrowLeft': direction = 'LEFT'; break;
            case 'ArrowRight': direction = 'RIGHT'; break;
            case ' ':
                // On ne pose la bombe qu'à l'appui, pas au relâchement
                if (isPressed) {
                    eventBus.emit('USER_ACTION', { type: 'PLACE_BOMB', payload: {} });
                }
                return;
        }

        if (direction) {
            // On prévient si on COMMENCE ou on ARRÊTE de bouger
            eventBus.emit('USER_ACTION', { 
                type: isPressed ? 'MOVE_START' : 'MOVE_END', 
                payload: { direction } 
            });
        }
    }
}