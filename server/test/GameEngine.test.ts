import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/Engine/GameEngine.js';

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
});
