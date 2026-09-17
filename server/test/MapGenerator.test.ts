import { describe, it, expect } from 'vitest';
import { CellType, DEFAULT_GAME_CONFIG, getSafeCornerCells } from '@bomberman/shared';
import { generateGrid } from '../src/map/MapGenerator.js';

describe('MapGenerator', () => {
  it('génère une grille aux dimensions attendues', () => {
    const grid = generateGrid();

    expect(grid).toHaveLength(DEFAULT_GAME_CONFIG.gridHeight);
    expect(grid[0]).toHaveLength(DEFAULT_GAME_CONFIG.gridWidth);
  });

  it('place les bordures comme murs indestructibles', () => {
    const grid = generateGrid();

    expect(grid[0][0]).toBe(CellType.INDESTRUCTIBLE_WALL);
    expect(grid[0][DEFAULT_GAME_CONFIG.gridWidth - 1]).toBe(CellType.INDESTRUCTIBLE_WALL);
    expect(grid[DEFAULT_GAME_CONFIG.gridHeight - 1][0]).toBe(CellType.INDESTRUCTIBLE_WALL);
    expect(grid[DEFAULT_GAME_CONFIG.gridHeight - 1][DEFAULT_GAME_CONFIG.gridWidth - 1]).toBe(CellType.INDESTRUCTIBLE_WALL);
  });

  it('laisse vides les zones de sécurité des coins', () => {
    const grid = generateGrid();

    for (const cell of getSafeCornerCells()) {
      expect(grid[cell.y][cell.x]).not.toBe(CellType.DESTRUCTIBLE_WALL);
    }
  });
});
