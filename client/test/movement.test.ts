import { describe, it, expect } from 'vitest';
import { calculateMovementDelta } from '../src/core/movement.js';

describe('calculateMovementDelta - Déplacements et vitesse constante', () => {
  const speed = 0.08;

  it('devrait retourner un déplacement nul si aucune direction active', () => {
    const active = new Set<string>();
    const delta = calculateMovementDelta(active, speed);

    expect(delta.dx).toBe(0);
    expect(delta.dy).toBe(0);
    expect(delta.direction).toBeUndefined();
  });

  it('devrait retourner un déplacement nul si directions opposées s annulent', () => {
    const active = new Set<string>(['LEFT', 'RIGHT']);
    const delta = calculateMovementDelta(active, speed);

    expect(delta.dx).toBe(0);
    expect(delta.dy).toBe(0);
  });

  it('devrait se déplacer à la bonne vitesse pour les 4 directions cardinales', () => {
    // HAUT
    const up = calculateMovementDelta(new Set(['UP']), speed);
    expect(up.dx).toBeCloseTo(0);
    expect(up.dy).toBeCloseTo(-speed);
    expect(up.direction).toBe('UP');

    // BAS
    const down = calculateMovementDelta(new Set(['DOWN']), speed);
    expect(down.dx).toBeCloseTo(0);
    expect(down.dy).toBeCloseTo(speed);
    expect(down.direction).toBe('DOWN');

    // GAUCHE
    const left = calculateMovementDelta(new Set(['LEFT']), speed);
    expect(left.dx).toBeCloseTo(-speed);
    expect(left.dy).toBeCloseTo(0);
    expect(left.direction).toBe('LEFT');

    // DROITE
    const right = calculateMovementDelta(new Set(['RIGHT']), speed);
    expect(right.dx).toBeCloseTo(speed);
    expect(right.dy).toBeCloseTo(0);
    expect(right.direction).toBe('RIGHT');
  });

  it('ne devrait PAS accélérer lors d un déplacement en diagonale (norme du vecteur égale à speed)', () => {
    const diagonals = [
      ['UP', 'RIGHT'],
      ['UP', 'LEFT'],
      ['DOWN', 'RIGHT'],
      ['DOWN', 'LEFT'],
    ];

    for (const dirs of diagonals) {
      const delta = calculateMovementDelta(new Set(dirs), speed);
      const totalSpeed = Math.hypot(delta.dx, delta.dy);

      // Sans normalisation, totalSpeed vaudrait speed * sqrt(2) ≈ 0.1131 (boost de +41.4%)
      // Avec normalisation, totalSpeed doit être exactement égal à speed (0.08)
      expect(totalSpeed).toBeCloseTo(speed, 5);
      expect(Math.abs(delta.dx)).toBeCloseTo(speed / Math.SQRT2, 5);
      expect(Math.abs(delta.dy)).toBeCloseTo(speed / Math.SQRT2, 5);
    }
  });

  it('devrait préserver une direction valide en diagonale', () => {
    const delta = calculateMovementDelta(new Set(['UP', 'RIGHT']), speed);
    expect(['UP', 'RIGHT']).toContain(delta.direction);
  });
});
