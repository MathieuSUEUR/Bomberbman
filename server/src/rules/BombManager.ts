import { BombState, ExplosionCell, PlayerState, CellType } from '@bomberman/shared';
import { Map as GameMap } from '../map/Map.js';

export class BombManager {
    private bombs: BombState[];
    private explosions: ExplosionCell[];
    private bombCountdownTicks: number;
    private explosionDurationTicks: number;

    constructor(bombCountdownTicks: number, explosionDurationTicks: number) {
        this.bombs = [];
        this.explosions = [];
        this.bombCountdownTicks = bombCountdownTicks;
        this.explosionDurationTicks = explosionDurationTicks;
    }

    public placerBombe(playerId: string, x: number, y: number, range: number, currentTick: number): void {
        const dejaUneBombe = this.bombs.some(
            b => b.position.x === x && b.position.y === y
        );
        if (dejaUneBombe) return;

        const bomb: BombState = {
            id: `${playerId}-${currentTick}`,
            ownerId: playerId,
            position: { x, y },
            range,
            placedAtTick: currentTick,
            explodeAtTick: currentTick + this.bombCountdownTicks,
        };
        this.bombs.push(bomb);
    }

    public tick(currentTick: number, map: GameMap, players: Map<string, PlayerState>): void {
        this.explosions = this.explosions.filter(e => e.expiresAtTick > currentTick);

        const bombsAExploser = this.bombs.filter(b => currentTick >= b.explodeAtTick);
        this.bombs = this.bombs.filter(b => currentTick < b.explodeAtTick);

        for (const bomb of bombsAExploser) {
            this.exploser(bomb, currentTick, map, players);
        }
    }

    private exploser(bomb: BombState, currentTick: number, map: GameMap, players: Map<string, PlayerState>): void {
        const cellsExplosion = [bomb.position];

        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ];

        for (const dir of directions) {
            for (let dist = 1; dist <= bomb.range; dist++) {
                const nx = bomb.position.x + dir.x * dist;
                const ny = bomb.position.y + dir.y * dist;
                const cell = map.get(nx, ny);

                if (cell === undefined || cell === CellType.INDESTRUCTIBLE_WALL) {
                    break;
                }

                cellsExplosion.push({ x: nx, y: ny });

                if (cell === CellType.DESTRUCTIBLE_WALL) {
                    map.setCell(nx, ny, CellType.EMPTY);
                    break;
                }
            }
        }

        const expiresAtTick = currentTick + this.explosionDurationTicks;
        for (const pos of cellsExplosion) {
            this.explosions.push({ position: pos, expiresAtTick });

            for (const [, player] of players) {
                if (player.isAlive && player.position.x === pos.x && player.position.y === pos.y) {
                    player.isAlive = false;
                }
            }
        }
    }

    public getBombs(): BombState[] {
        return this.bombs;
    }

    public getExplosions(): ExplosionCell[] {
        return this.explosions;
    }
}