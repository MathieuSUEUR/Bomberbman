import {
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    LobbyPlayer
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


    //initialise les joueurs
    public initPlayers(lobbyPlayers: LobbyPlayer[]): void {
        const startPositions = [
            { x: 1, y: 1 },
            { x: 13, y: 1 },
            { x: 1, y: 11 },
            { x: 13, y: 11 }
        ];

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
}