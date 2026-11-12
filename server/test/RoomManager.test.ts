import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { RoomManager } from '../src/network/RoomManager.js';
import { Room } from '../src/network/Room.js';
import { GameEngine } from '../src/engine/GameEngine.js';

describe('Room - Tests unitaires de la classe Room', () => {
  let room: Room;
  let mockWs: WebSocket;
  let sentData: string[];

  beforeEach(() => {
    sentData = [];
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn((data: string) => {
        sentData.push(data);
      })
    } as unknown as WebSocket;

    room = new Room('test-room', 'Salle de test');
  });

  afterEach(() => {
    room.destroy();
  });

  it('devrait initialiser correctement la salle avec valeurs par défaut ou personnalisées', () => {
    expect(room.id).toBe('test-room');
    expect(room.name).toBe('Salle de test');
    expect(room.isPermanent).toBe(false);
    expect(room.maxPlayers).toBe(4);
    expect(room.isEmpty()).toBe(true);
    expect(room.canJoin()).toBe(true);

    const defaultRoom = new Room('default');
    expect(defaultRoom.name).toBe('Salon Principal');

    const randomRoom = new Room('ABC');
    expect(randomRoom.name).toBe('Salon ABC');
  });

  it('devrait ajouter un joueur et diffuser le LOBBY_STATE', () => {
    const added = room.addPlayer('p1', mockWs, 'Alice');
    expect(added).toBe(true);
    expect(room.getLobbyPlayers().length).toBe(1);
    expect(room.isEmpty()).toBe(false);

    expect(mockWs.send).toHaveBeenCalled();
    const lastMsg = JSON.parse(sentData[sentData.length - 1]);
    expect(lastMsg.type).toBe('LOBBY_STATE');
    expect(lastMsg.payload.roomId).toBe('test-room');
    expect(lastMsg.payload.players[0].name).toBe('Alice');
  });

  it('devrait refuser addPlayer si canJoin est faux', () => {
    const fullRoom = new Room('full', 'Pleine', new GameEngine(), false, 1);
    expect(fullRoom.addPlayer('p1', mockWs, 'Alice')).toBe(true);
    // 2ème joueur alors que maxPlayers = 1 -> canJoin est faux
    expect(fullRoom.addPlayer('p2', mockWs, 'Bob')).toBe(false);
  });

  it('devrait retirer un joueur et mettre à jour le lobby', () => {
    room.addPlayer('p1', mockWs, 'Alice');
    room.removePlayer('p1');
    expect(room.getLobbyPlayers().length).toBe(0);
    expect(room.isEmpty()).toBe(true);
  });

  it('devrait déconnecter le joueur du GameEngine si une partie est en cours lors du retrait', () => {
    const engine = room.engine;
    // Forcer le status en IN_PROGRESS
    (engine as unknown as { status: string }).status = 'IN_PROGRESS';
    const spyDeconnecter = vi.spyOn(engine, 'deconnecterJoueur');

    room.addPlayer('p1', mockWs, 'Alice');
    room.removePlayer('p1');

    expect(spyDeconnecter).toHaveBeenCalledWith('p1');
  });

  it('devrait modifier l état prêt d un joueur et tenter de lancer la partie', () => {
    room.addPlayer('p1', mockWs, 'Alice');
    room.setPlayerReady('p1', true);
    expect(room.getLobbyPlayers()[0].isReady).toBe(true);

    // Joueur inconnu : ne doit rien faire
    room.setPlayerReady('unknown', true);
  });

  it('devrait lancer la partie quand 2 joueurs sont prêts', () => {
    const ws2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn()
    } as unknown as WebSocket;

    room.addPlayer('p1', mockWs, 'Alice');
    room.addPlayer('p2', ws2, 'Bob');

    room.setPlayerReady('p1', true);
    expect(room.engine.obtenirEtatActuel().status).toBe('WAITING');

    room.setPlayerReady('p2', true);
    expect(room.engine.obtenirEtatActuel().status).toBe('IN_PROGRESS');
  });

  it('devrait réinitialiser l engine si checkGameStart est déclenché après FINISHED', () => {
    const ws2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn()
    } as unknown as WebSocket;

    room.addPlayer('p1', mockWs, 'Alice');
    room.addPlayer('p2', ws2, 'Bob');

    (room.engine as unknown as { status: string }).status = 'FINISHED';
    const spyReset = vi.spyOn(room.engine, 'reset');

    room.setPlayerReady('p1', true);
    room.setPlayerReady('p2', true);

    expect(spyReset).toHaveBeenCalled();
  });

  it('devrait transmettre les actions au GameEngine', () => {
    const spyAction = vi.spyOn(room.engine, 'ajouterAction');
    room.handleAction('p1', 'MOVE_UP');
    expect(spyAction).toHaveBeenCalledWith({ playerId: 'p1', actionType: 'MOVE_UP' });
  });

  it('devrait propager les événements du GameEngine aux clients', () => {
    room.addPlayer('p1', mockWs, 'Alice');
    sentData = [];

    room.engine.emit('bombExploded', { bombId: 'b1', x: 1, y: 1, affectedCells: [] });
    expect(sentData.some((d) => JSON.parse(d).type === 'BOMB_EXPLODED')).toBe(true);

    room.engine.emit('playerEliminated', { playerId: 'p1' });
    expect(sentData.some((d) => JSON.parse(d).type === 'PLAYER_ELIMINATED')).toBe(true);

    room.engine.emit('gameOver', { winnerId: 'p1', winnerName: 'Alice', scores: [] });
    expect(sentData.some((d) => JSON.parse(d).type === 'GAME_OVER')).toBe(true);
  });

  it('devrait ignorer l envoi de messages si le WebSocket n est pas ouvert', () => {
    const closedWs = {
      readyState: WebSocket.CLOSED,
      send: vi.fn()
    } as unknown as WebSocket;

    room.addPlayer('p2', closedWs, 'Bob');
    room.broadcast({ type: 'PONG', payload: { timestamp: 123 } });
    expect(closedWs.send).not.toHaveBeenCalled();
  });

  it('devrait générer un getSummary complet', () => {
    room.addPlayer('p1', mockWs, 'Alice');
    const summary = room.getSummary();
    expect(summary.id).toBe('test-room');
    expect(summary.name).toBe('Salle de test');
    expect(summary.playerCount).toBe(1);
    expect(summary.maxPlayers).toBe(4);
    expect(summary.canJoin).toBe(true);
    expect(summary.status).toBe('WAITING');
  });
});

