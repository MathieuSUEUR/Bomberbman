import { eventBus } from '../core/EventBus';

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private tileSize = 50; // Taille d'une case en pixels

    constructor(canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d')!;
        
        // La vue écoute le bus d'événements, elle ne parle pas au réseau !
        eventBus.on('RENDER_MOCK_GRID', (grid: number[][]) => {
            this.drawGrid(grid);
        });
    }

    private drawGrid(grid: number[][]) {
        // Nettoyer l'écran
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        // Dessiner la grille
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if (grid[y][x] === 1) {
                    this.ctx.fillStyle = 'gray'; // Mur
                } else {
                    this.ctx.fillStyle = 'lightgreen'; // Herbe/Vide
                }
                this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
            }
        }
    }
}