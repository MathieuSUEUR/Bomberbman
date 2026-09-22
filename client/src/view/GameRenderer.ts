import floorSrc from '../assets/sprites/floor.png'; // Ton ancien wall.png
import grassSrc from '../assets/sprites/grass.png'; // Tes nouveaux obstacles
import playerSrc from '../assets/sprites/bomberman.png';
import { eventBus } from '../core/EventBus';

export interface GameState {
    grid: number[][];
    players: { id: string, x: number, y: number }[];
}

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private tileSize = 50;
    private floorImg: HTMLImageElement;
    private grassImg: HTMLImageElement;
    private playerImg: HTMLImageElement;

    constructor(canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false; // Rendu Pixel Art
        
        this.floorImg = new Image();
        this.floorImg.src = floorSrc;
        
        this.grassImg = new Image();
        this.grassImg.src = grassSrc;

        this.playerImg = new Image();
        this.playerImg.src = playerSrc;

        eventBus.on('GAME_STATE_UPDATE', (state: unknown) => {
            this.renderState(state as GameState);
        });
    }

    private renderState(state: GameState) {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        // 1. Dessiner le décor
        for (let y = 0; y < state.grid.length; y++) {
            for (let x = 0; x < state.grid[y].length; x++) {
                const pixelX = x * this.tileSize;
                const pixelY = y * this.tileSize;

                // Le sol (floor) est dessiné partout en fond
                this.ctx.drawImage(this.floorImg, pixelX, pixelY, this.tileSize, this.tileSize);

                // Si c'est un obstacle (valeur 1 dans la grille), on dessine l'herbe par-dessus
                if (state.grid[y][x] === 1) {
                    this.ctx.drawImage(this.grassImg, pixelX, pixelY, this.tileSize, this.tileSize);
                }
            }
        }

        // 2. Dessiner les joueurs avec l'effet de profondeur
        if (state.players) {
            for (const player of state.players) {
                const pixelX = player.x * this.tileSize;
                const pixelY = player.y * this.tileSize;

                const drawWidth = this.tileSize;
                const ratio = this.playerImg.height / this.playerImg.width;
                const drawHeight = drawWidth * ratio;
                const offsetY = this.tileSize - drawHeight;

                this.ctx.drawImage(
                    this.playerImg, 
                    pixelX, 
                    pixelY + offsetY, 
                    drawWidth, 
                    drawHeight
                );
            }
        }
    }
}