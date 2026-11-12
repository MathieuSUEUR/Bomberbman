import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { SocketManager } from '../src/network/SocketManager.js';
import { RoomManager } from '../src/network/RoomManager.js';
import { ServerMessage, ClientMessage } from '@bomberman/shared';

class TestClient {
  public ws: WebSocket;
  public playerId: string = '';
  private messages: ServerMessage[] = [];
  private waiters: Array<{ predicate: (msg: ServerMessage) => boolean; resolve: (msg: ServerMessage) => void }> = [];

  constructor(port: number) {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.type === 'WELCOME') {
        this.playerId = msg.payload.playerId;
      }
      const index = this.waiters.findIndex((w) => w.predicate(msg));
      if (index !== -1) {
        const waiter = this.waiters.splice(index, 1)[0];
        waiter.resolve(msg);
      } else {
        this.messages.push(msg);
      }
    });
  }

  public waitForOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  public waitForMessage(predicate: (msg: ServerMessage) => boolean): Promise<ServerMessage> {
    const existingIndex = this.messages.findIndex(predicate);
    if (existingIndex !== -1) {
      return Promise.resolve(this.messages.splice(existingIndex, 1)[0]);
    }
    return new Promise((resolve) => {
      this.waiters.push({ predicate, resolve });
    });
  }

  public send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  public terminate() {
    this.ws.terminate();
  }
}

describe('RoomManager - Tests unitaires du gestionnaire de salles', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  afterEach(() => {
    roomManager.destroyAll();
  });

  it('devrait créer une salle avec ID et nom par défaut ou personnalisés', () => {
    const defaultRoom = roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    expect(defaultRoom.id).toBe('default');
    expect(defaultRoom.name).toBe('Salon Principal');
    expect(defaultRoom.isPermanent).toBe(true);

    const customRoom = roomManager.createRoom({ id: 'VIP-1', name: 'Salon VIP' });
    expect(customRoom.id).toBe('VIP-1');
    expect(customRoom.name).toBe('Salon VIP');
    expect(customRoom.isPermanent).toBe(false);
  });

  it('devrait lister les salles avec leurs résumés', () => {
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    roomManager.createRoom({ id: 'ROOM-1', name: 'Salle 1' });

    const rooms = roomManager.listRooms();
    expect(rooms.length).toBe(2);
    expect(rooms.map((r) => r.id)).toContain('default');
    expect(rooms.map((r) => r.id)).toContain('ROOM-1');
  });

  it('devrait supprimer une salle non-permanente quand le dernier joueur quitte', () => {
    const mockWs = { send: () => {}, readyState: 1 } as unknown as WebSocket;
    const res = roomManager.joinRoom('client-1', mockWs, 'Alice', 'TEMP-ROOM');
    expect(res.success).toBe(true);
    expect(roomManager.getRoom('TEMP-ROOM')).toBeDefined();

    roomManager.leaveRoom('client-1');
    expect(roomManager.getRoom('TEMP-ROOM')).toBeUndefined();
  });

  it('ne devrait JAMAIS supprimer la salle par défaut même vide', () => {
    const mockWs = { send: () => {}, readyState: 1 } as unknown as WebSocket;
    roomManager.getOrCreateRoom('default', 'Salon Principal', undefined, true);
    roomManager.joinRoom('client-1', mockWs, 'Bob', 'default');
    roomManager.leaveRoom('client-1');

    expect(roomManager.getRoom('default')).toBeDefined();
  });

  it('devrait refuser un 5ème joueur quand la salle est pleine (max 4)', () => {
    const mockWs = { send: () => {}, readyState: 1 } as unknown as WebSocket;
    for (let i = 1; i <= 4; i++) {
      const res = roomManager.joinRoom(`player-${i}`, mockWs, `Joueur ${i}`, 'FULL-ROOM');
      expect(res.success).toBe(true);
    }

    const res5 = roomManager.joinRoom('player-5', mockWs, 'Joueur 5', 'FULL-ROOM');
    expect(res5.success).toBe(false);
    expect(res5.reason).toContain('complète');
  });
});

