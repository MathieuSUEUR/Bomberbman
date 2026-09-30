import { PlayerState, PowerUp, PowerUpType } from '@bomberman/shared';

// Reduction du delai de recharge par bonus REDUCED_BOMB_DELAY (20 ticks = 1 seconde a 20 ticks/s)
const RECHARGE_STEP_TICKS = 20;
// Delai de recharge minimal atteignable
const MIN_RECHARGE_TICKS = 20;

export interface PowerUpPickup {
    playerId: string;
    powerUp: PowerUp;
}

export class PowerUpManager {
    /**
     * Ramasse les power-ups sous les joueurs vivants et applique leur effet.
     * Modifie la liste powerUps en place (parcours a l'envers pour pouvoir supprimer).
     */
    public collect(players: Map<string, PlayerState>, powerUps: PowerUp[]): PowerUpPickup[] {
        const pickups: PowerUpPickup[] = [];

        for (let i = powerUps.length - 1; i >= 0; i--) {
            const pu = powerUps[i];
            for (const [id, player] of players) {
                if (player.isAlive && player.position.x === pu.position.x && player.position.y === pu.position.y) {
                    this.apply(player, pu.type);
                    pickups.push({ playerId: id, powerUp: pu });
                    powerUps.splice(i, 1);
                    break;
                }
            }
        }
        return pickups;
    }

    /** Applique l'effet d'un power-up sur un joueur. */
    private apply(player: PlayerState, type: PowerUpType): void {
        switch (type) {
            case PowerUpType.EXTRA_BOMB:
                // Le stock augmente aussi, sinon le bonus serait inutilisable avant une recharge
                player.maxBombs++;
                player.bombStock++;
                break;
            case PowerUpType.EXTRA_RANGE:
                player.bombRange++;
                break;
            case PowerUpType.SPEED_UP:
                player.speed++;
                break;
            case PowerUpType.REDUCED_BOMB_DELAY:
                player.bombRechargeTicks = Math.max(MIN_RECHARGE_TICKS, player.bombRechargeTicks - RECHARGE_STEP_TICKS);
                break;
            case PowerUpType.EXTRA_LIFE:
                player.lives++;
                break;
        }
    }
}