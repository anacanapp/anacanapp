-- Mini Games: global leaderboard / high-score table
-- Stores one row per (user, game) with the player's best score & level reached.
-- Used by the "Mini Oyunlar" (Mini Games) section, starting with "Sağlam Səbət".
-- Written idempotently (IF NOT EXISTS / DROP..CREATE) so it's safe to re-run
-- even if this table was already provisioned on the target project.

CREATE TABLE IF NOT EXISTS public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  game_id TEXT NOT NULL DEFAULT 'saglam-sebet',
  best_score INTEGER NOT NULL DEFAULT 0,
  best_level INTEGER NOT NULL DEFAULT 1,
  total_plays INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

-- Enable RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Leaderboards are public read (so everyone can see the ranking)
DROP POLICY IF EXISTS "Anyone can view game leaderboard" ON public.game_scores;
CREATE POLICY "Anyone can view game leaderboard"
ON public.game_scores FOR SELECT
USING (true);

-- Users can only write their own score row
DROP POLICY IF EXISTS "Users can insert their own game score" ON public.game_scores;
CREATE POLICY "Users can insert their own game score"
ON public.game_scores FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own game score" ON public.game_scores;
CREATE POLICY "Users can update their own game score"
ON public.game_scores FOR UPDATE
USING (auth.uid() = user_id);

-- Indexes for fast leaderboard sorting
CREATE INDEX IF NOT EXISTS idx_game_scores_game_leaderboard ON public.game_scores (game_id, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON public.game_scores (user_id);

-- Keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION public.update_game_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_scores_updated_at ON public.game_scores;
CREATE TRIGGER trg_game_scores_updated_at
BEFORE UPDATE ON public.game_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_game_scores_updated_at();
