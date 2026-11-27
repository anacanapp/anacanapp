import { ml, uuid } from '../../_lib/text.mjs';
export default () => Array.from({ length: 400 }, (_, i) => ({ id: uuid('7d000000', i + 1), day_number: i + 1, is_active: true,
  ...ml('info', ['Bu yaşda körpələr əşyaları bir əlindən digərinə ötürməyi öyrənir.', 'At this age babies learn to pass objects from hand to hand.',
    'В этом возрасте малыши учатся перекладывать предметы из руки в руку.', 'في هذا العمر يتعلم الأطفال نقل الأشياء من يد إلى أخرى.']),
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }));
