import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_GAME_CONFIG, getSafeCornerCells, getSpawnPositions, isSafeCornerCell } from '@bomberman/shared';
import { GameEngine } from '../src/engine/GameEngine.js';

describe('GameEngine - Tests unitaires primitifs', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('devrait initialiser le moteur avec un statut WAITING et un tick à 0', () => {
    const etat = engine.obtenirEtatActuel();
    expect(etat.tick).toBe(0);
    expect(etat.status).toBe('WAITING');
    expect(etat.players).toEqual({});
    expect(etat.bombs).toEqual([]);
    expect(etat.explosions).toEqual([]);
  });

  it('devrait incrémenter le tick lors de l appel à tick()', () => {
    const etat = engine.tick();
    expect(etat.tick).toBe(1);
  });

  it('devrait accepter l ajout d actions dans la file', () => {
    expect(() => {
      engine.ajouterAction({
        playerId: 'p1',
        actionType: 'MOVE_UP',
      });
    }).not.toThrow();
  });

  it('devrait exposer les règles de plateau dans le package partagé', () => {
    expect(getSpawnPositions()).toEqual([
      { x: 1, y: 1 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: 1 },
      { x: 1, y: DEFAULT_GAME_CONFIG.gridHeight - 2 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: DEFAULT_GAME_CONFIG.gridHeight - 2 }
    ]);

    expect(getSafeCornerCells()).toContainEqual({ x: 1, y: 1 });
    expect(getSafeCornerCells()).toContainEqual({ x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: 1 });
    expect(isSafeCornerCell(2, 1, DEFAULT_GAME_CONFIG.gridWidth, DEFAULT_GAME_CONFIG.gridHeight)).toBe(true);
    expect(isSafeCornerCell(3, 3, DEFAULT_GAME_CONFIG.gridWidth, DEFAULT_GAME_CONFIG.gridHeight)).toBe(false);
  });

  it('devrait initialiser les joueurs sur des spawn calculés depuis la configuration partagée', () => {
    const lobbyPlayers = [
      { id: 'p1', name: 'Alice', isReady: true },
      { id: 'p2', name: 'Bob', isReady: true },
      { id: 'p3', name: 'Charlie', isReady: true },
      { id: 'p4', name: 'Diana', isReady: true }
    ];

    engine.initPlayers(lobbyPlayers);

    expect(Object.values(engine.obtenirEtatActuel().players).map(player => player.position)).toEqual([
      { x: 1, y: 1 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: 1 },
      { x: 1, y: DEFAULT_GAME_CONFIG.gridHeight - 2 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: DEFAULT_GAME_CONFIG.gridHeight - 2 }
    ]);
  });
});
