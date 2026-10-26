import { describe, expect, it } from 'vitest';
import { actorPresentation } from './presentation';
import { radiusForMass, viewZoom } from './model';

describe('arena readability and size cues', () => {
  it('keeps supergiants readable while preserving prey, peer and threat relationships', () => {
    const zoom = viewZoom(10, 390, 844);
    const giant = actorPresentation({ mass: 1e8, radius: radiusForMass(1e8) }, 10, zoom, 390, 844);
    expect(giant.radius).toBeLessThan(80); expect(giant.relation).toBe('threat'); expect(giant.showValue).toBe(true);
    expect(actorPresentation({ mass: 5, radius: radiusForMass(5) }, 10, zoom, 390, 844).relation).toBe('prey');
    expect(actorPresentation({ mass: 10, radius: radiusForMass(10) }, 10, zoom, 390, 844).relation).toBe('peer');
  });
  it('retains the player camera scale through very large endless valuations', () => {
    for (const mass of [10, 1e6, 1e15]) {
      const zoom = viewZoom(mass, 390, 844);
      const view = actorPresentation({ mass, radius: radiusForMass(mass) }, mass, zoom, 390, 844, true);
      expect(view.radius).toBeCloseTo(radiusForMass(mass) * zoom); expect(view.relation).toBe('player');
    }
  });
});
