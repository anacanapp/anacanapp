import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export const canonicalContent = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);

/** Exact source binding, independent of mutable timestamps or backend hostname.
 * Base/AZ/EN all participate so an edited source cannot display a stale mirror. */
export function contentTranslationKey(row, field) {
  if (!row || !['string', 'number'].includes(typeof row.id)) return null;
  const value = canonicalContent([row[field] ?? null, row[`${field}_az`] ?? null, row[`${field}_en`] ?? null]);
  return `${row.id}:${field}:${bytesToHex(sha256(new TextEncoder().encode(value)))}`;
}
