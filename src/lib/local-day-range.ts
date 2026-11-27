/**
 * Timestamptz bounds for a local calendar day. `${day}T00:00:00` without an offset is read by Postgres in the
 * session time zone (UTC), so in Baku a "today" filter missed 00:00-04:00 and took 00:00-04:00 of tomorrow.
 */
export const localDayStartIso = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
};
