# Source backend outage: diagnosis and recommended operator action

## Findings (read-only, 08:29 UTC)

| Check | Result |
|---|---|
| Platform status probe | Auth and database control endpoints answered (about 115 ms) |
| Recent resource-exhaustion alerts (48 h) | None recorded. Live metrics unavailable |
| SQL through the connection pooler (`select 1`, run twice) | Failed: "connection pooler unavailable" |
| Session, wait-event and lock inspection (`pg_stat_activity`) | Not possible: no query reaches Postgres |
| Postgres, edge and function logs (last 40–60 min) | Empty, including the 842-push daily run at 08:00 that is known to have happened. The log pipeline is not returning data |
| Edge OPTIONS | 200 (edge runtime is up; it does not touch the database) |

## Diagnosis

- **Blocker:** the database connection pooler path is down while the instance control plane still reports reachable.
- **Unconfirmed:** whether the pooler or Postgres itself is saturated, for example connections left open by the stream or daily continuation workers. Session counts, wait events and locks cannot be read until a connection succeeds. The empty alert history argues against disk or memory exhaustion, but it does not prove it.
- **Not the cause:** the four deployed functions as code. They finished their 08:00 run successfully, and the outage started about 8 minutes later.

## Recommended minimal operator action

1. **Wait about 5 minutes, then retry the read-only probe** (`select 1`, then the grouped `pg_stat_activity` summary). If it connects, identify any stuck stream or worker sessions by application name and wait event before acting.
2. **If the pooler is still unavailable:** ask Lovable Cloud support for a pooler or database restart, or approve `restart` here. A restart only re-establishes connections. It does not change schema, data, cron, Auth, DNS or stream records, so streams `d14e8e1b…` and `d1c93425…` stay intact.
3. **After recovery:**
   - Confirm the next scheduled cron run is logged.
   - Resume the migration stream from its durable cursor (78 tables, 106,448 rows).
4. **Do not:**
   - pause or upgrade the backend
   - change cron, Auth or DNS
   - terminate sessions before they have been identified

## Technical details

- Tools used: `cloud_status`, `db_health`, `read_query` (failed twice), `analytics_query` on postgres and edge logs, `edge_function_logs`.
- Nothing was changed. No queries, tokens or row data were printed.
