/**
 * Kod-daxili (hardcoded) qısa mətnlərin Qazax tərcüməsi — tək Azure job.
 * Nəticə: scripts/i18n/kk-hardcoded.json (kod redaktələrində istifadə üçün).
 * Placeholder-lər: {name} {n} {d} {names} {childName} {ageInstruction} {ageText} {theme} {hero} {moral} {style} — DƏYİŞMİR.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'content-i18n', '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const PAYLOAD = {
  dr_unavailable: 'Bağışlayın, xidmət müvəqqəti əlçatmazdır. Zəhmət olmasa bir az sonra yenidən cəhd edin.',
  dr_noanswer: 'Bağışlayın, cavab ala bilmədim. Yenidən cəhd edin.',
  dr_warn: '⚠️ Bu məlumat ümumi xarakterlidir. Hər hansı müalicə və ya dərman qəbulu üçün mütləq həkimlə məsləhətləşin.',
  cry_short_expl: 'Səs çox qısadır. Daha dəqiq analiz üçün minimum 3 saniyə səs lazımdır.',
  cry_short_rec1: 'Minimum 3 saniyə səs yazın',
  cry_short_rec2: 'Körpənin ağlamasını yaxından yazın',
  cry_cough: 'Bu səs öskürəkdir, körpə ağlaması deyil.',
  cry_sneeze: 'Bu səs asqırmadır, körpə ağlaması deyil.',
  cry_adult_voice: 'Bu səs böyük insana aiddir, körpə ağlaması deyil.',
  cry_scream: 'Bu səs qışqırıq / böyük səsdir, körpə ağlaması kimi qiymətləndirilmir.',
  cry_bang: 'Bu zərbə / çırpma kimi səsdir, körpə ağlaması deyil.',
  cry_music_tv: 'Bu TV/musiqi və ya media səsidir, körpə ağlaması deyil.',
  cry_animal: 'Bu heyvan səsi ola bilər, körpə ağlaması deyil.',
  cry_silence: 'Səs faylında əsasən səssizlik var.',
  cry_noise: 'Bu ətraf mühit səsidir, körpə ağlaması deyil.',
  cry_baby_cooing: 'Körpə xoşbəxt səslər çıxarır, ağlamır.',
  cry_unknown: 'Körpə ağlaması aşkar edilmədi.',
  cry_nocry_rec1: 'Körpə ağladıqda yenidən cəhd edin',
  cry_nocry_rec2: 'Mikrofonu körpəyə yaxınlaşdırın',
  cry_nocry_rec3: 'Ətraf səsləri minimuma endirin',
  cry_fb_expl: 'Körpə ağlaması aşkar edildi, lakin dəqiq növü müəyyən edilə bilmədi.',
  cry_fb_rec1: 'Körpənin vəziyyətini yoxlayın',
  cry_fb_rec2: 'Bezini yoxlayın',
  cry_fb_rec3: 'Ac olub-olmadığını yoxlayın',
  poop_diaper_empty: 'Bu bez boşdur, nəcis görünmür. Nəcis olan bez şəkli çəkin.',
  poop_baby_photo: 'Bu körpə şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
  poop_adult_content: 'Bu şəkil körpə bezi deyil. Zəhmət olmasa düzgün şəkil seçin.',
  poop_food: 'Bu yemək şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
  poop_animal: 'Bu heyvan şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
  poop_screenshot: 'Bu ekran görüntüsüdür. Zəhmət olmasa körpə bezinin real şəklini çəkin.',
  poop_landscape: 'Bu mənzərə şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
  poop_object: 'Bu əşya şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
  poop_other: 'Bu şəkil analiz üçün uyğun deyil. Körpə bezinin içindəki nəcisin şəklini çəkin.',
  poop_unknown: 'Şəkil tanınmadı. Zəhmət olmasa daha aydın şəkil çəkin.',
  poop_valid: 'Şəkil uyğundur',
  poop_failed: 'Şəkil yoxlanıla bilmədi. Yenidən cəhd edin.',
  poop_fb_color: 'Naməlum',
  poop_fb_expl: 'Şəkil analiz edildi. Daha aydın şəkil çəkməyə cəhd edin.',
  poop_fb_rec1: 'Körpənin ümumi vəziyyətini izləyin',
  poop_fb_rec2: 'Hər hansı narahatlıq olsa həkimə müraciət edin',
  insight_sleep: 'Yuxu qeydləri toplanır — gün boyu izləməyə davam edin.',
  insight_feeding: 'Qidalanma qeydləri toplanır — hər qidalanmanı qeyd etməyə çalışın.',
  insight_diaper: 'Bez qeydləri toplanır — nəm bezlər qidalanmanın yaxşı göstəricisidir.',
  fairy_age_0_2: 'Çox sadə cümlələr (3-5 söz). Təkrarlanan ifadələr. Heyvan səsləri. Rənglər və formalar. Nağıl 1-2 dəqiqəlik olsun.',
  fairy_age_3_5: 'Sadə amma məzmunlu cümlələr. Dialoqlar olsun. Əyləncəli hadisələr. Tərbiyəvi mesaj aydın olsun. 3-4 dəqiqəlik nağıl.',
  fairy_age_6_9: 'Daha mürəkkəb süjet xətti. Problemin həlli prosesi göstərilsin. Uşağın düşünməsinə kömək edən suallar. 4-6 dəqiqəlik nağıl.',
  fairy_age_10_12: 'Zəngin süjet. Əxlaqi dilemma və seçimlər. Emosional dərinlik. Daha uzun dialoqlar. 5-7 dəqiqəlik nağıl.',
  fairy_default_theme: 'Meşə macərası',
  fairy_default_hero: 'Müdrik bir meşə heyvanı',
  fairy_default_moral: 'Dostluq və yaxşılıq',
  fairy_default_title: '{childName} nağılı',
  fairy_system: 'Sən mükafat almış uşaq kitabı müəllifisən. Məntiqi süjet inkişafı və peşəkar anlatım tərzi ilə uşaqlar üçün maraqlı, keyfiyyətli nağıl yaz.\n\nKRİTİK KEYFİYYƏT QAYDALARI:\n1. Uşağın adı "{childName}"-dir. Baş qəhrəman olaraq HƏMİŞƏ bu adı istifadə et.\n2. Nağılın aydın başlanğıcı, ortası və sonu OLMALIDIR. MƏNTİQLİ səbəb-nəticə əlaqəsi olmalıdır.\n3. Hər hadisənin bir SƏBƏBİ olmalıdır — təsadüfi sehrli həllər OLMAMALIDIR.\n4. Personajların ardıcıl xarakterləri və motivasiyaları olmalıdır.\n5. Tərbiyəvi mesaj hadisələrdən TƏBİİ şəkildə çıxmalıdır — süni öyüd-nəsihət OLMASIN.\n6. Canlı, təsvirli dil istifadə et (rənglər, səslər, qoxular).\n7. Personaj xarakterini açan mənalı dialoqlar daxil et.\n8. Problem qəhrəmanın ÖZ səyi, ağlı və ya böyüməsi ilə həll olunmalıdır.\n9. "Onlar xoşbəxt yaşadılar" kimi klişelər YASAQDIR — konkret, qənaətbəxş sonluq yaz.\n10. Şişirdilmiş, mübaliğəli təsvirlər YASAQDIR. İsti amma gerçəkçi ton saxla.\n\nYASAQDIR:\n- Adsız "kiçik dost", "sehrli varlıq" kimi ifadələr\n- Təsadüfi sehrli həllər\n- Moizə tərzi əxlaq dərsləri\n- Həddən artıq şirin, süni dil\n- Süjet boşluqları və ya məntiqsiz ardıcıllıq\n\nNağılın strukturu:\n1. Başlıq: "{childName} və [nəsə]" formasında\n2. Məkan təsviri (HARADA və NƏ VAXT, duyğusal detallarla)\n3. Personaj tanıtımı (xarakter xüsusiyyətləri ilə)\n4. Problem/çağırış (məntiqi, uşağın anlayacağı)\n5. 2-3 cəhd/maneə (artan çətinlik)\n6. Kulminasiya — qəhrəmanın böyüməsi və ya öyrənməsi\n7. Hadisələrdən məntiqi olaraq irəli gələn həll\n8. Qənaətbəxş sonluq və təbii tərbiyəvi nəticə{ageInstruction}\n\nFormat: Birinci sətirdə başlıq, sonra nağıl mətni. Abzaslarla yaz, siyahı formatında yox. Nağıl QAZAX dilində olmalıdır.',
  fairy_user: 'Uşağın adı: {childName}{ageText}\nMövzu/Tema: {theme}\nKöməkçi qəhrəman: {hero}\nTərbiyəvi mesaj: {moral}\n{style}\n\nVACİB:\n- "{childName}" haqqında PEŞƏKAR, MƏNTİQLİ nağıl yaz\n- Canlı təsvirlər, mənalı dialoqlar, qənaətbəxş sonluq olsun\n- Tərbiyəvi mesaj süni yox, hadisələrdən TƏBİİ çıxsın\n- Qazax dili qrammatikasına diqqətlə əməl et',
  flow_period_start_t: 'Period yaxınlaşır 🔴',
  flow_period_start_b: 'Perioda {d} gün qaldı!',
  flow_period_end_t: 'Period bitdi ✅',
  flow_period_end_b: 'Periodunuz sona çatdı!',
  flow_ovulation_t: 'Ovulyasiya günü 🌸',
  flow_ovulation_b: 'Ovulyasiyaya {d} gün qaldı!',
  flow_fertile_start_t: 'Məhsuldar günlər 💕',
  flow_fertile_start_b: 'Məhsuldar günlər başlayır!',
  flow_fertile_end_t: 'Məhsuldar günlər bitir 📅',
  flow_fertile_end_b: 'Məhsuldar günlər sona çatır.',
  flow_pms_t: 'PMS dövrü ⚡',
  flow_pms_b: 'PMS dövrü yaxınlaşır, özünüzə baxın!',
  flow_pill_t: 'Həb vaxtı 💊',
  flow_pill_b: 'Gündəlik həbinizi qəbul etməyi unutmayın!',
  partner_exp_title: 'Premium müddəti bitdi',
  partner_exp_inapp: 'Premium abunəliyiniz başa çatdı və partnyor bağlantısı dayandırıldı. Yenidən aktivləşdirmək üçün Premium-u uzadın.',
  partner_exp_push: 'Partnyor bağlantınız dayandırıldı. Premium-u uzadın və yenidən qoşulun.',
  vit_test_title: '[TEST] 💊 Vitamin bildirişi',
  vit_title: '💊 Vitamin qəbulu vaxtıdır!',
  vit_body_one: '{name} qəbul etmə vaxtıdır',
  vit_body_many: '{n} vitamin qəbul etmə vaxtıdır: {names}',
  reply_user: 'Bir istifadəçi',
  reply_title: '{name} rəyinizə cavab yazdı',
  weather_unknown: 'Naməlum',
  init_select_country: 'Ölkə seçin',
  init_search: 'Axtar',
  init_none_found: 'Ölkə tapılmadı',
  init_select_language: 'Dil seçin',
  init_continue: 'Davam et',
  init_change_later: 'Dili sonradan tənzimləmələrdən dəyişə bilərsiniz',
  nutr_item_word: 'qida',
  nutr_nursing: 'Əmizdirmə',
  nutr_anytime: 'İstənilən vaxt',
  tip_t1: 'Enerji Artımı',
  tip_b1: 'Follikulyar fazada estrogen artır və artan enerji və optimizm gətirir.',
  tip_t2: 'Hidrasiya Vacibdir',
  tip_b2: 'Bol su içmək şişkinliyi aradan qaldırır və menstruasiya simptomlarını yüngülləşdirir. Orqanizmin maye balansını qoruyaraq bu dövrü daha rahat keçirə bilərsiniz.',
  tip_t3: 'Yuxu Keyfiyyəti',
  tip_b3: 'Tsikl boyu baş verən hormonal dəyişikliklər yuxunuza təsir edə bilər. Keyfiyyətli istirahət üçün sabit yuxu rejiminə riayət edin.',
  tip_t4: 'Tsiklini Anlamaq',
  tip_b4: 'Menstrual dövrünüz dörd fazaya bölünür: Menstruasiya, Follikulyar, Ovulyasiya və Luteal. Hər faza fərqli hormonal dəyişikliklərlə müşayiət olunur. Menstruasiya (Qış): Hormonların ən aşağı səviyyədə olduğu, bədənin yeniləndiyi və istirahət tələb edən "təmizlənmə" dövrüdür. Follikulyar faza (Bahar): Estrogenin artması ilə enerjinin, yaradıcılığın və sosial aktivliyin yüksəldiyi mərhələdir. Ovulyasiya (Yay): Mayalanma ehtimalının və özünəinamın zirvədə olduğu, bədənin ən enerjili 24-48 saatıdır. Luteal faza (Payız): Progesteronun təsiri ilə bədənin yavaşladığı, daha çox emosional həssaslıq və daxili sakitlik tələb olunan dövrdür.',
  tip_t5: 'Məşq Faydaları',
  tip_b5: 'Müntəzəm məşq etmək menstrual sancıları yüngülləşdirir və tsikl boyu əhval-ruhiyyəni yüksəldir.',
  tip_t6: 'Enerji Yüksəlir',
  tip_b6: 'Estrogen səviyyəsi yüksəlir! Yeni layihələrə başlamaq və çətin işlərin öhdəsindən gəlmək üçün əla zamandır.',
  tip_t7: 'Yeni Məşqlər Sınayın',
  tip_b7: 'Bədəniniz indi daha intensiv məşqlərə hazırdır. HIIT, qaçış və ya ağırlıq məşqlərini sınayın.',
  tip_t8: 'Protein Gücü',
  tip_b8: 'Əzələ inkişafını toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.',
  tip_t9: 'Sosial Enerji',
  tip_b9: 'Özünüzü daha sosial və ünsiyyətcil hiss edə bilərsiniz. Sosiallaşmaq və yeni əlaqələr qurmaq üçün əla zamandır.',
  tip_t10: 'Yaradıcılıq Zirvəsi',
  tip_b10: 'Zehni fəaliyyətiniz güclənib. Bu vaxtı beyin fırtınası, öyrənmək və yaradıcı işlər üçün dəyərləndirin.',
};

const SYSTEM = [
  'You are a professional medical/parenting translator for a pregnancy & motherhood app (Anacan).',
  'Translate the JSON values from Azerbaijani to Kazakh (Cyrillic script, as used in Kazakhstan).',
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders EXACTLY as-is: {name} {n} {d} {names} {childName} {ageInstruction} {ageText} {theme} {hero} {moral} {style}.',
  '3) Preserve emojis and line breaks (\\n) exactly. Keep brand words unchanged: Anacan, Premium, Dr.Anacan.',
  '4) Use the formal «Сіз» form. Use «етеккір» for period/menstruation, «бөпе» for baby, «ДДСҰ» for WHO.',
  '5) Medical accuracy over literal wording; warm, natural Kazakh.',
].join('\n');

(async () => {
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(PAYLOAD) }],
    max_completion_tokens: 16000,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) {
      await new Promise((r) => setTimeout(r, attempt * 6000));
      continue;
    }
    if (!resp.ok) { console.error('HTTP', resp.status, (await resp.text()).slice(0, 200)); process.exit(1); }
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(text.startsWith('```') ? text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : text);
    const missing = Object.keys(PAYLOAD).filter((k) => !parsed[k]);
    if (missing.length) { console.error('✗ çatışmayan açarlar:', missing.join(',')); process.exit(1); }
    fs.writeFileSync(path.join(__dirname, 'kk-hardcoded.json'), JSON.stringify(parsed, null, 2), 'utf8');
    console.log(`✓ kk-hardcoded.json — ${Object.keys(parsed).length} açar`);
    return;
  }
  console.error('✗ retries exhausted');
  process.exit(1);
})();
