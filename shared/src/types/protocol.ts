import { GameState, ActionType } from './game.js';
import { Position } from './grid.js';

//type de message client
export type ClientMessageType =
  | 'JOIN'
  | 'READY'
  | 'ACTION'
  | 'PING';

//payload pour JOIN
export interface JoinPayload {
  name: string;
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
  | { type: 'PING'; payload?: { timestamp: number } };

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
  | 'PONG';

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
}

//payload pour BOMB_EXPLODED
export interface BombExplodedPayload {
  bombId: string;
  ownerId: string;
  position: Position;
  affectedCells: Position[];
}

//payload pour GAME_OVER
export interface GameOverPayload {
  winnerId: string | null;
  winnerName?: string | null;
}

export type ServerMessage =
  | { type: 'WELCOME'; payload: { playerId: string } }
  | { type: 'LOBBY_STATE'; payload: LobbyStatePayload }
  | { type: 'GAME_START'; payload: { initialState: GameState } }
  | { type: 'GAME_STATE'; payload: GameState }
  | { type: 'BOMB_EXPLODED'; payload: BombExplodedPayload }
  | { type: 'PLAYER_ELIMINATED'; payload: { playerId: string; killedBy?: string } }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'ERROR'; payload: { message: string; code?: string } }
  | { type: 'PONG'; payload?: { timestamp: number } };
