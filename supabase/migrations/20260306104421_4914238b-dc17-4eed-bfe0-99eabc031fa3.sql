-- Enable pg_cron and pg_net for automatic scheduled notifications
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- AZURE: pg_net is not available on Azure Database for PostgreSQL Flexible Server
-- (not in the allow-listed extensions). Scheduled HTTP calls to edge functions are
-- reimplemented via Azure Container Apps Jobs (cron trigger) instead of pg_cron+pg_net.
-- See azure-migration/README.md.
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;