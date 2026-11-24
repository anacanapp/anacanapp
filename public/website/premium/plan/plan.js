/* Personal-plan funnel (2026-11-24, owner: "Şəxsi plan quizini Mərcan Cümə ilə birləşdirək, real funnel qur").
   Quiz (stage, timing, worries, two statements, partner, daily minutes) → loader with one question → personal plan →
   Anacan account (same as the app) → paywall → payment on the existing rails:
   - Epoint (AZN, saved card, automatic renewal) for Azerbaijani and anyone in Azerbaijan. The server sells its current
     offer: the Mərcan Cümə campaign while it runs (16.99 / 3.39 AZN), the standard price after it (50.98 / 6.78 AZN).
     The bank returns to the kampaniya page, which sends this tab back here (sessionStorage 'anacan_funnel' = 'plan').
   - Dodo (USD) elsewhere: campaign codes while Mərcan runs ($9.99 / $1.99), the standard price after ($29.99 / $3.99).
     Dodo returns to the Mərcan or Premium page, which also sends this tab back here.
   Answers stay in this tab (sessionStorage) and go to analytics; nothing here is proof of payment, the status poll is. */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var LANG = window.PLAN_LANG || 'az';
  var PAY = window.PLAN_PAY || 'epoint';
  var END = Date.parse(document.body.getAttribute('data-campaign-ends') || '') || 0;
  var START = Date.parse('2026-11-23T00:00:00Z');
  var DODO = 'https://api.anacan.az/functions/v1/dodo-checkout';
  var CABINET = '/website/premium/hesab/index.html';
  var APP = '/website/premium/app/index.html';
  var CH = '/website/characters/';
  var KEY = 'anacan_plan_state';
  var PRICES = {
    AZN: { campaign: { yearly: { now: 16.99, was: 50.98 }, monthly: { now: 3.39, was: 6.78 } }, standard: { yearly: { now: 50.98 }, monthly: { now: 6.78 } } },
    USD: { campaign: { yearly: { now: 9.99, was: 29.99 }, monthly: { now: 1.99, was: 3.99 } }, standard: { yearly: { now: 29.99 }, monthly: { now: 3.99 } } }
  };
  var CUR = PAY === 'epoint' ? 'AZN' : 'USD';

  /* ── Copy (az source; en and ru written for this funnel) ──────────────────────────────── */
  var C = {
    az: {
      units: ['GÜN', 'SAAT', 'DƏQ', 'SAN'], title: 'Şəxsi plan · Anacan Premium', back: 'Geri', close: 'Bağla', cont: 'Davam et', pick_many: 'Bir neçəsini seç',
      promo: '<b>Mərcan Cümə:</b> illik Premium −67%', left: '{d} gün {hms}',
      intro_tag: 'Anacan · 2 dəqiqə', intro_h: 'Hər mərhələ üçün <span>şəxsi plan</span>', intro_p: 'Bir neçə sual cavabla, sənin vəziyyətinə uyğun həftəlik plan hazırlayaq.', intro_cta: 'Planımı hazırla',
      proof1: 'App Store · 560+ beşulduzlu rəy', proof2: 'yükləmə · 25 dil', legal: 'Davam etməklə <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a> və <a href="https://anacan.az/privacy" target="_blank" rel="noopener">Məxfilik siyasəti</a> ilə razılaşırsan.',
      q_stage: 'Hazırda hansı mərhələdəsən?', st_flow: 'Dövrümü izləyirəm', st_ttc: 'Hamilə olmaq istəyirəm', st_bump: 'Hamiləyəm', st_baby: 'Körpəm var (0–3 yaş)',
      q_week: 'Neçənci həftədəsən?', w1: '1–12 həftə', w2: '13–27 həftə', w3: '28–40 həftə',
      q_age: 'Körpən neçə aylıqdır?', a1: '0–3 ay', a2: '4–6 ay', a3: '7–12 ay', a4: '1–3 yaş',
      q_years: 'Neçə yaşın var?', y1: '18–24', y2: '25–34', y3: '35–44', y4: '45+',
      q_worry: 'Səni ən çox nə narahat edir?', wo_sleep: 'Yuxu', wo_food: 'Qidalanma', wo_dev: 'İnkişaf normaldırmı?', wo_doc: 'Həkimə nə soruşum?', wo_mood: 'Əhval, stress', wo_family: 'Ailənin dəstəyi',
      wo_cycle: 'Dövrün nizamı', wo_symptom: 'Simptomlar', wo_fertile: 'Münbit günlər',
      info_h: 'Tək deyilsən', info_p: '46 000-dən çox ailə artıq Anacan-dan istifadə edir. Planında sənin seçdiyin mövzular birinci gəlir.',
      lk_ask: 'Nə dərəcədə razısan?', lk_info: 'İnternetdəki məsləhətlər bir-birinə zidd olur və bu məni yorur.', lk_time: 'Özümə vaxt ayırmağa çətinliklə imkan tapıram.', lk_no: 'Razı deyiləm', lk_yes: 'Tam razıyam',
      q_partner: 'Həyat yoldaşın da prosesdə iştirak etsin?', p_yes: 'Bəli, birlikdə izləyək', p_no: 'Hələlik yox',
      q_min: 'Gündə nə qədər vaxt ayıra bilərsən?', m5: '5 dəqiqə', m10: '10 dəqiqə', m15: '15 dəqiqə',
      load_h: 'Planın hazırlanır…', load_1: 'Mərhələn', load_2: 'Narahatlıqların', load_3: 'Həftəlik tövsiyələr',
      modal_pre: 'Davam etmək üçün', modal_q: 'Vacib anları sənə xatırladaq?', modal_no: 'Xeyr', modal_yes: 'Bəli',
      plan_eb: 'Planın hazırdır', plan_h: 'Sənin <em>şəxsi planın</em>', per_day_min: 'Gündə {m}', with_partner: 'partnyor ilə', alone: 'fərdi',
      focus: 'Fokusun', first4: 'İlk 4 həftə', f1: 'Hər gün bu mərhələyə uyğun qısa tövsiyə', f2: '{w}: addım-addım bələdçi', f3: 'Həkim görüşü üçün sual siyahısı və PDF hesabat', f4: 'Həyat yoldaşın üçün ayrıca görünüş',
      plan_cta: 'Planımı saxla',
      label_flow: 'Dövr və sağlamlıq', label_ttc: 'Hamiləliyə hazırlıq', label_bump: 'Hamiləlik · {x}', label_baby: 'Körpə · {x}',
      acc_h: 'Planını saxlamaq üçün hesab', acc_sub: 'Tətbiqdəki eyni hesab. Premium bu hesaba açılacaq.', signed_as: 'Hesab: <b>{e}</b>', other: 'Başqa hesab',
      pw_offer: 'Mərcan Cümə qiyməti', pw_offer_sub: '30 noyabr 23:59-a qədər (Bakı vaxtı)',
      pw_h: '{label}: <em>planın hazırdır</em>', yearly: 'İllik', monthly: 'Aylıq', best: 'Ən sərfəli', per_day: 'gündə {p}', per_month_txt: 'hər ay', once_year: 'ildə bir dəfə',
      inc: 'Planına daxildir', inc_w: '{w}: addım-addım bələdçi', inc_all: '30+ alət, Anacan AI və reklamsız', inc_partner: 'Partnyor rejimi: 2 nəfər, 1 abunəlik', inc_keep: 'Endirimli qiymət hər yenilənmədə qalır',
      cancel_h: 'İstənilən vaxt ləğv et', cancel_t: 'Hesab səhifəndən bir kliklə. Növbəti ödəniş tutulmur.',
      consent_epoint: 'Abunəlik avtomatik yenilənir və kartım növbəti ödənişlər üçün saxlanılır. İstənilən vaxt hesab səhifəsindən ləğv edə bilərəm. <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a> ilə razıyam.',
      consent_dodo: 'Abunəlik avtomatik yenilənir. İstənilən vaxt ləğv edə bilərəm. <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a> ilə razıyam.',
      pay_btn: 'Planımı aç · {p}', secure: 'Təhlükəsiz ödəniş · kart məlumatı Anacan-da saxlanmır', bank_note: 'Ödəniş Epoint bank səhifəsində olur.', dodo_note: 'Ödəniş Dodo Payments səhifəsində olur (USD).',
      ds_h: 'Getmə! Aylıqla başla', ds_t: 'Bu ay cəmi {p}. Endirim hər ay qalır.', ds_cta: 'Aylıqla başla', ds_no: 'Xeyr, təşəkkür',
      err_generic: 'Ödəniş başlamadı. Bir az sonra yenidən yoxla.', err_rate: 'Çox cəhd oldu. Bir saat sonra yenidən yoxla.', err_fail: 'Ödəniş alınmadı. Kartı yoxla və yenidən cəhd et.',
      wait_h: 'Ödəniş yoxlanılır…', wait_t: 'Bu bir dəqiqəyə qədər çəkə bilər. Səhifəni bağlama.',
      ok_h: 'Premium aktivdir 🎉', ok_t: 'Anacan tətbiqini aç və eyni hesabla daxil ol. Planın səni gözləyir.', open_app: 'Tətbiqi aç', cabinet: 'Abunəliyimi idarə et',
      late_h: 'Ödəniş hələ təsdiqlənməyib', late_t: 'Bank təsdiqi bir neçə dəqiqə çəkə bilər. Premium açılan kimi tətbiqdə görünəcək.',
      has_h: 'Premium artıq aktivdir', has_t: 'Bu hesabda Premium var. Tətbiqi açıb istifadə edə bilərsən.',
      retry: 'Yenidən cəhd et', err_load: 'Nəsə alınmadı'
    },
    en: {
      units: ['DAYS', 'HRS', 'MIN', 'SEC'], title: 'Personal plan · Anacan Premium', back: 'Back', close: 'Close', cont: 'Continue', pick_many: 'Pick as many as you like',
      promo: '<b>Coral Friday:</b> yearly Premium −67%', left: '{d} days {hms}',
      intro_tag: 'Anacan · 2 minutes', intro_h: 'A <span>personal plan</span> for every stage', intro_p: 'Answer a few questions and we will build a weekly plan for where you are now.', intro_cta: 'Build my plan',
      proof1: 'App Store · 560+ five-star reviews', proof2: 'downloads · 25 languages', legal: 'By continuing you agree to the <a href="https://anacan.az/terms" target="_blank" rel="noopener">Terms</a> and <a href="https://anacan.az/privacy" target="_blank" rel="noopener">Privacy Policy</a>.',
      q_stage: 'Which stage are you in right now?', st_flow: 'Tracking my cycle', st_ttc: 'Trying to get pregnant', st_bump: 'I am pregnant', st_baby: 'I have a baby (0–3 years)',
      q_week: 'How many weeks along are you?', w1: 'Weeks 1–12', w2: 'Weeks 13–27', w3: 'Weeks 28–40',
      q_age: 'How old is your baby?', a1: '0–3 months', a2: '4–6 months', a3: '7–12 months', a4: '1–3 years',
      q_years: 'How old are you?', y1: '18–24', y2: '25–34', y3: '35–44', y4: '45+',
      q_worry: 'What worries you most?', wo_sleep: 'Sleep', wo_food: 'Feeding and nutrition', wo_dev: 'Is development on track?', wo_doc: 'What to ask the doctor', wo_mood: 'Mood and stress', wo_family: 'Support from family',
      wo_cycle: 'A regular cycle', wo_symptom: 'Symptoms', wo_fertile: 'Fertile days',
      info_h: 'You are not alone', info_p: 'More than 46,000 families already use Anacan. The topics you picked come first in your plan.',
      lk_ask: 'How much do you agree?', lk_info: 'Advice online contradicts itself and it wears me out.', lk_time: 'I hardly find time for myself.', lk_no: 'Disagree', lk_yes: 'Fully agree',
      q_partner: 'Should your partner be part of it too?', p_yes: 'Yes, let us follow it together', p_no: 'Not for now',
      q_min: 'How much time can you spend a day?', m5: '5 minutes', m10: '10 minutes', m15: '15 minutes',
      load_h: 'Building your plan…', load_1: 'Your stage', load_2: 'Your worries', load_3: 'Weekly tips',
      modal_pre: 'To continue', modal_q: 'Shall we remind you of the important moments?', modal_no: 'No', modal_yes: 'Yes',
      plan_eb: 'Your plan is ready', plan_h: 'Your <em>personal plan</em>', per_day_min: '{m} a day', with_partner: 'with your partner', alone: 'just for you',
      focus: 'Your focus', first4: 'The first 4 weeks', f1: 'A short daily tip for this stage', f2: '{w}: a step-by-step guide', f3: 'Questions for the doctor and a PDF report', f4: 'A separate view for your partner',
      plan_cta: 'Save my plan',
      label_flow: 'Cycle and health', label_ttc: 'Getting ready for pregnancy', label_bump: 'Pregnancy · {x}', label_baby: 'Baby · {x}',
      acc_h: 'Create an account to save your plan', acc_sub: 'The same account as in the app. Premium opens on this account.', signed_as: 'Account: <b>{e}</b>', other: 'Use another account',
      pw_offer: 'Coral Friday price', pw_offer_sub: 'Until 30 November, 23:59 Baku time',
      pw_h: '{label}: <em>your plan is ready</em>', yearly: 'Yearly', monthly: 'Monthly', best: 'Best value', per_day: '{p} a day', per_month_txt: 'every month', once_year: 'once a year',
      inc: 'Included in your plan', inc_w: '{w}: a step-by-step guide', inc_all: '30+ tools, Anacan AI and no ads', inc_partner: 'Partner mode: 2 people, 1 subscription', inc_keep: 'The discounted price stays on every renewal',
      cancel_h: 'Cancel any time', cancel_t: 'One click on your account page. No further charge.',
      consent_epoint: 'The subscription renews automatically and my card is saved for the next payments. I can cancel any time on my account page. I agree to the <a href="https://anacan.az/terms" target="_blank" rel="noopener">Terms</a>.',
      consent_dodo: 'The subscription renews automatically. I can cancel any time. I agree to the <a href="https://anacan.az/terms" target="_blank" rel="noopener">Terms</a>.',
      pay_btn: 'Open my plan · {p}', secure: 'Secure payment · card details are not stored by Anacan', bank_note: 'You pay on the Epoint bank page.', dodo_note: 'You pay on the Dodo Payments page (USD).',
      ds_h: 'Wait! Start with monthly', ds_t: 'Just {p} this month. The discount stays every month.', ds_cta: 'Start monthly', ds_no: 'No, thanks',
      err_generic: 'The payment did not start. Please try again in a moment.', err_rate: 'Too many attempts. Please try again in an hour.', err_fail: 'The payment did not go through. Check the card and try again.',
      wait_h: 'Checking the payment…', wait_t: 'This can take up to a minute. Please keep this page open.',
      ok_h: 'Premium is on 🎉', ok_t: 'Open the Anacan app and sign in with the same account. Your plan is waiting.', open_app: 'Open the app', cabinet: 'Manage my subscription',
      late_h: 'Payment not confirmed yet', late_t: 'The bank confirmation can take a few minutes. Premium will show in the app as soon as it opens.',
      has_h: 'Premium is already on', has_t: 'This account already has Premium. Open the app and enjoy it.',
      retry: 'Try again', err_load: 'Something went wrong'
    },
    ru: {
      units: ['ДН', 'ЧАС', 'МИН', 'СЕК'], title: 'Личный план · Anacan Premium', back: 'Назад', close: 'Закрыть', cont: 'Продолжить', pick_many: 'Можно выбрать несколько',
      promo: '<b>Коралловая пятница:</b> годовой Premium −67%', left: '{d} дн. {hms}',
      intro_tag: 'Anacan · 2 минуты', intro_h: '<span>Личный план</span> для каждого этапа', intro_p: 'Ответьте на несколько вопросов, и мы составим план на неделю под ваш этап.', intro_cta: 'Составить мой план',
      proof1: 'App Store · 560+ отзывов на 5 звёзд', proof2: 'загрузок · 25 языков', legal: 'Продолжая, вы соглашаетесь с <a href="https://anacan.az/terms" target="_blank" rel="noopener">Условиями</a> и <a href="https://anacan.az/privacy" target="_blank" rel="noopener">Политикой конфиденциальности</a>.',
      q_stage: 'На каком вы сейчас этапе?', st_flow: 'Слежу за циклом', st_ttc: 'Хочу забеременеть', st_bump: 'Я беременна', st_baby: 'У меня малыш (0–3 года)',
      q_week: 'Какая у вас неделя?', w1: '1–12 неделя', w2: '13–27 неделя', w3: '28–40 неделя',
      q_age: 'Сколько месяцев малышу?', a1: '0–3 месяца', a2: '4–6 месяцев', a3: '7–12 месяцев', a4: '1–3 года',
      q_years: 'Сколько вам лет?', y1: '18–24', y2: '25–34', y3: '35–44', y4: '45+',
      q_worry: 'Что вас беспокоит больше всего?', wo_sleep: 'Сон', wo_food: 'Питание', wo_dev: 'Нормально ли развитие?', wo_doc: 'Что спросить у врача', wo_mood: 'Настроение и стресс', wo_family: 'Поддержка семьи',
      wo_cycle: 'Регулярный цикл', wo_symptom: 'Симптомы', wo_fertile: 'Фертильные дни',
      info_h: 'Вы не одна', info_p: 'Anacan уже пользуются более 46 000 семей. Темы, которые вы выбрали, будут в плане первыми.',
      lk_ask: 'Насколько вы согласны?', lk_info: 'Советы в интернете противоречат друг другу, и это утомляет.', lk_time: 'Мне трудно найти время для себя.', lk_no: 'Не согласна', lk_yes: 'Полностью согласна',
      q_partner: 'Пусть муж тоже участвует?', p_yes: 'Да, будем следить вместе', p_no: 'Пока нет',
      q_min: 'Сколько времени в день вы готовы уделять?', m5: '5 минут', m10: '10 минут', m15: '15 минут',
      load_h: 'Составляем ваш план…', load_1: 'Ваш этап', load_2: 'Ваши вопросы', load_3: 'Советы на неделю',
      modal_pre: 'Чтобы продолжить', modal_q: 'Напоминать вам о важных моментах?', modal_no: 'Нет', modal_yes: 'Да',
      plan_eb: 'План готов', plan_h: 'Ваш <em>личный план</em>', per_day_min: '{m} в день', with_partner: 'вместе с мужем', alone: 'лично для вас',
      focus: 'Ваш фокус', first4: 'Первые 4 недели', f1: 'Короткий совет каждый день для вашего этапа', f2: '{w}: пошаговый гид', f3: 'Вопросы для врача и PDF-отчёт', f4: 'Отдельный вид для мужа',
      plan_cta: 'Сохранить мой план',
      label_flow: 'Цикл и здоровье', label_ttc: 'Подготовка к беременности', label_bump: 'Беременность · {x}', label_baby: 'Малыш · {x}',
      acc_h: 'Аккаунт, чтобы сохранить план', acc_sub: 'Тот же аккаунт, что и в приложении. Premium откроется на нём.', signed_as: 'Аккаунт: <b>{e}</b>', other: 'Другой аккаунт',
      pw_offer: 'Цена Коралловой пятницы', pw_offer_sub: 'До 30 ноября, 23:59 по Баку',
      pw_h: '{label}: <em>план готов</em>', yearly: 'На год', monthly: 'На месяц', best: 'Выгоднее всего', per_day: '{p} в день', per_month_txt: 'каждый месяц', once_year: 'раз в год',
      inc: 'Входит в ваш план', inc_w: '{w}: пошаговый гид', inc_all: '30+ инструментов, Anacan AI и без рекламы', inc_partner: 'Режим партнёра: 2 человека, 1 подписка', inc_keep: 'Цена со скидкой сохраняется при каждом продлении',
      cancel_h: 'Отмена в любой момент', cancel_t: 'В один клик на странице аккаунта. Следующего списания не будет.',
      consent_epoint: 'Подписка продлевается автоматически, карта сохраняется для следующих платежей. Я могу отменить её в любой момент на странице аккаунта. Я согласна с <a href="https://anacan.az/terms" target="_blank" rel="noopener">Условиями</a>.',
      consent_dodo: 'Подписка продлевается автоматически. Я могу отменить её в любой момент. Я согласна с <a href="https://anacan.az/terms" target="_blank" rel="noopener">Условиями</a>.',
      pay_btn: 'Открыть мой план · {p}', secure: 'Безопасная оплата · данные карты не хранятся в Anacan', bank_note: 'Оплата проходит на странице банка Epoint.', dodo_note: 'Оплата проходит на странице Dodo Payments (USD).',
      ds_h: 'Подождите! Начните с месяца', ds_t: 'Всего {p} в этом месяце. Скидка сохраняется каждый месяц.', ds_cta: 'Начать с месяца', ds_no: 'Нет, спасибо',
      err_generic: 'Оплата не началась. Попробуйте ещё раз чуть позже.', err_rate: 'Слишком много попыток. Попробуйте через час.', err_fail: 'Оплата не прошла. Проверьте карту и попробуйте снова.',
      wait_h: 'Проверяем оплату…', wait_t: 'Это может занять до минуты. Не закрывайте страницу.',
      ok_h: 'Premium включён 🎉', ok_t: 'Откройте приложение Anacan и войдите с тем же аккаунтом. Ваш план уже ждёт.', open_app: 'Открыть приложение', cabinet: 'Управлять подпиской',
      late_h: 'Оплата ещё не подтверждена', late_t: 'Подтверждение банка может занять несколько минут. Premium появится в приложении сразу после этого.',
      has_h: 'Premium уже включён', has_t: 'На этом аккаунте уже есть Premium. Откройте приложение.',
      retry: 'Попробовать снова', err_load: 'Что-то пошло не так'
    }
  };
  var T = C[LANG] || C.en;

  /* ── Helpers ─────────────────────────────────────────────────────────────────────────── */
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fill = function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  function money(n) { return CUR === 'AZN' ? Number(n).toFixed(2).replace('.', ',') + ' ₼' : '$' + Number(n).toFixed(2); }
  function track(name, p) { try { window.anacanAnalytics && window.anacanAnalytics.track(name, Object.assign({ funnel_id: 'plan', lang: LANG, provider: PAY, campaign: campaignOn() ? 'mercan' : 'none' }, p || {})); } catch (e) { /* ignore */ } }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── State (kept in this tab across the Google/Apple and bank redirects) ─────────────── */
  var S = { step: 0, ans: {}, plan: 'yearly', downsold: false };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') S = Object.assign(S, saved); } catch (e) { /* ignore */ }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  var status = null, generation = 0, tickTimer = null, offer = null;

  var params = new URLSearchParams(location.search);
  var bankReturn = params.get('odenis'), dodoReturn = params.get('done') === '1';
  if (bankReturn || dodoReturn) { params.delete('odenis'); params.delete('done'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }

  function campaignOn() {
    if (offer) return offer.kind === 'campaign';
    var now = Date.now(); return now >= START && (!END || now < END);
  }
  function price(plan) {
    if (CUR === 'AZN' && offer && offer.plans && offer.plans[plan]) return { now: Number(offer.plans[plan].price), was: offer.plans[plan].was == null ? null : Number(offer.plans[plan].was) };
    var p = PRICES[CUR][campaignOn() ? 'campaign' : 'standard'][plan]; return { now: p.now, was: p.was || null };
  }

  /* ── Quiz definition ──────────────────────────────────────────────────────────────────── */
  function stage() { return String(S.ans.stage || 'st_bump').replace('st_', ''); }
  function worryOpts() {
    return stage() === 'flow' || stage() === 'ttc'
      ? [['🗓️', 'wo_cycle'], ['🌡️', 'wo_symptom'], ['💞', 'wo_fertile'], ['😟', 'wo_mood'], ['🍎', 'wo_food'], ['🩺', 'wo_doc']]
      : [['😴', 'wo_sleep'], ['🍎', 'wo_food'], ['📈', 'wo_dev'], ['🩺', 'wo_doc'], ['😟', 'wo_mood'], ['👨‍👩‍👧', 'wo_family']];
  }
  function whenQ() {
    return stage() === 'bump' ? ['q_week', [['1️⃣', 'w1'], ['2️⃣', 'w2'], ['3️⃣', 'w3']]]
      : stage() === 'baby' ? ['q_age', [['🍼', 'a1'], ['🧸', 'a2'], ['🥣', 'a3'], ['👣', 'a4']]]
      : ['q_years', [['', 'y1'], ['', 'y2'], ['', 'y3'], ['', 'y4']]];
  }
  var STEPS = ['intro', 'stage', 'when', 'worry', 'info', 'lk_info', 'lk_time', 'partner', 'minutes', 'loader', 'plan', 'account', 'paywall'];
  var QUIZ_LEN = 9; // steps with progress before the loader

  function planLabel() {
    var w = S.ans.when ? T[S.ans.when] : '';
    return stage() === 'bump' ? fill(T.label_bump, { x: w || T.w2 }) : stage() === 'baby' ? fill(T.label_baby, { x: w || T.a2 }) : stage() === 'ttc' ? T.label_ttc : T.label_flow;
  }
  function stageImg() { return stage() === 'bump' ? 'tumurcuq' : stage() === 'baby' ? 'qucaq' : 'ritm'; }
  function worries() { var w = (S.ans.worry || []).map(function (k) { return T[k]; }); return w.length ? w : [T[worryOpts()[0][1]], T[worryOpts()[1][1]]]; }

  /* ── Frame ────────────────────────────────────────────────────────────────────────────── */
  function frame(inner, foot, o) {
    o = o || {};
    var n = STEPS.indexOf(STEPS[S.step]);
    var pct = Math.min(100, Math.round(n / (STEPS.length - 1) * 100));
    var promo = campaignOn() ? '<div class="pf-promo">' + T.promo + '<span class="num" id="pf-left"></span></div>' : '';
    $('#app').innerHTML = '<div class="pf">' + promo +
      '<div class="pf-top"><div class="w">' + (S.step > 0 && !o.noBack ? '<button class="pf-back" type="button" data-back aria-label="' + esc(T.back) + '">←</button>' : '<a class="pf-logo" href="https://anacan.az/' + (LANG === 'az' ? '' : LANG + '/') + '"><img src="/website/brand-glyph-coral.png" alt="" width="22" height="22">anacan</a>') +
      '<div class="pf-prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      (o.close ? '<button class="pf-x" type="button" data-close aria-label="' + esc(T.close) + '">✕</button>' : '<button class="pf-x" type="button" hidden tabindex="-1" aria-hidden="true"></button>') + '</div></div>' +
      '<main class="pf-main pf-fade">' + inner + '</main>' + (foot ? '<div class="pf-foot"><div class="in">' + foot + '</div></div>' : '') + '</div>';
    $('#app').removeAttribute('aria-busy');
    var h = $('.pf-h'); if (h && S.step > 0) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    window.scrollTo(0, 0);
    promoTick();
  }
  function promoTick() {
    clearInterval(tickTimer);
    var f = function () {
      var left = Math.max(0, END - Date.now()), d = Math.floor(left / 864e5), hms = pad(Math.floor(left / 36e5) % 24) + ':' + pad(Math.floor(left / 6e4) % 60) + ':' + pad(Math.floor(left / 1e3) % 60);
      var el = $('#pf-left'); if (el) el.textContent = fill(T.left, { d: d, hms: hms });
      var cd = $('#pf-cd'); if (cd) cd.innerHTML = [d, Math.floor(left / 36e5) % 24, Math.floor(left / 6e4) % 60, Math.floor(left / 1e3) % 60].map(function (v, i) { return '<div>' + pad(v) + '<small>' + T.units[i] + '</small></div>'; }).join('');
      if (!left && campaignOn() && !offer) { render(); }
    };
    if (campaignOn()) { f(); tickTimer = setInterval(f, 1000); }
  }
  function go(n) { S.step = Math.max(0, Math.min(STEPS.length - 1, n)); save(); render(); }
  function next() { go(S.step + 1); }

  function single(key, q, opts) {
    frame('<h1 class="pf-h">' + esc(q) + '</h1>' + opts.map(function (o) { return '<button class="pf-opt" type="button" data-a="' + o[1] + '" aria-pressed="' + (S.ans[key] === o[1]) + '">' + (o[0] ? '<span class="e" aria-hidden="true">' + o[0] + '</span>' : '') + esc(T[o[1]]) + '</button>'; }).join(''));
    document.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (key === 'stage' && S.ans.stage !== b.dataset.a) { delete S.ans.when; delete S.ans.worry; }
        S.ans[key] = b.dataset.a; b.setAttribute('aria-pressed', 'true');
        track('funnel_step', { step: key, answer: b.dataset.a });
        setTimeout(next, reduceMotion ? 0 : 220);
      });
    });
  }

  /* ── Steps ────────────────────────────────────────────────────────────────────────────── */
  function render() {
    clearInterval(tickTimer);
    document.title = T.title;
    var id = STEPS[S.step];
    if (id === 'intro') {
      frame('<section class="pf-hero"><span class="tag" style="background:#ffffff2e;color:#fff">' + esc(T.intro_tag) + '</span><h1>' + T.intro_h + '</h1><p>' + esc(T.intro_p) + '</p>' +
        '<div class="pf-trio"><img src="' + CH + 'ritm-success.webp" alt="Ritm" width="512" height="512"><img src="' + CH + 'tumurcuq-success.webp" alt="Tumurcuq" width="512" height="512"><img src="' + CH + 'qucaq-success.webp" alt="Qucaq" width="512" height="512"></div></section>' +
        '<div class="pf-proof"><b>4.84 ★</b><span>' + esc(T.proof1) + '</span></div><div class="pf-proof"><b>46 000+</b><span>' + esc(T.proof2) + '</span></div>',
        '<button class="cta" type="button" data-next>' + esc(T.intro_cta) + '</button><p class="fine">' + T.legal + '</p>');
    } else if (id === 'stage') {
      single('stage', T.q_stage, [['🌸', 'st_flow'], ['💞', 'st_ttc'], ['🤰', 'st_bump'], ['👶', 'st_baby']]);
    } else if (id === 'when') {
      var w = whenQ(); single('when', T[w[0]], w[1]);
    } else if (id === 'worry') {
      var sel = S.ans.worry || [];
      frame('<h1 class="pf-h">' + esc(T.q_worry) + '</h1><p class="pf-sub">' + esc(T.pick_many) + '</p><div class="pf-grid">' +
        worryOpts().map(function (o) { return '<button class="pf-opt" type="button" data-m="' + o[1] + '" aria-pressed="' + (sel.indexOf(o[1]) >= 0) + '"><span class="e" aria-hidden="true">' + o[0] + '</span>' + esc(T[o[1]]) + '</button>'; }).join('') + '</div>',
        '<button class="cta" type="button" data-next ' + (sel.length ? '' : 'disabled') + '>' + esc(T.cont) + '</button>');
      document.querySelectorAll('[data-m]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.dataset.m, i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else sel.push(k);
          S.ans.worry = sel.slice(); save(); b.setAttribute('aria-pressed', String(sel.indexOf(k) >= 0)); $('.pf-foot .cta').disabled = !sel.length;
        });
      });
    } else if (id === 'info') {
      frame('<div style="text-align:center"><img src="' + CH + 'tumurcuq-value.webp" alt="" width="333" height="512" style="width:150px;height:auto;margin:6px auto"></div><h1 class="pf-h" style="text-align:center">' + esc(T.info_h) + '</h1><p class="pf-sub" style="text-align:center">' + esc(T.info_p) + '</p>' + review(0),
        '<button class="cta" type="button" data-next>' + esc(T.cont) + '</button>');
    } else if (id === 'lk_info' || id === 'lk_time') {
      frame('<span class="pf-eyebrow">' + esc(T.lk_ask) + '</span><h1 class="pf-h pf-quote">“' + esc(T[id]) + '”</h1><div class="pf-likert">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-l="' + n + '" aria-pressed="' + (S.ans[id] === n) + '">' + n + '</button>'; }).join('') + '</div><div class="pf-lk"><span>' + esc(T.lk_no) + '</span><span>' + esc(T.lk_yes) + '</span></div>');
      document.querySelectorAll('[data-l]').forEach(function (b) { b.addEventListener('click', function () { S.ans[id] = +b.dataset.l; b.setAttribute('aria-pressed', 'true'); track('funnel_step', { step: id, answer: b.dataset.l }); setTimeout(next, reduceMotion ? 0 : 220); }); });
    } else if (id === 'partner') {
      single('partner', T.q_partner, [['👫', 'p_yes'], ['🙂', 'p_no']]);
    } else if (id === 'minutes') {
      single('minutes', T.q_min, [['🤙', 'm5'], ['👌', 'm10'], ['🤘', 'm15']]);
    } else if (id === 'loader') {
      loader();
    } else if (id === 'plan') {
      var w2 = worries(), partner = S.ans.partner === 'p_yes';
      track('plan_view', { stage: stage() });
      frame('<span class="pf-eyebrow">' + esc(T.plan_eb) + '</span><h1 class="pf-h">' + T.plan_h + '</h1>' +
        '<div class="pf-card pf-planhead"><img src="' + CH + stageImg() + '-welcome.webp" alt="" width="333" height="512"><div><b>' + esc(planLabel()) + '</b><span class="pf-sub">' + esc(fill(T.per_day_min, { m: T[S.ans.minutes || 'm5'] })) + ' · ' + esc(partner ? T.with_partner : T.alone) + '</span></div></div>' +
        '<div class="pf-card"><h3>' + esc(T.focus) + '</h3><div class="pf-chips">' + w2.map(function (x) { return '<span class="pf-chip">' + esc(x) + '</span>'; }).join('') + '</div></div>' +
        '<div class="pf-card"><h3>' + esc(T.first4) + '</h3><ul class="pf-list"><li>' + esc(T.f1) + '</li><li>' + esc(fill(T.f2, { w: w2[0] })) + '</li><li>' + esc(T.f3) + '</li>' + (partner ? '<li>' + esc(T.f4) + '</li>' : '') + '</ul></div>',
        '<button class="cta" type="button" data-next>' + esc(T.plan_cta) + '</button>');
    } else if (id === 'account') {
      accountStep();
    } else if (id === 'paywall') {
      paywall();
    }
  }
  function review(i) {
    var R = [['Bugünə qədər istifadə etdiyim hamiləlik tətbiqləri içində ən gözəl tətbiqdir, Azərbaycanda yaradılması və Azərbaycan dilini dəstəkləməsi isə qürurvericidir ❤️', 'App Store'],
      ['Çox bəyəndim. Tövsiyyə edirəm. Analar və hamilələr üçün belə bir platformanın olması əladır.', 'Google Play · Yaqut N.'],
      ['The best pregnancy app in the world. Price is cheaper than others, benefits is more than them.', 'App Store']];
    var r = R[LANG === 'az' ? i % 2 : 2];
    return '<div class="pf-rv"><span class="st" aria-label="5/5">★★★★★</span><p style="margin:4px 0">' + esc(r[0]) + '</p><small>' + esc(r[1]) + '</small></div>';
  }

  function loader() {
    var bars = [T.load_1, T.load_2, T.load_3];
    frame('<h1 class="pf-h" style="text-align:center;margin-top:8px">' + esc(T.load_h) + '</h1><div class="pf-card pf-loader">' +
      bars.map(function (b, i) { return '<div class="row"><span>' + esc(b) + '</span><span data-p="' + i + '">0%</span></div><div class="pf-bar"><i data-b="' + i + '"></i></div>'; }).join('') + '</div>' + review(1), '', { noBack: true });
    var k = 0, p = 0, asked = false, mine = ++generation;
    var t = setInterval(step, reduceMotion ? 10 : 40);
    function step() {
      if (mine !== generation) { clearInterval(t); return; }
      if (!asked && k === 1 && p >= 46) {
        asked = true; clearInterval(t);
        modal('<span class="fine">' + esc(T.modal_pre) + '</span><b style="font:800 19px var(--display)">' + esc(T.modal_q) + '</b><div class="row2"><button class="cta ghost" type="button" data-m="no" style="background:#fff;color:var(--coral-deep);box-shadow:inset 0 0 0 1.5px var(--coral)">' + esc(T.modal_no) + '</button><button class="cta" type="button" data-m="yes">' + esc(T.modal_yes) + '</button></div>',
          function (v) { S.ans.reminders = v; track('funnel_step', { step: 'reminders', answer: v }); t = setInterval(step, reduceMotion ? 10 : 40); });
        return;
      }
      p += 2;
      var b = document.querySelector('[data-b="' + k + '"]'), tx = document.querySelector('[data-p="' + k + '"]');
      if (!b) { clearInterval(t); return; }
      b.style.width = Math.min(p, 100) + '%'; tx.textContent = Math.min(p, 100) + '%';
      if (p >= 100) { k++; p = 0; if (k >= bars.length) { clearInterval(t); setTimeout(function () { if (mine === generation) next(); }, 350); } }
    }
  }
  function modal(inner, done) {
    var m = document.createElement('div'); m.className = 'pf-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box">' + inner + '</div>';
    document.body.appendChild(m);
    m.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { m.remove(); done(b.getAttribute('data-m')); }); });
    var f = m.querySelector('button'); if (f) f.focus();
  }

  /* ── Account (same as the app) ───────────────────────────────────────────────────────── */
  async function accountStep() {
    var mine = ++generation;
    frame('<div class="pf-acc" id="acc"><span class="spin"></span></div>');
    var s = null; try { s = await A.session(); } catch (e) { s = null; }
    if (mine !== generation) return;
    var box = $('#acc');
    if (!s) { A.renderLogin(box, { title: T.acc_h, subtitle: T.acc_sub }); track('funnel_step', { step: 'account_view' }); return; }
    var verify = false; try { verify = await A.needsVerification(); } catch (e) { verify = false; }
    if (mine !== generation) return;
    if (verify) { A.renderVerify(box, s.user && s.user.email, function () { if (STEPS[S.step] === 'account') accountStep(); }); return; }
    track('lead', { stage: stage() });
    frame('<h1 class="pf-h">' + esc(T.acc_h) + '</h1><p class="pf-sub">' + esc(T.acc_sub) + '</p><p class="pf-who">' + fill(T.signed_as, { e: esc((s.user && s.user.email) || '') }) + '</p><button class="pf-link" type="button" data-other>' + esc(T.other) + '</button>',
      '<button class="cta" type="button" data-next>' + esc(T.cont) + '</button>');
  }

  /* ── Paywall + payment ───────────────────────────────────────────────────────────────── */
  async function paywall(message) {
    var mine = ++generation;
    var s = null; try { s = await A.session(); } catch (e) { s = null; }
    if (mine !== generation) return;
    if (!s) { go(STEPS.indexOf('account')); return; }
    try { status = await A.call('status'); } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); go(STEPS.indexOf('account')); return; }
      status = null;
    }
    if (mine !== generation) return;
    if (status && status.offer && status.offer.plans) offer = status.offer;
    if (status && status.premium && status.premium.active) { showState('has'); return; }
    if (PAY === 'epoint' && status && (!status.offer || !status.offer.plans)) { showState('error'); return; }
    var ready = PAY === 'dodo' || !status || status.payments_ready !== false;
    var w2 = worries(), partner = S.ans.partner === 'p_yes', camp = campaignOn();
    var y = price('yearly'), m = price('monthly');
    var perDay = function (v) { return money(v / 365); };
    track('paywall_view', { stage: stage(), plan_default: S.plan });
    frame((camp ? '<section class="pf-offer"><div class="top"><img src="' + CH + stageImg() + '-success.webp" alt="" width="512" height="512"><div><b>' + esc(T.pw_offer) + '</b><br><span>' + esc(T.pw_offer_sub) + '</span></div></div><div class="pf-cd" id="pf-cd"></div></section>' : '') +
      '<h1 class="pf-h">' + fill(T.pw_h, { label: esc(planLabel()) }) + '</h1>' +
      '<div class="pf-chips">' + w2.map(function (x) { return '<span class="pf-chip">' + esc(x) + '</span>'; }).join('') + '</div>' +
      (message ? '<p class="pf-err" role="alert">' + esc(message) + '</p>' : '') +
      '<div class="pf-plans" role="radiogroup">' +
        planBtn('yearly', T.yearly, (y.was ? '<s>' + money(y.was) + '</s> · ' : '') + esc(fill(T.per_day, { p: perDay(y.now) })), y, (y.was ? '−' + Math.round((1 - y.now / y.was) * 100) + '% · ' : '') + T.best) +
        planBtn('monthly', T.monthly, (m.was ? '<s>' + money(m.was) + '</s> · ' : '') + esc(T.per_month_txt), m, m.was ? '−' + Math.round((1 - m.now / m.was) * 100) + '%' : '') +
      '</div>' +
      '<div class="pf-card"><h3>' + esc(T.inc) + '</h3><ul class="pf-list">' + w2.slice(0, 3).map(function (x) { return '<li>' + esc(fill(T.inc_w, { w: x })) + '</li>'; }).join('') + '<li>' + esc(T.inc_all) + '</li>' + (partner ? '<li>' + esc(T.inc_partner) + '</li>' : '') + (camp ? '<li>' + esc(T.inc_keep) + '</li>' : '') + '</ul></div>' +
      review(0) + '<div class="pf-card"><h3>' + esc(T.cancel_h) + '</h3><p class="pf-sub">' + esc(T.cancel_t) + '</p></div>' +
      (ready ? '<label class="consent"><input type="checkbox" id="consent"><span>' + (PAY === 'epoint' ? T.consent_epoint : T.consent_dodo) + '</span></label>' : '') +
      '<p class="pf-err" id="pay-err" role="alert" hidden></p><p class="fine">' + esc(PAY === 'epoint' ? T.bank_note : T.dodo_note) + '</p>',
      '<button class="cta" type="button" id="pay" disabled>' + esc(fill(T.pay_btn, { p: money(price(S.plan).now) })) + '</button><p class="fine">🔒 ' + esc(T.secure) + '</p>',
      { close: camp && !S.downsold, noBack: false });
    var consent = $('#consent'), pay = $('#pay');
    var sync = function () { pay.disabled = !ready || !consent || !consent.checked; };
    if (consent) consent.addEventListener('change', sync); sync();
    pay.addEventListener('click', function () { (PAY === 'epoint' ? payEpoint : payDodo)(pay); });
    document.querySelectorAll('[data-plan]').forEach(function (b) {
      b.addEventListener('click', function () { S.plan = b.dataset.plan; save(); document.querySelectorAll('[data-plan]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.plan === S.plan)); }); pay.textContent = fill(T.pay_btn, { p: money(price(S.plan).now) }); sync(); });
    });
  }
  function planBtn(id, name, sub, p, badge) {
    return '<button class="pf-plan" type="button" role="radio" data-plan="' + id + '" aria-pressed="' + (S.plan === id) + '" aria-checked="' + (S.plan === id) + '">' + (badge ? '<span class="badge">' + esc(badge) + '</span>' : '') +
      '<span class="rd" aria-hidden="true"></span><span class="nm"><b>' + esc(name) + '</b><small>' + sub + '</small></span><span class="pr"><b>' + money(p.now) + '</b></span></button>';
  }
  function downsell() {
    if (S.downsold || !campaignOn()) return;
    S.downsold = true; save(); track('downsell_view');
    modal('<img src="' + CH + 'tumurcuq-welcome.webp" alt="" width="333" height="512" style="height:auto"><b style="font:800 21px var(--display)">' + esc(T.ds_h) + '</b><p class="pf-sub">' + esc(fill(T.ds_t, { p: money(price('monthly').now) })) + '</p><button class="cta" type="button" data-m="take">' + esc(T.ds_cta) + '</button><button class="pf-link" type="button" data-m="no">' + esc(T.ds_no) + '</button>',
      function (v) { if (v === 'take') { S.plan = 'monthly'; save(); track('downsell_take'); } paywall(); });
  }
  function payError(text, pay, label) {
    if (pay && document.body.contains(pay)) { pay.textContent = label; pay.disabled = !($('#consent') && $('#consent').checked); }
    var e = $('#pay-err'); if (e) { e.textContent = text; e.hidden = false; }
  }
  function markFunnel() { try { sessionStorage.setItem('anacan_funnel', 'plan'); } catch (e) { /* ignore */ } save(); }
  async function payEpoint(pay) {
    var label = pay.textContent; pay.disabled = true; pay.innerHTML = '<span class="spin"></span>';
    track('checkout_start', { plan: S.plan, value: price(S.plan).now, currency: CUR });
    markFunnel();
    try {
      var d = await A.call('subscribe', { consent: 'premium-autorenew-v1', plan: S.plan });
      if (d && d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) { location.href = d.redirect_url; return; }
      if (d && (d.error === 'premium_active' || d.error === 'already_subscribed')) { showState('has'); return; }
      payError(d && (d.error === 'rate_limited' || d.error === 'too_many_attempts') ? T.err_rate : T.err_generic, pay, label);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); go(STEPS.indexOf('account')); return; }
      payError(T.err_generic, pay, label);
    }
  }
  async function payDodo(pay) {
    var label = pay.textContent; pay.disabled = true; pay.innerHTML = '<span class="spin"></span>';
    var s = null; try { s = await A.session(); } catch (e) { s = null; }
    if (!s || !s.access_token) { go(STEPS.indexOf('account')); return; }
    track('checkout_start', { plan: S.plan, value: price(S.plan).now, currency: CUR });
    markFunnel();
    try {
      var body = { plan: S.plan, email: (s.user && s.user.email) || '', language: LANG, pay_label: 'Anacan Premium' };
      if (campaignOn()) body.campaign = 'mercan';
      var r = await fetch(DODO, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body) });
      var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
      if (r.status === 401) { await A.signOut(); go(STEPS.indexOf('account')); return; }
      if (r.status === 409) { showState('has'); return; }
      if (r.status === 429) { payError(T.err_rate, pay, label); return; }
      if (!r.ok || typeof d.checkout_url !== 'string' || !/^https:\/\//.test(d.checkout_url)) { payError(T.err_generic, pay, label); return; }
      location.href = d.checkout_url;
    } catch (e) { payError(T.err_generic, pay, label); }
  }

  function showState(kind) {
    var img = CH + 'tumurcuq-success.webp', title = '', text = '', actions = '';
    var appBtn = function (src) { return '<a class="cta" href="' + APP + '?src=' + src + '">' + esc(T.open_app) + '</a>'; };
    if (kind === 'wait') { title = T.wait_h; text = T.wait_t; img = ''; }
    else if (kind === 'ok') { title = T.ok_h; text = T.ok_t; img = CH + 'qucaq-success.webp'; actions = appBtn('plan_success') + (PAY === 'epoint' ? '<a class="btn2" href="' + CABINET + '">' + esc(T.cabinet) + '</a>' : ''); }
    else if (kind === 'late') { title = T.late_h; text = T.late_t; img = CH + 'qucaq-welcome.webp'; actions = appBtn('plan_pending') + (PAY === 'epoint' ? '<a class="btn2" href="' + CABINET + '">' + esc(T.cabinet) + '</a>' : ''); }
    else if (kind === 'has') { title = T.has_h; text = T.has_t; img = CH + 'qucaq-success.webp'; actions = appBtn('plan_active'); }
    else { title = T.err_load; img = ''; actions = '<button class="cta" type="button" data-retry>' + esc(T.retry) + '</button>'; }
    frame('<div class="pf-state">' + (kind === 'wait' ? '<span class="spin" style="width:40px;height:40px"></span>' : img ? '<img src="' + img + '" alt="" width="512" height="512">' : '') +
      '<h1 class="pf-h">' + esc(title) + '</h1>' + (text ? '<p class="pf-sub">' + esc(text) + '</p>' : '') + actions + '</div>', '', { noBack: kind !== 'error' });
    if (kind === 'ok') { track('purchase_confirmed', { plan: S.plan, value: price(S.plan).now, currency: CUR }); try { sessionStorage.removeItem('anacan_funnel'); sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  }
  async function waitForPremium() {
    var mine = ++generation; showState('wait');
    for (var i = 0; i < 20; i++) {
      try {
        var d = await A.call('status');
        if (mine !== generation) return;
        var p = d && d.premium;
        if (p && p.active && (PAY === 'dodo' || p.source === 'web_subscription')) {
          if (d.subscription && (d.subscription.plan === 'monthly' || d.subscription.plan === 'yearly')) S.plan = d.subscription.plan;
          showState('ok'); return;
        }
      } catch (e) { if (e && e.code === 'unauthorized') { await A.signOut(); go(STEPS.indexOf('account')); return; } }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (mine === generation) showState('late');
  }

  /* ── Events ───────────────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.hasAttribute('data-next')) { if (STEPS[S.step] === 'intro') track('funnel_start'); next(); }
    else if (t.hasAttribute('data-back')) { generation++; go(S.step - 1 - (STEPS[S.step - 1] === 'loader' ? 1 : 0)); }
    else if (t.hasAttribute('data-close')) downsell();
    else if (t.hasAttribute('data-other')) { A.signOut().then(function () { accountStep(); }); }
    else if (t.hasAttribute('data-retry')) paywall();
  });
  window.addEventListener('pagehide', save);
  // The cookie banner (analytics.js, fixed at the bottom) must not cover the main button: lift the button bar above it.
  (function () {
    var root = document.documentElement, ro = null;
    var sync = function () {
      var c = document.getElementById('anacan-consent');
      var h = c && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden' ? Math.max(0, innerHeight - c.getBoundingClientRect().top) : 0;
      root.style.setProperty('--consent-h', Math.ceil(h) + 'px');
      if (c && !ro && 'ResizeObserver' in window) { ro = new ResizeObserver(sync); ro.observe(c); }
    };
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    window.addEventListener('resize', sync);
    sync();
  })();

  /* ── Boot ─────────────────────────────────────────────────────────────────────────────── */
  if (A && A.setLang) A.setLang(LANG);
  track('funnel_view');
  if (A) A.onChange(function () { if (STEPS[S.step] === 'account') accountStep(); });
  try { sessionStorage.removeItem('anacan_funnel'); } catch (e) { /* ignore */ }
  if (bankReturn === 'ugurlu' || dodoReturn) { S.step = STEPS.indexOf('paywall'); save(); waitForPremium(); }
  else if (bankReturn === 'xeta') { S.step = STEPS.indexOf('paywall'); save(); paywall(T.err_fail); }
  else { if (STEPS[S.step] === 'loader') S.step = STEPS.indexOf('plan'); render(); }
})();
