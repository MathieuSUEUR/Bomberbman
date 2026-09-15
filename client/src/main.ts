import './style.css'; // Garde l'import CSS si tu en as un
import { GameRenderer } from './view/GameRenderer';
import { eventBus } from './core/EventBus';

// 1. On récupère notre Canvas dans le HTML
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// On lui donne une taille
canvas.width = 500;
canvas.height = 500;

// 2. On initialise notre vue
const renderer = new GameRenderer(canvas);

// 3. MOCKING : On simule des données que le serveur pourrait nous envoyer
const mockGrid = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
];

// On déclenche l'événement !
eventBus.emit('RENDER_MOCK_GRID', mockGrid);