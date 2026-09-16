import { Position } from './grid.js';

//état d'un joueur
export interface PlayerState {
  id: string;
  name: string;
  position: Position;
  isAlive: boolean;
  maxBombs: number;
  currentBombs: number;
  bombRange: number;
  speed: number;
  color?: string;
}
