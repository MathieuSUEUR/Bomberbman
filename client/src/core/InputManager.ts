import { eventBus } from './EventBus';

export class InputManager {
  constructor() {
    // On écoute la pression ET le relâchement
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));
  }

  private handleKey(event: KeyboardEvent, isPressed: boolean) {
    // Ignorer les frappes de clavier si l'utilisateur saisit son pseudo dans un champ texte
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    let direction = null;

    switch (event.key) {
      case 'ArrowUp':
      case 'KeyW':
      case 'z':
      case 'Z':
      case 'w':
      case 'W':
        direction = 'UP';
        break;
      case 'ArrowDown':
      case 'KeyS':
      case 's':
      case 'S':
        direction = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'KeyA':
      case 'q':
      case 'Q':
      case 'a':
      case 'A':
        direction = 'LEFT';
        break;
      case 'ArrowRight':
      case 'KeyD':
      case 'd':
      case 'D':
        direction = 'RIGHT';
        break;
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
        payload: { direction },
      });
    }
  }
}
