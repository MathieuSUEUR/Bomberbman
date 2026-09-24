import { BombState, ExplosionCell, PlayerState, CellType, BombExplodedPayload } from '@bomberman/shared';
import { Map as GameMap } from '../map/Map.js';

/**
 * Gère le dépôt, le compte à rebours, la détonation des bombes,
 * la destruction des éléments du décor et l'élimination des joueurs touchés.
 */
export class BombManager {
    /** Liste des bombes actuellement posées sur le plateau. */
    private bombs: BombState[];

    /** Liste des cellules actuellement enflammées par les explosions. */
    private explosions: ExplosionCell[];

    /** Nombre de ticks serveur avant l'explosion d'une bombe après son dépôt. */
    private bombCountdownTicks: number;

    /** Durée de persistance des flammes d'explosion en nombre de ticks. */
    private explosionDurationTicks: number;

    constructor(bombCountdownTicks: number, explosionDurationTicks: number) {
        this.bombs = [];
        this.explosions = [];
        this.bombCountdownTicks = bombCountdownTicks;
        this.explosionDurationTicks = explosionDurationTicks;
    }

    /**
     * Dépose une bombe sur une case spécifique si aucune autre bombe n'y est déjà présente.
     *
     * @param playerId - Identifiant du joueur déposant la bombe.
     * @param x - Coordonnée X de la case ciblée.
     * @param y - Coordonnée Y de la case ciblée.
     * @param range - Portée de déflagration de la bombe en nombre de cases.
     * @param currentTick - Numéro du tick serveur actuel.
     */
    public placerBombe(playerId: string, x: number, y: number, range: number, currentTick: number): void {
        const dejaUneBombe = this.bombs.some(
            b => b.position.x === x && b.position.y === y
        );
        if (dejaUneBombe) return;

        // Initialisation de la nouvelle bombe avec son échéance d'explosion
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

    /**
     * Met à jour l'état des bombes et des explosions pour le tick serveur courant :
     * 1. Nettoie les cellules d'explosion expirées.
     * 2. Déclenche les bombes arrivées à expiration.
     *
     * @remarks En cours d'intégration dans la boucle principale du moteur de jeu.
     * @param currentTick - Numéro du tick serveur actuel.
     * @param map - Instance de la carte de jeu pour propager les dégâts.
     * @param players - Table des joueurs pour appliquer les éliminations.
     */
    public tick(currentTick: number, map: GameMap, players: Map<string, PlayerState>): { explodedBombs: BombExplodedPayload[], eliminatedPlayers: string[] } {
        this.explosions = this.explosions.filter(e => e.expiresAtTick > currentTick);

        const bombsToExplode = this.bombs.filter(b => currentTick >= b.explodeAtTick);
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

            const res = this.exploser(bomb, currentTick, map, players);
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
     * Déclenche l'explosion d'une bombe dans les 4 directions cardinales,
     * détruit les murs destructibles rencontrés et élimine les joueurs dans le souffle.
     *
     * @param bomb - État de la bombe qui explose.
     * @param currentTick - Numéro du tick serveur actuel.
     * @param map - Carte du jeu pour vérifier les obstacles et modifier les cases.
     * @param players - Table des joueurs présents sur la carte.
     */
    private exploser(bomb: BombState, currentTick: number, map: GameMap, players: Map<string, PlayerState>): { bombPayload: BombExplodedPayload, eliminatedPlayers: string[] } {
        const cellsExplosion = [bomb.position];
        const eliminatedPlayers: string[] = [];

        // Vecteurs directionnels : droite, gauche, bas, haut
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ];

        // Propagation du souffle dans chaque direction
        for (const dir of directions) {
            for (let dist = 1; dist <= bomb.range; dist++) {
                const nx = bomb.position.x + dir.x * dist;
                const ny = bomb.position.y + dir.y * dist;
                const cell = map.get(nx, ny);

                // Arrêt immédiat si sortie de carte ou mur indestructible
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
                    break;
                }
            }
        }

        // Création des flammes et élimination des joueurs touchés
        const expiresAtTick = currentTick + this.explosionDurationTicks;
        for (const pos of cellsExplosion) {
            this.explosions.push({ position: pos, expiresAtTick });

            // Élimination de tout joueur se trouvant sur une case de déflagration
            for (const [id, player] of players) {
                if (player.isAlive && player.position.x === pos.x && player.position.y === pos.y) {
                    player.isAlive = false;
                    eliminatedPlayers.push(id);
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
     * Retourne la liste de toutes les bombes actives actuellement posées sur le plateau.
     *
     * @returns Tableau des bombes actives.
     */
    public getBombs(): BombState[] {
        return this.bombs;
    }

    /**
     * Retourne la liste de toutes les cellules actuellement affectées par une explosion.
     *
     * @returns Tableau des cellules d'explosion actives.
     */
    public getExplosions(): ExplosionCell[] {
        return this.explosions;
    }
}