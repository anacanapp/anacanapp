import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  "https://tntbjulojatnrqmylorp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU"
);

async function main() {
  // Fix the broken Vitamin B Complex description
  await supabase
    .from('vitamins')
    .update({
      description_az: 'Hüceyrə inkişafı, enerji mübadiləsi və sinir sisteminin sağlamlığı üçün vacib olan B qrupu vitaminləri.',
      description: 'B group vitamins essential for cell growth, energy metabolism, and nervous system health.'
    })
    .ilike('name', '%Vitamin B Complex%');
    
  console.log('Fixed B Complex');

  // Insert new vitamins for different stages
  const newVitamins = [
    // Bump (Pregnancy)
    {
      name: 'Calcium',
      name_az: 'Kalsium',
      description: 'Crucial for building your baby\'s bones and teeth.',
      description_az: 'Körpənizin sümük və diş inkişafı üçün çox vacibdir.',
      benefits: ['Bone development', 'Muscle function', 'Nerve transmission'],
      food_sources: ['Süd, pendir, qatıq', 'Brokkoli, kələm', 'Badam'],
      dosage: '1000-1300 mg daily',
      life_stage: 'bump',
      importance: 'essential',
      icon_emoji: '🦴',
      is_active: true,
      sort_order: 3
    },
    // Mommy (Nursing)
    {
      name: 'Omega-3 (DHA)',
      name_az: 'Omeqa-3 (DHA)',
      description: 'Essential for your baby\'s brain and eye development, and helps prevent postpartum depression.',
      description_az: 'Körpənin beyin və göz inkişafı üçün vacibdir, həmçinin doğuş sonrası depressiyanın qarşısını almağa kömək edir.',
      benefits: ['Brain development', 'Eye health', 'Mood support'],
      food_sources: ['Somon, sardina', 'Qoz, kətan toxumu', 'Chia toxumu'],
      dosage: '200-300 mg DHA daily',
      life_stage: 'mommy',
      importance: 'essential',
      icon_emoji: '🐟',
      is_active: true,
      sort_order: 1
    },
    {
      name: 'Vitamin D',
      name_az: 'Vitamin D',
      description: 'Supports your bone health and transfers to your baby through breast milk.',
      description_az: 'Sümük sağlamlığınızı dəstəkləyir və ana südü vasitəsilə körpəyə ötürülür.',
      benefits: ['Calcium absorption', 'Immune support', 'Bone health'],
      food_sources: ['Günəş işığı', 'Zənginləşdirilmiş süd', 'Yumurta sarısı'],
      dosage: '600-4000 IU daily (consult doctor)',
      life_stage: 'mommy',
      importance: 'essential',
      icon_emoji: '☀️',
      is_active: true,
      sort_order: 2
    },
    // Flow (General/TTC)
    {
      name: 'Folic Acid',
      name_az: 'Fol turşusu (B9)',
      description: 'Important for cell division and highly recommended if you are planning to conceive.',
      description_az: 'Hüceyrə bölünməsi üçün vacibdir və hamiləlik planlaşdırırsınızsa mütləq tövsiyə olunur.',
      benefits: ['Prevents neural tube defects', 'Red blood cell formation', 'Cell growth'],
      food_sources: ['Yaşıl yarpaqlı tərəvəzlər', 'Soya, mərcimək', 'Sitrus meyvələri'],
      dosage: '400 mcg daily',
      life_stage: 'flow',
      importance: 'essential',
      icon_emoji: '🥬',
      is_active: true,
      sort_order: 1
    },
    {
      name: 'Iron',
      name_az: 'Dəmir',
      description: 'Helps prevent anemia by producing red blood cells. Crucial during menstruation.',
      description_az: 'Qırmızı qan hüceyrələri istehsal edərək anemiyanın qarşısını alır. Menstruasiya zamanı çox vacibdir.',
      benefits: ['Energy production', 'Oxygen transport', 'Prevents anemia'],
      food_sources: ['Qırmızı ət', 'İspanaq', 'Mərcimək'],
      dosage: '18 mg daily',
      life_stage: 'flow',
      importance: 'recommended',
      icon_emoji: '🥩',
      is_active: true,
      sort_order: 2
    }
  ];

  for (const vit of newVitamins) {
    await supabase.from('vitamins').upsert(vit, { onConflict: 'name, life_stage' });
  }

  console.log('Inserted new vitamins');
}

main();