describe('RoomManager - Tests d\'intégration réseau multi-salles', () => {
  let socketManager: SocketManager;
  let port: number;
  const activeClients: TestClient[] = [];

  const createClient = async (): Promise<TestClient> => {
    const client = new TestClient(port);
    activeClients.push(client);
    await client.waitForOpen();
    await client.waitForMessage((m) => m.type === 'WELCOME');
    return client;
  };

  beforeEach(async () => {
    socketManager = new SocketManager(0);
    await socketManager.waitUntilReady();
    port = socketManager.getPort();
  });

  afterEach(async () => {
    for (const client of activeClients) {
      client.terminate();
    }
    activeClients.length = 0;
    await socketManager.close();
  });

  it('devrait répondre à CREATE_ROOM avec ROOM_CREATED et lister la salle via LIST_ROOMS', async () => {
    const client = await createClient();

    client.send({ type: 'CREATE_ROOM', payload: { name: 'Partie Entre Amis' } });
    const createdMsg = await client.waitForMessage((m) => m.type === 'ROOM_CREATED');

    expect(createdMsg.type).toBe('ROOM_CREATED');
    if (createdMsg.type === 'ROOM_CREATED') {
      expect(createdMsg.payload.roomId).toBeDefined();
      expect(createdMsg.payload.name).toBe('Partie Entre Amis');

      client.send({ type: 'LIST_ROOMS' });
      const listMsg = await client.waitForMessage((m) => m.type === 'ROOM_LIST');
      expect(listMsg.type).toBe('ROOM_LIST');
      if (listMsg.type === 'ROOM_LIST') {
        const found = listMsg.payload.rooms.find((r) => r.id === createdMsg.payload.roomId);
        expect(found).toBeDefined();
        expect(found?.name).toBe('Partie Entre Amis');
      }
    }
  });

  it('devrait isoler hermétiquement deux parties se déroulant dans deux salles différentes', async () => {
    // Salle Alpha : 2 joueurs
    const clientA1 = await createClient();
    const clientA2 = await createClient();
    // Salle Beta : 2 joueurs
    const clientB1 = await createClient();
    const clientB2 = await createClient();

    // Connexion dans la salle ALPHA
    clientA1.send({ type: 'JOIN', payload: { name: 'Alpha 1', roomId: 'ROOM-ALPHA' } });
    clientA2.send({ type: 'JOIN', payload: { name: 'Alpha 2', roomId: 'ROOM-ALPHA' } });

    // Connexion dans la salle BETA
    clientB1.send({ type: 'JOIN', payload: { name: 'Beta 1', roomId: 'ROOM-BETA' } });
    clientB2.send({ type: 'JOIN', payload: { name: 'Beta 2', roomId: 'ROOM-BETA' } });

    // Attente des LOBBY_STATE dans Alpha
    const lobbyA = await clientA1.waitForMessage(
      (m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2 && m.payload.roomId === 'ROOM-ALPHA'
    );
    expect(lobbyA.type).toBe('LOBBY_STATE');
    if (lobbyA.type === 'LOBBY_STATE') {
      expect(lobbyA.payload.players.map((p) => p.name)).toEqual(['Alpha 1', 'Alpha 2']);
    }

    // Attente des LOBBY_STATE dans Beta
    const lobbyB = await clientB1.waitForMessage(
      (m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2 && m.payload.roomId === 'ROOM-BETA'
    );
    expect(lobbyB.type).toBe('LOBBY_STATE');
    if (lobbyB.type === 'LOBBY_STATE') {
      expect(lobbyB.payload.players.map((p) => p.name)).toEqual(['Beta 1', 'Beta 2']);
    }

    // Lancer la partie UNIQUEMENT dans la salle Alpha
    clientA1.send({ type: 'READY', payload: { isReady: true } });
    clientA2.send({ type: 'READY', payload: { isReady: true } });

    const gameStartA = await clientA1.waitForMessage((m) => m.type === 'GAME_START');
    expect(gameStartA.type).toBe('GAME_START');

    // Les joueurs de Beta NE DOIVENT PAS avoir démarré
    const roomBeta = socketManager.getRoomManager().getRoom('ROOM-BETA');
    expect(roomBeta?.engine.obtenirEtatActuel().status).toBe('WAITING');

    // Les joueurs de Alpha ont bien démarré
    const roomAlpha = socketManager.getRoomManager().getRoom('ROOM-ALPHA');
    expect(roomAlpha?.engine.obtenirEtatActuel().status).toBe('IN_PROGRESS');
  });

  it('devrait envoyer un message ERROR si un joueur tente de rejoindre une partie déjà en cours', async () => {
    const client1 = await createClient();
    const client2 = await createClient();
    const clientLate = await createClient();

    client1.send({ type: 'JOIN', payload: { name: 'J1', roomId: 'FAST-ROOM' } });
    client2.send({ type: 'JOIN', payload: { name: 'J2', roomId: 'FAST-ROOM' } });

    await client1.waitForMessage((m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2);

    client1.send({ type: 'READY', payload: { isReady: true } });
    client2.send({ type: 'READY', payload: { isReady: true } });
    await client1.waitForMessage((m) => m.type === 'GAME_START');

    // Client retardataire tente de rejoindre la salle FAST-ROOM en cours
    clientLate.send({ type: 'JOIN', payload: { name: 'Late', roomId: 'FAST-ROOM' } });
    const errorMsg = await clientLate.waitForMessage((m) => m.type === 'ERROR');

    expect(errorMsg.type).toBe('ERROR');
    if (errorMsg.type === 'ERROR') {
      expect(errorMsg.payload.message).toContain('cours');
    }
  });
});

