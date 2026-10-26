import { z } from 'zod';
import { adsConfigurationSchema, type AdsConfiguration } from './config';

export const SOURCE_ADMOB_ORIGIN = 'https://tntbjulojatnrqmylorp.supabase.co';
export const SOURCE_ADMOB_RPC = 'get_source_admob_configuration_v1';
export const SOURCE_ADMOB_PROTOCOL = 'source-mirror-v1';
const snapshotSchema = z.object({
  schema: z.literal('anacan-admob-source-v1'),
  sourceGeneration: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  upstreamRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  emergencyDisabled: z.boolean(), syncedAt: z.string().datetime({ offset: true }),
  configuration: adsConfigurationSchema,
}).strict().refine(value => value.configuration.revision === value.upstreamRevision
  && (!value.emergencyDisabled || !value.configuration.settings.enabled));
export type SourceAdmobSnapshot = z.infer<typeof snapshotSchema>;
export interface AdmobMirrorStatus {
  available: boolean; ready: boolean; upstreamRevision?: number; sourceGeneration?: number;
  emergencyDisabled?: boolean; syncedAt?: string;
}
export function parseSourceAdmobSnapshot(value: unknown): SourceAdmobSnapshot | null {
  const result = snapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function mirrorStatus(snapshot: SourceAdmobSnapshot | null, primary: AdsConfiguration): AdmobMirrorStatus {
  if (!snapshot) return { available: false, ready: false };
  return { available: true, ready: snapshot.upstreamRevision >= primary.revision, upstreamRevision: snapshot.upstreamRevision,
    sourceGeneration: snapshot.sourceGeneration, emergencyDisabled: snapshot.emergencyDisabled, syncedAt: snapshot.syncedAt };
}
