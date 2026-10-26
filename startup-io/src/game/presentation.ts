import { canAcquire, clamp } from './model';
import type { Actor } from './model';

/** Keep the world readable while retaining size cues between peers, prey and rivals. */
export function actorPresentation(actor: Pick<Actor, 'mass' | 'radius'>, playerMass: number, zoom: number, width: number, height: number, player = false) {
  const radius = actor.radius * zoom;
  const maximum = clamp(Math.min(width, height) * .18, 54, 105);
  const visibleRadius = player ? radius : Math.min(radius, maximum);
  const relation = player ? 'player' : canAcquire(actor.mass, playerMass) ? 'threat' : canAcquire(playerMass, actor.mass) ? 'prey' : 'peer';
  return { radius: visibleRadius, relation, showValue: !player && visibleRadius > 26, labelWidth: clamp(visibleRadius * 2.8, 80, 140) };
}
