-- AI Suggested Questions table for chat screens
CREATE TABLE public.ai_suggested_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  life_stage text NOT NULL DEFAULT 'bump',
  user_type text NOT NULL DEFAULT 'mother', -- 'mother' or 'partner'
  question text NOT NULL,
  question_az text,
  icon text DEFAULT '💬',
  color_from text DEFAULT 'pink-500',
  color_to text DEFAULT 'rose-600',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Tool configurations for ToolsHub
CREATE TABLE public.tool_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id text NOT NULL UNIQUE,
  name text NOT NULL,
  name_az text,
  description text,
  description_az text,
  icon text NOT NULL DEFAULT 'Wrench',
  color text DEFAULT 'text-gray-600',
  bg_color text DEFAULT 'bg-gray-50',
  min_week integer,
  life_stages text[] DEFAULT '{flow,bump,mommy}',
  requires_partner boolean DEFAULT false,
  partner_name text,
  partner_name_az text,
  partner_description text,
  partner_description_az text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_suggested_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_suggested_questions
CREATE POLICY "Anyone can view active questions" ON public.ai_suggested_questions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage questions" ON public.ai_suggested_questions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for tool_configs
CREATE POLICY "Anyone can view active tools" ON public.tool_configs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage tools" ON public.tool_configs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_tool_configs_updated_at
  BEFORE UPDATE ON public.tool_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert AI suggested questions for mothers
INSERT INTO public.ai_suggested_questions (life_stage, user_type, question, question_az, icon, sort_order) VALUES
('bump', 'mother', 'Bu həftə körpəm necə inkişaf edir?', 'Bu həftə körpəm necə inkişaf edir?', '👶', 1),
('bump', 'mother', 'Hamiləlikdə hansı qidalar faydalıdır?', 'Hamiləlikdə hansı qidalar faydalıdır?', '🥗', 2),
('bump', 'mother', 'Ürək bulanmasına qarşı nə edə bilərəm?', 'Ürək bulanmasına qarşı nə edə bilərəm?', '💊', 3),
('mommy', 'mother', 'Körpəmi necə düzgün əmizdirməliyəm?', 'Körpəmi necə düzgün əmizdirməliyəm?', '🍼', 1),
('mommy', 'mother', 'Yenidoğanın yuxu qrafiki necə olmalıdır?', 'Yenidoğanın yuxu qrafiki necə olmalıdır?', '😴', 2),
('mommy', 'mother', 'Körpəm niyə ağlayır?', 'Körpəm niyə ağlayır?', '😢', 3),
('flow', 'mother', 'Menstrual siklim haqqında məlumat ver', 'Menstrual siklim haqqında məlumat ver', '📅', 1),
('flow', 'mother', 'PMS simptomları ilə necə mübarizə aparım?', 'PMS simptomları ilə necə mübarizə aparım?', '💆', 2),
('flow', 'mother', 'Fertil pəncərəm nə vaxtdır?', 'Fertil pəncərəm nə vaxtdır?', '🌸', 3);

-- Insert AI suggested questions for partners
INSERT INTO public.ai_suggested_questions (life_stage, user_type, question, question_az, icon, color_from, color_to, sort_order) VALUES
('bump', 'partner', 'Emosional dəstək necə verim?', 'Həyat yoldaşım əhvalı pisdirsə, onu necə dəstəkləyə bilərəm?', 'Heart', 'pink-500', 'rose-600', 1),
('bump', 'partner', 'Hansı ev işlərini öhdəmə götürməliyəm?', 'Hamiləlik dövründə hansı ev işlərini mən öhdəmə götürməliyəm?', 'Home', 'blue-500', 'indigo-600', 2),
('bump', 'partner', 'Həkim vizitlərində necə faydalı olum?', 'Həkim görüşlərində mən necə faydalı ola bilərəm? Hansı sualları verməliyəm?', 'Stethoscope', 'emerald-500', 'teal-600', 3),
('bump', 'partner', 'Hansı sürprizlər edə bilərəm?', 'Həyat yoldaşımı sevindirmək üçün hansı kiçik sürprizlər edə bilərəm?', 'Gift', 'amber-500', 'orange-600', 4),
('bump', 'partner', 'Doğuşa necə hazırlaşım?', 'Doğuş günü üçün necə hazırlaşmalıyam? Nələr etməliyəm?', 'Baby', 'violet-500', 'purple-600', 5),
('bump', 'partner', 'Bu həftə körpə necə inkişaf edir?', 'Hamiləliyin bu həftəsində körpə necə inkişaf edir və mən nə edə bilərəm?', 'Calendar', 'cyan-500', 'blue-600', 6);

