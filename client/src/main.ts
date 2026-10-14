import './style.css';
import { GameRenderer } from './view/GameRenderer';
import { GameOverManager } from './view/GameOverManager';
import { HudManager } from './view/HudManager';
import { eventBus } from './core/EventBus';
import { calculateMovementDelta } from './core/movement';
import { InputManager } from './core/InputManager';
import { SocketManager } from './network/SocketManager';

// 1. Initialisation de l'affichage du Canvas
// 1. Initialisation de l'affichage du Canvas et du HUD
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

// 2. Initialisation du clavier et de la connexion WebSocket
new InputManager();
new SocketManager('ws://localhost:3000'); // Port 3000 par défaut

// 3. Récupération des éléments HTML du DOM
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

// 4. Gestion de l'état de l'interface
let currentPseudo = 'Joueur 1';
let localPlayerId = '';
let isPlayerReady = false;
let isGameActive = false;
let isMockMode = false;

type ScreenType = 'menu' | 'lobby' | 'game';

function showScreen(screen: ScreenType): void {
  mainMenu.style.display = screen === 'menu' ? 'flex' : 'none';
  lobbyScreen.style.display = screen === 'lobby' ? 'flex' : 'none';
  if (gameContainer) {
    gameContainer.style.display = screen === 'game' ? 'flex' : 'none';
  }
  gameCanvas.style.display = screen === 'game' ? 'block' : 'none';
}

// 4b. Instanciation du gestionnaire de la modale Game Over
const gameOverManager = new GameOverManager(
  // Callback "Rejouer" : retour au lobby
  () => {
    isGameActive = false;
    isMockMode = false;
    isPlayerReady = false;
    if (btnReadyText) btnReadyText.textContent = 'Je suis prêt !';
    if (currentPlayerStatus) {
      currentPlayerStatus.className = 'player-status-tag waiting';
      currentPlayerStatus.textContent = 'En attente';
    }
    showScreen('lobby');
  },
  // Callback "Menu principal"
  () => {
    isGameActive = false;
    isMockMode = false;
    showScreen('menu');
  },
);

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 5. État global du faux serveur (Mock) pour le test local
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
  isGameActive = true;
  isMockMode = true;
  showScreen('game');

  // Réinitialiser la position du joueur test
  mockGameState.players[0].x = 1;
  mockGameState.players[0].y = 1;
  mockGameState.players[0].direction = 'DOWN';

  // Réinitialisation du HUD pour la nouvelle partie
  eventBus.emit('HUD_TIMER_RESET', { seconds: 0 });
  eventBus.emit('HUD_TIMER_START');
  eventBus.emit('HUD_UPDATE_BOMBS', { available: 1, max: 1 });
  eventBus.emit('HUD_UPDATE_SCORE', { score: 0 });
  eventBus.emit('HUD_UPDATE_LIVES', { lives: 3, maxLives: 3 });

  // Émettre le premier état de jeu
  eventBus.emit('GAME_STATE_UPDATE', mockGameState);
}

// 6. Événements des boutons de navigation

// Clic sur "Rejoindre une partie" depuis l'écran d'accueil
btnJoinGame.addEventListener('click', () => {
  const enteredName = playerNameInput?.value.trim();
  currentPseudo = enteredName && enteredName.length > 0 ? enteredName : 'Joueur 1';
  isMockMode = false;

  if (currentPlayerLabel) {
    currentPlayerLabel.textContent = `${currentPseudo} (Toi)`;
  }

  // Notifier le serveur WebSocket de l'arrivée du joueur
  eventBus.emit('JOIN_LOBBY', { name: currentPseudo });

  // Affichage du salon d'attente
  showScreen('lobby');
});

// Clic sur "Mode Entraînement (Test Solo)" depuis l'écran d'accueil
btnStartMock.addEventListener('click', () => {
  startMockGame();
});

// Clic sur "Je suis prêt !" dans le salon d'attente
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

