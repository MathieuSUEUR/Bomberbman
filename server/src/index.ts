import { GameEngine } from './engine/GameEngine.js';
import { DEFAULT_GAME_CONFIG } from '@bomberman/shared';
import { generateGrid, debugMap } from './map/MapGenerator.js';

const engine = new GameEngine();

// 20 ticks par seconde (1000ms / 20 = 50ms)
const TICK_INTERVAL_MS = 1000 / DEFAULT_GAME_CONFIG.tickRate;

let LastTickTime = performance.now();

/**
 * Boucle de jeux principale
 */
async function gameLoop(){
  const now = performance.now();
  const deltaTime = now - LastTickTime;

  if(deltaTime >= TICK_INTERVAL_MS){
    try{
      // on traite un tick du moteur de jeu
      engine.tick();

      // si le tick est trop lent on le log
      if(deltaTime > TICK_INTERVAL_MS * 2){

        // on récupère l'état actuel du jeu
        const state = engine.obtenirEtatActuel();
        console.warn(`Tick ${state.tick} - Status: ${state.status} - Tick trop lent: ${deltaTime.toFixed(2)}ms`);
      }

      LastTickTime = now - (deltaTime % TICK_INTERVAL_MS); // on applique on la compensation du deltaTime pour éviter les dérives de tick
    } catch (error) {
      console.error(" Erreur lors du tick du moteur de jeu: ", error);
    }
  }
  
  setTimeout(gameLoop, 0); // on relance la boucle de jeu immédiatement

}

// lancer la boucle de jeu
gameLoop();


