import floorSrc from '../assets/sprites/floor.png';
import grassSrc from '../assets/sprites/grass.png';
// ON IMPORTE LA NOUVELLE SPRITESHEET ICI :
import playerSrc from '../assets/sprites/sprite-sheet.png';
import helpySrc from '../assets/sprites/sprite-sheet_helpy.png';
import { eventBus } from '../core/EventBus';

export interface GameState {
  grid: number[][];
  // On ajoute la direction pour satisfaire TypeScript
  players: { id: string; x: number; y: number; direction?: string }[];
}

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private tileSize = 50;
  private floorImg: HTMLImageElement;
  private grassImg: HTMLImageElement;
  private playerImg: HTMLImageElement;
  private readonly useHelpy: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.floorImg = new Image();
    this.floorImg.src = floorSrc;

    this.grassImg = new Image();
    this.grassImg.src = grassSrc;

    // 1 chance sur 10 de jouer Helpy pour toute cette session.
    // Le tirage est fait une seule fois au lancement du renderer.
    this.useHelpy = Math.random() < 0.1;

    this.playerImg = new Image();
    this.playerImg.src = this.useHelpy ? helpySrc : playerSrc;

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

        // Les deux spritesheets contiennent 3 frames par direction,
        // mais elles ne sont pas rangées de la même façon.
        const bombermanAnimMap: Record<string, number> = {
          UP: 0,
          LEFT: 3,
          DOWN: 6,
          RIGHT: 9,
        };

        const helpyAnimMap: Record<string, number> = {
            'DOWN': 0,
            'UP': 3,
            'LEFT': 6,
            'RIGHT': 9
        };

        const animMap = this.useHelpy ? helpyAnimMap : bombermanAnimMap;
        const firstFrame = animMap[direction] ?? animMap['DOWN'];
        const currentSpriteIndex = firstFrame + currentFrame;

        let sourceX: number;
        let sourceY: number;

        if (this.useHelpy) {
          // Helpy : grille compacte 4 colonnes x 3 lignes, sans padding.
          sourceX = (currentSpriteIndex % 4) * spriteW;
          sourceY = Math.floor(currentSpriteIndex / 4) * spriteH;
        } else {
          // Bomberman : les 12 frames utilisées sont sur la première ligne,
          // séparées par un pixel de padding.
          const padding = 1;
          sourceX = currentSpriteIndex * (spriteW + padding);
          sourceY = 0;
        }

        this.ctx.drawImage(
          this.playerImg,
          sourceX,
          sourceY,
          spriteW,
          spriteH,
          pixelX,
          pixelY + offsetY,
          drawWidth,
          drawHeight,
        );
      }
    }
  }
}
