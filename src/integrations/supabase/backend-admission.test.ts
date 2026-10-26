import { describe, expect, it } from 'vitest';
import { INITIAL_SOURCE_ADMISSION as SOURCE, advanceAdmission, assertAdmissionReady, compareNativeVersions,
  parseAdmissionPin, parseBackendAdmission, reconcileAdmissionPins, type BackendAdmission } from './backend-admission';

const azure = parseBackendAdmission({ ...SOURCE, generation: 2, phase: 'azure', handoffSha256: 'a'.repeat(64) });
const maintenance = parseBackendAdmission({ ...SOURCE, generation: 1, phase: 'maintenance' });
const sourcePin = advanceAdmission(null, SOURCE);
const azurePin = advanceAdmission(sourcePin, azure);

it('requires an explicit server handoff receipt for Azure, not a generic ready flag or URL', () => {
  for (const value of [null, [], {}, { ...azure, handoffSha256: null }, { ...azure, handoffSha256: 'ready' },
    { ...azure, generation: 0 }, { ...azure, generation: 1.2 }, { ...azure, generation: -1 },
    { ...azure, schema: 'unknown' }, { ...SOURCE, phase: 'ready' }, { ...SOURCE, url: 'https://untrusted.example' },
    { ...SOURCE, handoffSha256: 'b'.repeat(64) }, { ...SOURCE, minNativeVersion: 'NaN' }]) {
    expect(() => parseBackendAdmission(value)).toThrow('ADMISSION_INVALID');
  }
});

it('keeps an Azure authority latched through maintenance and refuses source rollback', () => {
  const paused = advanceAdmission(azurePin, { ...maintenance, generation: 3 });
  expect(paused.authority).toBe('azure');
  expect(() => assertAdmissionReady(paused, '28.0')).toThrow('ADMISSION_MAINTENANCE');
  expect(() => advanceAdmission(paused, { ...SOURCE, generation: 4 })).toThrow('ADMISSION_ROLLBACK');
  expect(advanceAdmission(paused, { ...azure, generation: 4 }).authority).toBe('azure');
});

it('rejects stale policy generations and equivocation within a generation', () => {
  for (const policy of [SOURCE, { ...azure, minNativeVersion: '29.0' }, { ...azure, handoffSha256: 'b'.repeat(64) }]) {
    expect(() => advanceAdmission(azurePin, policy as BackendAdmission)).toThrow('ADMISSION_ROLLBACK');
  }
  expect(advanceAdmission(azurePin, azure)).toEqual(azurePin);
});

it('can resume source after a pre-handoff maintenance window using a newer generation', () => {
  expect(advanceAdmission(advanceAdmission(sourcePin, maintenance), { ...SOURCE, generation: 2 }).authority).toBe('source');
});

it('reconciles a torn native/WebView mirror by retaining the newer authority', () => {
  for (const [a, b] of [[sourcePin, azurePin], [azurePin, sourcePin], [null, azurePin], [azurePin, null]]) {
    expect(reconcileAdmissionPins(a, b)).toEqual(azurePin);
  }
  expect(reconcileAdmissionPins(null, null)).toBeNull();
  expect(() => reconcileAdmissionPins(azurePin, advanceAdmission(null, { ...SOURCE, generation: 3 })))
    .toThrow('ADMISSION_ROLLBACK');
});

it('does not guess when an authority pin is malformed or contradicts its policy', () => {
  for (const value of ['', 'not-json', 'null', '{}', JSON.stringify({ ...azurePin, authority: 'source' }),
    JSON.stringify({ ...sourcePin, extra: true }), JSON.stringify({ ...sourcePin, policy: { ...SOURCE, phase: 'ready' } })]) {
    expect(() => parseAdmissionPin(value)).toThrow('ADMISSION_STORAGE');
  }
  expect(parseAdmissionPin(JSON.stringify(azurePin))).toEqual(azurePin);
});

describe('native version comparison', () => {
  it.each([['28.0', '28', 0], ['28.0.1', '28.0', 1], ['9.0', '28.0', -1], ['28.10', '28.2', 1],
    ['25', '28.0', -1], ['28.0.0.0', '28', 0], ['28beta', '28', null], ['', '28', null]])('%s versus %s', (a, b, result) => {
    expect(compareNativeVersions(a, b)).toBe(result);
  });
  it('admits current/newer builds and refuses an older or unknown native version', () => {
    expect(() => assertAdmissionReady(sourcePin, '28.0')).not.toThrow();
    expect(() => assertAdmissionReady(sourcePin, '29.0')).not.toThrow();
    for (const version of ['25.0', '', 'unknown']) expect(() => assertAdmissionReady(sourcePin, version)).toThrow('ADMISSION_UPDATE_REQUIRED');
  });
});
