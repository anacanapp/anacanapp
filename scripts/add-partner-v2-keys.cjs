/**
 * Partner Module 2.0 "Birlikdə" — translation keys (az + en).
 * Run: node scripts/add-partner-v2-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // ── Nav ──
  partnerv2_nav_bugun: { az: 'Bu gün', en: 'Today' },
  partnerv2_birlikde: { az: 'Birlikdə', en: 'Together' },
  partnerv2_birlikde_eyebrow: { az: 'BİRLİKDƏ', en: 'TOGETHER' },
  partnerv2_sinxron_eyebrow: { az: 'SİNXRON', en: 'SYNCED' },
  partnerv2_salam: { az: 'Salam', en: 'Hello' },

  // ── Hero ──
  partnerv2_hamilelik_yolculugu: { az: 'Hamiləlik yolçuluğu', en: 'Pregnancy journey' },
  partnerv2_analiq_dovru: { az: 'Analıq dövrü', en: 'Motherhood' },
  partnerv2_tsikl_izleme: { az: 'Tsikl izləmə', en: 'Cycle tracking' },
  partnerv2_ehval: { az: 'əhval', en: 'mood' },
  partnerv2_hefte: { az: 'həftə', en: 'weeks' },
  partnerv2_gun_qaldi: { az: 'gün qaldı', en: 'days left' },
  partnerv2_korpe: { az: 'Körpə', en: 'Baby' },
  partnerv2_faza: { az: 'faza', en: 'phase' },
  partnerv2_gun_novbetiye: { az: 'gün növbətiyə', en: 'days to next' },
  partnerv2_faza_menstrual: { az: 'Menstruasiya', en: 'Period' },
  partnerv2_faza_follikulyar: { az: 'Follikulyar', en: 'Follicular' },
  partnerv2_faza_ovulyasiya: { az: 'Ovulyasiya', en: 'Ovulation' },
  partnerv2_faza_luteal: { az: 'Luteal', en: 'Luteal' },
  partnerv2_destek_banner: { az: 'Bu gün əhvalı yaxşı deyil — ona xüsusi diqqət göstər 💗', en: 'She\u2019s feeling low today — give her extra care 💗' },
  partnerv2_nece_hiss_edirsen: { az: '🤗 Necə hiss edirsən?', en: '🤗 How are you feeling?' },

  // ── Missions ──
  partnerv2_bugun_nece_komek_edim: { az: 'Bu gün necə kömək edim?', en: 'How can I help today?' },
  partnerv2_tamamlandi: { az: 'tamamlandı', en: 'done' },
  partnerv2_seviyye: { az: 'Səviyyə', en: 'Level' },
  partnerv2_novbeti_seviyyeye: { az: 'Növbəti səviyyəyə', en: 'To next level' },
  partnerv2_xal: { az: 'xal', en: 'pts' },
  partnerv2_tesekkurler_qaygikesh: { az: 'Təşəkkürlər, qayğıkeş partnyor!', en: 'Thank you, caring partner!' },
  partnerv2_hamisina_bax: { az: 'Hamısına bax', en: 'View all' },
  partnerv2_yigcam_gorunus: { az: 'Yığcam görünüş', en: 'Compact view' },
  partnerv2_asan: { az: 'Asan', en: 'Easy' },
  partnerv2_orta: { az: 'Orta', en: 'Medium' },
  partnerv2_cetin: { az: 'Çətin', en: 'Hard' },

  // ── Activity feed ──
  partnerv2_aktivlik_lenti: { az: 'Aktivlik lenti', en: 'Activity feed' },
  partnerv2_onun_gunu_canli: { az: 'Onun günü — canlı', en: 'Her day — live' },
  partnerv2_hele_aktivlik_yoxdur: { az: 'Bu gün hələ aktivlik yoxdur', en: 'No activity yet today' },
  partnerv2_tepik_su_ehval_burada: { az: 'Təpiklər, su və əhval dəyişiklikləri burada görünəcək', en: 'Kicks, water and mood updates will appear here' },
  partnerv2_ehval_yenilendi: { az: 'Əhval yeniləndi', en: 'Mood updated' },
  partnerv2_korpe_tepik_atdi: { az: 'Körpə təpik atdı', en: 'Baby kicked' },
  partnerv2_su_hedefi: { az: 'Su hədəfinə çatdı', en: 'Water goal reached' },
  partnerv2_sanci_qeyd_edildi: { az: 'Sancı qeyd edildi', en: 'Contraction logged' },
  partnerv2_511_qaydasi: { az: '5-1-1 Qaydası!', en: '5-1-1 Rule!' },
  partnerv2_gunluk_xulase: { az: 'Günlük xülasə', en: 'Daily summary' },
  partnerv2_dogus_siqnali: { az: 'Doğuş siqnalı!', en: 'Birth alert!' },
  partnerv2_tesekkur_aldiniz: { az: 'Təşəkkür aldınız', en: 'You got a thank-you' },
  partnerv2_indice: { az: 'İndicə', en: 'Just now' },
  partnerv2_deq: { az: 'dəq', en: 'min' },
  partnerv2_saat: { az: 'saat', en: 'h' },
  partnerv2_gun: { az: 'gün', en: 'd' },

  // ── Appointments ──
  partnerv2_bu_gun: { az: 'Bu gün', en: 'Today' },
  partnerv2_sabah: { az: 'Sabah', en: 'Tomorrow' },
  partnerv2_onu_aparmagi_unutma: { az: 'onu aparmağı unutma', en: 'don\u2019t forget to take her' },
  partnerv2_randevular: { az: 'Randevular', en: 'Appointments' },
  partnerv2_onun_vizitleri: { az: 'Onun vizitləri', en: 'Her visits' },
  partnerv2_hekim_vizitleri: { az: 'Həkim vizitləri', en: 'Doctor visits' },
  partnerv2_qarsidan_gelen: { az: 'Qarşıdan gələn', en: 'Upcoming' },
  partnerv2_kecmis: { az: 'Keçmiş', en: 'Past' },
  partnerv2_randevu_yoxdur: { az: 'Randevu yoxdur', en: 'No appointments' },
  partnerv2_randevu_yoxdur_izah: { az: 'Həyat yoldaşınız randevu əlavə etdikdə burada görünəcək.', en: 'Appointments your wife adds will appear here.' },
  partnerv2_paylasim_bagli: { az: 'Paylaşım bağlıdır', en: 'Sharing is off' },
  partnerv2_randevu_paylasimi_bagli_izah: { az: 'Həyat yoldaşınız randevu paylaşımını hazırda bağlayıb.', en: 'Your wife has turned off appointment sharing.' },

  // ── Together hub ──
  partnerv2_alisveris: { az: 'Alışveriş', en: 'Shopping' },
  partnerv2_gozleyen_mehsul: { az: 'gözləyən məhsul', en: 'items pending' },
  partnerv2_siyahi_hazir: { az: 'Siyahı hazırdır', en: 'List is ready' },
  partnerv2_birlikde_secin: { az: 'Birlikdə seçin', en: 'Choose together' },
  partnerv2_korpe_gunu: { az: 'Körpə Günü', en: 'Baby\u2019s Day' },
  partnerv2_yeme_yuxu_bez: { az: 'Yemə · yuxu · bez', en: 'Feeds · sleep · diapers' },
  partnerv2_planlanib: { az: 'planlanıb', en: 'planned' },
  partnerv2_onu_sevindir: { az: 'Onu sevindir', en: 'Make her smile' },
  partnerv2_son_7_gun: { az: 'Son 7 gün', en: 'Last 7 days' },

  // ── Baby day ──
  partnerv2_qidalanma: { az: 'Qidalanma', en: 'Feeding' },
  partnerv2_yuxu: { az: 'Yuxu', en: 'Sleep' },
  partnerv2_bez: { az: 'Bez', en: 'Diapers' },
  partnerv2_bez_deyisme: { az: 'Bez dəyişmə', en: 'Diaper change' },
  partnerv2_davam_edir: { az: 'davam edir', en: 'ongoing' },
  partnerv2_bugunku_qeydler: { az: 'Bugünkü qeydlər', en: 'Today\u2019s logs' },
  partnerv2_bugun_qeyd_yoxdur: { az: 'Bu gün hələ qeyd yoxdur', en: 'No logs yet today' },
  partnerv2_korpe_gunu_ipucu: { az: 'Gecə növbəsini öz üzərinə götür — ananın 4 saatlıq fasiləsiz yuxusu qızıl dəyərindədir. 💛', en: 'Take the night shift — 4 hours of uninterrupted sleep is gold for mom. 💛' },
  partnerv2_korpe_paylasimi_bagli_izah: { az: 'Həyat yoldaşınız körpə qeydlərinin paylaşımını hazırda bağlayıb.', en: 'Your wife has turned off baby log sharing.' },

  // ── SOS / Birth ──
  partnerv2_partnyoru_cagir: { az: 'Partnyoru çağır', en: 'Call your partner' },
  partnerv2_sos_hold_hint: { az: 'Göndərmək üçün düyməni 1.5 saniyə basılı tutun. Yeriniz avtomatik paylaşılır.', en: 'Hold the button for 1.5 seconds to send. Your location is shared automatically.' },
  partnerv2_dogus_basladi_btn: { az: 'Doğuş başladı! 👶', en: 'Labor has started! 👶' },
  partnerv2_dogus_basladi_sub: { az: 'Partnyor xəstəxana rejiminə keçəcək', en: 'Partner will switch to hospital mode' },
  partnerv2_tecili_sos_btn: { az: 'Təcili kömək — SOS 🚨', en: 'Emergency — SOS 🚨' },
  partnerv2_tecili_sos_sub: { az: 'Yeriniz və xəbərdarlıq dərhal çatır', en: 'Your location and alert arrive instantly' },
  partnerv2_dogus_siqnali_gonderildi: { az: 'Doğuş siqnalı göndərildi!', en: 'Birth alert sent!' },
  partnerv2_sos_gonderildi: { az: 'SOS göndərildi!', en: 'SOS sent!' },
  partnerv2_partnyor_xeberdar_edildi: { az: 'Partnyorunuz dərhal xəbərdar edildi. 💙', en: 'Your partner has been notified instantly. 💙' },
  partnerv2_dogus_basladi_receiver: { az: 'DOĞUŞ BAŞLADI!', en: 'LABOR HAS STARTED!' },
  partnerv2_sos_receiver: { az: 'TƏCİLİ XƏBƏRDARLIQ!', en: 'EMERGENCY ALERT!' },
  partnerv2_xestexana_rejimi_btn: { az: 'Xəstəxana rejimi — YOLA DÜŞ!', en: 'Hospital mode — GO!' },
  partnerv2_lokasiyaya_get: { az: 'Lokasiyaya get', en: 'Open location' },
  partnerv2_yoldayam_btn: { az: 'Yoldayam — xəbər ver', en: 'On my way — notify her' },
  partnerv2_yoldayam_msg: { az: 'Yoldayam! 🚗 Tezliklə çatıram!', en: 'On my way! 🚗 Almost there!' },
  partnerv2_gordum_btn: { az: 'Gördüm', en: 'Got it' },

  // ── Hospital run ──
  partnerv2_dogus_vaxti: { az: 'Doğuş vaxtı', en: 'It\u2019s time' },
  partnerv2_xestexana_rejimi: { az: 'Xəstəxana Rejimi', en: 'Hospital Mode' },
  partnerv2_onun_yeri: { az: 'Onun yeri', en: 'Her location' },
  partnerv2_xeritede_ac: { az: 'Xəritədə aç və yola düş', en: 'Open in maps and go' },
  partnerv2_canli_sancilar: { az: 'Canlı sancılar', en: 'Live contractions' },
  partnerv2_interval_ve_muddet: { az: 'İnterval və müddəti izlə', en: 'Track interval & duration' },
  partnerv2_addim_addim: { az: 'Addım-addım', en: 'Step by step' },
  partnerv2_hr_step_sakit: { az: 'Sakit ol — dərin nəfəs al. Sən hazırsan!', en: 'Stay calm — deep breath. You\u2019re ready!' },
  partnerv2_hr_step_canta: { az: 'Xəstəxana çantasını götür', en: 'Grab the hospital bag' },
  partnerv2_hr_step_senedler: { az: 'Sənədləri yoxla (vəsiqə, analizlər, kart)', en: 'Check documents (ID, tests, card)' },
  partnerv2_hr_step_masin: { az: 'Maşını hazırla / taksi çağır', en: 'Get the car ready / call a taxi' },
  partnerv2_hr_step_hekim: { az: 'Həkimə / xəstəxanaya zəng et', en: 'Call the doctor / hospital' },
  partnerv2_hr_sakit_qeyd: { az: 'İlk doğuşlar adətən saatlarla çəkir — tələsik amma təmkinli ol. Sən onun ən böyük dayağısan. 💪', en: 'First labors usually take hours — be quick but calm. You are her biggest support. 💪' },

  // ── Live contractions ──
  partnerv2_realtime: { az: 'Realtime', en: 'Realtime' },
  partnerv2_511_izah: { az: 'Sancılar sıxlaşıb — xəstəxanaya hazırlaş!', en: 'Contractions are intensifying — get ready for the hospital!' },
  partnerv2_son_1_saat: { az: 'son 1 saat', en: 'last hour' },
  partnerv2_orta_muddet: { az: 'orta müddət', en: 'avg duration' },
  partnerv2_orta_interval: { az: 'orta interval', en: 'avg interval' },
  partnerv2_son_sanci: { az: 'Son sancı', en: 'Last contraction' },
  partnerv2_deq_evvel: { az: 'dəq əvvəl', en: 'min ago' },
  partnerv2_son_24_saat: { az: 'Son 24 saat', en: 'Last 24 hours' },
  partnerv2_sanci_yoxdur: { az: 'Sancı qeyd olunmayıb — hər şey sakitdir 💚', en: 'No contractions logged — all calm 💚' },
  partnerv2_sanci_paylasimi_bagli_izah: { az: 'Həyat yoldaşınız sancı paylaşımını hazırda bağlayıb.', en: 'Your wife has turned off contraction sharing.' },
  partnerv2_d_short: { az: 'd', en: 'm' },
  partnerv2_interval_short: { az: 'interval', en: 'interval' },

  // ── Sharing settings (mother) ──
  partnerv2_siz_idare_edirsiniz: { az: 'Siz idarə edirsiniz', en: 'You are in control' },
  partnerv2_partnyor_nleri_gorur: { az: 'Partnyor nələri görür?', en: 'What does your partner see?' },
  partnerv2_sh_izah: { az: 'Şəxsi qeydləriniz, gündəliyiniz və AI söhbətləriniz heç vaxt paylaşılmır. Aşağıdakı kateqoriyaları istənilən vaxt aça/bağlaya bilərsiniz — dərhal qüvvəyə minir.', en: 'Your private notes, diary and AI chats are never shared. Toggle the categories below anytime — changes apply instantly.' },
  partnerv2_sh_migration_yox: { az: 'Ayarlar bazası hazır deyil — hazırda standart paylaşım aktivdir.', en: 'Settings storage isn\u2019t ready — default sharing is active for now.' },
  partnerv2_sh_ehval: { az: 'Əhval', en: 'Mood' },
  partnerv2_sh_ehval_sub: { az: 'Gündəlik əhval-ruhiyyəniz', en: 'Your daily mood' },
  partnerv2_sh_simptomlar: { az: 'Simptomlar', en: 'Symptoms' },
  partnerv2_sh_simptomlar_sub: { az: 'Qeyd etdiyiniz simptomlar', en: 'Symptoms you log' },
  partnerv2_sh_su: { az: 'Su qəbulu', en: 'Water intake' },
  partnerv2_sh_su_sub: { az: 'Günlük su miqdarı və hədəf', en: 'Daily water amount and goal' },
  partnerv2_sh_tepikler: { az: 'Təpiklər', en: 'Kicks' },
  partnerv2_sh_tepikler_sub: { az: 'Təpik sayğacı bildirişləri', en: 'Kick counter notifications' },
  partnerv2_sh_sancilar: { az: 'Sancılar', en: 'Contractions' },
  partnerv2_sh_sancilar_sub: { az: 'Sancı taymeri və 5-1-1 xəbərdarlığı', en: 'Contraction timer and 5-1-1 alert' },
  partnerv2_sh_ceki: { az: 'Çəki', en: 'Weight' },
  partnerv2_sh_ceki_sub: { az: 'Çəki qeydləriniz (standart: bağlı)', en: 'Your weight entries (default: off)' },
  partnerv2_sh_randevular: { az: 'Randevular', en: 'Appointments' },
  partnerv2_sh_randevular_sub: { az: 'Həkim vizitləri və xatırlatmalar', en: 'Doctor visits and reminders' },
  partnerv2_sh_korpe: { az: 'Körpə qeydləri', en: 'Baby logs' },
  partnerv2_sh_korpe_sub: { az: 'Yemə, yuxu və bez qeydləri', en: 'Feeding, sleep and diaper logs' },
  partnerv2_sh_tsikl: { az: 'Tsikl fazası', en: 'Cycle phase' },
  partnerv2_sh_tsikl_sub: { az: 'Faza və növbəti period məlumatı', en: 'Phase and next period info' },
  partnerv2_sh_xeta: { az: 'Yadda saxlanılmadı', en: 'Could not save' },
  partnerv2_sh_xeta_sub: { az: 'Yenidən cəhd edin.', en: 'Please try again.' },
  partnerv2_baglantini_kes: { az: 'Bağlantını kəs', en: 'Unlink partner' },
  partnerv2_baglantini_kes_sub: { az: 'Partnyor bütün girişini itirəcək', en: 'Your partner will lose all access' },
  partnerv2_unlink_tesdiq_izah: { az: 'Partnyorunuz artıq heç bir məlumatınızı görməyəcək və partnyor paneli bağlanacaq. Yenidən bağlanmaq üçün kodu təkrar paylaşmalısınız.', en: 'Your partner will no longer see any of your data and their panel will close. Share your code again to re-link.' },
  partnerv2_beli_kes: { az: 'Bəli, kəs', en: 'Yes, unlink' },
  partnerv2_baglanti_kesildi: { az: 'Bağlantı kəsildi', en: 'Unlinked' },
  partnerv2_baglanti_kesildi_sub: { az: 'Partnyor artıq məlumatlarınızı görmür.', en: 'Your partner can no longer see your data.' },
  partnerv2_unlink_partner_side_sub: { az: 'Həyat yoldaşınızın məlumatlarına girişi dayandırın', en: 'Stop access to your wife\u2019s data' },
  partnerv2_unlink_partner_tesdiq: { az: 'Partnyor paneli bağlanacaq və həyat yoldaşınızın məlumatlarına giriş dayandırılacaq. Yenidən bağlanmaq üçün kod lazım olacaq.', en: 'The partner panel will close and access to your wife\u2019s data will stop. You\u2019ll need the code to re-link.' },

  // ── Mother care card ──
  partnerv2_bu_gun_short: { az: 'Bu gün', en: 'Today' },
  partnerv2_mesaj: { az: 'mesaj', en: 'messages' },
  partnerv2_yaninizdadir: { az: 'Yanınızdadır 💙', en: 'By your side 💙' },
  partnerv2_tesekkur_et: { az: 'Təşəkkür et', en: 'Say thanks' },
  partnerv2_thank_title: { az: '🙏 Təşəkkür aldınız!', en: '🙏 You got a thank-you!' },
  partnerv2_thank_body: { az: 'Xanımınız sizə minnətdardır. Əla iş görürsən!', en: 'Your wife is grateful. You\u2019re doing great!' },
  partnerv2_thank_fallback_text: { az: '🙏 Təşəkkür edirəm! Sən əla partnyorsan!', en: '🙏 Thank you! You\u2019re an amazing partner!' },
  partnerv2_thank_sent: { az: 'Təşəkkür göndərildi! 💙', en: 'Thank-you sent! 💙' },
  partnerv2_hefte_beledci: { az: 'həftə — partnyor bələdçisi', en: 'week — partner guide' },

  // ── SOS hook (yeni mesajlar) ──
  usesosalert_dogus_basladi_msg: { az: 'Doğuş başladı! Xəstəxanaya getmə vaxtıdır!', en: 'Labor has started! Time to go to the hospital!' },
  usesosalert_dogus_siqnali_title: { az: '👶 DOĞUŞ SİQNALI!', en: '👶 BIRTH ALERT!' },
  usesosalert_dogus_basladi_push_body: { az: 'Sancılar başladı — dərhal əlaqə saxla!', en: 'Contractions started — get in touch now!' },

  // ── AI partner ──
  aichat_welcome_partner_1: { az: 'Salam', en: 'Hey' },
  aichat_welcome_partner_2: { az: 'Mən Anacan.AI — bu yolu yaxşı bilən bir dost kimi düşün. ', en: 'I\u2019m Anacan.AI — think of me as a friend who knows this road well. ' },
  aichat_welcome_partner_3: { az: '{name} xanıma dəstək olmaq, ', en: 'Supporting {name}, ' },
  aichat_welcome_partner_3b: { az: 'Xanımına dəstək olmaq, ', en: 'Supporting your wife, ' },
  aichat_welcome_partner_4: { az: 'doğuşa hazırlıq və yaxşı ata olmaq barədə istənilən sualını verə bilərsən.', en: 'birth prep and being a great dad — ask me anything.' },
  aichatscreen_partner_q1: { az: 'Xanımıma bu həftə necə dəstək ola bilərəm?', en: 'How can I support my wife this week?' },
  aichatscreen_partner_q2: { az: 'Doğuş zamanı mən nə etməliyəm?', en: 'What should I do during labor?' },
  aichatscreen_partner_q3: { az: 'Onun əhvalı dəyişkəndir — necə davranım?', en: 'Her mood swings — how should I respond?' },
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
