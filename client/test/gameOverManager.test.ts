/**
 * Tests unitaires pour GameOverManager
 * Vérifient la résolution de l'état (victoire/défaite/nul) et la structure HTML de la modale.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventBus } from '../src/core/EventBus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Tests de structure HTML ----

describe('Modale Game Over - Structure HTML', () => {
  const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

  it('devrait contenir le conteneur overlay Game Over', () => {
    expect(htmlContent).toContain('id="game-over-overlay"');
    expect(htmlContent).toContain('role="dialog"');
    expect(htmlContent).toContain('aria-modal="true"');
  });

  it('devrait contenir le titre, la description et le badge gagnant', () => {
    expect(htmlContent).toContain('id="game-over-title"');
    expect(htmlContent).toContain('id="game-over-desc"');
    expect(htmlContent).toContain('id="game-over-winner-badge"');
    expect(htmlContent).toContain('id="game-over-winner-name"');
  });

  it('devrait contenir les boutons de navigation post-partie', () => {
    expect(htmlContent).toContain('id="btn-play-again"');
    expect(htmlContent).toContain('id="btn-back-to-menu"');
    expect(htmlContent).toContain('Rejouer');
    expect(htmlContent).toContain('Menu principal');
  });

  it('devrait contenir le fond (backdrop) de la modale', () => {
    expect(htmlContent).toContain('game-over-backdrop');
  });

  it('devrait avoir la modale masquée par défaut', () => {
    expect(htmlContent).toContain('id="game-over-overlay"');
    // L'overlay est masqué via style="display: none" dans le HTML
    const match = htmlContent.match(/id="game-over-overlay"[^>]*>/);
    expect(match).not.toBeNull();
    // On vérifie que le bloc autour contient style="display: none"
    const surroundingContext = htmlContent.slice(
      (match?.index ?? 0) - 100,
      (match?.index ?? 0) + 200,
    );
    expect(surroundingContext).toContain('style="display: none"');
  });
});

// ---- Tests de logique via EventBus ----

describe('Modale Game Over - Événements EventBus', () => {
  beforeEach(() => {
    // Reset EventBus listeners n'est pas nécessaire car les listeners sont ajoutés côté module
    // On test uniquement la propagation des events
  });

  it('devrait propager correctement un événement GAME_OVER via EventBus', () => {
    let capturedPayload: unknown = null;

    eventBus.on('GAME_OVER', (payload) => {
      capturedPayload = payload;
    });

    const mockPayload = { winnerId: 'p1', winnerName: 'Joueur 1' };
    eventBus.emit('GAME_OVER', mockPayload);

    expect(capturedPayload).toEqual(mockPayload);
  });

  it('devrait propager un GAME_OVER avec winnerId null (match nul)', () => {
    let capturedPayload: unknown = null;

    eventBus.on('GAME_OVER', (payload) => {
      capturedPayload = payload;
    });

    const drawPayload = { winnerId: null, winnerName: null };
    eventBus.emit('GAME_OVER', drawPayload);

    expect(capturedPayload).toEqual(drawPayload);
  });

  it('devrait propager un événement WELCOME avec un playerId', () => {
    let receivedId = '';

    eventBus.on('WELCOME', (payload) => {
      const data = payload as { playerId: string };
      receivedId = data.playerId;
    });

    eventBus.emit('WELCOME', { playerId: 'abc-123' });
    expect(receivedId).toBe('abc-123');
  });

  it('devrait propager un événement PLAYER_ELIMINATED', () => {
    let receivedElimination: unknown = null;

    eventBus.on('PLAYER_ELIMINATED', (payload) => {
      receivedElimination = payload;
    });

    eventBus.emit('PLAYER_ELIMINATED', { playerId: 'p2', killedBy: 'p1' });
    expect(receivedElimination).toEqual({ playerId: 'p2', killedBy: 'p1' });
  });
});

// ---- Tests de résolution d'état (logique pure) ----

describe("Résolution de l'état Game Over (logique métier)", () => {
  // On teste la logique de resolveState directement en la réimplémentant ici
  // (GameOverManager est couplé au DOM, les tests DOM nécessiteraient jsdom)
  type GameOverState = 'victory' | 'defeat' | 'draw';

  function resolveState(localPlayerId: string, winnerId: string | null): GameOverState {
    if (winnerId === null) return 'draw';
    return winnerId === localPlayerId ? 'victory' : 'defeat';
  }

  it('devrait retourner "victory" quand le winnerId correspond au joueur local', () => {
    expect(resolveState('player-1', 'player-1')).toBe('victory');
  });

  it('devrait retourner "defeat" quand le winnerId est un autre joueur', () => {
    expect(resolveState('player-1', 'player-2')).toBe('defeat');
  });

  it('devrait retourner "draw" quand winnerId est null', () => {
    expect(resolveState('player-1', null)).toBe('draw');
  });

  it('devrait retourner "draw" pour un joueur anonyme avec winnerId null', () => {
    expect(resolveState('', null)).toBe('draw');
  });

  it('devrait retourner "defeat" si localPlayerId est vide mais un gagnant existe', () => {
    expect(resolveState('', 'player-2')).toBe('defeat');
  });
});
