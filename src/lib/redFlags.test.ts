import { describe, expect, it } from 'vitest';
import { DANGER_SIGNS, getDangerSignsForStage } from './redFlags';

const ids = (list: { id: string }[]) => list.map((d) => d.id);

describe('getDangerSignsForStage', () => {
  it('lists urgent signs before the "soon" ones', () => {
    for (const stage of ['bump', 'mommy']) {
      const severities = getDangerSignsForStage(stage).map((d) => d.severity);
      const firstSoon = severities.indexOf('soon');
      expect(firstSoon).toBeGreaterThan(0);
      expect(severities.slice(firstSoon).every((s) => s === 'soon')).toBe(true);
    }
  });

  it('keeps pregnancy and postpartum signs apart', () => {
    const bump = ids(getDangerSignsForStage('bump'));
    const mommy = ids(getDangerSignsForStage('mommy'));
    expect(bump).toContain('decreased_movement');
    expect(bump).not.toContain('heavy_bleeding_pp');
    expect(mommy).toContain('heavy_bleeding_pp');
    expect(mommy).toContain('sad_thoughts');
    expect(mommy).not.toContain('waters_broke');
    // Fever 38 °C and chest pain / breathlessness matter in both stages.
    for (const id of ['fever_38', 'chest_pain_breath']) {
      expect(bump).toContain(id);
      expect(mommy).toContain(id);
    }
  });

  it('treats an unknown or missing stage as pregnancy', () => {
    expect(ids(getDangerSignsForStage(null))).toEqual(ids(getDangerSignsForStage('bump')));
    expect(ids(getDangerSignsForStage('partner'))).toEqual(ids(getDangerSignsForStage('bump')));
  });

  it('shows the twin (TTTS) sign only for multiples', () => {
    expect(ids(getDangerSignsForStage('bump'))).not.toContain('ttts_signs');
    expect(ids(getDangerSignsForStage('bump', true))).toContain('ttts_signs');
    expect(ids(getDangerSignsForStage('mommy', true))).not.toContain('ttts_signs');
  });

  it('has unique ids, text and at least one stage for every sign', () => {
    expect(new Set(ids(DANGER_SIGNS)).size).toBe(DANGER_SIGNS.length);
    for (const sign of DANGER_SIGNS) {
      expect(sign.title.length).toBeGreaterThan(0);
      expect(sign.desc.length).toBeGreaterThan(0);
      expect(sign.stages.length).toBeGreaterThan(0);
    }
  });
});
