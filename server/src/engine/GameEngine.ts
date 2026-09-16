import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    BombState,
} from '@bomberman/shared';


import { Map as GameMap } from '../map/Map.js';
import { generateMap, generateGrid } from '../map/MapGenerator.js';

export class GameEngine {
    private tickCount: number;
    private status: GameStatus;
    private map: GameMap;
    private players: Map<string, PlayerState>;
    private bombs: BombState[];
    private actionFile: PlayerAction[];

    constructor() { 
        this.tickCount = 0;
        this.status = 'WAITING';
        this.map = generateMap();
        this.players = new Map();
        this.bombs = [];
        this.actionFile = [];
    }

    public ajouterAction(action: PlayerAction): void {
        this.actionFile.push(action);
    }

    public tick(): GameState {
        this.tickCount++;





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
            bombs: this.bombs,
            explosions: [],
        };
    }
}