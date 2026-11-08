/**
 * Doctor profile text → structured fields, in any app language.
 *
 * Provider descriptions start with "Header: value" lines (Azerbaijani source: "Təcrübə:", "Dillər:", ...) and the
 * translated copies keep that shape with translated headers ("経験：", "Expérience :", "Тажрыйбасы:"). The leading
 * run of such lines is read generically; headers we recognise in any language get the richer layout (chips,
 * lists), every other header is still shown as a label/value pair instead of falling back to plain text.
 * Aliases come from the shipped content translations (scripts/i18n/content/*.json) plus en/ru/tr/de/ar/kk/uz/ka.
 */
export type ProfileField = 'experience' | 'languages' | 'education' | 'master' | 'interests' | 'services';

const ALIASES: Record<ProfileField, string[]> = {
  experience: ['Təcrübə', 'Experience', 'Work experience', 'Years of experience', 'Опыт', 'Опыт работы', 'Стаж', 'Deneyim',
    'Tecrübe', 'Тәжірибе', 'Тәжірибесі', 'Tajriba', 'გამოცდილება', 'Erfahrung', 'Berufserfahrung', 'الخبرة', 'Experiencia',
    'Kogemus', 'Töökogemus', 'Expérience', 'अनुभव', 'Pengalaman', '経験', '경력', 'Тажрыйба', 'Тажрыйбасы', 'Ervaring',
    'Doświadczenie', 'Doświadczenie (w latach)', 'Liczba lat doświadczenia', 'Experiência', 'Erfarenhet', 'Kinh nghiệm',
    '从业经验', '经验'],
  languages: ['Dillər', 'Languages', 'Языки', 'Diller', 'Тілдер', 'Тілдері', 'Tillar', 'ენები', 'Sprachen', 'اللغات', 'Idiomas',
    'Keeled', 'Langues', 'भाषाएँ', 'भाषाएं', 'Bahasa', '対応言語', '言語', '언어', 'Тилдер', 'Тилдери', 'Talen', 'Języki',
    'Språk', 'Ngôn ngữ', '语言'],
  education: ['Təhsil', 'Education', 'Образование', 'Eğitim', 'Білімі', 'Білім', "Ta'lim", 'განათლება', 'Ausbildung', 'التعليم',
    'Formación', 'Haridus', 'Formation', 'शिक्षा', 'Pendidikan', '学歴', '학력', 'Билими', 'Билим', 'Opleiding', 'Wykształcenie',
    'Formação', 'Utbildning', 'Học vấn', 'Đào tạo', '教育背景'],
  master: ['Magistr', 'Master', "Master's", "Master's degree", 'Магистратура', 'Магистр', 'Yüksek lisans', 'მაგისტრატურა',
    'Masterstudium', 'الماجستير', 'Máster', 'Magistrantuur', 'Magistrikraad', 'स्नातकोत्तर', 'Magister', '修士課程', '석사',
    'Masteropleiding', 'Studia magisterskie', 'Mestrado', 'Magisterexamen', 'Magisterutbildning', 'Thạc sĩ', '硕士'],
  interests: ['Maraq sahələri', 'Areas of interest', 'Interests', 'Special interests', 'Области интересов', 'Сфера интересов',
    'İlgi alanları', 'Қызығушылық салалары', 'Qiziqish sohalari', 'ინტერესის სფეროები', 'Schwerpunkte', 'Interessengebiete',
    'مجالات الاهتمام', 'Áreas de interés', 'Huvivaldkonnad', 'Domaine d’intérêt', 'Domaines d’intérêt', "Domaines d'intérêt",
    'रुचि के क्षेत्र', 'विशेष रुचि के क्षेत्र', 'विशेष रुचियाँ', 'Bidang minat', '専門分野', '関心分野', '관심 분야', '전문 분야',
    'Кызыккан багыттары', 'Кызыккан тармактары', 'Aandachtsgebieden', 'Obszary zainteresowań', 'Áreas de interesse',
    'Intresseområden', 'Specialområden', 'Lĩnh vực chuyên môn', 'Lĩnh vực quan tâm', '专业领域', '关注领域', '擅长领域'],
  services: ['Xidmətlər', 'Services', 'Услуги', 'Hizmetler', 'Қызметтер', 'Xizmatlar', 'სერვისები', 'Leistungen', 'الخدمات',
    'Servicios', 'Teenused', 'सेवाएँ', 'सेवाएं', 'Layanan', '診療内容', '서비스', '시술 및 수술', '진료 및 수술', '진료 분야', '진료 서비스',
    'Кызматтар', 'Diensten', 'Usługi', 'Serviços', 'Tjänster', 'Dịch vụ', '服务', '服务项目'],
};

const norm = (s: string) => s.normalize('NFC').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase();
const LOOKUP = new Map<string, ProfileField>();
for (const [field, names] of Object.entries(ALIASES) as [ProfileField, string[]][]) {
  for (const name of names) if (!LOOKUP.has(norm(name))) LOOKUP.set(norm(name), field);
}

export const profileFieldOf = (label: string): ProfileField | null => LOOKUP.get(norm(label)) ?? null;

// "Label: value" / "Label：value" / "Label : value". The label is short, has no sentence punctuation or digits
// (so "Dr. X: ..." prose, times like 09:00 and URLs are never read as headers).
const HEADER = /^([^:：\n.!?0-9/]{1,40}?)\s*[:：]\s*(\S.*)$/u;

export interface ProfileEntry { label: string; value: string; field: ProfileField | null }
export interface ParsedProfile {
  entries: ProfileEntry[];
  fields: Partial<Record<ProfileField, string>>;
  basicDescription: string;
}

export function parseProviderProfile(text: string | null | undefined): ParsedProfile {
  const source = (text || '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const entries: ProfileEntry[] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { if (entries.length) { i++; break; } continue; }
    const m = HEADER.exec(line);
    if (!m || m[1].trim().split(/\s+/).length > 5 || m[2].startsWith('//')) break;
    const label = m[1].trim();
    entries.push({ label, value: m[2].trim(), field: profileFieldOf(label) });
  }
  if (!entries.length) return { entries: [], fields: {}, basicDescription: source.trim() };
  const fields: Partial<Record<ProfileField, string>> = {};
  for (const e of entries) if (e.field && !fields[e.field]) fields[e.field] = e.value;
  return { entries, fields, basicDescription: lines.slice(i).join('\n').trim() };
}

/** "a , b、c，d; e" → ["a", "b", "c", "d", "e"]. */
export const splitProfileList = (value: string) => value.split(/\s*[,、，;；]\s*/u).map((s) => s.trim()).filter(Boolean);

/** A Google Maps directions link (coordinates when known, else the address); opens the maps app on phones. */
export function directionsUrl(p: { address?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null }): string | null {
  const hasCoords = Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && !(p.latitude === 0 && p.longitude === 0);
  const destination = hasCoords ? `${p.latitude},${p.longitude}` : [p.address, p.city].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  return p.address || hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}
