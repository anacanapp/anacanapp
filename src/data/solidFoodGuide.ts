/**
 * Əlavə Qida Bələdçisi (0–4 yaş) — məzmun. Mənbə: Anacan redaksiya sənədi 2026-10-29
 * (ÜST 2023, AAP, Türkiyə SN, Rusiya PS, SACN). Hələlik Azərbaycan dilindədir; bələdçi
 * yalnız az dilində göstərilir (SolidFoodGuide.tsx → isSolidFoodGuideAvailable).
 * Etiketlər: iron ★ dəmir, ca kalsium, omega Ω omeqa-3, c C vitamini, allergen (A).
 */

export type GuideTag = 'iron' | 'ca' | 'omega' | 'c' | 'allergen';

export interface GuideStage {
  id: string; label: string; fromMonths: number; toMonths: number;
  milk: string; meals: string; portion: string; texture: string; goal: string;
}

export const STAGES: GuideStage[] = [
  { id: '0-6', label: '0–6 ay', fromMonths: 0, toMonths: 6, milk: 'Tələbə görə ana südü / formula', meals: 'Əlavə qida yoxdur',
    portion: '—', texture: '—', goal: 'Hər gün D vitamini damlası; hazırlıq əlamətlərini izləyin' },
  { id: '6-8', label: '6–8 ay', fromMonths: 6, toMonths: 9, milk: 'Əsas qida, gündə 5–6 dəfə', meals: '2–3 öğün',
    portion: '2–3 xörək qaşığından ½ stəkana (~125 ml)', texture: 'Hamar püre → qalın püre, yumşaq barmaq qidası',
    goal: 'Dəmir, yeni dadlar, allergenlərlə tanışlıq' },
  { id: '9-11', label: '9–11 ay', fromMonths: 9, toMonths: 12, milk: 'Gündə 3–4 dəfə', meals: '3 öğün + 1–2 ara öğün',
    portion: '½ stəkan (~125 ml)', texture: 'Əzilmiş, xırda doğranmış, barmaq qidası',
    goal: 'Çeynəmə, qısqac tutuş, açıq stəkan' },
  { id: '12-24', label: '1–2 yaş', fromMonths: 12, toMonths: 24, milk: 'Ana südü və ya inək südü 350–500 ml/gün', meals: '3 öğün + 2 ara öğün',
    portion: '¾–1 stəkan (~200–250 ml)', texture: 'Ailə süfrəsi (duzsuz, xırda)', goal: 'Ailə yeməyinə keçid' },
  { id: '24-48', label: '2–4 yaş', fromMonths: 24, toMonths: 48, milk: 'Süd / qatıq gündə 2 porsiya', meals: '3 öğün + 2 ara öğün',
    portion: '1 stəkan; ət/balıq ~30–50 q', texture: 'Ailə yeməyi', goal: 'Müxtəliflik, seçici yeməklə bacarmaq' },
];

export const READINESS = [
  'Başını sabit tutur',
  'Dəstəklə oturur',
  'Yeməyə maraq göstərir, ağzını açır',
  'Dili qidanı geri itələmir',
];

export const SAMPLE_DAY = [
  ['07:00', 'Süd'], ['09:00', 'Dəmirli sıyıq + meyvə'], ['12:00', 'Süd'], ['13:30', 'Ət + tərəvəz'],
  ['16:00', 'Süd'], ['18:30', 'Yumurta / qatıq + taxıl'], ['Yuxudan əvvəl', 'Süd'],
] as const;

