// Credential-free protocol. URLs and API keys are never accepted from a policy.
// A published Azure policy is an operator assertion of the *server-side* handoff;
// client parsing is not proof that data, signing keys or refresh state were moved.
export const ADMISSION_URL = 'https://api.anacan.az/.well-known/anacan-backend.json';
export const ADMISSION_PIN_KEY = 'anacan.backend-admission.v1';
export const AZURE_API_ORIGIN = 'https://api.anacan.az';

export interface BackendAdmission {
  schema: 'anacan-backend-admission-v1';
  generation: number;
  phase: 'source' | 'maintenance' | 'azure';
  minNativeVersion: string;
  handoffSha256: string | null;
}

export interface AdmissionPin {
  schema: 'anacan-backend-pin-v1';
  authority: 'source' | 'azure';
  policy: BackendAdmission;
}

export class BackendAdmissionError extends Error {
  constructor(readonly code: 'ADMISSION_INVALID' | 'ADMISSION_ROLLBACK' | 'ADMISSION_STORAGE'
    | 'ADMISSION_MAINTENANCE' | 'ADMISSION_UPDATE_REQUIRED' | 'ADMISSION_CONFIGURATION') {
    super(code);
    this.name = 'BackendAdmissionError';
  }
}

export function compareNativeVersions(left: string, right: string): number | null {
  const valid = (value: string) => typeof value === 'string' && /^\d{1,9}(?:\.\d{1,9}){0,3}$/.test(value);
  if (!valid(left) || !valid(right)) return null;
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

export function parseBackendAdmission(value: unknown): BackendAdmission {
  const data = value as BackendAdmission | null;
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).sort().join(',') !== 'generation,handoffSha256,minNativeVersion,phase,schema'
    || data.schema !== 'anacan-backend-admission-v1'
    || !Number.isSafeInteger(data.generation) || data.generation < 0
    || !['source', 'maintenance', 'azure'].includes(data.phase)
    || compareNativeVersions(data.minNativeVersion, '0') === null
    || (data.phase === 'azure'
      ? data.generation === 0 || typeof data.handoffSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.handoffSha256)
      : data.handoffSha256 !== null)) {
    throw new BackendAdmissionError('ADMISSION_INVALID');
  }
  return Object.freeze({ schema: data.schema, generation: data.generation, phase: data.phase,
    minNativeVersion: data.minNativeVersion, handoffSha256: data.handoffSha256 });
}

export const INITIAL_SOURCE_ADMISSION = parseBackendAdmission({ schema: 'anacan-backend-admission-v1',
  generation: 0, phase: 'source', minNativeVersion: '28.0', handoffSha256: null });

export function parseAdmissionPin(value: string | null): AdmissionPin | null {
  if (value === null) return null;
  try {
    const pin = JSON.parse(value);
    if (!pin || Object.keys(pin).sort().join(',') !== 'authority,policy,schema'
      || pin.schema !== 'anacan-backend-pin-v1' || !['source', 'azure'].includes(pin.authority)) throw new Error();
    const policy = parseBackendAdmission(pin.policy);
    if (policy.phase !== 'maintenance' && policy.phase !== pin.authority) throw new Error();
    return { schema: pin.schema, authority: pin.authority, policy };
  } catch { throw new BackendAdmissionError('ADMISSION_STORAGE'); }
}

export function sameAdmission(left: BackendAdmission, right: BackendAdmission): boolean {
  return left.generation === right.generation && left.phase === right.phase
    && left.minNativeVersion === right.minNativeVersion && left.handoffSha256 === right.handoffSha256;
}

/** Source -> Azure is one-way. A failed target refresh must never try source. */
export function advanceAdmission(pin: AdmissionPin | null, policy: BackendAdmission): AdmissionPin {
  if (pin && (policy.generation < pin.policy.generation
    || (policy.generation === pin.policy.generation && !sameAdmission(policy, pin.policy))
    || (pin.authority === 'azure' && policy.phase === 'source'))) {
    throw new BackendAdmissionError('ADMISSION_ROLLBACK');
  }
  return { schema: 'anacan-backend-pin-v1',
    authority: policy.phase === 'maintenance' ? pin?.authority ?? 'source' : policy.phase, policy };
}

/** Recover a torn mirror write without rolling an Azure device back to source. */
export function reconcileAdmissionPins(left: AdmissionPin | null, right: AdmissionPin | null): AdmissionPin | null {
  if (!left) return right;
  if (!right) return left;
  const [older, newer] = left.policy.generation <= right.policy.generation ? [left, right] : [right, left];
  const next = advanceAdmission(older, newer.policy);
  if (next.authority !== newer.authority) throw new BackendAdmissionError('ADMISSION_STORAGE');
  return newer;
}

export function assertAdmissionReady(pin: AdmissionPin, nativeVersion: string): void {
  const comparison = compareNativeVersions(nativeVersion, pin.policy.minNativeVersion);
  if (comparison === null || comparison < 0) throw new BackendAdmissionError('ADMISSION_UPDATE_REQUIRED');
  if (pin.policy.phase === 'maintenance') throw new BackendAdmissionError('ADMISSION_MAINTENANCE');
}
