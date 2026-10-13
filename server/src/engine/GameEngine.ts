import { EventEmitter } from 'node:events';
import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    LobbyPlayer,
    PowerUp,
    DEFAULT_GAME_CONFIG,
    getSpawnPositions,
    CellType,
    Direction,
    Position,
    GameOverPayload
} from '@bomberman/shared';

import { Map as GameMap } from '../map/Map.js';
import { generateMap } from '../map/MapGenerator.js';
import { BombManager } from '../rules/BombManager.js';
import { PowerUpManager } from '../rules/PowerUpManager.js';

export class GameEngine extends EventEmitter {
    private tickCount: number;
    private status: GameStatus;
    private map: GameMap;
    private players: Map<string, PlayerState>;
    private bombManager: BombManager;
    private powerUpManager: PowerUpManager;
    // Ne jamais reassigner : BombManager et PowerUpManager modifient ce tableau en place
    private powerUps: PowerUp[];
    private actionFile: PlayerAction[];
    private gameLoopInterval: NodeJS.Timeout | null = null;

    private suddenDeathIndex: number = 0;
    private suddenDeathPositions: Position[] = [];

    constructor() {
        super();
        this.tickCount = 0;
        this.status = 'WAITING';
        this.map = generateMap();
        this.bombManager = new BombManager(DEFAULT_GAME_CONFIG.explosionDurationTicks);
        this.powerUpManager = new PowerUpManager();
        this.powerUps = [];
        this.players = new Map();
        this.actionFile = [];
        this.suddenDeathIndex = 0;
        this.suddenDeathPositions = this.generateSpiralPositions(DEFAULT_GAME_CONFIG.gridWidth, DEFAULT_GAME_CONFIG.gridHeight);
    }

    /**
     * Génère les positions pour le mode Sudden Death (en spirale vers le centre de la carte)
     */
    private generateSpiralPositions(width: number, height: number): Position[] {
        const positions: Position[] = [];
        let left = 1, right = width - 2, top = 1, bottom = height - 2;

        while (left <= right && top <= bottom) {
            for (let i = left; i <= right; i++) positions.push({ x: i, y: top });
            top++;
            for (let i = top; i <= bottom; i++) positions.push({ x: right, y: i });
            right--;
            if (top <= bottom) {
                for (let i = right; i >= left; i--) positions.push({ x: i, y: bottom });
                bottom--;
            }
            if (left <= right) {
                for (let i = bottom; i >= top; i--) positions.push({ x: left, y: i });
                left++;
            }
        }
        return positions;
    }

    /** Ajoute une action de joueur a la file de traitement. */
    public ajouterAction(action: PlayerAction): void {
        this.actionFile.push(action);
    }

    /**
     * Fait avancer le jeu d'un tick : actions, ramassage des power-ups,
     * bombes et explosions. Retourne l'etat du jeu.
     */
    public tick(): GameState {
        this.tickCount++;

        this.processActions();

        // Le ramassage passe avant les explosions : un bonus ne peut pas etre ramasse
        // sur une case ou le joueur vient de mourir
        const pickups = this.powerUpManager.collect(this.players, this.powerUps);
        pickups.forEach(pickup => this.emit('powerUpCollected', pickup));

        const tickResult = this.bombManager.tick(this.tickCount, this.map, this.players, this.powerUps);

        tickResult.explodedBombs.forEach(bombPayload => {
            this.emit('bombExploded', bombPayload);
        });

        tickResult.eliminatedPlayers.forEach(playerId => {
            this.emit('playerEliminated', { playerId });
        });

        // Gestion de la Mort Subite (Sudden Death)
        if (this.tickCount > DEFAULT_GAME_CONFIG.gameDurationTicks) {
            const overTime = this.tickCount - DEFAULT_GAME_CONFIG.gameDurationTicks;

            if (overTime % DEFAULT_GAME_CONFIG.suddenDeathDropIntervalTicks === 0) {
                if (this.suddenDeathIndex < this.suddenDeathPositions.length) {
                    const pos = this.suddenDeathPositions[this.suddenDeathIndex++];
                    this.map.setCell(pos.x, pos.y, CellType.INDESTRUCTIBLE_WALL);

                    // Éliminer tout joueur écrasé par le bloc
                    this.players.forEach(p => {
                        if (p.isAlive && p.position.x === pos.x && p.position.y === pos.y) {
                            p.isAlive = false;
                            this.emit('playerEliminated', { playerId: p.id });
                        }
                    });
                }
            }
        }

        // si le jeu est terminé, on arrête la boucle de jeu et on émet un événement de fin de partie
        if (this.checkGameOver()) {
            this.status = 'FINISHED';
            this.stopGameLoop();

            const livingPlayers = Array.from(this.players.values()).filter(p => p.isAlive);
            const winner = livingPlayers.length === 1 ? livingPlayers[0] : null;

            const gameOverPayload: GameOverPayload = {
                winnerId: winner ? winner.id : null,
                winnerName: winner ? winner.name : null
            };

            this.emit('gameOver', gameOverPayload);
        }

        return this.obtenirEtatActuel();
    }

