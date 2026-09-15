import { GameEngine } from './Engine/GameEngine.js';
import { DEFAULT_GAME_CONFIG } from '@bomberman/shared';

const engine = new GameEngine();

// 20 ticks par seconde (1000ms / 20 = 50ms)
const TICK_INTERVAL_MS = 1000 / DEFAULT_GAME_CONFIG.tickRate;

setInterval(() => {
  try {
    engine.tick();
    const etat = engine.obtenirEtatActuel();
    console.log(`Tick ${etat.tick} - Status: ${etat.status}`);
  } catch (error) {
    console.error(error);
  }
}, TICK_INTERVAL_MS);
