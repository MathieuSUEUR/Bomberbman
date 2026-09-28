import { EventEmitter } from 'node:events';
import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    LobbyPlayer,
    PowerUp,
    DEFAULT_GAME_CONFIG,
    getSpawnPositions
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

        // TODO: verifier les conditions de GAME_OVER

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
        while (this.actionFile.length > 0) {
            const action = this.actionFile.shift();
            if (!action) continue;
            // TODO: implementer le traitement des actions (deplacement, pose de bombe)
        }
    }
}