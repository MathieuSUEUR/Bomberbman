import './style.css';
import { GameRenderer } from './view/GameRenderer';
import { eventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { SocketManager } from './network/SocketManager';

// 1. Initialisation de l'affichage
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
canvas.width = 500;
canvas.height = 500;
new GameRenderer(canvas);

// 2. Initialisation du clavier et du réseau
new InputManager();
new SocketManager('ws://localhost:3000'); // Port 3000 par défaut

// 3. Récupération des éléments HTML du menu
const lobbyScreen = document.getElementById('lobby-screen')!;
const gameCanvas = document.getElementById('game-canvas')!;
const btnStartMock = document.getElementById('btn-start-mock')!;

// 4. L'état global du faux serveur (Mock)
const mockGameState = {
    grid: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
    ],
    players: [
        { id: 'p1', x: 1, y: 1 } // Bomberman commence en x:1, y:1
    ]
};

// 5. Événement du bouton pour lancer le test
btnStartMock.addEventListener('click', () => {
    lobbyScreen.style.display = 'none';
    gameCanvas.style.display = 'block';
    
    // On envoie le premier affichage
    eventBus.emit('GAME_STATE_UPDATE', mockGameState); 
});

// 6. Faux serveur : On écoute le clavier pour bouger le joueur
eventBus.on('USER_ACTION', (action: unknown) => {
    const keyboardAction = action as { type: string, payload: { direction: string } };
    if (keyboardAction.type === 'MOVE') {
        // ... reste du code : if (keyboardAction.payload.direction === 'UP') etc.
        const player = mockGameState.players[0]; // On prend notre joueur
        let newX = player.x;
        let newY = player.y;

        // Calcul de la nouvelle position souhaitée
        if (keyboardAction.payload.direction === 'UP') newY -= 1;
        if (keyboardAction.payload.direction === 'DOWN') newY += 1;
        if (keyboardAction.payload.direction === 'LEFT') newX -= 1;
        if (keyboardAction.payload.direction === 'RIGHT') newX += 1;

        // Logique anti-triche : on vérifie si la case est libre (0)
        if (mockGameState.grid[newY] && mockGameState.grid[newY][newX] === 0) {
            // La voie est libre, on met à jour
            player.x = newX;
            player.y = newY;
            
            // On ordonne de redessiner l'écran
            eventBus.emit('GAME_STATE_UPDATE', mockGameState);
        }
    }
});