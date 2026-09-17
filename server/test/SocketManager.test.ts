import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { GameEngine } from '../src/engine/GameEngine.js';
import { SocketManager } from '../src/network/SocketManager.js';
import { ServerMessage, ClientMessage } from '@bomberman/shared';

class TestClient {
  public ws: WebSocket;
  private messages: ServerMessage[] = [];
  private waiters: Array<{ predicate: (msg: ServerMessage) => boolean; resolve: (msg: ServerMessage) => void }> = [];

  constructor(port: number) {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
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

  public close() {
    this.ws.close();
  }

  public terminate() {
    this.ws.terminate();
  }
}

describe('SocketManager - Tests d\'intégration réseau WebSocket', () => {
  let engine: GameEngine;
  let socketManager: SocketManager;
  let port: number;
  const activeClients: TestClient[] = [];

  const createClient = async (): Promise<TestClient> => {
    const client = new TestClient(port);
    activeClients.push(client);
    await client.waitForOpen();
    return client;
  };

  beforeEach(async () => {
    engine = new GameEngine();
    socketManager = new SocketManager(0, engine);
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

  it('devrait envoyer un message WELCOME avec playerId à la connexion', async () => {
    const client = await createClient();
    const welcomeMsg = await client.waitForMessage((m) => m.type === 'WELCOME');

    expect(welcomeMsg.type).toBe('WELCOME');
    if (welcomeMsg.type === 'WELCOME') {
      expect(welcomeMsg.payload.playerId).toBeDefined();
      expect(typeof welcomeMsg.payload.playerId).toBe('string');
    }
  });

  it('devrait diffuser le LOBBY_STATE quand un joueur rejoint avec JOIN', async () => {
    const client = await createClient();
    await client.waitForMessage((m) => m.type === 'WELCOME');

    client.send({
      type: 'JOIN',
      payload: { name: 'Player 1' }
    });

    const lobbyMsg = await client.waitForMessage((m) => m.type === 'LOBBY_STATE');
    expect(lobbyMsg.type).toBe('LOBBY_STATE');
    if (lobbyMsg.type === 'LOBBY_STATE') {
      expect(lobbyMsg.payload.players).toHaveLength(1);
      expect(lobbyMsg.payload.players[0].name).toBe('Player 1');
      expect(lobbyMsg.payload.canStart).toBe(false);
    }
  });

  it('devrait gérer le cycle complet : 2 joueurs se connectent, se déclarent prêts et reçoivent GAME_START', async () => {
    // Client 1 se connecte
    const client1 = await createClient();
    await client1.waitForMessage((m) => m.type === 'WELCOME');

    client1.send({
      type: 'JOIN',
      payload: { name: 'Player 1' }
    });
    await client1.waitForMessage((m) => m.type === 'LOBBY_STATE');

    // Client 2 se connecte
    const client2 = await createClient();
    await client2.waitForMessage((m) => m.type === 'WELCOME');

    client2.send({
      type: 'JOIN',
      payload: { name: 'Player 2' }
    });

    // Les deux reçoivent le lobby mis à jour avec 2 joueurs
    const lobby2 = await client1.waitForMessage((m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2);
    if (lobby2.type === 'LOBBY_STATE') {
      expect(lobby2.payload.players).toHaveLength(2);
      expect(lobby2.payload.canStart).toBe(false);
    }

    // Le client 1 se met prêt
    client1.send({
      type: 'READY',
      payload: { isReady: true }
    });

    // Le client 2 se met prêt
    client2.send({
      type: 'READY',
      payload: { isReady: true }
    });

    // Les deux clients doivent recevoir GAME_START
    const [gameStart1, gameStart2] = await Promise.all([
      client1.waitForMessage((m) => m.type === 'GAME_START'),
      client2.waitForMessage((m) => m.type === 'GAME_START')
    ]);

    expect(gameStart1.type).toBe('GAME_START');
    expect(gameStart2.type).toBe('GAME_START');

    if (gameStart1.type === 'GAME_START') {
      expect(gameStart1.payload.initialState).toBeDefined();
      expect(Object.keys(gameStart1.payload.initialState.players)).toHaveLength(2);
    }
  });

  it('devrait transmettre une action (ACTION) vers le GameEngine', async () => {
    const client = await createClient();
    const welcome = await client.waitForMessage((m) => m.type === 'WELCOME');
    let playerId = '';
    if (welcome.type === 'WELCOME') {
      playerId = welcome.payload.playerId;
    }

    client.send({
      type: 'ACTION',
      payload: { actionType: 'MOVE_UP' }
    });

    expect(() => {
      engine.tick();
    }).not.toThrow();
    expect(playerId).toBeDefined();
  });

  it('devrait répondre à un message PING par un PONG', async () => {
    const client = await createClient();
    await client.waitForMessage((m) => m.type === 'WELCOME');

    const timestamp = Date.now();
    client.send({
      type: 'PING',
      payload: { timestamp }
    });

    const pongMsg = await client.waitForMessage((m) => m.type === 'PONG');
    expect(pongMsg.type).toBe('PONG');
    if (pongMsg.type === 'PONG') {
      expect(pongMsg.payload?.timestamp).toBe(timestamp);
    }
  });

  it('devrait mettre à jour le lobby lors de la déconnexion d\'un joueur', async () => {
    const client1 = await createClient();
    await client1.waitForMessage((m) => m.type === 'WELCOME');
    client1.send({ type: 'JOIN', payload: { name: 'Player 1' } });
    await client1.waitForMessage((m) => m.type === 'LOBBY_STATE');

    const client2 = await createClient();
    await client2.waitForMessage((m) => m.type === 'WELCOME');
    client2.send({ type: 'JOIN', payload: { name: 'Player 2' } });
    await client1.waitForMessage((m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2);

    // Déconnexion de client2
    client2.close();

    // client1 doit recevoir un LOBBY_STATE avec seulement 1 joueur
    const updatedLobby = await client1.waitForMessage((m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 1);
    if (updatedLobby.type === 'LOBBY_STATE') {
      expect(updatedLobby.payload.players).toHaveLength(1);
      expect(updatedLobby.payload.players[0].name).toBe('Player 1');
    }
  });
});
