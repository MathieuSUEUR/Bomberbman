import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus
} from '@bomberman/shared';


import { Map as GameMap } from '../map/Map.js';
import { generateMap } from '../map/MapGenerator.js';
import { BombManager } from '../rules/BombManager.js';

export class GameEngine {
    private tickCount: number;
    private status: GameStatus;
    private map: GameMap;
    private players: Map<string, PlayerState>;
    private bombManager: BombManager;
    private actionFile: PlayerAction[];

    constructor() { 
        this.tickCount = 0;
        this.status = 'WAITING';
        this.map = generateMap();
        this.bombManager = new BombManager(100, 2);
        this.players = new Map();
        this.actionFile = [];
    }

    public ajouterAction(action: PlayerAction): void {
        this.actionFile.push(action);
    }

    public tick(): GameState {
        this.tickCount++;

        this.bombManager.tick(this.tickCount, this.map, this.players);

        return this.obtenirEtatActuel();
    }



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
     * @param actions La liste des actions à traiter
     * @returns void
     */
    private processActions(actions: PlayerAction[]): void {
        while(this.actionFile.length > 0) {
            const action = this.actionFile.shift();
                if(!action) continue; // Si action est undefined, on passe à l'itération suivante
                // TODO : Implémenter la logique de traitement des actions des joueurs
        }
    }
}