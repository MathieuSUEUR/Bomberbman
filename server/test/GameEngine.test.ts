import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_GAME_CONFIG, getSafeCornerCells, getSpawnPositions, isSafeCornerCell, CellType } from '@bomberman/shared';
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

    expect(Object.values(engine.obtenirEtatActuel().players).map((player: any) => player.position)).toEqual([      { x: 1, y: 1 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: 1 },
      { x: 1, y: DEFAULT_GAME_CONFIG.gridHeight - 2 },
      { x: DEFAULT_GAME_CONFIG.gridWidth - 2, y: DEFAULT_GAME_CONFIG.gridHeight - 2 }
    ]);
  });
});

describe('GameEngine - Mort Subite (Sudden Death)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    // Le joueur 1 va spawn en (1, 1) grâce à getSpawnPositions()
    engine.initPlayers([{ id: 'p1', name: 'Alice', isReady: true }]);
  });

  it('ne devrait générer aucun bloc avant la fin du temps réglementaire', () => {
    for (let i = 0; i < DEFAULT_GAME_CONFIG.gameDurationTicks; i++) {
      engine.tick();
    }
    
    const etat = engine.obtenirEtatActuel();
    // La case (1, 1) ne doit pas être un mur indestructible
    expect(etat.grid[1][1]).not.toBe(CellType.INDESTRUCTIBLE_WALL);
  });

  it('devrait générer exactement n blocs en spirale selon le temps dépassé', () => {
    const ticksAvantSD = DEFAULT_GAME_CONFIG.gameDurationTicks;
    const intervalle = DEFAULT_GAME_CONFIG.suddenDeathDropIntervalTicks;
    
    // On vise le dépôt de 3 blocs
    const ticksVises = ticksAvantSD + (intervalle * 3);
    
    for (let i = 0; i < ticksVises; i++) {
      engine.tick();
    }
    
    const etat = engine.obtenirEtatActuel();
    
    // Attention, dans map.getGrid(), l'accès est grid[y][x]
    // La spirale part du haut, de gauche à droite : (1,1), (2,1), (3,1)
    expect(etat.grid[1][1]).toBe(CellType.INDESTRUCTIBLE_WALL);
    expect(etat.grid[1][2]).toBe(CellType.INDESTRUCTIBLE_WALL);
    expect(etat.grid[1][3]).toBe(CellType.INDESTRUCTIBLE_WALL);
    
    // Le 4ème bloc (4,1) ne doit pas encore y être
    expect(etat.grid[1][4]).not.toBe(CellType.INDESTRUCTIBLE_WALL);
  });

  it('devrait éliminer un joueur se trouvant sur la case d un bloc qui tombe', () => {
    const ticksAvantSD = DEFAULT_GAME_CONFIG.gameDurationTicks;
    const intervalle = DEFAULT_GAME_CONFIG.suddenDeathDropIntervalTicks;
    
    // On fait avancer jusqu'à la chute du premier bloc (qui tombe en 1,1)
    const ticksPour1Bloc = ticksAvantSD + intervalle;
    
    for (let i = 0; i < ticksPour1Bloc; i++) {
      engine.tick();
    }
    
    const etat = engine.obtenirEtatActuel();
    // Le joueur n'a pas bougé de (1,1), il doit être mort
    expect(etat.players['p1'].isAlive).toBe(false);
  });
});
