import { describe, it, expect } from 'vitest';
import { classifyBp } from './bloodPressure';

// Bu, blood-pressure.ts:28-ün doğru təsnif etdiyini yoxlayır — yanlış hədd
// hamiləlikdə TƏHLÜKƏLİ (potensial ölümcül) preeklampsiya oxunuşuna qarşı
// SƏHV RAHATLIQ verə bilər.
describe('classifyBp', () => {
  it('classifies a normal reading as normal, no pregnancy alert', () => {
    const r = classifyBp(110, 70, false);
    expect(r.category).toBe('normal');
    expect(r.pregnancyAlert).toBe('none');
  });

  it('classifies elevated (120-129 systolic, <80 diastolic)', () => {
    expect(classifyBp(125, 75, false).category).toBe('elevated');
  });

  it('does not label a single 120/80 reading as hypertension in either life stage', () => {
    for (const isPregnant of [true, false]) {
      const reading = classifyBp(120, 80, isPregnant);
      expect(reading.label).not.toMatch(/hipertenziya|hypertension/i);
      expect(reading.pregnancyAlert).toBe('none');
    }
    expect(classifyBp(120, 80, true).category).toBe('normal');
  });

  it('keeps borderline pregnancy readings under observation without using adult stage1 labels', () => {
    expect(classifyBp(129, 84, true).category).toBe('normal');
    expect(classifyBp(130, 75, true).category).toBe('elevated');
    expect(classifyBp(120, 85, true).category).toBe('elevated');
    expect(classifyBp(139, 89, true).category).toBe('elevated');
    expect(classifyBp(140, 80, true).category).toBe('stage2');
    expect(classifyBp(120, 90, true).category).toBe('stage2');
  });

  it('preserves the adult AHA monitoring range (130-139/80-89)', () => {
    expect(classifyBp(135, 85, false).category).toBe('stage1');
    // Sistolik aşağı olsa da diastolik tək başına stage1 həddinə çatdıra bilər
    expect(classifyBp(125, 82, false).category).toBe('stage1');
  });

  it('classifies stage2 hypertension (>=140/>=90)', () => {
    expect(classifyBp(145, 92, false).category).toBe('stage2');
  });

  it('classifies hypertensive crisis (>=180/>=120) regardless of pregnancy', () => {
    const r = classifyBp(185, 125, false);
    expect(r.category).toBe('crisis');
  });

  it('classifies low blood pressure (<90 systolic OR <60 diastolic)', () => {
    expect(classifyBp(85, 55, false).category).toBe('low');
    expect(classifyBp(100, 55, false).category).toBe('low');
  });

  // ── Hamiləlik overlay-i (preeklampsiya) — bu ƏN KRİTİK hissədir ──
  it('does NOT raise a pregnancy alert for a non-pregnant user regardless of reading', () => {
    expect(classifyBp(165, 115, false).pregnancyAlert).toBe('none');
  });

  it('raises "warning" for a pregnant user at >=140/90 (gestational hypertension threshold)', () => {
    expect(classifyBp(140, 90, true).pregnancyAlert).toBe('warning');
    expect(classifyBp(142, 88, true).pregnancyAlert).toBe('warning'); // systolic-only trigger
    expect(classifyBp(138, 91, true).pregnancyAlert).toBe('warning'); // diastolic-only trigger
  });

  it('raises "urgent" for a pregnant user at >=160/110 (severe preeclampsia threshold)', () => {
    expect(classifyBp(160, 100, true).pregnancyAlert).toBe('urgent');
    expect(classifyBp(150, 110, true).pregnancyAlert).toBe('urgent');
    expect(classifyBp(170, 115, true).pregnancyAlert).toBe('urgent');
  });

  it('does not falsely raise a pregnancy alert just below the warning threshold', () => {
    expect(classifyBp(139, 89, true).pregnancyAlert).toBe('none');
  });

  it('boundary values are inclusive (exactly at threshold triggers the alert)', () => {
    expect(classifyBp(140, 89, true).pregnancyAlert).toBe('warning');
    expect(classifyBp(160, 109, true).pregnancyAlert).toBe('urgent');
  });
});
