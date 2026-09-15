import { GameManager } from './game/GameManager.js';
import { WebSocketManager } from './network/WebSocketManager.js';

const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

//Initialisation du coeur du jeu
const gameManager = new GameManager();


//init websocket
const wsManager = new WebSocketManager(gameManager, port);

//temportaire, a gerer apres dans Engine si pas fait
setInterval(() => {

    const actions = gameManager.consumeActions();

    if (actions.length > 0) {
        console.log(`[Engine Simulation] Traitement de ${actions.length} actions.`);
    }

    //Si partie en cours ou qu'il y a des joueurs,broadcast de l'état du jeu
    if (gameManager.getPlayersCount() > 0) {
        wsManager.broadcastGameState({
            timestamp: Date.now(),
            message: "Simulation de l'état du jeu..."
        });
    }

}, 1000); // Ex: boucle à 1 FPS pour l'instant

