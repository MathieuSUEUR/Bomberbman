/**
 * Calcule le déplacement (dx, dy) pour un ensemble de directions actives
 * en appliquant une vitesse constante indépendante de la direction (normalisation des diagonales).
 * 
 * En déplacement diagonal (ex: UP + RIGHT), chaque composante est divisée par Math.SQRT2
 * afin que la norme du vecteur de déplacement ||(dx, dy)|| = speed et non speed * sqrt(2).
 */
export function calculateMovementDelta(
  activeDirections: ReadonlySet<string>,
  speed: number
): { dx: number; dy: number; direction?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' } {
  let vx = 0;
  let vy = 0;

  if (activeDirections.has('LEFT')) vx -= 1;
  if (activeDirections.has('RIGHT')) vx += 1;
  if (activeDirections.has('UP')) vy -= 1;
  if (activeDirections.has('DOWN')) vy += 1;

  if (vx === 0 && vy === 0) {
    return { dx: 0, dy: 0 };
  }

  // Déterminer la direction principale (pour les sprites / animations)
  let direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | undefined;
  if (vy < 0) direction = 'UP';
  else if (vy > 0) direction = 'DOWN';
  else if (vx < 0) direction = 'LEFT';
  else if (vx > 0) direction = 'RIGHT';

  // Normalisation vectorielle si déplacement diagonal
  const length = Math.hypot(vx, vy);
  const dx = (vx / length) * speed;
  const dy = (vy / length) * speed;

  return { dx, dy, direction };
}