    /** Cree les joueurs du lobby a leurs positions de depart et lance la boucle de jeu. */
    public initPlayers(lobbyPlayers: LobbyPlayer[]): void {
        const startPositions = getSpawnPositions();

        lobbyPlayers.forEach((player, index) => {
            // Le modulo evite un depassement si le lobby a plus de joueurs que de positions
            const pos = startPositions[index % startPositions.length];
            this.players.set(player.id, {
                id: player.id,
                name: player.name,
                position: pos,
                isAlive: true,
                maxBombs: 1,
                bombStock: 1,
                bombRange: 2,
                speed: 1,
                nextMoveTick: 0,
                lives: DEFAULT_GAME_CONFIG.startingLives,
                invulnerableUntilTick: 0,
                bombRechargeTicks: DEFAULT_GAME_CONFIG.bombRechargeTicks,
                nextBombRechargeTick: null,
                color: `player-${index + 1}`
            });
        });
        this.status = 'IN_PROGRESS';
        this.startGameLoop();
    }

    /** Demarre la boucle de jeu (intervalle = 1000 / tickRate ms). */
    public startGameLoop(): void {
        if (this.gameLoopInterval) return;

        const tickIntervalMs = 1000 / DEFAULT_GAME_CONFIG.tickRate;

        this.gameLoopInterval = setInterval(() => {
            if (this.status === 'IN_PROGRESS') {
                const state = this.tick();
                this.emit('tick', state);
            }
        }, tickIntervalMs);

        console.info(`GameEngine: boucle de jeu demarree (${DEFAULT_GAME_CONFIG.tickRate} ticks/s)`);
    }

