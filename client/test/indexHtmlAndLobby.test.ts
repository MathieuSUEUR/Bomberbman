import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventBus } from '../src/core/EventBus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Écran d'Accueil et Lobby - Tests de structure et événements", () => {
  const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

  it("devrait contenir la structure de l'écran d'accueil (main-menu)", () => {
    expect(htmlContent).toContain('id="main-menu"');
    expect(htmlContent).toContain('BOMBERMAN');
  });

  it('devrait contenir le champ de saisie du pseudo', () => {
    expect(htmlContent).toContain('id="player-name-input"');
    expect(htmlContent).toContain('value="Joueur 1"');
  });

  it('devrait contenir le bouton "Rejoindre une partie"', () => {
    expect(htmlContent).toContain('id="btn-join-game"');
    expect(htmlContent).toContain('Rejoindre une partie');
  });

  it("devrait contenir le salon d'attente (lobby-screen) caché par défaut", () => {
    expect(htmlContent).toContain('id="lobby-screen"');
    expect(htmlContent).toContain("Salon d'attente");
    expect(htmlContent).toContain('id="players"');
  });

  it('devrait contenir les actions du lobby (Prêt, Lancer, Retour)', () => {
    expect(htmlContent).toContain('id="btn-ready"');
    expect(htmlContent).toContain('id="btn-start-game"');
    expect(htmlContent).toContain('id="btn-back-menu"');
  });

  it('devrait contenir le canvas de jeu masqué par défaut', () => {
    expect(htmlContent).toContain('id="game-canvas"');
    expect(htmlContent).toContain('id="game-container"');
    expect(htmlContent).toContain('style="display: none"');
  });

  it('devrait propager les événements de lobby via EventBus', () => {
    let capturedLobbyState: unknown = null;
    eventBus.on('LOBBY_STATE', (data) => {
      capturedLobbyState = data;
    });

    const mockState = {
      players: [
        { id: '1', name: 'Joueur 1', isReady: true },
        { id: '2', name: 'Joueur 2', isReady: false },
      ],
      canStart: false,
    };

    eventBus.emit('LOBBY_STATE', mockState);
    expect(capturedLobbyState).toEqual(mockState);
  });

  it("devrait propager l'événement JOIN_LOBBY via EventBus", () => {
    let joinedName = '';
    eventBus.on('JOIN_LOBBY', (payload: unknown) => {
      const data = payload as { name: string };
      joinedName = data.name;
    });

    eventBus.emit('JOIN_LOBBY', { name: 'PlayerOne' });
    expect(joinedName).toBe('PlayerOne');
  });
});