export const NUTRIENTS = [
  { name: 'Dəmir', tag: 'iron' as GuideTag, need: ['11 mq', '7 mq', '7–10 mq'], sources: 'Mal/quzu əti, toyuq budu, yumurta sarısı, mərci, noxud, dəmirli sıyıq, ispanaq',
    rule: 'Hər öğündə bir dəmir mənbəyi, yanında C vitamini' },
  { name: 'D vitamini', tag: undefined, need: ['400 BV', '600 BV', '600 BV'], sources: 'Damla, yağlı balıq, yumurta sarısı', rule: 'Hər gün damla' },
  { name: 'Sink', tag: undefined, need: ['3 mq', '3 mq', '3–5 mq'], sources: 'Ət, yumurta, qatıq, paxlalılar, yulaf', rule: 'Dəmirli qidalarla eyni boşqabda' },
  { name: 'Kalsium', tag: 'ca' as GuideTag, need: ['260 mq', '700 mq', '700–1000 mq'], sources: 'Qatıq, pendir, süd (1 yaşdan), tahin', rule: 'Gündə 2–3 süd məhsulu porsiyası' },
  { name: 'Omeqa-3', tag: 'omega' as GuideTag, need: ['—', '—', '—'], sources: 'Qızılbalıq, skumbriya, sardina, qoz, çətənə', rule: 'Həftədə 2 balıq öğünü' },
  { name: 'A vitamini', tag: undefined, need: ['—', '—', '—'], sources: 'Yerkökü, balqabaq, şirin kartof, ərik', rule: 'Gündə bir narıncı tərəvəz' },
  { name: 'C vitamini', tag: 'c' as GuideTag, need: ['—', '—', '—'], sources: 'Bolqar bibəri, brokoli, çiyələk, kivi, portağal', rule: 'Dəmirli yeməyin yanında' },
];
export const NUTRIENT_AGES = ['6–11 ay', '1–2 yaş', '2–4 yaş'];

export const PLATE = [
  { share: 25, label: 'Protein', hint: 'ət, balıq, yumurta, paxlalı', color: 'var(--a-coral)' },
  { share: 25, label: 'Taxıl', hint: 'sıyıq, düyü, çörək', color: 'var(--a-yellow-2, #ffc94d)' },
  { share: 50, label: 'Tərəvəz və meyvə', hint: 'rəngbərəng', color: 'var(--a-green-2, #63bd8b)' },
];
export const IRON_HELPS = ['C vitamini (bibər, brokoli, çiyələk)', 'Ət + tərəvəz birlikdə'];
export const IRON_BLOCKS = ['Yeməklə çay', '1 yaşdan əvvəl inək südü əsas içki kimi', 'Çox kəpəkli qida'];

export const ALLERGENS = ['Yumurta', 'Yer fındığı', 'Ağac qozları', 'İnək südü', 'Soya', 'Buğda', 'Küncüt', 'Balıq', 'Xərçəngkimilər'];
export const ALLERGEN_STEPS = [
  'Hər dəfə yalnız bir yeni allergen; 2–3 gün reaksiyaya baxın',
  'Səhər və ya günorta verin ki, izləmək asan olsun',
  'Yumurta tam bişmiş; yer fındığı pasta şəklində, heç vaxt bütöv dən',
  'Qəbul olunubsa, həftədə 2–3 dəfə təkrar verin',
];

export const AVOID = [
  { food: 'Bal', until: '12 ay', why: 'Botulizm riski' },
  { food: 'Duz', until: '12 ay, sonra çox az', why: 'Böyrəklərə yük' },
  { food: 'Əlavə şəkər, şirniyyat', until: '24 ay', why: 'Dad vərdişi, diş çürüməsi' },
  { food: 'Meyvə şirəsi', until: '12 ay; sonra ≤120 ml/gün', why: 'İştahı azaldır' },
  { food: 'İnək südü (içki kimi)', until: '12 ay', why: 'Dəmiri aşağı salır; yeməkdə olar' },
  { food: 'Çiy yumurta, ət, balıq; pasterizə olunmamış süd', until: '4 yaş', why: 'İnfeksiya' },
  { food: 'Civəli balıq (qılınc, köpək balığı, böyük tuna)', until: '4 yaş', why: 'Civə' },
  { food: 'Çay, qəhvə, kola', until: '4 yaş', why: 'Kofein, dəmiri bağlayır' },
  { food: 'Kolbasa, sosis, hisə verilmiş ət', until: 'Mümkün qədər az', why: 'Duz, nitrat' },
  { food: 'Düyü südü', until: '4–5 yaş', why: 'Arsen' },
];
export const CHOKING = [
  'Bütöv qoz-fındıq və toxum vermə — əzilmiş və ya pasta',
  'Üzüm, albalı, gilas tomat — uzununa 4 hissə',
  'Çiy yerkökü, alma — sürtgəcdən keçir və ya bişir',
  'Sosis — uzununa zolaq; popkorn, sərt konfet, saqqız — yox',
  'Həmişə oturaraq və nəzarət altında yesin',
];

