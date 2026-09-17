import { Position } from './grid.js';

//état d'une bombe
export interface BombState {
  id: string;
  ownerId: string;
  position: Position;
  range: number;
  placedAtTick: number;
  explodeAtTick: number;
}

//case d'explosion
export interface ExplosionCell {
  position: Position;
  expiresAtTick: number;
}
