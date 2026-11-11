// On-screen copy. One template renders per language; add ru/kk/uz/tr here for the market versions.
export const COPY = {
  az: {
    hook1: 'Şəkər yox.',
    hook2: 'Un yox.',
    hookChip: 'Cəmi 3 inqrediyent',
    hookTag: 'Körpə pancake-i · 6 aydan sonra',
    step: 'ADDIM',
    ingredients: 'Lazım olanlar',
    banana: 'Banan', bananaAmt: '1 ədəd, yaxşı yetişmiş',
    egg: 'Yumurta', eggAmt: '1 ədəd',
    oats: 'Yulaf unu', oatsAmt: '4 xörək qaşığı (≈30 q)',
    oatTip: 'Yulaf lopasını blenderdə 20 saniyə çəkin, yulaf unu hazırdır.',
    s1: 'Bananı əzin', s1sub: 'Çəngəllə, püre olana qədər',
    s2: 'Yumurtanı qatın', s2sub: 'Hamar olana qədər qarışdırın',
    s3: 'Yulafı əlavə edin', s3sub: 'Xəmir qatı olmalıdır', s3note: 'Axmamalıdır, qaşıqdan yavaş düşməlidir',
    s4: 'Zəif odda bişirin', s4sub: 'Az yağla, ortası tam bişsin', s4timer: 'hər tərəfi 2-3 dəq',
    s5: 'Barmaq boyda kəsin', s5sub: 'Körpənin ovcuna sığan zolaqlar', s5hint: 'Körpə özü tutub yeyir: BLW üsulu',
    family: 'Bütün ailə üçün bir resept',
    forBaby: 'Körpəyə', forMom: 'Anaya',
    b1: 'Şirinlik bananın özündən', b2: 'Protein yumurtadan', b3: 'Lif yulafdan',
    safetyTitle: 'Yadda saxlayın',
    safety: ['6 aydan sonra', '1 yaşa qədər şəkər, bal, duz yox', 'Yeyəndə yanında olun'],
    cta: 'Daha çox resept Anacan-da',
    save: 'Videonu yadda saxla, lazım olacaq',
  },
} as const;
export type Lang = keyof typeof COPY;
