import { CellType, Position, PowerUp } from './grid.js';
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

export const DEFAULT_GAME_CONFIG: GameConfig = {
  tickRate: 20,
  gridWidth: 15,
  gridHeight: 13,
  bombCountdownTicks: 60,
  explosionDurationTicks: 10,
};

/**
 * Retourne les quatre positions de départ des joueurs.
 * @param width La largeur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridWidth`).
 * @param height La hauteur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridHeight`).
 * 
 * On utilise `width - 2` et `height - 2` parce que les bordures du plateau sont occupées
 * par des murs indestructibles (indices `0` et `width - 1` / `height - 1`). Les cases
 * jouables les plus proches des coins sont donc `1` et `width - 2`.
 */
export function getSpawnPositions(
  width = DEFAULT_GAME_CONFIG.gridWidth,
  height = DEFAULT_GAME_CONFIG.gridHeight,
): Position[] {
  return [
    { x: 1, y: 1 },
    { x: width - 2, y: 1 },
    { x: 1, y: height - 2 },
    { x: width - 2, y: height - 2 },
  ];
}

/**
 * Retourne les 12 cases qui constituent les zones sûres des quatre coins du plateau.
 * @param width La largeur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridWidth`).
 * @param height La hauteur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridHeight`).
 * 
 * Chaque coin possède 3 cases de sécurité pour éviter que les joueurs soient immédiatement
 * bloqués par des murs au moment de l'apparition. Les coins sont donc définis comme des
 * zones autour des emplacements initiaux, et non pas seulement par la seule case exacte.
 */
export function getSafeCornerCells(
  width = DEFAULT_GAME_CONFIG.gridWidth,
  height = DEFAULT_GAME_CONFIG.gridHeight,
): Position[] {
  const corners: Position[][] = [
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: width - 2, y: 1 },
      { x: width - 3, y: 1 },
      { x: width - 2, y: 2 },
    ],
    [
      { x: 1, y: height - 2 },
      { x: 2, y: height - 2 },
      { x: 1, y: height - 3 },
    ],
    [
      { x: width - 2, y: height - 2 },
      { x: width - 3, y: height - 2 },
      { x: width - 2, y: height - 3 },
    ],
  ];

  return corners.flat();
}

/**
 * Vérifie si une case appartient à l'une des zones de sécurité du coin.
 * @param x L'indice de la colonne de la case.
 * @param y L'indice de la ligne de la case.
 * @param width La largeur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridWidth`).
 * @param height La hauteur du plateau (par défaut, `DEFAULT_GAME_CONFIG.gridHeight`).
 * 
 * Les seuls indices utilisables près des bords sont `1` et `width - 2`; c'est pourquoi
 * les zones de spawn sont décalées d'un case depuis les murs externes.
 */
export function isSafeCornerCell(
  x: number,
  y: number,
  width = DEFAULT_GAME_CONFIG.gridWidth,
  height = DEFAULT_GAME_CONFIG.gridHeight,
): boolean {
  return getSafeCornerCells(width, height).some(cell => cell.x === x && cell.y === y);
}
