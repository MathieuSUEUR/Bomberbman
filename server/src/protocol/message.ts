//l'ensemble des types de messages qui peuvent etre envoyes entre le client et le serveur
export enum MessageType {

    //lobby
    JOIN_LOBBY = 'JOIN_LOBBY',//demande de rej.
    PLAYER_JOINED = 'PLAYER_JOINED',//le joueur a rej
    PLAYER_LEFT = 'PLAYER_LEFT',//le joueur est partit

    //in game 
    MAP_INITIALIZED = 'MAP_INITIALIZED',//grille de depart (a faire ou randomizer comme on veut)
    GAME_STARTED = 'GAME_STARTED',
    GAME_TICK = 'GAME_TICK',
    GAME_OVER = 'GAME_OVER',

    //deplacements
    MOVE = 'MOVE',//demande client
    POSITION_UPDATE = 'POSITION_UPDATE',//validation server

    //bombes
    PLACE_BOMB = 'PLACE_BOMB',//client
    BOMB_PLACED = 'BOMB_PLACED',//serv
    BOMB_EXPLODED = 'BOMB_EXPLODED',//server
    WALL_DESTROYED = 'WALL_DESTROYED',//serv

    //objets
    ITEM_SPAWNED = 'ITEM_SPAWNED',
    ITEM_PICKED_UP = 'ITEM_PICKED_UP',

    //actions sur les joueurs
    PLAYER_SPAWNED = 'PLAYER_SPAWNED',
    PLAYER_DAMAGED = 'PLAYER_DAMAGED',
    PLAYER_KILLED = 'PLAYER_KILLED',

    //A raj. si manque d'actions serv. ou clients
};


//--INTERFACES---

export interface JoinLobby{
    playerName:string;
}

export interface Move{ //client
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
}

export interface PositionUpdate{ //server
    playerID: string;
    x: number;
    y: number;
}

export interface BombPlaced{//client
    bombID:string;
    OwnerID:string;
    x:number;
    y:number;
    TimeMs:number;
    bombPower:number;
}

export interface BombExploded{
    bombID:string;
    bombPower:number;
    x:number;
    y:number;
    affectedCells:{x:number, y:number}[];//cases touchées
}

export interface WallDestroyed{
    x: number;
    y: number;
}

export interface ItemPicked{
    playerID:string; 
    itemID:string;
    itemType:'BOMB_UP'|'FIRE_UP'|'SPEED_UP'|'LIFE_UP'|'IMMUNITY_UP';
}
    
export interface GameMessage{
    type: MessageType;//assure que message dans enum.
    payload: any;
}
