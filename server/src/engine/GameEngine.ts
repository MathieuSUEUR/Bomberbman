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
    Position
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

        // TODO: Vérifier les conditions de GAME_OVER (ex: s'il ne reste qu'un seul joueur en vie ou 0)

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

    /** Vide la file d'actions des joueurs. */
    private processActions(): void {

        // On vérifie que le jeu est bien en cours
        if (this.status !== 'IN_PROGRESS') {
            this.actionFile = [];
            return;
        }

        // Ensemble des joueurs ayant déjà effectué un déplacement durant ce tick
        const hasMoved = new Set<string>();

        // On traite les actions en attente
        while (this.actionFile.length > 0) {
            const action = this.actionFile.shift();
            if (!action) continue;

            const player = this.players.get(action.playerId);
            if (!player || !player.isAlive) continue;

            switch (action.actionType) {
                case 'MOVE_UP':
                    this.handlePlayerMove(player, 'UP', hasMoved);
                    break;
                case 'MOVE_DOWN':
                    this.handlePlayerMove(player, 'DOWN', hasMoved);
                    break;
                case 'MOVE_LEFT':
                    this.handlePlayerMove(player, 'LEFT', hasMoved);
                    break;
                case 'MOVE_RIGHT':
                    this.handlePlayerMove(player, 'RIGHT', hasMoved);
                    break;
                case 'PLACE_BOMB':
                    this.playerPlaceBomb(player);
                    break;
                default:
                    break;
            }

            // TODO:: ajouter le pick up des power-up
        }
    }

    /**
     * Gère la tentative de déplacement d'un joueur dans une direction donnée
     * @param player L'état du joueur
     * @param direction La direction demandée
     * @param hasMoved Ensemble des joueurs ayant déjà bougé durant ce tick
     */
    private handlePlayerMove(player: PlayerState, direction: Direction, hasMoved: Set<string>): void {
        if (hasMoved.has(player.id)) return;
        this.movePlayerTo(player, direction);
        hasMoved.add(player.id);
    }

    /**
     * Vérifie si un joueur peut se déplacer vers une case donnée
     * @param targetX La coordonnée X de la case cible
     * @param targetY La coordonnée Y de la case cible
     * @returns boolean True si le joueur peut se déplacer, false sinon
     */
    private canMoveTo(targetX: number, targetY: number): boolean {

        // si la case est un mur ou une bordure, on ne peut pas se déplacer
        if(this.map.get(targetX, targetY) !== CellType.EMPTY) return false;

        // si la case est déjà occupée par une bombe, on ne peut pas se déplacer
        const hasBomb = this.bombManager.getBombs().some(
            b => b.position.x === targetX && b.position.y === targetY
        );
        if (hasBomb) return false;
       
        return true;
    }

    /**
     * Déplace un joueur vers une case donnée
     * @param player L'état du joueur
     * @param direction La direction du mouvement
     */
    private movePlayerTo(player: PlayerState, direction: Direction): void {
        if(!player.isAlive) return;
        
        const newPos = { x: player.position.x, y: player.position.y };

        switch(direction) {
            case 'UP':
                newPos.y -= player.speed;
                break;
            case 'DOWN':
                newPos.y += player.speed;
                break;
            case 'LEFT':
                newPos.x -= player.speed;
                break;
            case 'RIGHT':
                newPos.x += player.speed;
                break;
        }

        if (this.canMoveTo(newPos.x, newPos.y)) {
            player.position = newPos;

            // Si le joueur marche sur une case où une explosion est active, il est éliminé
            this.checkPlayerExplosionCollision(player);
        }
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
     * Place une bombe à une position donnée
     * @param player L'état du joueur
     */
    private playerPlaceBomb(player: PlayerState): void {
        if(!player.isAlive) return;

        // on vérifie que la case est bien vide
        if(this.map.get(player.position.x, player.position.y) !== CellType.EMPTY) return;

        // on vérifie qu'il n'y ait pas deja une bombe sur la case
        if(this.bombManager.getBombs().some(bomb => bomb.position.x === player.position.x && bomb.position.y === player.position.y)) return;

        // on vérifie que le joueur a encore des bombes disponibles
        if(player.currentBombs >= player.maxBombs) return;

        // on place la bombe
        this.bombManager.placerBombe(player.id, player.position.x, player.position.y, player.bombRange, this.tickCount);
        player.currentBombs++;
    }
}