    /** Arrete la boucle de jeu. */
    public stopGameLoop(): void {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            console.info('GameEngine: boucle de jeu arretee');
        }
    }

    /** Retourne l'etat complet du jeu, joueurs convertis en objet serialisable. */
    public obtenirEtatActuel(): GameState {
        const playersPourClient: Record<string, PlayerState> = {};
        this.players.forEach((etat, id) => {
            playersPourClient[id] = etat;
        });

        return {
            tick: this.tickCount,
            status: this.status,
            grid: this.map.getGrid(),
            players: playersPourClient,
            bombs: this.bombManager.getBombs(),
            explosions: this.bombManager.getExplosions(),
            powerUps: this.powerUps
        };
    }

    /** Traite et vide la file d'actions des joueurs. */
    private processActions(): void {

        // On vérifie que le jeu est bien en cours
        if (this.status !== 'IN_PROGRESS') {
            this.actionFile = [];
            return;
        }

        // On traite les actions en attente
        while (this.actionFile.length > 0) {
            const action = this.actionFile.shift();
            if (!action) continue;

            const player = this.players.get(action.playerId);
            if (!player || !player.isAlive) continue;

            switch (action.actionType) {
                case 'MOVE_UP':
                    this.handlePlayerMove(player, 'UP');
                    break;
                case 'MOVE_DOWN':
                    this.handlePlayerMove(player, 'DOWN');
                    break;
                case 'MOVE_LEFT':
                    this.handlePlayerMove(player, 'LEFT');
                    break;
                case 'MOVE_RIGHT':
                    this.handlePlayerMove(player, 'RIGHT');
                    break;
                case 'PLACE_BOMB':
                    this.playerPlaceBomb(player);
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Délai (en ticks) à respecter entre deux déplacements d'un joueur.
     * Diminue de 1 tick par point de speed au-dessus de 1, avec un plancher minimal.
     * @param player L'état du joueur
     */
    private getMoveDelayTicks(player: PlayerState): number {
        const delay = DEFAULT_GAME_CONFIG.moveDelayTicks - (player.speed - 1);
        return Math.max(DEFAULT_GAME_CONFIG.minMoveDelayTicks, delay);
    }

    /**
     * Gère la tentative de déplacement d'un joueur dans une direction donnée.
     * La demande est ignorée si le délai depuis le dernier déplacement n'est pas écoulé.
     * @param player L'état du joueur
     * @param direction La direction demandée
     */
    private handlePlayerMove(player: PlayerState, direction: Direction): void {
        if (this.tickCount < player.nextMoveTick) return;

        // Le délai ne démarre que si le déplacement a réellement eu lieu
        if (this.movePlayerTo(player, direction)) {
            player.nextMoveTick = this.tickCount + this.getMoveDelayTicks(player);
        }
    }

    /**
     * Vérifie si un joueur peut se déplacer vers une case donnée
     * @param targetX La coordonnée X de la case cible
     * @param targetY La coordonnée Y de la case cible
     * @returns boolean True si le joueur peut se déplacer, false sinon
     */
    private canMoveTo(targetX: number, targetY: number): boolean {

        // si la case est un mur ou une bordure, on ne peut pas se déplacer
        if (this.map.get(targetX, targetY) !== CellType.EMPTY) return false;

        // si la case est déjà occupée par une bombe, on ne peut pas se déplacer
        const hasBomb = this.bombManager.getBombs().some(
            b => b.position.x === targetX && b.position.y === targetY
        );
        if (hasBomb) return false;

        return true;
    }

    /**
     * Déplace un joueur d'une case dans la direction donnée
     * @param player L'état du joueur
     * @param direction La direction du mouvement
     * @returns boolean True si le joueur s'est déplacé, false sinon
     */
    private movePlayerTo(player: PlayerState, direction: Direction): boolean {
    if (!player.isAlive) return false;

    let moved = false;

    for (let i = 0; i < player.speed; i++) {
        const newPos = { x: player.position.x, y: player.position.y };

        switch (direction) {
            case 'UP':
                newPos.y -= 1;
                break;
            case 'DOWN':
                newPos.y += 1;
                break;
            case 'LEFT':
                newPos.x -= 1;
                break;
            case 'RIGHT':
                newPos.x += 1;
                break;
            default:
                return moved;
        }

        if (!this.canMoveTo(newPos.x, newPos.y)) break;

        player.position = newPos;
        moved = true;

        this.checkPlayerExplosionCollision(player);

        if (!player.isAlive) break;
    }

    return moved;
}

    /**
     * Vérifie si un joueur se trouve sur une déflagration active et l'élimine le cas échéant
     * @param player Le joueur à vérifier
     */
    private checkPlayerExplosionCollision(player: PlayerState): void {
        const isInExplosion = this.bombManager.getExplosions().some(
            exp => exp.position.x === player.position.x && exp.position.y === player.position.y
        );

        if (isInExplosion) {
            player.isAlive = false;
            this.emit('playerEliminated', { playerId: player.id });
        }
    }

    /**
     * Place une bombe à la position du joueur.
     * BombManager vérifie le stock, la case libre et que le joueur est vivant,
     * puis consomme une bombe et lance le chrono de recharge.
     * @param player L'état du joueur
     */
    private playerPlaceBomb(player: PlayerState): void {
        this.bombManager.placerBombe(player, this.tickCount);
    }

    /**
     * Vérifie si le jeu est terminé 
     * @returns boolean True si le jeu est terminé, false sinon
     */
    private checkGameOver(): boolean {
        if (this.status !== 'IN_PROGRESS' || this.players.size < 2) {
            return false;
        }
        const livingPlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        return livingPlayers.length <= 1;
    }
}