export const MYTHS = [
  { myth: 'Yumurta ağı 1 yaşdan sonra', fact: 'Tam yumurta 6 aydan verilir; gecikdirmək allergiya riskini artıra bilər.' },
  { myth: 'Balıq, sitrus, çiyələk 1 yaşa qədər qadağandır', fact: 'Hamısı 6 aydan verilə bilər.' },
  { myth: 'Əvvəl meyvə versən, tərəvəzi sevməz', fact: 'Güclü sübut yoxdur; əsas şərt dəmirli qida və müxtəliflikdir.' },
  { myth: '4 aydan meyvə püresi', fact: 'ÜST əlavə qidaya 6 ayda başlamağı tövsiyə edir.' },
];

export type FoodGroup = 'Ət' | 'Balıq' | 'Yumurta' | 'Süd' | 'Paxlalı' | 'Taxıl' | 'Tərəvəz' | 'Meyvə' | 'Yağ, toxum';
export interface GuideFood { group: FoodGroup; name: string; from: number; value: string; form: string; tags: GuideTag[] }
const f = (group: FoodGroup, name: string, from: number, value: string, form: string, tags: GuideTag[] = []): GuideFood => ({ group, name, from, value, form, tags });
export const FOODS: GuideFood[] = [
  f('Ət', 'Mal əti', 6, 'Dəmir, sink, B12', 'Püre və ya uzun yumşaq zolaq', ['iron']),
  f('Ət', 'Quzu əti', 6, 'Dəmir, sink', 'Püre, qiymə', ['iron']),
  f('Ət', 'Toyuq budu', 6, 'Protein, dəmir', 'Didilmiş, püre', ['iron']),
  f('Ət', 'Hinduşka', 6, 'Protein, sink', 'Püre, köftə', ['iron']),
  f('Ət', 'Ciyər', 7, 'Dəmir, A vitamini', 'Həftədə 1 dəfə, 1–2 çay qaşığı', ['iron']),
  f('Balıq', 'Qızılbalıq', 6, 'Omeqa-3, D vitamini', 'Sümüksüz, əzilmiş', ['omega', 'allergen']),
  f('Balıq', 'Skumbriya, sardina', 6, 'Omeqa-3', 'Sümüksüz, əzilmiş', ['omega', 'allergen']),
  f('Balıq', 'Treska, kambala', 6, 'Protein, yod', 'Lopa-lopa', ['allergen']),
  f('Yumurta', 'Toyuq yumurtası', 6, 'Protein, xolin, D', 'Bərk bişmiş, əzilmiş; omlet zolağı', ['iron', 'allergen']),
  f('Süd', 'Qatıq (şəkərsiz)', 6, 'Kalsium, probiotik', 'Qaşıqla', ['ca', 'allergen']),
  f('Süd', 'Kəsmik, ağ pendir', 6, 'Kalsium, protein', 'Əzilmiş; pendiri isladıb duzunu çıxarın', ['ca', 'allergen']),
  f('Süd', 'Kərə yağı', 6, 'Enerji', 'Yeməyə az əlavə'),
  f('Süd', 'İnək südü', 12, 'Kalsium', 'İçki kimi 12 aydan; yeməkdə 6 aydan', ['ca', 'allergen']),
  f('Paxlalı', 'Qırmızı mərci', 6, 'Dəmir, protein', 'Şorba, püre', ['iron']),
  f('Paxlalı', 'Noxud', 6, 'Dəmir, lif', 'Humus (duzsuz)', ['iron']),
  f('Paxlalı', 'Lobya, maş', 7, 'Dəmir, folat', 'Əzilmiş', ['iron']),
  f('Taxıl', 'Yulaf', 6, 'Lif, dəmir', 'Sıyıq', ['iron']),
  f('Taxıl', 'Düyü', 6, 'Enerji', 'Sıyıq (həftədə 2–3 dəfə)'),
  f('Taxıl', 'Qarabaşaq (qreçka)', 6, 'Dəmir, maqnezium', 'Sıyıq', ['iron']),
  f('Taxıl', 'Bulqur, manna, makaron, çörək', 6, 'Enerji, B', 'Sıyıq, yumşaq makaron', ['allergen']),
  f('Taxıl', 'Darı, kinoa', 7, 'Dəmir, protein', 'Sıyıq', ['iron']),
  f('Tərəvəz', 'Balqabaq, yerkökü, şirin kartof', 6, 'A vitamini', 'Püre, buxarda çubuq'),
  f('Tərəvəz', 'Kabak, brokoli, gül kələm', 6, 'C, K vitamini', 'Buxarda; brokoli "ağac" kimi', ['c']),
  f('Tərəvəz', 'Kartof', 6, 'Enerji', 'Püre'),
  f('Tərəvəz', 'İspanaq, çuğundur', 6, 'Folat, dəmir', 'Başqa tərəvəzlə qarışıq', ['iron']),
  f('Tərəvəz', 'Badımcan, bibər, pomidor', 7, 'C vitamini', 'Bişmiş, qabıqsız', ['c']),
  f('Tərəvəz', 'Yaşıl noxud, lobya', 6, 'Dəmir, lif', 'Əzilmiş', ['iron']),
  f('Meyvə', 'Alma, armud', 6, 'Lif', 'Bişmiş püre, sürtgəc'),
  f('Meyvə', 'Banan, avokado', 6, 'Enerji, sağlam yağ', 'Uzun zolaq, əzilmiş'),
  f('Meyvə', 'Şaftalı, ərik, gavalı', 6, 'A, C vitamini, lif', 'Qabıqsız, yumşaq'),
  f('Meyvə', 'Çiyələk, kivi, portağal', 6, 'C vitamini', 'Əzilmiş, dilim', ['c']),
  f('Meyvə', 'Üzüm, albalı, qaragilə', 6, 'Antioksidant', 'Uzununa 4 hissə; qaragiləni əzin'),
  f('Meyvə', 'Quru ərik, kişmiş, xurma', 9, 'Dəmir, lif', 'İsladılmış, püre', ['iron']),
  f('Yağ, toxum', 'Zeytun yağı', 6, 'Sağlam yağ', 'Yeməyə 1 çay qaşığı'),
  f('Yağ, toxum', 'Yer fındığı pastası', 6, 'Protein', 'Nazik, püreyə qarışıq', ['allergen']),
  f('Yağ, toxum', 'Badam, qoz, fındıq pastası', 6, 'E vitamini, omeqa-3', 'Toz və ya pasta', ['allergen']),
  f('Yağ, toxum', 'Tahin (küncüt)', 6, 'Kalsium, dəmir', 'Sıyığa qarışıq', ['ca', 'allergen']),
  f('Yağ, toxum', 'Çətənə, çiya toxumu', 9, 'Omeqa-3', 'Üyüdülmüş', ['omega']),
];
export const FOOD_GROUPS: FoodGroup[] = ['Ət', 'Balıq', 'Yumurta', 'Süd', 'Paxlalı', 'Taxıl', 'Tərəvəz', 'Meyvə', 'Yağ, toxum'];

