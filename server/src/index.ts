import { GameEngine } from './engine/GameEngine.js';
import { DEFAULT_GAME_CONFIG } from '@bomberman/shared';
import { SocketManager } from './network/SocketManager.js';

// Port d'écoute : variable d'environnement PORT (Docker), 3000 par défaut (port attendu par le client)
const PORT = Number(process.env.PORT) || 3000;

const engine = new GameEngine();
const socketManager = new SocketManager(PORT, engine);

/**
 * Arrêt propre du serveur (docker stop / Ctrl+C).
 * Dans un conteneur, node est le PID 1 et ignore SIGTERM s'il n'est pas géré explicitement.
 */
async function shutdown(signal: NodeJS.Signals) {
  console.info(`Signal ${signal} reçu, arrêt du serveur...`);
  await socketManager.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

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
        console.warn(`Tick trop lent: ${deltaTime.toFixed(2)}ms`);
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


