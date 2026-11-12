import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '../src/core/EventBus';
import { SocketManager } from '../src/network/SocketManager';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  public readyState: number = MockWebSocket.OPEN;
  public sentMessages: string[] = [];
  public onopen: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

describe('Client SocketManager - Tests unitaires de la couche réseau cliente', () => {
  let originalWebSocket: unknown;
  let socketManager: SocketManager;
  let currentMockWs: MockWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        currentMockWs = this;
      }
    };
    (globalThis.WebSocket as unknown as { OPEN: number }).OPEN = 1;
    (globalThis.WebSocket as unknown as { CLOSED: number }).CLOSED = 3;

    socketManager = new SocketManager('ws://localhost:3000');
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('devrait émettre SERVER_STATUS lors de l ouverture, l erreur et la fermeture de la connexion', () => {
    let status = false;
    eventBus.on('SERVER_STATUS', (payload: unknown) => {
      const p = payload as { connected: boolean };
      status = p.connected;
    });

    currentMockWs.onopen?.();
    expect(status).toBe(true);
    expect(socketManager.isConnected()).toBe(true);

    currentMockWs.onerror?.();
    expect(status).toBe(false);

    currentMockWs.onclose?.();
    expect(status).toBe(false);
  });

  it('devrait envoyer le message JOIN avec le pseudo et le roomId au serveur', () => {
    eventBus.emit('JOIN_LOBBY', { name: 'SuperPlayer', roomId: 'ROOM-1234' });

    expect(currentMockWs.sentMessages.length).toBe(1);
    const sent = JSON.parse(currentMockWs.sentMessages[0]);
    expect(sent).toEqual({
      type: 'JOIN',
      payload: { name: 'SuperPlayer', roomId: 'ROOM-1234' }
    });
  });

  it('devrait envoyer le message READY lors de l événement SET_READY', () => {
    eventBus.emit('SET_READY', { isReady: true });

    expect(currentMockWs.sentMessages.length).toBe(1);
    const sent = JSON.parse(currentMockWs.sentMessages[0]);
    expect(sent).toEqual({
      type: 'READY',
      payload: { isReady: true }
    });
  });

  it('devrait envoyer le message ACTION pour PLACE_BOMB lors de l événement USER_ACTION', () => {
    eventBus.emit('USER_ACTION', { type: 'PLACE_BOMB', payload: {} });

    expect(currentMockWs.sentMessages.length).toBe(1);
    const sent = JSON.parse(currentMockWs.sentMessages[0]);
    expect(sent).toEqual({
      type: 'ACTION',
      payload: { actionType: 'PLACE_BOMB' }
    });
  });

  it('devrait propager les messages serveur reçus via EventBus', () => {
    let receivedPlayerId = '';
    eventBus.on('WELCOME', (payload: unknown) => {
      const p = payload as { playerId: string };
      receivedPlayerId = p.playerId;
    });

    currentMockWs.onmessage?.({
      data: JSON.stringify({ type: 'WELCOME', payload: { playerId: 'player-test-id' } })
    });

    expect(receivedPlayerId).toBe('player-test-id');
    expect(socketManager.getPlayerId()).toBe('player-test-id');
  });

  it('devrait propager les messages LOBBY_STATE, GAME_START et GAME_OVER', () => {
    let lobbyReceived = false;
    let gameStartReceived = false;
    let gameOverReceived = false;

    eventBus.on('LOBBY_STATE', () => { lobbyReceived = true; });
    eventBus.on('GAME_START', () => { gameStartReceived = true; });
    eventBus.on('GAME_OVER', () => { gameOverReceived = true; });

    currentMockWs.onmessage?.({
      data: JSON.stringify({ type: 'LOBBY_STATE', payload: { players: [], canStart: false } })
    });
    expect(lobbyReceived).toBe(true);

    currentMockWs.onmessage?.({
      data: JSON.stringify({ type: 'GAME_START', payload: {} })
    });
    expect(gameStartReceived).toBe(true);

    currentMockWs.onmessage?.({
      data: JSON.stringify({ type: 'GAME_OVER', payload: { winnerId: null, scores: [] } })
    });
    expect(gameOverReceived).toBe(true);
  });

  it('devrait ignorer gracieusement les messages mal formés', () => {
    expect(() => {
      currentMockWs.onmessage?.({ data: 'not-valid-json{{{' });
    }).not.toThrow();
  });
});

