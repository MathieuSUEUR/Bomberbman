import { CellType, PowerUp } from './grid.js';
import { PlayerState } from './player.js';
import { BombState, ExplosionCell } from './bomb.js';

//type d'état du jeu
export type GameStatus = 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';

//type d'action
export type ActionType =
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'PLACE_BOMB';

//action d'un joueur
export interface PlayerAction {
  playerId: string;
  actionType: ActionType;
  tick?: number;
}

//état actuel du jeu
export interface GameState {
  tick: number;
  status: GameStatus;
  grid: CellType[][];
  players: Record<string, PlayerState>;
  bombs: BombState[];
  explosions: ExplosionCell[];
  powerUps?: PowerUp[];
  winnerId?: string | null;
}

//configuration de la partie
export interface GameConfig {
  tickRate: number;
  gridWidth: number;
  gridHeight: number;
  bombCountdownTicks: number;
  explosionDurationTicks: number;
}
