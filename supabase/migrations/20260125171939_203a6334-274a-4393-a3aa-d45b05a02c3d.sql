-- Create photoshoot_image_styles table
CREATE TABLE public.photoshoot_image_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  style_id TEXT NOT NULL UNIQUE,
  style_name TEXT NOT NULL,
  style_name_az TEXT,
  emoji TEXT DEFAULT '🎨',
  prompt_modifier TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.photoshoot_image_styles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view active styles" ON public.photoshoot_image_styles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage styles" ON public.photoshoot_image_styles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial image styles
INSERT INTO public.photoshoot_image_styles (style_id, style_name, style_name_az, emoji, prompt_modifier, sort_order) VALUES
  ('realistic', 'Realistic', 'Realistik', '📷', 'ultra realistic, photorealistic, high detail photography, natural lighting', 1),
  ('3d_render', '3D Render', '3D', '🎮', '3D rendered, high quality 3D graphics, smooth textures, studio lighting', 2),
  ('3d_disney', '3D Disney', '3D Disney', '🏰', '3D Disney Pixar style, cute cartoon character, big expressive eyes, soft lighting, magical atmosphere', 3),
  ('3d_pixar', '3D Pixar', '3D Pixar', '🎬', '3D Pixar animation style, adorable character design, vibrant colors, cinematic lighting', 4),
  ('anime', 'Anime', 'Anime', '🎌', 'anime style, Japanese animation, big eyes, soft features, colorful', 5),
  ('illustration', 'Illustration', 'İllustrasiya', '🎨', 'digital illustration, artistic, hand-drawn style, soft colors, storybook quality', 6),
  ('2d_simpsons', '2D Simpsons', '2D Simpsons', '📺', 'The Simpsons cartoon style, 2D animation, yellow skin tone, overbite, simple features', 7),
  ('3d_simpsons', '3D Simpsons', '3D Simpsons', '🎥', '3D Simpsons style, yellow skin, cartoon proportions, 3D rendered', 8),
  ('watercolor', 'Watercolor', 'Akvarel', '🖌️', 'watercolor painting style, soft washes, delicate brushstrokes, artistic', 9),
  ('oil_painting', 'Oil Painting', 'Yağlı boya', '🖼️', 'oil painting style, classical portrait, rich colors, textured brushwork', 10),
  ('clay_art', 'Clay Art', 'Gil sənəti', '🏺', 'claymation style, clay figure, stop motion aesthetic, handcrafted look', 11),
  ('pop_art', 'Pop Art', 'Pop Art', '🎪', 'pop art style, bold colors, comic book aesthetic, halftone dots', 12);