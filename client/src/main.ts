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
    { id: 'p1', x: 1, y: 1, direction: 'DOWN' }
]
};

// 5. Événement du bouton pour lancer le test
btnStartMock.addEventListener('click', () => {
    lobbyScreen.style.display = 'none';
    gameCanvas.style.display = 'block';
    
    // On envoie le premier affichage
    eventBus.emit('GAME_STATE_UPDATE', mockGameState); 
});

// 6. Faux Serveur : Gestion continue des déplacements
const activeDirections = new Set<string>(); // Mémorise les touches enfoncées

eventBus.on('USER_ACTION', (action: unknown) => {
    const kbAction = action as { type: string, payload: { direction: string } };
    
    // On ajoute ou on retire la direction de la liste
    if (kbAction.type === 'MOVE_START') activeDirections.add(kbAction.payload.direction);
    if (kbAction.type === 'MOVE_END') activeDirections.delete(kbAction.payload.direction);
});

// 7. LA BOUCLE DE JEU (Game Loop - 60 FPS)
setInterval(() => {
    // S'il n'y a pas de mouvement, on ne fait rien pour économiser les ressources
    if (activeDirections.size === 0) return;

    const player = mockGameState.players[0];
    const speed = 0.08; // Vitesse fluide (en fraction de case par frame)

    let newX = player.x;
    let newY = player.y;

    // ...
    if (activeDirections.has('UP')) { newY -= speed; player.direction = 'UP'; }
    if (activeDirections.has('DOWN')) { newY += speed; player.direction = 'DOWN'; }
    if (activeDirections.has('LEFT')) { newX -= speed; player.direction = 'LEFT'; }
    if (activeDirections.has('RIGHT')) { newX += speed; player.direction = 'RIGHT'; }
    // ...

    // Logique anti-triche : Collision basique (Hitbox au centre du personnage)
    // NB: L'équipe Backend fera une collision beaucoup plus précise.
    const gridX = Math.round(newX);
    const gridY = Math.round(newY);

    if (mockGameState.grid[gridY] && mockGameState.grid[gridY][gridX] === 0) {
        player.x = newX;
        player.y = newY;
        
        // On ordonne un rafraîchissement visuel à chaque frame de mouvement
        eventBus.emit('GAME_STATE_UPDATE', mockGameState);
    }
}, 1000 / 60); // Exécution environ 60 fois par seconde