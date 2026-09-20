import { EventEmitter } from 'node:events';
import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    LobbyPlayer,
    DEFAULT_GAME_CONFIG,
    getSpawnPositions
} from '@bomberman/shared';


import { Map as GameMap } from '../map/Map.js';
import { generateMap } from '../map/MapGenerator.js';
import { BombManager } from '../rules/BombManager.js';

export class GameEngine extends EventEmitter {
    private tickCount: number;
    private status: GameStatus;
    private map: GameMap;
    private players: Map<string, PlayerState>;
    private bombManager: BombManager;
    private actionFile: PlayerAction[];
    private gameLoopInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.tickCount = 0;
        this.status = 'WAITING';
        this.map = generateMap();
        this.bombManager = new BombManager(DEFAULT_GAME_CONFIG.bombCountdownTicks, DEFAULT_GAME_CONFIG.explosionDurationTicks);
        this.players = new Map();
        this.actionFile = [];
    }

    /**
     * Fonction qui permet d'ajouter une action a la file 
     * @param action Une action d'un joueur
     */
    public ajouterAction(action: PlayerAction): void {
        this.actionFile.push(action);
    }

    /**
     * Fonction qui permet de faire avancer le moteur de jeu
     * @returns GameState L'état actuel du jeu
     */
    public tick(): GameState {
        this.tickCount++;

        this.processActions();
        
        const tickResult = this.bombManager.tick(this.tickCount, this.map, this.players);
        
        // Émettre les événements pour chaque bombe qui a explosé
        tickResult.explodedBombs.forEach(bombPayload => {
            this.emit('bombExploded', bombPayload);
        });

        // Émettre les événements pour chaque joueur éliminé
        tickResult.eliminatedPlayers.forEach(playerId => {
            this.emit('playerEliminated', { playerId });
        });

        // TODO: Vérifier les conditions de GAME_OVER (ex: s'il ne reste qu'un seul joueur en vie ou 0)

        return this.obtenirEtatActuel();
    }

    /**
    * Fonction qui permet d'initialiser les joueurs dans le moteur de jeu
    * @param lobbyPlayers La liste des joueurs dans le lobby
    * @returns VOID
    */
    public initPlayers(lobbyPlayers: LobbyPlayer[]): void {
        const startPositions = getSpawnPositions();

        // On initialise les joueurs avec leurs positions de départ et leurs états
        lobbyPlayers.forEach((player, index) => {
            const pos = startPositions[index % startPositions.length];
            this.players.set(player.id, {
                id: player.id,
                name: player.name,
                position: pos,
                isAlive: true,
                maxBombs: 1,
                currentBombs: 0,
                bombRange: 2,
                speed: 1,
                color: `player-${index + 1}`
            });
        });
        this.status = 'IN_PROGRESS';//instance du game engine en cours
        this.startGameLoop();
    }

    /**
     * Démarre la boucle de jeu périodique
     */
    public startGameLoop(): void {
        if (this.gameLoopInterval) return;
        
        // Calcul de l'intervalle en ms (ex: tickRate 20 = 50ms)
        const tickIntervalMs = 1000 / DEFAULT_GAME_CONFIG.tickRate;
        
        this.gameLoopInterval = setInterval(() => {
            if (this.status === 'IN_PROGRESS') {
                const state = this.tick();
                this.emit('tick', state);
            }
        }, tickIntervalMs);
        
        console.info(`GameEngine: boucle de jeu démarrée (${DEFAULT_GAME_CONFIG.tickRate} ticks/s)`);
    }

    /**
     * Arrête la boucle de jeu
     */
    public stopGameLoop(): void {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            console.info('GameEngine: boucle de jeu arrêtée');
        }
    }

    /**
     * Fonction qui permet d'obtenir l'état actuel du jeu
     * @returns GameState L'état actuel du jeu
     */
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
            explosions: this.bombManager.getExplosions()
        };
    }

    /**
     * Traite les actions demandées par les joueurs
     */
    private processActions(): void {
        while(this.actionFile.length > 0) {
            const action = this.actionFile.shift();
                if(!action) continue; // Si action est undefined, on passe à l'itération suivante
                // TODO : Implémenter la logique de traitement des actions des joueurs
        }
    }
}