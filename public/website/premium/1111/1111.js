/* 11.11 campaign "Poz-Aç" (one day, 2026-11-11 Baku). The visitor scratches the card (or presses "Birdən aç") to see the
   yearly price; the subscribe block then opens directly under the card. Same account flow as the weekend page
   (kampaniya.js): login first, then the yearly plan at the server's campaign price; an account with Premium sees that
   instead. Subscribing opens Epoint's bank page; the result is confirmed by the signed Epoint callback, the page only
   polls the status after the redirect back.
   Prices are SHOWN in USD (owner decision, fixed display rate 1 USD = 1.70 AZN) converted from the server's AZN
   prices; the charge is always the server's AZN price, which is stated under the button. Yearly plan only.
   The server's payment redirects and reminder links point to the kampaniya page, which forwards here during 11.11;
   this page never redirects back. */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var $ = function (id) { return document.getElementById(id); };
  // ── Foreign visitors (en/tr/kk/uz): static copy, fixed USD price, Dodo Payments with discount code 1111. ─────────
  // Azerbaijani stays in the HTML and in the az code paths below; these strings are only used when LANG !== 'az'.
  var I18N = {
    en: {
      title: 'Anacan Premium · 11.11', desc: '11.11: today only, yearly Anacan Premium for $11.11. Scratch the card and reveal your discount.',
      lang_label: 'Language', live_today: 'Today only · November 11', live_soon: 'Coming soon · November 11', live_ended: 'Campaign ended',
      hero_title: 'Scratch and <em>reveal</em> your discount.',
      hero_lead: 'Everything in Anacan Premium, ad-free. Scratch the card with your finger: today’s special price is underneath.',
      ended_title: 'The 11.11 campaign has ended.', ended_lead: 'Follow the Anacan app and turn on notifications so you don’t miss the next deals.',
      t_end: 'Campaign ends in', t_start: 'Campaign starts in', units: ['days', 'hours', 'min', 'sec'],
      hint_soon: '11.11 starts soon.', hint_ended: 'The campaign has ended.', hint_urgent: 'Last hour! The discount ends soon.',
      tag: 'Yearly Premium', only_today: 'today only', per_line: '≈ {m}/month · just {c}¢ a day',
      foil_label: 'Scratch card: scratch with your finger or press “Reveal now” to open it', foil_text: 'Scratch with your finger',
      scratch_hint: 'Scratch with your finger', reveal_btn: 'Reveal now', revealed_hint: 'Discount revealed: yearly Premium {p}',
      reasons_h: '11 reasons to go Premium', reasons_sub: 'They light up one by one as you scroll.', reasons_word: 'reasons',
      reasons: [
        ['Anacan AI, even at 3 a.m.', 'Calm, clear answers to your questions.'],
        ['Partner mode', 'Your partner is right there too: shared notes and lists.'],
        ['All 30+ tools unlocked', 'Sleep forecast, solid foods, kick and contraction counters.'],
        ['No ads', 'Just you and your baby.'],
        ['Smart reminders', 'Feeding, sleep, vaccines: nothing slips your mind.'],
        ['Report for your doctor', 'Your notes become a PDF in one tap.'],
        ['Cry translator', 'Possible reasons why your baby is crying.'],
        ['Personal fairy tales', 'Bedtime stories with your baby’s name.'],
        ['White noise', 'A sound library for calm sleep.'],
        ['Baby photo shoot', 'Month-by-month keepsake photos.'],
        ['Parenting and solid foods guide', 'Step by step for every age.'],
      ],
      faq_h: 'Questions',
      faq: [
        ['When does the discount end?', 'On November 11 at 23:59 Baku time (UTC+4). If you subscribe during the campaign, you keep the discounted price at every renewal until you cancel.'],
        ['Why is the price in US dollars?', 'Payment is taken in US dollars. If your card uses another currency, your bank converts the amount at its own rate.'],
        ['Does it renew automatically?', 'Yes. The yearly subscription renews every year at the same campaign price. Dodo Payments emails you a receipt for every charge.'],
        ['How can I cancel?', 'Anytime, with the subscription link in the email from Dodo Payments. No new charge is taken, and Premium stays on until the end of the paid period.'],
        ['How do I get Premium in the app?', 'Premium is linked to the Anacan account you sign in with on this page. Sign in to the app with the same account (Google, Apple or email), and Premium opens automatically.'],
        ['Is the payment secure?', 'Payment is processed by Dodo Payments, our Merchant of Record. You enter your card details on Dodo’s secure checkout page; Anacan never sees your card number.'],
      ],
      stores_label: 'Download the Anacan app', ios: ['Download on the', 'App Store'], android: ['Get it on', 'Google Play'],
      terms: 'Terms of Use', privacy: 'Privacy Policy',
      sticky_price: 'Scratch it', sticky_sub: '11.11 · today only', sticky_btn: 'Scratch the card', sticky_btn2: 'Subscribe',
      yearly: 'Yearly Premium', sub_small: '12 months · ≈ {m}/month · renews yearly at this price',
      code_title: 'Your discount code', copy: 'Copy', copied: 'Copied!', code_hint: 'The $11.11 price is applied automatically at checkout. If not, enter code 1111.',
      email_label: 'Email of your Anacan account', email_ph: 'you@example.com',
      email_hint: 'Use the same email you sign in to Anacan with (Google, Apple or email) so Premium opens in the app',
      consent: 'I agree to the <a href="https://anacan.az/terms" target="_blank" rel="noopener">terms</a> and to yearly auto-renewal; I can cancel anytime',
      subscribe: 'Subscribe · {p}', dodo_note: 'Secure payment by Dodo Payments (Merchant of Record). Taxes may be added depending on your country.',
      starts_soon: '11.11 starts soon', ended_btn: 'Campaign ended',
      prestart_wait: 'The campaign starts on November 11 at 00:00 Baku time (UTC+4). The button opens then.',
      ended_text: 'The 11.11 campaign is over. You can still get Premium in the app.', open_app: 'Open the app',
      login_title: 'Sign in to get the offer', login_sub: 'Use your Anacan account, the same one as in the app. Premium will be linked to it.',
      signed_as: 'Premium will be linked to {e}',
      has_title: 'Your Premium is already active', has_text: 'This account already has Premium, so you don’t need a new subscription.',
      wait_title: 'Confirming your payment…', wait_text: 'This usually takes a few seconds.',
      ok_title: 'Premium is active!', ok_text: 'Your yearly subscription has started. Sign in to the app with the same account and Premium opens automatically.',
      late_title: 'Payment not confirmed yet', late_text: 'Confirmation is taking longer than usual. If you were charged, Premium opens on this account automatically within a few minutes. Dodo Payments also emails you a receipt.',
      err_login: 'Your session has expired. Please sign in again.', err_has: 'This account already has an active web subscription.',
      err_email: 'Please enter a valid email.', err_rate: 'Too many attempts. Please try again in a minute.',
      err_generic: 'The payment page couldn’t open. Please try again in a moment.',
    },
    tr: {
      title: 'Anacan Premium · 11.11', desc: '11.11: yalnızca bugün yıllık Anacan Premium $11.11. Kartı kazı, indirimini kendin aç.',
      lang_label: 'Dil', live_today: 'Yalnızca bugün · 11 Kasım', live_soon: 'Çok yakında · 11 Kasım', live_ended: 'Kampanya sona erdi',
      hero_title: 'Kazı, <em>indirimini</em> kendin aç.',
      hero_lead: 'Anacan Premium’un tüm özellikleri, reklamsız. Kartı parmağınla kazı: bugüne özel fiyat altında.',
      ended_title: '11.11 kampanyası sona erdi.', ended_lead: 'Sonraki indirimleri kaçırmamak için Anacan uygulamasını takip et ve bildirimleri aç.',
      t_end: 'Kampanyanın bitmesine', t_start: 'Kampanyanın başlamasına', units: ['gün', 'saat', 'dk', 'sn'],
      hint_soon: '11.11 çok yakında başlıyor.', hint_ended: 'Kampanya sona erdi.', hint_urgent: 'Son saat! İndirim birazdan bitiyor.',
      tag: 'Yıllık Premium', only_today: 'yalnızca bugün', per_line: 'ayda ≈ {m} · günde sadece {c} sent',
      foil_label: 'Kazı kazan kartı: açmak için parmağınla kazı ya da “Hemen aç” düğmesine bas', foil_text: 'Parmağınla kazı',
      scratch_hint: 'Parmağınla kazı', reveal_btn: 'Hemen aç', revealed_hint: 'İndirim açıldı: yıllık Premium {p}',
      reasons_h: 'Premium için 11 neden', reasons_sub: 'Kaydırdıkça tek tek yanıyor.', reasons_word: 'neden',
      reasons: [
        ['Anacan AI, gece 3’te bile', 'Sorularına sakin ve net yanıtlar.'],
        ['Partner modu', 'Eşin de yanında: ortak notlar ve listeler.'],
        ['30+ aracın hepsi açık', 'Uyku tahmini, ek gıda, tekme ve kasılma sayacı.'],
        ['Reklamsız', 'Sadece sen ve bebeğin.'],
        ['Akıllı hatırlatıcılar', 'Beslenme, uyku, aşı: unutmaya yer yok.'],
        ['Doktor için rapor', 'Kayıtların tek dokunuşla PDF olur.'],
        ['Ağlama çevirmeni', 'Bebeğinin ağlamasının olası nedenleri.'],
        ['Kişiye özel masallar', 'Bebeğinin adıyla uyku öncesi masallar.'],
        ['Beyaz gürültü', 'Huzurlu uyku için ses kütüphanesi.'],
        ['Bebek fotoğraf çekimi', 'Ay ay anı fotoğrafları.'],
        ['Ebeveynlik ve ek gıda rehberi', 'Her yaş için adım adım.'],
      ],
      faq_h: 'Sorular',
      faq: [
        ['İndirim ne zaman bitiyor?', '11 Kasım’da, Bakü saatiyle 23:59’da (UTC+4). Kampanya süresince abone olursan indirimli fiyat, iptal edene kadar her yenilemede geçerli kalır.'],
        ['Fiyat neden dolarla gösteriliyor?', 'Ödeme ABD doları ile alınır. Kartın başka bir para birimindeyse bankan tutarı kendi kuruyla çevirir.'],
        ['Otomatik yenileniyor mu?', 'Evet. Yıllık abonelik her yıl aynı kampanya fiyatıyla otomatik yenilenir. Her ödemede Dodo Payments sana e-postayla makbuz gönderir.'],
        ['Nasıl iptal edebilirim?', 'İstediğin zaman, Dodo Payments’tan gelen e-postadaki abonelik bağlantısıyla. Yeni ödeme alınmaz, Premium ödenen sürenin sonuna kadar açık kalır.'],
        ['Premium uygulamada nasıl açılır?', 'Premium, bu sayfada giriş yaptığın Anacan hesabına bağlanır. Uygulamaya aynı hesapla (Google, Apple veya e-posta) giriş yap, Premium otomatik açılır.'],
        ['Ödeme güvenli mi?', 'Ödemeyi satıcı kaydı (Merchant of Record) olan Dodo Payments alır. Kart bilgilerini Dodo’nun güvenli ödeme sayfasında girersin; Anacan kart numaranı görmez.'],
      ],
      stores_label: 'Anacan uygulamasını indir', ios: ['App Store’dan', 'İndir'], android: ['Google Play’den', 'İndir'],
      terms: 'Kullanım Koşulları', privacy: 'Gizlilik Politikası',
      sticky_price: 'Kazı, aç', sticky_sub: '11.11 · yalnızca bugün', sticky_btn: 'Kartı kazı', sticky_btn2: 'Abone ol',
      yearly: 'Yıllık Premium', sub_small: '12 ay · ayda ≈ {m} · her yıl bu fiyatla yenilenir',
      code_title: 'İndirim kodun', copy: 'Kopyala', copied: 'Kopyalandı!', code_hint: '$11.11 fiyatı ödeme sayfasında otomatik uygulanır. Uygulanmazsa 1111 kodunu gir.',
      email_label: 'Anacan hesabının e-postası', email_ph: 'ornek@eposta.com',
      email_hint: 'Premium’un uygulamada açılması için Anacan’a giriş yaptığın e-postayı (Google, Apple veya e-posta) kullan',
      consent: '<a href="https://anacan.az/terms" target="_blank" rel="noopener">Koşulları</a> ve yıllık otomatik yenilemeyi kabul ediyorum; istediğim zaman iptal edebilirim',
      subscribe: 'Abone ol · {p}', dodo_note: 'Güvenli ödeme: Dodo Payments (Merchant of Record). Ülkene göre vergi eklenebilir.',
      starts_soon: '11.11 çok yakında başlıyor', ended_btn: 'Kampanya sona erdi',
      prestart_wait: 'Kampanya 11 Kasım saat 00:00’da (Bakü saati, UTC+4) başlıyor. Düğme o zaman açılacak.',
      ended_text: '11.11 kampanyası sona erdi. Premium’u uygulamadan alabilirsin.', open_app: 'Uygulamayı aç',
      login_title: 'İndirimi almak için giriş yap', login_sub: 'Anacan hesabınla giriş yap: uygulamadaki aynı hesap. Premium bu hesaba bağlanacak.',
      signed_as: 'Premium {e} hesabına bağlanacak',
      has_title: 'Premium’un zaten aktif', has_text: 'Bu hesapta Premium zaten açık, yeni bir aboneliğe gerek yok.',
      wait_title: 'Ödeme kontrol ediliyor…', wait_text: 'Bu genelde birkaç saniye sürer.',
      ok_title: 'Premium aktif!', ok_text: 'Yıllık aboneliğin başladı. Uygulamaya aynı hesapla giriş yap, Premium otomatik açılır.',
      late_title: 'Ödeme henüz onaylanmadı', late_text: 'Onay normalden uzun sürüyor. Ödeme alındıysa Premium birkaç dakika içinde bu hesapta otomatik açılır. Dodo Payments e-postana makbuz da gönderir.',
      err_login: 'Oturumun sona erdi. Lütfen tekrar giriş yap.', err_has: 'Bu hesapta zaten aktif bir web aboneliği var.',
      err_email: 'Geçerli bir e-posta gir.', err_rate: 'Çok fazla deneme yapıldı. Bir dakika sonra tekrar dene.',
      err_generic: 'Ödeme sayfası açılamadı. Biraz sonra tekrar dene.',
    },
    kk: {
      title: 'Anacan Premium · 11.11', desc: '11.11: тек бүгін жылдық Anacan Premium $11.11. Картаны қырып, жеңілдігіңді өзің аш.',
      lang_label: 'Тіл', live_today: 'Тек бүгін · 11 қараша', live_soon: 'Жақында · 11 қараша', live_ended: 'Акция аяқталды',
      hero_title: 'Қыр да, <em>жеңілдігіңді</em> өзің аш.',
      hero_lead: 'Anacan Premium-ның барлық мүмкіндіктері, жарнамасыз. Картаны саусағыңмен қыр: астында бүгінгі арнайы баға тұр.',
      ended_title: '11.11 акциясы аяқталды.', ended_lead: 'Келесі жеңілдіктерді жіберіп алмау үшін Anacan қолданбасында хабарландыруларды қос.',
      t_end: 'Акцияның аяқталуына', t_start: 'Акцияның басталуына', units: ['күн', 'сағ', 'мин', 'сек'],
      hint_soon: '11.11 жақында басталады.', hint_ended: 'Акция аяқталды.', hint_urgent: 'Соңғы сағат! Жеңілдік жақында бітеді.',
      tag: 'Жылдық Premium', only_today: 'тек бүгін', per_line: 'айына ≈ {m} · күніне небәрі {c} цент',
      foil_label: 'Қыратын карта: ашу үшін саусағыңмен қыр немесе «Бірден ашу» түймесін бас', foil_text: 'Саусағыңмен қыр',
      scratch_hint: 'Саусағыңмен қыр', reveal_btn: 'Бірден ашу', revealed_hint: 'Жеңілдік ашылды: жылдық Premium {p}',
      reasons_h: 'Premium алудың 11 себебі', reasons_sub: 'Айналдырған сайын бірінен соң бірі жанады.', reasons_word: 'себеп',
      reasons: [
        ['Anacan AI, түнгі сағат 3-те де', 'Сұрақтарыңа сабырлы әрі түсінікті жауап.'],
        ['Серіктес режимі', 'Жұбайың да қасыңда: ортақ жазбалар мен тізімдер.'],
        ['30+ құралдың бәрі ашық', 'Ұйқы болжамы, қосымша тамақ, тебу мен толғақ санағышы.'],
        ['Жарнамасыз', 'Тек сен және сәбиің.'],
        ['Ақылды еске салғыштар', 'Тамақтандыру, ұйқы, екпе: ештеңе ұмытылмайды.'],
        ['Дәрігерге арналған есеп', 'Жазбаларың бір түртумен PDF болады.'],
        ['Жылау аудармашысы', 'Сәбидің жылауының ықтимал себептері.'],
        ['Жеке ертегілер', 'Сәбидің атымен ұйқы алдындағы ертегі.'],
        ['Ақ шу', 'Тыныш ұйқыға арналған дыбыстар кітапханасы.'],
        ['Сәби фотосессиясы', 'Ай сайынғы естелік суреттер.'],
        ['Тәрбие және қосымша тамақ нұсқаулығы', 'Әр жасқа арналған қадамма-қадам кеңес.'],
      ],
      faq_h: 'Сұрақтар',
      faq: [
        ['Жеңілдік қашан аяқталады?', '11 қарашада, Баку уақытымен 23:59-да (UTC+4). Акция кезінде жазылсаң, жеңілдікті баға жазылымды тоқтатқанша әр жаңаруда сақталады.'],
        ['Баға неге долларда көрсетілген?', 'Төлем АҚШ долларымен алынады. Картаң басқа валютада болса, банкің соманы өз бағамымен айырбастайды.'],
        ['Жазылым автоматты түрде жаңара ма?', 'Иә. Жылдық жазылым жыл сайын сол акциялық бағамен автоматты түрде жаңарады. Әр төлем туралы Dodo Payments e-mail арқылы түбіртек жібереді.'],
        ['Жазылымды қалай тоқтатамын?', 'Кез келген уақытта, Dodo Payments хатындағы жазылым сілтемесі арқылы. Жаңа төлем алынбайды, Premium төленген мерзімнің соңына дейін ашық қалады.'],
        ['Premium қолданбада қалай ашылады?', 'Premium осы бетте кірген Anacan аккаунтыңа байланады. Қолданбаға сол аккаунтпен (Google, Apple немесе e-mail) кір, Premium автоматты түрде ашылады.'],
        ['Төлем қауіпсіз бе?', 'Төлемді Merchant of Record ретінде Dodo Payments қабылдайды. Карта деректерін Dodo-ның қауіпсіз төлем бетінде енгізесің; Anacan карта нөміріңді көрмейді.'],
      ],
      stores_label: 'Anacan қолданбасын жүктеу', ios: ['App Store-дан', 'Жүктеу'], android: ['Google Play-ден', 'Жүктеу'],
      terms: 'Пайдалану шарттары', privacy: 'Құпиялылық саясаты',
      sticky_price: 'Қыр да аш', sticky_sub: '11.11 · тек бүгін', sticky_btn: 'Картаны қыру', sticky_btn2: 'Жазылу',
      yearly: 'Жылдық Premium', sub_small: '12 ай · айына ≈ {m} · жыл сайын осы бағамен жаңарады',
      code_title: 'Жеңілдік кодың', copy: 'Көшіру', copied: 'Көшірілді!', code_hint: '$11.11 бағасы төлем бетінде автоматты түрде қолданылады. Қолданылмаса, 1111 кодын енгізіңіз.',
      email_label: 'Anacan аккаунтыңның e-mail-ы', email_ph: 'name@example.com',
      email_hint: 'Premium қолданбада ашылуы үшін Anacan-ға кіретін e-mail-ды (Google, Apple немесе e-mail) пайдалан',
      consent: '<a href="https://anacan.az/terms" target="_blank" rel="noopener">Шарттармен</a> және жыл сайынғы автоматты жаңарумен келісемін; кез келген уақытта тоқтата аламын',
      subscribe: 'Жазылу · {p}', dodo_note: 'Қауіпсіз төлем: Dodo Payments (Merchant of Record). Еліңе қарай салық қосылуы мүмкін.',
      starts_soon: '11.11 жақында басталады', ended_btn: 'Акция аяқталды',
      prestart_wait: 'Акция 11 қарашада сағат 00:00-де (Баку уақыты, UTC+4) басталады. Түйме сонда ашылады.',
      ended_text: '11.11 акциясы аяқталды. Premium-ды қолданбадан алуға болады.', open_app: 'Қолданбаны ашу',
      login_title: 'Жеңілдікті алу үшін кір', login_sub: 'Anacan аккаунтыңмен кір: қолданбадағы сол аккаунт. Premium осы аккаунтқа байланады.',
      signed_as: 'Premium {e} аккаунтына байланады',
      has_title: 'Premium әлдеқашан қосулы', has_text: 'Бұл аккаунтта Premium қосулы, жаңа жазылым қажет емес.',
      wait_title: 'Төлем тексерілуде…', wait_text: 'Бұл әдетте бірнеше секунд алады.',
      ok_title: 'Premium қосылды!', ok_text: 'Жылдық жазылым басталды. Қолданбаға сол аккаунтпен кір, Premium автоматты түрде ашылады.',
      late_title: 'Төлем әлі расталмады', late_text: 'Растау әдеттегіден ұзаққа созылып жатыр. Төлем алынса, Premium бірнеше минут ішінде осы аккаунтта автоматты түрде ашылады. Dodo Payments поштаңа түбіртек те жібереді.',
      err_login: 'Сессия аяқталды. Қайта кір.', err_has: 'Бұл аккаунтта белсенді веб-жазылым бар.',
      err_email: 'Дұрыс e-mail енгіз.', err_rate: 'Тым көп әрекет жасалды. Бір минуттан соң қайталап көр.',
      err_generic: 'Төлем беті ашылмады. Біраздан соң қайталап көр.',
    },
    uz: {
      title: 'Anacan Premium · 11.11', desc: '11.11: faqat bugun yillik Anacan Premium $11.11. Kartani qirib, chegirmangizni o‘zingiz oching.',
      lang_label: 'Til', live_today: 'Faqat bugun · 11-noyabr', live_soon: 'Tez orada · 11-noyabr', live_ended: 'Aksiya tugadi',
      hero_title: 'Qiring va <em>chegirmangizni</em> o‘zingiz oching.',
      hero_lead: 'Anacan Premium’ning barcha imkoniyatlari, reklamasiz. Kartani barmog‘ingiz bilan qiring: ostida bugungi maxsus narx bor.',
      ended_title: '11.11 aksiyasi tugadi.', ended_lead: 'Keyingi chegirmalarni o‘tkazib yubormaslik uchun Anacan ilovasida bildirishnomalarni yoqing.',
      t_end: 'Aksiya tugashiga', t_start: 'Aksiya boshlanishiga', units: ['kun', 'soat', 'daq', 'son'],
      hint_soon: '11.11 tez orada boshlanadi.', hint_ended: 'Aksiya tugadi.', hint_urgent: 'Oxirgi soat! Chegirma tez orada tugaydi.',
      tag: 'Yillik Premium', only_today: 'faqat bugun', per_line: 'oyiga ≈ {m} · kuniga atigi {c} sent',
      foil_label: 'Qiriladigan karta: ochish uchun barmog‘ingiz bilan qiring yoki “Darhol ochish” tugmasini bosing', foil_text: 'Barmog‘ingiz bilan qiring',
      scratch_hint: 'Barmog‘ingiz bilan qiring', reveal_btn: 'Darhol ochish', revealed_hint: 'Chegirma ochildi: yillik Premium {p}',
      reasons_h: 'Premium uchun 11 sabab', reasons_sub: 'Sahifani aylantirganingiz sari birma-bir yonadi.', reasons_word: 'sabab',
      reasons: [
        ['Anacan AI, tungi soat 3 da ham', 'Savollaringizga xotirjam va aniq javob.'],
        ['Hamkor rejimi', 'Turmush o‘rtog‘ingiz ham yoningizda: umumiy qaydlar va ro‘yxatlar.'],
        ['30+ vositaning barchasi ochiq', 'Uyqu prognozi, qo‘shimcha ovqat, tepish va to‘lg‘oq hisoblagichi.'],
        ['Reklamasiz', 'Faqat siz va chaqalog‘ingiz.'],
        ['Aqlli eslatmalar', 'Ovqatlantirish, uyqu, emlash: hech narsa esdan chiqmaydi.'],
        ['Shifokor uchun hisobot', 'Qaydlaringiz bir bosishda PDF bo‘ladi.'],
        ['Yig‘i tarjimoni', 'Chaqaloq yig‘isining ehtimoliy sabablari.'],
        ['Shaxsiy ertaklar', 'Chaqalog‘ingiz ismi bilan uxlash oldidan ertak.'],
        ['Oq shovqin', 'Tinch uyqu uchun tovushlar kutubxonasi.'],
        ['Chaqaloq fotosessiyasi', 'Oyma-oy xotira suratlari.'],
        ['Tarbiya va qo‘shimcha ovqat qo‘llanmasi', 'Har bir yosh uchun qadamma-qadam.'],
      ],
      faq_h: 'Savollar',
      faq: [
        ['Chegirma qachon tugaydi?', '11-noyabr, Boku vaqti bilan 23:59 da (UTC+4). Aksiya davomida obuna bo‘lsangiz, chegirmali narx obunani bekor qilguningizcha har bir yangilanishda saqlanadi.'],
        ['Nega narx dollarda ko‘rsatilgan?', 'To‘lov AQSh dollarida olinadi. Kartangiz boshqa valyutada bo‘lsa, bankingiz summani o‘z kursi bo‘yicha konvertatsiya qiladi.'],
        ['Obuna avtomatik yangilanadimi?', 'Ha. Yillik obuna har yili aynan shu aksiya narxida avtomatik yangilanadi. Har bir to‘lov uchun Dodo Payments e-pochtangizga chek yuboradi.'],
        ['Qanday bekor qilaman?', 'Istalgan vaqtda, Dodo Payments xatidagi obuna havolasi orqali. Yangi to‘lov olinmaydi, Premium to‘langan muddat oxirigacha ochiq qoladi.'],
        ['Premium ilovada qanday ochiladi?', 'Premium shu sahifada kirgan Anacan hisobingizga bog‘lanadi. Ilovaga o‘sha hisob bilan (Google, Apple yoki e-pochta) kiring, Premium avtomatik ochiladi.'],
        ['To‘lov xavfsizmi?', 'To‘lovni Merchant of Record sifatida Dodo Payments qabul qiladi. Karta ma’lumotlarini Dodo’ning xavfsiz to‘lov sahifasida kiritasiz; Anacan karta raqamingizni ko‘rmaydi.'],
      ],
      stores_label: 'Anacan ilovasini yuklab oling', ios: ['App Store’dan', 'Yuklab olish'], android: ['Google Play’dan', 'Yuklab olish'],
      terms: 'Foydalanish shartlari', privacy: 'Maxfiylik siyosati',
      sticky_price: 'Qiring, oching', sticky_sub: '11.11 · faqat bugun', sticky_btn: 'Kartani qirish', sticky_btn2: 'Obuna bo‘lish',
      yearly: 'Yillik Premium', sub_small: '12 oy · oyiga ≈ {m} · har yili shu narxda yangilanadi',
      code_title: 'Chegirma kodingiz', copy: 'Nusxalash', copied: 'Nusxalandi!', code_hint: '$11.11 narxi to‘lov sahifasida avtomatik qo‘llanadi. Qo‘llanmasa, 1111 kodini kiriting.',
      email_label: 'Anacan hisobingiz e-pochtasi', email_ph: 'siz@example.com',
      email_hint: 'Premium ilovada ochilishi uchun Anacan’ga kiradigan e-pochtangizdan (Google, Apple yoki e-pochta) foydalaning',
      consent: '<a href="https://anacan.az/terms" target="_blank" rel="noopener">Shartlar</a> va yillik avtomatik yangilanishga roziman; istalgan vaqtda bekor qila olaman',
      subscribe: 'Obuna bo‘lish · {p}', dodo_note: 'Xavfsiz to‘lov: Dodo Payments (Merchant of Record). Mamlakatingizga qarab soliq qo‘shilishi mumkin.',
      starts_soon: '11.11 tez orada boshlanadi', ended_btn: 'Aksiya tugadi',
      prestart_wait: 'Aksiya 11-noyabr soat 00:00 da (Boku vaqti, UTC+4) boshlanadi. Tugma o‘shanda ochiladi.',
      ended_text: '11.11 aksiyasi tugadi. Premium’ni ilovadan olishingiz mumkin.', open_app: 'Ilovani ochish',
      login_title: 'Chegirmani olish uchun kiring', login_sub: 'Anacan hisobingiz bilan kiring: ilovadagi o‘sha hisob. Premium shu hisobga bog‘lanadi.',
      signed_as: 'Premium {e} hisobiga bog‘lanadi',
      has_title: 'Premium allaqachon faol', has_text: 'Bu hisobda Premium allaqachon ochiq, yangi obuna kerak emas.',
      wait_title: 'To‘lov tekshirilmoqda…', wait_text: 'Bu odatda bir necha soniya davom etadi.',
      ok_title: 'Premium faol!', ok_text: 'Yillik obunangiz boshlandi. Ilovaga o‘sha hisob bilan kiring, Premium avtomatik ochiladi.',
      late_title: 'To‘lov hali tasdiqlanmadi', late_text: 'Tasdiqlash odatdagidan uzoqroq davom etmoqda. To‘lov olingan bo‘lsa, Premium bir necha daqiqada shu hisobda avtomatik ochiladi. Dodo Payments pochtangizga kvitansiya ham yuboradi.',
      err_login: 'Sessiya tugadi. Qayta kiring.', err_has: 'Bu hisobda faol veb-obuna allaqachon bor.',
      err_email: 'To‘g‘ri e-pochta manzilini kiriting.', err_rate: 'Juda ko‘p urinish bo‘ldi. Bir daqiqadan so‘ng qayta urinib ko‘ring.',
      err_generic: 'To‘lov sahifasi ochilmadi. Birozdan so‘ng qayta urinib ko‘ring.',
    },
  };
  var LANG = I18N[window.ANACAN_1111_LANG] ? window.ANACAN_1111_LANG : 'az'; // picked in the <head> (?lang, then browser)
  var FOREIGN = LANG !== 'az';
  var t = FOREIGN ? I18N[LANG] : null;
  function fmt(str, vars) { return String(str).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; }); }
  function escH(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  (function langSwitcher() {
    [].forEach.call(document.querySelectorAll('#langs a'), function (a) {
      var code = a.getAttribute('hreflang');
      if (code === LANG) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var q = new URLSearchParams(location.search); q.set('lang', code);
        location.href = location.pathname + '?' + q.toString() + location.hash;
      });
    });
  })();
  /** Static copy for en/tr/kk/uz (the HTML holds the Azerbaijani text). */
  function applyForeignCopy() {
    document.documentElement.lang = LANG;
    document.title = t.title;
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', t.desc);
    $('langs').setAttribute('aria-label', t.lang_label);
    $('liveText').textContent = t.live_today;
    $('heroTitle').innerHTML = t.hero_title;
    $('heroLead').textContent = t.hero_lead;
    $('timerLabel').textContent = t.t_end;
    [].forEach.call(document.querySelectorAll('.cd-box span'), function (el, i) { el.textContent = t.units[i]; });
    document.querySelector('.prize .tag').textContent = t.tag;
    $('foil').setAttribute('aria-label', t.foil_label);
    $('scratchHint').innerHTML = escH(t.scratch_hint) + ' · <span id="pct">0</span>%';
    $('reveal').textContent = t.reveal_btn;
    $('r-h').textContent = t.reasons_h;
    document.querySelector('#r-h + p').textContent = t.reasons_sub;
    [].forEach.call(document.querySelectorAll('#reasons li'), function (li, i) {
      li.querySelector('h3').textContent = t.reasons[i][0]; li.querySelector('p').textContent = t.reasons[i][1];
    });
    document.querySelector('.progress > span:last-child').textContent = t.reasons_word;
    $('f-h').textContent = t.faq_h;
    [].forEach.call(document.querySelectorAll('details'), function (d, i) {
      d.querySelector('summary').textContent = t.faq[i][0]; d.querySelector('p').textContent = t.faq[i][1];
    });
    document.querySelector('.stores').setAttribute('aria-label', t.stores_label);
    $('storeIos').querySelector('span').innerHTML = '<small>' + escH(t.ios[0]) + '</small>' + escH(t.ios[1]);
    $('storeAndroid').querySelector('span').innerHTML = '<small>' + escH(t.android[0]) + '</small>' + escH(t.android[1]);
    $('foot').innerHTML = '© 2026 Anacan · anacan.az · <a href="https://anacan.az/terms" target="_blank" rel="noopener">' + escH(t.terms) +
      '</a> · <a href="https://anacan.az/privacy" target="_blank" rel="noopener">' + escH(t.privacy) + '</a>';
    $('sPrice').textContent = t.sticky_price; $('sSub').textContent = t.sticky_sub; $('sBtn').textContent = t.sticky_btn;
  }
  if (FOREIGN) applyForeignCopy();
  var card = $('plans');
  var params = new URLSearchParams(location.search);
  var payment = params.get('odenis'); // 'ugurlu' | 'xeta' (redirect back from the bank page; never proof of payment)
  if (payment) { params.delete('odenis'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }
  var CABINET = '/website/premium/hesab/index.html';
  var PLAN = 'yearly';
  var status = null;
  var generation = 0;
  var signedIn = false;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var USD_RATE = 1.70; // display only
  function usdValue(azn) { var n = Number(azn); return isFinite(n) ? Math.round(n / USD_RATE * 100) / 100 : NaN; }
  function usd(azn) { var v = usdValue(azn); return isFinite(v) ? '$' + v.toFixed(2) : ''; }
  function usdPerMonth(azn) { var v = usdValue(azn); return isFinite(v) ? '$' + (Math.round(v / 12 * 100) / 100).toFixed(2) : ''; }
  function centsPerDay(azn) { var v = usdValue(azn); return isFinite(v) ? Math.max(1, Math.round(v / 365 * 100)) : NaN; }

  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>';
  var ICON_WAIT = '<span class="spinner" style="width:26px;height:26px"></span>';

  // Display fallback before the server status is loaded (the page is public; prices need a session).
  var FALLBACK = { price: 18.89, was: 50.98, pct: 63 };
  function yearly() { var p = status && status.campaign && status.campaign.plans; return (p && p.yearly) || null; }
  function shownPlan() { return yearly() || FALLBACK; }

  // ── Campaign window known without login (the page is public). ──────────────────────────
  var CAMPAIGN_STARTS_AT = Date.parse(document.body.getAttribute('data-campaign-starts') || '');
  var CAMPAIGN_ENDS_AT = Date.parse(document.body.getAttribute('data-campaign-ends') || '');
  var ended = isFinite(CAMPAIGN_ENDS_AT) && Date.now() >= CAMPAIGN_ENDS_AT;
  function notStarted() { return isFinite(CAMPAIGN_STARTS_AT) && Date.now() < CAMPAIGN_STARTS_AT; }

  // ── Panel under the scratch card ──────────────────────────────────────────────────────
  // 'gate': shown only after the card is revealed (plans, login, pre-start, retry).
  // 'state': no card to scratch (Premium active, payment result, campaign over): shown at once, card hidden.
  var panelMode = 'gate';
  var revealed = false;
  function setPanel(mode) {
    panelMode = mode;
    document.body.classList.toggle('no-scratch', mode === 'state');
    card.hidden = !(mode === 'state' || revealed);
  }

  function endedHero() {
    document.body.classList.add('campaign-ended');
    $('liveText').textContent = FOREIGN ? t.live_ended : 'Kampaniya bitdi';
    $('heroTitle').textContent = FOREIGN ? t.ended_title : '11.11 kampaniyası bitdi.';
    $('heroLead').textContent = FOREIGN ? t.ended_lead : 'Növbəti endirimlər üçün Anacan tətbiqini izlə və bildirişləri aç.';
    $('timer').hidden = true;
  }
  function endedCard(text) {
    renderState(ICON_INFO, 'Kampaniya bitdi', text || '11.11 kampaniyası artıq bitib. Premium-u tətbiqdən ala bilərsən. Növbəti endirimləri qaçırmamaq üçün tətbiqdə bildirişləri aç.',
      '<a class="cta" href="/website/premium/app/index.html?src=campaign_ended">Tətbiqi aç <span class="arr">→</span></a>' +
      '<a class="btn" href="' + CABINET + '">Premium hesabım</a>', true);
  }
  function showEnded() { endedHero(); endedCard(); }

  // ── Countdown: to the start before 11.11, then to the end (server ends_at once loaded). ───
  var target = isFinite(CAMPAIGN_ENDS_AT) ? CAMPAIGN_ENDS_AT : Date.now();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var wasPre = notStarted();
  function tick() {
    var pre = notStarted();
    var over = document.body.classList.contains('campaign-ended');
    var to = pre ? CAMPAIGN_STARTS_AT : target;
    $('timerLabel').textContent = FOREIGN ? (pre ? t.t_start : t.t_end) : pre ? 'Kampaniya başlayanadək' : 'Kampaniya bitənədək';
    if (pre) $('liveText').textContent = FOREIGN ? t.live_soon : 'Tezliklə · 11 noyabr';
    else if (!over) $('liveText').textContent = FOREIGN ? t.live_today : 'Yalnız bu gün · 11 noyabr';
    var ms = Math.max(0, to - Date.now());
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    $('tD').textContent = d; $('tDBox').hidden = d === 0; s %= 86400;
    $('tH').textContent = pad(Math.floor(s / 3600)); s %= 3600;
    $('tM').textContent = pad(Math.floor(s / 60)); $('tS').textContent = pad(s % 60);
    var urgent = !pre && !over && ms > 0 && ms < 3600000;
    $('timer').classList.toggle('urgent', urgent);
    $('cdHint').textContent = FOREIGN ? (pre ? t.hint_soon : over || ms === 0 ? t.hint_ended : urgent ? t.hint_urgent : '')
      : pre ? '11.11 tezliklə başlayır.' : over || ms === 0 ? 'Kampaniya bitdi.' : urgent ? 'Son saat! Endirim tezliklə bitir.' : '';
    if (FOREIGN) { if (fPhase && phase() !== fPhase) renderForeign(); return; } // client-side only: no account, no status call
    if (wasPre && !pre) { wasPre = false; if (signedIn && !over) load(); }
    if (!pre && !over && Date.now() >= target && status && !(status.premium && status.premium.active)) {
      endedHero(); endedCard();
    }
  }
  tick(); setInterval(tick, 1000);

  // ── Prices on the scratch prize, the subscribe row and the sticky bar ─────────────────
  function pctText(p) { return p && p.pct ? '−' + p.pct + '%' : ''; }
  function updatePrices() {
    var y = shownPlan();
    $('prizePrice').textContent = usd(y.price);
    $('prizeWas').textContent = y.was ? usd(y.was) : ''; $('prizeWas').hidden = !y.was;
    $('prizeOff').textContent = (pctText(y) ? pctText(y) + ' · ' : '') + (FOREIGN ? t.only_today : 'yalnız bu gün');
    var c = centsPerDay(y.price);
    $('prizeSub').textContent = FOREIGN ? fmt(t.per_line, { m: usdPerMonth(y.price), c: c })
      : 'ayda ≈ ' + usdPerMonth(y.price) + (isFinite(c) ? ' · gündə cəmi ' + c + ' sent' : '');
    if (revealed) {
      $('sPrice').textContent = usd(y.price);
      $('sWas').textContent = y.was ? usd(y.was) : '';
      $('sSub').textContent = (FOREIGN ? t.yearly : 'İllik Premium') + (pctText(y) ? ' · ' + pctText(y) : '');
      $('scratchHint').textContent = FOREIGN ? fmt(t.revealed_hint, { p: usd(y.price) }) : 'Endirim açıldı: illik Premium ' + usd(y.price);
    }
    var yy = yearly();
    if (yy && status.campaign.ends_at && isFinite(Date.parse(status.campaign.ends_at))) target = Date.parse(status.campaign.ends_at);
  }

  /** No selling (sticky bar) once the account has Premium or the campaign is over. */
  function selling(on) { document.body.classList.toggle('no-sell', !on); }
  function renderState(icon, title, text, actionsHtml, soft, gate) {
    if (!gate) selling(false);
    card.innerHTML = '<div class="state"><div class="big' + (soft ? ' soft' : '') + '">' + icon + '</div><h2>' + A.esc(title) + '</h2>' +
      '<p>' + text + '</p>' + (actionsHtml || '') + '</div>';
    setPanel(gate ? 'gate' : 'state');
  }

  function storeName(store) {
    return store === 'app_store' || store === 'mac_app_store' ? 'App Store' : store === 'play_store' ? 'Google Play' : 'tətbiq mağazası';
  }

  function renderPremium(premium) {
    var until = premium.expires_at ? A.day(premium.expires_at) : '';
    if (premium.source === 'web_subscription') {
      var sub = status.subscription;
      var line = sub && sub.status === 'cancelled' ? 'Abunəlik ləğv edilib; Premium ' + until + ' tarixinə qədər açıqdır.'
        : 'Növbəti ödəniş ' + A.day(sub && sub.next_charge_at || premium.expires_at) + (sub ? ' · ' + A.money(sub.next_price || sub.price) : '') + '.';
      renderState(ICON_OK, 'Premium abunəliyin aktivdir', A.esc((sub && sub.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' plan. ' + line),
        '<a class="cta" href="/website/premium/app/index.html?src=web_active">Tətbiqi aç <span class="arr">→</span></a>' +
        '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
    } else if (premium.source === 'store') {
      renderState(ICON_OK, 'Premium-un artıq aktivdir', A.esc('Premium ' + storeName(premium.store) + ' abunəliyi ilə açıqdır' + (until ? ' (' + until + ' tarixinə qədər)' : '') +
        '. Bu abunəlik mağazada idarə olunur, ona görə burada yeni abunəlik lazım deyil.'), '');
    } else {
      renderState(ICON_OK, 'Premium-un artıq aktivdir', A.esc('Premium ' + (until ? until + ' tarixinə qədər ' : '') + 'açıqdır. Müddət bitəndə burada abunə ola bilərsən.'),
        '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
    }
  }

  function subRowHtml(y) {
    return '<div class="sub-row"><div><b>İllik Premium</b><small>12 ay · ayda ≈ ' + usdPerMonth(y.price) + ' · hər il bu qiymətlə yenilənir</small></div>' +
      '<div class="sub-price">' + (y.was ? '<s>' + usd(y.was) + '</s>' : '') + usd(y.price) + '</div></div>';
  }
  function aznNote(y) { return '<p class="note">Ödəniş Azərbaycan manatı ilə alınır: <b>' + A.esc(A.money(y.price)) + '</b></p>'; }
  var FINE = '<p class="fine">Avtomatik yenilənir, istədiyin vaxt ləğv edə bilərsən. Endirimli qiymət ləğv edənə qədər hər yenilənmədə qorunur. Kartla, manatla (Epoint). Dollar qiymətləri məlumat üçündür (1 USD = 1,70 ₼). <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a></p>';

  function renderPlans(message) {
    selling(true);
    var y = yearly();
    var ready = !!status.payments_ready;
    card.innerHTML =
      (message ? '<p class="msg err" role="alert">' + A.esc(message) + '</p>' : '') +
      subRowHtml(y) +
      (ready ? consentHtml('consent') : '') +
      '<button class="pbtn btn-full" type="button" id="cta"' + (ready ? '' : ' disabled') + '>' +
      (ready ? 'Abunə ol · ' + A.esc(usd(y.price)) : 'Ödəniş sistemi hələ aktiv deyil') + '</button>' +
      aznNote(y) + FINE +
      (status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    setPanel('gate');
    var cta = $('cta');
    if (cta && ready) { cta.addEventListener('click', function () { subscribe(false); }); bindConsent('consent', cta); }
    appendTest();
  }

  /** Logged in before 11.11 starts: the offer is visible, the button opens at the start. */
  function renderPrestart() {
    selling(true);
    var y = shownPlan();
    card.innerHTML = subRowHtml(y) +
      '<button class="pbtn btn-full" type="button" id="cta" disabled>11.11 tezliklə başlayır</button>' +
      '<p class="sub-wait">Kampaniya 11 noyabr saat 00:00-da (Bakı vaxtı) başlayır. Abunə düyməsi o zaman açılacaq.</p>' +
      aznNote(y) + (status && status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    setPanel('gate');
    appendTest();
  }

  /** The bank page has no "save card" switch: the card is registered by the payment itself, so ask for consent here. */
  function consentHtml(id) {
    return '<label class="consent"><input type="checkbox" id="' + id + '">' +
      '<span>Kartımın avtomatik yenilənmə üçün Epoint-də təhlükəsiz <b>yadda saxlanmasına</b> razıyam. Kartı “Premium hesabım” səhifəsində istədiyim vaxt silə bilərəm.</span></label>' +
      '<p class="bank-note">Növbəti addım Paşa Bank-ın ödəniş səhifəsidir. Orada ayrıca “kartı yadda saxla” seçimi olmur: kart bu ödənişlə birlikdə saxlanılır. Anacan yalnız maskalı nömrəni (•••• 1234) görür.</p>';
  }
  function bindConsent(id, button) {
    var box = $(id);
    if (!box || !button) return;
    var sync = function () { button.disabled = !box.checked; };
    box.addEventListener('change', sync); sync();
  }

  /** Admin-only tiny-price offer for real card tests (the server returns test_offer only for admins). */
  function appendTest() {
    var t = status && status.test_offer;
    if (!t || !status.payments_ready || (status.premium && status.premium.source === 'web_subscription')) return;
    var box = document.createElement('div');
    box.className = 'testbox';
    box.innerHTML = '<b>Admin test</b><span>' + (t.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' abunəlik · ' + A.money(t.price) + '</span>' +
      consentHtml('consentTest') + '<button class="btn" type="button" id="ctaTest">Test ödənişi et</button>';
    card.appendChild(box);
    var b = $('ctaTest');
    b.addEventListener('click', function () { subscribe(true); });
    bindConsent('consentTest', b);
  }

  var ERRORS = {
    premium_active: 'Premium-un artıq aktivdir.',
    already_subscribed: 'Sənin artıq abunəliyin var. “Premium hesabım” səhifəsinə bax.',
    campaign_inactive: 'Kampaniya bitib.',
    payments_unavailable: 'Ödəniş sistemi hələ aktiv deyil. Bir az sonra yenidən yoxla.',
    too_many_attempts: 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
    rate_limited: 'Çox cəhd edildi. Bir dəqiqə sonra yenidən yoxla.',
    checkout_unavailable: 'Ödəniş səhifəsi açılmadı. Bir az sonra yenidən cəhd et.',
  };

  async function subscribe(test) {
    var cta = $(test ? 'ctaTest' : 'cta');
    cta.disabled = true; cta.innerHTML = '<span class="spinner"></span>';
    try {
      var d = await A.call('subscribe', test ? { plan: status.test_offer.plan, test: true, consent: 'premium-autorenew-v1' } : { consent: 'premium-autorenew-v1', plan: PLAN });
      if (d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) {
        location.href = d.redirect_url; // Epoint / bank card page; it returns to the kampaniya page, which forwards here
        return;
      }
      if (d.error === 'premium_active' || d.error === 'already_subscribed' || d.error === 'campaign_inactive') { await load(); return; }
      failed(ERRORS[d.error] || ERRORS.checkout_unavailable);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      failed(ERRORS.checkout_unavailable);
    }
  }

  function failed(message) {
    if (yearly() && status.campaign.active && !(status.premium && status.premium.active)) renderPlans(message);
    else { A.toast(message, true); renderStatus(); }
  }

  function savedCardLine(d) {
    var cards = (d.cards || []).filter(function (c) { return c.status === 'active'; });
    var c = cards.filter(function (x) { return x.is_default; })[0] || cards[0];
    if (!c) return '';
    var digits = String(c.mask || '').replace(/[^0-9*]/g, '');
    var mask = digits.length >= 8 ? digits.slice(0, 4) + ' •••• ' + digits.slice(-4) : (c.mask || 'Bank kartı');
    return '<p class="saved-card"><span class="chip-card" aria-hidden="true"></span>Kart yadda saxlandı: <b>' + A.esc(mask) + '</b></p>';
  }

  function renderStatus() {
    $('cabinetLink').hidden = false;
    updatePrices();
    if (status.premium && status.premium.active) { renderPremium(status.premium); appendTest(); return; }
    if (!status.campaign || !status.campaign.active || !yearly()) {
      if (notStarted()) { renderPrestart(); return; }
      endedHero();
      endedCard();
      return;
    }
    renderPlans();
  }

  async function load() {
    var mine = ++generation;
    try {
      status = await A.call('status');
      if (mine !== generation) return;
      if (!status.ok) throw new Error(status.error || 'status');
      renderStatus();
    } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      loadFailed(load);
    }
  }

  /** After the bank page: wait for the signed callback to activate the subscription (up to ~1 minute). */
  async function waitForPayment() {
    var mine = ++generation;
    renderState(ICON_WAIT, 'Ödəniş yoxlanılır…', 'Bank təsdiqini gözləyirik. Bu bir neçə saniyə çəkə bilər.', '', true);
    for (var i = 0; i < 20; i++) {
      try {
        var d = await A.call('status');
        if (mine !== generation) return;
        if (d.ok && d.premium && d.premium.active && d.premium.source === 'web_subscription') {
          status = d;
          $('cabinetLink').hidden = false;
          var sub = d.subscription;
          renderState(ICON_OK, 'Premium aktivdir!', A.esc((sub && sub.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' abunəlik başladı. Tətbiqə eyni hesabla daxil ol, Premium avtomatik açılacaq.' +
            (sub && sub.next_charge_at ? ' Növbəti ödəniş: ' + A.day(sub.next_charge_at) + '.' : '')),
            savedCardLine(d) + '<a class="cta" href="/website/premium/app/index.html?src=web_success">Tətbiqi aç <span class="arr">→</span></a>' +
            '<a class="btn app-store-link" href="/website/premium/app/index.html?src=web_success_download">Tətbiqi endir</a>' +
            '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
          confetti();
          return;
        }
      } catch (e) { if (e && e.code === 'unauthorized') { await A.signOut(); return; } }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (mine !== generation) return;
    renderState(ICON_INFO, 'Ödəniş hələ təsdiqlənməyib', 'Bank cavabı gecikir. Bir neçə dəqiqə sonra “Premium hesabım” səhifəsində statusu yoxla. Pul çıxıbsa, abunəlik avtomatik aktivləşəcək.',
      '<a class="cta" href="' + CABINET + '">Premium hesabım <span class="arr">→</span></a>', true);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────────────
  async function boot() {
    var mine = ++generation;
    var s = null;
    try { s = await A.session(); } catch (e) {
      // A hung or failed session read must never leave the panel on its loading placeholder.
      if (mine !== generation) return;
      if (e && e.code === 'timeout') { loadFailed(boot); return; }
      s = null;
    }
    if (mine !== generation) return;
    signedIn = !!s;
    A.renderWho($('who'), s);
    if (!s) {
      $('cabinetLink').hidden = true;
      if (ended) { showEnded(); return; }
      selling(true);
      card.innerHTML = '';
      A.renderLogin(card, { title: 'Endirimi almaq üçün daxil ol', subtitle: 'Anacan hesabınla daxil ol: tətbiqdəki eyni hesab. Premium bu hesaba bağlanacaq.' });
      setPanel('gate');
      return;
    }
    var verify = await A.needsVerification();
    if (mine !== generation) return;
    if (verify) {
      A.renderVerify(card, s.user && s.user.email, boot);
      setPanel('gate');
      return;
    }
    if (payment === 'ugurlu') { payment = null; await waitForPayment(); return; }
    if (payment === 'xeta') { payment = null; A.toast('Ödəniş alınmadı. Kartı yoxlayıb yenidən cəhd et.', true); reveal(true); }
    if (ended) { $('cabinetLink').hidden = false; showEnded(); return; }
    await load();
  }

  /** Error state with a retry button; the first failure also retries once by itself. */
  var autoRetried = false;
  function loadFailed(retry) {
    renderState(ICON_INFO, 'Məlumat yüklənmədi', 'Bağlantını yoxlayıb yenidən cəhd et.', '<button class="btn" type="button" id="retry">Yenidən yoxla</button>', true, true);
    $('retry').addEventListener('click', function () { card.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'; retry(); });
    if (!autoRetried) { autoRetried = true; setTimeout(function () { if ($('retry')) retry(); }, 2500); }
  }

  /** Safety net: if the panel is still the placeholder (e.g. Safari froze a request while the tab was in the background), start again. */
  function stillLoading() { return !!card.querySelector('.skeleton'); }
  setTimeout(function () { if (stillLoading()) boot(); }, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && stillLoading()) boot(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && stillLoading()) boot(); });

  // ── Scratch card ──────────────────────────────────────────────────────────────────────
  var box = $('scratch'), cv = $('foil'), ctx = cv.getContext('2d');
  var pctEl = $('pct');
  var drawing = false, last = null, dpr = Math.max(1, window.devicePixelRatio || 1);
  function paintFoil() {
    var r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    var cs = getComputedStyle(document.documentElement);
    g.addColorStop(0, cs.getPropertyValue('--foil-a').trim() || '#FF7A73');
    g.addColorStop(1, cs.getPropertyValue('--foil-b').trim() || '#FF5A5F');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    // repeating "11.11" pattern
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff';
    ctx.font = '800 ' + (28 * dpr) + 'px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.rotate(-0.18);
    for (var y = -cv.height; y < cv.height * 2; y += 46 * dpr) for (var x = -cv.width; x < cv.width * 2; x += 110 * dpr) ctx.fillText('11.11', x + (Math.round(y / (46 * dpr)) % 2) * 55 * dpr, y);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '800 ' + Math.round(cv.width / 7) + 'px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillText('11.11', cv.width / 2, cv.height / 2 + cv.width / 40);
    ctx.font = '600 ' + (15 * dpr) + 'px Inter, sans-serif';
    ctx.fillText(FOREIGN ? t.foil_text : 'Barmağınla poz', cv.width / 2, cv.height / 2 + cv.width / 7.5);
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }
  function scratchAt(p) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 46 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo((last || p).x, (last || p).y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  }
  var checkT = 0;
  function measure() {
    if (!cv.width || !cv.height) return;
    var step = 12 * dpr, data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var clear = 0, total = 0;
    for (var y = 0; y < cv.height; y += step) for (var x = 0; x < cv.width; x += step) { total++; if (data[(Math.floor(y) * cv.width + Math.floor(x)) * 4 + 3] < 40) clear++; }
    if (!total) return;
    var pct = Math.round(clear / total * 100); pctEl.textContent = pct;
    if (pct >= 45) reveal();
  }
  cv.addEventListener('pointerdown', function (e) { if (revealed) return; drawing = true; last = null; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } scratchAt(pos(e)); });
  cv.addEventListener('pointermove', function (e) { if (!drawing) return; scratchAt(pos(e)); var now = Date.now(); if (now - checkT > 120) { checkT = now; measure(); } });
  var stop = function () { if (drawing) { drawing = false; measure(); } };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  $('reveal').addEventListener('click', function () { reveal(); });
  window.addEventListener('resize', function () { if (!revealed) paintFoil(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!revealed) paintFoil(); });
  paintFoil();

  /** quiet: returning from the bank page (no confetti, no scroll). */
  function reveal(quiet) {
    if (revealed) return; revealed = true;
    cv.classList.add('done'); box.classList.add('done'); pctEl.textContent = '100';
    var hadFocus = document.activeElement === $('reveal');
    $('reveal').hidden = true;
    $('sBtn').textContent = FOREIGN ? t.sticky_btn2 : 'Abunə ol'; $('sBtn').setAttribute('href', '#plans');
    updatePrices();
    if (panelMode === 'gate') card.hidden = false;
    if (quiet) return;
    if (hadFocus) { try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); } }
    setTimeout(function () { card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }); }, 350);
    confetti();
    try { window.anacanAnalytics && window.anacanAnalytics.track('scratch_reveal', { placement: 'kampaniya_1111' }); } catch (e) { /* ignore */ }
  }
  $('sBtn').addEventListener('click', function (e) {
    e.preventDefault();
    var el = revealed && !card.hidden ? card : $('scratchArea');
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  // ── 11 reasons light up as they scroll into view (resting state is fully readable). ───
  var items = [].slice.call(document.querySelectorAll('#reasons li')), bar = $('rBar'), cnt = $('rCount');
  var seen = [];
  function showSeen() { cnt.textContent = seen.length + ' / ' + items.length; bar.style.width = (seen.length / items.length * 100) + '%'; }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && en.intersectionRatio > 0.6 && seen.indexOf(en.target) < 0) { seen.push(en.target); en.target.classList.add('on'); io.unobserve(en.target); } });
      showSeen();
    }, { threshold: [0, 0.6, 1] });
    items.forEach(function (li) { io.observe(li); });
  } else { seen = items.slice(); items.forEach(function (li) { li.classList.add('on'); }); showSeen(); }

  // ── Light confetti ────────────────────────────────────────────────────────────────────
  function confetti() {
    if (reduceMotion) return;
    var c = $('conf'), g = c.getContext('2d');
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    var cols = ['#FF5A5F', '#FFB37A', '#FFD84D', '#7BC8A4', '#9C7BD8'];
    var ps = [];
    for (var i = 0; i < 90; i++) ps.push({ x: c.width / 2, y: c.height * 0.35, vx: (Math.random() - 0.5) * 14 * dpr, vy: (-Math.random() * 12 - 4) * dpr, s: (4 + Math.random() * 5) * dpr, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6 });
    var t = 0;
    (function frame() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35 * dpr; p.x += p.vx; p.y += p.vy; p.r += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); g.restore(); });
      if (++t < 110) requestAnimationFrame(frame); else g.clearRect(0, 0, c.width, c.height);
    })();
  }

  // ── Foreign checkout (en/tr/kk/uz): sign in first (same Anacan account as the app), then Dodo Payments. ──────
  // The server links the purchase to the signed-in account (no email matching); the $11.11 price is applied
  // automatically by the campaign discount (code 1111 is shown as a fallback).
  var DODO = 'https://api.anacan.az/functions/v1/dodo-checkout';
  var fPhase = null;
  var fEmailShown = '';
  var paidReturn = params.get('done') === '1'; // back from Dodo (never proof of payment)
  if (paidReturn) { params.delete('done'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }
  function phase() { return notStarted() ? 'pre' : isFinite(CAMPAIGN_ENDS_AT) && Date.now() >= CAMPAIGN_ENDS_AT ? 'over' : 'on'; }
  function appActions(src) {
    return '<a class="cta" href="/website/premium/app/index.html?src=' + src + '">' + escH(t.open_app) + ' <span class="arr">→</span></a>';
  }
  async function foreignBoot() {
    var mine = ++generation;
    if (phase() === 'over' && !paidReturn) { renderForeign(); return; }
    var s = null;
    try { s = await A.session(); } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'timeout') { foreignFailed(); return; }
      s = null;
    }
    if (mine !== generation) return;
    signedIn = !!s;
    A.renderWho($('who'), s);
    if (!s) {
      selling(phase() !== 'over');
      card.innerHTML = '';
      A.renderLogin(card, { title: t.login_title, subtitle: t.login_sub });
      setPanel('gate');
      return;
    }
    fEmailShown = (s.user && s.user.email) || '';
    var verify = await A.needsVerification();
    if (mine !== generation) return;
    if (verify) { A.renderVerify(card, s.user && s.user.email, foreignBoot); setPanel('gate'); return; }
    if (paidReturn) { paidReturn = false; await foreignWait(); return; }
    try {
      var st = await A.call('status');
      if (mine !== generation) return;
      if (st && st.ok && st.premium && st.premium.active) { renderState(ICON_OK, t.has_title, escH(t.has_text), appActions('web_active')); return; }
    } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      // Status unavailable: still let the account buy; the server refuses a second web subscription.
    }
    renderForeign();
  }
  function foreignFailed() {
    renderState(ICON_INFO, t.err_generic, '', '<button class="btn" type="button" id="retry">↻</button>', true, true);
    $('retry').addEventListener('click', function () { card.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'; foreignBoot(); });
  }
  /** Back from Dodo: wait for the signed webhook to open Premium on this account (up to ~1 minute). */
  async function foreignWait() {
    var mine = ++generation;
    renderState(ICON_WAIT, t.wait_title, escH(t.wait_text), '', true);
    for (var i = 0; i < 20; i++) {
      try {
        var d = await A.call('status');
        if (mine !== generation) return;
        if (d && d.ok && d.premium && d.premium.active) {
          renderState(ICON_OK, t.ok_title, escH(t.ok_text), appActions('web_success'));
          confetti();
          return;
        }
      } catch (e) { if (e && e.code === 'unauthorized') { await A.signOut(); return; } }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (mine !== generation) return;
    renderState(ICON_INFO, t.late_title, escH(t.late_text), appActions('web_pending'), true);
  }
  function renderForeign() {
    var ph = fPhase = phase();
    var prevConsent = $('fConsent') ? $('fConsent').checked : false;
    var y = shownPlan();
    if (ph === 'over') endedHero();
    selling(ph !== 'over');
    var row = '<div class="sub-row"><div><b>' + escH(t.yearly) + '</b><small>' + escH(fmt(t.sub_small, { m: usdPerMonth(y.price) })) + '</small></div>' +
      '<div class="sub-price"><s>' + usd(y.was) + '</s>' + usd(y.price) + '</div></div>';
    if (ph === 'over') {
      card.innerHTML = row + '<button class="pbtn btn-full" type="button" id="fPay" disabled>' + escH(t.ended_btn) + '</button>' +
        '<p class="sub-wait">' + escH(t.ended_text) + '</p>' +
        '<a class="btn f-app" href="/website/premium/app/index.html?src=campaign_ended">' + escH(t.open_app) + '</a>';
      setPanel('state');
      return;
    }
    card.innerHTML = row +
      '<div class="code-box"><span class="code-title">' + escH(t.code_title) + '</span>' +
      '<div class="code-line"><b class="code" id="fCode">1111</b><button class="code-copy" type="button" id="fCopy">' + escH(t.copy) + '</button></div>' +
      '<p class="code-hint">' + escH(t.code_hint) + '</p></div>' +
      (fEmailShown ? '<p class="f-hint">' + escH(fmt(t.signed_as, { e: fEmailShown })) + '</p>' : '') +
      '<label class="consent"><input type="checkbox" id="fConsent"><span>' + t.consent + '</span></label>' +
      '<button class="pbtn btn-full" type="button" id="fPay" disabled>' + escH(ph === 'pre' ? t.starts_soon : fmt(t.subscribe, { p: usd(y.price) })) + '</button>' +
      '<p class="msg err f-err" id="fErr" role="alert" hidden></p>' +
      (ph === 'pre' ? '<p class="sub-wait">' + escH(t.prestart_wait) + '</p>' : '') +
      '<p class="fine">' + escH(t.dodo_note) + '</p>';
    setPanel('gate');
    var consent = $('fConsent'), pay = $('fPay');
    consent.checked = prevConsent;
    var sync = function () { pay.disabled = ph !== 'on' || !consent.checked; };
    consent.addEventListener('change', sync); sync();
    pay.addEventListener('click', startDodo);
    $('fCopy').addEventListener('click', copyCode);
  }
  function copyCode() {
    var btn = $('fCopy');
    var done = function () { btn.textContent = t.copied; btn.classList.add('ok'); setTimeout(function () { if ($('fCopy') === btn) { btn.textContent = t.copy; btn.classList.remove('ok'); } }, 2000); };
    var select = function () { try { var r = document.createRange(); r.selectNodeContents($('fCode')); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) { /* ignore */ } };
    try {
      navigator.clipboard.writeText('1111').then(done, select);
    } catch (e) { select(); }
  }
  function fError(text) { var e = $('fErr'); if (e) { e.textContent = text; e.hidden = false; } }
  async function startDodo() {
    var pay = $('fPay');
    if (phase() !== 'on') { renderForeign(); return; }
    $('fErr').hidden = true;
    var label = pay.textContent;
    pay.disabled = true; pay.innerHTML = '<span class="spinner"></span>';
    var restore = function () { if ($('fPay') === pay) { pay.textContent = label; pay.disabled = !$('fConsent').checked; } };
    var s = null;
    try { s = await A.session(); } catch (e) { s = null; }
    if (!s || !s.access_token) { restore(); A.toast(t.err_login, true); foreignBoot(); return; }
    try { window.anacanAnalytics && window.anacanAnalytics.track('checkout_start', { plan: PLAN, provider: 'dodo', placement: 'kampaniya_1111', lang: LANG }); } catch (e) { /* ignore */ }
    fetch(DODO, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
      body: JSON.stringify({ plan: PLAN, email: (s.user && s.user.email) || '', language: LANG, pay_label: 'Anacan Premium 11.11', campaign: '1111' }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }, function () { return { ok: false, status: r.status, d: {} }; }); })
      .then(function (res) {
        var url = res.d && res.d.checkout_url;
        // The functions router replaces error bodies with a code per HTTP status, so read the status.
        if (!res.ok) throw res.status === 401 ? 'login_required' : res.status === 409 ? 'already_subscribed' : res.status === 429 ? 'too_many_requests' : 'checkout';
        if (typeof url !== 'string' || !/^https:\/\//.test(url)) throw 'checkout';
        location.href = url; // Dodo hosted checkout; it returns here with ?done=1
      })
      .catch(function (code) {
        restore();
        if (code === 'login_required') { A.toast(t.err_login, true); A.signOut(); return; }
        if (code === 'already_subscribed') { renderState(ICON_OK, t.has_title, escH(t.err_has), appActions('web_active')); return; }
        fError(code === 'invalid_email' ? t.err_email : code === 'too_many_requests' ? t.err_rate : t.err_generic);
      });
  }

  // ── Start ─────────────────────────────────────────────────────────────────────────────
  updatePrices();
  if (FOREIGN) {
    // Signed-in flow like the Azerbaijani page: the purchase is linked to this account on the server.
    A.setLang(LANG);
    if (phase() === 'over' && !paidReturn) renderForeign();
    else { A.onChange(function () { foreignBoot(); }); foreignBoot(); }
  } else if (ended && payment !== 'ugurlu') {
    // Ended: no login, no plans; the account chip and the cabinet link still work for subscribers.
    showEnded();
    A.session().then(function (s) { A.renderWho($('who'), s); if (s) $('cabinetLink').hidden = false; }).catch(function () {});
  } else {
    // A payment that returns after midnight still gets its confirmation (boot → waitForPayment).
    if (ended) endedHero();
    A.onChange(function () { boot(); });
    boot();
  }
})();

// Store buttons: report the click to GA4 (the page keeps working without analytics).
['storeIos', 'storeAndroid'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function () {
    try { window.anacanAnalytics && window.anacanAnalytics.track('app_store_click', { store: id === 'storeIos' ? 'app_store' : 'google_play', placement: 'kampaniya_1111_hero' }); } catch (e) { /* ignore */ }
  });
});
