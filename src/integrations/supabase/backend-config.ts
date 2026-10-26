import { AZURE_API_ORIGIN, BackendAdmissionError, type AdmissionPin } from './backend-admission';
import { SOURCE_AUTH_REALM } from './auth-storage-key';

export interface BackendConfig {
  url: string;
  publishableKey: string;
  azure: boolean;
  sourceFirst: boolean;
  admission?: AdmissionPin;
}

let selected: Readonly<BackendConfig> | undefined;

export const usesSourceFirstBootstrap = () => import.meta.env.VITE_BACKEND_BOOTSTRAP === 'source-first-v1';

export function selectAdmittedBackend(pin: AdmissionPin): Readonly<BackendConfig> {
  if (!usesSourceFirstBootstrap() || selected || pin.policy.phase === 'maintenance'
    || import.meta.env.VITE_AUTH_CUTOVER === 'true'
    || import.meta.env.VITE_SUPABASE_URL !== AZURE_API_ORIGIN
    || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || !import.meta.env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY === import.meta.env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY) {
    throw new BackendAdmissionError('ADMISSION_CONFIGURATION');
  }
  selected = Object.freeze({
    url: pin.authority === 'source' ? SOURCE_AUTH_REALM : AZURE_API_ORIGIN,
    publishableKey: pin.authority === 'source'
      ? import.meta.env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    azure: pin.authority === 'azure', sourceFirst: true, admission: pin,
  });
  return selected;
}

// No SDK import here. A premature app import fails before it can refresh tokens.
export function getBackendConfig(): Readonly<BackendConfig> {
  if (selected) return selected;
  if (usesSourceFirstBootstrap()) throw new BackendAdmissionError('ADMISSION_CONFIGURATION');
  return { url: import.meta.env.VITE_SUPABASE_URL, publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    azure: import.meta.env.MODE === 'azure' || import.meta.env.MODE === 'google', sourceFirst: false };
}

export const isAzureBackend = () => getBackendConfig().azure;
export const isAzurePairingBackend = () => import.meta.env.VITE_AZURE_PARTNER_PAIRING === 'true'
  && (!usesSourceFirstBootstrap() || isAzureBackend());
