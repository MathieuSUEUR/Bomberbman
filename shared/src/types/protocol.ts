import { GameState, GameStatus, ActionType } from './game.js';
import { Position } from './grid.js';

//type de message client
export type ClientMessageType =
  | 'JOIN'
  | 'READY'
  | 'ACTION'
  | 'PING'
  | 'LIST_ROOMS'
  | 'CREATE_ROOM';

//payload pour JOIN
export interface JoinPayload {
  name: string;
  roomId?: string;
}

//payload pour CREATE_ROOM
export interface CreateRoomPayload {
  name?: string;
  roomId?: string;
}

//payload pour ACTION
export interface ActionPayload {
  actionType: ActionType;
}

//message client
export type ClientMessage =
  | { type: 'JOIN'; payload: JoinPayload }
  | { type: 'READY'; payload?: { isReady: boolean } }
  | { type: 'ACTION'; payload: ActionPayload }
  | { type: 'PING'; payload?: { timestamp: number } }
  | { type: 'LIST_ROOMS'; payload?: Record<string, never> }
  | { type: 'CREATE_ROOM'; payload?: CreateRoomPayload };

//type de message serveur
export type ServerMessageType =
  | 'WELCOME'
  | 'LOBBY_STATE'
  | 'GAME_START'
  | 'GAME_STATE'
  | 'BOMB_EXPLODED'
  | 'PLAYER_ELIMINATED'
  | 'GAME_OVER'
  | 'ERROR'
  | 'PONG'
  | 'ROOM_LIST'
  | 'ROOM_CREATED';

//joueur dans le lobby
export interface LobbyPlayer {
  id: string;
  name: string;
  isReady: boolean;
}

//payload pour LOBBY_STATE
export interface LobbyStatePayload {
  players: LobbyPlayer[];
  canStart: boolean;
  roomId?: string;
}

//résumé d'une salle de jeu
export interface RoomSummary {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  canJoin: boolean;
  status: GameStatus;
}

//payload pour ROOM_LIST
export interface RoomListPayload {
  rooms: RoomSummary[];
}

//payload pour ROOM_CREATED
export interface RoomCreatedPayload {
  roomId: string;
  name: string;
}

//payload pour BOMB_EXPLODED
export interface BombExplodedPayload {
  bombId: string;
  ownerId: string;
  position: Position;
  affectedCells: Position[];
}

//résumé du score d'un joueur en fin de partie
export interface PlayerScoreSummary {
  id: string;
  name: string;
  score: number;
  isAlive: boolean;
  rank: number;
}

//payload pour GAME_OVER
export interface GameOverPayload {
  winnerId: string | null;
  winnerName?: string | null;
  scores?: PlayerScoreSummary[];
}

export type ServerMessage =
  | { type: 'WELCOME'; payload: { playerId: string } }
  | { type: 'LOBBY_STATE'; payload: LobbyStatePayload }
  | { type: 'GAME_START'; payload: { initialState: GameState; roomId?: string } }
  | { type: 'GAME_STATE'; payload: GameState }
  | { type: 'BOMB_EXPLODED'; payload: BombExplodedPayload }
  | { type: 'PLAYER_ELIMINATED'; payload: { playerId: string; killedBy?: string } }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'ERROR'; payload: { message: string; code?: string } }
  | { type: 'PONG'; payload?: { timestamp: number } }
  | { type: 'ROOM_LIST'; payload: RoomListPayload }
  | { type: 'ROOM_CREATED'; payload: RoomCreatedPayload };