describe('RoomManager - Tests unitaires du gestionnaire de salles', () => {
  let roomManager: RoomManager;
  let mockWs: WebSocket;

  beforeEach(() => {
    roomManager = new RoomManager();
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn()
    } as unknown as WebSocket;
  });

  afterEach(() => {
    roomManager.destroyAll();
  });

  it('devrait créer une salle personnalisée ou par défaut', () => {
    const defaultRoom = roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    expect(defaultRoom.id).toBe('default');
    expect(defaultRoom.isPermanent).toBe(true);

    const customRoom = roomManager.createRoom({ id: 'VIP', name: 'Salon VIP' });
    expect(customRoom.id).toBe('VIP');
    expect(customRoom.name).toBe('Salon VIP');

    const randomRoom = roomManager.createRoom();
    expect(randomRoom.id.startsWith('ROOM-')).toBe(true);
  });

  it('devrait retourner la salle par défaut via getDefaultRoom', () => {
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    expect(roomManager.getDefaultRoom()?.id).toBe('default');
  });

  it('devrait lister toutes les salles actives', () => {
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    roomManager.createRoom({ id: 'R1', name: 'Salle 1' });
    const list = roomManager.listRooms();
    expect(list.length).toBe(2);
    expect(list.map((r) => r.id)).toContain('default');
    expect(list.map((r) => r.id)).toContain('R1');
  });

  it('devrait faire quitter automatiquement l ancienne salle lors d un changement de salle', () => {
    const join1 = roomManager.joinRoom('c1', mockWs, 'Alice', 'ROOM-1');
    expect(join1.success).toBe(true);
    expect(roomManager.getRoomByClientId('c1')?.id).toBe('ROOM-1');

    const join2 = roomManager.joinRoom('c1', mockWs, 'Alice', 'ROOM-2');
    expect(join2.success).toBe(true);
    expect(roomManager.getRoomByClientId('c1')?.id).toBe('ROOM-2');
    // ROOM-1 est supprimée car elle est devenue vide et n est pas permanente
    expect(roomManager.getRoom('ROOM-1')).toBeUndefined();
  });

  it('devrait refuser l entrée dans une salle pleine', () => {
    const room = roomManager.getOrCreateRoom('FULL', 'Salle Pleine');
    for (let i = 1; i <= 4; i++) {
      expect(roomManager.joinRoom(`p${i}`, mockWs, `Joueur ${i}`, 'FULL').success).toBe(true);
    }
    expect(room.getLobbyPlayers().length).toBe(4);

    const fifth = roomManager.joinRoom('p5', mockWs, 'Joueur 5', 'FULL');
    expect(fifth.success).toBe(false);
    expect(fifth.reason).toContain('complète');
  });

  it('devrait refuser l entrée si la partie est en cours', () => {
    const room = roomManager.getOrCreateRoom('IN_GAME', 'En jeu');
    (room.engine as unknown as { status: string }).status = 'IN_PROGRESS';

    const res = roomManager.joinRoom('c1', mockWs, 'Alice', 'IN_GAME');
    expect(res.success).toBe(false);
    expect(res.reason).toContain('cours');
  });

  it('devrait gérer leaveRoom pour un client inexistant ou déconnecté', () => {
    expect(roomManager.leaveRoom('unknown')).toBeUndefined();
    expect(roomManager.getRoomByClientId('unknown')).toBeUndefined();
  });

  it('ne devrait jamais supprimer la salle par défaut même vide', () => {
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    roomManager.joinRoom('c1', mockWs, 'Alice', 'default');
    roomManager.leaveRoom('c1');

    expect(roomManager.getRoom('default')).toBeDefined();
  });

  it('devrait détruire toutes les salles lors de destroyAll', () => {
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    roomManager.createRoom({ id: 'R1' });
    roomManager.createRoom({ id: 'R2' });

    roomManager.destroyAll();
    expect(roomManager.listRooms().length).toBe(0);
  });
});
