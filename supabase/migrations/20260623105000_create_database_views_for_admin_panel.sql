-- Secure views for the Admin panel to query metadata about tables and columns

-- View 1: database_tables
CREATE OR REPLACE VIEW public.database_tables AS
SELECT table_name::text
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN ('schema_migrations', '_prisma_migrations', 'spatial_ref_sys')
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
ORDER BY table_name;

-- View 2: database_columns
CREATE OR REPLACE VIEW public.database_columns AS
SELECT 
  table_name::text, 
  column_name::text, 
  data_type::text
FROM information_schema.columns
WHERE table_schema = 'public'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
ORDER BY table_name, ordinal_position;

-- View 3: database_table_constraints
CREATE OR REPLACE VIEW public.database_table_constraints AS
SELECT 
  tc.table_name::text,
  kcu.column_name::text,
  tc.constraint_type::text
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND public.has_role(auth.uid(), 'admin'::public.app_role);

-- Grant select permissions
GRANT SELECT ON public.database_tables TO authenticated;
GRANT SELECT ON public.database_tables TO anon;

GRANT SELECT ON public.database_columns TO authenticated;
GRANT SELECT ON public.database_columns TO anon;

GRANT SELECT ON public.database_table_constraints TO authenticated;
GRANT SELECT ON public.database_table_constraints TO anon;
