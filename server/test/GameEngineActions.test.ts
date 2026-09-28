import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CellType,
  DEFAULT_GAME_CONFIG,
  LobbyPlayer,
  PlayerState,
  BombExplodedPayload,
} from '@bomberman/shared';
import { GameEngine } from '../src/engine/GameEngine.js';

describe('GameEngine - Tests unitaires et intégration des actions', () => {
  let engine: GameEngine;

  const defaultPlayers: LobbyPlayer[] = [
    { id: 'p1', name: 'Alice', isReady: true },
    { id: 'p2', name: 'Bob', isReady: true },
  ];

  beforeEach(() => {
    engine = new GameEngine();
    engine.initPlayers(defaultPlayers);
    // On coupe la boucle automatique pour contrôler précisément les ticks manuellement
    engine.stopGameLoop();
  });

  afterEach(() => {
    engine.stopGameLoop();
  });

  const getPlayer = (id: string): PlayerState => {
    const player = engine.obtenirEtatActuel().players[id];
    if (!player) {
      throw new Error(`Joueur ${id} non trouvé`);
    }
    return player;
  };

  const getInternalPlayers = (): Map<string, PlayerState> => {
    return (engine as unknown as { players: Map<string, PlayerState> }).players;
  };

  const setCell = (x: number, y: number, cellType: CellType): void => {
    engine.obtenirEtatActuel().grid[y][x] = cellType;
  };

  describe('Déplacement des joueurs (Unitaires)', () => {
    it('devrait déplacer le joueur vers le bas (MOVE_DOWN) sur une case vide', () => {
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
      setCell(1, 2, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 2 });
    });

    it('devrait déplacer le joueur vers la droite (MOVE_RIGHT) sur une case vide', () => {
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
      setCell(2, 1, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_RIGHT' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 2, y: 1 });
    });

    it('devrait déplacer le joueur vers le haut (MOVE_UP) depuis une position intermédiaire', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.position = { x: 1, y: 2 };
      setCell(1, 1, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_UP' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });

    it('devrait déplacer le joueur vers la gauche (MOVE_LEFT) depuis une position intermédiaire', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.position = { x: 2, y: 1 };
      setCell(1, 1, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_LEFT' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });

    it('ne devrait pas déplacer le joueur contre un mur indestructible de bordure', () => {
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });

      // Vers le haut : y=0 est la bordure supérieure
      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_UP' });
      engine.tick();
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });

      // Vers la gauche : x=0 est la bordure gauche
      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_LEFT' });
      engine.tick();
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });

    it('ne devrait pas déplacer le joueur sur un mur destructible', () => {
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
      setCell(2, 1, CellType.DESTRUCTIBLE_WALL);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_RIGHT' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });

    it('devrait respecter la vitesse (speed) du joueur', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.speed = 2;
      setCell(1, 2, CellType.EMPTY);
      setCell(1, 3, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.tick();

      // De y=1 avec speed 2 -> y=3
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 3 });
    });

    it('ne devrait pas déplacer un joueur éliminé (isAlive: false)', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.isAlive = false;
      setCell(1, 2, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });

    it('devrait ignorer silencieusement une action pour un joueur inexistant', () => {
      expect(() => {
        engine.ajouterAction({ playerId: 'inconnu', actionType: 'MOVE_DOWN' });
        engine.tick();
      }).not.toThrow();
    });

    it('ne devrait pas bouger si la direction demandée est inconnue', () => {
      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_TELEPORT' as unknown as 'MOVE_UP' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 1 });
    });
  });

  describe('Pose de bombes (Unitaires)', () => {
    it('devrait poser une bombe sur la case actuelle et incrémenter currentBombs', () => {
      expect(getPlayer('p1').currentBombs).toBe(0);
      expect(engine.obtenirEtatActuel().bombs).toHaveLength(0);

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      const etat = engine.obtenirEtatActuel();
      expect(etat.bombs).toHaveLength(1);
      expect(etat.bombs[0].ownerId).toBe('p1');
      expect(etat.bombs[0].position).toEqual({ x: 1, y: 1 });
      expect(getPlayer('p1').currentBombs).toBe(1);
    });

    it('ne devrait pas poser de bombe si le joueur a atteint son maxBombs', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.currentBombs = 1;
      p1.maxBombs = 1;

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      expect(engine.obtenirEtatActuel().bombs).toHaveLength(0);
      expect(getPlayer('p1').currentBombs).toBe(1);
    });

    it('ne devrait pas poser une deuxième bombe sur la même case', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.maxBombs = 2;

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();
      expect(engine.obtenirEtatActuel().bombs).toHaveLength(1);

      // Deuxième tentative sur la même case (1, 1)
      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      expect(engine.obtenirEtatActuel().bombs).toHaveLength(1);
      expect(getPlayer('p1').currentBombs).toBe(1);
    });

    it('ne devrait pas poser de bombe si la case du joueur n est pas vide', () => {
      setCell(1, 1, CellType.INDESTRUCTIBLE_WALL);

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      expect(engine.obtenirEtatActuel().bombs).toHaveLength(0);
      expect(getPlayer('p1').currentBombs).toBe(0);
    });

    it('ne devrait pas permettre à un joueur éliminé de poser une bombe', () => {
      const p1 = getInternalPlayers().get('p1')!;
      p1.isAlive = false;

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      expect(engine.obtenirEtatActuel().bombs).toHaveLength(0);
      expect(getPlayer('p1').currentBombs).toBe(0);
    });
  });

  describe('Gestion de la file d actions (Intégration)', () => {
    it('ne devrait autoriser qu un seul déplacement par joueur par tick', () => {
      setCell(1, 2, CellType.EMPTY);
      setCell(2, 2, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_RIGHT' });
      engine.tick();

      // Seul le premier déplacement vers le bas (1, 2) est exécuté durant ce tick
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 2 });
    });

    it('devrait vider la file après le tick et ne pas ré-exécuter les actions', () => {
      setCell(1, 2, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.tick();
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 2 });

      // Deuxième tick sans nouvelle action : la position ne doit pas changer
      engine.tick();
      expect(getPlayer('p1').position).toEqual({ x: 1, y: 2 });
    });

    it('devrait traiter les actions simultanées de plusieurs joueurs', () => {
      setCell(1, 2, CellType.EMPTY);
      // p2 spawn en (gridWidth - 2, 1)
      const p2InitialPos = { ...getPlayer('p2').position };
      setCell(p2InitialPos.x, p2InitialPos.y + 1, CellType.EMPTY);

      engine.ajouterAction({ playerId: 'p1', actionType: 'MOVE_DOWN' });
      engine.ajouterAction({ playerId: 'p2', actionType: 'MOVE_DOWN' });
      engine.tick();

      expect(getPlayer('p1').position).toEqual({ x: 1, y: 2 });
      expect(getPlayer('p2').position).toEqual({ x: p2InitialPos.x, y: p2InitialPos.y + 1 });
    });
  });

  describe('Cycle de vie de la bombe et déflagration (Intégration)', () => {
    it('devrait faire exploser la bombe après le compte à rebours et émettre bombExploded', () => {
      let explodedEventReceived: BombExplodedPayload | null = null;
      engine.on('bombExploded', (payload: BombExplodedPayload) => {
        explodedEventReceived = payload;
      });

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick(); // Tick 1 : pose la bombe

      expect(engine.obtenirEtatActuel().bombs).toHaveLength(1);

      // Avancer jusqu'au tick d'explosion
      const countdown = DEFAULT_GAME_CONFIG.bombCountdownTicks;
      for (let i = 0; i < countdown - 1; i++) {
        engine.tick();
      }

      // La bombe ne doit pas encore avoir explosé
      expect(explodedEventReceived).toBeNull();
      expect(engine.obtenirEtatActuel().bombs).toHaveLength(1);

      // Tick final déclenchant l'explosion
      engine.tick();

      expect(explodedEventReceived).not.toBeNull();
      const payload = explodedEventReceived as unknown as BombExplodedPayload;
      expect(payload.ownerId).toBe('p1');
      expect(payload.position).toEqual({ x: 1, y: 1 });
      expect(engine.obtenirEtatActuel().bombs).toHaveLength(0);
      expect(engine.obtenirEtatActuel().explosions.length).toBeGreaterThan(0);
    });

    it('devrait détruire les murs destructibles dans le rayon de déflagration', () => {
      setCell(1, 2, CellType.DESTRUCTIBLE_WALL);

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick(); // pose la bombe en (1, 1)

      const countdown = DEFAULT_GAME_CONFIG.bombCountdownTicks;
      for (let i = 0; i < countdown; i++) {
        engine.tick();
      }

      // Le mur destructible en (1, 2) a été détruit par l'explosion et devient EMPTY
      expect(engine.obtenirEtatActuel().grid[2][1]).toBe(CellType.EMPTY);
    });

    it('devrait éliminer un joueur situé dans le souffle et émettre playerEliminated', () => {
      let eliminatedPlayerId: string | null = null;
      engine.on('playerEliminated', (data: { playerId: string }) => {
        eliminatedPlayerId = data.playerId;
      });

      // Placer p2 à proximité en (1, 2)
      const p2 = getInternalPlayers().get('p2')!;
      p2.position = { x: 1, y: 2 };
      setCell(1, 2, CellType.EMPTY);

      // p1 pose une bombe en (1, 1)
      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      const countdown = DEFAULT_GAME_CONFIG.bombCountdownTicks;
      for (let i = 0; i < countdown; i++) {
        engine.tick();
      }

      expect(eliminatedPlayerId).toBe('p2');
      expect(getPlayer('p2').isAlive).toBe(false);
    });

    it('devrait éliminer le joueur lui-même s il reste sur sa propre bombe (suicide)', () => {
      let eliminatedPlayerId: string | null = null;
      engine.on('playerEliminated', (data: { playerId: string }) => {
        eliminatedPlayerId = data.playerId;
      });

      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      const countdown = DEFAULT_GAME_CONFIG.bombCountdownTicks;
      for (let i = 0; i < countdown; i++) {
        engine.tick();
      }

      expect(eliminatedPlayerId).toBe('p1');
      expect(getPlayer('p1').isAlive).toBe(false);
    });

    it('devrait éliminer un joueur qui se déplace sur une case où une explosion est active', () => {
      let eliminatedPlayerId: string | null = null;
      engine.on('playerEliminated', (data: { playerId: string }) => {
        eliminatedPlayerId = data.playerId;
      });

      // p1 pose une bombe en (1, 1)
      engine.ajouterAction({ playerId: 'p1', actionType: 'PLACE_BOMB' });
      engine.tick();

      // On avance jusqu'au tick où la bombe explose
      const countdown = DEFAULT_GAME_CONFIG.bombCountdownTicks;
      for (let i = 0; i < countdown; i++) {
        engine.tick();
      }

      // La case (1, 2) est en flammes (explosion active)
      expect(engine.obtenirEtatActuel().explosions.some(e => e.position.x === 1 && e.position.y === 2)).toBe(true);

      // p2 spawn en (gridWidth - 2, 1), on le place en (2, 2) avec cases vides
      setCell(2, 2, CellType.EMPTY);
      setCell(1, 2, CellType.EMPTY);
      const p2 = getInternalPlayers().get('p2')!;
      p2.position = { x: 2, y: 2 };

      // p2 se déplace vers la gauche sur (1, 2) dans les flammes actives
      engine.ajouterAction({ playerId: 'p2', actionType: 'MOVE_LEFT' });
      engine.tick();

      // p2 doit avoir été éliminé et l'événement playerEliminated émis
      expect(eliminatedPlayerId).toBe('p2');
      expect(getPlayer('p2').isAlive).toBe(false);
    });
  });

  describe('Boucle de jeu et émission d état (Intégration)', () => {
    it('devrait émettre un événement tick à chaque intervalle de la boucle de jeu', async () => {
      engine.startGameLoop();

      const stateReceived = await new Promise((resolve) => {
        engine.once('tick', (state) => {
          resolve(state);
        });
      });

      expect(stateReceived).toBeDefined();
      expect((stateReceived as { status: string }).status).toBe('IN_PROGRESS');
      engine.stopGameLoop();
    });

    it('devrait fournir un état complet et cohérent via obtenirEtatActuel()', () => {
      const state = engine.obtenirEtatActuel();

      expect(state.status).toBe('IN_PROGRESS');
      expect(state.tick).toBe(0);
      expect(state.grid.length).toBe(DEFAULT_GAME_CONFIG.gridHeight);
      expect(state.grid[0].length).toBe(DEFAULT_GAME_CONFIG.gridWidth);
      expect(Object.keys(state.players)).toHaveLength(2);
      expect(state.bombs).toEqual([]);
      expect(state.explosions).toEqual([]);
    });
  });
});
