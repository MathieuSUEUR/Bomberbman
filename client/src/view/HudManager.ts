import { eventBus } from '../core/EventBus';

export interface HudData {
  timerSeconds: number;
  score: number;
  availableBombs: number;
  maxBombs: number;
}

export interface HudOptions {
  initialTimerSeconds?: number;
  initialScore?: number;
  initialBombs?: number;
  initialMaxBombs?: number;
}

export class HudManager {
  private container: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private scoreElement: HTMLElement | null = null;
  private bombCountElement: HTMLElement | null = null;
  private bombSlotsContainer: HTMLElement | null = null;

  private timerSeconds: number;
  private score: number;
  private availableBombs: number;
  private maxBombs: number;

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private isTimerRunning = false;

  constructor(parent?: HTMLElement | null, options: HudOptions = {}) {
    this.timerSeconds = options.initialTimerSeconds ?? 0;
    this.score = options.initialScore ?? 0;
    this.availableBombs = options.initialBombs ?? 1;
    this.maxBombs = options.initialMaxBombs ?? 1;

    if (typeof document !== 'undefined' && parent) {
      this.container = document.createElement('div');
      this.container.className = 'game-hud-overlay';
      this.container.id = 'game-hud-overlay';
      this.render();
      parent.appendChild(this.container);
    }

    this.setupEventListeners();
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="hud-item hud-timer" id="hud-timer-card">
        <span class="hud-icon" aria-hidden="true">⏱️</span>
        <div class="hud-info">
          <span class="hud-label">TEMPS</span>
          <span class="hud-value" id="hud-timer-value">${this.formatTime(this.timerSeconds)}</span>
        </div>
      </div>

      <div class="hud-item hud-score" id="hud-score-card">
        <span class="hud-icon" aria-hidden="true">🏆</span>
        <div class="hud-info">
          <span class="hud-label">SCORE</span>
          <span class="hud-value" id="hud-score-value">${this.score}</span>
        </div>
      </div>

      <div class="hud-item hud-bombs" id="hud-bombs-card">
        <span class="hud-icon" aria-hidden="true">💣</span>
        <div class="hud-info">
          <span class="hud-label">BOMBES</span>
          <div class="hud-bombs-wrapper">
            <span class="hud-value" id="hud-bombs-value">${this.availableBombs}/${this.maxBombs}</span>
            <div class="hud-bomb-slots" id="hud-bomb-slots"></div>
          </div>
        </div>
      </div>
    `;

    this.timerElement = this.container.querySelector('#hud-timer-value');
    this.scoreElement = this.container.querySelector('#hud-score-value');
    this.bombCountElement = this.container.querySelector('#hud-bombs-value');
    this.bombSlotsContainer = this.container.querySelector('#hud-bomb-slots');

    this.updateBombSlots();
  }

  private updateBombSlots(): void {
    if (!this.bombSlotsContainer || typeof document === 'undefined') return;
    this.bombSlotsContainer.innerHTML = '';

    for (let i = 0; i < this.maxBombs; i++) {
      const dot = document.createElement('span');
      dot.className = `hud-bomb-dot ${i < this.availableBombs ? 'active' : 'used'}`;
      this.bombSlotsContainer.appendChild(dot);
    }
  }

  private setupEventListeners(): void {
    eventBus.on('HUD_UPDATE_SCORE', (payload: unknown) => {
      const data = payload as { score?: number; delta?: number };
      if (typeof data?.score === 'number') {
        this.setScore(data.score);
      } else if (typeof data?.delta === 'number') {
        this.addScore(data.delta);
      }
    });

    eventBus.on('HUD_UPDATE_BOMBS', (payload: unknown) => {
      const data = payload as { available?: number; max?: number; delta?: number };
      if (typeof data?.max === 'number') {
        this.setMaxBombs(data.max);
      }
      if (typeof data?.available === 'number') {
        this.setBombs(data.available);
      } else if (typeof data?.delta === 'number') {
        this.setBombs(this.availableBombs + data.delta);
      }
    });

    eventBus.on('HUD_TIMER_START', () => {
      this.startTimer();
    });

    eventBus.on('HUD_TIMER_STOP', () => {
      this.stopTimer();
    });

    eventBus.on('HUD_TIMER_RESET', (payload?: unknown) => {
      const data = payload as { seconds?: number } | undefined;
      this.resetTimer(data?.seconds ?? 0);
    });

    // Écoute de l'état de jeu pour synchroniser les informations quand disponibles
    eventBus.on('GAME_STATE_UPDATE', (payload: unknown) => {
      this.handleGameState(payload);
    });
  }

  public handleGameState(state: unknown): void {
    if (!state || typeof state !== 'object') return;
    const s = state as Record<string, unknown>;

    // Si le serveur fournit des ticks et un tickRate
    if (typeof s.tick === 'number') {
      const tickRate = 20; // Default tick rate
      const seconds = Math.floor(s.tick / tickRate);
      this.setTimer(seconds);
    }

    // Si on a un dictionnaire de joueurs ou une liste
    if (s.players) {
      if (Array.isArray(s.players)) {
        // En mode mock local, ou format liste
        const p1 = s.players[0] as
          { currentBombs?: number; maxBombs?: number; score?: number } | undefined;
        if (p1) {
          if (typeof p1.score === 'number') this.setScore(p1.score);
          if (typeof p1.maxBombs === 'number') this.setMaxBombs(p1.maxBombs);
          if (typeof p1.currentBombs === 'number' && typeof p1.maxBombs === 'number') {
            const available = Math.max(0, p1.maxBombs - p1.currentBombs);
            this.setBombs(available);
          }
        }
      } else if (typeof s.players === 'object') {
        // Record<string, PlayerState>
        const playersMap = s.players as Record<
          string,
          { currentBombs?: number; maxBombs?: number; score?: number }
        >;
        const firstPlayer = Object.values(playersMap)[0];
        if (firstPlayer) {
          if (typeof firstPlayer.score === 'number') this.setScore(firstPlayer.score);
          if (typeof firstPlayer.maxBombs === 'number') this.setMaxBombs(firstPlayer.maxBombs);
          if (
            typeof firstPlayer.currentBombs === 'number' &&
            typeof firstPlayer.maxBombs === 'number'
          ) {
            const available = Math.max(0, firstPlayer.maxBombs - firstPlayer.currentBombs);
            this.setBombs(available);
          }
        }
      }
    }
  }

  public setTimer(seconds: number): void {
    this.timerSeconds = Math.max(0, seconds);
    if (this.timerElement) {
      this.timerElement.textContent = this.formatTime(this.timerSeconds);
    }
  }

  public startTimer(): void {
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;
    this.timerInterval = setInterval(() => {
      this.setTimer(this.timerSeconds + 1);
    }, 1000);
  }

  public stopTimer(): void {
    this.isTimerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public resetTimer(seconds = 0): void {
    this.setTimer(seconds);
  }

  public setScore(score: number): void {
    this.score = Math.max(0, score);
    if (this.scoreElement) {
      this.scoreElement.textContent = String(this.score);
    }
  }

  public addScore(delta: number): void {
    this.setScore(this.score + delta);
  }

  public setBombs(available: number): void {
    this.availableBombs = Math.max(0, Math.min(this.maxBombs, available));
    if (this.bombCountElement) {
      this.bombCountElement.textContent = `${this.availableBombs}/${this.maxBombs}`;
    }
    this.updateBombSlots();
  }

  public setMaxBombs(max: number): void {
    this.maxBombs = Math.max(1, max);
    this.setBombs(Math.min(this.availableBombs, this.maxBombs));
  }

  public getHudData(): HudData {
    return {
      timerSeconds: this.timerSeconds,
      score: this.score,
      availableBombs: this.availableBombs,
      maxBombs: this.maxBombs,
    };
  }

  public formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
    const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
    return `${formattedMins}:${formattedSecs}`;
  }

  public destroy(): void {
    this.stopTimer();
    if (this.container) {
      this.container.remove();
    }
  }
}
