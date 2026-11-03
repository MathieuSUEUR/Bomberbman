import { Position } from './grid.js';

//état d'un joueur
export interface PlayerState {
  id: string;
  name: string;
  position: Position;
  isAlive: boolean;
  maxBombs: number;
  bombStock: number;
  bombRange: number;
  lives: number;
  bombRechargeTicks: number;
  nextBombRechargeTick: number | null;
  speed: number;
  nextMoveTick: number;
  color?: string;
  invulnerableUntilTick: number;
}