export interface GuideDish { name: string; tags: GuideTag[] }
const d = (name: string, ...tags: GuideTag[]): GuideDish => ({ name, tags });
export const DISHES: Record<string, GuideDish[]> = {
  '6-8': [d('Mal əti + balqabaq püresi', 'iron'), d('Toyuq + yerkökü + kartof püresi', 'iron'), d('Qırmızı mərci şorbası', 'iron'),
    d('Yulaf sıyığı + alma püresi', 'iron'), d('Qarabaşaq sıyığı', 'iron'), d('Qatıqlı banan püresi', 'ca', 'allergen'),
    d('Avokado + banan əzməsi'), d('Bərk bişmiş yumurta əzməsi', 'iron', 'allergen'), d('Buxarda brokoli "ağacları"', 'c'),
    d('Qızılbalıq + şirin kartof püresi', 'omega', 'allergen'), d('Noxud humusu (tahinlə)', 'iron', 'allergen'), d('Bişmiş armud püresi + darçın')],
  '9-11': [d('Mini mal əti köftələri', 'iron'), d('Tərəvəzli omlet zolaqları', 'iron', 'allergen'), d('Balıq köftəsi', 'omega', 'allergen'),
    d('Qatıqlı yulaf pancake', 'ca', 'allergen'), d('Toyuqlu düyü sıyığı + kabak', 'iron'), d('Quzu ətli tərəvəz yaxnisi', 'iron'),
    d('Mərcimək köftəsi', 'iron', 'allergen'), d('Makaron + qiyməli tomat sousu', 'iron', 'allergen'), d('Qreçka + ciyər sousu', 'iron'),
    d('Kəsmikli syrniki (sobada)', 'ca', 'allergen'), d('Brokoli-pendir muffini', 'ca', 'allergen'), d('Alma-yulaf barları', 'iron')],
  '12-24': [d('Yarpaq dolması (xırda)', 'iron'), d('Kələm dolması', 'iron'), d('Uşaq plovu', 'iron'), d('Toyuq şorbası əriştə ilə', 'iron', 'allergen'),
    d('Düşbərə', 'iron', 'allergen'), d('Göyərti kükü (sobada)', 'iron', 'c', 'allergen'), d('Mərci şorbası', 'iron'),
    d('Balıq kotleti + kartof püresi', 'omega', 'allergen'), d('Qreçka + mal əti gulyaşı', 'iron'), d('Menemen (acısız)', 'iron', 'allergen'),
    d('Uşaq lazanyası', 'iron', 'ca', 'allergen'), d('Qatıq + meyvə + yulaf parfe', 'ca'), d('Kəsmikli zapekanka', 'ca', 'allergen'), d('Sulu xəngəl', 'iron', 'allergen')],
  '24-48': [d('Tərəvəzli toyuq köftəsi + bulqur', 'iron'), d('Sobada qızılbalıq + tərəvəz', 'omega'), d('Lobya yeməyi', 'iron'),
    d('Ev pizzası (tam taxıl)', 'ca', 'allergen'), d('Qutab (göyərti / ətli)', 'iron', 'c', 'allergen'), d('Borş', 'iron', 'c'),
    d('Kinoa salatı + noxud', 'iron'), d('Yumurtalı tost "əsgərləri"', 'iron', 'allergen'), d('Smuzi kasası', 'ca', 'allergen'), d('Ev nuggetsi (sobada)', 'iron')],
};

