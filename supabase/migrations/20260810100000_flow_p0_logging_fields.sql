-- ============================================================
-- Flow P0 — dərin gündəlik qeyd sahələri
--   flow_daily_logs: servikal maye, cinsi əlaqə, libido
--   (flow_intensity artıq mövcuddur)
-- ============================================================

ALTER TABLE public.flow_daily_logs
  ADD COLUMN IF NOT EXISTS cervical_mucus TEXT
    CHECK (cervical_mucus IN ('dry', 'sticky', 'creamy', 'watery', 'eggwhite')),
  ADD COLUMN IF NOT EXISTS sexual_activity TEXT
    CHECK (sexual_activity IN ('none', 'protected', 'unprotected')),
  ADD COLUMN IF NOT EXISTS libido SMALLINT
    CHECK (libido BETWEEN 1 AND 3);

COMMENT ON COLUMN public.flow_daily_logs.cervical_mucus IS 'Servikal maye: dry|sticky|creamy|watery|eggwhite (fertillik göstəricisi)';
COMMENT ON COLUMN public.flow_daily_logs.sexual_activity IS 'Cinsi əlaqə: none|protected|unprotected';
COMMENT ON COLUMN public.flow_daily_logs.libido IS 'Libido: 1=aşağı 2=orta 3=yüksək';
