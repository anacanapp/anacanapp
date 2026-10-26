-- Create trimester_tips table for dynamic trimester-specific content
CREATE TABLE public.trimester_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trimester integer NOT NULL CHECK (trimester >= 1 AND trimester <= 3),
  icon text NOT NULL DEFAULT '💡',
  tip_text text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trimester_tips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active trimester tips"
ON public.trimester_tips
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage trimester tips"
ON public.trimester_tips
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_trimester_tips_updated_at
  BEFORE UPDATE ON public.trimester_tips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default tips for each trimester
INSERT INTO public.trimester_tips (trimester, icon, tip_text, sort_order) VALUES
-- 1st Trimester
(1, '💊', 'Fol turşusu (400-800 mq) hər gün qəbul edin', 1),
(1, '🤢', 'Ürək bulanmasına qarşı zəncəfil çayı için', 2),
(1, '😴', 'Çox istirahət edin, bədəniniz sürətlə dəyişir', 3),
(1, '🥗', 'Kiçik porsiyalarla tez-tez qidalanın', 4),
(1, '💧', 'Gündə 8-10 stəkan su için', 5),
-- 2nd Trimester
(2, '🏃', 'Mülayim məşqlər edin (yoga, üzgüçülük)', 1),
(2, '🍎', 'Dəmir və kalsium zəngin qidalar yeyin', 2),
(2, '👶', 'Körpənin hərəkətlərini izləməyə başlayın', 3),
(2, '🛒', 'Körpə otağını planlaşdırmağa başlayın', 4),
(2, '📚', 'Doğuş hazırlığı kurslarına baxın', 5),
-- 3rd Trimester
(3, '🎒', 'Xəstəxana çantanızı hazırlayın', 1),
(3, '🛏️', 'Yuxu pozisyalarınızı rahatlaşdırın', 2),
(3, '📝', 'Doğuş planınızı yazın', 3),
(3, '👣', 'Təpikləri sayın - gündə 10+ olmalıdır', 4),
(3, '🧘', 'Nəfəs və relaksasiya texnikalarını öyrənin', 5);