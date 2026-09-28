import {
    BombState,
    ExplosionCell,
    PlayerState,
    CellType,
    BombExplodedPayload,
    PowerUp,
    PowerUpType,
    DEFAULT_GAME_CONFIG
} from '@bomberman/shared';
import { Map as GameMap } from '../map/Map.js';

export class BombManager {
    private bombs: BombState[];
    private explosions: ExplosionCell[];
    private explosionDurationTicks: number;
    private powerUpCounter: number;

    constructor(explosionDurationTicks: number) {
        this.bombs = [];
        this.explosions = [];
        this.explosionDurationTicks = explosionDurationTicks;
        this.powerUpCounter = 0;
    }

    /**
     * Depose une bombe si la case est libre.
     * countdownTicks vient du joueur (modifie par le power-up REDUCED_BOMB_DELAY).
     */
    public placerBombe(player: PlayerState, currentTick: number): boolean {
        if (!player.isAlive || player.bombStock <= 0) return false;

        const { x, y } = player.position;
        const dejaUneBombe = this.bombs.some(b => b.position.x === x && b.position.y === y);
        if (dejaUneBombe) return false;

        player.bombStock--;
        if (player.nextBombRechargeTick === null) {
            player.nextBombRechargeTick = currentTick + player.bombRechargeTicks;
        }

        this.bombs.push({
            id: `${player.id}-${currentTick}`,
            ownerId: player.id,
            position: { x, y },
            range: player.bombRange,
            placedAtTick: currentTick,
            explodeAtTick: currentTick + DEFAULT_GAME_CONFIG.bombCountdownTicks,
        });
        return true;
    }


    private rechargerBombes(currentTick: number, players: Map<string, PlayerState>): void {
        for (const player of players.values()) {
            if (!player.isAlive) continue;

            if (player.bombStock >= player.maxBombs) {
                player.nextBombRechargeTick = null;
                continue;
            }

            if (player.nextBombRechargeTick === null) {
                player.nextBombRechargeTick = currentTick + player.bombRechargeTicks;
                continue;
            }

            if (currentTick >= player.nextBombRechargeTick) {
                player.bombStock++;
                player.nextBombRechargeTick = player.bombStock < player.maxBombs
                    ? currentTick + player.bombRechargeTicks
                    : null;
            }
        }
    }

    /**
     * Nettoie les flammes expirees puis fait exploser les bombes arrivees a echeance.
     * La liste powerUps est modifiee en place quand un mur detruit fait apparaitre un bonus.
     */
    public tick(
        currentTick: number,
        map: GameMap,
        players: Map<string, PlayerState>,
        powerUps: PowerUp[]
    ): { explodedBombs: BombExplodedPayload[], eliminatedPlayers: string[] } {
        this.explosions = this.explosions.filter(e => e.expiresAtTick > currentTick);

        this.rechargerBombes(currentTick, players);
        
        const bombsAExploser = this.bombs.filter(b => currentTick >= b.explodeAtTick);
        this.bombs = this.bombs.filter(b => currentTick < b.explodeAtTick);
        

        const explodedBombs: BombExplodedPayload[] = [];
        const eliminatedPlayers: Set<string> = new Set();

        while (bombsToExplode.length > 0) {
            const bomb = bombsToExplode.shift()!;
            
            // Récupération de la bombe pour le joueur
            const owner = players.get(bomb.ownerId);
            if (owner && owner.currentBombs > 0) {
                owner.currentBombs--;
            }

        for (const bomb of bombsAExploser) {
            const res = this.exploser(bomb, currentTick, map, players, powerUps);
            explodedBombs.push(res.bombPayload);
            res.eliminatedPlayers.forEach(p => eliminatedPlayers.add(p));

            // Réactions en chaîne : on vérifie si l'explosion touche d'autres bombes
            for (const cell of res.bombPayload.affectedCells) {
                const hitBombIndex = this.bombs.findIndex(b => b.position.x === cell.x && b.position.y === cell.y);
                if (hitBombIndex !== -1) {
                    const hitBomb = this.bombs.splice(hitBombIndex, 1)[0];
                    bombsToExplode.push(hitBomb);
                }
            }
        }

        return { explodedBombs, eliminatedPlayers: Array.from(eliminatedPlayers) };
    }

    /**
     * Fait exploser une bombe dans les 4 directions, detruit le premier mur destructible
     * de chaque direction, retire une vie aux joueurs touches et elimine ceux a 0 vie.
     */
    private exploser(
        bomb: BombState,
        currentTick: number,
        map: GameMap,
        players: Map<string, PlayerState>,
        powerUps: PowerUp[]
    ): { bombPayload: BombExplodedPayload, eliminatedPlayers: string[] } {
        const cellsExplosion = [bomb.position];
        const eliminatedPlayers: string[] = [];

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

                // Arrêt si on rencontre une autre bombe (elle va exploser en chaîne)
                const hasBomb = this.bombs.some(b => b.position.x === nx && b.position.y === ny);
                if (hasBomb) {
                    break;
                }

                // Destruction du premier mur destructible rencontré, puis arrêt du souffle
                if (cell === CellType.DESTRUCTIBLE_WALL) {
                    map.setCell(nx, ny, CellType.EMPTY);
                    this.tenterSpawnPowerUp(nx, ny, powerUps);
                    break;
                }
            }
        }

        const expiresAtTick = currentTick + this.explosionDurationTicks;
        for (const pos of cellsExplosion) {
            this.explosions.push({ position: pos, expiresAtTick });

            for (const [id, player] of players) {
                if (player.isAlive && player.position.x === pos.x && player.position.y === pos.y) {
                    // Un joueur invulnerable ignore le souffle
                    if (currentTick < player.invulnerableUntilTick) continue;

                    player.lives--;
                    if (player.lives <= 0) {
                        player.isAlive = false;
                        eliminatedPlayers.push(id);
                    } else {
                        player.invulnerableUntilTick = currentTick + DEFAULT_GAME_CONFIG.invulnerabilityDurationTicks;
                    }
                }
            }
        }

        return {
            bombPayload: {
                bombId: bomb.id,
                ownerId: bomb.ownerId,
                position: bomb.position,
                affectedCells: cellsExplosion
            },
            eliminatedPlayers
        };
    }

    /**
     * Fait apparaitre un power-up de type aleatoire avec la probabilite
     * powerUpDropPercentage (en pourcentage, donc comparee a un tirage sur 100).
     */
    private tenterSpawnPowerUp(x: number, y: number, powerUps: PowerUp[]): void {
        if (Math.random() * 100 >= DEFAULT_GAME_CONFIG.powerUpDropPercentage) return;

        const types = Object.values(PowerUpType);
        powerUps.push({
            id: `pu-${this.powerUpCounter++}`,
            position: { x, y },
            type: types[Math.floor(Math.random() * types.length)],
        });
    }

    public getBombs(): BombState[] {
        return this.bombs;
    }

    public getExplosions(): ExplosionCell[] {
        return this.explosions;
    }
}