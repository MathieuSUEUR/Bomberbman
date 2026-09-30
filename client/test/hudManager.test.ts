import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HudManager } from '../src/view/HudManager';
import { eventBus } from '../src/core/EventBus';

interface MockDomElement {
  tagName: string;
  className: string;
  id: string;
  innerHTML: string;
  textContent: string;
  children: MockDomElement[];
  classList: {
    add: (cls: string) => void;
    remove: (cls: string) => void;
    contains: (cls: string) => boolean;
  };
  appendChild: (child: MockDomElement) => MockDomElement;
  remove: () => void;
  querySelector: (selector: string) => { textContent: string } | MockDomElement | null;
  querySelectorAll: (selector: string) => MockDomElement[];
}

function createMockElement(tag: string): MockDomElement {
  const children: MockDomElement[] = [];
  const classList = new Set<string>();

  return {
    tagName: tag.toUpperCase(),
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    children,
    classList: {
      add: (cls: string) => {
        classList.add(cls);
      },
      remove: (cls: string) => {
        classList.delete(cls);
      },
      contains: (cls: string) => classList.has(cls),
    },
    appendChild: (child: MockDomElement) => {
      children.push(child);
      return child;
    },
    remove: () => {},
    querySelector: (selector: string) => {
      if (selector === '#hud-timer-value') return { textContent: '00:00' };
      if (selector === '#hud-score-value') return { textContent: '0' };
      if (selector === '#hud-lives-value') return { textContent: '3' };
      if (selector === '#hud-bombs-value') return { textContent: '1/1' };
      if (selector === '#hud-bomb-slots') return createMockElement('div');
      return null;
    },
    querySelectorAll: (_selector: string) => children,
  };
}

describe('HudManager - Tests de la logique et du state', () => {
  let hud: HudManager;

  beforeEach(() => {
    vi.useFakeTimers();
    (
      globalThis as unknown as { document: { createElement: (tag: string) => MockDomElement } }
    ).document = {
      createElement: (tag: string) => createMockElement(tag),
    };
    const parent = createMockElement('div');
    hud = new HudManager(parent as unknown as HTMLElement, {
      initialTimerSeconds: 0,
      initialScore: 0,
      initialBombs: 1,
      initialMaxBombs: 1,
      initialLives: 3,
      initialMaxLives: 3,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    hud.destroy();
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('devrait initialiser les données du HUD par défaut', () => {
    const data = hud.getHudData();
    expect(data.timerSeconds).toBe(0);
    expect(data.score).toBe(0);
    expect(data.availableBombs).toBe(1);
    expect(data.maxBombs).toBe(1);
    expect(data.lives).toBe(3);
    expect(data.maxLives).toBe(3);
  });

  it('devrait formater correctement le temps (mm:ss)', () => {
    expect(hud.formatTime(0)).toBe('00:00');
    expect(hud.formatTime(59)).toBe('00:59');
    expect(hud.formatTime(65)).toBe('01:05');
    expect(hud.formatTime(600)).toBe('10:00');
    expect(hud.formatTime(3599)).toBe('59:59');
  });

  it('devrait incrémenter le chronomètre avec startTimer() puis s arrêter avec stopTimer()', () => {
    hud.startTimer();
    vi.advanceTimersByTime(3000);
    expect(hud.getHudData().timerSeconds).toBe(3);

    hud.stopTimer();
    vi.advanceTimersByTime(2000);
    expect(hud.getHudData().timerSeconds).toBe(3);

    hud.resetTimer(10);
    expect(hud.getHudData().timerSeconds).toBe(10);
  });

  it('devrait mettre à jour le score manuellement et via EventBus', () => {
    hud.setScore(150);
    expect(hud.getHudData().score).toBe(150);

    hud.addScore(50);
    expect(hud.getHudData().score).toBe(200);

    eventBus.emit('HUD_UPDATE_SCORE', { score: 350 });
    expect(hud.getHudData().score).toBe(350);

    eventBus.emit('HUD_UPDATE_SCORE', { delta: 100 });
    expect(hud.getHudData().score).toBe(450);
  });

  it('devrait gérer le compteur de vies avec setLives, setMaxLives et loseLife', () => {
    hud.loseLife();
    expect(hud.getHudData().lives).toBe(2);

    hud.loseLife();
    expect(hud.getHudData().lives).toBe(1);

    hud.setLives(3);
    expect(hud.getHudData().lives).toBe(3);

    // Ne peut pas dépasser maxLives
    hud.setLives(10);
    expect(hud.getHudData().lives).toBe(3);

    // Ne peut pas être négatif
    hud.setLives(-2);
    expect(hud.getHudData().lives).toBe(0);

    eventBus.emit('HUD_UPDATE_LIVES', { lives: 2, maxLives: 4 });
    expect(hud.getHudData().maxLives).toBe(4);
    expect(hud.getHudData().lives).toBe(2);
  });

  it('devrait mettre à jour le compteur de bombes avec setBombs et setMaxBombs', () => {
    hud.setMaxBombs(3);
    expect(hud.getHudData().maxBombs).toBe(3);

    hud.setBombs(2);
    expect(hud.getHudData().availableBombs).toBe(2);

    // Ne peut pas dépasser maxBombs
    hud.setBombs(10);
    expect(hud.getHudData().availableBombs).toBe(3);

    // Ne peut pas être négatif
    hud.setBombs(-5);
    expect(hud.getHudData().availableBombs).toBe(0);

    eventBus.emit('HUD_UPDATE_BOMBS', { available: 1, max: 4 });
    expect(hud.getHudData().maxBombs).toBe(4);
    expect(hud.getHudData().availableBombs).toBe(1);
  });

  it('devrait synchroniser les données lors de la réception d un GAME_STATE_UPDATE', () => {
    const gameState = {
      tick: 400, // 400 / 20 = 20s
      grid: [[1, 0]],
      players: {
        p1: {
          id: 'p1',
          name: 'Joueur 1',
          currentBombs: 1,
          maxBombs: 3,
          score: 250,
          lives: 2,
        },
      },
    };

    hud.handleGameState(gameState);
    expect(hud.getHudData().timerSeconds).toBe(20);
    expect(hud.getHudData().maxBombs).toBe(3);
    expect(hud.getHudData().availableBombs).toBe(2); // 3 - 1 = 2
    expect(hud.getHudData().score).toBe(250);
    expect(hud.getHudData().lives).toBe(2);
  });

  it('devrait gérer la synchronisation du GAME_STATE_UPDATE avec un tableau de joueurs (mock)', () => {
    const mockState = {
      grid: [[0, 0]],
      players: [
        {
          id: 'p1',
          score: 100,
          currentBombs: 0,
          maxBombs: 2,
          isAlive: false,
        },
      ],
    };

    hud.handleGameState(mockState);
    expect(hud.getHudData().score).toBe(100);
    expect(hud.getHudData().maxBombs).toBe(2);
    expect(hud.getHudData().availableBombs).toBe(2);
    expect(hud.getHudData().lives).toBe(0);
  });
});