-- Insert tool configurations
INSERT INTO public.tool_configs (tool_id, name, name_az, description, description_az, icon, color, bg_color, life_stages, min_week, requires_partner, partner_name, partner_name_az, partner_description, partner_description_az, sort_order) VALUES
('photoshoot', 'Photoshoot', 'Fotosessiya', 'AI baby photos', 'AI körpə fotoları', 'Camera', 'text-rose-600', 'bg-rose-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 1),
('nutrition', 'Nutrition', 'Qidalanma', 'Healthy food and recipes', 'Sağlam qida və reseptlər', 'Utensils', 'text-orange-600', 'bg-orange-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 2),
('shopping', 'Shopping List', 'Alışveriş Siyahısı', 'Shopping list', 'Alınacaqlar siyahısı', 'ShoppingCart', 'text-purple-600', 'bg-purple-50', '{flow,bump,mommy}', NULL, true, 'Shared Shopping', 'Ortaq Alışveriş', 'Shared list with partner', 'Partnyor ilə ortaq siyahı', 3),
('safety', 'Safety', 'Təhlükəsizlik', 'Check food and activities', 'Qida və fəaliyyət yoxlayın', 'Shield', 'text-emerald-600', 'bg-emerald-50', '{bump}', NULL, false, NULL, NULL, NULL, NULL, 4),
('kick', 'Kick Counter', 'Təpik Sayğacı', 'Track baby movements', 'Körpə hərəkətlərini izləyin', 'Footprints', 'text-pink-600', 'bg-pink-50', '{bump}', 16, false, NULL, NULL, NULL, NULL, 5),
('contraction', 'Contraction Timer', 'Sancı Ölçən', 'Track with 5-1-1 rule', '5-1-1 qaydası ilə izləyin', 'Timer', 'text-violet-600', 'bg-violet-50', '{bump}', NULL, false, NULL, NULL, NULL, NULL, 6),
('weight', 'Weight Tracker', 'Çəki İzləyici', 'Weight tracking with AI analysis', 'AI analiz ilə çəki takibi', 'Scale', 'text-blue-600', 'bg-blue-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 7),
('names', 'Baby Names', 'Körpə Adları', 'Azerbaijani names', 'Azərbaycan adları', 'Baby', 'text-amber-600', 'bg-amber-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 8),
('hospital', 'Hospital Bag', 'Xəstəxana Çantası', 'Birth preparation', 'Doğuş üçün hazırlıq', 'Briefcase', 'text-teal-600', 'bg-teal-50', '{bump}', NULL, false, NULL, NULL, NULL, NULL, 9),
('whitenoise', 'White Noise', 'Bəyaz Küylər', 'Calm the baby', 'Körpəni sakitləşdirin', 'Volume2', 'text-indigo-600', 'bg-indigo-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 10),
('exercise', 'Exercises', 'Məşqlər', 'Pregnancy exercises', 'Hamiləlik məşqləri', 'Activity', 'text-cyan-600', 'bg-cyan-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 11),
('mood', 'Mood Diary', 'Əhval Gündəliyi', 'Track your emotions', 'Emosiyalarınızı izləyin', 'Heart', 'text-fuchsia-600', 'bg-fuchsia-50', '{flow,bump,mommy}', NULL, false, NULL, NULL, NULL, NULL, 12);