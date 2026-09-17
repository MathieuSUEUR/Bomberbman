import { GameEngine } from './engine/GameEngine.js';
import { DEFAULT_GAME_CONFIG } from '@bomberman/shared';
import { generateGrid, debugMap } from './map/MapGenerator.js';
import { SocketManager } from './network/SocketManager.js';

const engine = new GameEngine();
const socketManager = new SocketManager(8080, engine);

// 20 ticks par seconde (1000ms / 20 = 50ms)
const TICK_INTERVAL_MS = 1000 / DEFAULT_GAME_CONFIG.tickRate;

generateGrid();

setInterval(() => {
  try {
    engine.tick();
    const etat = engine.obtenirEtatActuel();

    //Broadcast de l'état du jeu si on est en train de jouer ou terminé
    if (etat.status !== 'WAITING') {
      socketManager.broadcast({ type: 'GAME_STATE', payload: etat });
    }

    if (etat.tick % 100 === 0) {
      console.log(`Tick ${etat.tick} - Status: ${etat.status}`);
    }
  } catch (error) {
    console.error(error);
  }
}, TICK_INTERVAL_MS);