// Clic sur "Lancer la partie" depuis le salon d'attente
btnStartGame.addEventListener('click', () => {
  // En multijoueur, le jeu démarre via l'événement GAME_START du serveur quand tous les joueurs sont prêts.
  // Si le serveur est hors-ligne, on permet de tester en local.
  if (serverStatusDot && serverStatusDot.classList.contains('offline')) {
    startMockGame();
  }
});

// Clic sur "Retour au menu" depuis le salon d'attente
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


// Clic sur "Quitter la partie" depuis la zone de jeu
if (btnLeaveGame) {
  btnLeaveGame.addEventListener('click', () => {
    isGameActive = false;
    isMockMode = false;
    gameOverManager.hide();
    eventBus.emit('HUD_TIMER_STOP');
    showScreen('menu');
  });
}

// 7. Écouteurs d'événements réseau

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

// Réception de l'ID joueur local attribué par le serveur dès la connexion
eventBus.on('WELCOME', (payload: unknown) => {
  const data = payload as { playerId: string };
  if (data?.playerId) {
    localPlayerId = data.playerId;
  }
});

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

eventBus.on('GAME_START', (payload: unknown) => {
  const data = payload as { initialState?: unknown; playerId?: string };
  isGameActive = true;
  isMockMode = false;
  // Mémoriser l'ID local reçu à la connexion (WELCOME) ou au GAME_START
  if (data?.playerId) localPlayerId = data.playerId;
  showScreen('game');

  eventBus.emit('HUD_TIMER_RESET', { seconds: 0 });
  eventBus.emit('HUD_TIMER_START');

  if (data?.initialState) {
    eventBus.emit('GAME_STATE_UPDATE', data.initialState);
  }
});

// Événement GAME_OVER reçu du serveur
interface GameOverPayload {
  winnerId: string | null;
  winnerName?: string | null;
}

eventBus.on('GAME_OVER', (payload: unknown) => {
  const data = payload as GameOverPayload;
  isGameActive = false;
  isMockMode = false;
  gameOverManager.show({
    localPlayerId,
    winnerId: data.winnerId,
    winnerName: data.winnerName,
  });
});

// 8. Faux Serveur : Gestion continue des déplacements en boucle de jeu
const activeDirections = new Set<string>();

eventBus.on('USER_ACTION', (action: unknown) => {
  const kbAction = action as { type: string; payload: { direction: string } };

  if (kbAction.type === 'MOVE_START') activeDirections.add(kbAction.payload.direction);
  if (kbAction.type === 'MOVE_END') activeDirections.delete(kbAction.payload.direction);
});

// 8b. [DEBUG MOCK] Touche G = déclencher manuellement un Game Over de test
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'g' || e.key === 'G') {
    if (!isGameActive || gameOverManager.isVisible()) return;
    // Alterner victoire et défaite à chaque pression pour faciliter les tests
    const isWin = Math.random() > 0.5;
    eventBus.emit('GAME_OVER', {
      winnerId: isWin ? localPlayerId || 'p1' : 'other-player-id',
      winnerName: isWin ? currentPseudo : 'Bot Ennemi',
    });
  }
});

// 9. Boucle de jeu Mock (60 FPS - uniquement active en mode Entraînement Solo)
setInterval(() => {
  if (!isGameActive || !isMockMode) return;
  if (activeDirections.size === 0) return;

  const player = mockGameState.players[0];
  const speed = 0.08;

  const { dx, dy, direction } = calculateMovementDelta(activeDirections, speed);
  if (direction) {
    player.direction = direction;
  }

  const newX = player.x + dx;
  const newY = player.y + dy;

  const gridX = Math.round(newX);
  const gridY = Math.round(newY);

  if (mockGameState.grid[gridY] && mockGameState.grid[gridY][gridX] === 0) {
    player.x = newX;
    player.y = newY;
    eventBus.emit('GAME_STATE_UPDATE', mockGameState);
  }
}, 1000 / 60);

// État initial : afficher le menu principal
showScreen('menu');