export interface GuideRecipe { id: string; title: string; from: number; tags: GuideTag[]; ingredients: string; steps: string[] }
export const RECIPES: GuideRecipe[] = [
  { id: 'beef-pumpkin', title: 'Mal əti + balqabaq püresi', from: 6, tags: ['iron'], ingredients: '100 q yağsız mal əti, 150 q balqabaq, 1 çay qaşığı zeytun yağı',
    steps: ['Əti xırda doğrayıb suda 40–50 dəq tam yumşalana qədər bişirin; balqabağı son 15 dəqiqədə əlavə edin.', 'Bulyonla blenderdən keçirin, zeytun yağı qatın. 9 aydan sonra çəngəllə əzin.'] },
  { id: 'lentil-soup', title: 'Qırmızı mərci şorbası', from: 6, tags: ['iron'], ingredients: '½ stəkan qırmızı mərci, 1 kiçik yerkökü, ¼ soğan, 1 kiçik kartof, 2½ stəkan su, ½ çay qaşığı zirə, 1 çay qaşığı kərə yağı',
    steps: ['Hamısını 25 dəq bişirin, blenderdən keçirin; kərə yağı və zirə qatın.', 'Dəmirin mənimsənilməsi üçün yanında çiyələk və ya portağal dilimi verin.'] },
  { id: 'oat-apple', title: 'Yulaf-alma sıyığı', from: 6, tags: ['iron'], ingredients: '3 xörək qaşığı üyüdülmüş yulaf, ½ stəkan su və ya ana südü/formula, ½ alma (sürtgəcdən), bir çimdik darçın',
    steps: ['Yulafı su ilə 5 dəq bişirin, almanı qatıb 2 dəq də bişirin.', 'Oddan götürəndən sonra ana südü/formula əlavə edin. Variasiya: 1 çay qaşığı tahin və ya nazik yer fındığı pastası.'] },
  { id: 'salmon-sweet-potato', title: 'Qızılbalıq + şirin kartof püresi', from: 6, tags: ['omega', 'allergen'], ingredients: '80 q sümüksüz qızılbalıq, 1 orta şirin kartof, 1 çay qaşığı kərə yağı, şüyüd',
    steps: ['Kartofu 20 dəq, balığı 10 dəq buxarda (və ya 180°C sobada) bişirin.', 'Balığın sümüksüz olduğunu əllə yoxlayın, kartofla birlikdə əzin.'] },
  { id: 'first-egg', title: 'Tam yumurta ilə ilk tanışlıq', from: 6, tags: ['iron', 'allergen'], ingredients: '1 yumurta, 1 xörək qaşığı ana südü/formula və ya qatıq',
    steps: ['Yumurtanı 10–12 dəq bərk bişirin, ağı və sarısı ilə birlikdə maye ilə əzin.', 'Səhər verin, 2–3 gün başqa yeni allergen verməyin; sonra həftədə 2–3 dəfə davam edin.'] },
  { id: 'mini-meatballs', title: 'Mini mal əti köftələri', from: 9, tags: ['iron'], ingredients: '250 q mal əti qiyməsi, 3 xörək qaşığı yulaf, ½ yerkökü, ½ kabak (sıxılmış), 1 yumurta, cəfəri, zirə',
    steps: ['Hamısını qarışdırıb barmaq ölçüsündə uzunsov köftələr düzəldin.', '180°C sobada 18–20 dəq bişirin; içində çəhrayı rəng qalmamalıdır.'] },
  { id: 'omelette-strips', title: 'Tərəvəzli omlet zolaqları', from: 9, tags: ['iron', 'allergen'], ingredients: '2 yumurta, 2 xörək qaşığı xırda ispanaq, 1 xörək qaşığı sürtgəcdən pendir (duzu az)',
    steps: ['Qarışdırıb kiçik tavada az yağla hər iki üzü tam bişənə qədər qızardın.', 'Barmaq qalınlığında zolaqlara kəsin.'] },
  { id: 'yogurt-pancake', title: 'Qatıqlı yulaf pancake', from: 9, tags: ['ca', 'allergen'], ingredients: '1 yetişmiş banan, 1 yumurta, 4 xörək qaşığı yulaf unu, 2 xörək qaşığı qatıq',
    steps: ['Bananı əzib qalanları qatın; yapışmayan tavada kiçik pancake-lər bişirin.', 'Üstünə qatıq və əzilmiş qaragilə.'] },
  { id: 'buckwheat-liver', title: 'Qreçka + toyuq ciyəri sousu', from: 9, tags: ['iron'], ingredients: '½ stəkan qreçka, 50 q toyuq ciyəri, ¼ soğan, ½ yerkökü, 1 çay qaşığı kərə yağı',
    steps: ['Qreçkanı bişirin. Ciyəri soğan və yerkökü ilə az suda 10–12 dəq bişirib blenderdən keçirin.', 'Sousu qreçkaya qatın. Ciyər həftədə 1 dəfədən çox olmasın (A vitamini).'] },
  { id: 'kids-plov', title: 'Uşaq plovu', from: 12, tags: ['iron'], ingredients: '1 stəkan düyü, 200 q toyuq budu və ya quzu əti, 1 yerkökü, ½ soğan, 3–4 ərik qurusu, 1 xörək qaşığı kərə yağı, zəfəran/zerdeçal',
    steps: ['Əti, soğanı və yerkökünü az yağda qovurub su əlavə edərək 30 dəq bişirin.', 'Düyü və doğranmış ərik qurusunu qatıb dəmə qoyun (20–25 dəq). Böyüklər üçün duzu ayrıca əlavə edin.'] },
  { id: 'herb-kuku', title: 'Göyərti kükü (sobada)', from: 12, tags: ['iron', 'c', 'allergen'], ingredients: '4 yumurta, şüyüd, cəfəri, keşniş, ispanaq, 1 xörək qaşığı qatıq',
    steps: ['Göyərtiləri xırda doğrayın, yumurta və qatıqla qarışdırın.', 'Muffin qəlibində 180°C-də 20 dəq bişirin; yanında pomidor dilimləri.'] },
  { id: 'fish-cutlet', title: 'Balıq kotleti', from: 12, tags: ['omega', 'allergen'], ingredients: '250 q treska və ya qızılbalıq, 1 qaynadılmış kartof, 1 yumurta, şüyüd, 2 xörək qaşığı yulaf',
    steps: ['Balığı xırda doğrayıb hamısı ilə qarışdırın, kotlet formasına salın.', '190°C sobada 15–18 dəq bişirin; yanında yaşıl noxud püresi.'] },
  { id: 'cottage-bake', title: 'Kəsmikli zapekanka', from: 12, tags: ['ca', 'allergen'], ingredients: '250 q kəsmik, 1 yumurta, 2 xörək qaşığı manna, 1 yetişmiş banan, 2 xörək qaşığı qatıq',
    steps: ['Hamısını blenderdən keçirib yağlanmış qəlibə tökün.', '180°C-də 30–35 dəq bişirin, soyuyandan sonra kəsin.'] },
  { id: 'smoothie-bowl', title: 'Smuzi kasası', from: 12, tags: ['ca', 'allergen'], ingredients: '½ stəkan qatıq, ½ stəkan dondurulmuş giləmeyvə, ½ banan, 1 çay qaşığı qoz pastası, 1 çay qaşığı üyüdülmüş çətənə',
    steps: ['Hamısını blenderdə qalın qarışdırın.', 'Kasaya töküb üstünə yulaf səpin.'] },
  { id: 'beans', title: 'Lobya yeməyi', from: 24, tags: ['iron'], ingredients: '1 stəkan isladılmış ağ lobya, 150 q mal əti, 1 soğan, 1 xörək qaşığı tomat pastası, 1 xörək qaşığı zeytun yağı',
    steps: ['Əti soğanla qovurun, tomat pastası və lobyanı əlavə edin.', 'Üstünü örtənə qədər su töküb 60–70 dəq bişirin; bulqur və ya düyü, yanında qatıq.'] },
];

export const RECIPE_NOTE = 'Bütün reseptlər duzsuz və şəkərsizdir; 1 yaşdan sonra böyüklərin porsiyası ayrılandan sonra duz əlavə olunur. Artığı 3 aya qədər dondurula bilər.';
export const DISCLAIMER = 'Bu bələdçi maarifləndirmə məqsədlidir və tibbi məsləhət deyil. Dəmir və vitamin dozasını pediatrınız təyin edir. Mənbələr: ÜST (2023), AAP, Türkiyə Sağlıq Nazirliyi, Rusiya Pediatrlar İttifaqı, SACN.';
export const EMERGENCY = 'Üz və ya dodaqlarda şişkinlik, nəfəs çətinliyi, təkrar qusma, solğunluq — dərhal 103 / 112.';
