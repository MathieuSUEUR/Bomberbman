import { describe, it, expect } from 'vitest';
import {
  CellType,
  DEFAULT_GAME_CONFIG,
  PlayerState,
} from '@bomberman/shared';
import { Map as GameMap } from '../src/map/Map.js';
import { BombManager } from '../src/rules/BombManager.js';

function createEmptyGrid(): GameMap {
  const grid = Array.from({ length: DEFAULT_GAME_CONFIG.gridHeight }, () =>
    Array.from({ length: DEFAULT_GAME_CONFIG.gridWidth }, () => CellType.EMPTY)
  );

  for (let y = 0; y < DEFAULT_GAME_CONFIG.gridHeight; y++) {
    for (let x = 0; x < DEFAULT_GAME_CONFIG.gridWidth; x++) {
      if (x === 0 || x === DEFAULT_GAME_CONFIG.gridWidth - 1 || y === 0 || y === DEFAULT_GAME_CONFIG.gridHeight - 1) {
        grid[y][x] = CellType.INDESTRUCTIBLE_WALL;
      }
    }
  }

  return new GameMap(grid);
}

describe('BombManager', () => {
  it('ne place qu une bombe par case', () => {
    const bombManager = new BombManager(
      DEFAULT_GAME_CONFIG.bombCountdownTicks,
      DEFAULT_GAME_CONFIG.explosionDurationTicks
    );

    bombManager.placerBombe('p1', 3, 3, 2, 10);
    bombManager.placerBombe('p1', 3, 3, 2, 11);

    expect(bombManager.getBombs()).toHaveLength(1);
    expect(bombManager.getBombs()[0].ownerId).toBe('p1');
  });

  it('déclenche une explosion et détruit un mur destructible', () => {
    const bombManager = new BombManager(
      DEFAULT_GAME_CONFIG.bombCountdownTicks,
      DEFAULT_GAME_CONFIG.explosionDurationTicks
    );
    const map = createEmptyGrid();

    map.setCell(5, 4, CellType.DESTRUCTIBLE_WALL);
    bombManager.placerBombe('p1', 4, 4, 1, 10);
    bombManager.tick(10 + DEFAULT_GAME_CONFIG.bombCountdownTicks, map, new Map());

    expect(bombManager.getBombs()).toHaveLength(0);
    expect(bombManager.getExplosions().length).toBeGreaterThan(0);
    expect(map.get(5, 4)).toBe(CellType.EMPTY);
  });

  it('élimine un joueur présent dans la zone d explosion', () => {
    const bombManager = new BombManager(
      DEFAULT_GAME_CONFIG.bombCountdownTicks,
      DEFAULT_GAME_CONFIG.explosionDurationTicks
    );
    const map = createEmptyGrid();
    const players = new Map<string, PlayerState>([
      [
        'p1',
        {
          id: 'p1',
          name: 'Alice',
          position: { x: 5, y: 4 },
          isAlive: true,
          maxBombs: 1,
          currentBombs: 0,
          bombRange: 2,
          speed: 1,
        },
      ],
    ]);

    bombManager.placerBombe('p2', 4, 4, 1, 10);
    bombManager.tick(10 + DEFAULT_GAME_CONFIG.bombCountdownTicks, map, players);

    expect(players.get('p1')?.isAlive).toBe(false);
  });
});
