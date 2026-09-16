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

        //  traitement des actions
        //  this.processActions();

        // mise à jour de la logique
        // this.updateGameLogic();
        
    
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