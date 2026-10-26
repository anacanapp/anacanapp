/**
 * Təhlükəsizlik Paketi (BP + Red Flags + PDF + Privacy) — translation keys.
 * Run: node scripts/add-safety-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // ── Blood Pressure ──
  bp_title: { az: 'Qan Təzyiqi', en: 'Blood Pressure' },
  bp_eyebrow: { az: 'Ürək sağlamlığı', en: 'Heart health' },
  bp_eyebrow_bump: { az: 'Preeklampsiya nəzarəti', en: 'Preeclampsia watch' },
  bp_new_reading: { az: 'Yeni ölçmə', en: 'New reading' },
  bp_systolic: { az: 'Sistolik', en: 'Systolic' },
  bp_diastolic: { az: 'Diastolik', en: 'Diastolic' },
  bp_pulse: { az: 'Nəbz', en: 'Pulse' },
  bp_optional: { az: 'istəyə bağlı', en: 'optional' },
  bp_save_btn: { az: 'Qeyd et', en: 'Log reading' },
  bp_saved: { az: 'qeyd edildi', en: 'logged' },
  bp_invalid: { az: 'Düzgün dəyərlər daxil edin (məs. 120/80)', en: 'Enter valid values (e.g. 120/80)' },
  bp_invalid_pulse: { az: 'Nəbz 30-220 aralığında olmalıdır', en: 'Pulse must be between 30-220' },
  bp_save_error: { az: 'Saxlanılmadı — bazanın hazır olduğundan əmin olun', en: 'Could not save — make sure the database is ready' },
  bp_history: { az: 'Tarixçə', en: 'History' },
  bp_bpm: { az: 'vur/dəq', en: 'bpm' },
  bp_empty_title: { az: 'Hələ ölçmə yoxdur', en: 'No readings yet' },
  bp_empty_text: { az: 'İlk qan təzyiqi ölçmənizi yuxarıda qeyd edin. Hamiləlikdə həftədə 1-2 dəfə ölçmək tövsiyə olunur.', en: 'Log your first blood pressure reading above. During pregnancy, measuring 1-2 times a week is recommended.' },
  bp_thresholds_title: { az: '📋 İstinad hədləri', en: '📋 Reference ranges' },
  bp_th_normal: { az: 'Normal', en: 'Normal' },
  bp_th_preeclampsia: { az: 'hamiləlikdə preeklampsiya riski, həkimə bildirin', en: 'preeclampsia risk in pregnancy, tell your doctor' },
  bp_th_crisis: { az: 'dərhal 103', en: 'call emergency immediately' },
  bp_disclaimer: { az: 'Bu alət həkim müayinəsini əvəz etmir.', en: 'This tool does not replace medical examination.' },
  bp_urgent_eyebrow: { az: 'Təcili', en: 'Urgent' },
  bp_urgent_preeclampsia: { az: 'Ağır hipertenziya — preeklampsiya riski!', en: 'Severe hypertension — preeclampsia risk!' },
  bp_urgent_crisis: { az: 'Hipertonik böhran!', en: 'Hypertensive crisis!' },
  bp_urgent_text: { az: 'Gözləməyin — dərhal həkiminizə və ya təcili yardıma müraciət edin.', en: 'Don\u2019t wait — contact your doctor or emergency services immediately.' },
  bp_warning_preeclampsia: { az: 'Son ölçmə ≥140/90 — hamiləlikdə bu, preeklampsiya əlaməti ola bilər. Bu gün həkiminizlə əlaqə saxlayın.', en: 'Last reading ≥140/90 — in pregnancy this can signal preeclampsia. Contact your doctor today.' },
  bp_warning_stage2: { az: 'Son ölçməniz yüksəkdir. Bu gün həkiminizlə əlaqə saxlamağı tövsiyə edirik.', en: 'Your last reading is high. We recommend contacting your doctor today.' },

  // BP categories
  bp_cat_low: { az: 'Aşağı', en: 'Low' },
  bp_cat_normal: { az: 'Normal', en: 'Normal' },
  bp_cat_elevated: { az: 'Yüksəlmiş', en: 'Elevated' },
  bp_cat_stage1: { az: 'Hipertenziya I', en: 'Hypertension I' },
  bp_cat_stage2: { az: 'Hipertenziya II', en: 'Hypertension II' },
  bp_cat_crisis: { az: 'Hipertonik böhran', en: 'Hypertensive crisis' },
  bp_guide_low: { az: 'Başgicəllənmə hiss edirsinizsə oturun, su için. Təkrarlanırsa həkimə bildirin.', en: 'If dizzy, sit down and drink water. Tell your doctor if it recurs.' },
  bp_guide_normal: { az: 'Əla! Təzyiqiniz sağlam aralıqdadır.', en: 'Great! Your blood pressure is in the healthy range.' },
  bp_guide_elevated: { az: 'Duz qəbulunu azaldın, istirahət edin və müntəzəm ölçün.', en: 'Reduce salt intake, rest, and measure regularly.' },
  bp_guide_stage1: { az: 'Bir neçə gün ardıcıl yüksəkdirsə həkiminizlə məsləhətləşin.', en: 'If elevated for several consecutive days, consult your doctor.' },
  bp_guide_stage2: { az: 'Bu gün həkiminizlə əlaqə saxlayın.', en: 'Contact your doctor today.' },
  bp_guide_crisis: { az: 'DƏRHAL təcili yardıma (103) müraciət edin!', en: 'Seek emergency care IMMEDIATELY!' },

  // ── Red Flags ──
  rf_title: { az: 'Təhlükə Əlamətləri', en: 'Danger Signs' },
  rf_eyebrow_bump: { az: 'Hamiləlik dövrü', en: 'During pregnancy' },
  rf_eyebrow_pp: { az: 'Doğuşdan sonra', en: 'Postpartum' },
  rf_intro: { az: 'Bu əlamətlərdən hər hansı biri sizdə varsa, gözləmək olmaz. Şübhə halında həmişə həkimə müraciət edin — "boş yerə narahat etdim" deyə bir şey yoxdur.', en: 'If you have any of these signs, do not wait. When in doubt, always contact your doctor — there is no such thing as "bothering them for nothing".' },
  rf_103_title: { az: 'Təcili Tibbi Yardım', en: 'Emergency Medical Help' },
  rf_103_sub: { az: 'Zəng etmək üçün toxunun', en: 'Tap to call' },
  rf_urgent_section: { az: 'Dərhal müraciət', en: 'Seek help now' },
  rf_soon_section: { az: 'Bu gün həkimlə əlaqə', en: 'Contact doctor today' },
  rf_urgent_chip: { az: 'TƏCİLİ', en: 'URGENT' },
  rf_soon_chip: { az: 'BU GÜN HƏKİMƏ', en: 'DOCTOR TODAY' },
  rf_urgent_guidance: { az: '⚠️ Gözləməyin: dərhal həkiminizə zəng edin və ya təcili yardıma (103) müraciət edin.', en: '⚠️ Don\u2019t wait: call your doctor now or seek emergency care.' },
  rf_soon_guidance: { az: '📞 Bu gün ərzində həkiminizlə əlaqə saxlayın və vəziyyəti izləyin.', en: '📞 Contact your doctor today and monitor the situation.' },
  rf_notify_partner: { az: 'Partnyora bildir', en: 'Notify partner' },
  rf_partner_done: { az: 'Xəbərdar edildi ✓', en: 'Notified ✓' },
  rf_partner_notified: { az: 'Partnyorunuz xəbərdar edildi 💙', en: 'Your partner has been notified 💙' },
  rf_partner_msg_suffix: { az: 'dərhal əlaqə saxla!', en: 'contact me right away!' },
  rf_disclaimer: { az: 'Bu siyahı məlumat xarakterlidir və həkim qiymətləndirməsini əvəz etmir.', en: 'This list is informational and does not replace medical assessment.' },

  // Signs
  rf_bleeding_title: { az: 'Vaginal qanaxma', en: 'Vaginal bleeding' },
  rf_bleeding_desc: { az: 'İstənilən həcmdə parlaq qırmızı qanaxma — xüsusilə ağrı ilə birgə.', en: 'Any bright red bleeding — especially with pain.' },
  rf_movement_title: { az: 'Körpənin hərəkəti azalıb', en: 'Reduced baby movement' },
  rf_movement_desc: { az: '28-ci həftədən sonra körpə adi ritmindən nəzərəçarpacaq az tərpənir (2 saatda <10 hərəkət).', en: 'After week 28, noticeably fewer movements than usual (<10 in 2 hours).' },
  rf_waters_title: { az: 'Su gəlib (dölyanı maye)', en: 'Waters broke' },
  rf_waters_desc: { az: 'Qəfil və ya davamlı maye axını — 37 həftədən əvvəldirsə xüsusilə təcilidir.', en: 'Sudden or continuous fluid leak — especially urgent before 37 weeks.' },
  rf_headache_title: { az: 'Kəskin başağrı + görmə pozğunluğu', en: 'Severe headache + vision changes' },
  rf_headache_desc: { az: 'Keçməyən güclü başağrı, göz önündə ulduzlar/dumanlı görmə — preeklampsiya əlaməti ola bilər.', en: 'Persistent severe headache, seeing spots/blurry vision — possible preeclampsia sign.' },
  rf_swelling_title: { az: 'Üz və əllərdə qəfil şişkinlik', en: 'Sudden face/hand swelling' },
  rf_swelling_desc: { az: 'Qəfil yaranan şişkinlik (xüsusilə üz/əllər) — preeklampsiya riski.', en: 'Sudden swelling (especially face/hands) — preeclampsia risk.' },
  rf_abdominal_title: { az: 'Kəskin qarın ağrısı', en: 'Severe abdominal pain' },
  rf_abdominal_desc: { az: 'Keçməyən, kəskin və ya birtərəfli qarın ağrısı.', en: 'Persistent, sharp or one-sided abdominal pain.' },
  rf_fever_title: { az: 'Hərarət 38°C və üzəri', en: 'Fever 38°C or higher' },
  rf_fever_desc: { az: 'Yüksək hərarət — infeksiya əlaməti ola bilər.', en: 'High fever — may indicate infection.' },
  rf_vomiting_title: { az: 'Dayanmayan qusma', en: 'Persistent vomiting' },
  rf_vomiting_desc: { az: '24 saatdan çox heç nə saxlaya bilmirsinizsə — susuzlaşma riski.', en: 'Unable to keep anything down for 24+ hours — dehydration risk.' },
  rf_urination_title: { az: 'Ağrılı sidik ifrazı', en: 'Painful urination' },
  rf_urination_desc: { az: 'Yanma/ağrı — sidik yolu infeksiyası müalicəsiz qalmamalıdır.', en: 'Burning/pain — a UTI should not go untreated.' },
  rf_dizziness_title: { az: 'Bayılma / güclü başgicəllənmə', en: 'Fainting / severe dizziness' },
  rf_dizziness_desc: { az: 'Huşun itməsi və ya təkrarlanan güclü başgicəllənmə.', en: 'Loss of consciousness or recurring severe dizziness.' },
  rf_pp_bleeding_title: { az: 'Güclü doğuşdan sonra qanaxma', en: 'Heavy postpartum bleeding' },
  rf_pp_bleeding_desc: { az: '1 saatda 1 bezdən çox islanır və ya böyük laxtalar gəlir.', en: 'Soaking more than one pad per hour or passing large clots.' },
  rf_chest_title: { az: 'Sinə ağrısı / nəfəs darlığı', en: 'Chest pain / shortness of breath' },
  rf_chest_desc: { az: 'Qəfil sinə ağrısı və ya nəfəs almaqda çətinlik — dərhal təcili yardım.', en: 'Sudden chest pain or difficulty breathing — emergency care now.' },
  rf_leg_title: { az: 'Bir ayaqda ağrı və şişkinlik', en: 'Pain and swelling in one leg' },
  rf_leg_desc: { az: 'Birtərəfli ayaq ağrısı, istilik, qızartı — tromb (DVT) əlaməti ola bilər.', en: 'One-sided leg pain, warmth, redness — possible blood clot (DVT).' },
  rf_incision_title: { az: 'Tikiş yerində infeksiya əlaməti', en: 'Incision infection signs' },
  rf_incision_desc: { az: 'Qızartı, şişkinlik, irin və ya artan ağrı (Qeysəriyyə/epizio).', en: 'Redness, swelling, discharge or increasing pain (C-section/episiotomy).' },
  rf_mental_title: { az: 'Ağır kədər və ya zərər fikirləri', en: 'Severe sadness or harmful thoughts' },
  rf_mental_desc: { az: 'Özünüzə/körpəyə zərər fikirləri gəlirsə — bu sizin günahınız deyil, kömək mövcuddur. Dərhal yaxınınıza deyin və mütəxəssisə müraciət edin.', en: 'Thoughts of harming yourself/your baby — this is not your fault, help exists. Tell someone close immediately and seek professional support.' },

  // Red flag banner
  rfb_urgent_title: { az: 'Təzyiq təhlükəli səviyyədədir!', en: 'Blood pressure at dangerous level!' },
  rfb_urgent_sub: { az: 'Dərhal həkimə müraciət edin — ətraflı üçün toxunun', en: 'Seek medical help now — tap for details' },
  rfb_warning_title: { az: 'Təzyiqiniz yüksəkdir', en: 'Your blood pressure is high' },
  rfb_warning_sub: { az: 'Preeklampsiya riski — bu gün həkiminizlə danışın', en: 'Preeclampsia risk — talk to your doctor today' },

  // ── PDF ──
  pdf_report_subtitle: { az: 'Həkim Hesabatı', en: 'Doctor Report' },
  pdf_section_basics: { az: 'Əsas Məlumatlar', en: 'Key Information' },
  pdf_section_trends: { az: 'Sağlamlıq Trendləri', en: 'Health Trends' },
  pdf_section_bp: { az: 'Qan Təzyiqi (son ölçmələr)', en: 'Blood Pressure (recent readings)' },
  pdf_section_notes: { az: 'Həkim üçün Qeydlər', en: 'Notes for the Doctor' },
  pdf_footer: { az: 'Anacan tətbiqi ilə yaradılıb · Bu hesabat tibbi sənəd deyil, məlumat xarakterlidir.', en: 'Generated with the Anacan app · This report is informational, not a medical document.' },
  pdf_stage_bump: { az: 'Hamiləlik dövrü', en: 'Pregnancy' },
  pdf_stage_mommy: { az: 'Analıq dövrü', en: 'Motherhood' },
  pdf_stage_flow: { az: 'Tsikl izləmə', en: 'Cycle tracking' },
  pdf_shared_toast: { az: 'Hesabat paylaşıldı 📤', en: 'Report shared 📤' },
  pdf_downloaded_toast: { az: 'PDF yükləndi ✓', en: 'PDF downloaded ✓' },
  pdf_error_toast: { az: 'PDF yaradıla bilmədi', en: 'Could not create PDF' },
  pdf_error_desc: { az: 'Yenidən cəhd edin.', en: 'Please try again.' },

  // ── Privacy persist ──
  privacy_save_failed: { az: 'Yadda saxlanılmadı — yenidən cəhd edin.', en: 'Could not save — please try again.' },

  // Pre-existing key en.json-da var idi, az.json-da çatışmırdı
  untranslated_mesajlar_ak8wzw: { az: 'Mesajlar', en: 'Messages' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  let updated = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {
      json[key] = values[lang];
      added++;
    } else if (json[key] !== values[lang]) {
      json[key] = values[lang];
      updated++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${added} added, ${updated} updated (${Object.keys(json).length} total)`);
}
