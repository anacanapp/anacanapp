import { ml, uuid } from '../../_lib/text.mjs';
const P = [['Dr. Aynur Məmmədova', 'doctor', 'Ginekoloq', 4.9, 128], ['Leyla Medical Center', 'hospital', 'Doğum evi', 4.7, 342], ['Dr. Rauf Əliyev', 'doctor', 'Pediatr', 4.8, 96]];
export default () => P.map(([name, provider_type, specialty, rating, review_count], i) => ({ id: uuid('89000000', i + 1), name, name_az: name, name_en: name, name_ru: name, name_ar: name,
  provider_type, specialty, specialty_az: specialty, ...ml('address', ['Bakı, Nərimanov r., Ataturk pr. 12', 'Baku, Narimanov, Ataturk ave 12', 'Баку, Нариманов, пр. Ататюрка 12', 'باكو، نريمانوف، شارع أتاتورك 12']),
  ...ml('description', ['20 illik təcrübə', '20 years of experience', '20 лет опыта', 'خبرة 20 عاماً']), city: 'Bakı', country_code: 'AZ', phone: '+994 12 000 00 00', email: null,
  rating, review_count, is_featured: i === 0, is_active: true, accepts_reservations: true, latitude: null, longitude: null, image_url: null, services: [], sort_order: i + 1, created_at: '2026-01-01T00:00:00Z' }));
