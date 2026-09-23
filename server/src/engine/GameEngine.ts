import { EventEmitter } from 'node:events';
import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    LobbyPlayer,
    DEFAULT_GAME_CONFIG,
    getSpawnPositions,
    CellType
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

        // On vérifie que le jeu est bien en cours
        if (this.status !== 'IN_PROGRESS') {
            this.actionFile = [];
            return;
        }

        // Ensemble des joueurs ayant déjà effectué un déplacement durant ce tick
        const hasMoved = new Set<string>();

        // on traite les actions en attente
        while(this.actionFile.length > 0) {
            const action = this.actionFile.shift();
                if(!action) continue; // Si action est undefined, on passe à l'itération suivante

                if(action.actionType.toString().startsWith("MOVE")){
                    const player = this.players.get(action.playerId);

                    // on vérifie que le joueur existe et qu'il n'a pas déjà bougé durant ce tick
                    if(player && !hasMoved.has(action.playerId)){
                        this.movePlayerTo(player, action.actionType.toString().split("_")[1]);
                        hasMoved.add(action.playerId);
                    }
                }else if(action.actionType === "PLACE_BOMB"){
                    const player = this.players.get(action.playerId);

                    if(player){
                        this.playerPlaceBomb(player);
                    }
                }

                // TODO:: ajouter le pick up des power-up
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
    private movePlayerTo(player: PlayerState, direction: string): void {
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
            default:
                break;
        }

        if (this.canMoveTo(newPos.x, newPos.y)) {
            player.position = newPos;
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