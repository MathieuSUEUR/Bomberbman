import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { GameEngine } from '../src/engine/GameEngine.js';
import { SocketManager } from '../src/network/SocketManager.js';
import { ServerMessage, ClientMessage, CellType } from '@bomberman/shared';

class TestClient {
  public ws: WebSocket;
  public playerId: string = '';
  private messages: ServerMessage[] = [];
  private waiters: Array<{
    predicate: (msg: ServerMessage) => boolean;
    resolve: (msg: ServerMessage) => void;
  }> = [];

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

describe("Tests d'intégration de bout en bout - Flux complet d'une partie", () => {
  let engine: GameEngine;
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
    engine.stopGameLoop();
  });

  it("devrait exécuter le flux complet d'une partie : Connexion -> Lobby -> Start -> Actions -> Bombe -> Explosion -> Élimination -> Game Over (Victoire)", async () => {
    // 1. Deux joueurs se connectent
    const alice = await createClient();
    const bob = await createClient();

    expect(alice.playerId).toBeDefined();
    expect(bob.playerId).toBeDefined();

    // 2. Alice rejoint le salon
    alice.send({ type: 'JOIN', payload: { name: 'Alice' } });
    const lobbyAlice = await alice.waitForMessage((m) => m.type === 'LOBBY_STATE');
    if (lobbyAlice.type === 'LOBBY_STATE') {
      expect(lobbyAlice.payload.players).toHaveLength(1);
      expect(lobbyAlice.payload.canStart).toBe(false);
    }

    // 3. Bob rejoint le salon
    bob.send({ type: 'JOIN', payload: { name: 'Bob' } });
    const lobbyBob = await alice.waitForMessage(
      (m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2,
    );
    if (lobbyBob.type === 'LOBBY_STATE') {
      expect(lobbyBob.payload.canStart).toBe(false);
    }

    // 4. Les joueurs se déclarent prêts
    alice.send({ type: 'READY', payload: { isReady: true } });
    bob.send({ type: 'READY', payload: { isReady: true } });

    // 5. Réception de GAME_START par les deux clients
    const [startAlice, startBob] = await Promise.all([
      alice.waitForMessage((m) => m.type === 'GAME_START'),
      bob.waitForMessage((m) => m.type === 'GAME_START'),
    ]);

    expect(startAlice.type).toBe('GAME_START');
    expect(startBob.type).toBe('GAME_START');

    if (startAlice.type === 'GAME_START') {
      expect(startAlice.payload.initialState.status).toBe('IN_PROGRESS');
      expect(startAlice.payload.initialState.players[alice.playerId].name).toBe('Alice');
      expect(startAlice.payload.initialState.players[bob.playerId].name).toBe('Bob');
    }

    // 6. Les clients reçoivent des mises à jour périodiques GAME_STATE via la boucle de jeu
    const gameState = await alice.waitForMessage((m) => m.type === 'GAME_STATE');
    expect(gameState.type).toBe('GAME_STATE');

    // 7. Alice pose une bombe en (1, 1)
    alice.send({ type: 'ACTION', payload: { actionType: 'PLACE_BOMB' } });

    // Attendre que la bombe apparaisse dans un GAME_STATE
    const stateWithBomb = await alice.waitForMessage(
      (m) => m.type === 'GAME_STATE' && m.payload.bombs.length > 0,
    );
    expect(stateWithBomb.type).toBe('GAME_STATE');
    if (stateWithBomb.type === 'GAME_STATE') {
      expect(stateWithBomb.payload.bombs[0].ownerId).toBe(alice.playerId);
      expect(stateWithBomb.payload.bombs[0].position).toEqual({ x: 1, y: 1 });
    }

    // 8. On déplace Alice hors de danger et on place Bob dans la zone de souffle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalPlayers = (engine as any).players as Map<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalMap = (engine as any).map;

    // Alice s'enfuit en (5, 5)
    internalPlayers.get(alice.playerId).position = { x: 5, y: 5 };

    // Bob se trouve en (1, 2), case libérée dans le souffle de la bombe
    internalMap.setCell(1, 2, CellType.EMPTY);
    internalPlayers.get(bob.playerId).position = { x: 1, y: 2 };

    // 9. Attendre l'explosion de la bombe et l'élimination de Bob
    const [bombExplosion, playerEliminated] = await Promise.all([
      alice.waitForMessage((m) => m.type === 'BOMB_EXPLODED'),
      bob.waitForMessage((m) => m.type === 'PLAYER_ELIMINATED'),
    ]);

    expect(bombExplosion.type).toBe('BOMB_EXPLODED');
    expect(playerEliminated.type).toBe('PLAYER_ELIMINATED');
    if (playerEliminated.type === 'PLAYER_ELIMINATED') {
      expect(playerEliminated.payload.playerId).toBe(bob.playerId);
    }

    // 10. Victoire : les deux clients reçoivent GAME_OVER avec Alice comme gagnante
    const [gameOverAlice, gameOverBob] = await Promise.all([
      alice.waitForMessage((m) => m.type === 'GAME_OVER'),
      bob.waitForMessage((m) => m.type === 'GAME_OVER'),
    ]);

    expect(gameOverAlice.type).toBe('GAME_OVER');
    expect(gameOverBob.type).toBe('GAME_OVER');

    if (gameOverAlice.type === 'GAME_OVER') {
      expect(gameOverAlice.payload.winnerId).toBe(alice.playerId);
      expect(gameOverAlice.payload.winnerName).toBe('Alice');
    }

    // 11. Vérifier que le statut du GameEngine est bien 'FINISHED' et la boucle arrêtée
    expect(engine.obtenirEtatActuel().status).toBe('FINISHED');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((engine as any).gameLoopInterval).toBeNull();
  });

  it('devrait diffuser GAME_OVER avec winnerId null en cas de match nul (suicide simultané)', async () => {
    const alice = await createClient();
    const bob = await createClient();

    alice.send({ type: 'JOIN', payload: { name: 'Alice' } });
    bob.send({ type: 'JOIN', payload: { name: 'Bob' } });
    await alice.waitForMessage((m) => m.type === 'LOBBY_STATE' && m.payload.players.length === 2);

    alice.send({ type: 'READY', payload: { isReady: true } });
    bob.send({ type: 'READY', payload: { isReady: true } });
    await alice.waitForMessage((m) => m.type === 'GAME_START');

    // Élimination simultanée des deux joueurs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalPlayers = (engine as any).players as Map<string, any>;
    internalPlayers.get(alice.playerId).isAlive = false;
    internalPlayers.get(bob.playerId).isAlive = false;

    // Déclenchement d'un tick
    engine.tick();

    const gameOverMsg = await alice.waitForMessage((m) => m.type === 'GAME_OVER');
    expect(gameOverMsg.type).toBe('GAME_OVER');
    if (gameOverMsg.type === 'GAME_OVER') {
      expect(gameOverMsg.payload.winnerId).toBeNull();
      expect(gameOverMsg.payload.winnerName).toBeNull();
    }
  });
});
