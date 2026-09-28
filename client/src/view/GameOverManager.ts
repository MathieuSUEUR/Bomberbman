/**
 * GameOverManager
 *
 * Gère l'affichage et la fermeture de la modale Game Over.
 * Trois états visuels sont supportés :
 *   - 'victory' : le joueur local a gagné
 *   - 'defeat'  : le joueur local a perdu
 *   - 'draw'    : égalité ou aucun gagnant
 */

export type GameOverState = 'victory' | 'defeat' | 'draw';

export interface GameOverOptions {
  /** Identifiant du joueur local (pour différencier victoire / défaite) */
  localPlayerId: string;
  /** Identifiant du gagnant retourné par le serveur (null si nul) */
  winnerId: string | null;
  /** Nom affiché du gagnant (null si nul) */
  winnerName?: string | null;
}

const ICONS: Record<GameOverState, string> = {
  victory: '🏆',
  defeat: '💀',
  draw: '🤝',
};

const TITLES: Record<GameOverState, string> = {
  victory: 'VICTOIRE !',
  defeat: 'DÉFAITE...',
  draw: 'MATCH NUL',
};

const DESCRIPTIONS: Record<GameOverState, (winnerName?: string | null) => string> = {
  victory: () => 'Félicitations ! Tu as remporté la partie.',
  defeat: (name) =>
    name ? `${name} a remporté la partie. Bonne chance la prochaine fois !` : 'Tu as été éliminé.',
  draw: () => 'Aucun gagnant cette fois-ci.',
};

export class GameOverManager {
  private overlay: HTMLElement;
  private modal: HTMLElement;
  private iconEl: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;
  private winnerBadge: HTMLElement;
  private winnerNameEl: HTMLElement;
  private onPlayAgain: () => void;
  private onBackToMenu: () => void;

  constructor(onPlayAgain: () => void, onBackToMenu: () => void) {
    this.overlay = document.getElementById('game-over-overlay')!;
    this.modal = this.overlay.querySelector('.game-over-modal')!;
    this.iconEl = document.getElementById('game-over-icon')!;
    this.titleEl = document.getElementById('game-over-title')!;
    this.descEl = document.getElementById('game-over-desc')!;
    this.winnerBadge = document.getElementById('game-over-winner-badge')!;
    this.winnerNameEl = document.getElementById('game-over-winner-name')!;
    this.onPlayAgain = onPlayAgain;
    this.onBackToMenu = onBackToMenu;

    document.getElementById('btn-play-again')!.addEventListener('click', () => {
      this.hide();
      this.onPlayAgain();
    });

    document.getElementById('btn-back-to-menu')!.addEventListener('click', () => {
      this.hide();
      this.onBackToMenu();
    });

    // Fermeture en cliquant sur le backdrop
    this.overlay.querySelector('.game-over-backdrop')!.addEventListener('click', () => {
      this.hide();
      this.onBackToMenu();
    });

    // Fermeture par la touche Échap
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
        this.onBackToMenu();
      }
    });
  }

  /** Détermine l'état (victoire / défaite / nul) depuis les données serveur */
  private resolveState(options: GameOverOptions): GameOverState {
    if (options.winnerId === null) return 'draw';
    return options.winnerId === options.localPlayerId ? 'victory' : 'defeat';
  }

  /**
   * Affiche la modale avec l'état et le contenu appropriés.
   * Ré-déclenche les animations CSS en retirant et réajoutant l'élément.
   */
  public show(options: GameOverOptions): void {
    const state = this.resolveState(options);

    // Contenu
    this.iconEl.textContent = ICONS[state];
    this.titleEl.textContent = TITLES[state];
    this.descEl.textContent = DESCRIPTIONS[state](options.winnerName);

    // Badge gagnant : visible seulement si un gagnant existe
    if (options.winnerId !== null && options.winnerName) {
      this.winnerNameEl.textContent = options.winnerName;
      this.winnerBadge.style.display = 'inline-flex';
    } else {
      this.winnerBadge.style.display = 'none';
    }

    // Variante visuelle (victory | defeat | draw)
    this.modal.classList.remove('victory', 'defeat', 'draw');
    this.modal.classList.add(state);

    // Relancer les animations CSS en réinitialisant l'animation de l'overlay
    this.overlay.style.animation = 'none';
    // Forcer un reflow pour réinitialiser les animations
    void this.overlay.offsetWidth;
    this.overlay.style.animation = '';

    // Afficher l'overlay
    this.overlay.style.display = 'flex';

    // Focus management : focus sur le bouton Rejouer pour l'accessibilité
    setTimeout(() => {
      const firstBtn = this.overlay.querySelector<HTMLButtonElement>('button');
      if (firstBtn) firstBtn.focus();
    }, 400);
  }

  /** Masque la modale */
  public hide(): void {
    this.overlay.style.display = 'none';
    this.modal.classList.remove('victory', 'defeat', 'draw');
  }

  /** Indique si la modale est actuellement visible */
  public isVisible(): boolean {
    return this.overlay.style.display !== 'none';
  }
}
