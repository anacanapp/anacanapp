
ALTER TABLE tool_configs DROP CONSTRAINT tool_configs_premium_type_check;
ALTER TABLE tool_configs ADD CONSTRAINT tool_configs_premium_type_check CHECK (premium_type = ANY (ARRAY['none'::text, 'limited_total'::text, 'limited_monthly'::text, 'premium_only'::text, 'full'::text]));
