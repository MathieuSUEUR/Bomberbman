import './style.css';
import { GameRenderer } from './view/GameRenderer';
import { eventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { SocketManager } from './network/SocketManager';

// 1. Initialisation de l'affichage du Canvas
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
canvas.width = 500;
canvas.height = 500;
new GameRenderer(canvas);

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
let isPlayerReady = false;
let isGameActive = false;

type ScreenType = 'menu' | 'lobby' | 'game';

function showScreen(screen: ScreenType): void {
  mainMenu.style.display = screen === 'menu' ? 'flex' : 'none';
  lobbyScreen.style.display = screen === 'lobby' ? 'flex' : 'none';
  if (gameContainer) {
    gameContainer.style.display = screen === 'game' ? 'flex' : 'none';
  }
  gameCanvas.style.display = screen === 'game' ? 'block' : 'none';
}

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
  showScreen('game');

  // Réinitialiser la position du joueur test
  mockGameState.players[0].x = 1;
  mockGameState.players[0].y = 1;
  mockGameState.players[0].direction = 'DOWN';

  // Émettre le premier état de jeu
  eventBus.emit('GAME_STATE_UPDATE', mockGameState);
}

// 6. Événements des boutons de navigation

// Clic sur "Rejoindre une partie" depuis l'écran d'accueil
btnJoinGame.addEventListener('click', () => {
  const enteredName = playerNameInput?.value.trim();
  currentPseudo = enteredName && enteredName.length > 0 ? enteredName : 'Joueur 1';

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
  startMockGame();
});

// Clic sur "Retour au menu" depuis le salon d'attente
btnBackMenu.addEventListener('click', () => {
  isPlayerReady = false;
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
  const data = payload as { initialState?: unknown };
  isGameActive = true;
  showScreen('game');

  if (data?.initialState) {
    eventBus.emit('GAME_STATE_UPDATE', data.initialState);
  }
});

// 8. Faux Serveur : Gestion continue des déplacements en boucle de jeu
const activeDirections = new Set<string>();

eventBus.on('USER_ACTION', (action: unknown) => {
  const kbAction = action as { type: string; payload: { direction: string } };

  if (kbAction.type === 'MOVE_START') activeDirections.add(kbAction.payload.direction);
  if (kbAction.type === 'MOVE_END') activeDirections.delete(kbAction.payload.direction);
});

// 9. Boucle de jeu Mock (60 FPS)
setInterval(() => {
  if (!isGameActive) return;
  if (activeDirections.size === 0) return;

  const player = mockGameState.players[0];
  const speed = 0.08;

  let newX = player.x;
  let newY = player.y;

  if (activeDirections.has('UP')) {
    newY -= speed;
    player.direction = 'UP';
  }
  if (activeDirections.has('DOWN')) {
    newY += speed;
    player.direction = 'DOWN';
  }
  if (activeDirections.has('LEFT')) {
    newX -= speed;
    player.direction = 'LEFT';
  }
  if (activeDirections.has('RIGHT')) {
    newX += speed;
    player.direction = 'RIGHT';
  }

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
