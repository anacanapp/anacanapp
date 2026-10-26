-- ============================================================
-- Qazax5 — UI açarlarının DELTASI (Qazax2-dən sonra tapılan boşluqlar)
-- 1605 açar: az.json-da olmayan, kodda inline-AZ-default olan açarlar
-- (dashboard salamlama, trimester, bottom nav, partner kartı, billing və s.)
-- Qazax2-ni artıq işlətmisinizsə YALNIZ bunu işlədin. İdempotentdir.
-- ============================================================


INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('authscreen_olke', 'kk', 'Ел', 'common'),
  ('authscreen_olke_secin', 'kk', 'Елді таңдаңыз', 'common'),
  ('billingscreen_annual_premium', 'kk', 'Жылдық Premium', 'common'),
  ('billingscreen_auto_renewal', 'kk', 'Автоматты ұзарту', 'common'),
  ('billingscreen_cancel_appstore', 'kk', 'Жазылымнан бас тарту үшін App Store / Google Play жазылымдарын басқару бетіне бағытталасыз.', 'common'),
  ('billingscreen_cancel_confirm', 'kk', 'Жазылымнан бас тартқыңыз келетініне сенімдісіз бе? Premium қолжетімділігі ағымдағы кезеңнің соңына дейін сақталады.', 'common'),
  ('billingscreen_cancel_error', 'kk', 'Жазылымнан бас тарту мүмкін болмады.', 'common'),
  ('billingscreen_cancel_success', 'kk', 'Жазылымнан бас тартылды', 'common'),
  ('billingscreen_cancel_success_desc', 'kk', 'Premium мүмкіндіктерін ағымдағы кезеңнің соңына дейін пайдалана аласыз.', 'common'),
  ('billingscreen_error', 'kk', 'Қате', 'common'),
  ('billingscreen_first_purchase', 'kk', 'Алғашқы сатып алу', 'common'),
  ('billingscreen_monthly_premium', 'kk', 'Айлық Premium', 'common'),
  ('billingscreen_need_help', 'kk', 'Көмек керек пе?', 'common'),
  ('billingscreen_next_renewal', 'kk', 'Келесі ұзарту', 'common'),
  ('billingscreen_open_in_store', 'kk', 'App Store-да ашу', 'common'),
  ('billingscreen_premium_features', 'kk', 'Premium мүмкіндіктері', 'common'),
  ('billingscreen_refresh', 'kk', 'Жаңарту', 'common'),
  ('billingscreen_restore_error', 'kk', 'Жазылымды қалпына келтіру мүмкін болмады.', 'common'),
  ('billingscreen_restore_success', 'kk', 'Жазылым қалпына келтірілді', 'common'),
  ('billingscreen_restore_success_desc', 'kk', 'Premium жазылымыңыз қайта белсенді.', 'common'),
  ('billingscreen_scheduled', 'kk', 'Жоспарланған', 'common'),
  ('billingscreen_status_free', 'kk', 'Ағымдағы мәртебе: Тегін', 'common'),
  ('billingscreen_title', 'kk', 'Менің жазылымым', 'common'),
  ('billingscreen_upgrade', 'kk', 'Жақсарту', 'common'),
  ('billingscreen_upgrade_btn', 'kk', 'Premium-ға өту', 'common'),
  ('common_initial_i', 'kk', 'П', 'common'),
  ('common_parametrler', 'kk', 'Параметрлер', 'common'),
  ('dashboard_1_trimester', 'kk', '1-триместр', 'common'),
  ('dashboard_2_trimester', 'kk', '2-триместр', 'common'),
  ('dashboard_3_trimester', 'kk', '3-триместр', 'common'),
  ('dashboard_diaper_change', 'kk', 'Жөргек ауыстыру:', 'common'),
  ('dashboard_glasses', 'kk', 'стақан', 'common'),
  ('dashboard_h', 'kk', 'сағ', 'common'),
  ('dashboard_kick', 'kk', 'теб.', 'common'),
  ('dashboard_m', 'kk', 'мин', 'common'),
  ('dashboard_qr', 'kk', 'г', 'common'),
  ('dashboard_sec', 'kk', 'сек', 'common'),
  ('dashboard_sm', 'kk', 'см', 'common'),
  ('dashboard_today', 'kk', 'Бүгін', 'common'),
  ('dashboard_week_baby', 'kk', 'апта — бөпе', 'common'),
  ('funnel_week_stats', 'kk', '-апта: осы мерзімдегі жүкті әйелдердің 78%-ы белгілі бір жайсыздықты сезінеді.', 'common'),
  ('aichat_welcome_bump_1', 'kk', 'Сәлеметсіз бе', 'common'),
  ('aichat_welcome_bump_2', 'kk', 'Мен Anacan.AI.', 'common'),
  ('aichat_welcome_bump_3', 'kk', 'Қазір жүктілігіңіздің {0}-аптасы; бөпеңіздің көлемі шамамен {1}-дей. ', 'common'),
  ('aichat_welcome_bump_4', 'kk', 'Жүктілік кезеңі туралы сұрақтарыңызды қоя аласыз.', 'common'),
  ('aichat_welcome_default_1', 'kk', 'Сәлеметсіз бе', 'common'),
  ('aichat_welcome_default_2', 'kk', 'Мен Anacan.AI. Сізге қалай көмектесе аламын?', 'common'),
  ('aichat_welcome_flow_1', 'kk', 'Сәлеметсіз бе', 'common'),
  ('aichat_welcome_flow_2', 'kk', 'Мен Anacan.AI. Етеккір циклі, белгілер және жалпы денсаулық туралы сұрақтарыңызға кәсіби жауап беруге дайынмын.', 'common'),
  ('aichat_welcome_mommy_1', 'kk', 'Сәлеметсіз бе', 'common'),
  ('aichat_welcome_mommy_2', 'kk', 'Мен Anacan.AI. Бөпеге күтім жасау, емізу, ұйқы режимі және босанғаннан кейін қалпына келу мәселелерінде Сізді қолдауға дайынмын.', 'common'),
  ('appearancescreen_fon', 'kk', 'Фон', 'common'),
  ('appearancescreen_seth', 'kk', 'Бет', 'common'),
  ('appearancescreen_vurgu', 'kk', 'Акцент', 'common'),
  ('calendarscreen_evvelki_ay', 'kk', 'Алдыңғы ай', 'common'),
  ('calendarscreen_novbeti_ay', 'kk', 'Келесі ай', 'common'),
  ('community_file_upload_failed', 'kk', 'Файл жүктелмеді:', 'common'),
  ('community_is_typing', 'kk', 'жазып жатыр...', 'common'),
  ('community_people_are_typing', 'kk', 'адам жазып жатыр...', 'common'),
  ('directmessagescreen_send', 'kk', 'Жіберу', 'common'),
  ('directmessagescreen_stop', 'kk', 'Тоқтату', 'common'),
  ('flow_days_before', 'kk', '{days} күн бұрын', 'common'),
  ('flow_period_delay_1', 'kk', 'Етеккіріңіз күтілген күннен', 'common'),
  ('flow_period_delay_2', 'kk', 'күнге кешікті. Жүктілік тестін жасап көріңіз немесе Dr.Anacan-нан сұраңыз.', 'common'),
  ('flow_period_delay_prompt_1', 'kk', 'Етеккірім', 'common'),
  ('flow_period_delay_prompt_2', 'kk', 'күнге кешікті, не істеуім керек?', 'common'),
  ('profile_child_added', 'kk', 'қосылды', 'common'),
  ('profile_download_app', 'kk', 'Қолданбаны жүктеп алу:', 'common'),
  ('profile_share_partner_text', 'kk', 'Anacan қолданбасына қосылып, жүктілік сапарымызда маған қолдау көрсетіңіз! Серіктес кодым:', 'common'),
  ('cake_confirm_order', 'kk', 'Тапсырысты растау', 'common'),
  ('cake_pay_and_order', 'kk', 'Төлеу және тапсырыс беру', 'common'),
  ('cake_payment', 'kk', 'төлем', 'common'),
  ('cake_send_order', 'kk', 'Тапсырысты жіберу', 'common'),
  ('cycletrendchart_tsikl_count', 'kk', '{count} цикл', 'common'),
  ('cycletrendchart_uzunluq_f427cd', 'kk', 'Ұзақтығы', 'common'),
  ('dateutils_stress', 'kk', 'Күйзеліс', 'common'),
  ('doctorshospitals_maraq_saheleri', 'kk', 'Қызығушылық салалары', 'common'),
  ('doctorshospitals_xidmetler', 'kk', 'Қызметтер', 'common'),
  ('horoscopecompatibility_neticeniz_d14591', 'kk', 'Сіздің нәтижеңіз', 'common'),
  ('medical_disclaimer_text', 'kk', 'Бұл ақпарат тек ағартушылық мақсатта берілген және медициналық консультацияны, диагностиканы немесе емдеуді АЛМАСТЫРМАЙДЫ. Кез келген медициналық шешім қабылдамас бұрын міндетті түрде өз дәрігеріңізге немесе білікті медицина қызметкеріне жүгініңіз. Шұғыл жағдайларда 103 нөміріне қоңырау шалыңыз.', 'common'),
  ('postsearchfilter_populyar', 'kk', 'Танымал', 'common'),
  ('rc_bundle_version', 'kk', 'Bundle нұсқасы:', 'common'),
  ('toolshub_featured_title', 'kk', 'Таңдаулылар', 'common'),
  ('toolshub_minigames_title', 'kk', 'Шағын ойындар', 'common'),
  ('untranslated_ad_i34vkg', 'kk', 'Аты', 'common'),
  ('untranslated_ad_soyad_by9a9b', 'kk', 'АТЫ-ЖӨНІ', 'common'),
  ('untranslated_ad_soyad_lm5srh', 'kk', 'Аты-жөні *', 'common'),
  ('untranslated_ad_w3td2c', 'kk', 'Аты:', 'common'),
  ('untranslated_anacan_endirimi_eg7euj', 'kk', 'Anacan жеңілдігі', 'common'),
  ('untranslated_anacan_partnyor_endirim_sistem_qfwnst', 'kk', 'Anacan серіктестік жеңілдіктер жүйесі', 'common'),
  ('untranslated_anacan_partnyor_sistemi_xadwvm', 'kk', 'Anacan серіктестік жүйесі', 'common'),
  ('untranslated_analiz_edilir_hf0m1t', 'kk', 'Талдануда...', 'common'),
  ('untranslated_axtar_92w4nn', 'kk', 'Іздеу...', 'common'),
  ('untranslated_ay_m6wwbp', 'kk', 'Ай', 'common'),
  ('untranslated_bank_cclvmv', 'kk', 'Банк:', 'common'),
  ('untranslated_bax_1yplss', 'kk', 'Көру', 'common'),
  ('untranslated_bilinmir_iqd3o8', 'kk', 'Белгісіз', 'common'),
  ('untranslated_cins_f3ymi9', 'kk', 'Жынысы', 'common'),
  ('untranslated_cinsi_az7fty', 'kk', 'Жынысы', 'common'),
  ('untranslated_dil_g90qr5', 'kk', 'Тіл', 'common'),
  ('untranslated_dil_language_7oaxzb', 'kk', 'Тіл / Language', 'common'),
  ('untranslated_dil_rfnolb', 'kk', 'Тіл:', 'common'),
  ('untranslated_elan_voiz8p', 'kk', 'Хабарландыру', 'common'),
  ('untranslated_endirimi_al_qr_yarat_6yd90i', 'kk', 'Жеңілдік алу — QR жасау', 'common'),
  ('untranslated_enerji_q6zcss', 'kk', 'Энергия', 'common'),
  ('untranslated_fiziki_albom_3i3l4j', 'kk', 'Физикалық альбом', 'common'),
  ('untranslated_fokus_qida_lyi3h2', 'kk', 'Негізгі өнім', 'common'),
  ('untranslated_hesablanacaq_w6pf63', 'kk', 'Есептеледі ↗', 'common'),
  ('untranslated_kalori_y6oaf2', 'kk', 'Калориялар', 'common'),
  ('untranslated_kamera_qucuxi', 'kk', 'Камера', 'common'),
  ('untranslated_kart_sahibi_hixmbt', 'kk', 'Карта иесі', 'common'),
  ('untranslated_kart_sahibi_lpyfn9', 'kk', 'Карта иесі:', 'common'),
  ('untranslated_kateqoriya_d7bf4y', 'kk', 'Санат', 'common'),
  ('untranslated_kupon_endirimi_hqg79o', 'kk', 'Купон жеңілдігі:', 'common'),
  ('untranslated_kupon_endirimi_itwejz', 'kk', 'Купон жеңілдігі', 'common'),
  ('untranslated_kupon_kodu_xiawxh', 'kk', 'Купон коды', 'common'),
  ('untranslated_maks_6z8ju8', 'kk', 'Макс', 'common'),
  ('untranslated_menstruasiya_6pect0', 'kk', 'Етеккір', 'common'),
  ('untranslated_mesaj_3c09op', 'kk', 'Хабарлама', 'common'),
  ('untranslated_mesaj_x98xat', 'kk', 'Хабарлама:', 'common'),
  ('untranslated_minimum_6_simvol_nifi5y', 'kk', 'Кемінде 6 таңба', 'common'),
  ('untranslated_onlayn_xfaffi', 'kk', 'Онлайн', 'common'),
  ('untranslated_orta_enerji_ojxdi0', 'kk', 'Орташа энергия', 'common'),
  ('untranslated_orta_yslkg0', 'kk', 'Орташа', 'common'),
  ('untranslated_ortalama_qxgps6', 'kk', 'Орташа', 'common'),
  ('untranslated_ovulyasiya_h9aw8t', 'kk', 'Овуляция', 'common'),
  ('untranslated_oxunub_u7g1tz', 'kk', 'Оқылды', 'common'),
  ('untranslated_partner_profili_lip00f', 'kk', 'Серіктес профилі', 'common'),
  ('untranslated_profil_v8b0sk', 'kk', 'Профиль', 'common'),
  ('untranslated_proqnoz_rt0tdx', 'kk', 'Болжам', 'common'),
  ('untranslated_pulsuz_27d02z', 'kk', 'Тегін', 'common'),
  ('untranslated_qalereyadan_w37f0m', 'kk', 'Галереядан', 'common'),
  ('untranslated_qeyd_edilir_df7cba', 'kk', 'Жазылуда...', 'common'),
  ('untranslated_randevu_xc37do', 'kk', 'Қабылдау', 'common'),
  ('untranslated_resept_axtar_8odzsd', 'kk', 'Рецепт іздеу...', 'common'),
  ('untranslated_sakit_saatlar_myw4sq', 'kk', 'Тыныш уақыт', 'common'),
  ('untranslated_silindi_u8c6ca', 'kk', 'Жойылды!', 'common'),
  ('untranslated_silinir_u86cva', 'kk', 'Жойылуда...', 'common'),
  ('untranslated_simptomlar_xhm7bx', 'kk', 'Симптомдар', 'common'),
  ('untranslated_son_menstruasiya_tarixi_fgz9t7', 'kk', 'Соңғы етеккір күні', 'common'),
  ('untranslated_son_sessiyalar_dkgjsl', 'kk', 'Соңғы сеанстар', 'common'),
  ('untranslated_sonra_1f3m9s', 'kk', 'Кейінірек', 'common'),
  ('untranslated_story_silinsin_yil9td', 'kk', 'Оқиғаны жою керек пе?', 'common'),
  ('untranslated_su_yvcozn', 'kk', 'Су', 'common'),
  ('untranslated_tarix_15qhck', 'kk', 'Күні:', 'common'),
  ('untranslated_tarix_6hhkyx', 'kk', 'Күні', 'common'),
  ('untranslated_taymer_uen6sv', 'kk', 'Таймер', 'common'),
  ('untranslated_telefon_vwjgg5', 'kk', 'Телефон', 'common'),
  ('untranslated_tip_5d1vhb', 'kk', 'Түрі:', 'common'),
  ('untranslated_toplam_lheej5', 'kk', 'Барлығы', 'common'),
  ('untranslated_toplam_xal_dy1dwr', 'kk', 'Жалпы ұпай', 'common'),
  ('untranslated_tortlar_go6yj8', 'kk', 'Торттар 🎂', 'common'),
  ('untranslated_vaxt_8etncj', 'kk', 'Уақыт', 'common'),
  ('untranslated_veb_sayt_16w317', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_vebsayt_7bupzh', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_yadda_saxla_bpdu9v', 'kk', 'Сақтау', 'common'),
  ('usedevicetoken_bildiris_izah', 'kk', 'Маңызды ақпарат пен еске салғыштарды алу үшін құрылғы параметрлерінде қолданбаға хабарландырулар жіберуге рұқсат беріңіз.', 'common'),
  ('usedevicetoken_bildirislere_icaze_verin', 'kk', 'Хабарландыруларға рұқсат беріңіз', 'common'),
  ('usementalhealthdata_normal_e041c7', 'kk', 'Қалыпты', 'common'),
  ('usementalhealthdata_pis_e041c6', 'kk', 'Нашар', 'common'),
  ('weighttracker_indi_eef', 'kk', 'Қазір:', 'common'),
  ('bp_systolic_hint', 'kk', '(жоғарғы)', 'common'),
  ('bp_diastolic_hint', 'kk', '(төменгі)', 'common'),
  ('adminproducts_magaza_mehsullarini_idare_edin_d8f10', 'kk', 'Дүкен өнімдерін басқару', 'common'),
  ('authscreen_bu_e_mail_artiq_qeydiyyatdan_kecib_1bdd66', 'kk', 'Бұл электрондық пошта бұрын тіркелген.', 'common'),
  ('babycrisiswidget_week_unit', 'kk', 'апт.', 'common'),
  ('babymonthlyalbum_legv_et_b5e49c', 'kk', 'Болдырмау', 'common'),
  ('billingscreen_premium_ile_neler_elde_edeceyiniz_gorun_5b1bd7', 'kk', 'Premium арқылы не алатыныңызды көріңіз', 'common'),
  ('billingscreen_premium_ile_nələr_elde_edeceyinizi_gorun_5b1bd7', 'kk', 'Premium арқылы не алатыныңызды көріңіз', 'common'),
  ('cakesscreen_tort_axtarin_f26a97', 'kk', 'Торттарды іздеу...', 'common'),
  ('communityscreen_paylas_b4be3b', 'kk', 'Бөлісу', 'common'),
  ('contractiontimer_5_1_1_qaydasi_ile_izleyin_31947d', 'kk', '5-1-1 ережесімен бақылаңыз', 'common'),
  ('dashboard_ayaqlarini_hereket_etdirmeyi_s_f3dbce', 'kk', 'Аяқтарын қимылдатқанды ұнатады 🦶', 'common'),
  ('dashboard_barmaqlarini_kesf_etmeye_davam_17caad', 'kk', 'Саусақтарын зерттеуді жалғастырады ✋', 'common'),
  ('dashboard_bu_gun_elleri_agzina_apara_bil_a3b801', 'kk', 'Бүгін қолдарын аузына апара алады 🖐️', 'common'),
  ('dashboard_bu_gun_elleri_ile_esyalari_tut_5ce101', 'kk', 'Бүгін заттарды қолымен ұстауды үйренеді! 🤲', 'common'),
  ('dashboard_bu_gun_gulusleri_daha_menali_o_0ca2b5', 'kk', 'Бүгін жымиюы мағыналырақ болады', 'common'),
  ('dashboard_bu_gun_qiciqlanmaya_reaksiya_a_d65dc4', 'kk', 'Бүгін қытыққа реакциясы артады 🤭', 'common'),
  ('dashboard_bu_gun_yeni_dadlar_kesf_ede_bi_6a1832', 'kk', 'Бүгін бөпеңіз жаңа дәмдерді татып көре алады 🍎', 'common'),
  ('dashboard_bu_gun_yeni_sesler_cixara_bile_cf83d8', 'kk', 'Бүгін жаңа дыбыстар шығара алады 🗣️', 'common'),
  ('dashboard_diaper_logged', 'kk', 'Жөргек ауыстырылды', 'common'),
  ('dashboard_diqqet_muddeti_artmaga_davam_e_8ef858', 'kk', 'Зейін қою ұзақтығы арта береді 👀', 'common'),
  ('dashboard_duration_label', 'kk', 'Ұзақтығы', 'common'),
  ('dashboard_elaqe_qurma_bacariqlari_guclen_c24991', 'kk', 'Қарым-қатынас дағдылары нығаяды 🤝', 'common'),
  ('dashboard_emosiyalarini_daha_yaxsi_ifade_a98a2f', 'kk', 'Сезімдерін жақсырақ білдіреді 💕', 'common'),
  ('dashboard_etraf_seslere_daha_cox_reaksiy_c929eb', 'kk', 'Айналадағы дыбыстарға көбірек жауап береді 👂', 'common'),
  ('dashboard_etrafdakilara_diqqet_artir_29f3e2', 'kk', 'Айналасына көбірек назар аударады 👁️', 'common'),
  ('dashboard_etrafi_tanimaq_bacarigi_inkisa_183398', 'kk', 'Айналаны тану қабілеті дамиды 🌍', 'common'),
  ('dashboard_gulumsemeleri_daha_tez_tez_olu_22ffaa', 'kk', 'Жиірек жымиятын болады', 'common'),
  ('dashboard_hereket_koordinasiyasi_inkisaf_56f22b', 'kk', 'Қимыл үйлесімділігі дамиды ⚡', 'common'),
  ('dashboard_hereketleri_daha_koordinasiyal_c4d7d4', 'kk', 'Қимылдары үйлесімді бола түседі 🏃', 'common'),
  ('dashboard_korpenin_yaddasi_her_gun_gucle_3932c3', 'kk', 'Бөпеңіздің есте сақтау қабілеті күн сайын жақсарады', 'common'),
  ('dashboard_mimikalar_daha_zengin_olur_71f33d', 'kk', 'Бет қимылдары түрлене түседі 😮', 'common'),
  ('dashboard_musiqi_dinlemekden_zovq_alir_bbc189', 'kk', 'Музыка тыңдағанды ұнатады 🎶', 'common'),
  ('dashboard_oyun_zamani_daha_aktiv_olur_b55fb7', 'kk', 'Ойын кезінде белсендірек болады 🎮', 'common'),
  ('dashboard_prenatal_vitamininizi_gunluk_qebul_etmey_c8cba3', 'kk', 'Пренаталдық дәруменді күнделікті қабылдауды ұмытпаңыз. Фолат, D дәрумені және темір маңызды!', 'common'),
  ('dashboard_rengleri_daha_aydin_gormeye_ba_4ee0b0', 'kk', 'Түстерді анығырақ көре бастайды 🌈', 'common'),
  ('dashboard_sekillere_baxmagi_xoslayir_824e23', 'kk', 'Суреттерді қарағанды ұнатады 🖼️', 'common'),
  ('dashboard_sesleri_tanimaq_qabiliyyeti_ar_c1f670', 'kk', 'Дауыстарды тану қабілеті артады 🎵', 'common'),
  ('dashboard_toxunma_hissi_daha_hessas_olur_cb038e', 'kk', 'Жанасуды сезіну қабілеті артады 🤚', 'common'),
  ('dashboard_uzlere_baxmagi_cox_xoslayir_628158', 'kk', 'Бөпе беттерге қарағанды ұнатады 👶', 'common'),
  ('dashboard_valideynleri_tanima_guclenir_0de81e', 'kk', 'Ата-анасын жақсырақ тани бастайды 👨‍👩‍👧', 'common'),
  ('dashboard_vitamin_xatirlatmasi_b8a490', 'kk', 'Дәрумен қабылдау туралы еске салу 💊', 'common'),
  ('dashboard_yatma_qaydalari_daha_muntezem__296d25', 'kk', 'Ұйқы тәртібі тұрақтала бастайды 😴', 'common'),
  ('dashboard_yeni_nailiyyetlere_dogru_ireli_500201', 'kk', 'Жаңа жетістіктерге қадам басады 🌟', 'common'),
  ('dashboard_yuxu_zamani_yuxu_gore_biler_4fee2a', 'kk', 'Ұйықтап жатқанда түс көре алады 💭', 'common'),
  ('growthtrackerwidget_head_circumference', 'kk', 'Бас айн.', 'common'),
  ('growthtrackerwidget_last_measurement', 'kk', 'соңғы өлшем', 'common'),
  ('kickcounter_korpe_hereketlerini_izleyin_f7fa7c', 'kk', 'Бөпенің қимылдарын бақылаңыз', 'common'),
  ('maternitycalculator_muavinet_hesablama_ebc288', 'kk', 'Жәрдемақыны есептеу', 'common'),
  ('mommyheroclassic_gun_54e78d', 'kk', 'күн', 'common'),
  ('mommyheromesh_gun_54e78d', 'kk', 'күн', 'common'),
  ('mommyherominimalcard_gun_54e78d', 'kk', 'күн', 'common'),
  ('partneraichatscreen_dogusa_hazirliq_c83258', 'kk', 'Босануға дайындық', 'common'),
  ('partneraichatscreen_emosional_destek_5ffaed', 'kk', 'Эмоциялық қолдау', 'common'),
  ('partneraichatscreen_ev_isleri_b4425e', 'kk', 'Үй шаруасы', 'common'),
  ('partneraichatscreen_hekim_vizitleri_abadf5', 'kk', 'Дәрігерге бару', 'common'),
  ('partneraichatscreen_mesaj_gonderile_bilmedi_yeniden_cehd_et_20d76e', 'kk', 'Хабар жіберілмеді. Қайталап көріңіз.', 'common'),
  ('partneraichatscreen_sualini_yaz_49c69d', 'kk', 'Сұрағыңызды жазыңыз...', 'common'),
  ('partneraichatscreen_surprizler_422463', 'kk', 'Тосынсыйлар', 'common'),
  ('partneraichatscreen_xeta_3cdbb6', 'kk', 'Қате', 'common'),
  ('partnerdashboard_tapsiriq_d827b6', 'kk', 'Тапсырма', 'common'),
  ('paywallstep_3_gun_pulsuz_sinaq_132a91', 'kk', '3 КҮН ТЕГІН СЫНАҚ', 'common'),
  ('recentblogposts_reading_time_unit', 'kk', 'мин', 'common'),
  ('unit_day', 'kk', 'күн', 'common'),
  ('unit_days', 'kk', 'күн', 'common'),
  ('unit_month', 'kk', 'ай', 'common'),
  ('unit_months', 'kk', 'ай', 'common'),
  ('unit_week', 'kk', 'апта', 'common'),
  ('unit_weeks', 'kk', 'апта', 'common'),
  ('unit_year', 'kk', 'жыл', 'common'),
  ('unit_years', 'kk', 'жыл', 'common'),
  ('untranslated_0_40_db_25m0h6', 'kk', '0-40 дБ', 'common'),
  ('untranslated_0_return_wb2fa7', 'kk', '0;

  return (', 'common'),
  ('untranslated_0_row_pregnancy_day_w4zouw', 'kk', '0 && row.pregnancy_day', 'common'),
  ('untranslated_0_stats_shortestcycle_2bgpxe', 'kk', '0 && stats.shortestCycle', 'common'),
  ('untranslated_1_ay_0npsgf', 'kk', '1 ай', 'common'),
  ('untranslated_1_ay_d6yjy4', 'kk', '1 ай', 'common'),
  ('untranslated_1_ay_rcev58', 'kk', '1 ай', 'common'),
  ('untranslated_1_saat_5fulld', 'kk', '1 сағат', 'common'),
  ('untranslated_1_saat_i42oul', 'kk', '1 сағат', 'common'),
  ('untranslated_1_saat_y5dif9', 'kk', '1 сағат', 'common'),
  ('untranslated_20_endirim_jc75q5', 'kk', '20% жеңілдік', 'common'),
  ('untranslated_20_endirim_sw2d3h', 'kk', '20% жеңілдік', 'common'),
  ('untranslated_20_endirim_waxyxe', 'kk', '20% жеңілдік', 'common'),
  ('untranslated_3_ay_3d6dom', 'kk', '3 ай', 'common'),
  ('untranslated_3_ay_sonra_1p81pp', 'kk', '3 айдан кейін 😌', 'common'),
  ('untranslated_3_ay_sonra_9ya929', 'kk', '3 айдан кейін 😌', 'common'),
  ('untranslated_3_ay_sonra_q570y1', 'kk', '3 айдан кейін 😌', 'common'),
  ('untranslated_3_ay_vv3swy', 'kk', '3 ай', 'common'),
  ('untranslated_3_ay_zxp12a', 'kk', '3 ай', 'common'),
  ('untranslated_40_50_db_8gld0f', 'kk', '40-50 дБ', 'common'),
  ('untranslated_50_60_db_ec0bby', 'kk', '50-60 дБ', 'common'),
  ('untranslated_60_70_db_heg84l', 'kk', '60-70 дБ', 'common'),
  ('untranslated_70_db_9217uh', 'kk', '70+ дБ', 'common'),
  ('untranslated__0_api_returntype_0rraw5', 'kk', '[0];
  api: ReturnType', 'common'),
  ('untranslated__10s_tq7n6h', 'kk', '/10 с', 'common'),
  ('untranslated__14_daysuntil_yr82pn', 'kk', '= -14 && daysUntil', 'common'),
  ('untranslated__1_daynum_i3lvzd', 'kk', '= 1 && dayNum', 'common'),
  ('untranslated__30_bal_46039y', 'kk', '/ 30 ұпай', 'common'),
  ('untranslated__30_bal_a3mge4', 'kk', '/ 30 ұпай', 'common'),
  ('untranslated__30_bal_vkl9o6', 'kk', '/ 30 ұпай', 'common'),
  ('untranslated__4_bg_green_100_dark_bg_green_au6t1h', 'kk', '= 4 ?
          ''bg-green-100 dark:bg-green-900/30'' :
          summary.mood && summary.mood', 'common'),
  ('untranslated__994_xx_xxx_xx_xx_bp5p0w', 'kk', '+994 XX XXX XX XX', 'common'),
  ('untranslated__activeschedules_length_0_kq5yxs', 'kk', ':
        activeSchedules.length === 0 ?', 'common'),
  ('untranslated__activeweeks_length_0_5gt67d', 'kk', ':
      activeWeeks.length === 0 ?', 'common'),
  ('untranslated__admin_lh2sjh', 'kk', '👑 Әкімші', 'common'),
  ('untranslated__aktiv_92673e', 'kk', '✓ Белсенді', 'common'),
  ('untranslated__aktiv_ce2lg7', 'kk', '✓ Белсенді', 'common'),
  ('untranslated__aktiv_x97j2y', 'kk', '✓ Белсенді', 'common'),
  ('untranslated__allconversations_length_0_f1wbia', 'kk', ':
      allConversations.length === 0 ?', 'common'),
  ('untranslated__alreadysent_eih96a', 'kk', ':
            alreadySent ?', 'common'),
  ('untranslated__analitika_1d19rj', 'kk', '📊 Талдау', 'common'),
  ('untranslated__analitika_8zj0t7', 'kk', '📊 Талдау', 'common'),
  ('untranslated__analitika_pq0ddr', 'kk', '📊 Талдау', 'common'),
  ('untranslated__anayam_4dl9uj', 'kk', '👶 Мен анамын', 'common'),
  ('untranslated__anayam_intbls', 'kk', '👶 Мен анамын', 'common'),
  ('untranslated__anayam_km5jdl', 'kk', '👶 Мен анамын', 'common'),
  ('untranslated__araba_eiub0o', 'kk', '🚼 Арба', 'common'),
  ('untranslated__araba_osd7dm', 'kk', '🚼 Арба', 'common'),
  ('untranslated__araba_uog0ii', 'kk', '🚼 Арба', 'common'),
  ('untranslated__ay_btgnbx', 'kk', '/ай', 'common'),
  ('untranslated__ay_cugyoj', 'kk', '/ай', 'common'),
  ('untranslated__ay_uq5abf', 'kk', '/ай', 'common'),
  ('untranslated__blockquote_html_html_replace_enbncg', 'kk', ''');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, ''', 'common'),
  ('untranslated__blog_is_now_accessed_via_tool_ztysor', 'kk', ');
      // Blog is now accessed via Tools, remove from nav tabs
      case ''profile'':
        return (', 'common'),
  ('untranslated__bold_italic_html_html_replace_7g7i1b', 'kk', ''');
  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, ''', 'common'),
  ('untranslated__case_1_return_1amcqc', 'kk', ');


      case 1:
        return (', 'common'),
  ('untranslated__case_2_return_0r87lm', 'kk', ');


      case 2:
        return (', 'common'),
  ('untranslated__case_2_return_zhu0xt', 'kk', ');

      case 2:
        return (', 'common'),
  ('untranslated__case_3_return_s6ekfb', 'kk', ');

      case 3:
        return (', 'common'),
  ('untranslated__case_affiliate_case_affiliate_5y3m98', 'kk', ';
      case ''affiliate'':case ''affiliate-products'':return', 'common'),
  ('untranslated__case_affiliate_return_applhz', 'kk', ';
      case ''affiliate'':
        return', 'common'),
  ('untranslated__case_ai_return_r0oqms', 'kk', ');
      case ''ai'':
        return (', 'common'),
  ('untranslated__case_ai_return_y0jabd', 'kk', ');
        case ''ai'':
          return (', 'common'),
  ('untranslated__case_album_orders_return_n4ghkr', 'kk', ';
      case ''album-orders'':
        return', 'common'),
  ('untranslated__case_analytics_return_qedz28', 'kk', ';
      case ''analytics'':
        return', 'common'),
  ('untranslated__case_analyzing_return_915sg2', 'kk', ');

      case ''analyzing'':
        return (', 'common'),
  ('untranslated__case_baby_album_return_8iubqk', 'kk', ';
      case ''baby-album'':return', 'common'),
  ('untranslated__case_baby_daily_info_return_6gi3h1', 'kk', ';
      case ''baby-daily-info'':
        return', 'common'),
  ('untranslated__case_baby_growth_case_growth_x0hcfz', 'kk', ';
      case ''baby-growth'':case ''growth-tracker'':return', 'common'),
  ('untranslated__case_baby_growth_return_htzmiu', 'kk', ';
      case ''baby-growth'':
        return', 'common'),
  ('untranslated__case_baby_illustrations_retur_h7zusg', 'kk', ';
      case ''baby-illustrations'':
        return', 'common'),
  ('untranslated__case_banners_return_ol67ei', 'kk', ';
      case ''banners'':
        return', 'common'),
  ('untranslated__case_bento_return_not4ft', 'kk', ';
    case ''bento'':     return', 'common'),
  ('untranslated__case_blog_return_7o6475', 'kk', ';
      case ''blog'':
        return', 'common'),
  ('untranslated__case_blog_return_ra6tdb', 'kk', ';
      case ''blog'':return', 'common'),
  ('untranslated__case_blood_sugar_return_nwybon', 'kk', ';
      case ''blood-sugar'':return', 'common'),
  ('untranslated__case_branding_return_jarpao', 'kk', ';
      case ''branding'':
        return', 'common'),
  ('untranslated__case_c2c_transfer_return_o957qo', 'kk', ';
      case ''c2c_transfer'':return', 'common'),
  ('untranslated__case_cakes_return_8aphd4', 'kk', ');
      case ''cakes'':
        return (', 'common'),
  ('untranslated__case_cakes_return_aqybr2', 'kk', ';
      case ''cakes'':
        return', 'common'),
  ('untranslated__case_cakes_return_dc46je', 'kk', ';
      case ''cakes'':return', 'common'),
  ('untranslated__case_card_simulated_return_y7g3xk', 'kk', ';
      case ''card_simulated'':return', 'common'),
  ('untranslated__case_categories_return_hf1i0o', 'kk', ');


      case ''categories'':
        return (', 'common'),
  ('untranslated__case_chat_return_d5cadb', 'kk', ');
        case ''chat'':
          return (', 'common'),
  ('untranslated__case_closed_return_grvf6f', 'kk', ';
      case ''closed'':return', 'common'),
  ('untranslated__case_community_return_pmqlj7', 'kk', ');
      case ''community'':
        return (', 'common'),
  ('untranslated__case_community_return_zopkoz', 'kk', ';
      case ''community'':
        return', 'common'),
  ('untranslated__case_content_return_9mgzwo', 'kk', ';
      case ''content'':
        return', 'common'),
  ('untranslated__case_contraction_return_6za51e', 'kk', ';
      case ''contraction'':return', 'common'),
  ('untranslated__case_coupons_return_d17rcv', 'kk', ';
      case ''coupons'':
        return', 'common'),
  ('untranslated__case_crash_reports_return_ucqstp', 'kk', ';
      case ''crash-reports'':
        return', 'common'),
  ('untranslated__case_crisis_calendar_return_uhkn19', 'kk', ';
      case ''crisis-calendar'':
        return', 'common'),
  ('untranslated__case_cry_translator_return_77u9j0', 'kk', ';
      case ''cry-translator'':return', 'common'),
  ('untranslated__case_data_return_aztmdw', 'kk', ';
      case ''data'':
        return', 'common'),
  ('untranslated__case_deeplinks_return_7ze6l0', 'kk', ';
      case ''deeplinks'':
        return', 'common'),
  ('untranslated__case_default_shopping_return_fsfbes', 'kk', ';
      case ''default-shopping'':
        return', 'common'),
  ('untranslated__case_description_case_content_jo8mz8', 'kk', ');

      case ''description'':
      case ''content'':
      case ''description_az'':
        return (', 'common'),
  ('untranslated__case_development_tips_return_cxwgu5', 'kk', ';
      case ''development-tips'':
        return', 'common'),
  ('untranslated__case_doctors_return_m88c7g', 'kk', ';
      case ''doctors'':return', 'common'),
  ('untranslated__case_dynamic_content_return_e4g5mf', 'kk', ';
      case ''dynamic-content'':
        return', 'common'),
  ('untranslated__case_epoint_return_4ftsth', 'kk', ';
      case ''epoint'':
        return', 'common'),
  ('untranslated__case_exercise_case_exercises_8nouyt', 'kk', ';
      case ''exercise'':case ''exercises'':return', 'common'),
  ('untranslated__case_fairy_tale_return_r3huja', 'kk', ';
      case ''fairy-tale'':return', 'common'),
  ('untranslated__case_fairy_tales_return_optauv', 'kk', ';
      case ''fairy-tales'':
        return', 'common'),
  ('untranslated__case_faq_return_47ua1k', 'kk', ';
      case ''faq'':
        return', 'common'),
  ('untranslated__case_first_aid_return_1t0os7', 'kk', ';
      case ''first-aid'':
        return', 'common'),
  ('untranslated__case_first_aid_return_qiyqz2', 'kk', ';
      case ''first-aid'':return', 'common'),
  ('untranslated__case_flow_content_return_4mt5gp', 'kk', ';
      case ''flow-content'':
        return', 'common'),
  ('untranslated__case_flow_symptoms_return_8yekcs', 'kk', ';
      case ''flow-symptoms'':
        return', 'common'),
  ('untranslated__case_foods_return_odg6ta', 'kk', ');


      case ''foods'':
        return (', 'common'),
  ('untranslated__case_force_update_return_biv30c', 'kk', ';
      case ''force-update'':
        return', 'common'),
  ('untranslated__case_fruit_images_return_2npogm', 'kk', ';
      case ''fruit-images'':
        return', 'common'),
  ('untranslated__case_healthcare_reviews_retur_grk5js', 'kk', ';
      case ''healthcare-reviews'':
        return', 'common'),
  ('untranslated__case_horoscope_return_qvg51j', 'kk', ';
      case ''horoscope'':return', 'common'),
  ('untranslated__case_hospital_return_du7nt3', 'kk', ';
      case ''hospital'':return', 'common'),
  ('untranslated__case_in_progress_return_2jxgrl', 'kk', ';
      case ''in_progress'':return', 'common'),
  ('untranslated__case_intro_slides_return_jx9pp2', 'kk', ';
      case ''intro-slides'':
        return', 'common'),
  ('untranslated__case_kick_return_05n9tq', 'kk', ';
      case ''kick'':return', 'common'),
  ('untranslated__case_languages_return_11cngr', 'kk', ';
      case ''languages'':
        return', 'common'),
  ('untranslated__case_legal_return_xe6j7w', 'kk', ';
      case ''legal'':
        return', 'common'),
  ('untranslated__case_marketplace_return_cccpx0', 'kk', ';
      case ''marketplace'':
        return', 'common'),
  ('untranslated__case_maternity_calculator_cas_8xbvwb', 'kk', ';
      case ''maternity-calculator'':case ''maternity'':return', 'common'),
  ('untranslated__case_maternity_return_rqfgrk', 'kk', ';
      case ''maternity'':
        return', 'common'),
  ('untranslated__case_mental_health_return_d525h9', 'kk', ';
      case ''mental-health'':return', 'common'),
  ('untranslated__case_mental_health_return_yqlqay', 'kk', ';
      case ''mental-health'':
        return', 'common'),
  ('untranslated__case_mesh_return_tmcr9m', 'kk', ';
    case ''mesh'':      return', 'common'),
  ('untranslated__case_messages_return_jtd61a', 'kk', ';
      case ''messages'':
        return', 'common'),
  ('untranslated__case_milestones_return_54bbzx', 'kk', ');


      case ''milestones'':
        return (', 'common'),
  ('untranslated__case_minimal_return_vt5g8a', 'kk', ';
    case ''minimal'':   return', 'common'),
  ('untranslated__case_moderation_return_p6wtcl', 'kk', ';
      case ''moderation'':
        return', 'common'),
  ('untranslated__case_moderator_return_e8rtjn', 'kk', ';
      case ''moderator'':return', 'common'),
  ('untranslated__case_mom_friendly_map_return_3qqn8h', 'kk', ';
      case ''mom-friendly-map'':return', 'common'),
  ('untranslated__case_mommy_daily_messages_ret_l6a5fx', 'kk', ';
      case ''mommy-daily-messages'':
        return', 'common'),
  ('untranslated__case_mood_case_mood_diary_ret_mc2j2z', 'kk', ';
      case ''mood'':case ''mood-diary'':return', 'common'),
  ('untranslated__case_moods_return_ze1t2f', 'kk', ');


      case ''moods'':
        return (', 'common'),
  ('untranslated__case_names_return_klys7g', 'kk', ';
      case ''names'':return', 'common'),
  ('untranslated__case_noise_meter_return_t7zspp', 'kk', ';
      case ''noise-meter'':return', 'common'),
  ('untranslated__case_notes_return_x6hv3s', 'kk', ');

      case ''notes'':
        return (', 'common'),
  ('untranslated__case_nutrition_return_1gyoek', 'kk', ';
      case ''nutrition'':return', 'common'),
  ('untranslated__case_onboarding_return_n4v671', 'kk', ';
      case ''onboarding'':
        return', 'common'),
  ('untranslated__case_orders_return_yb3uua', 'kk', ';
      case ''orders'':
        return', 'common'),
  ('untranslated__case_partner_config_return_pqses5', 'kk', ';
      case ''partner-config'':
        return', 'common'),
  ('untranslated__case_partner_redemptions_retu_k7ydch', 'kk', ';
      case ''partner-redemptions'':
        return', 'common'),
  ('untranslated__case_partner_tips_return_duwnok', 'kk', ';
      case ''partner-tips'':
        return', 'common'),
  ('untranslated__case_partner_venues_return_10umnb', 'kk', ';
      case ''partner-venues'':
        return', 'common'),
  ('untranslated__case_phase_tips_return_3en7ma', 'kk', ';
      case ''phase-tips'':
        return', 'common'),
  ('untranslated__case_photoshoot_return_89cn2q', 'kk', ';
      case ''photoshoot'':
        return', 'common'),
  ('untranslated__case_places_config_return_e87nqf', 'kk', ';
      case ''places-config'':
        return', 'common'),
  ('untranslated__case_places_return_esribb', 'kk', ';
      case ''places'':
        return', 'common'),
  ('untranslated__case_play_activities_return_5dkex1', 'kk', ';
      case ''play-activities'':
        return', 'common'),
  ('untranslated__case_polaroid_return_jl3vuh', 'kk', ';
    case ''polaroid'':  return', 'common'),
  ('untranslated__case_poop_scanner_return_z0r5vg', 'kk', ';
      case ''poop-scanner'':return', 'common'),
  ('untranslated__case_pregnancy_album_return_i4ki0q', 'kk', ';
      case ''pregnancy-album'':return', 'common'),
  ('untranslated__case_pregnancy_return_kdwh74', 'kk', ';
      case ''pregnancy'':
        return', 'common'),
  ('untranslated__case_premium_config_return_4eltt3', 'kk', ';
      case ''premium-config'':
        return', 'common'),
  ('untranslated__case_premium_plus_return_rpc2cv', 'kk', ';
      case ''premium_plus'':return', 'common'),
  ('untranslated__case_priority_return_zvezxd', 'kk', ');

      case ''priority'':
        return (', 'common'),
  ('untranslated__case_products_return_ygm3of', 'kk', ';
      case ''products'':
        return', 'common'),
  ('untranslated__case_profile_return_6t55us', 'kk', ');
        case ''profile'':
          return (', 'common'),
  ('untranslated__case_push_notifications_retur_ufk4k1', 'kk', ';
      case ''push-notifications'':
        return', 'common'),
  ('untranslated__case_quick_actions_return_euqpoe', 'kk', ';
      case ''quick-actions'':
        return', 'common'),
  ('untranslated__case_recipes_return_15f443', 'kk', ';
      case ''recipes'':
        return', 'common'),
  ('untranslated__case_recipes_return_70hkcq', 'kk', ';
      case ''recipes'':return', 'common'),
  ('untranslated__case_recording_return_g3dw4d', 'kk', ');

      case ''recording'':
        return', 'common'),
  ('untranslated__case_resolved_return_0a5qu8', 'kk', ';
      case ''resolved'':return', 'common'),
  ('untranslated__case_revenuecat_debug_return_dd5lyq', 'kk', ';
      case ''revenuecat-debug'':
        return', 'common'),
  ('untranslated__case_safety_return_lno7mz', 'kk', ';
      case ''safety'':return', 'common'),
  ('untranslated__case_secondhand_market_case_s_qojil6', 'kk', ';
      case ''secondhand-market'':case ''second-hand-market'':return', 'common'),
  ('untranslated__case_security_return_01cyuk', 'kk', ';
      case ''security'':
        return', 'common'),
  ('untranslated__case_settings_return_oa5g23', 'kk', ';
      case ''settings'':
        return', 'common'),
  ('untranslated__case_shopping_return_a2h1u1', 'kk', ';
      case ''shopping'':return', 'common'),
  ('untranslated__case_smart_play_box_return_qvyqpy', 'kk', ';
      case ''smart-play-box'':return', 'common'),
  ('untranslated__case_sounds_return_23yizy', 'kk', ');


      case ''sounds'':
        return (', 'common'),
  ('untranslated__case_story_return_5ooh07', 'kk', ';
    case ''story'':     return', 'common'),
  ('untranslated__case_storybook_return_t5rq1y', 'kk', ';
    case ''storybook'': return', 'common'),
  ('untranslated__case_subscriptions_return_zgz364', 'kk', ';
      case ''subscriptions'':
        return', 'common'),
  ('untranslated__case_support_return_ipio0e', 'kk', ';
      case ''support'':
        return', 'common'),
  ('untranslated__case_surprises_return_iv0870', 'kk', ');


      case ''surprises'':
        return (', 'common'),
  ('untranslated__case_symptoms_return_kr87tz', 'kk', ');


      case ''symptoms'':
        return (', 'common'),
  ('untranslated__case_teething_case_teething_t_1smhvu', 'kk', ';
      case ''teething'':case ''teething-tracker'':return', 'common'),
  ('untranslated__case_teething_return_o26nes', 'kk', ';
      case ''teething'':
        return', 'common'),
  ('untranslated__case_themes_return_zz49xz', 'kk', ');


      case ''themes'':
        return (', 'common'),
  ('untranslated__case_tools_config_return_ioas35', 'kk', ';
      case ''tools-config'':
        return', 'common'),
  ('untranslated__case_tools_return_nit4oo', 'kk', ');
      case ''tools'':
        return (', 'common'),
  ('untranslated__case_tools_return_x86n6v', 'kk', ';
      case ''tools'':
        return', 'common'),
  ('untranslated__case_translations_return_aibi27', 'kk', ';
      case ''translations'':
        return', 'common'),
  ('untranslated__case_trimester_tips_return_7d39bp', 'kk', ';
      case ''trimester-tips'':
        return', 'common'),
  ('untranslated__case_users_return_4zghpw', 'kk', ';
      case ''users'':
        return', 'common'),
  ('untranslated__case_vaccine_calendar_case_va_8koyu6', 'kk', ';
      case ''vaccine-calendar'':case ''vaccines-calendar'':return', 'common'),
  ('untranslated__case_vaccines_return_x1dmtp', 'kk', ';
      case ''vaccines'':
        return', 'common'),
  ('untranslated__case_vitamin_tracker_case_vit_tds5ys', 'kk', ';
      case ''vitamin-tracker'':case ''vitamins'':return', 'common'),
  ('untranslated__case_vitamins_return_hltdgs', 'kk', ';
      case ''vitamins'':
        return', 'common'),
  ('untranslated__case_weather_clothing_return_v4nz4k', 'kk', ';
      case ''weather-clothing'':return', 'common'),
  ('untranslated__case_weight_return_xpfma9', 'kk', ';
      case ''weight'':return', 'common'),
  ('untranslated__case_whitenoise_case_white_no_7xggua', 'kk', ';
      case ''whitenoise'':case ''white-noise'':return', 'common'),
  ('untranslated__categorytools_length_0_y6dd0u', 'kk', ':
              categoryTools.length === 0 ?', 'common'),
  ('untranslated__coupons_length_0_xknlci', 'kk', ':
      coupons.length === 0 ?', 'common'),
  ('untranslated__default_return_fkhswh', 'kk', ');

      default:
        return (', 'common'),
  ('untranslated__default_return_ftt02w', 'kk', ';
      default:return', 'common'),
  ('untranslated__default_return_twulxs', 'kk', ';
      default:
        return', 'common'),
  ('untranslated__default_return_yq5gob', 'kk', ';
    default:          return', 'common'),
  ('untranslated__default_return_z0vp0u', 'kk', ';
      default:
        return', 'common'),
  ('untranslated__devices_length_0_oh0ti8', 'kk', ':
        devices.length === 0 ?', 'common'),
  ('untranslated__editingid_item_id_ptdipw', 'kk', ') : editingId === item.id ? (', 'common'),
  ('untranslated__editingid_log_id_y7ex6p', 'kk', ') : editingId === log.id ? (', 'common'),
  ('untranslated__entries_length_0_wmn0dp', 'kk', ':
          entries.length === 0 ?', 'common'),
  ('untranslated__export_type_tables_b8t3vh', 'kk', ']

export type Tables', 'common'),
  ('untranslated__f28155_no3za9', 'kk', '#f28155', 'common'),
  ('untranslated__fieldpath_wfawxg', 'kk', '= FieldPath', 'common'),
  ('untranslated__filtered_length_0_yqncit', 'kk', ':
      filtered.length === 0 ?', 'common'),
  ('untranslated__filteredactivities_length_0_rhvbbm', 'kk', ':
          filteredActivities.length === 0 ?', 'common'),
  ('untranslated__filteredentries_length_0_5v9eaw', 'kk', ':
          filteredEntries.length === 0 ?', 'common'),
  ('untranslated__filteredfaqs_length_0_k7k9le', 'kk', ':
          filteredFaqs.length === 0 ?', 'common'),
  ('untranslated__filteredlistings_length_0_09ifos', 'kk', ':
          filteredListings.length === 0 ?', 'common'),
  ('untranslated__filteredlistings_length_0_76ono8', 'kk', ':
        filteredListings.length === 0 ?', 'common'),
  ('untranslated__filteredmessages_length_0_70nkhs', 'kk', ':
        filteredMessages.length === 0 ?', 'common'),
  ('untranslated__filterednotifications_length_uj1tc8', 'kk', ':
        filteredNotifications.length === 0 ?', 'common'),
  ('untranslated__filteredplaces_length_0_c8psf5', 'kk', ':
        filteredPlaces.length === 0 ?', 'common'),
  ('untranslated__filteredposts_length_0_psd4sw', 'kk', ':
        filteredPosts.length === 0 ?', 'common'),
  ('untranslated__filteredproducts_length_0_94n581', 'kk', ') :
        filteredProducts.length === 0 ?', 'common'),
  ('untranslated__filteredproducts_length_0_dr0tpj', 'kk', ':
        filteredProducts.length === 0 ?', 'common'),
  ('untranslated__filteredproviders_length_0_rv4vdm', 'kk', ') :
        filteredProviders.length === 0 ?', 'common'),
  ('untranslated__filteredrecipes_length_0_13dohc', 'kk', ':
          filteredRecipes.length === 0 ?', 'common'),
  ('untranslated__filteredreviews_length_0_z3x34a', 'kk', ':
      filteredReviews.length === 0 ?', 'common'),
  ('untranslated__filteredtips_length_0_i352y3', 'kk', ':
          filteredTips.length === 0 ?', 'common'),
  ('untranslated__filteredusers_length_0_gz3j63', 'kk', ':
              filteredUsers.length === 0 ?', 'common'),
  ('untranslated__hideindicator_sz1hqb', 'kk', ') : (
                      !hideIndicator && (', 'common'),
  ('untranslated__horizontal_rule_html_html_rep_ee2dn6', 'kk', ''');
  // Horizontal rule
  html = html.replace(/^---$/gm, ''', 'common'),
  ('untranslated__html_html_replace_40e08m', 'kk', ''');
  html = html.replace(/(', 'common'),
  ('untranslated__html_html_replace_g_cs3yqm', 'kk', ''');
  html = html.replace(/\*(.+?)\*/g, ''', 'common'),
  ('untranslated__html_html_replace_g_iok03x', 'kk', ''');
  html = html.replace(/\*\*(.+?)\*\*/g, ''', 'common'),
  ('untranslated__html_html_replace_gm_dx4h1h', 'kk', ''');
  html = html.replace(/^## (.+)$/gm, ''', 'common'),
  ('untranslated__html_html_replace_gm_n2c7qf', 'kk', ''');
  html = html.replace(/^# (.+)$/gm, ''', 'common'),
  ('untranslated__i_test_c_return_ishtml_owafft', 'kk', '/i.test(c);
                return isHtml ?', 'common'),
  ('untranslated__i_test_content_sanitize_html_yhot3w', 'kk', '/i.test(content);

  // Sanitize HTML to prevent XSS attacks. Strips', 'common'),
  ('untranslated__i_test_post_content_x44xf5', 'kk', '/i.test(post.content) ?', 'common'),
  ('untranslated__icon_0z303e', 'kk', ':
  Icon ?', 'common'),
  ('untranslated__if_activescreen_appearance_re_1ilv5g', 'kk', ';
  if (activeScreen === ''appearance'') return', 'common'),
  ('untranslated__if_activescreen_billing_retur_8t3jz8', 'kk', ';
  if (activeScreen === ''billing'') return', 'common'),
  ('untranslated__if_activescreen_calendar_retu_wvadr6', 'kk', ';
  if (activeScreen === ''calendar'') return', 'common'),
  ('untranslated__if_activescreen_daily_summary_osh975', 'kk', ';
  if (activeScreen === ''daily-summary'' && role === ''partner'') return', 'common'),
  ('untranslated__if_activescreen_edit_profile_do5m0i', 'kk', ';
  if (activeScreen === ''edit-profile'') return', 'common'),
  ('untranslated__if_activescreen_help_return_kv9kkh', 'kk', ';
  if (activeScreen === ''help'') return', 'common'),
  ('untranslated__if_activescreen_name_voting_r_q04ko8', 'kk', ';
  if (activeScreen === ''name-voting'' && role === ''partner'') return', 'common'),
  ('untranslated__if_activescreen_partner_hospi_5gqhwe', 'kk', ';
  if (activeScreen === ''partner-hospital-bag'' && role === ''partner'') return', 'common'),
  ('untranslated__if_activescreen_partner_priva_ds143v', 'kk', ';
  if (activeScreen === ''partner-privacy'') return', 'common'),
  ('untranslated__if_activescreen_partners_retu_drupzv', 'kk', ';
  if (activeScreen === ''partners'') return', 'common'),
  ('untranslated__if_activescreen_privacy_retur_sp0efc', 'kk', ';
  if (activeScreen === ''privacy'') return', 'common'),
  ('untranslated__if_activescreen_settings_retu_m2dbvo', 'kk', ';
  if (activeScreen === ''settings'') return', 'common'),
  ('untranslated__if_https_s_test_word_return_0fj0bn', 'kk', ';
                if (/^https?:\/\/\S+/.test(word)) return', 'common'),
  ('untranslated__if_p_ios_return_wpdrpm', 'kk', ';
    if (p === ''ios'') return', 'common'),
  ('untranslated__if_word_startswith_return_6dhbmn', 'kk', ';
                if (word.startsWith(''@'')) return', 'common'),
  ('untranslated__inline_code_html_html_replace_fagvdb', 'kk', ''');
  // Inline code
  html = html.replace(/`([^`]+)`/g, ''', 'common'),
  ('untranslated__isanonymous_isadmin_wm1872', 'kk', ':
                isAnonymous && isAdmin ?', 'common'),
  ('untranslated__ispast_15m1ja', 'kk', ':
                  isPast ?', 'common'),
  ('untranslated__isrecording_lu6vht', 'kk', ':
        isRecording ?', 'common'),
  ('untranslated__items_length_0_wgxvux', 'kk', ':
          items.length === 0 ?', 'common'),
  ('untranslated__length_0_s80p87', 'kk', ').length > 0 &&', 'common'),
  ('untranslated__links_html_html_replace_g_ngibx8', 'kk', ''');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, ''', 'common'),
  ('untranslated__logs_length_0_uk8ooo', 'kk', ':
        logs.length === 0 ?', 'common'),
  ('untranslated__messages_length_0_r6uzt3', 'kk', ':
        messages.length === 0 ?', 'common'),
  ('untranslated__multiples_data_length_0_0_bkzwgt', 'kk', ':
              (multiples.data?.length || 0) === 0 ?', 'common'),
  ('untranslated__nbsp_v6regl', 'kk', '&nbsp;', 'common'),
  ('untranslated__no_active_crisis_show_calenda_mbjqtz', 'kk', ') : (
          // No Active Crisis - Show Calendar Preview', 'common'),
  ('untranslated__ordered_list_items_html_html_ne5o8h', 'kk', '`);
  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, ''', 'common'),
  ('untranslated__paymentmethod_c2c_transfer_452ysb', 'kk', ':
              paymentMethod === ''c2c_transfer'' ?', 'common'),
  ('untranslated__period_3m2qwl', 'kk', '• Етеккір:', 'common'),
  ('untranslated__photos_length_0_lyt629', 'kk', ':
    photos.length === 0 ?', 'common')
ON CONFLICT (key, lang) DO NOTHING;

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('untranslated__pick_8tbv7i', 'kk', '&
    Pick', 'common'),
  ('untranslated__places_length_0_r2vfah', 'kk', ':
          places.length === 0 ?', 'common'),
  ('untranslated__premium_eansvj', 'kk', '★ Premium', 'common'),
  ('untranslated__primarytimer_ultq8d', 'kk', ':
        primaryTimer ?', 'common'),
  ('untranslated__products_length_0_n2z8h9', 'kk', ':
        products.length === 0 ?', 'common'),
  ('untranslated__react_componentprops_8ee40t', 'kk', '&
    React.ComponentProps', 'common'),
  ('untranslated__react_componentprops_iiv38o', 'kk', ', React.ComponentProps', 'common'),
  ('untranslated__react_componentprops_xvln7l', 'kk', '&
  React.ComponentProps', 'common'),
  ('untranslated__react_componentpropswithoutre_et2nhu', 'kk', ', React.ComponentPropsWithoutRef', 'common'),
  ('untranslated__react_componentpropswithoutre_mhhf9c', 'kk', ',
  React.ComponentPropsWithoutRef', 'common'),
  ('untranslated__reports_length_0_to7ix3', 'kk', ':
      reports.length === 0 ?', 'common'),
  ('untranslated__return_08i8e4', 'kk', ';

  return (', 'common'),
  ('untranslated__return_akt3mr', 'kk', ';
    return', 'common'),
  ('untranslated__return_qydbmn', 'kk', ';


  return (', 'common'),
  ('untranslated__return_upinlr', 'kk', ');

  return (', 'common'),
  ('untranslated__reviews_length_0_d57lz2', 'kk', ':
      reviews.length === 0 ?', 'common'),
  ('untranslated__reviews_length_0_qqwf9e', 'kk', ':
          reviews.length === 0 ?', 'common'),
  ('untranslated__roles_length_0_7l2cjf', 'kk', ':
              roles.length === 0 ?', 'common'),
  ('untranslated__rrggbb_01xfop', 'kk', '#RRGGBB', 'common'),
  ('untranslated__s_pending_jglero', 'kk', ': s === ''pending'' ?', 'common'),
  ('untranslated__s_start_date_monthday_048nh2', 'kk', '= s.start_date && monthDay', 'common'),
  ('untranslated__savedproducts_length_0_f2occb', 'kk', ':
        savedProducts.length === 0 ?', 'common'),
  ('untranslated__searchquery_loading_ng5tu9', 'kk', ':
      searchQuery && !loading ?', 'common'),
  ('untranslated__son_menstruasiya_tarixi_81qvhu', 'kk', '📅 Соңғы етеккір күні:', 'common'),
  ('untranslated__son_menstruasiya_tarixi_aa10s0', 'kk', '📅 Соңғы етеккір күні:', 'common'),
  ('untranslated__son_menstruasiya_tarixi_f1m9i8', 'kk', '📅 Соңғы етеккір күні:', 'common'),
  ('untranslated__stages_data_length_0_0_nbsbk8', 'kk', ':
              (stages.data?.length || 0) === 0 ?', 'common'),
  ('untranslated__suggestion_type_user_0alt2s', 'kk', ':
                    suggestion.type === ''user'' ?', 'common'),
  ('untranslated__suggestion_type_user_5fegop', 'kk', ':
                suggestion.type === ''user'' ?', 'common'),
  ('untranslated__tales_length_0_728r6z', 'kk', ':
            tales.length === 0 ?', 'common'),
  ('untranslated__test_sandbox_w0wosk', 'kk', '🟡 Тест (сынақ ортасы)', 'common'),
  ('untranslated__tickets_length_0_8kdh9j', 'kk', ':
              tickets.length === 0 ?', 'common'),
  ('untranslated__toastdescription_displayname_oqgmio', 'kk', '));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef', 'common'),
  ('untranslated__toplevelcomments_length_0_yuznsp', 'kk', ':
              topLevelComments.length === 0 ?', 'common'),
  ('untranslated__tortlar_29zq6o', 'kk', '🎂 Торттар', 'common'),
  ('untranslated__tortlar_6dzft0', 'kk', '🎂 Торттар', 'common'),
  ('untranslated__tortlar_pvbveq', 'kk', '🎂 Торттар', 'common'),
  ('untranslated__transactions_length_uhicec', 'kk', ':
                !transactions?.length ?', 'common'),
  ('untranslated__type_toastactionelement_react_8goelm', 'kk', ';

type ToastActionElement = React.ReactElement', 'common'),
  ('untranslated__typingusers_array_73gz1x', 'kk', ';
  typingUsers: Array', 'common'),
  ('untranslated__unordered_list_items_html_htm_lzmw3c', 'kk', ''');
  // Unordered list items
  html = html.replace(/^- (.+)$/gm, ''', 'common'),
  ('untranslated__updateprofile_updates_partial_rpcpbr', 'kk', ';
  updateProfile: (updates: Partial', 'common'),
  ('untranslated__usercontext_pregnancyweek_6rgx1r', 'kk', ':
              userContext.pregnancyWeek ?', 'common'),
  ('untranslated__variantprops_3blzdn', 'kk', ', VariantProps', 'common'),
  ('untranslated__variantprops_8hsxll', 'kk', '& VariantProps', 'common'),
  ('untranslated__variantprops_kxyts8', 'kk', ',
    VariantProps', 'common'),
  ('untranslated__viewers_length_0_0ht5iz', 'kk', ':
              viewers.length === 0 ?', 'common'),
  ('untranslated__wizard_mode_pwe9v1', 'kk', ') : (

          /* Wizard Mode */', 'common'),
  ('untranslated__wrap_remaining_plain_lines_in_lmdx1z', 'kk', ''');
  // Қалған қарапайым жолдарды орау', 'common'),
  ('untranslated_a4_4nc09y', 'kk', 'A4', 'common'),
  ('untranslated_ad_09m4xx', 'kk', 'Аты:', 'common'),
  ('untranslated_ad_2s89zx', 'kk', 'Аты', 'common'),
  ('untranslated_ad_5uq04n', 'kk', 'Аты', 'common'),
  ('untranslated_ad_a11dsy', 'kk', 'Аты *', 'common'),
  ('untranslated_ad_az_d8loyh', 'kk', 'Аты (AZ) *', 'common'),
  ('untranslated_ad_az_fgbcnn', 'kk', 'Аты (AZ)', 'common'),
  ('untranslated_ad_az_h9sto3', 'kk', 'Аты (AZ)', 'common'),
  ('untranslated_ad_az_nep64h', 'kk', 'Аты (AZ)', 'common'),
  ('untranslated_ad_az_sobfzr', 'kk', 'Аты (AZ) *', 'common'),
  ('untranslated_ad_az_ydch6e', 'kk', 'Аты (AZ) *', 'common'),
  ('untranslated_ad_en_0yjdeb', 'kk', 'Аты (EN)', 'common'),
  ('untranslated_ad_en_4b2hma', 'kk', 'Аты (EN)', 'common'),
  ('untranslated_ad_en_r74lzc', 'kk', 'Аты (EN)', 'common'),
  ('untranslated_ad_english_7zt66p', 'kk', 'Аты (ағылшынша)', 'common'),
  ('untranslated_ad_english_cmcfjy', 'kk', 'Аты (ағылшынша)', 'common'),
  ('untranslated_ad_english_zi1003', 'kk', 'Аты (ағылшынша)', 'common'),
  ('untranslated_ad_oxe0q9', 'kk', 'Аты:', 'common'),
  ('untranslated_ad_soyad_638xc2', 'kk', 'АТЫ-ЖӨНІ', 'common'),
  ('untranslated_ad_soyad_do8x1a', 'kk', 'Аты-жөні', 'common'),
  ('untranslated_ad_soyad_jh30dl', 'kk', 'Аты-жөні *', 'common'),
  ('untranslated_ad_soyad_rksoov', 'kk', 'Аты-жөні *', 'common'),
  ('untranslated_ad_soyad_vcdrmy', 'kk', 'АТЫ-ЖӨНІ', 'common'),
  ('untranslated_ad_soyad_ykum0n', 'kk', 'Аты-жөні', 'common'),
  ('untranslated_ad_soyad_ze39r4', 'kk', 'Аты-жөні', 'common'),
  ('untranslated_ad_xcvxv4', 'kk', 'Аты *', 'common'),
  ('untranslated_ad_y8vmys', 'kk', 'Аты *', 'common'),
  ('untranslated_adlar_5re5mi', 'kk', 'Аттар', 'common'),
  ('untranslated_adlar_9uorkw', 'kk', 'Аттар', 'common'),
  ('untranslated_adlar_igyans', 'kk', 'Аттар', 'common'),
  ('untranslated_admin_panel_xmcwf1', 'kk', 'Әкімші панелі', 'common'),
  ('untranslated_admin_qeydi_engw83', 'kk', 'Әкімші ескертпесі:', 'common'),
  ('untranslated_admin_qeydi_tmtufr', 'kk', 'Әкімші ескертпесі:', 'common'),
  ('untranslated_admin_zy7av9', 'kk', 'Әкімші', 'common'),
  ('untranslated_affiliate_url_ww5q99', 'kk', 'Серіктестік URL мекенжайы *', 'common'),
  ('untranslated_ai_analizi_4adcj5', 'kk', 'ЖИ талдауы', 'common'),
  ('untranslated_ai_model_9gzmcc', 'kk', 'ЖИ моделі', 'common'),
  ('untranslated_aksesuar_37hy8f', 'kk', 'Аксессуар', 'common'),
  ('untranslated_aksesuar_ndg24e', 'kk', 'Аксессуар', 'common'),
  ('untranslated_aksesuar_t8jk4y', 'kk', 'Аксессуар', 'common'),
  ('untranslated_aktiv_3mrpaz', 'kk', 'Белсенді', 'common'),
  ('untranslated_aktiv_badge_1h9rbb', 'kk', 'Белсенділік белгісі', 'common'),
  ('untranslated_aktiv_badge_i6xmcj', 'kk', 'Белсенділік белгісі', 'common'),
  ('untranslated_aktiv_badge_k8sek6', 'kk', 'Белсенділік белгісі', 'common'),
  ('untranslated_aktiv_djg05g', 'kk', 'Белсенді:', 'common'),
  ('untranslated_aktiv_f0994f', 'kk', 'Белсенді:', 'common'),
  ('untranslated_aktiv_f3gm2t', 'kk', 'Белсенді', 'common'),
  ('untranslated_aktiv_j558vd', 'kk', 'Белсенді', 'common'),
  ('untranslated_aktiv_qruplar_3jzvji', 'kk', 'Белсенді топтар', 'common'),
  ('untranslated_aktiv_qruplar_6uo6s8', 'kk', 'Белсенді топтар', 'common'),
  ('untranslated_aktiv_qruplar_ic8u4n', 'kk', 'Белсенді топтар', 'common'),
  ('untranslated_aktiv_s6ymud', 'kk', 'Белсенді:', 'common'),
  ('untranslated_aktiv_temalar_8mf1h2', 'kk', 'Белсенді тақырыптар', 'common'),
  ('untranslated_aktiv_temalar_n1ecc8', 'kk', 'Белсенді тақырыптар', 'common'),
  ('untranslated_aktiv_temalar_tfsp2p', 'kk', 'Белсенді тақырыптар', 'common'),
  ('untranslated_aktiv_variant_7xw2s2', 'kk', 'Белсенді нұсқа', 'common'),
  ('untranslated_aktiv_variant_c30ujp', 'kk', 'Белсенді нұсқа', 'common'),
  ('untranslated_aktiv_variant_rhk4vx', 'kk', 'Белсенді нұсқа', 'common'),
  ('untranslated_aliexpress_tzmimg', 'kk', 'AliExpress', 'common'),
  ('untranslated_alma_3zm7n1', 'kk', 'Алма', 'common'),
  ('untranslated_alma_h9isl0', 'kk', 'Алма', 'common'),
  ('untranslated_alma_p3ov62', 'kk', 'Алма', 'common'),
  ('untranslated_amazon_gu18f2', 'kk', 'Amazon', 'common'),
  ('untranslated_ana_6qbruq', 'kk', 'Ана', 'common'),
  ('untranslated_ana_analizi_ap836n', 'kk', 'Ана талдауы', 'common'),
  ('untranslated_ana_analizi_uk39ap', 'kk', 'Ана талдауы', 'common'),
  ('untranslated_ana_analizi_uvj1ik', 'kk', 'Ана талдауы', 'common'),
  ('untranslated_ana_bloqu_f7kx74', 'kk', 'Ана блогы', 'common'),
  ('untranslated_ana_bloqu_hs0n0f', 'kk', 'Ана блогы', 'common'),
  ('untranslated_ana_bloqu_shtrkq', 'kk', 'Ана блогы', 'common'),
  ('untranslated_ana_e2by5a', 'kk', 'Ана', 'common'),
  ('untranslated_ana_tubxbv', 'kk', 'Ана', 'common'),
  ('untranslated_anacan20_kodunu_daxil_edin_5vsik7', 'kk', 'ANACAN20 кодын енгізіңіз', 'common'),
  ('untranslated_anacan20_kodunu_daxil_edin_gx4eqb', 'kk', 'ANACAN20 кодын енгізіңіз', 'common'),
  ('untranslated_anacan20_kodunu_daxil_edin_j0hy0d', 'kk', 'ANACAN20 кодын енгізіңіз', 'common'),
  ('untranslated_anacan20_lh7jx6', 'kk', 'ANACAN20', 'common'),
  ('untranslated_anacan_ai_xcltlg', 'kk', 'Anacan.AI', 'common'),
  ('untranslated_anacan_endirimi_s6hngj', 'kk', 'Anacan жеңілдігі', 'common'),
  ('untranslated_anacan_endirimi_st8wsq', 'kk', 'Anacan жеңілдігі', 'common'),
  ('untranslated_anacan_hab3qu', 'kk', 'anacan://', 'common'),
  ('untranslated_anacan_hehflk', 'kk', 'Anacan', 'common'),
  ('untranslated_anacan_partnyor_endirim_sistem_7ol59t', 'kk', 'Anacan серіктестік жеңілдік жүйесі', 'common'),
  ('untranslated_anacan_partnyor_endirim_sistem_ovducx', 'kk', 'Anacan серіктестік жеңілдік жүйесі', 'common'),
  ('untranslated_anacan_partnyor_sistemi_2ykg0d', 'kk', 'Anacan серіктестік жүйесі', 'common'),
  ('untranslated_anacan_partnyor_sistemi_v6bjlq', 'kk', 'Anacan серіктестік жүйесі', 'common'),
  ('untranslated_anacan_premium_3ir9p9', 'kk', 'Anacan Premium', 'common'),
  ('untranslated_anacan_premium_a54nv6', 'kk', 'Anacan Premium ✨', 'common'),
  ('untranslated_anacan_tool_baby_names_mg6g7c', 'kk', 'anacan://tool/baby-names', 'common'),
  ('untranslated_anacan_v1_0_0_m67f8f', 'kk', 'Anacan v1.0.0', 'common'),
  ('untranslated_anacan_xxxx_w5jyqn', 'kk', 'ANACAN-XXXX', 'common'),
  ('untranslated_analiz_edilir_aho6cg', 'kk', 'Талдануда...', 'common'),
  ('untranslated_analiz_edilir_lrgyzi', 'kk', 'Талдануда...', 'common'),
  ('untranslated_analiz_edilir_yu8nin', 'kk', 'Талдануда...', 'common'),
  ('untranslated_analiz_nkoinn', 'kk', 'Талдау...', 'common'),
  ('untranslated_analiz_ogq0zx', 'kk', 'Талдау...', 'common'),
  ('untranslated_analiz_xna4fw', 'kk', 'Талдау...', 'common'),
  ('untranslated_anaya_mesaj_67l26s', 'kk', 'Анаға хабарлама...', 'common'),
  ('untranslated_anaya_mesaj_bhxrdg', 'kk', 'Анаға хабарлама...', 'common'),
  ('untranslated_anaya_mesaj_yxsqke', 'kk', 'Анаға хабарлама...', 'common'),
  ('untranslated_android_play_store_linki_8dmmrs', 'kk', 'Android (Play Store) сілтемесі', 'common'),
  ('untranslated_android_play_store_linki_ggnx15', 'kk', 'Android (Play Store) сілтемесі', 'common'),
  ('untranslated_android_play_store_linki_n7sor5', 'kk', 'Android (Play Store) сілтемесі', 'common'),
  ('untranslated_anonim_dy750q', 'kk', 'Анонимді', 'common'),
  ('untranslated_anonim_olaraq_yaz_9b3d2x', 'kk', 'Анонимді түрде жазыңыз', 'common'),
  ('untranslated_anonim_olaraq_yaz_9ewyvy', 'kk', 'Анонимді жазу', 'common'),
  ('untranslated_anonim_olaraq_yaz_p3y2m8', 'kk', 'Анонимді жазу', 'common'),
  ('untranslated_anonim_xc48xs', 'kk', 'Анонимді', 'common'),
  ('untranslated_asan_2fetjr', 'kk', 'Оңай', 'common'),
  ('untranslated_asan_am756v', 'kk', 'Оңай', 'common'),
  ('untranslated_asan_uj6wox', 'kk', 'Оңай', 'common'),
  ('untranslated_ata_1wxlh9', 'kk', 'Әке', 'common'),
  ('untranslated_ata_62iec8', 'kk', 'Әке', 'common'),
  ('untranslated_ata_analizi_5wnj3o', 'kk', 'Әке талдауы', 'common'),
  ('untranslated_ata_analizi_7tjf5i', 'kk', 'Әке талдауы', 'common'),
  ('untranslated_ata_analizi_a4cy3y', 'kk', 'Әке талдауы', 'common'),
  ('untranslated_ata_yej0mm', 'kk', 'Әке', 'common'),
  ('untranslated_audio_url_6ku10a', 'kk', 'Аудио URL', 'common'),
  ('untranslated_axtar_0fv0q2', 'kk', 'Іздеу', 'common'),
  ('untranslated_axtar_6dhiku', 'kk', 'Іздеу', 'common'),
  ('untranslated_axtar_qbnfxl', 'kk', 'Іздеу...', 'common'),
  ('untranslated_axtar_s6dl2a', 'kk', 'Іздеу...', 'common'),
  ('untranslated_axtar_xueic1', 'kk', 'Іздеу', 'common'),
  ('untranslated_ay_2xkbq4', 'kk', 'Ай', 'common'),
  ('untranslated_ay_cbg87u', 'kk', 'Ай', 'common'),
  ('untranslated_azn_i0q8cv', 'kk', 'AZN', 'common'),
  ('untranslated_baku_eoo0ip', 'kk', 'Баку:', 'common'),
  ('untranslated_banner_tipi_145j20', 'kk', 'Баннер түрі', 'common'),
  ('untranslated_banner_tipi_1ftody', 'kk', 'Баннер түрі', 'common'),
  ('untranslated_banner_tipi_bf2ltn', 'kk', 'Баннер түрі', 'common'),
  ('untranslated_bax_ktyxlq', 'kk', 'Көру', 'common'),
  ('untranslated_bax_uxmr4l', 'kk', 'Көру', 'common'),
  ('untranslated_bayraq_emoji_lu1lld', 'kk', 'Ту эмодзиі', 'common'),
  ('untranslated_bayraq_emoji_vclkmw', 'kk', 'Ту эмодзиі', 'common'),
  ('untranslated_bayraq_emoji_wz2124', 'kk', 'Ту эмодзиі', 'common'),
  ('untranslated_bazar_geqrxw', 'kk', 'Нарық', 'common'),
  ('untranslated_bazar_ky891s', 'kk', 'Нарық', 'common'),
  ('untranslated_bazar_statusu_qk4rpw', 'kk', 'Нарық күйі:', 'common'),
  ('untranslated_bazar_statusu_w3vk6r', 'kk', 'Нарық күйі:', 'common'),
  ('untranslated_bazar_statusu_wyotgl', 'kk', 'Нарық күйі:', 'common'),
  ('untranslated_bazar_uc24gb', 'kk', 'Нарық', 'common'),
  ('untranslated_bento_apple_bento_qrid_foto_st_icsrvw', 'kk', 'Bento — Apple bento торы (фото + статистика)', 'common'),
  ('untranslated_bento_apple_bento_qrid_foto_st_uzf20y', 'kk', 'Bento — Apple bento торы (фото + статистика)', 'common'),
  ('untranslated_bento_apple_bento_qrid_foto_st_xsufdh', 'kk', 'Bento — Apple bento торы (фото + статистика)', 'common'),
  ('untranslated_bilinmir_2oq0oc', 'kk', 'Белгісіз', 'common'),
  ('untranslated_bilinmir_vl9auz', 'kk', 'Белгісіз', 'common'),
  ('untranslated_bio_dl7qfa', 'kk', 'Био', 'common'),
  ('untranslated_bitirdim_71nibo', 'kk', 'Аяқталды', 'common'),
  ('untranslated_bitirdim_7wqwfg', 'kk', 'Аяқталды', 'common'),
  ('untranslated_bitirdim_ufy1vm', 'kk', 'Аяқтадым', 'common'),
  ('untranslated_blokla_54iusf', 'kk', 'Бұғаттау', 'common'),
  ('untranslated_blokla_72ne93', 'kk', 'Бұғаттау', 'common'),
  ('untranslated_blokla_h5f50m', 'kk', 'Бұғаттау', 'common'),
  ('untranslated_bloklar_80r3q3', 'kk', 'Блоктар', 'common'),
  ('untranslated_bloklar_fv05p9', 'kk', 'Блоктар', 'common'),
  ('untranslated_bloklar_k8vwl9', 'kk', 'Блоктар', 'common'),
  ('untranslated_boy_sm_3vo9ac', 'kk', 'Бойы (см)', 'common'),
  ('untranslated_boy_sm_b4lqb9', 'kk', 'Бойы (см)', 'common'),
  ('untranslated_boy_sm_kl0o5i', 'kk', 'Бойы (см)', 'common'),
  ('untranslated_boydayam_24fwrc', 'kk', 'Жүктімін', 'common'),
  ('untranslated_boydayam_33vi8z', 'kk', 'Менің өлшемім', 'common'),
  ('untranslated_boydayam_y2o35n', 'kk', 'Менің өлшемім', 'common'),
  ('untranslated_branding_c370n3', 'kk', 'Брендинг', 'common'),
  ('untranslated_breadcrumb_u84h6g', 'kk', 'Навигация', 'common'),
  ('untranslated_bu_ay_4wyb99', 'kk', 'Осы ай', 'common'),
  ('untranslated_bu_ay_vljw5q', 'kk', 'Осы ай', 'common'),
  ('untranslated_bu_ay_w5iunh', 'kk', 'Осы ай', 'common'),
  ('untranslated_bulk_kkhyf0', 'kk', 'Жаппай', 'common'),
  ('untranslated_bump_g4897e', 'kk', 'Іш', 'common'),
  ('untranslated_cakes_maternity_er8n59', 'kk', 'торттар,ана болу', 'common'),
  ('untranslated_cavab_az_7pjuca', 'kk', 'Жауап (AZ)', 'common'),
  ('untranslated_cavab_az_mmz87d', 'kk', 'Жауап (AZ)', 'common'),
  ('untranslated_cavab_az_t68ion', 'kk', 'Жауап (AZ)', 'common'),
  ('untranslated_cavab_en_8ox9gv', 'kk', 'Жауап (EN)', 'common'),
  ('untranslated_cavab_en_g9q92e', 'kk', 'Жауап (EN)', 'common'),
  ('untranslated_cavab_en_ryz29y', 'kk', 'Жауап (EN)', 'common'),
  ('untranslated_ciddi_83s9et', 'kk', 'Маңызды', 'common'),
  ('untranslated_ciddi_wls56y', 'kk', 'Маңызды', 'common'),
  ('untranslated_ciddi_y77z3n', 'kk', 'Маңызды', 'common'),
  ('untranslated_cins_3th04k', 'kk', 'Жынысы', 'common'),
  ('untranslated_cins_cq8nd5', 'kk', 'Жынысы:', 'common'),
  ('untranslated_cins_ff0iks', 'kk', 'Жынысы', 'common'),
  ('untranslated_cins_uubi6r', 'kk', 'Жынысы:', 'common'),
  ('untranslated_cins_wu3wbx', 'kk', 'Жынысы:', 'common'),
  ('untranslated_cinsi_8p7xgd', 'kk', 'Жынысы', 'common'),
  ('untranslated_cinsi_vl7vtk', 'kk', 'Жынысы', 'common'),
  ('untranslated_color_gradient_mal1jj', 'kk', 'Түс градиенті', 'common'),
  ('untranslated_color_id_meselen_auburn_0h8bpa', 'kk', 'Түс ID-і (мысалы, күрең)', 'common'),
  ('untranslated_color_id_meselen_auburn_2t6onz', 'kk', 'Түс ID-і (мысалы, күрең)', 'common'),
  ('untranslated_color_id_meselen_auburn_nunchp', 'kk', 'Түс ID-і (мысалы: күрең)', 'common'),
  ('untranslated_color_id_meselen_hazel_219d76', 'kk', 'Түс ID-і (мысалы, жаңғақ түсті)', 'common'),
  ('untranslated_color_id_meselen_hazel_vyhrrd', 'kk', 'Түс ID-і (мысалы, жаңғақ түсті)', 'common'),
  ('untranslated_color_id_meselen_hazel_x0kt4f', 'kk', 'Түс ID-і (мысалы: жаңғақ түсті)', 'common'),
  ('untranslated_cooldown_saat_6t7ul4', 'kk', 'Күту уақыты (сағат)', 'common'),
  ('untranslated_cooldown_saat_j3ue0o', 'kk', 'Күту уақыты (сағат)', 'common'),
  ('untranslated_cooldown_saat_x4tjte', 'kk', 'Күту уақыты (сағат)', 'common'),
  ('untranslated_cover_url_olv2h6', 'kk', 'Мұқаба URL-і', 'common'),
  ('untranslated_crash_report_yoxdur_2yf5kz', 'kk', 'Ақау туралы есеп жоқ 🎉', 'common'),
  ('untranslated_crash_report_yoxdur_lpqtv2', 'kk', 'Ақау туралы есеп жоқ 🎉', 'common'),
  ('untranslated_crash_report_yoxdur_pq1ov5', 'kk', 'Ақау туралы есеп жоқ 🎉', 'common'),
  ('untranslated_crying_more_10_sleep_problems_92q6b3', 'kk', 'Жиі жылау&#10;Ұйқы мәселелері', 'common'),
  ('untranslated_csv_i_dxal_d0cxyn', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_dxal_h7srz3', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_dxal_j6xub7', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_dxal_r64yej', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_mport_0h55uj', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_mport_1pfqd8', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_mport_kbhw1d', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_mport_q3hmcm', 'kk', 'CSV импорты', 'common'),
  ('untranslated_csv_i_xrac_0wsuo7', 'kk', 'CSV экспорты', 'common'),
  ('untranslated_csv_i_xrac_ivd4z6', 'kk', 'CSV экспорты', 'common'),
  ('untranslated_csv_i_xrac_l4z4du', 'kk', 'CSV экспорты', 'common'),
  ('untranslated_csv_i_xrac_yu5b45', 'kk', 'CSV экспорты', 'common'),
  ('untranslated_currentmonth_return_4ymwjh', 'kk', 'currentMonth;

            return (', 'common'),
  ('untranslated_custom_scheme_n0y21k', 'kk', 'Арнайы схема', 'common'),
  ('untranslated_cvv_f9btvg', 'kk', 'CVV', 'common'),
  ('untranslated_d_vitamini_39klen', 'kk', 'D дәрумені', 'common'),
  ('untranslated_d_vitamini_6jmrgm', 'kk', 'D дәрумені', 'common'),
  ('untranslated_d_vitamini_8d46xp', 'kk', 'D дәрумені', 'common'),
  ('untranslated_daha_sonra_18219k', 'kk', 'Кейінірек', 'common'),
  ('untranslated_daha_sonra_4v3lpl', 'kk', 'Кейінірек', 'common'),
  ('untranslated_daha_sonra_8w00lu', 'kk', 'Кейінірек', 'common'),
  ('untranslated_dashboard_cylm1h', 'kk', 'Басқару тақтасы', 'common'),
  ('untranslated_date_new_date_date_buza9m', 'kk', 'date > new Date() || date', 'common'),
  ('untranslated_date_zr24gc', 'kk', 'күн', 'common'),
  ('untranslated_davam_et_golrf0', 'kk', 'Жалғастыру', 'common'),
  ('untranslated_davam_et_quvswu', 'kk', 'Жалғастыру', 'common'),
  ('untranslated_db_zvkzkx', 'kk', 'дБ', 'common'),
  ('untranslated_deaktiv_4qlmgf', 'kk', 'Белсенді емес', 'common'),
  ('untranslated_deaktiv_5x0g7n', 'kk', 'Белсенді емес', 'common'),
  ('untranslated_deaktiv_9cphcb', 'kk', 'белсенді емес', 'common'),
  ('untranslated_deaktiv_cfd2eg', 'kk', 'белсенді емес', 'common'),
  ('untranslated_deaktiv_cz8spd', 'kk', 'белсенді емес', 'common'),
  ('untranslated_deaktiv_h6gct8', 'kk', 'Белсенді емес', 'common'),
  ('untranslated_deeplink_axtar_myitlg', 'kk', 'Deeplink іздеу...', 'common'),
  ('untranslated_deeplink_axtar_si4pn8', 'kk', 'Deeplink іздеу...', 'common'),
  ('untranslated_deeplink_axtar_tk9eh1', 'kk', 'Deeplink іздеу...', 'common'),
  ('untranslated_default_3xw7gz', 'kk', 'Әдепкі', 'common'),
  ('untranslated_default_tbu73y', 'kk', 'әдепкі', 'common'),
  ('untranslated_defolt_a_qaytar_dirr3t', 'kk', 'Әдепкі күйге қайтару', 'common'),
  ('untranslated_defolt_a_qaytar_nygzb2', 'kk', 'Әдепкі күйге қайтару', 'common'),
  ('untranslated_defolt_a_qaytar_z2cmkl', 'kk', 'Әдепкі күйге қайтару', 'common'),
  ('untranslated_dekret_kalkulyatoru_i99uxi', 'kk', 'Декреттік демалыс калькуляторы', 'common'),
  ('untranslated_dekret_kalkulyatoru_rqjry2', 'kk', 'Декреттік демалыс калькуляторы', 'common'),
  ('untranslated_dekret_kalkulyatoru_rsreyb', 'kk', 'Декреттік демалыс калькуляторы', 'common'),
  ('untranslated_detallar_19x96t', 'kk', 'Толығырақ', 'common'),
  ('untranslated_detallar_mbn3vl', 'kk', 'Толығырақ', 'common'),
  ('untranslated_detallar_tp006e', 'kk', 'Толығырақ', 'common'),
  ('untranslated_diapazon_pc2e4r', 'kk', 'Ауқым', 'common'),
  ('untranslated_diapazon_xg8qa2', 'kk', 'Ауқым', 'common'),
  ('untranslated_dil_btxap1', 'kk', 'Тіл:', 'common'),
  ('untranslated_dil_eb74sh', 'kk', 'Тіл', 'common'),
  ('untranslated_dil_language_a1gzjr', 'kk', 'Тіл', 'common'),
  ('untranslated_dil_language_hwkmle', 'kk', 'Тіл', 'common'),
  ('untranslated_dil_u15w70', 'kk', 'Тіл', 'common'),
  ('untranslated_dil_x623v5', 'kk', 'Тіл:', 'common'),
  ('untranslated_doldurulub_82vmx3', 'kk', 'Толтырылған', 'common'),
  ('untranslated_doldurulub_e7pial', 'kk', 'Толтырылған', 'common'),
  ('untranslated_doldurulub_ryz8li', 'kk', 'Толтырылған', 'common'),
  ('untranslated_dolu_13yba1', 'kk', 'Толық', 'common'),
  ('untranslated_dolu_35oo5e', 'kk', 'Толық', 'common'),
  ('untranslated_dolu_vtvrq6', 'kk', 'Толық', 'common'),
  ('untranslated_doza_26cdwh', 'kk', 'Доза №', 'common'),
  ('untranslated_doza_m1hd6g', 'kk', 'Доза №', 'common'),
  ('untranslated_doza_s5myxb', 'kk', 'Доза №', 'common'),
  ('untranslated_dozaj_gw0cfy', 'kk', 'Дозасы', 'common'),
  ('untranslated_dozaj_pgkqnt', 'kk', 'Дозасы', 'common'),
  ('untranslated_dozaj_ycca4w', 'kk', 'Дозасы', 'common'),
  ('untranslated_e_mail_dkfp6n', 'kk', 'Эл. пошта', 'common'),
  ('untranslated_elan_c06c18', 'kk', 'Хабарландыру', 'common'),
  ('untranslated_elan_hyymu2', 'kk', 'Хабарландыру', 'common'),
  ('untranslated_elan_yarat_3c3yl4', 'kk', 'Хабарландыру жасау', 'common'),
  ('untranslated_elan_yarat_dip8ub', 'kk', 'Хабарландыру жасау', 'common'),
  ('untranslated_elan_yarat_wp2yd3', 'kk', 'Хабарландыру жасау', 'common'),
  ('untranslated_emal_edilir_48y9ce', 'kk', 'Өңделуде...', 'common'),
  ('untranslated_emal_edilir_c8ooy1', 'kk', 'Өңделуде...', 'common'),
  ('untranslated_emal_edilir_hf0m1t', 'kk', 'Өңделуде...', 'common'),
  ('untranslated_emoji_zt2p0q', 'kk', 'Эмодзи', 'common'),
  ('untranslated_en_7ksh9c', 'kk', 'kk', 'common'),
  ('untranslated_endirimi_al_qr_yarat_lodft4', 'kk', 'Жеңілдік алыңыз — QR жасаңыз', 'common'),
  ('untranslated_endirimi_al_qr_yarat_wd6vtg', 'kk', 'Жеңілдік алыңыз — QR жасаңыз', 'common'),
  ('untranslated_enerji_8vx6th', 'kk', 'Қуат', 'common'),
  ('untranslated_enerji_q9btcl', 'kk', 'Қуат', 'common'),
  ('untranslated_english_0i8xeo', 'kk', 'Ағылшын тілі', 'common'),
  ('untranslated_entitlement_raw_jte905', 'kk', 'Құқық (өңделмеген)', 'common'),
  ('untranslated_entries_index_1_weight_bg_gree_shmp6x', 'kk', 'entries[index - 1].weight ?
                ''bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'' :
                entry.weight', 'common'),
  ('untranslated_epds_hw0nj4', 'kk', 'EPDS', 'common'),
  ('untranslated_epds_testi_0761x2', 'kk', 'EPDS тесті', 'common'),
  ('untranslated_epds_testi_26v281', 'kk', 'EPDS тесті', 'common'),
  ('untranslated_epds_testi_gw87qw', 'kk', 'EPDS тесті', 'common'),
  ('untranslated_error_url_46ij0u', 'kk', 'Қате URL', 'common'),
  ('untranslated_etiket_az_1g71gj', 'kk', 'Белгі (AZ)', 'common'),
  ('untranslated_etiket_az_1ia0ls', 'kk', 'Белгі (AZ)', 'common'),
  ('untranslated_etiket_az_fuf5sk', 'kk', 'Белгі (AZ)', 'common'),
  ('untranslated_etiket_b1gnl4', 'kk', 'Белгі', 'common'),
  ('untranslated_etiket_en_eexcc0', 'kk', 'Белгі (EN)', 'common'),
  ('untranslated_etiket_en_eolz9e', 'kk', 'Белгі (EN)', 'common'),
  ('untranslated_etiket_en_twxhqg', 'kk', 'Белгі (EN)', 'common'),
  ('untranslated_etiket_y3i41y', 'kk', 'Белгі', 'common'),
  ('untranslated_etiket_zfy8kx', 'kk', 'Белгі', 'common'),
  ('untranslated_eur_rl9qgf', 'kk', 'EUR', 'common'),
  ('untranslated_extra_cuddles_10_patience_ak991s', 'kk', 'Көбірек құшақтаңыз&#10;Сабыр сақтаңыз', 'common'),
  ('untranslated_faiz_3j6ok8', 'kk', 'Пайыз (%)', 'common'),
  ('untranslated_faiz_i8hquw', 'kk', 'Пайыз (%)', 'common'),
  ('untranslated_faiz_lnc2g8', 'kk', 'Пайыз (%)', 'common'),
  ('untranslated_faza_mp59wa', 'kk', 'Кезең', 'common'),
  ('untranslated_faza_optional_gjv36c', 'kk', 'Кезең (міндетті емес)', 'common'),
  ('untranslated_faza_optional_ibkuri', 'kk', 'Кезең (міндетті емес)', 'common'),
  ('untranslated_faza_optional_vjdacl', 'kk', 'Кезең (міндетті емес)', 'common'),
  ('untranslated_faza_vokom3', 'kk', 'Кезең', 'common'),
  ('untranslated_faza_zzl7kw', 'kk', 'Кезең', 'common'),
  ('untranslated_filter_2s2kwv', 'kk', 'Сүзгі', 'common'),
  ('untranslated_filtr_5xmz0m', 'kk', 'Сүзгі', 'common'),
  ('untranslated_filtr_ekh2id', 'kk', 'Сүзгі', 'common'),
  ('untranslated_filtr_pgwdlm', 'kk', 'Сүзгі', 'common'),
  ('untranslated_fiziki_albom_bsnxu7', 'kk', 'Физикалық альбом', 'common'),
  ('untranslated_fiziki_albom_gbl93a', 'kk', 'Физикалық альбом', 'common'),
  ('untranslated_flow_zmbs7g', 'kk', 'Ағын', 'common'),
  ('untranslated_fokus_qida_ti7rkd', 'kk', 'Тағамға назар', 'common'),
  ('untranslated_fokus_qida_yvvppa', 'kk', 'Тағамға назар', 'common'),
  ('untranslated_fon_63ektl', 'kk', 'Фон:', 'common'),
  ('untranslated_fon_6h9ma5', 'kk', 'Фон:', 'common'),
  ('untranslated_fon_8qihvn', 'kk', 'Фон', 'common'),
  ('untranslated_fon_fckghu', 'kk', 'Фон', 'common'),
  ('untranslated_fon_mofyie', 'kk', 'Фон:', 'common'),
  ('untranslated_fon_pl3t2c', 'kk', 'Фон', 'common'),
  ('untranslated_fonlar_1acmgh', 'kk', 'Фондар', 'common'),
  ('untranslated_fonlar_xs5gb6', 'kk', 'Фондар', 'common'),
  ('untranslated_fonlar_zk0n86', 'kk', 'Фондар', 'common'),
  ('untranslated_force_update_29c4se', 'kk', 'Мәжбүрлі жаңарту', 'common'),
  ('untranslated_force_update_statusu_9281ri', 'kk', 'Мәжбүрлі жаңарту күйі', 'common'),
  ('untranslated_force_update_statusu_q4p8p1', 'kk', 'Мәжбүрлі жаңарту күйі', 'common'),
  ('untranslated_force_update_statusu_s8vgl7', 'kk', 'Мәжбүрлі жаңарту күйі', 'common'),
  ('untranslated_format_mw14jf', 'kk', 'Пішім', 'common'),
  ('untranslated_formula_qrzgva', 'kk', 'Формула:', 'common'),
  ('untranslated_free_q78n3j', 'kk', 'Тегін', 'common'),
  ('untranslated_funksiya_8co336', 'kk', 'Мүмкіндік', 'common'),
  ('untranslated_funksiya_kecvuu', 'kk', 'Мүмкіндік', 'common'),
  ('untranslated_funksiya_w1bwt6', 'kk', 'Мүмкіндік', 'common'),
  ('untranslated_funksiyalar_bgmac1', 'kk', 'Мүмкіндіктер', 'common'),
  ('untranslated_funksiyalar_d7uqgm', 'kk', 'Мүмкіндіктер', 'common'),
  ('untranslated_funksiyalar_w7ylj8', 'kk', 'Мүмкіндіктер', 'common'),
  ('untranslated_geri_811g2o', 'kk', 'Артқа', 'common'),
  ('untranslated_geri_al_wlrsxv', 'kk', 'Болдырмау', 'common'),
  ('untranslated_geri_al_y0vox9', 'kk', 'Болдырмау', 'common'),
  ('untranslated_geri_al_zo6b3b', 'kk', 'Болдырмау', 'common'),
  ('untranslated_geri_b3jeaj', 'kk', 'Артқа', 'common'),
  ('untranslated_geri_pig5li', 'kk', 'Артқа', 'common'),
  ('untranslated_geyim_uxfih7', 'kk', 'Киім', 'common'),
  ('untranslated_geyim_ypdvpe', 'kk', 'Киім', 'common'),
  ('untranslated_gizli_j471ob', 'kk', 'Жасырын', 'common'),
  ('untranslated_gizli_p5gviy', 'kk', 'Жасырын', 'common'),
  ('untranslated_gizli_tqhqt7', 'kk', 'Жасырын', 'common'),
  ('untranslated_gizlilik_0tn01c', 'kk', 'Құпиялық:', 'common'),
  ('untranslated_gizlilik_b40dyl', 'kk', 'Құпиялық:', 'common'),
  ('untranslated_gizlilik_wqflld', 'kk', 'Құпиялық:', 'common'),
  ('untranslated_go_to_next_page_t75qmz', 'kk', 'Келесі бетке өту', 'common'),
  ('untranslated_go_to_previous_page_zfvsqc', 'kk', 'Алдыңғы бетке өту', 'common'),
  ('untranslated_gradient_1jnh9u', 'kk', 'Градиент', 'common'),
  ('untranslated_gradient_from_amber_600_to_amb_kt1u20', 'kk', 'Градиент (amber-600-ден amber-800-ге дейін)', 'common'),
  ('untranslated_gradient_from_blue_400_to_blue_8fz83m', 'kk', 'Градиент (blue-400-ден blue-600-ге дейін)', 'common'),
  ('untranslated_gradient_from_purple_500_to_pi_oernke', 'kk', 'Градиент (purple-500-ден pink-600-ге дейін)', 'common'),
  ('untranslated_hava_afxeqb', 'kk', 'Ауа райы', 'common'),
  ('untranslated_hava_cp34h6', 'kk', 'Ауа райы', 'common'),
  ('untranslated_hava_geyim_l4cxx8', 'kk', 'Ауа райы және киім', 'common'),
  ('untranslated_hava_iaoo41', 'kk', 'Ауа райы', 'common'),
  ('untranslated_headache_z464sl', 'kk', 'бас ауруы', 'common'),
  ('untranslated_hero_0xozj7', 'kk', 'Негізгі бөлім', 'common'),
  ('untranslated_hero_badge_etiket_75svs2', 'kk', 'Негізгі бөлім белгісі', 'common'),
  ('untranslated_hero_badge_etiket_80xi8g', 'kk', 'Негізгі бөлім белгісі', 'common'),
  ('untranslated_hero_badge_etiket_9mfez7', 'kk', 'Негізгі бөлім белгісі', 'common'),
  ('untranslated_hero_banner_4umc47', 'kk', 'Негізгі баннер', 'common'),
  ('untranslated_hesabla_eq6gu9', 'kk', 'Есептеу', 'common'),
  ('untranslated_hesabla_jj8e2l', 'kk', 'Есептеу', 'common'),
  ('untranslated_hesabla_tqrlgp', 'kk', 'Есептеу', 'common'),
  ('untranslated_hesablanacaq_24utnq', 'kk', 'Есептеледі ↗', 'common'),
  ('untranslated_hesablanacaq_l5r97b', 'kk', 'Есептеледі ↗', 'common'),
  ('untranslated_hiss_edirsiniz_31gp9q', 'kk', 'сезесіз', 'common'),
  ('untranslated_hiss_edirsiniz_geeuyk', 'kk', 'сезесіз', 'common'),
  ('untranslated_hiss_edirsiniz_jx3dij', 'kk', 'сезесіз', 'common'),
  ('untranslated_hotline_clinic_support_thr4yd', 'kk', 'жедел желі, емхана, қолдау', 'common'),
  ('untranslated_https_59ribp', 'kk', 'https://...', 'common'),
  ('untranslated_https_app_anacan_az_tool_baby_ab9cap', 'kk', 'https://app.anacan.az/tool/baby-names', 'common'),
  ('untranslated_https_example_com_banner_jpg_kymzm3', 'kk', 'https://example.com/banner.jpg', 'common'),
  ('untranslated_https_example_com_image_jpg_o20p2k', 'kk', 'https://example.com/image.jpg', 'common'),
  ('untranslated_https_image1_jpg_10_https_imag_84hmu2', 'kk', 'https://image1.jpg&#10;https://image2.jpg', 'common'),
  ('untranslated_https_video_mp4_mqovg9', 'kk', 'https://video.mp4', 'common'),
  ('untranslated_i_mkanlar_tiydb1', 'kk', 'Қолайлылықтар', 'common'),
  ('untranslated_i_mport_et_78ruag', 'kk', 'Импорттау', 'common'),
  ('untranslated_i_mport_et_psr5bz', 'kk', 'Импорттау', 'common'),
  ('untranslated_i_mport_et_sov5mp', 'kk', 'Импорттау', 'common'),
  ('untranslated_i_mport_et_y06kss', 'kk', 'Импорттау', 'common'),
  ('untranslated_i_ndi_test_et_30vzgl', 'kk', 'Қазір тексеру', 'common'),
  ('untranslated_i_ndi_test_et_7p99zu', 'kk', 'Қазір тексеру', 'common'),
  ('untranslated_i_ndi_test_et_aiwdu3', 'kk', 'Қазір тексеру', 'common'),
  ('untranslated_i_ndi_test_et_uacvqt', 'kk', 'Қазір тексеру', 'common'),
  ('untranslated_i_xrac_3ajns2', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_et_bnoxuh', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_et_ey5smr', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_et_t6j3d7', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_et_z215mt', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_m5lrn2', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_s0j84o', 'kk', 'Экспорттау', 'common'),
  ('untranslated_i_xrac_suy388', 'kk', 'Экспорттау', 'common'),
  ('untranslated_icon_name_t2gpit', 'kk', 'Белгіше атауы', 'common'),
  ('untranslated_id_m7cpa9', 'kk', 'ID', 'common'),
  ('untranslated_indi_2j60fa', 'kk', 'қазір', 'common'),
  ('untranslated_indi_c2dqv6', 'kk', 'қазір', 'common'),
  ('untranslated_indi_t45szs', 'kk', 'қазір', 'common'),
  ('untranslated_info_anacan_az_z53jy8', 'kk', 'info@anacan.az', 'common'),
  ('untranslated_instagram_knckna', 'kk', 'Instagram', 'common'),
  ('untranslated_instagram_user_cgq0cl', 'kk', 'Instagram (@user)', 'common'),
  ('untranslated_ios_app_store_linki_15t4s0', 'kk', 'iOS (App Store) сілтемесі', 'common'),
  ('untranslated_ios_app_store_linki_43tq0n', 'kk', 'iOS (App Store) сілтемесі', 'common'),
  ('untranslated_ios_app_store_linki_t8q8fi', 'kk', 'iOS (App Store) сілтемесі', 'common'),
  ('untranslated_ip_mgc0xh', 'kk', 'IP', 'common'),
  ('untranslated_jwt_authentication_id0k5x', 'kk', 'JWT аутентификациясы', 'common'),
  ('untranslated_kalori_2wu04e', 'kk', 'калория', 'common'),
  ('untranslated_kalori_8v9lov', 'kk', 'Калория', 'common'),
  ('untranslated_kalori_kcal_0orhvj', 'kk', 'Калория (ккал)', 'common'),
  ('untranslated_kalori_kcal_s4xkw8', 'kk', 'Калориялар (ккал)', 'common'),
  ('untranslated_kalori_kcal_xqln87', 'kk', 'Калориялар (ккал)', 'common'),
  ('untranslated_kalori_uvur7s', 'kk', 'Калориялар', 'common'),
  ('untranslated_kalori_xga5tj', 'kk', 'калория', 'common'),
  ('untranslated_kalori_z0i2s1', 'kk', 'калориялар', 'common'),
  ('untranslated_kamera_abb30t', 'kk', 'Камера', 'common'),
  ('untranslated_kamera_jzawig', 'kk', 'Камера', 'common'),
  ('untranslated_kart_aivuhq', 'kk', 'Карта', 'common'),
  ('untranslated_kart_blhtie', 'kk', 'Карта', 'common'),
  ('untranslated_kart_iei3iy', 'kk', 'Карта', 'common'),
  ('untranslated_kart_sahibi_2eeg1v', 'kk', 'Карта иесі', 'common'),
  ('untranslated_kart_sahibi_3f6po5', 'kk', 'Карта иесі:', 'common'),
  ('untranslated_kart_sahibi_4gpprx', 'kk', 'Карта иесі', 'common'),
  ('untranslated_kart_sahibi_jdfd4e', 'kk', 'Карта иесі:', 'common'),
  ('untranslated_kartdan_karta_konfiqurasiya_0x6g04', 'kk', 'Картадан картаға — конфигурация', 'common'),
  ('untranslated_kartdan_karta_konfiqurasiya_21fbpl', 'kk', 'Картадан картаға — конфигурация', 'common'),
  ('untranslated_kartdan_karta_konfiqurasiya_lmkdfj', 'kk', 'Картадан картаға — конфигурация', 'common'),
  ('untranslated_kateqoriya_00jpcn', 'kk', 'Санат', 'common'),
  ('untranslated_kateqoriya_az_72is3a', 'kk', 'Санат (AZ)', 'common'),
  ('untranslated_kateqoriya_az_mdn3xd', 'kk', 'Санат (AZ)', 'common'),
  ('untranslated_kateqoriya_az_nnirxl', 'kk', 'Санат (AZ)', 'common'),
  ('untranslated_kateqoriya_id_slug_3qrm93', 'kk', 'Санат ID (slug)', 'common'),
  ('untranslated_kateqoriya_id_slug_nw7kin', 'kk', 'Санат ID (slug)', 'common'),
  ('untranslated_kateqoriya_id_slug_tgirb6', 'kk', 'Санат ID (slug)', 'common'),
  ('untranslated_kateqoriya_odv40p', 'kk', 'Санат', 'common'),
  ('untranslated_kateqoriya_yoxdur_5g4iuf', 'kk', 'Санат жоқ', 'common'),
  ('untranslated_kateqoriya_yoxdur_ql533z', 'kk', 'Санат жоқ', 'common'),
  ('untranslated_kateqoriya_yoxdur_ubgt5w', 'kk', 'Санат жоқ', 'common'),
  ('untranslated_kateqoriyalar_5183xc', 'kk', 'Санаттар', 'common'),
  ('untranslated_kateqoriyalar_b04ofd', 'kk', 'Санаттар', 'common'),
  ('untranslated_kateqoriyalar_ndrtvr', 'kk', 'Санаттар', 'common'),
  ('untranslated_key_has_9ss5dw', 'kk', 'Кілт (has_...)', 'common')
ON CONFLICT (key, lang) DO NOTHING;

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('untranslated_klik_edildi_3r2by6', 'kk', 'Басылды', 'common'),
  ('untranslated_klik_edildi_5blsic', 'kk', 'Басылды', 'common'),
  ('untranslated_klik_edildi_mndnq9', 'kk', 'Басылды', 'common'),
  ('untranslated_kod_1at1pf', 'kk', 'Код', 'common'),
  ('untranslated_kod_8hox2m', 'kk', 'Код', 'common'),
  ('untranslated_kod_az_en_tr_7g8p3m', 'kk', 'Код (az, en, tr...)', 'common'),
  ('untranslated_kod_az_en_tr_7k68i1', 'kk', 'Код (az, en, tr...)', 'common'),
  ('untranslated_kod_az_en_tr_sqmvba', 'kk', 'Код (az, en, tr...)', 'common'),
  ('untranslated_kod_xxodde', 'kk', 'Код', 'common'),
  ('untranslated_konfiqurasiya_2hsytf', 'kk', 'Конфигурация', 'common'),
  ('untranslated_konfiqurasiya_hblqmg', 'kk', 'Конфигурация', 'common'),
  ('untranslated_konfiqurasiya_oc1zni', 'kk', 'Конфигурация', 'common'),
  ('untranslated_kopyala_hczynl', 'kk', 'Көшіру', 'common'),
  ('untranslated_kopyala_kflcpm', 'kk', 'Көшіру', 'common'),
  ('untranslated_kopyala_t7j80u', 'kk', 'Көшіру', 'common'),
  ('untranslated_kq_q8is52', 'kk', 'кг', 'common'),
  ('untranslated_kritik_1v3b2r', 'kk', 'Критикалық', 'common'),
  ('untranslated_kritik_6zrlva', 'kk', 'Критикалық', 'common'),
  ('untranslated_kritik_dl7r1b', 'kk', 'Критикалық', 'common'),
  ('untranslated_kupon_endirimi_ru0e72', 'kk', 'Купон жеңілдігі:', 'common'),
  ('untranslated_kupon_endirimi_up7r4a', 'kk', 'Купон жеңілдігі', 'common'),
  ('untranslated_kupon_endirimi_wrbqsk', 'kk', 'Купон жеңілдігі', 'common'),
  ('untranslated_kupon_endirimi_ywnotm', 'kk', 'Купон жеңілдігі:', 'common'),
  ('untranslated_kupon_kodu_73y8cy', 'kk', 'Купон коды', 'common'),
  ('untranslated_kupon_kodu_84x7l9', 'kk', 'Купон коды', 'common'),
  ('untranslated_kupon_kodu_dup2nw', 'kk', 'Купон коды *', 'common'),
  ('untranslated_kupon_kodu_j1wqsh', 'kk', 'Купон коды', 'common'),
  ('untranslated_kupon_kodu_lk9n1m', 'kk', 'Купон коды', 'common'),
  ('untranslated_kupon_kodu_wtdp59', 'kk', 'Купон коды *', 'common'),
  ('untranslated_kupon_kodu_x7u662', 'kk', 'Купон коды *', 'common'),
  ('untranslated_kupon_kodu_zg0a08', 'kk', 'Купон коды', 'common'),
  ('untranslated_kursiv_azdkyz', 'kk', 'Курсив', 'common'),
  ('untranslated_kursiv_lro3ec', 'kk', 'Курсив', 'common'),
  ('untranslated_kursiv_taditx', 'kk', 'Курсив', 'common'),
  ('untranslated_label_az_dq49se', 'kk', 'Белгі (AZ)', 'common'),
  ('untranslated_label_en_xdgdgv', 'kk', 'Белгі (EN)', 'common'),
  ('untranslated_leap_rsc5pa', 'kk', 'Секіріс №', 'common'),
  ('untranslated_learn_more_st5k9t', 'kk', 'Толығырақ', 'common'),
  ('untranslated_legal_document_content_tb6xem', 'kk', 'Заңды құжат мазмұны...', 'common'),
  ('untranslated_life_stages_cwzdy7', 'kk', 'Өмір кезеңдері:', 'common'),
  ('untranslated_limitsiz_2m0dau', 'kk', 'Шектеусіз', 'common'),
  ('untranslated_limitsiz_7hjdnc', 'kk', 'Шектеусіз', 'common'),
  ('untranslated_limitsiz_cx2zka', 'kk', 'Шектеусіз', 'common'),
  ('untranslated_limitsiz_taymer_premium_a_aidd_49usj4', 'kk', 'Шектеусіз таймер Premium үшін қолжетімді', 'common'),
  ('untranslated_limitsiz_taymer_premium_a_aidd_9yt3gy', 'kk', 'Шектеусіз таймер Premium үшін қолжетімді', 'common'),
  ('untranslated_limitsiz_taymer_premium_a_aidd_plytwi', 'kk', 'Шектеусіз таймер Premium үшін қолжетімді', 'common'),
  ('untranslated_link_tipi_o98sd6', 'kk', 'Сілтеме түрі', 'common'),
  ('untranslated_link_tipi_sksdan', 'kk', 'Сілтеме түрі', 'common'),
  ('untranslated_link_tipi_viddwr', 'kk', 'Сілтеме түрі', 'common'),
  ('untranslated_link_x20e1h', 'kk', 'Сілтеме', 'common'),
  ('untranslated_log_bh6knw', 'kk', 'Журнал', 'common'),
  ('untranslated_logo_url_j9obah', 'kk', 'Логотиптің URL мекенжайы', 'common'),
  ('untranslated_lokasiyaya_get_7hmqt6', 'kk', 'Орналасқан жерге өту', 'common'),
  ('untranslated_lokasiyaya_get_c31xja', 'kk', 'Орналасқан жерге өту', 'common'),
  ('untranslated_lokasiyaya_get_h37fva', 'kk', 'Орналасқан жерге өту', 'common'),
  ('untranslated_lovable_ai_gateway_lu4yr2', 'kk', 'Lovable ЖИ шлюзі', 'common'),
  ('untranslated_made_with_in_azerbaijan_ombdj4', 'kk', 'Әзербайжанда ❤️ жасалған', 'common'),
  ('untranslated_maks_8r36te', 'kk', 'Макс.', 'common'),
  ('untranslated_maks_u75gd3', 'kk', 'Макс.', 'common'),
  ('untranslated_maksimum_5mb_1w4gok', 'kk', 'Ең көбі 5 МБ', 'common'),
  ('untranslated_maksimum_5mb_zmmis5', 'kk', 'Ең көбі 5 МБ', 'common'),
  ('untranslated_match_vh9nyh', 'kk', 'Сәйкестік', 'common'),
  ('untranslated_max_ay_8ylo0i', 'kk', 'Макс. ай', 'common'),
  ('untranslated_max_ay_ci0kyj', 'kk', 'Макс. ай', 'common'),
  ('untranslated_max_ay_kap3mw', 'kk', 'Макс. ай', 'common'),
  ('untranslated_max_db_929l5i', 'kk', 'Макс. дБ', 'common'),
  ('untranslated_media_iewpej', 'kk', 'Медиа', 'common'),
  ('untranslated_menstruasiya_bowel2', 'kk', 'Етеккір', 'common'),
  ('untranslated_menstruasiya_flow_5byey2', 'kk', 'Етеккір (ағымы)', 'common'),
  ('untranslated_menstruasiya_flow_5x79qt', 'kk', 'Етеккір (ағымы)', 'common'),
  ('untranslated_menstruasiya_flow_d95ecj', 'kk', 'Етеккір (ағымы)', 'common'),
  ('untranslated_menstruasiya_srmsiv', 'kk', 'Етеккір', 'common'),
  ('untranslated_menyu_axtar_875j3f', 'kk', 'Мәзірден іздеу...', 'common'),
  ('untranslated_menyu_axtar_f1hwy4', 'kk', 'Мәзірден іздеу...', 'common'),
  ('untranslated_menyu_axtar_rs9ja5', 'kk', 'Мәзірден іздеу...', 'common'),
  ('untranslated_meqale_url_slug_3yi76x', 'kk', 'мақала-url-идентификаторы', 'common'),
  ('untranslated_meqale_url_slug_7y8na6', 'kk', 'мақала-url-идентификаторы', 'common'),
  ('untranslated_meqale_url_slug_ep2z48', 'kk', 'мақала-url-идентификаторы', 'common'),
  ('untranslated_mesaj_4o4v7l', 'kk', 'Хабарлама:', 'common'),
  ('untranslated_mesaj_axtar_2e1vik', 'kk', 'Хабарламаны іздеу...', 'common'),
  ('untranslated_mesaj_axtar_kfx7aw', 'kk', 'Хабарламаны іздеу...', 'common'),
  ('untranslated_mesaj_axtar_ti4btg', 'kk', 'Хабарламаны іздеу...', 'common'),
  ('untranslated_mesaj_dohngm', 'kk', 'Хабарлама', 'common'),
  ('untranslated_mesaj_jg52sa', 'kk', 'Хабарлама:', 'common'),
  ('untranslated_mesaj_lmd0oi', 'kk', 'Хабарлама', 'common'),
  ('untranslated_mesajlar_jadolu', 'kk', 'Хабарламалар', 'common'),
  ('untranslated_mesajlar_rja3mr', 'kk', 'Хабарламалар', 'common'),
  ('untranslated_mg_dl_lcgawj', 'kk', 'мг/дл', 'common'),
  ('untranslated_milestone_etiketi_20kp7l', 'kk', 'Маңызды кезең белгісі', 'common'),
  ('untranslated_milestone_etiketi_8sqhl0', 'kk', 'Маңызды кезең белгісі', 'common'),
  ('untranslated_milestone_etiketi_mbu3md', 'kk', 'Маңызды кезең белгісі', 'common'),
  ('untranslated_milestone_tort_63927m', 'kk', 'Маңызды кезең торты', 'common'),
  ('untranslated_milestone_tort_ewx2i5', 'kk', 'Маңызды кезең торты', 'common'),
  ('untranslated_milestone_tort_qdezgi', 'kk', 'Маңызды кезең торты', 'common'),
  ('untranslated_milli_i_mmunizasiya_qrafiki_82q0yu', 'kk', 'Ұлттық иммундау күнтізбесі', 'common'),
  ('untranslated_min_ay_q11dec', 'kk', 'Мин. ай', 'common'),
  ('untranslated_min_ay_y7dgvc', 'kk', 'Мин. ай', 'common'),
  ('untranslated_min_ay_yvzola', 'kk', 'Мин. ай', 'common'),
  ('untranslated_min_db_i8d635', 'kk', 'Мин. дБ', 'common'),
  ('untranslated_minimum_6_simvol_4h3uup', 'kk', 'Кемінде 6 таңба', 'common'),
  ('untranslated_minimum_6_simvol_9o5ztk', 'kk', 'Кемінде 6 таңба', 'common'),
  ('untranslated_minimum_versiya_139yci', 'kk', 'Ең төменгі нұсқа', 'common'),
  ('untranslated_minimum_versiya_h7p5dy', 'kk', 'Ең төменгі нұсқа', 'common'),
  ('untranslated_minimum_versiya_j6n07d', 'kk', 'Ең төменгі нұсқа', 'common'),
  ('untranslated_ml_su_3b48wu', 'kk', 'мл су', 'common'),
  ('untranslated_ml_su_4xfc83', 'kk', 'мл су', 'common'),
  ('untranslated_ml_su_rcc6oe', 'kk', 'мл су', 'common'),
  ('untranslated_mm_yy_8mka1l', 'kk', 'АА/ЖЖ', 'common'),
  ('untranslated_moderasiya_2hvg3x', 'kk', 'Модерация', 'common'),
  ('untranslated_moderasiya_pxss3r', 'kk', 'Модерация', 'common'),
  ('untranslated_moderasiya_u8cjd8', 'kk', 'Модерация', 'common'),
  ('untranslated_moderator_2oxbxu', 'kk', 'Модератор', 'common'),
  ('untranslated_mommy_6khps0', 'kk', 'Ана', 'common'),
  ('untranslated_mommy_diary_a5fjkx', 'kk', 'ана.күнделігі', 'common'),
  ('untranslated_mommy_diary_jk3smn', 'kk', 'Ана күнделігі', 'common'),
  ('untranslated_more_pages_rlh7b9', 'kk', 'Қосымша беттер', 'common'),
  ('untranslated_motor_sensory_cognitive_nuv0ua', 'kk', 'қимыл-қозғалыс, сенсорлық, когнитивтік', 'common'),
  ('untranslated_muted_5ngc25', 'kk', 'Дыбыс өшірілген', 'common'),
  ('untranslated_name_az_99j1ly', 'kk', 'Атауы (AZ)', 'common'),
  ('untranslated_name_en_xdz7cv', 'kk', 'Атауы (EN)', 'common'),
  ('untranslated_namespace_u7wptg', 'kk', 'Атаулар кеңістігі', 'common'),
  ('untranslated_nav_home_fkbwfg', 'kk', 'навигация.басты', 'common'),
  ('untranslated_next_a38oe7', 'kk', 'Келесі', 'common'),
  ('untranslated_next_slide_dxpnko', 'kk', 'Келесі слайд', 'common'),
  ('untranslated_normal_80sz88', 'kk', 'Қалыпты', 'common'),
  ('untranslated_offerings_raw_ei3ci4', 'kk', 'Ұсыныстар (өңделмеген)', 'common'),
  ('untranslated_onlayn_pspuk0', 'kk', 'Онлайн', 'common'),
  ('untranslated_onlayn_u7bsqu', 'kk', 'Онлайн', 'common'),
  ('untranslated_online_friajc', 'kk', 'Онлайн', 'common'),
  ('untranslated_oops_page_not_found_pnfngc', 'kk', 'Қап! Бет табылмады', 'common'),
  ('untranslated_option_id_single_twins_3a7esv', 'kk', 'Опция ID (бір бөпе, егіздер)', 'common'),
  ('untranslated_ort_bez_t4baaq', 'kk', 'Орташа жаялық саны', 'common'),
  ('untranslated_ort_boy_dtx1gq', 'kk', 'Орташа бойы', 'common'),
  ('untranslated_ort_boy_n0frht', 'kk', 'Орташа бойы', 'common'),
  ('untranslated_ort_boy_rcsgdf', 'kk', 'Орташа бойы', 'common'),
  ('untranslated_ort_qidalanma_7ui816', 'kk', 'Орташа тамақтану', 'common'),
  ('untranslated_ort_yuxu_s_9wyd1q', 'kk', 'Орташа ұйқы (сағ)', 'common'),
  ('untranslated_orta_0thm8b', 'kk', 'Орташа', 'common'),
  ('untranslated_orta_86dqzj', 'kk', 'Орташа', 'common'),
  ('untranslated_orta_enerji_r2707p', 'kk', 'Орташа қуат', 'common'),
  ('untranslated_orta_period_cmfggw', 'kk', 'Етеккірдің ортасы', 'common'),
  ('untranslated_orta_period_m0zswb', 'kk', 'Етеккірдің ортасы', 'common'),
  ('untranslated_orta_reytinq_0009v8', 'kk', 'орташа рейтинг', 'common'),
  ('untranslated_orta_reytinq_2uy6h5', 'kk', 'Орташа рейтинг', 'common'),
  ('untranslated_orta_reytinq_p5auo8', 'kk', 'Орташа рейтинг', 'common'),
  ('untranslated_orta_tsikl_gbme25', 'kk', 'Циклдің ортасы', 'common'),
  ('untranslated_ortalama_e8s35h', 'kk', 'Орташа', 'common'),
  ('untranslated_ortalama_nd3a09', 'kk', 'Орташа', 'common'),
  ('untranslated_ortaya_43b5yq', 'kk', 'Ортаға', 'common'),
  ('untranslated_ortaya_ta1lo6', 'kk', 'Ортаға', 'common'),
  ('untranslated_ortaya_yg5bzt', 'kk', 'Ортаға', 'common'),
  ('untranslated_outfit_id_meselen_princess_dre_09y40n', 'kk', 'Киім ID (мысалы, princess_dress)', 'common'),
  ('untranslated_outfit_id_meselen_princess_dre_1g1lyc', 'kk', 'Киім ID (мысалы, princess_dress)', 'common'),
  ('untranslated_outfit_id_meselen_princess_dre_dnconp', 'kk', 'Киім ID (мысалы, princess_dress)', 'common'),
  ('untranslated_ovulyasiya_v05p1a', 'kk', 'Овуляция', 'common'),
  ('untranslated_ovulyasiya_vibm8h', 'kk', 'Овуляция', 'common'),
  ('untranslated_oxunub_aonkeu', 'kk', 'Оқылды', 'common'),
  ('untranslated_oxunub_x6l7xz', 'kk', 'Оқылды', 'common'),
  ('untranslated_pagination_l90knt', 'kk', 'Беттерге бөлу', 'common'),
  ('untranslated_partner_kodu_7c03jb', 'kk', 'Серіктес коды', 'common'),
  ('untranslated_partner_kodu_ig7t8i', 'kk', 'Серіктес коды', 'common'),
  ('untranslated_partner_kodu_pv6a8k', 'kk', 'Серіктес коды', 'common'),
  ('untranslated_partner_paneli_2foo8i', 'kk', 'Серіктес панелі', 'common'),
  ('untranslated_partner_paneli_oi5yvn', 'kk', 'Серіктес панелі', 'common'),
  ('untranslated_partner_paneli_vi4qm2', 'kk', 'Серіктес панелі', 'common'),
  ('untranslated_partner_profili_5qrcma', 'kk', 'Серіктес профилі', 'common'),
  ('untranslated_partner_profili_bzuu37', 'kk', 'Серіктес профилі', 'common'),
  ('untranslated_partnyor_7it7t5', 'kk', 'Серіктес', 'common'),
  ('untranslated_partnyor_fwq8yy', 'kk', 'Серіктес', 'common'),
  ('untranslated_partnyor_u5eatg', 'kk', 'Серіктес', 'common'),
  ('untranslated_paywall_ww41jc', 'kk', 'Төлем экраны', 'common'),
  ('untranslated_plan_tipi_7hyszp', 'kk', 'Жоспар түрі', 'common'),
  ('untranslated_plan_tipi_bzjghw', 'kk', 'Жоспар түрі', 'common'),
  ('untranslated_plan_tipi_vwk55b', 'kk', 'Жоспар түрі', 'common'),
  ('untranslated_planla_6im69v', 'kk', 'Жоспарлау', 'common'),
  ('untranslated_planla_hb10gr', 'kk', 'Жоспарлау', 'common'),
  ('untranslated_planla_rkmuzo', 'kk', 'Жоспарлау', 'common'),
  ('untranslated_planlar_96j9qf', 'kk', 'Жоспарлар', 'common'),
  ('untranslated_planlar_db3uch', 'kk', 'Жоспарлар', 'common'),
  ('untranslated_planlar_eu0yoj', 'kk', 'Жоспарлар', 'common'),
  ('untranslated_planlara_daxildir_2vfqh6', 'kk', 'Жоспарларға кіреді:', 'common'),
  ('untranslated_planlara_daxildir_cq2k6l', 'kk', 'Жоспарларға кіреді:', 'common'),
  ('untranslated_planlara_daxildir_mj21x3', 'kk', 'Жоспарларға кіреді:', 'common'),
  ('untranslated_png_jpg_max_5mb_9got3g', 'kk', 'PNG, JPG (макс. 5 МБ)', 'common'),
  ('untranslated_png_jpg_webp_max_5mb_870c2s', 'kk', 'PNG, JPG, WEBP (макс. 5 МБ)', 'common'),
  ('untranslated_populyar_addnhh', 'kk', 'Танымал', 'common'),
  ('untranslated_populyar_m0canp', 'kk', 'Танымал', 'common'),
  ('untranslated_populyar_re6bau', 'kk', 'Танымал', 'common'),
  ('untranslated_porsiya_1tj7zg', 'kk', 'Порция', 'common'),
  ('untranslated_porsiya_6mu5wp', 'kk', 'Порция', 'common'),
  ('untranslated_porsiya_d3dp2z', 'kk', 'Порция', 'common'),
  ('untranslated_postlar_d0kihr', 'kk', 'Жазбалар', 'common'),
  ('untranslated_postlar_ttpkab', 'kk', 'Жазбалар', 'common'),
  ('untranslated_postlar_zsl5he', 'kk', 'Жазбалар', 'common'),
  ('untranslated_premium_8zk2xp', 'kk', 'Premium', 'common'),
  ('untranslated_premium_analiz_qr4v0u', 'kk', 'Premium талдау', 'common'),
  ('untranslated_premium_analiz_qxyvel', 'kk', 'Premium талдау', 'common'),
  ('untranslated_premium_analiz_zjze0s', 'kk', 'Premium талдау', 'common'),
  ('untranslated_premium_cfmla6', 'kk', 'Premium+', 'common'),
  ('untranslated_premium_lifcpl', 'kk', 'PREMIUM', 'common'),
  ('untranslated_premium_only_vjbeza', 'kk', 'Тек Premium', 'common'),
  ('untranslated_premium_ver_2w8vm8', 'kk', 'Premium сыйлау', 'common'),
  ('untranslated_premium_ver_6e2ln0', 'kk', 'Premium сыйлау', 'common'),
  ('untranslated_premium_ver_jy1g2f', 'kk', 'Premium сыйлау', 'common'),
  ('untranslated_previous_slide_yd02ug', 'kk', 'Алдыңғы слайд', 'common'),
  ('untranslated_primary_cjqild', 'kk', 'Негізгі', 'common'),
  ('untranslated_prioritet_1_10_12f4dr', 'kk', 'Басымдық (1-10)', 'common'),
  ('untranslated_prioritet_1_10_cx8mgh', 'kk', 'Басымдық (1-10)', 'common'),
  ('untranslated_prioritet_1_10_ss6gqv', 'kk', 'Басымдық (1-10)', 'common'),
  ('untranslated_prioritet_58zug0', 'kk', 'Басымдық', 'common'),
  ('untranslated_prioritet_kunqi9', 'kk', 'Басымдық', 'common'),
  ('untranslated_prioritet_q43ciz', 'kk', 'Басымдық', 'common'),
  ('untranslated_privacy_policy_7z2c0y', 'kk', 'Құпиялық саясаты', 'common'),
  ('untranslated_private_key_ue2mgz', 'kk', 'Жеке кілт', 'common'),
  ('untranslated_profil_fmzm3e', 'kk', 'Профиль', 'common'),
  ('untranslated_profil_z4k721', 'kk', 'Профиль', 'common'),
  ('untranslated_prompt_r5ew2f', 'kk', 'Сұрау:', 'common'),
  ('untranslated_proqnoz_ndwugx', 'kk', 'Болжам', 'common'),
  ('untranslated_proqnoz_vxo54m', 'kk', 'Болжам', 'common'),
  ('untranslated_public_key_3b3rol', 'kk', 'Ашық кілт', 'common'),
  ('untranslated_pulsuz_46ny3y', 'kk', 'Тегін', 'common'),
  ('untranslated_pulsuz_lnj61v', 'kk', 'Тегін', 'common'),
  ('untranslated_pulsuz_plana_daxildir_1zekqn', 'kk', 'Тегін жоспарға кіреді', 'common'),
  ('untranslated_pulsuz_plana_daxildir_34idq2', 'kk', 'Тегін жоспарға кіреді', 'common'),
  ('untranslated_pulsuz_plana_daxildir_nq5bwd', 'kk', 'Тегін жоспарға кіреді', 'common'),
  ('untranslated_push_diaqnostika_61i4sj', 'kk', 'Push диагностикасы', 'common'),
  ('untranslated_push_diaqnostika_fjkx9z', 'kk', 'Push диагностикасы', 'common'),
  ('untranslated_push_diaqnostika_whrx0y', 'kk', 'Push диагностикасы', 'common'),
  ('untranslated_qa_9ir1eu', 'kk', 'QA', 'common'),
  ('untranslated_qalan_fi5tpe', 'kk', 'Қалды', 'common'),
  ('untranslated_qalereya_244yit', 'kk', 'Галерея', 'common'),
  ('untranslated_qalereya_2j90dp', 'kk', 'Галерея', 'common'),
  ('untranslated_qalereya_hbg8cp', 'kk', 'Галерея', 'common'),
  ('untranslated_qalereyadan_33wki2', 'kk', 'Галереядан', 'common'),
  ('untranslated_qalereyadan_ip87sv', 'kk', 'Галереядан', 'common'),
  ('untranslated_qanaxma_9r8juz', 'kk', 'Қан кету', 'common'),
  ('untranslated_qanaxma_pyn19j', 'kk', 'Қан кету', 'common'),
  ('untranslated_qanaxma_u2onro', 'kk', 'Қан кету', 'common'),
  ('untranslated_qaralama_9wnx65', 'kk', 'Нобай', 'common'),
  ('untranslated_qaralama_bu00lg', 'kk', 'Нобай', 'common'),
  ('untranslated_qaralama_xdbos3', 'kk', 'Нобай', 'common'),
  ('untranslated_qeyd_5zm9qv', 'kk', 'Жазба', 'common'),
  ('untranslated_qeyd_6z1jh4', 'kk', 'Жазба:', 'common'),
  ('untranslated_qeyd_et_2vdush', 'kk', 'Жазып алыңыз', 'common'),
  ('untranslated_qeyd_et_ym3lxv', 'kk', 'Жазып алыңыз', 'common'),
  ('untranslated_qeyd_v0e8ci', 'kk', 'Жазба:', 'common'),
  ('untranslated_qeyd_yddac3', 'kk', 'Жазба', 'common'),
  ('untranslated_qeyd_yoxdur_14qn2t', 'kk', 'Жазбалар жоқ', 'common'),
  ('untranslated_qeyd_yoxdur_8craha', 'kk', 'Жазбалар жоқ', 'common'),
  ('untranslated_qidalanma_4y1djm', 'kk', 'Тамақтану', 'common'),
  ('untranslated_qidalanma_94o4tn', 'kk', 'Тамақтану', 'common'),
  ('untranslated_qidalanma_v1vx0n', 'kk', 'Тамақтану', 'common'),
  ('untranslated_qr_ttl_san_l94pkg', 'kk', 'QR TTL (сек)', 'common'),
  ('untranslated_qr_ttl_san_qwb2tc', 'kk', 'QR TTL (сек)', 'common'),
  ('untranslated_qr_ttl_san_rfypi3', 'kk', 'QR TTL (сек)', 'common'),
  ('untranslated_qrafik_2u7vzk', 'kk', 'График', 'common'),
  ('untranslated_qrafik_377xni', 'kk', 'График', 'common'),
  ('untranslated_qrafik_6156cb', 'kk', 'График', 'common'),
  ('untranslated_qrup_axtar_3zlpi6', 'kk', 'Топты іздеу...', 'common'),
  ('untranslated_qrup_axtar_nnrq1o', 'kk', 'Топты іздеу...', 'common'),
  ('untranslated_qrup_axtar_xodlll', 'kk', 'Топты іздеу...', 'common'),
  ('untranslated_qrup_tipi_3ygpu3', 'kk', 'Топ түрі', 'common'),
  ('untranslated_qrup_tipi_wapugf', 'kk', 'Топ түрі', 'common'),
  ('untranslated_qrup_tipi_zyx9h9', 'kk', 'Топ түрі', 'common'),
  ('untranslated_qrup_yoxdur_kzeyvy', 'kk', 'Топ жоқ', 'common'),
  ('untranslated_qrup_yoxdur_lcg9e8', 'kk', 'Топ жоқ', 'common'),
  ('untranslated_qrup_yoxdur_vm4yfq', 'kk', 'Топ жоқ', 'common'),
  ('untranslated_randevu_ftit71', 'kk', 'Қабылдауға жазылу', 'common'),
  ('untranslated_randevu_pno4cm', 'kk', 'Қабылдауға жазылу', 'common'),
  ('untranslated_rejim_2ly5pg', 'kk', 'Режим', 'common'),
  ('untranslated_rejim_4hdc35', 'kk', 'Режим', 'common'),
  ('untranslated_rejim_w1xb6e', 'kk', 'Режим', 'common'),
  ('untranslated_resept_axtar_kvik28', 'kk', 'Рецепт іздеу...', 'common'),
  ('untranslated_resept_axtar_sttxze', 'kk', 'Рецепт іздеу...', 'common'),
  ('untranslated_result_url_callback_8iyc9m', 'kk', 'Нәтиже URL мекенжайы (Callback)', 'common'),
  ('untranslated_resurslar_86rlik', 'kk', 'Ресурстар', 'common'),
  ('untranslated_resurslar_933m6o', 'kk', 'Ресурстар', 'common'),
  ('untranslated_resurslar_czooen', 'kk', 'Ресурстар', 'common'),
  ('untranslated_return_to_home_msgj24', 'kk', 'Басты бетке оралу', 'common'),
  ('untranslated_revenuecat_debug_swicti', 'kk', 'RevenueCat жөндеу режимі', 'common'),
  ('untranslated_reytinq_0_5_ev7d9s', 'kk', 'Рейтинг (0-5)', 'common'),
  ('untranslated_reytinq_0_5_u68zz4', 'kk', 'Рейтинг (0-5)', 'common'),
  ('untranslated_reytinq_0_5_uk9tcm', 'kk', 'Рейтинг (0-5)', 'common'),
  ('untranslated_reytinq_95bqib', 'kk', 'Рейтинг', 'common'),
  ('untranslated_reytinq_u3c9tq', 'kk', 'Рейтинг', 'common'),
  ('untranslated_reytinq_wo98n1', 'kk', 'Рейтинг', 'common'),
  ('untranslated_rol_0x14k2', 'kk', 'Рөл', 'common'),
  ('untranslated_rol_a1cmpa', 'kk', 'Рөл', 'common'),
  ('untranslated_rol_l7y8cp', 'kk', 'Рөл', 'common'),
  ('untranslated_role_based_access_control_yz0s4d', 'kk', 'Рөлге негізделген қолжетімділікті басқару', 'common'),
  ('untranslated_romantik_6yqhvn', 'kk', 'Романтикалық', 'common'),
  ('untranslated_romantik_a2828f', 'kk', 'Романтикалық', 'common'),
  ('untranslated_romantik_nh146m', 'kk', 'Романтикалық', 'common'),
  ('untranslated_route_e9jh24', 'kk', 'Бағыт', 'common'),
  ('untranslated_row_level_security_rls_n4b3m3', 'kk', 'Жол деңгейіндегі қауіпсіздік (RLS)', 'common'),
  ('untranslated_saat_dj1tvy', 'kk', 'Уақыт', 'common'),
  ('untranslated_saat_g91fqy', 'kk', 'Уақыт', 'common'),
  ('untranslated_saat_x4jhci', 'kk', 'Уақыт', 'common'),
  ('untranslated_sakit_rejim_4bluvb', 'kk', 'Дыбыссыз режим', 'common'),
  ('untranslated_sakit_rejim_rhoxlz', 'kk', 'Дыбыссыз режим', 'common'),
  ('untranslated_sakit_rejim_xi9b5o', 'kk', 'Дыбыссыз режим', 'common'),
  ('untranslated_sakit_saatlar_n1uufe', 'kk', 'Тыныш уақыт', 'common'),
  ('untranslated_sakit_saatlar_st4h4f', 'kk', 'Тыныш уақыт', 'common'),
  ('untranslated_salam_ana_4k23qq', 'kk', 'Сәлем, ана! 💕', 'common'),
  ('untranslated_salam_ana_pxp4d8', 'kk', 'Сәлем, ана! 💕', 'common'),
  ('untranslated_salam_ana_q5iqd4', 'kk', 'Сәлем, ана! 💕', 'common'),
  ('untranslated_saxla_6rtnmo', 'kk', 'Сақтау', 'common'),
  ('untranslated_saxla_eptjnf', 'kk', 'Сақтау', 'common'),
  ('untranslated_saxla_gbdjju', 'kk', 'Сақтау', 'common'),
  ('untranslated_saxla_s_1sdasn', 'kk', 'Сақтау (с)', 'common'),
  ('untranslated_saxla_s_8zax9f', 'kk', 'Сақтау (с)', 'common'),
  ('untranslated_saxla_s_chrevo', 'kk', 'Сақтау (с)', 'common'),
  ('untranslated_say_ffoell', 'kk', 'Саны', 'common'),
  ('untranslated_say_x821mf', 'kk', 'Саны', 'common'),
  ('untranslated_say_y777mt', 'kk', 'Саны', 'common'),
  ('untranslated_sayt_94si0s', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_sayt_eqawlo', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_sayt_jmvkm4', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_schedule_utc_as7g6q', 'kk', 'Кесте (UTC)', 'common'),
  ('untranslated_secondary_596d9b', 'kk', 'Қосымша', 'common'),
  ('untranslated_seher_yemeyi_2tq7b4', 'kk', 'Таңғы ас', 'common'),
  ('untranslated_seher_yemeyi_4z6dnf', 'kk', 'Таңғы ас', 'common'),
  ('untranslated_seher_yemeyi_fl07c8', 'kk', 'Таңғы ас', 'common'),
  ('untranslated_server_utc_k5o8do', 'kk', 'Сервердің UTC уақыты:', 'common'),
  ('untranslated_sevgi_26bssp', 'kk', 'Махаббат', 'common'),
  ('untranslated_sevgi_ajt37v', 'kk', 'Махаббат', 'common'),
  ('untranslated_sevgi_djmoqt', 'kk', 'Махаббат', 'common'),
  ('untranslated_sevimli_8m8bp1', 'kk', 'Таңдаулы', 'common'),
  ('untranslated_sevimli_em7jft', 'kk', 'Таңдаулы', 'common'),
  ('untranslated_sevimli_p2bhfn', 'kk', 'Таңдаулы', 'common'),
  ('untranslated_sil_kr99vq', 'kk', 'Жою', 'common'),
  ('untranslated_sil_t1gprc', 'kk', 'Жою', 'common'),
  ('untranslated_simptom_6v1ol9', 'kk', 'Симптом', 'common'),
  ('untranslated_simptom_degasu', 'kk', 'Симптом', 'common'),
  ('untranslated_simptom_gn08kn', 'kk', 'Симптом', 'common'),
  ('untranslated_simptom_key_bn2jy7', 'kk', 'Симптом кілті', 'common'),
  ('untranslated_simptom_key_ejybyz', 'kk', 'Симптом кілті', 'common'),
  ('untranslated_simptom_key_zyab24', 'kk', 'Симптом кілті', 'common'),
  ('untranslated_simptom_pattern_analizi_67knvy', 'kk', 'Симптомдар үлгісін талдау', 'common'),
  ('untranslated_simptom_pattern_analizi_i5d2nv', 'kk', 'Симптомдар үлгісін талдау', 'common'),
  ('untranslated_simptomlar_az_6vruic', 'kk', 'Симптомдар (AZ)', 'common'),
  ('untranslated_simptomlar_az_j6tqhn', 'kk', 'Симптомдар (AZ)', 'common'),
  ('untranslated_simptomlar_az_jp7zvk', 'kk', 'Симптомдар (AZ)', 'common'),
  ('untranslated_simptomlar_fqo1wm', 'kk', 'Симптомдар', 'common'),
  ('untranslated_simptomlar_nf5sf0', 'kk', 'Симптомдар', 'common'),
  ('untranslated_sinxron_funksiyalar_4lr78q', 'kk', 'Синхронды функциялар', 'common'),
  ('untranslated_sinxron_funksiyalar_8t5e9k', 'kk', 'Синхронды функциялар', 'common'),
  ('untranslated_sinxron_funksiyalar_fc5ufm', 'kk', 'Синхронды функциялар', 'common'),
  ('untranslated_sistem_statusu_0ble4a', 'kk', 'Жүйе күйі', 'common'),
  ('untranslated_sistem_statusu_t2trjs', 'kk', 'Жүйе күйі', 'common'),
  ('untranslated_sistem_statusu_xii8d7', 'kk', 'Жүйе күйі', 'common'),
  ('untranslated_sitat_2do73z', 'kk', 'Дәйексөз', 'common'),
  ('untranslated_sitat_48n5cf', 'kk', 'Дәйексөз', 'common'),
  ('untranslated_sitat_qc50qx', 'kk', 'Дәйексөз', 'common'),
  ('untranslated_sm_6d9xh5', 'kk', 'см', 'common'),
  ('untranslated_sol_dq3mxd', 'kk', 'Сол жақ', 'common'),
  ('untranslated_sol_onu1yu', 'kk', 'Сол жақ', 'common'),
  ('untranslated_sol_st0lan', 'kk', 'Сол жақ', 'common'),
  ('untranslated_sola_grb49i', 'kk', 'Сол жақ', 'common'),
  ('untranslated_sola_l5r1r1', 'kk', 'Солға', 'common'),
  ('untranslated_sola_s72d5n', 'kk', 'Сол жақ', 'common'),
  ('untranslated_son_61336e', 'kk', 'Соңғы', 'common'),
  ('untranslated_son_7_qeyd_cvdw1z', 'kk', 'Соңғы 7 жазба', 'common'),
  ('untranslated_son_c772v8', 'kk', 'Соңғы', 'common'),
  ('untranslated_son_icra_n3xp9j', 'kk', 'Соңғы орындалу', 'common'),
  ('untranslated_son_icra_vit27u', 'kk', 'Соңғы орындалу', 'common'),
  ('untranslated_son_icra_y2t4za', 'kk', 'Соңғы орындалу', 'common'),
  ('untranslated_son_menstruasiya_tarixi_hj3ew3', 'kk', 'Соңғы етеккір күні', 'common'),
  ('untranslated_son_menstruasiya_tarixi_mkbj2z', 'kk', 'Соңғы етеккір күні', 'common'),
  ('untranslated_son_okvjy8', 'kk', 'Соңғы', 'common'),
  ('untranslated_son_qeydiyyatlar_2lq2h6', 'kk', 'Соңғы тіркеулер', 'common'),
  ('untranslated_son_qeydiyyatlar_itlzf6', 'kk', 'Соңғы тіркеулер', 'common'),
  ('untranslated_son_sessiyalar_2sjv6g', 'kk', 'Соңғы сеанстар', 'common'),
  ('untranslated_son_sessiyalar_i9aydq', 'kk', 'Соңғы сеанстар', 'common'),
  ('untranslated_sonra_5rfz9z', 'kk', 'Келесі', 'common'),
  ('untranslated_sonra_8zobgx', 'kk', 'Кейін', 'common'),
  ('untranslated_sonra_jdwp6f', 'kk', 'Келесі', 'common'),
  ('untranslated_sort_order_2kmkjg', 'kk', 'Сұрыптау реті', 'common'),
  ('untranslated_sos_jsum3u', 'kk', 'SOS', 'common'),
  ('untranslated_stage_id_flow_bump_mommy_om590a', 'kk', 'Кезең ID (flow, bump, mommy)', 'common'),
  ('untranslated_statistika_cxh53y', 'kk', 'Статистика', 'common'),
  ('untranslated_statistika_h5y3no', 'kk', 'Статистика', 'common'),
  ('untranslated_statistika_ruhqai', 'kk', 'Статистика', 'common'),
  ('untranslated_status_u6ttaq', 'kk', 'Күйі:', 'common'),
  ('untranslated_step_id_y43wsr', 'kk', 'step.id', 'common'),
  ('untranslated_stil_id_meselen_3d_disney_1x4hty', 'kk', 'Стиль ID (мысалы: 3d_disney)', 'common'),
  ('untranslated_stil_id_meselen_3d_disney_4fhqwb', 'kk', 'Стиль ID (мысалы: 3d_disney)', 'common'),
  ('untranslated_stil_id_meselen_3d_disney_d75e3b', 'kk', 'Стиль ID (мысалы: 3d_disney)', 'common'),
  ('untranslated_stok_5t9euc', 'kk', 'Қор', 'common'),
  ('untranslated_stok_938hdb', 'kk', 'Қор', 'common'),
  ('untranslated_stok_e6a8n8', 'kk', 'Қор', 'common'),
  ('untranslated_story_cgnnef', 'kk', 'Оқиға', 'common'),
  ('untranslated_story_yoxdur_82ws9l', 'kk', 'Оқиға жоқ', 'common'),
  ('untranslated_story_yoxdur_84c1y5', 'kk', 'Оқиға жоқ', 'common'),
  ('untranslated_story_yoxdur_clmuau', 'kk', 'Оқиға жоқ', 'common'),
  ('untranslated_style_id_meselen_ponytail_h187hm', 'kk', 'Стиль ID (мысалы: атқұйрық)', 'common'),
  ('untranslated_style_id_meselen_ponytail_lbi3mf', 'kk', 'Стиль ID (мысалы: атқұйрық)', 'common'),
  ('untranslated_style_id_meselen_ponytail_vybcix', 'kk', 'Стиль ID (мысалы: атқұйрық)', 'common'),
  ('untranslated_su_0t8rr2', 'kk', 'Су', 'common'),
  ('untranslated_su_pj51gz', 'kk', 'Су', 'common'),
  ('untranslated_sual_8uyxc8', 'kk', 'Сұрақ №', 'common'),
  ('untranslated_sual_axtar_6r0b42', 'kk', 'Сұрақты іздеу...', 'common'),
  ('untranslated_sual_axtar_t7dljk', 'kk', 'Сұрақты іздеу...', 'common'),
  ('untranslated_sual_axtar_yofj2o', 'kk', 'Сұрақты іздеу...', 'common'),
  ('untranslated_sual_az_f94mdk', 'kk', 'Сұрақ (AZ)', 'common'),
  ('untranslated_sual_az_frplvl', 'kk', 'Сұрақ (AZ)', 'common'),
  ('untranslated_sual_az_vdmnrr', 'kk', 'Сұрақ (AZ)', 'common'),
  ('untranslated_sual_bpg24h', 'kk', 'Сұрақ №', 'common'),
  ('untranslated_sual_en_3qbt2g', 'kk', 'Сұрақ (EN)', 'common'),
  ('untranslated_sual_en_fttxzo', 'kk', 'Сұрақ (EN)', 'common'),
  ('untranslated_sual_en_uzedj6', 'kk', 'Сұрақ (EN)', 'common'),
  ('untranslated_sual_p8zyfl', 'kk', 'Сұрақ №', 'common'),
  ('untranslated_success_url_sihwv4', 'kk', 'Сәтті аяқталу URL мекенжайы', 'common'),
  ('untranslated_supabase_qlxv4n', 'kk', 'Supabase', 'common'),
  ('untranslated_tamam_a4o44c', 'kk', 'Жарайды', 'common'),
  ('untranslated_tamamla_4k1ynr', 'kk', 'Аяқтау', 'common'),
  ('untranslated_tamamla_fdxmee', 'kk', 'Аяқтау', 'common'),
  ('untranslated_tamamla_rxcs0n', 'kk', 'Аяқтау', 'common'),
  ('untranslated_tamamlanma_6y3raf', 'kk', 'Аяқталуы', 'common'),
  ('untranslated_tamamlanma_8cilvr', 'kk', 'Аяқталуы', 'common'),
  ('untranslated_tamamlanma_mh4fww', 'kk', 'Аяқталуы', 'common'),
  ('untranslated_tarix_ayfsz9', 'kk', 'Күні:', 'common'),
  ('untranslated_tarix_c9jimx', 'kk', 'Күні', 'common'),
  ('untranslated_tarix_eqxo0t', 'kk', 'Күні:', 'common'),
  ('untranslated_tarix_wrdxzv', 'kk', 'Күні', 'common'),
  ('untranslated_taymer_eu9xnh', 'kk', 'Таймер', 'common'),
  ('untranslated_taymer_szu9mw', 'kk', 'Таймер', 'common'),
  ('untranslated_telefon_3c0vlz', 'kk', 'Телефон', 'common'),
  ('untranslated_telefon_994_xx_xxx_xx_xx_d6ojdv', 'kk', 'Телефон (+994 XX XXX XX XX)', 'common'),
  ('untranslated_telefon_994_xx_xxx_xx_xx_yhgzoe', 'kk', 'Телефон (+994 XX XXX XX XX)', 'common'),
  ('untranslated_telefon_994_xx_xxx_xx_xx_zxor7g', 'kk', 'Телефон (+994 XX XXX XX XX)', 'common'),
  ('untranslated_telefon_btmyu2', 'kk', 'Телефон', 'common'),
  ('untranslated_telefon_ffwqh3', 'kk', 'Телефон:', 'common'),
  ('untranslated_telefon_ir7lrd', 'kk', 'Телефон:', 'common'),
  ('untranslated_telefon_nkde8j', 'kk', 'Телефон:', 'common'),
  ('untranslated_the_world_of_bsie58', 'kk', '... әлемі', 'common'),
  ('untranslated_theme_id_meselen_garden_party_hzxklt', 'kk', 'Тақырып идентификаторы (мысалы: garden_party)', 'common'),
  ('untranslated_theme_id_meselen_garden_party_ry9bpr', 'kk', 'Тақырып идентификаторы (мысалы: garden_party)', 'common'),
  ('untranslated_theme_id_meselen_garden_party_zoagfe', 'kk', 'Тақырып идентификаторы (мысалы: garden_party)', 'common'),
  ('untranslated_threshold_nui3a7', 'kk', 'Шекті мән', 'common'),
  ('untranslated_tip_content_in_english_kqy9sd', 'kk', 'Кеңес мәтіні ағылшын тілінде', 'common'),
  ('untranslated_tip_csom06', 'kk', 'Түрі', 'common'),
  ('untranslated_tip_filteri_ec18mg', 'kk', 'Кеңес сүзгісі', 'common'),
  ('untranslated_tip_filteri_gkdus2', 'kk', 'Түр сүзгісі', 'common'),
  ('untranslated_tip_filteri_z0hdox', 'kk', 'Түр сүзгісі', 'common'),
  ('untranslated_tip_nj66xr', 'kk', 'Түрі:', 'common'),
  ('untranslated_tip_or4ckv', 'kk', 'Түрі:', 'common'),
  ('untranslated_tip_title_in_english_gskdgy', 'kk', 'Кеңес тақырыбы ағылшын тілінде', 'common'),
  ('untranslated_tip_title_kntkna', 'kk', 'Кеңес тақырыбы', 'common'),
  ('untranslated_tip_xodixg', 'kk', 'Түрі', 'common'),
  ('untranslated_tip_xon221', 'kk', 'Кеңес', 'common'),
  ('untranslated_toggle_sidebar_r5nfog', 'kk', 'Бүйірлік тақтаны көрсету/жасыру', 'common'),
  ('untranslated_tool_key_dhjnnb', 'kk', 'Құрал кілті', 'common'),
  ('untranslated_toplam_mae8bb', 'kk', 'Барлығы', 'common'),
  ('untranslated_toplam_va8vo7', 'kk', 'Барлығы', 'common'),
  ('untranslated_toplam_xal_lwtmf3', 'kk', 'Жалпы ұпай', 'common'),
  ('untranslated_toplam_xal_swp40r', 'kk', 'Жалпы ұпай', 'common'),
  ('untranslated_toplu_i_mport_7mvpjj', 'kk', 'Жаппай импорт', 'common'),
  ('untranslated_toplu_i_mport_dsdfpc', 'kk', 'Жаппай импорттау', 'common'),
  ('untranslated_toplu_i_mport_h5f41t', 'kk', 'Жаппай импорттау', 'common'),
  ('untranslated_toplu_i_mport_wi6oco', 'kk', 'Жаппай импорттау', 'common'),
  ('untranslated_tortlar_3r2s98', 'kk', 'Торттар 🎂', 'common'),
  ('untranslated_tortlar_kfjgp5', 'kk', 'Торттар 🎂', 'common'),
  ('untranslated_trendyol_573gxf', 'kk', 'Trendyol', 'common'),
  ('untranslated_trimester_vhkg0g', 'kk', 'Триместр', 'common'),
  ('untranslated_try_rpxa0h', 'kk', 'TRY', 'common'),
  ('untranslated_tsikl_tarixi_yoxdur_4ce23k', 'kk', 'Етеккір циклі күні жоқ', 'common'),
  ('untranslated_tsikl_tarixi_yoxdur_90dlky', 'kk', 'Етеккір циклі күні жоқ', 'common'),
  ('untranslated_tsikl_tarixi_yoxdur_bq51l3', 'kk', 'Етеккір циклі күні жоқ', 'common'),
  ('untranslated_type_defaultschema_databasewit_b4ti14', 'kk', 'type DefaultSchema = DatabaseWithoutInternals[Extract', 'common'),
  ('untranslated_universal_links_8jgf36', 'kk', 'Әмбебап сілтемелер', 'common'),
  ('untranslated_universal_om9eyq', 'kk', 'Әмбебап', 'common'),
  ('untranslated_unlock_condition_0vu3va', 'kk', 'Құлыпты ашу шарты', 'common'),
  ('untranslated_upper_central_incisor_right_5pd8m3', 'kk', 'жоғарғы_оң_орталық_күрек_тіс', 'common'),
  ('untranslated_url_hxx6c8', 'kk', 'URL', 'common'),
  ('untranslated_url_sgvlfp', 'kk', 'URL:', 'common'),
  ('untranslated_url_slug_qkubld', 'kk', 'URL слагы', 'common'),
  ('untranslated_us_gb_au_homw8x', 'kk', 'US,GB,AU', 'common'),
  ('untranslated_usd_l7ptsf', 'kk', 'USD', 'common'),
  ('untranslated_uv_w6nkow', 'kk', 'UV', 'common'),
  ('untranslated_vacib_jjxe4m', 'kk', 'Маңызды', 'common'),
  ('untranslated_vacib_lknl1m', 'kk', 'Маңызды', 'common'),
  ('untranslated_vacib_lmdvyt', 'kk', 'Маңызды', 'common'),
  ('untranslated_validation_m01uia', 'kk', 'Тексеру', 'common'),
  ('untranslated_valyuta_6kqif9', 'kk', 'Валюта', 'common'),
  ('untranslated_valyuta_9tj7rw', 'kk', 'Валюта', 'common'),
  ('untranslated_valyuta_sydv9e', 'kk', 'Валюта', 'common'),
  ('untranslated_variasiya_k37tjo', 'kk', 'Нұсқа', 'common'),
  ('untranslated_variasiya_tjs77m', 'kk', 'Нұсқа', 'common'),
  ('untranslated_vaxt_77h25c', 'kk', 'Уақыт', 'common'),
  ('untranslated_vaxt_h8ioh3', 'kk', 'Уақыт', 'common'),
  ('untranslated_veb_sayt_0u7y07', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_veb_sayt_vxutic', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_vebsayt_ea7b82', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_vebsayt_lq9xbi', 'kk', 'Веб-сайт', 'common'),
  ('untranslated_versiya_ne4ivk', 'kk', 'Нұсқа', 'common'),
  ('untranslated_versiya_u3f7p8', 'kk', 'Нұсқа', 'common'),
  ('untranslated_versiya_wrkjrj', 'kk', 'Нұсқа', 'common'),
  ('untranslated_video_g4qydo', 'kk', 'Бейне', 'common'),
  ('untranslated_video_url_z954f4', 'kk', 'Бейне URL мекенжайы', 'common')
ON CONFLICT (key, lang) DO NOTHING;

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('untranslated_vitamin_d_b5gkax', 'kk', 'D дәрумені', 'common'),
  ('untranslated_vitamin_yxy9ke', 'kk', 'Дәрумен', 'common'),
  ('untranslated_vuruldu_2pnutd', 'kk', 'Егілді', 'common'),
  ('untranslated_vuruldu_68smf0', 'kk', 'Егілді', 'common'),
  ('untranslated_vuruldu_fajztg', 'kk', 'Егілді', 'common'),
  ('untranslated_xal_05rq9o', 'kk', 'Ұпай', 'common'),
  ('untranslated_xal_8cbblp', 'kk', 'Ұпай', 'common'),
  ('untranslated_xal_tbwp08', 'kk', 'Ұпай', 'common'),
  ('untranslated_xeyr_davam_et_horkah', 'kk', 'Жоқ, жалғастыру', 'common'),
  ('untranslated_xeyr_davam_et_x70s5n', 'kk', 'Жоқ, жалғастыру', 'common'),
  ('untranslated_xeyr_davam_et_yza8s4', 'kk', 'Жоқ, жалғастыру', 'common'),
  ('untranslated_yadda_saxla_1vfjdz', 'kk', 'Сақтау', 'common'),
  ('untranslated_yadda_saxla_2e39f4', 'kk', 'Сақтау', 'common'),
  ('untranslated_yadda_saxla_2t69gn', 'kk', 'Сақтау', 'common'),
  ('untranslated_yadda_saxla_83u89b', 'kk', 'Сақтау', 'common'),
  ('untranslated_yadda_saxla_x9dd7g', 'kk', 'Сақтау', 'common'),
  ('untranslated_yarat_44trl1', 'kk', 'Жасау', 'common'),
  ('untranslated_yarat_6envq4', 'kk', 'Жасау', 'common'),
  ('untranslated_yarat_i97tre', 'kk', 'Жасау', 'common'),
  ('untranslated_yeni_6i46o2', 'kk', 'Жаңа', 'common'),
  ('untranslated_yeni_a03y1g', 'kk', 'Жаңа', 'common'),
  ('untranslated_yeni_analiz_03lo74', 'kk', 'Жаңа талдау', 'common'),
  ('untranslated_yeni_analiz_t3m042', 'kk', 'Жаңа талдау', 'common'),
  ('untranslated_yeni_analiz_t3yigp', 'kk', 'Жаңа талдау', 'common'),
  ('untranslated_yeni_banner_7xfgdw', 'kk', 'Жаңа баннер', 'common'),
  ('untranslated_yeni_banner_t6wrk2', 'kk', 'Жаңа баннер', 'common'),
  ('untranslated_yeni_banner_x0o7fl', 'kk', 'Жаңа баннер', 'common'),
  ('untranslated_yeni_dil_g3rku7', 'kk', 'Жаңа тіл', 'common'),
  ('untranslated_yeni_dil_ktt7gv', 'kk', 'Жаңа тіл', 'common'),
  ('untranslated_yeni_dil_ljua1z', 'kk', 'Жаңа тіл', 'common'),
  ('untranslated_yeni_doza_4jbdel', 'kk', 'Жаңа доза', 'common'),
  ('untranslated_yeni_doza_6k2gus', 'kk', 'Жаңа доза', 'common'),
  ('untranslated_yeni_doza_shdt34', 'kk', 'Жаңа доза', 'common'),
  ('untranslated_yeni_elan_yarat_5tiess', 'kk', 'Жаңа хабарландыру жасау', 'common'),
  ('untranslated_yeni_elan_yarat_dyeqzp', 'kk', 'Жаңа хабарландыру жасау', 'common'),
  ('untranslated_yeni_elan_yarat_w4chk7', 'kk', 'Жаңа хабарландыру жасау', 'common'),
  ('untranslated_yeni_etiket_a0sfha', 'kk', 'Жаңа белгі', 'common'),
  ('untranslated_yeni_etiket_gevslv', 'kk', 'Жаңа белгі', 'common'),
  ('untranslated_yeni_etiket_qotoq3', 'kk', 'Жаңа белгі', 'common'),
  ('untranslated_yeni_fon_1c06a7', 'kk', 'Жаңа фон', 'common'),
  ('untranslated_yeni_fon_7hxcap', 'kk', 'Жаңа фон', 'common'),
  ('untranslated_yeni_fon_jiasu7', 'kk', 'Жаңа фон', 'common'),
  ('untranslated_yeni_funksiya_9vz0e0', 'kk', 'Жаңа функция', 'common'),
  ('untranslated_yeni_funksiya_c60eb3', 'kk', 'Жаңа мүмкіндік', 'common'),
  ('untranslated_yeni_funksiya_hjll7q', 'kk', 'Жаңа мүмкіндік', 'common'),
  ('untranslated_yeni_geyim_cp1d2h', 'kk', 'Жаңа киім', 'common'),
  ('untranslated_yeni_geyim_o4a0rq', 'kk', 'Жаңа киім', 'common'),
  ('untranslated_yeni_geyim_yr7s24', 'kk', 'Жаңа киім', 'common'),
  ('untranslated_yeni_i_mkan_0bxqgh', 'kk', 'Жаңа қолайлылық', 'common'),
  ('untranslated_yeni_i_mkan_9rfsbg', 'kk', 'Жаңа қолайлылық', 'common'),
  ('untranslated_yeni_i_mkan_k3civu', 'kk', 'Жаңа мүмкіндік', 'common'),
  ('untranslated_yeni_i_mkan_nbsp1d', 'kk', 'Жаңа мүмкіндік', 'common'),
  ('untranslated_yeni_kateqoriya_c4d541', 'kk', 'Жаңа санат', 'common'),
  ('untranslated_yeni_kateqoriya_mk76kd', 'kk', 'Жаңа санат', 'common'),
  ('untranslated_yeni_kateqoriya_v3axfn', 'kk', 'Жаңа санат', 'common'),
  ('untranslated_yeni_kupon_bd1fn5', 'kk', 'Жаңа купон', 'common'),
  ('untranslated_yeni_kupon_n6z0l0', 'kk', 'Жаңа купон', 'common'),
  ('untranslated_yeni_kupon_peccs1', 'kk', 'Жаңа купон', 'common'),
  ('untranslated_yeni_menyu_1h7ypq', 'kk', 'Жаңа мәзір', 'common'),
  ('untranslated_yeni_menyu_drahaw', 'kk', 'Жаңа мәзір', 'common'),
  ('untranslated_yeni_menyu_tczrwq', 'kk', 'Жаңа мәзір', 'common'),
  ('untranslated_yeni_oyun_6om5ym', 'kk', 'Жаңа ойын', 'common'),
  ('untranslated_yeni_oyun_f02wmj', 'kk', 'Жаңа ойын', 'common'),
  ('untranslated_yeni_oyun_zetdmp', 'kk', 'Жаңа ойын', 'common'),
  ('untranslated_yeni_qr_yarat_15mnir', 'kk', 'Жаңа QR жасау', 'common'),
  ('untranslated_yeni_qr_yarat_2vwnby', 'kk', 'Жаңа QR жасау', 'common'),
  ('untranslated_yeni_qr_yarat_v6jc5h', 'kk', 'Жаңа QR жасау', 'common'),
  ('untranslated_yeni_qrup_ow7e5w', 'kk', 'Жаңа топ', 'common'),
  ('untranslated_yeni_qrup_t8yrq2', 'kk', 'Жаңа топ', 'common'),
  ('untranslated_yeni_qrup_z470vk', 'kk', 'Жаңа топ', 'common'),
  ('untranslated_yeni_resept_eum0w9', 'kk', 'Жаңа рецепт', 'common'),
  ('untranslated_yeni_resept_iqu4r2', 'kk', 'Жаңа рецепт', 'common'),
  ('untranslated_yeni_resept_x3li0l', 'kk', 'Жаңа рецепт', 'common'),
  ('untranslated_yeni_saat_hh_mm_tsx3cw', 'kk', 'Жаңа уақыт (HH:MM)', 'common'),
  ('untranslated_yeni_saat_hh_mm_w6mzvy', 'kk', 'Жаңа уақыт (HH:MM)', 'common'),
  ('untranslated_yeni_saat_hh_mm_ykl3o8', 'kk', 'Жаңа уақыт (HH:MM)', 'common'),
  ('untranslated_yeni_slayd_9jt7t2', 'kk', 'Жаңа слайд', 'common'),
  ('untranslated_yeni_slayd_mer74z', 'kk', 'Жаңа слайд', 'common'),
  ('untranslated_yeni_slayd_wot5n0', 'kk', 'Жаңа слайд', 'common'),
  ('untranslated_yeni_ssenari_9evdvm', 'kk', 'Жаңа сценарий', 'common'),
  ('untranslated_yeni_ssenari_fjpfvy', 'kk', 'Жаңа сценарий', 'common'),
  ('untranslated_yeni_ssenari_sj51ue', 'kk', 'Жаңа сценарий', 'common'),
  ('untranslated_yeni_stil_e6027a', 'kk', 'Жаңа стиль', 'common'),
  ('untranslated_yeni_stil_gbs9hz', 'kk', 'Жаңа стиль', 'common'),
  ('untranslated_yeni_stil_u33uqm', 'kk', 'Жаңа стиль', 'common'),
  ('untranslated_yeni_sual_1yzmaz', 'kk', 'Жаңа сұрақ', 'common'),
  ('untranslated_yeni_sual_5awtq2', 'kk', 'Жаңа сұрақ', 'common'),
  ('untranslated_yeni_sual_ats4az', 'kk', 'Жаңа сұрақ', 'common'),
  ('untranslated_yeni_t13hh2', 'kk', 'Жаңа', 'common'),
  ('untranslated_yeni_tema_8o06os', 'kk', 'Жаңа тақырып', 'common'),
  ('untranslated_yeni_tema_q87wto', 'kk', 'Жаңа тақырып', 'common'),
  ('untranslated_yeni_tema_vz8j0o', 'kk', 'Жаңа тақырып', 'common'),
  ('untranslated_yerli_ad_english_1dvse6', 'kk', 'Жергілікті атауы (ағылшынша)', 'common'),
  ('untranslated_yerli_ad_english_m5cm6w', 'kk', 'Жергілікті атауы (ағылшынша)', 'common'),
  ('untranslated_yerli_ad_english_tunnoh', 'kk', 'Жергілікті атауы (ағылшынша)', 'common'),
  ('untranslated_yuxu_saat_145k6w', 'kk', 'Ұйқы (сағат)', 'common'),
  ('untranslated_yuxu_saat_2chnl6', 'kk', 'Ұйқы (сағат)', 'common'),
  ('untranslated_yuxu_saat_l9nt0p', 'kk', 'Ұйқы (сағат)', 'common'),
  ('useflowreminders_title_fertile_end', 'kk', 'Ұрықтануға қолайлы кезең аяқталады', 'common'),
  ('useflowreminders_title_fertile_start', 'kk', 'Ұрықтануға қолайлы кезең басталады', 'common'),
  ('useflowreminders_title_ovulation', 'kk', 'Овуляция жақындап қалды', 'common'),
  ('useflowreminders_title_period_end', 'kk', 'Етеккір жақында аяқталады', 'common'),
  ('useflowreminders_title_period_start', 'kk', 'Етеккір жақындап қалды', 'common'),
  ('useflowreminders_title_pill', 'kk', 'Таблетка қабылдауды еске салу', 'common'),
  ('useflowreminders_title_pms', 'kk', 'ПМС жақындап қалды', 'common')
ON CONFLICT (key, lang) DO NOTHING;
