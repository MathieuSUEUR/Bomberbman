import {
    CellType,
    PlayerState,
    PlayerAction,
    GameState,
    GameStatus,
    BombState,
} from '@bomberman/shared';

export class GameEngine {
    private tickCount: number;
    private status: GameStatus;
    private gameGrid: CellType[][];
    private players: Map<string, PlayerState>;
    private bombs: BombState[];
    private actionFile: PlayerAction[];

    constructor() { 
        this.tickCount = 0;
        this.status = 'WAITING';
        this.gameGrid = [];
        this.players = new Map();
        this.bombs = [];
        this.actionFile = [];
    }

    /**
     * Ajoute une action demandée par un joueur à la file d'attente.
     * @param action L'action à ajouter
     * @returns void 
     */
    public ajouterAction(action: PlayerAction): void {
        this.actionFile.push(action);
    }

    /**
     * un tick du jeu
     * @returns L'état actuel du jeu
     */
    public tick(): GameState {
        this.tickCount++;
        
    
        return this.obtenirEtatActuel();
    }

    /** 
     * Méthode utilitaire pour la sérialisation JSON de l'état du jeu
     * @returns L'état actuel du jeu
     */
    public obtenirEtatActuel(): GameState {
        // Conversion du Map des joueurs en objet simple pour la sérialisation JSON
        const playersPourClient: Record<string, PlayerState> = {};

        this.players.forEach((etat, id) => {
        playersPourClient[id] = etat;
        });

        // On retourne l'objet complet conforme au contrat GameState
        return {
        tick: this.tickCount,
        status: this.status,
        grid: this.gameGrid,
        players: playersPourClient,
        bombs: this.bombs,
        explosions: [],
        };
    }
}