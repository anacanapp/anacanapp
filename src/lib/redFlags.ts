import { tr } from '@/lib/tr';

/**
 * Qırmızı bayraq kataloqu — hamiləlik və doğuşdan sonra
 * TƏCİLİ müraciət tələb edən əlamətlər (WHO/ACOG əsaslı, tibbi məsləhət deyil).
 */

export type DangerSeverity = 'urgent' | 'soon';
export type DangerStage = 'bump' | 'mommy';

export interface DangerSign {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  severity: DangerSeverity;
  stages: DangerStage[];
  /** true = yalnız əkiz/üçüz/dördüz hamiləliklərdə göstərilir (profiles.multiples_type !== 'single') */
  multiplesOnly?: boolean;
}

export const DANGER_SIGNS: DangerSign[] = [
// ── Hamiləlik (bump) ──
{
  id: 'vaginal_bleeding',
  emoji: '🩸',
  title: tr('rf_bleeding_title', 'Vaginal qanaxma'),
  desc: tr('rf_bleeding_desc', 'İstənilən həcmdə parlaq qırmızı qanaxma — xüsusilə ağrı ilə birgə.'),
  severity: 'urgent',
  stages: ['bump']
},
{
  id: 'decreased_movement',
  emoji: '👶',
  title: tr('rf_movement_title', 'Körpənin hərəkəti azalıb'),
  desc: tr('rf_movement_desc', '28-ci həftədən sonra körpə adi ritmindən nəzərəçarpacaq az tərpənir (2 saatda <10 hərəkət).'),
  severity: 'urgent',
  stages: ['bump']
},
{
  id: 'waters_broke',
  emoji: '💧',
  title: tr('rf_waters_title', 'Su gəlib (dölyanı maye)'),
  desc: tr('rf_waters_desc', 'Qəfil və ya davamlı maye axını — 37 həftədən əvvəldirsə xüsusilə təcilidir.'),
  severity: 'urgent',
  stages: ['bump']
},
{
  id: 'severe_headache_vision',
  emoji: '🤯',
  title: tr('rf_headache_title', 'Kəskin başağrı + görmə pozğunluğu'),
  desc: tr('rf_headache_desc', 'Keçməyən güclü başağrı, göz önündə ulduzlar/dumanlı görmə — preeklampsiya əlaməti ola bilər.'),
  severity: 'urgent',
  stages: ['bump']
},
{
  id: 'face_hand_swelling',
  emoji: '🫲',
  title: tr('rf_swelling_title', 'Üz və əllərdə qəfil şişkinlik'),
  desc: tr('rf_swelling_desc', 'Qəfil yaranan şişkinlik (xüsusilə üz/əllər) — preeklampsiya riski.'),
  severity: 'urgent',
  stages: ['bump']
},
{
  id: 'severe_abdominal_pain',
  emoji: '⚡',
  title: tr('rf_abdominal_title', 'Kəskin qarın ağrısı'),
  desc: tr('rf_abdominal_desc', 'Keçməyən, kəskin və ya birtərəfli qarın ağrısı.'),
  severity: 'urgent',
  stages: ['bump']
},
{
  // Yalnız çoxdöllü (əkiz/üçüz) hamiləliklərdə göstərilir — ortaq plasenta
  // (monoxorionik) olduqda TTTS riski əhəmiyyətli dərəcədə yüksəkdir.
  id: 'ttts_signs',
  emoji: '👯',
  title: tr('rf_ttts_title', 'Əkizlərdə qeyri-bərabər böyümə əlamətləri (TTTS)'),
  desc: tr('rf_ttts_desc', 'Qarının gözlənilməzdən sürətli/qeyri-bərabər böyüməsi, nəfəs darlığının qəfil artması, ayaqlarda qəfil şişkinlik və ya bir körpənin hərəkətinin digərinə nisbətən azalması — ortaq plasentalı (monoxorionik) əkiz/üçüzlərdə TTTS (əkiz-əkizə transfuziya sindromu) əlaməti ola bilər. Bu, tez aşkarlanıb müalicə edildikdə yaxşı idarə oluna bilən, amma vaxtında həkimə çatdırılması vacib olan bir vəziyyətdir.'),
  severity: 'urgent',
  stages: ['bump'],
  multiplesOnly: true
},
{
  id: 'fever_38',
  emoji: '🌡️',
  title: tr('rf_fever_title', 'Hərarət 38°C və üzəri'),
  desc: tr('rf_fever_desc', 'Yüksək hərarət — infeksiya əlaməti ola bilər.'),
  severity: 'urgent',
  stages: ['bump', 'mommy']
},
{
  id: 'persistent_vomiting',
  emoji: '🤮',
  title: tr('rf_vomiting_title', 'Dayanmayan qusma'),
  desc: tr('rf_vomiting_desc', '24 saatdan çox heç nə saxlaya bilmirsinizsə — susuzlaşma riski.'),
  severity: 'soon',
  stages: ['bump']
},
{
  id: 'painful_urination',
  emoji: '🚻',
  title: tr('rf_urination_title', 'Ağrılı sidik ifrazı'),
  desc: tr('rf_urination_desc', 'Yanma/ağrı — sidik yolu infeksiyası müalicəsiz qalmamalıdır.'),
  severity: 'soon',
  stages: ['bump', 'mommy']
},
{
  id: 'dizziness_fainting',
  emoji: '😵',
  title: tr('rf_dizziness_title', 'Bayılma / güclü başgicəllənmə'),
  desc: tr('rf_dizziness_desc', 'Huşun itməsi və ya təkrarlanan güclü başgicəllənmə.'),
  severity: 'soon',
  stages: ['bump', 'mommy']
},

// ── Doğuşdan sonra (mommy) ──
{
  id: 'heavy_bleeding_pp',
  emoji: '🩸',
  title: tr('rf_pp_bleeding_title', 'Güclü doğuşdan sonra qanaxma'),
  desc: tr('rf_pp_bleeding_desc', '1 saatda 1 bezdən çox islanır və ya böyük laxtalar gəlir.'),
  severity: 'urgent',
  stages: ['mommy']
},
{
  id: 'chest_pain_breath',
  emoji: '🫁',
  title: tr('rf_chest_title', 'Sinə ağrısı / nəfəs darlığı'),
  desc: tr('rf_chest_desc', 'Qəfil sinə ağrısı və ya nəfəs almaqda çətinlik — dərhal təcili yardım.'),
  severity: 'urgent',
  stages: ['mommy', 'bump']
},
{
  id: 'leg_pain_swelling',
  emoji: '🦵',
  title: tr('rf_leg_title', 'Bir ayaqda ağrı və şişkinlik'),
  desc: tr('rf_leg_desc', 'Birtərəfli ayaq ağrısı, istilik, qızartı — tromb (DVT) əlaməti ola bilər.'),
  severity: 'urgent',
  stages: ['mommy', 'bump']
},
{
  id: 'incision_infection',
  emoji: '🩹',
  title: tr('rf_incision_title', 'Tikiş yerində infeksiya əlaməti'),
  desc: tr('rf_incision_desc', 'Qızartı, şişkinlik, irin və ya artan ağrı (Qeysəriyyə/epizio).'),
  severity: 'soon',
  stages: ['mommy']
},
{
  id: 'sad_thoughts',
  emoji: '🖤',
  title: tr('rf_mental_title', 'Ağır kədər və ya zərər fikirləri'),
  desc: tr('rf_mental_desc', 'Özünüzə/körpəyə zərər fikirləri gəlirsə — bu sizin günahınız deyil, kömək mövcuddur. Dərhal yaxınınıza deyin və mütəxəssisə müraciət edin.'),
  severity: 'urgent',
  stages: ['mommy']
}];


/**
 * @param isMultiplesPregnancy — profiles.multiples_type !== 'single' olanda true ötürülür,
 * yalnız onda `multiplesOnly` işarəli qeydlər (məs. TTTS) siyahıya daxil olur.
 */
export const getDangerSignsForStage = (stage: string | null | undefined, isMultiplesPregnancy?: boolean): DangerSign[] => {
  const s: DangerStage = stage === 'mommy' ? 'mommy' : 'bump';
  return DANGER_SIGNS.
  filter((d) => d.stages.includes(s)).
  filter((d) => !d.multiplesOnly || isMultiplesPregnancy).
  sort((a, b) => a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1);
};
