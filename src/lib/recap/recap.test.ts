import { describe, expect, it } from 'vitest';
import { buildRecapModel, fitDurations, pickPersona, RECAP_TIMING } from './model';
import { renderRecapFrame, sceneIndexAt } from './render';
import { recapSource } from './copy';
import { RECAP_DEMO_LABELS_AZ, RECAP_PERSONAS } from './fixtures';
import { formatNumber, formatPercent, formatUnit, pluralOf } from './numbers';
import { PACE, sceneBuildTime } from './pace';
import { personaFeatures, pickPersonaDef, RECAP_PERSONA_TABLE, scorePersona, type PersonaDef } from './persona';
import { parseRecap, type RecapData, type RecapModel, type StatScene } from './types';

const build = (d: RecapData, lang = 'az') => buildRecapModel(d, lang, recapSource, { labels: RECAP_DEMO_LABELS_AZ });
const ids = (m: RecapModel) => m.scenes.map((s) => s.id);
const at = (m: RecapModel, id: string) => m.scenes.find((s) => s.id === id)!;

/** A recording 2D context: every call and property write goes into a log, so a frame can be hashed. */
function recordingContext() {
  const log: string[] = [];
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' && v ? '[obj]' : String(v));
  const gradient = () => ({ addColorStop: (o: number, c: string) => log.push(`stop ${fmt(o)} ${c}`) });
  const state: Record<string, unknown> = { font: '10px sans-serif' };
  const target: Record<string, unknown> = {
    canvas: { width: 1080, height: 1920 },
    measureText: (text: string) => {
      const size = Number(/(\d+)px/.exec(String(state.font))?.[1] ?? 10);
      return { width: [...text].length * size * 0.55 };
    },
    createLinearGradient: (...a: number[]) => { log.push(`lg ${a.map(fmt).join(',')}`); return gradient(); },
    createRadialGradient: (...a: number[]) => { log.push(`rg ${a.map(fmt).join(',')}`); return gradient(); },
    createPattern: () => ({ setTransform: () => undefined }),
  };
  const ctx = new Proxy(target, {
    get(t, key: string) {
      if (key in t) return t[key];
      if (key in state) return state[key];
      return (...args: unknown[]) => { log.push(`${key}(${args.map(fmt).join(',')})`); };
    },
    set(_t, key: string, value) { state[key] = value; log.push(`${key}=${fmt(value)}`); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

const hash = (lines: string[]) => {
  let h = 2166136261;
  for (const line of lines) for (let i = 0; i < line.length; i++) { h ^= line.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
};

describe('buildRecapModel — scene selection', () => {
  it('heavy mommy: the four strongest stage scenes plus the journey, then peak / persona / summary / outro', () => {
    const m = build(RECAP_PERSONAS.mommy);
    expect(ids(m)).toEqual(['cold', 'journey', 'mommy_feed', 'mommy_sleep', 'mommy_milestones', 'mommy_growth', 'peak', 'persona', 'summary', 'outro']);
    expect((at(m, 'mommy_feed') as StatScene).badge).toBe('Ən fəal 5% arasındasan');
    expect(at(m, 'mommy_milestones')).toMatchObject({ items: ['İlk təbəssüm', 'Başını tutdu', 'Çevrildi', 'İlk gülüş'], more: '+6 daha' });
    expect(at(m, 'mommy_growth')).toMatchObject({ line: 'Leyla bu il 6,2 kq böyüdü.', gain: '+6,2 kq' });
    expect(at(m, 'cold')).toMatchObject({ title: 'Aynur, bu il sənin hekayən idi.' });
    expect(m.persona).toBe('night');
    expect(at(m, 'persona')).toMatchObject({ title: 'Gecə Qəhrəmanı' });
  });

  it('a longer track lets more scenes in (days together returns)', () => {
    const music = { length: 70, drop: 16, breath: 44, lift: 46, tail: 62, end: 66.2, beat: 0.5 };
    const m = buildRecapModel(RECAP_PERSONAS.mommy, 'az', recapSource, { labels: RECAP_DEMO_LABELS_AZ, music });
    expect(ids(m)).toEqual(expect.arrayContaining(['days', 'journey', 'mommy_feed', 'mommy_growth']));
    expect(at(m, 'peak').start).toBe(44);
    expect(at(m, 'outro').start).toBe(62);
    expect(m.duration).toBe(66.2);
  });

  it('bump: weeks, kicks and hospital bag', () => {
    const m = build(RECAP_PERSONAS.bump);
    expect(ids(m)).toEqual(expect.arrayContaining(['journey', 'bump_weeks', 'bump_kicks', 'bump_bag']));
    expect((at(m, 'bump_weeks') as StatScene).value.text).toBe('6 → 34');
    expect((at(m, 'bump_kicks') as StatScene).value.n).toBe(1172);
  });

  it('flow: cycles, logged days, mood colour and water', () => {
    const m = build(RECAP_PERSONAS.flow);
    expect(ids(m)).toEqual(expect.arrayContaining(['days', 'flow_cycles', 'flow_days', 'flow_mood', 'flow_water']));
    expect((at(m, 'flow_mood') as StatScene).subs).toEqual(['Ən çox qeyd etdiyin: şişkinlik']);
    expect((at(m, 'flow_cycles') as StatScene).subs).toEqual(['Orta dövr: 28 gün', 'Menstruasiya: 5 gün']);
    expect(ids(m)).not.toContain('journey');
  });

  it('light user: a full video from the fallback scenes, nothing shown as zero', () => {
    const m = build(RECAP_PERSONAS.light);
    expect(ids(m)).toEqual(['cold', 'days', 'anacan_hour', 'anacan_ai', 'anacan_community', 'peak', 'persona', 'summary', 'outro']);
    for (const s of m.scenes) {
      if (s.kind === 'stat') expect(s.value.text ?? s.value.n).not.toBe(0);
      if (s.kind === 'peak' || s.kind === 'summary') for (const st of s.stats) expect(st.n).toBeGreaterThan(0);
    }
    expect(at(m, 'cold')).toMatchObject({ title: 'Bu il sənin hekayən idi.' });
    expect(m.duration).toBeGreaterThanOrEqual(45);
  });

  it('an empty year still gives a short, valid video', () => {
    const empty = parseRecap({ available: true, year: 2026, stage: 'mommy', mommy: { feedings: 0 } }) as RecapData;
    const m = build(empty);
    expect(ids(m)).toEqual(['cold', 'peak', 'persona', 'summary', 'outro']);
    expect(m.scenes.every((s) => s.end > s.start)).toBe(true);
  });

  it('never surfaces pregnancy for a person whose year went bump → flow', () => {
    const d = { ...RECAP_PERSONAS.flow, stages: ['bump', 'flow'] as RecapData['stages'], bump: RECAP_PERSONAS.bump.bump };
    const m = build(d);
    expect(ids(m).some((id) => id.startsWith('bump') || id === 'journey')).toBe(false);
  });

  it('skips a top-x % badge above 30 % and growth without a real gain', () => {
    const d = structuredClone(RECAP_PERSONAS.mommy);
    d.mommy!.feedings_top_pct = 45;
    d.mommy!.weight_end_kg = d.mommy!.weight_start_kg;
    const m = build(d);
    expect((at(m, 'mommy_feed') as StatScene).badge).toBeNull();
    expect(ids(m)).not.toContain('mommy_growth');
  });

  it('persona "why" lines are picked by a stable per-person seed', () => {
    const lines = new Set<string>();
    for (const seed of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) {
      const a = buildRecapModel(RECAP_PERSONAS.mommy, 'az', recapSource, { seed });
      const b = buildRecapModel(RECAP_PERSONAS.mommy, 'az', recapSource, { seed });
      expect(at(a, 'persona')).toEqual(at(b, 'persona'));
      lines.add((at(a, 'persona') as { reason: string }).reason);
    }
    expect(lines.size).toBe(2);
  });

  it('the persona table is data: stage-limited rows and custom terms', () => {
    const table: PersonaDef[] = [
      { id: 'water', stages: ['flow'], lines: 1, terms: [{ input: 'water', from: 100, to: 500, weight: 5 }] },
      ...RECAP_PERSONA_TABLE,
    ];
    expect(pickPersonaDef(RECAP_PERSONAS.flow, table).id).toBe('water');
    expect(pickPersonaDef({ ...RECAP_PERSONAS.mommy }, table).id).toBe('night');
    expect(scorePersona(table[0], personaFeatures(RECAP_PERSONAS.light))).toBe(0);
  });

  it('personas follow the data', () => {
    expect(pickPersona(RECAP_PERSONAS.mommy)).toBe('night');
    expect(pickPersona({ ...RECAP_PERSONAS.light, favorite_hour: 12, likes: 40, comments: 10, posts: 2 })).toBe('community');
    expect(pickPersona({ ...RECAP_PERSONAS.light, favorite_hour: 12, ai_questions: 40, posts_read: 80 })).toBe('knowledge');
    expect(pickPersona({ ...RECAP_PERSONAS.light, favorite_hour: 12 })).toBe('caring');
  });
});

describe('buildRecapModel — timing on the music', () => {
  it.each(['mommy', 'bump', 'flow', 'light'] as const)('%s: cuts on the drop, the breath and the tail; 45–55 s', (p) => {
    const m = build(RECAP_PERSONAS[p]);
    expect(m.duration).toBeGreaterThanOrEqual(45);
    expect(m.duration).toBeLessThanOrEqual(55);
    expect(m.scenes.some((s) => s.start === RECAP_TIMING.drop)).toBe(true);
    expect(at(m, 'peak').start).toBe(RECAP_TIMING.breath);
    expect(at(m, 'outro').start).toBe(RECAP_TIMING.tail);
    m.scenes.forEach((s, i) => {
      if (i) expect(s.start).toBe(m.scenes[i - 1].end);
      expect(s.end - s.start).toBeLessThanOrEqual(7.51);
      // Fully built for at least 1.5 s before the exit transition.
      const hold = s.end - s.start - sceneBuildTime(s, false) - (s.kind === 'outro' ? 0 : PACE.exit);
      expect(hold, s.id).toBeGreaterThanOrEqual(1.5);
    });
    expect(m.hits).toEqual([RECAP_TIMING.drop, RECAP_TIMING.lift]);
  });

  it('fitDurations respects min/max', () => {
    expect(fitDurations(10, [{ min: 1, max: 3, w: 1 }, { min: 1, max: 9, w: 1 }])).toEqual([3, 7]);
  });
});

describe('renderRecapFrame — determinism', () => {
  const m = build(RECAP_PERSONAS.mommy);
  const frame = (t: number) => { const { ctx, log } = recordingContext(); renderRecapFrame(ctx, t, m, {}); return hash(log); };

  it('the same time draws the same frame; another time draws a different one', () => {
    for (const t of [0.5, 12, 17.3, 31, 33.4, 44, 50]) expect(frame(t)).toBe(frame(t));
    expect(frame(17.3)).not.toBe(frame(17.4));
  });

  it('every scene renders without throwing, also in Arabic and Japanese', () => {
    for (const lang of ['az', 'ar', 'ja', 'ru']) {
      const model = build(RECAP_PERSONAS.flow, lang);
      for (let t = 0; t < model.duration; t += 0.7) {
        const { ctx } = recordingContext();
        expect(() => renderRecapFrame(ctx, t, model, {})).not.toThrow();
      }
      expect(sceneIndexAt(model, model.duration + 5)).toBe(model.scenes.length - 1);
    }
  });
});

describe('numbers', () => {
  it('formats per language without Intl', () => {
    expect(formatNumber('az', 1576)).toBe('1 576');
    expect(formatNumber('az', 6.2, 1)).toBe('6,2');
    expect(formatNumber('en', 1576)).toBe('1,576');
    expect(formatNumber('es', 1576)).toBe('1576');
    expect(formatNumber('es', 15760)).toBe('15.760');
    expect(formatPercent('tr', 5)).toBe('%5');
    expect(formatUnit('ru', 21, 'day')).toBe('21 день');
    expect(formatUnit('ru', 23, 'day')).toBe('23 дня');
    expect(formatUnit('ru', 47, 'day')).toBe('47 дней');
    expect(formatUnit('pl', 22, 'day')).toBe('22 dni');
    expect(formatUnit('en', 6.5, 'hour', 1)).toBe('6.5 hours');
    expect(formatUnit('ja', 6, 'hour')).toBe('6時間');
    expect(formatUnit('az', 3.2, 'kilogram', 1)).toBe('3,2 kq');
    expect(pluralOf('ar', 11)).toBe('many');
  });
});
