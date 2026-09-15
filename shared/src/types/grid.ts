//type de case
export enum CellType {
  EMPTY = 0,
  INDESTRUCTIBLE_WALL = 1,
  DESTRUCTIBLE_WALL = 2,
}

//position
export interface Position {
  x: number;
  y: number;
}

//direction
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

//type de power-up
export enum PowerUpType {
  EXTRA_BOMB = 'EXTRA_BOMB',
  EXTRA_RANGE = 'EXTRA_RANGE',
  SPEED_UP = 'SPEED_UP',
}

//power-up
export interface PowerUp {
  id: string;
  position: Position;
  type: PowerUpType;
}
