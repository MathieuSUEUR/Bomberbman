import floorSrc from '../assets/sprites/floor.png';
import grassSrc from '../assets/sprites/grass.png';
import wallSrc from '../assets/sprites/wall.png';
import playerSrc from '../assets/sprites/sprite-sheet.png';
import { eventBus } from '../core/EventBus';
import type { GameState, PlayerState, CellType } from '@bomberman/shared';

// CellType values (enum from shared)
const CELL_EMPTY = 0;          // CellType.EMPTY
const CELL_INDESTRUCTIBLE = 1; // CellType.INDESTRUCTIBLE_WALL
const CELL_DESTRUCTIBLE = 2;   // CellType.DESTRUCTIBLE_WALL

/**
 * Format du GameState mock local (mode solo/entraînement).
 * Les joueurs sont une liste simple avec x, y flottants.
 */
export interface MockGameState {
  grid: number[][];
  players: { id: string; x: number; y: number; direction?: string }[];
}

/**
 * Rendu du canvas à partir d'un GameState — supporte les deux formats :
 * - GameState réel du serveur (shared/types/game.ts)
 * - MockGameState local pour le mode entraînement
 */
export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private tileSize = 50;
  private floorImg: HTMLImageElement;
  private grassImg: HTMLImageElement;
  private wallImg: HTMLImageElement;
  private playerImg: HTMLImageElement;

  /** ID du joueur local (reçu via WELCOME du serveur) pour le mettre en avant */
  private localPlayerId: string | null = null;

  /** Mémorise la dernière direction connue de chaque joueur pour l'orientation du sprite */
  private playerDirections: Map<string, string> = new Map();
  /** Mémorise la dernière position connue de chaque joueur pour déduire la direction */
  private lastPlayerPositions: Map<string, { x: number; y: number }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.floorImg = new Image();
    this.floorImg.src = floorSrc;

    this.grassImg = new Image();
    this.grassImg.src = grassSrc;

    this.wallImg = new Image();
    this.wallImg.src = wallSrc;

    this.playerImg = new Image();
    this.playerImg.src = playerSrc;

    // Mémoriser l'ID local du joueur pour le rendu
    eventBus.on('WELCOME', (payload: unknown) => {
      const data = payload as { playerId: string };
      if (data?.playerId) this.localPlayerId = data.playerId;
    });

    eventBus.on('PLAYER_ID_ASSIGNED', (payload: unknown) => {
      const data = payload as { playerId: string };
      if (data?.playerId) this.localPlayerId = data.playerId;
    });

    eventBus.on('GAME_STATE_UPDATE', (state: unknown) => {
      this.renderAnyState(state);
    });
  }

  /**
   * Détecte si l'état est un vrai GameState serveur (joueurs en Record)
   * ou un MockGameState (joueurs en tableau).
   */
  private renderAnyState(state: unknown): void {
    if (!state || typeof state !== 'object') return;
    const s = state as Record<string, unknown>;

    if (!s.grid) return;

    if (Array.isArray(s.players)) {
      // Mode mock : format tableau
      this.renderMockState(state as MockGameState);
    } else if (typeof s.players === 'object' && s.players !== null) {
      // Mode serveur : format Record<string, PlayerState>
      this.renderServerState(state as GameState);
    }
  }

  // ───────────────────────────── MODE SERVEUR ─────────────────────────────

  private renderServerState(state: GameState): void {
    // Adapter la taille du canvas à la grille reçue si nécessaire
    const gridH = state.grid.length;
    const gridW = gridH > 0 ? state.grid[0].length : 0;
    if (this.ctx.canvas.width !== gridW * this.tileSize) {
      this.ctx.canvas.width = gridW * this.tileSize;
    }
    if (this.ctx.canvas.height !== gridH * this.tileSize) {
      this.ctx.canvas.height = gridH * this.tileSize;
    }

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // 1. Grille
    this.drawGrid(state.grid as number[][]);

    // 2. Power-ups
    if (state.powerUps) {
      this.drawPowerUps(state.powerUps);
    }

    // 3. Explosions
    if (state.explosions) {
      this.drawExplosions(state);
    }

    // 4. Bombes
    if (state.bombs) {
      this.drawBombs(state);
    }

    // 5. Joueurs
    const players = Object.values(state.players) as PlayerState[];
    for (const player of players) {
      if (!player.isAlive) continue;
      this.drawServerPlayer(player);
    }
  }

  private drawPowerUps(powerUps: NonNullable<GameState['powerUps']>): void {
    const ctx = this.ctx;
    const ts = this.tileSize;

    const powerUpIcons: Record<string, string> = {
      EXTRA_BOMB: '💣',
      EXTRA_RANGE: '🔥',
      SPEED_UP: '⚡',
      REDUCED_BOMB_DELAY: '⏳',
      EXTRA_LIFE: '❤️',
    };

    for (const pu of powerUps) {
      const px = pu.position.x * ts;
      const py = pu.position.y * ts;

      ctx.save();
      // Fond circulaire coloré pour rendre le bonus visible
      ctx.beginPath();
      ctx.arc(px + ts / 2, py + ts / 2, ts * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd700';
      ctx.stroke();

      // Icône du power-up
      const icon = powerUpIcons[pu.type] || '✨';
      ctx.font = `${ts * 0.45}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, px + ts / 2, py + ts / 2);
      ctx.restore();
    }
  }

  private drawGrid(grid: number[][]): void {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const px = x * this.tileSize;
        const py = y * this.tileSize;
        const cell = grid[y][x] as unknown as CellType;

        // Sol partout
        this.ctx.drawImage(this.floorImg, px, py, this.tileSize, this.tileSize);

        if (cell === CELL_INDESTRUCTIBLE) {
          this.ctx.drawImage(this.grassImg, px, py, this.tileSize, this.tileSize);
        } else if (cell === CELL_DESTRUCTIBLE) {
          this.ctx.drawImage(this.wallImg, px, py, this.tileSize, this.tileSize);
        } else if (cell === CELL_EMPTY) {
          // Juste le sol, déjà dessiné
        }
      }
    }
  }

  private drawBombs(state: GameState): void {
    const ctx = this.ctx;
    const ts = this.tileSize;

    for (const bomb of state.bombs) {
      const px = bomb.position.x * ts + ts / 2;
      const py = bomb.position.y * ts + ts / 2;
      const radius = ts * 0.35;

      // Cercle noir de la bombe
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Mèche animée (scintillement orange/rouge)
      const blink = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px + radius * 0.5, py - radius);
      ctx.lineTo(px + radius * 0.8, py - radius * 1.5);
      ctx.strokeStyle = blink ? '#ff6600' : '#ffcc00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Emoji 💣 en fallback lisible
      ctx.save();
      ctx.font = `${ts * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', px, py);
      ctx.restore();
    }
  }

  private drawExplosions(state: GameState): void {
    const ctx = this.ctx;
    const ts = this.tileSize;

    for (const exp of state.explosions) {
      const px = exp.position.x * ts;
      const py = exp.position.y * ts;

      ctx.save();
      // Fond orange vif semi-transparent
      ctx.fillStyle = 'rgba(255, 120, 0, 0.85)';
      ctx.fillRect(px, py, ts, ts);

      // Lueur intérieure
      const gradient = ctx.createRadialGradient(
        px + ts / 2, py + ts / 2, 2,
        px + ts / 2, py + ts / 2, ts / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
      gradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px, py, ts, ts);
      ctx.restore();
    }
  }

  private drawServerPlayer(player: PlayerState): void {
    const ctx = this.ctx;
    const ts = this.tileSize;

    const spriteW = 16;
    const spriteH = 32;
    const padding = 1;

    const currentFrame = Math.floor(Date.now() / 150) % 3;

    const px = player.position.x * ts;
    const py = player.position.y * ts;

    const drawWidth = ts;
    const ratio = spriteH / spriteW;
    const drawHeight = drawWidth * ratio;
    const offsetY = ts - drawHeight;

    // Déduire la direction du joueur à partir du delta de déplacement
    const lastPos = this.lastPlayerPositions.get(player.id);
    let dir = this.playerDirections.get(player.id) || 'DOWN';

    if (lastPos) {
      if (player.position.x > lastPos.x) dir = 'RIGHT';
      else if (player.position.x < lastPos.x) dir = 'LEFT';
      else if (player.position.y > lastPos.y) dir = 'DOWN';
      else if (player.position.y < lastPos.y) dir = 'UP';
    }

    this.lastPlayerPositions.set(player.id, { x: player.position.x, y: player.position.y });
    this.playerDirections.set(player.id, dir);

    const animMap: Record<string, { row: number; colOffset: number }> = {
      UP: { row: 0, colOffset: 0 },
      LEFT: { row: 0, colOffset: 3 },
      DOWN: { row: 0, colOffset: 6 },
      RIGHT: { row: 0, colOffset: 9 },
    };

    const anim = animMap[dir] || animMap['DOWN'];
    const currentSpriteIndex = anim.colOffset + currentFrame;
    const sourceX = currentSpriteIndex * (spriteW + padding);
    const sourceY = anim.row * (spriteH + padding);

    ctx.drawImage(
      this.playerImg,
      sourceX, sourceY, spriteW, spriteH,
      px, py + offsetY, drawWidth, drawHeight
    );

    // Indicateur local player (surbrillance)
    if (player.id === this.localPlayerId) {
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, py + offsetY + 1, drawWidth - 2, drawHeight - 2);
      ctx.restore();
    }

    // Nom du joueur au-dessus
    ctx.save();
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = player.id === this.localPlayerId ? '#FFD700' : '#ffffff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(player.name, px + ts / 2, py + offsetY - 2);
    ctx.restore();
  }

  // ───────────────────────────── MODE MOCK ─────────────────────────────

  private renderMockState(state: MockGameState): void {
    const gridH = state.grid.length;
    const gridW = gridH > 0 ? state.grid[0].length : 0;
    if (this.ctx.canvas.width !== gridW * this.tileSize) {
      this.ctx.canvas.width = gridW * this.tileSize;
    }
    if (this.ctx.canvas.height !== gridH * this.tileSize) {
      this.ctx.canvas.height = gridH * this.tileSize;
    }

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // 1. Grille mock (0 = sol, 1 = mur)
    for (let y = 0; y < state.grid.length; y++) {
      for (let x = 0; x < state.grid[y].length; x++) {
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        this.ctx.drawImage(this.floorImg, px, py, this.tileSize, this.tileSize);
        if (state.grid[y][x] === 1) {
          this.ctx.drawImage(this.grassImg, px, py, this.tileSize, this.tileSize);
        } else if (state.grid[y][x] === 2) {
          this.ctx.drawImage(this.wallImg, px, py, this.tileSize, this.tileSize);
        }
      }
    }

    // 2. Joueurs mock
    if (state.players) {
      const spriteW = 16;
      const spriteH = 32;
      const padding = 1;
      const currentFrame = Math.floor(Date.now() / 150) % 3;

      for (const player of state.players) {
        const px = player.x * this.tileSize;
        const py = player.y * this.tileSize;

        const drawWidth = this.tileSize;
        const ratio = spriteH / spriteW;
        const drawHeight = drawWidth * ratio;
        const offsetY = this.tileSize - drawHeight;

        const direction = player.direction || 'DOWN';

        const animMap: Record<string, { row: number; colOffset: number }> = {
          UP: { row: 0, colOffset: 0 },
          LEFT: { row: 0, colOffset: 3 },
          DOWN: { row: 0, colOffset: 6 },
          RIGHT: { row: 0, colOffset: 9 },
        };

        const anim = animMap[direction] || animMap['DOWN'];
        const currentSpriteIndex = anim.colOffset + currentFrame;
        const sourceX = currentSpriteIndex * (spriteW + padding);
        const sourceY = anim.row * (spriteH + padding);

        this.ctx.drawImage(
          this.playerImg,
          sourceX, sourceY, spriteW, spriteH,
          px, py + offsetY, drawWidth, drawHeight
        );
      }
    }
  }
}