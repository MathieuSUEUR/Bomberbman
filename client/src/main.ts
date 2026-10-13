import './style.css';
import { GameRenderer } from './view/GameRenderer';
import { HudManager } from './view/HudManager';
import { eventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { SocketManager } from './network/SocketManager';

// ──────────────────────────────────────────────────────────────────────────
// 1. Initialisation du Canvas et du HUD
// ──────────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
canvas.width = 500;
canvas.height = 500;
new GameRenderer(canvas);

const canvasFrame = document.querySelector('.canvas-frame') as HTMLElement;
export const hudManager = new HudManager(
  canvasFrame || document.getElementById('game-container')!,
  {
    initialTimerSeconds: 0,
    initialScore: 0,
    initialBombs: 1,
    initialMaxBombs: 1,
    initialLives: 3,
    initialMaxLives: 3,
  },
);

// ──────────────────────────────────────────────────────────────────────────
// 2. Initialisation du clavier et de la connexion WebSocket
// ──────────────────────────────────────────────────────────────────────────

new InputManager();
const socketManager = new SocketManager('ws://localhost:3000');

// ──────────────────────────────────────────────────────────────────────────
// 3. Récupération des éléments du DOM
// ──────────────────────────────────────────────────────────────────────────

const mainMenu = document.getElementById('main-menu')!;
const lobbyScreen = document.getElementById('lobby-screen')!;
const gameContainer = document.getElementById('game-container')!;
const gameCanvas = document.getElementById('game-canvas')!;

const playerNameInput = document.getElementById('player-name-input') as HTMLInputElement;
const btnJoinGame = document.getElementById('btn-join-game')!;
const btnStartMock = document.getElementById('btn-start-mock')!;

const btnReady = document.getElementById('btn-ready')!;
const btnReadyText = document.getElementById('btn-ready-text');
const btnStartGame = document.getElementById('btn-start-game')!;
const btnBackMenu = document.getElementById('btn-back-menu')!;
const btnLeaveGame = document.getElementById('btn-leave-game');

const playersList = document.getElementById('players')!;
const playerCount = document.getElementById('player-count');
const lobbySubtitle = document.getElementById('lobby-subtitle');
const currentPlayerLabel = document.getElementById('current-player-label');
const currentPlayerStatus = document.getElementById('current-player-status');
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');

// ──────────────────────────────────────────────────────────────────────────
// 4. État de l'interface
// ──────────────────────────────────────────────────────────────────────────

let currentPseudo = 'Joueur 1';
let isPlayerReady = false;
let isGameActive = false;
let isMockMode = false; // true = mode solo/entraînement, false = mode réseau

type ScreenType = 'menu' | 'lobby' | 'game' | 'gameover';

function showScreen(screen: ScreenType): void {
  mainMenu.style.display = screen === 'menu' ? 'flex' : 'none';
  lobbyScreen.style.display = screen === 'lobby' ? 'flex' : 'none';

  if (gameContainer) {
    gameContainer.style.display = screen === 'game' || screen === 'gameover' ? 'flex' : 'none';
  }
  gameCanvas.style.display = screen === 'game' ? 'block' : 'none';

  // Masquer/afficher l'écran de fin de partie
  const existingGameOver = document.getElementById('gameover-overlay');
  if (existingGameOver) {
    existingGameOver.style.display = screen === 'gameover' ? 'flex' : 'none';
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Écran de fin de partie (Game Over)
// ──────────────────────────────────────────────────────────────────────────

function createGameOverOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  overlay.innerHTML = `
    <div class="gameover-card">
      <div class="gameover-icon" id="gameover-icon">💥</div>
      <h2 class="gameover-title" id="gameover-title">Partie terminée !</h2>
      <p class="gameover-subtitle" id="gameover-subtitle"></p>
      <div class="gameover-actions">
        <button id="btn-gameover-menu" class="btn btn-primary">
          <span class="btn-icon">🏠</span>
          <span class="btn-text">Retour au menu</span>
        </button>
      </div>
    </div>
  `;

  gameContainer.appendChild(overlay);

  document.getElementById('btn-gameover-menu')!.addEventListener('click', () => {
    isGameActive = false;
    isMockMode = false;
    isPlayerReady = false;
    eventBus.emit('HUD_TIMER_STOP');
    showScreen('menu');
  });

  return overlay;
}

/**
 * Affiche l'écran de fin de partie.
 * @param winnerId - L'ID du gagnant (null = égalité)
 * @param winnerName - Le nom du gagnant
 */
function showGameOver(winnerId: string | null, winnerName?: string | null): void {
  isGameActive = false;
  eventBus.emit('HUD_TIMER_STOP');

  let overlay = document.getElementById('gameover-overlay');
  if (!overlay) {
    overlay = createGameOverOverlay();
  }

  const icon = document.getElementById('gameover-icon')!;
  const title = document.getElementById('gameover-title')!;
  const subtitle = document.getElementById('gameover-subtitle')!;

  const localPlayerId = socketManager.getPlayerId();

  if (!winnerId) {
    // Égalité
    icon.textContent = '🤝';
    title.textContent = 'Égalité !';
    subtitle.textContent = 'Personne ne remporte la partie.';
  } else if (localPlayerId && winnerId === localPlayerId) {
    // Le joueur local a gagné
    icon.textContent = '🏆';
    title.textContent = 'Victoire !';
    subtitle.textContent = winnerName ? `${winnerName} remporte la partie !` : 'Tu as gagné !';
  } else {
    // Un autre joueur a gagné
    icon.textContent = '💀';
    title.textContent = 'Défaite…';
    subtitle.textContent = winnerName ? `${winnerName} remporte la partie.` : 'Tu as perdu.';
  }

  overlay.style.display = 'flex';
  gameContainer.style.display = 'flex';
  gameCanvas.style.display = 'none';
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Mode Entraînement (Mock / Solo)
// ──────────────────────────────────────────────────────────────────────────

const mockGameState = {
  grid: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  players: [{ id: 'p1', x: 1, y: 1, direction: 'DOWN' }],
};

function startMockGame(): void {
  isMockMode = true;
  isGameActive = true;
  showScreen('game');

  mockGameState.players[0].x = 1;
  mockGameState.players[0].y = 1;
  mockGameState.players[0].direction = 'DOWN';

  eventBus.emit('HUD_TIMER_RESET', { seconds: 0 });
  eventBus.emit('HUD_TIMER_START');
  eventBus.emit('HUD_UPDATE_BOMBS', { available: 1, max: 1 });
  eventBus.emit('HUD_UPDATE_SCORE', { score: 0 });
  eventBus.emit('HUD_UPDATE_LIVES', { lives: 3, maxLives: 3 });
  eventBus.emit('GAME_STATE_UPDATE', mockGameState);
}

// Boucle de jeu mock (60 FPS, uniquement en mode solo)
const activeDirectionsMock = new Set<string>();

eventBus.on('USER_ACTION', (action: unknown) => {
  if (!isMockMode) return; // En mode réseau, les actions sont gérées par le SocketManager

  const kbAction = action as { type: string; payload: { direction: string } };
  if (kbAction.type === 'MOVE_START') activeDirectionsMock.add(kbAction.payload.direction);
  if (kbAction.type === 'MOVE_END') activeDirectionsMock.delete(kbAction.payload.direction);
});

setInterval(() => {
  if (!isGameActive || !isMockMode) return;
  if (activeDirectionsMock.size === 0) return;

  const player = mockGameState.players[0];
  const speed = 0.08;
  let newX = player.x;
  let newY = player.y;

  if (activeDirectionsMock.has('UP')) { newY -= speed; player.direction = 'UP'; }
  if (activeDirectionsMock.has('DOWN')) { newY += speed; player.direction = 'DOWN'; }
  if (activeDirectionsMock.has('LEFT')) { newX -= speed; player.direction = 'LEFT'; }
  if (activeDirectionsMock.has('RIGHT')) { newX += speed; player.direction = 'RIGHT'; }

  const gridX = Math.round(newX);
  const gridY = Math.round(newY);

  if (mockGameState.grid[gridY] && mockGameState.grid[gridY][gridX] === 0) {
    player.x = newX;
    player.y = newY;
    eventBus.emit('GAME_STATE_UPDATE', mockGameState);
  }
}, 1000 / 60);

// ──────────────────────────────────────────────────────────────────────────
// 7. Événements des boutons de navigation
// ──────────────────────────────────────────────────────────────────────────

btnJoinGame.addEventListener('click', () => {
  const enteredName = playerNameInput?.value.trim();
  currentPseudo = enteredName && enteredName.length > 0 ? enteredName : 'Joueur 1';
  isMockMode = false;

  if (currentPlayerLabel) {
    currentPlayerLabel.textContent = `${currentPseudo} (Toi)`;
  }

  // Envoyer JOIN au serveur via l'eventBus → SocketManager
  eventBus.emit('JOIN_LOBBY', { name: currentPseudo });

  showScreen('lobby');
});

btnStartMock.addEventListener('click', () => {
  startMockGame();
});

btnReady.addEventListener('click', () => {
  isPlayerReady = !isPlayerReady;
  eventBus.emit('SET_READY', { isReady: isPlayerReady });

  if (btnReadyText) {
    btnReadyText.textContent = isPlayerReady ? 'Prêt ! (Annuler)' : 'Je suis prêt !';
  }

  if (currentPlayerStatus) {
    currentPlayerStatus.className = `player-status-tag ${isPlayerReady ? 'ready' : 'waiting'}`;
    currentPlayerStatus.textContent = isPlayerReady ? 'Prêt' : 'En attente';
  }
});

// Bouton "Lancer la partie" : uniquement pour les tests locaux ou si le serveur est indisponible
btnStartGame.addEventListener('click', () => {
  if (!socketManager.isConnected()) {
    // Fallback : mode mock si le serveur est déconnecté
    startMockGame();
  }
  // Sinon, la partie démarre automatiquement quand tous les joueurs sont prêts (GAME_START)
});

btnBackMenu.addEventListener('click', () => {
  isPlayerReady = false;
  isMockMode = false;
  if (btnReadyText) {
    btnReadyText.textContent = 'Je suis prêt !';
  }
  if (currentPlayerStatus) {
    currentPlayerStatus.className = 'player-status-tag waiting';
    currentPlayerStatus.textContent = 'En attente';
  }
  showScreen('menu');
});

if (btnLeaveGame) {
  btnLeaveGame.addEventListener('click', () => {
    isGameActive = false;
    isMockMode = false;
    eventBus.emit('HUD_TIMER_STOP');
    showScreen('menu');
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 8. Événements réseau (serveur → UI)
// ──────────────────────────────────────────────────────────────────────────

// Statut de la connexion serveur
eventBus.on('SERVER_STATUS', (status: unknown) => {
  const { connected } = status as { connected: boolean };
  if (serverStatusDot && serverStatusText) {
    if (connected) {
      serverStatusDot.className = 'status-dot online';
      serverStatusText.textContent = 'Serveur en ligne';
    } else {
      serverStatusDot.className = 'status-dot offline';
      serverStatusText.textContent = 'Serveur hors-ligne (mode solo/mock)';
    }
  }
});

// État du lobby : mise à jour de la liste des joueurs
interface LobbyPlayer {
  id: string;
  name: string;
  isReady: boolean;
}

interface LobbyStatePayload {
  players: LobbyPlayer[];
  canStart: boolean;
}

eventBus.on('LOBBY_STATE', (payload: unknown) => {
  const data = payload as LobbyStatePayload;
  if (!data?.players) return;

  if (playerCount) {
    playerCount.textContent = String(data.players.length);
  }

  if (lobbySubtitle) {
    lobbySubtitle.textContent = data.canStart
      ? 'Tous les joueurs sont prêts ! La partie peut démarrer.'
      : "En attente d'autres joueurs...";
  }

  if (playersList) {
    playersList.innerHTML = '';
    data.players.forEach((p) => {
      const isCurrent = p.name === currentPseudo;
      const li = document.createElement('li');
      li.className = `player-item ${isCurrent ? 'current-player' : ''}`;
      li.innerHTML = `
        <span class="player-avatar" aria-hidden="true">💣</span>
        <span class="player-name">${escapeHtml(p.name)}${isCurrent ? ' (Toi)' : ''}</span>
        <span class="player-status-tag ${p.isReady ? 'ready' : 'waiting'}">
          ${p.isReady ? 'Prêt' : 'En attente'}
        </span>
      `;
      playersList.appendChild(li);
    });
  }
});

// Démarrage de la partie par le serveur
eventBus.on('GAME_START', (payload: unknown) => {
  const data = payload as { initialState?: unknown };
  isGameActive = true;
  isMockMode = false;
  showScreen('game');

  // Réinitialiser le HUD
  eventBus.emit('HUD_TIMER_RESET', { seconds: 0 });
  eventBus.emit('HUD_TIMER_START');
  eventBus.emit('HUD_UPDATE_BOMBS', { available: 1, max: 1 });
  eventBus.emit('HUD_UPDATE_SCORE', { score: 0 });
  eventBus.emit('HUD_UPDATE_LIVES', { lives: 3, maxLives: 3 });

  // Afficher l'état initial du jeu
  if (data?.initialState) {
    eventBus.emit('GAME_STATE_UPDATE', data.initialState);
  }
});

// Fin de partie
eventBus.on('GAME_OVER', (payload: unknown) => {
  const data = payload as { winnerId: string | null; winnerName?: string | null };
  showGameOver(data.winnerId, data.winnerName);
});

// Joueur éliminé (dont potentiellement le joueur local)
eventBus.on('PLAYER_ELIMINATED', (payload: unknown) => {
  const data = payload as { playerId: string };
  const localId = socketManager.getPlayerId();

  if (localId && data.playerId === localId) {
    // Le joueur local est éliminé → mettre les vies à 0
    eventBus.emit('HUD_UPDATE_LIVES', { lives: 0 });
    console.info('💀 Vous avez été éliminé !');
  }
});

// Erreur serveur
eventBus.on('SERVER_ERROR', (payload: unknown) => {
  const data = payload as { message: string };
  console.warn('Erreur serveur :', data.message);
});

// ──────────────────────────────────────────────────────────────────────────
// 9. État initial : afficher le menu principal
// ──────────────────────────────────────────────────────────────────────────

showScreen('menu');
