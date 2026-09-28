import floorSrc from '../assets/sprites/floor.png'; 
import grassSrc from '../assets/sprites/grass.png'; 
// ON IMPORTE LA NOUVELLE SPRITESHEET ICI :
import playerSrc from '../assets/sprites/sprite-sheet.png'; 
import { eventBus } from '../core/EventBus';

export interface GameState {
    grid: number[][];
    // On ajoute la direction pour satisfaire TypeScript
    players: { id: string, x: number, y: number, direction?: string }[];
}
    
export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private tileSize = 50;
    private floorImg: HTMLImageElement;
    private grassImg: HTMLImageElement;
    private playerImg: HTMLImageElement;

    constructor(canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false; 
        
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

                this.ctx.drawImage(this.floorImg, pixelX, pixelY, this.tileSize, this.tileSize);

                if (state.grid[y][x] === 1) {
                    this.ctx.drawImage(this.grassImg, pixelX, pixelY, this.tileSize, this.tileSize);
                }
            }
        }

        // 2. Dessiner les joueurs avec animation et direction
        if (state.players) {
            const spriteW = 16; 
            const spriteH = 32;
            const padding = 1; 
            
            // Si le joueur ne bouge pas, on pourrait bloquer l'animation, 
            // mais on la laisse tourner pour l'instant.
            const currentFrame = Math.floor(Date.now() / 150) % 3;

            for (const player of state.players) {
                const pixelX = player.x * this.tileSize;
                const pixelY = player.y * this.tileSize;

                const drawWidth = this.tileSize;
                const ratio = spriteH / spriteW;
                const drawHeight = drawWidth * ratio;
                const offsetY = this.tileSize - drawHeight;

                const direction = player.direction || 'DOWN';

                // Nouveau mapping : on indique la ligne (row) et la colonne de départ (col)
                const animMap: Record<string, { row: number, colOffset: number }> = {
                    'UP':    { row: 0, colOffset: 0 }, // Sprites 1, 2, 3
                    'LEFT':  { row: 0, colOffset: 3 }, // Sprites 4, 5, 6
                    'DOWN':  { row: 0, colOffset: 6 }, // Sprites 7, 8, 9 (à vérifier sur ton image)
                    'RIGHT': { row: 0, colOffset: 9 }  // Sprites 10, 11, 12 (à vérifier)
                };
                
                const anim = animMap[direction] || animMap['DOWN'];

                // On additionne la colonne de départ et l'animation en cours (0, 1 ou 2)
                const currentSpriteIndex = anim.colOffset + currentFrame;

                // Calcul exact des coordonnées
                const sourceX = currentSpriteIndex * (spriteW + padding);
                const sourceY = anim.row * (spriteH + padding);

                this.ctx.drawImage(
                    this.playerImg,
                    sourceX, sourceY, spriteW, spriteH,
                    pixelX, pixelY + offsetY, drawWidth, drawHeight
                );
            }
        }
    }
}