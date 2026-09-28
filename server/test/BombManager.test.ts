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

function makePlayer(
  id: string,
  x: number,
  y: number,
  overrides: Partial<PlayerState> = {}
): PlayerState {
  return {
    id,
    name: id,
    position: { x, y },
    isAlive: true,
    maxBombs: 1,
    bombStock: 1,
    bombRange: 2,
    lives: 1,
    bombRechargeTicks: DEFAULT_GAME_CONFIG.bombRechargeTicks,
    nextBombRechargeTick: null,
    speed: 1,
    invulnerableUntilTick: 0,
    ...overrides,
  };
}

function createBombManager(): BombManager {
  return new BombManager(DEFAULT_GAME_CONFIG.explosionDurationTicks);
}

describe('BombManager', () => {
  it('ne place qu une bombe par case', () => {
    const bombManager = createBombManager();
    const p1 = makePlayer('p1', 3, 3, { maxBombs: 2, bombStock: 2 });

    expect(bombManager.placerBombe(p1, 10)).toBe(true);
    expect(bombManager.placerBombe(p1, 11)).toBe(false);

    expect(bombManager.getBombs()).toHaveLength(1);
    expect(bombManager.getBombs()[0].ownerId).toBe('p1');
    // La seconde tentative refusee ne doit pas consommer de stock
    expect(p1.bombStock).toBe(1);
  });

  it('déclenche une explosion et détruit un mur destructible', () => {
    const bombManager = createBombManager();
    const map = createEmptyGrid();
    const p1 = makePlayer('p1', 4, 4, { bombRange: 1 });

    map.setCell(5, 4, CellType.DESTRUCTIBLE_WALL);
    bombManager.placerBombe(p1, 10);
    bombManager.tick(10 + DEFAULT_GAME_CONFIG.bombCountdownTicks, map, new Map(), []);

    expect(bombManager.getBombs()).toHaveLength(0);
    expect(bombManager.getExplosions().length).toBeGreaterThan(0);
    expect(map.get(5, 4)).toBe(CellType.EMPTY);
  });

  it('élimine un joueur présent dans la zone d explosion', () => {
    const bombManager = createBombManager();
    const map = createEmptyGrid();
    const victime = makePlayer('p1', 5, 4);
    const players = new Map<string, PlayerState>([['p1', victime]]);

    // La bombe est posee par un autre joueur, absent de la Map des joueurs
    const poseur = makePlayer('p2', 4, 4, { bombRange: 1 });
    bombManager.placerBombe(poseur, 10);
    bombManager.tick(10 + DEFAULT_GAME_CONFIG.bombCountdownTicks, map, players, []);

    expect(players.get('p1')?.isAlive).toBe(false);
  });

  it('ne pose pas de bombe quand le stock est vide', () => {
    const bombManager = createBombManager();
    const p1 = makePlayer('p1', 3, 3, { bombStock: 0 });

    expect(bombManager.placerBombe(p1, 10)).toBe(false);
    expect(bombManager.getBombs()).toHaveLength(0);
  });

  it('ne pose pas de bombe quand le joueur est mort', () => {
    const bombManager = createBombManager();
    const p1 = makePlayer('p1', 3, 3, { isAlive: false });

    expect(bombManager.placerBombe(p1, 10)).toBe(false);
    expect(bombManager.getBombs()).toHaveLength(0);
  });

  it('consomme une bombe du stock et lance le chrono de recharge', () => {
    const bombManager = createBombManager();
    const p1 = makePlayer('p1', 3, 3);

    bombManager.placerBombe(p1, 10);

    expect(p1.bombStock).toBe(0);
    expect(p1.nextBombRechargeTick).toBe(10 + p1.bombRechargeTicks);
  });

  it('rend une bombe après bombRechargeTicks', () => {
    const bombManager = createBombManager();
    const map = createEmptyGrid();
    // Recharge (30) plus courte que la mèche (60) : le joueur n'est pas touche par sa bombe
    const p1 = makePlayer('p1', 3, 3, { bombRechargeTicks: 30 });
    const players = new Map<string, PlayerState>([['p1', p1]]);

    bombManager.placerBombe(p1, 10);
    expect(p1.bombStock).toBe(0);

    // Un tick avant l'echeance : rien n'est rendu
    bombManager.tick(39, map, players, []);
    expect(p1.bombStock).toBe(0);

    // A l'echeance : une bombe est rendue et le chrono s'arrete (stock plein)
    bombManager.tick(40, map, players, []);
    expect(p1.bombStock).toBe(1);
    expect(p1.nextBombRechargeTick).toBeNull();
  });

  it('relance le chrono tant que le stock n est pas plein', () => {
    const bombManager = createBombManager();
    const map = createEmptyGrid();
    const p1 = makePlayer('p1', 3, 3, { maxBombs: 2, bombStock: 2, bombRechargeTicks: 30 });
    const players = new Map<string, PlayerState>([['p1', p1]]);

    bombManager.placerBombe(p1, 10);
    // Deuxieme bombe sur une autre case
    p1.position = { x: 3, y: 5 };
    bombManager.placerBombe(p1, 12);
    expect(p1.bombStock).toBe(0);

    // Le joueur s'eloigne des bombes pour ne pas etre touche
    p1.position = { x: 10, y: 10 };

    bombManager.tick(40, map, players, []);
    expect(p1.bombStock).toBe(1);
    expect(p1.nextBombRechargeTick).toBe(70);

    bombManager.tick(70, map, players, []);
    expect(p1.bombStock).toBe(2);
    expect(p1.nextBombRechargeTick).toBeNull();
  });
});