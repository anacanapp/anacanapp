/* anacan.az Premium account (kampaniya + hesab pages).
   Session: supabase-js against https://api.anacan.az with the public anon key from /website/backend.json, stored in
   localStorage under its own key (no clash with anything else on anacan.az). The SSR website stays session-free:
   only these client pages read the session.
   Login methods are the app's: Google (OAuth, PKCE, back to this page), e-mail + password with the app's e-mail code
   (email_verification_state_v1 + email-verification function), and Apple through a bridge page on api.anacan.az
   (the only origin registered for Sign in with Apple JS); the bridge hands the session back with postMessage to
   https://anacan.az only. Tokens are never put in URLs or logs. */
(function () {
  'use strict';
  var API = 'https://api.anacan.az';
  var SITE = 'https://anacan.az';
  var STORAGE_KEY = 'anacan.web-premium.auth.v1';
  var APPLE_BRIDGE = API + '/website/premium/apple/index.html';
  var MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  var clientPromise = null;
  var publishableKey = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(value) { var n = Number(value); return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' ₼' : ''; }
  /** Date in Baku time (UTC+4, no DST): "7 dekabr 2026". */
  function day(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    var d = new Date(t + 4 * 3600e3);
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  var storage = {
    getItem: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    removeItem: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  function client() {
    if (!clientPromise) {
      clientPromise = fetch('/website/backend.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (cfg) {
        if (!window.supabase || typeof window.supabase.createClient !== 'function' || !cfg || typeof cfg.publishableKey !== 'string') throw new Error('config');
        publishableKey = cfg.publishableKey;
        return window.supabase.createClient(API, cfg.publishableKey, {
          auth: { storageKey: STORAGE_KEY, storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
      });
      clientPromise.catch(function () { clientPromise = null; });
    }
    return clientPromise;
  }

  /** Removes the OAuth return parameters (?code=…, error=…) after supabase-js has used them. */
  function cleanUrl() {
    try {
      var url = new URL(location.href);
      var changed = false;
      ['code', 'error', 'error_code', 'error_description', 'state'].forEach(function (k) { if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; } });
      if (url.hash && /access_token|error/.test(url.hash)) { url.hash = ''; changed = true; }
      if (changed) history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    } catch (e) { /* ignore */ }
  }
  var redirectError = null;
  (function () {
    try {
      var p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
      if (p.get('error')) redirectError = p.get('error_description') || p.get('error');
    } catch (e) { /* ignore */ }
  })();

  /** Rejects with {code:'timeout'} when a request hangs (flaky mobile network, a stuck token refresh after the tab slept). */
  function withTimeout(promise, ms) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (_, reject) { timer = setTimeout(function () { var e = new Error('timeout'); e.code = 'timeout'; reject(e); }, ms); }),
    ]).finally(function () { clearTimeout(timer); });
  }

  async function session() {
    var c = await withTimeout(client(), 10000);
    var res = await withTimeout(c.auth.getSession(), 10000);
    cleanUrl();
    return res && res.data ? res.data.session : null;
  }

  function onChange(fn) {
    client().then(function (c) {
      c.auth.onAuthStateChange(function (event, s) {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(function () { fn(event, s); }, 0);
      });
    });
  }

  async function signOut() {
    var c = await client();
    try { await c.auth.signOut({ scope: 'local' }); } catch (e) { storage.removeItem(STORAGE_KEY); }
  }

  /** web-premium function. Business outcomes come back as {ok:false, error}; transport problems throw {code}. */
  async function call(action, body) {
    var c = await withTimeout(client(), 10000);
    var res = await withTimeout(c.functions.invoke('web-premium', { body: Object.assign({ action: action }, body || {}) }), 20000);
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var payload = null;
      try { payload = await res.error.context.json(); } catch (e) { payload = null; }
      var err = new Error('web_premium');
      err.code = status === 401 ? 'unauthorized' : (payload && payload.error) || 'unavailable';
      throw err;
    }
    return res.data || {};
  }

  async function needsVerification() {
    try {
      var c = await withTimeout(client(), 10000);
      var res = await withTimeout(c.rpc('email_verification_state_v1'), 8000);
      return !!(res.data && res.data.required === true);
    } catch (e) { return false; }
  }

  async function verification(body) {
    var c = await client();
    var res = await c.functions.invoke('email-verification', { body: Object.assign({ language: LANG }, body) });
    var d = res.data;
    if (res.error) { try { d = await res.error.context.json(); } catch (e) { d = null; } }
    return d || { ok: false, error: 'send_failed' };
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────────────
  var toastTimer = null;
  function toast(text, isError) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.toggle('err', !!isError);
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3600);
  }

  // Texts: Azerbaijani is the source (and the default); the 11.11 foreign pages call setLang(en|tr|kk|uz).
  var LANG = 'az';
  var TR = {"en": {"Çox cəhd edildi. Bir az sonra yenidən yoxla.": "Too many attempts. Please try again a bit later.", "E-poçt və ya şifrə yanlışdır.": "Wrong email or password.", "Bu e-poçtla hesab artıq var. \"Daxil ol\" bölməsindən gir.": "An account with this email already exists. Use \"Sign in\".", "Şifrə ən azı 6 simvol olmalıdır.": "The password must be at least 6 characters.", "E-poçt ünvanını düzgün yaz.": "Please enter a valid email address.", "E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.": "Your email is not confirmed yet. Check your inbox.", "Daxil olmaq alınmadı. Yenidən cəhd et.": "Sign-in failed. Please try again.", "Şifrəni bərpa et": "Reset your password", "Daxil ol": "Sign in", "E-poçtuna şifrə bərpa linki göndərəcəyik.": "We will email you a password reset link.", "Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.": "Sign in with your Anacan account, the same one you use in the app.", "Google ilə davam et": "Continue with Google", "Apple ilə davam et": "Continue with Apple", "və ya e-poçt ilə": "or with email", "Qeydiyyat": "Sign up", "Adın": "Your name", "E-poçt": "Email", "Şifrə": "Password", "Link göndər": "Send link", "Hesab yarat": "Create account", "Girişə qayıt": "Back to sign in", "Şifrəni unutmusan?": "Forgot your password?", "Google ilə giriş başlamadı. Yenidən cəhd et.": "Google sign-in did not start. Please try again.", "Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.": "Your browser blocked the new window. Allow pop-ups for this site and try again.", "Apple ilə giriş ləğv edildi.": "Apple sign-in was cancelled.", "Apple ilə giriş tamamlanmadı. Yenidən cəhd et.": "Apple sign-in did not finish. Please try again.", "Adını yaz.": "Please enter your name.", "Şifrə bərpa linki e-poçtuna göndərildi.": "We sent a password reset link to your email.", "Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.": "Account created. Open the link in your email to continue.", "Giriş tamamlanmadı. Yenidən cəhd et.": "Sign-in did not finish. Please try again.", "E-poçtunu təsdiqlə": "Confirm your email", "Kod": "Code", "Təsdiqlə": "Confirm", "Kodu yenidən göndər": "Resend code", "Başqa hesabla gir": "Use another account", "Yeni kod göndərildi.": "A new code was sent.", "Bir az gözlə və yenidən göndər": "Wait a moment and resend", " san).": " s).", "Kodu göndərmək alınmadı. Yenidən cəhd et.": "Could not send the code. Please try again.", "6 rəqəmli kodu yaz.": "Enter the 6-digit code.", "Kod yanlışdır.": "Wrong code.", "Kodun vaxtı bitib. Yenisini göndər.": "The code has expired. Send a new one.", "Çox cəhd edildi. Yeni kod göndər.": "Too many attempts. Send a new code.", "Təsdiqləmək alınmadı. Yenidən cəhd et.": "Could not confirm. Please try again.", "Çıxış": "Sign out", "@verify_to": "We sent a 6-digit code to <b>{e}</b>.", "@verify_plain": "We sent a 6-digit code to your email.", "@terms": "By continuing you agree to the {t}Terms of Use{/t} and the {p}Privacy Policy{/p}."}, "tr": {"Çox cəhd edildi. Bir az sonra yenidən yoxla.": "Çok fazla deneme yapıldı. Biraz sonra tekrar dene.", "E-poçt və ya şifrə yanlışdır.": "E-posta veya şifre yanlış.", "Bu e-poçtla hesab artıq var. \"Daxil ol\" bölməsindən gir.": "Bu e-postayla zaten bir hesap var. \"Giriş yap\" bölümünden gir.", "Şifrə ən azı 6 simvol olmalıdır.": "Şifre en az 6 karakter olmalı.", "E-poçt ünvanını düzgün yaz.": "Geçerli bir e-posta adresi yaz.", "E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.": "E-posta henüz doğrulanmadı. Gelen kutunu kontrol et.", "Daxil olmaq alınmadı. Yenidən cəhd et.": "Giriş yapılamadı. Tekrar dene.", "Şifrəni bərpa et": "Şifreni sıfırla", "Daxil ol": "Giriş yap", "E-poçtuna şifrə bərpa linki göndərəcəyik.": "E-postana şifre sıfırlama bağlantısı göndereceğiz.", "Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.": "Anacan hesabınla giriş yap: uygulamadaki aynı hesap.", "Google ilə davam et": "Google ile devam et", "Apple ilə davam et": "Apple ile devam et", "və ya e-poçt ilə": "veya e-posta ile", "Qeydiyyat": "Kayıt ol", "Adın": "Adın", "E-poçt": "E-posta", "Şifrə": "Şifre", "Link göndər": "Bağlantı gönder", "Hesab yarat": "Hesap oluştur", "Girişə qayıt": "Girişe dön", "Şifrəni unutmusan?": "Şifreni mi unuttun?", "Google ilə giriş başlamadı. Yenidən cəhd et.": "Google ile giriş başlamadı. Tekrar dene.", "Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.": "Tarayıcı yeni pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar dene.", "Apple ilə giriş ləğv edildi.": "Apple ile giriş iptal edildi.", "Apple ilə giriş tamamlanmadı. Yenidən cəhd et.": "Apple ile giriş tamamlanmadı. Tekrar dene.", "Adını yaz.": "Adını yaz.", "Şifrə bərpa linki e-poçtuna göndərildi.": "Şifre sıfırlama bağlantısı e-postana gönderildi.", "Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.": "Hesap oluşturuldu. Devam etmek için e-postandaki bağlantıyı aç.", "Giriş tamamlanmadı. Yenidən cəhd et.": "Giriş tamamlanmadı. Tekrar dene.", "E-poçtunu təsdiqlə": "E-postanı doğrula", "Kod": "Kod", "Təsdiqlə": "Doğrula", "Kodu yenidən göndər": "Kodu tekrar gönder", "Başqa hesabla gir": "Başka hesapla giriş yap", "Yeni kod göndərildi.": "Yeni kod gönderildi.", "Bir az gözlə və yenidən göndər": "Biraz bekle ve tekrar gönder", " san).": " sn).", "Kodu göndərmək alınmadı. Yenidən cəhd et.": "Kod gönderilemedi. Tekrar dene.", "6 rəqəmli kodu yaz.": "6 haneli kodu yaz.", "Kod yanlışdır.": "Kod yanlış.", "Kodun vaxtı bitib. Yenisini göndər.": "Kodun süresi doldu. Yenisini gönder.", "Çox cəhd edildi. Yeni kod göndər.": "Çok fazla deneme yapıldı. Yeni kod gönder.", "Təsdiqləmək alınmadı. Yenidən cəhd et.": "Doğrulanamadı. Tekrar dene.", "Çıxış": "Çıkış", "@verify_to": "<b>{e}</b> adresine 6 haneli kod gönderdik.", "@verify_plain": "E-postana 6 haneli kod gönderdik.", "@terms": "Devam ederek {t}Kullanım Koşulları{/t}'nı ve {p}Gizlilik Politikası{/p}'nı kabul etmiş olursun."}, "kk": {"Çox cəhd edildi. Bir az sonra yenidən yoxla.": "Тым көп әрекет жасалды. Сәл кейінірек қайталап көр.", "E-poçt və ya şifrə yanlışdır.": "Электрондық пошта немесе құпиясөз қате.", "Bu e-poçtla hesab artıq var. \"Daxil ol\" bölməsindən gir.": "Бұл поштамен аккаунт бар. «Кіру» бөлімінен кір.", "Şifrə ən azı 6 simvol olmalıdır.": "Құпиясөз кемінде 6 таңбадан тұруы керек.", "E-poçt ünvanını düzgün yaz.": "Пошта мекенжайын дұрыс жаз.", "E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.": "Пошта әлі расталмаған. Пошта жәшігіңді тексер.", "Daxil olmaq alınmadı. Yenidən cəhd et.": "Кіру сәтсіз аяқталды. Қайталап көр.", "Şifrəni bərpa et": "Құпиясөзді қалпына келтір", "Daxil ol": "Кіру", "E-poçtuna şifrə bərpa linki göndərəcəyik.": "Поштаңа құпиясөзді қалпына келтіру сілтемесін жібереміз.", "Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.": "Anacan аккаунтыңмен кір: қолданбадағы сол аккаунт.", "Google ilə davam et": "Google арқылы жалғастыру", "Apple ilə davam et": "Apple арқылы жалғастыру", "və ya e-poçt ilə": "немесе пошта арқылы", "Qeydiyyat": "Тіркелу", "Adın": "Атың", "E-poçt": "Пошта", "Şifrə": "Құпиясөз", "Link göndər": "Сілтеме жіберу", "Hesab yarat": "Аккаунт ашу", "Girişə qayıt": "Кіруге оралу", "Şifrəni unutmusan?": "Құпиясөзді ұмыттың ба?", "Google ilə giriş başlamadı. Yenidən cəhd et.": "Google арқылы кіру басталмады. Қайталап көр.", "Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.": "Браузер жаңа терезені бұғаттады. Осы сайт үшін қалқымалы терезелерге рұқсат беріп, қайталап көр.", "Apple ilə giriş ləğv edildi.": "Apple арқылы кіру тоқтатылды.", "Apple ilə giriş tamamlanmadı. Yenidən cəhd et.": "Apple арқылы кіру аяқталмады. Қайталап көр.", "Adını yaz.": "Атыңды жаз.", "Şifrə bərpa linki e-poçtuna göndərildi.": "Құпиясөзді қалпына келтіру сілтемесі поштаңа жіберілді.", "Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.": "Аккаунт ашылды. Жалғастыру үшін поштаңдағы сілтемені аш.", "Giriş tamamlanmadı. Yenidən cəhd et.": "Кіру аяқталмады. Қайталап көр.", "E-poçtunu təsdiqlə": "Поштаңды раста", "Kod": "Код", "Təsdiqlə": "Растау", "Kodu yenidən göndər": "Кодты қайта жіберу", "Başqa hesabla gir": "Басқа аккаунтпен кіру", "Yeni kod göndərildi.": "Жаңа код жіберілді.", "Bir az gözlə və yenidən göndər": "Сәл күтіп, қайта жібер", " san).": " сек).", "Kodu göndərmək alınmadı. Yenidən cəhd et.": "Кодты жіберу мүмкін болмады. Қайталап көр.", "6 rəqəmli kodu yaz.": "6 таңбалы кодты жаз.", "Kod yanlışdır.": "Код қате.", "Kodun vaxtı bitib. Yenisini göndər.": "Кодтың мерзімі өтті. Жаңасын жібер.", "Çox cəhd edildi. Yeni kod göndər.": "Тым көп әрекет. Жаңа код жібер.", "Təsdiqləmək alınmadı. Yenidən cəhd et.": "Растау мүмкін болмады. Қайталап көр.", "Çıxış": "Шығу", "@verify_to": "<b>{e}</b> мекенжайына 6 таңбалы код жібердік.", "@verify_plain": "Поштаңа 6 таңбалы код жібердік.", "@terms": "Жалғастыра отырып, {t}Пайдалану шарттарымен{/t} және {p}Құпиялылық саясатымен{/p} келісесің."}, "uz": {"Çox cəhd edildi. Bir az sonra yenidən yoxla.": "Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring.", "E-poçt və ya şifrə yanlışdır.": "Elektron pochta yoki parol noto‘g‘ri.", "Bu e-poçtla hesab artıq var. \"Daxil ol\" bölməsindən gir.": "Bu pochta bilan hisob allaqachon bor. \"Kirish\" bo‘limidan kiring.", "Şifrə ən azı 6 simvol olmalıdır.": "Parol kamida 6 ta belgidan iborat bo‘lishi kerak.", "E-poçt ünvanını düzgün yaz.": "Elektron pochta manzilini to‘g‘ri kiriting.", "E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.": "Pochta hali tasdiqlanmagan. Pochta qutingizni tekshiring.", "Daxil olmaq alınmadı. Yenidən cəhd et.": "Kirish amalga oshmadi. Qayta urinib ko‘ring.", "Şifrəni bərpa et": "Parolni tiklash", "Daxil ol": "Kirish", "E-poçtuna şifrə bərpa linki göndərəcəyik.": "Pochtangizga parolni tiklash havolasini yuboramiz.", "Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.": "Anacan hisobingiz bilan kiring: ilovadagi o‘sha hisob.", "Google ilə davam et": "Google bilan davom etish", "Apple ilə davam et": "Apple bilan davom etish", "və ya e-poçt ilə": "yoki elektron pochta bilan", "Qeydiyyat": "Ro‘yxatdan o‘tish", "Adın": "Ismingiz", "E-poçt": "Elektron pochta", "Şifrə": "Parol", "Link göndər": "Havola yuborish", "Hesab yarat": "Hisob yaratish", "Girişə qayıt": "Kirishga qaytish", "Şifrəni unutmusan?": "Parolni unutdingizmi?", "Google ilə giriş başlamadı. Yenidən cəhd et.": "Google bilan kirish boshlanmadi. Qayta urinib ko‘ring.", "Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.": "Brauzer yangi oynani blokladi. Bu sayt uchun qalqib chiquvchi oynalarga ruxsat berib, qayta urinib ko‘ring.", "Apple ilə giriş ləğv edildi.": "Apple bilan kirish bekor qilindi.", "Apple ilə giriş tamamlanmadı. Yenidən cəhd et.": "Apple bilan kirish yakunlanmadi. Qayta urinib ko‘ring.", "Adını yaz.": "Ismingizni kiriting.", "Şifrə bərpa linki e-poçtuna göndərildi.": "Parolni tiklash havolasi pochtangizga yuborildi.", "Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.": "Hisob yaratildi. Davom etish uchun pochtangizdagi havolani oching.", "Giriş tamamlanmadı. Yenidən cəhd et.": "Kirish yakunlanmadi. Qayta urinib ko‘ring.", "E-poçtunu təsdiqlə": "Pochtangizni tasdiqlang", "Kod": "Kod", "Təsdiqlə": "Tasdiqlash", "Kodu yenidən göndər": "Kodni qayta yuborish", "Başqa hesabla gir": "Boshqa hisob bilan kirish", "Yeni kod göndərildi.": "Yangi kod yuborildi.", "Bir az gözlə və yenidən göndər": "Biroz kutib, qayta yuboring", " san).": " son).", "Kodu göndərmək alınmadı. Yenidən cəhd et.": "Kodni yuborib bo‘lmadi. Qayta urinib ko‘ring.", "6 rəqəmli kodu yaz.": "6 xonali kodni kiriting.", "Kod yanlışdır.": "Kod noto‘g‘ri.", "Kodun vaxtı bitib. Yenisini göndər.": "Kod muddati tugadi. Yangisini yuboring.", "Çox cəhd edildi. Yeni kod göndər.": "Juda ko‘p urinish. Yangi kod yuboring.", "Təsdiqləmək alınmadı. Yenidən cəhd et.": "Tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.", "Çıxış": "Chiqish", "@verify_to": "<b>{e}</b> manziliga 6 xonali kod yubordik.", "@verify_plain": "Pochtangizga 6 xonali kod yubordik.", "@terms": "Davom etib, {t}Foydalanish shartlari{/t} va {p}Maxfiylik siyosati{/p}ga rozilik bildirasiz."}};
  function S(az) { var d = TR[LANG]; return (d && d[az]) || az; }
  function setLang(l) { LANG = TR[l] ? l : 'az'; }

  // ── Login UI ──────────────────────────────────────────────────────────────────────────
  var GOOGLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.2-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>';
  var APPLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.5 2.1-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.8zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>';

  function authErrorText(error) {
    var m = String((error && (error.message || error.code)) || '').toLowerCase();
    var status = error && error.status;
    if (status === 429 || m.indexOf('rate') >= 0) return S('Çox cəhd edildi. Bir az sonra yenidən yoxla.');
    if (m.indexOf('invalid login') >= 0 || m.indexOf('invalid_credentials') >= 0) return S('E-poçt və ya şifrə yanlışdır.');
    if (m.indexOf('already registered') >= 0 || m.indexOf('already_exists') >= 0 || m.indexOf('user_already') >= 0) return S('Bu e-poçtla hesab artıq var. "Daxil ol" bölməsindən gir.');
    if (m.indexOf('password') >= 0 && (m.indexOf('least') >= 0 || m.indexOf('weak') >= 0 || m.indexOf('short') >= 0)) return S('Şifrə ən azı 6 simvol olmalıdır.');
    if (m.indexOf('email') >= 0 && m.indexOf('invalid') >= 0) return S('E-poçt ünvanını düzgün yaz.');
    if (m.indexOf('not confirmed') >= 0) return S('E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.');
    return S('Daxil olmaq alınmadı. Yenidən cəhd et.');
  }

  /**
   * Renders the login card into `el`. opts: {title, subtitle}. Signing in fires onAuthStateChange (SIGNED_IN), which the
   * page handles; the card only shows progress and errors.
   */
  function renderLogin(el, opts) {
    opts = opts || {};
    var mode = 'login';
    var busy = false;
    function draw(message, kind) {
      var signup = mode === 'signup', forgot = mode === 'forgot';
      el.innerHTML =
        '<div class="auth">' +
        '<h2>' + esc(forgot ? S('Şifrəni bərpa et') : opts.title || S('Daxil ol')) + '</h2>' +
        '<p class="sub">' + esc(forgot ? S('E-poçtuna şifrə bərpa linki göndərəcəyik.') : opts.subtitle || S('Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.')) + '</p>' +
        (message ? '<p class="msg ' + (kind || 'err') + '" role="alert">' + esc(message) + '</p>' : '') +
        (forgot ? '' :
          '<div class="social">' +
          '<button type="button" class="sbtn" data-google>' + GOOGLE_SVG + S('Google ilə davam et') + '</button>' +
          '<button type="button" class="sbtn apple" data-apple>' + APPLE_SVG + S('Apple ilə davam et') + '</button>' +
          '</div><div class="or">' + S('və ya e-poçt ilə') + '</div>' +
          '<div class="tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="' + (!signup) + '">' + S('Daxil ol') + '</button>' +
          '<button type="button" role="tab" data-mode="signup" aria-selected="' + signup + '">' + S('Qeydiyyat') + '</button></div>') +
        '<form novalidate>' +
        (signup ? '<label class="field"><span>' + S('Adın') + '</span><input name="name" autocomplete="given-name" maxlength="80" required></label>' : '') +
        '<label class="field"><span>' + S('E-poçt') + '</span><input name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required></label>' +
        (forgot ? '' : '<label class="field"><span>' + S('Şifrə') + '</span><input name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="6" maxlength="72" required></label>') +
        '<button class="cta" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="spinner"></span>' : esc(forgot ? S('Link göndər') : signup ? S('Hesab yarat') : S('Daxil ol'))) + '</button>' +
        '</form>' +
        '<div class="row" style="justify-content:center;margin-top:12px">' +
        (forgot ? '<button type="button" class="link" data-mode="login">' + S('Girişə qayıt') + '</button>'
          : mode === 'login' ? '<button type="button" class="link" data-mode="forgot">' + S('Şifrəni unutmusan?') + '</button>' : '') +
        '</div>' +
        '<p class="terms">' + (LANG === 'az' ? 'Davam etməklə <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a> və <a href="https://anacan.az/privacy" target="_blank" rel="noopener">Məxfilik siyasəti</a> ilə razılaşırsan.'
          : S('@terms').replace('{t}', '<a href="https://anacan.az/terms" target="_blank" rel="noopener">').replace('{/t}', '</a>').replace('{p}', '<a href="https://anacan.az/privacy" target="_blank" rel="noopener">').replace('{/p}', '</a>')) + '</p>' +
        '</div>';
      el.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); draw(); }); });
      var g = el.querySelector('[data-google]');
      if (g) g.addEventListener('click', google);
      var a = el.querySelector('[data-apple]');
      if (a) a.addEventListener('click', apple);
      el.querySelector('form').addEventListener('submit', submit);
    }

    async function google() {
      try {
        var c = await client();
        var res = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
        if (res.error) throw res.error;
      } catch (e) { draw(S('Google ilə giriş başlamadı. Yenidən cəhd et.')); }
    }

    function apple() {
      var nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      var width = 520, height = 700;
      var left = Math.max(0, (screen.width - width) / 2), top = Math.max(0, (screen.height - height) / 2);
      var popup = window.open(APPLE_BRIDGE + '?n=' + nonce, 'anacan-apple', 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top);
      if (!popup) { draw(S('Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.')); return; }
      var done = false;
      function finish() { done = true; window.removeEventListener('message', listen); clearInterval(watch); }
      async function listen(event) {
        if (event.origin !== API || event.source !== popup) return;
        var d = event.data;
        if (!d || typeof d !== 'object' || d.n !== nonce) return;
        if (d.type === 'anacan-apple-error') { finish(); draw(d.cancelled ? S('Apple ilə giriş ləğv edildi.') : S('Apple ilə giriş tamamlanmadı. Yenidən cəhd et.')); return; }
        if (d.type !== 'anacan-apple-session' || typeof d.access_token !== 'string' || typeof d.refresh_token !== 'string') return;
        finish();
        busy = true; draw();
        try {
          var c = await client();
          var res = await c.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
          if (res.error || !res.data.session) throw res.error || new Error('session');
        } catch (e) { busy = false; draw(S('Apple ilə giriş tamamlanmadı. Yenidən cəhd et.')); }
        try { popup.close(); } catch (e) { /* ignore */ }
      }
      window.addEventListener('message', listen);
      var watch = setInterval(function () { if (popup.closed && !done) finish(); }, 800);
    }

    async function submit(event) {
      event.preventDefault();
      if (busy) return;
      var form = event.target;
      var email = (form.email.value || '').trim().toLowerCase();
      var password = form.password ? form.password.value : '';
      var name = form.name && form.name.value ? form.name.value.trim().slice(0, 80) : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { draw(S('E-poçt ünvanını düzgün yaz.')); restore(); return; }
      if (mode !== 'forgot' && password.length < 6) { draw(S('Şifrə ən azı 6 simvol olmalıdır.')); restore(); return; }
      if (mode === 'signup' && name.length < 2) { draw(S('Adını yaz.')); restore(); return; }
      busy = true; draw(); restore();
      try {
        var c = await client();
        if (mode === 'forgot') {
          var r = await c.auth.resetPasswordForEmail(email, { redirectTo: API + '/reset-password' });
          if (r.error) throw r.error;
          busy = false; mode = 'login'; draw(S('Şifrə bərpa linki e-poçtuna göndərildi.'), 'ok'); restore();
          return;
        }
        var res = mode === 'signup'
          ? await c.auth.signUp({ email: email, password: password, options: { data: { name: name, language: LANG } } })
          : await c.auth.signInWithPassword({ email: email, password: password });
        if (res.error) throw res.error;
        if (!res.data.session) { busy = false; draw(S('Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.'), 'ok'); return; }
        // Success: onAuthStateChange(SIGNED_IN) lets the page continue.
      } catch (e) {
        busy = false; draw(authErrorText(e)); restore();
      }
      function restore() { var f = el.querySelector('form'); if (f) { f.email.value = email; if (f.name) f.name.value = name; } }
    }

    draw(redirectError ? S('Giriş tamamlanmadı. Yenidən cəhd et.') : null);
    redirectError = null;
  }

  /** E-mail code step (the app's e-mail verification for new e-mail/password accounts). */
  function renderVerify(el, email, onDone) {
    var busy = false;
    function draw(message, kind) {
      el.innerHTML = '<div class="auth"><h2>' + S('E-poçtunu təsdiqlə') + '</h2>' +
        '<p class="sub">' + (LANG === 'az' ? (email ? '<b>' + esc(email) + '</b> ünvanına ' : 'E-poçtuna ') + '6 rəqəmli kod göndərdik.' : email ? S('@verify_to').replace('{e}', esc(email)) : S('@verify_plain')) + '</p>' +
        (message ? '<p class="msg ' + (kind || 'err') + '" role="alert">' + esc(message) + '</p>' : '') +
        '<form novalidate><label class="field code"><span>' + S('Kod') + '</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>' +
        '<button class="cta" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="spinner"></span>' : S('Təsdiqlə')) + '</button></form>' +
        '<div class="row" style="justify-content:space-between;margin-top:12px"><button type="button" class="link" data-resend>' + S('Kodu yenidən göndər') + '</button>' +
        '<button type="button" class="link" data-out>' + S('Başqa hesabla gir') + '</button></div></div>';
      el.querySelector('[data-resend]').addEventListener('click', function () { send(true); });
      el.querySelector('[data-out]').addEventListener('click', function () { signOut(); });
      el.querySelector('form').addEventListener('submit', confirm);
      var input = el.querySelector('input[name="code"]');
      if (input) input.focus({ preventScroll: true });
    }
    async function send(manual) {
      var d = await verification({ action: 'send' });
      if (d.sent === true) { if (manual) draw(S('Yeni kod göndərildi.'), 'ok'); return; }
      draw(d.error === 'rate_limited' ? S('Bir az gözlə və yenidən göndər') + (d.retry_in ? ' (' + d.retry_in + S(' san).') : '.') : S('Kodu göndərmək alınmadı. Yenidən cəhd et.'));
    }
    async function confirm(event) {
      event.preventDefault();
      var code = (event.target.code.value || '').replace(/\D/g, '');
      if (code.length !== 6) { draw(S('6 rəqəmli kodu yaz.')); return; }
      busy = true; draw();
      var d = await verification({ action: 'confirm', code: code });
      busy = false;
      if (d.verified === true) { onDone(); return; }
      draw(d.error === 'wrong_code' ? S('Kod yanlışdır.') : d.error === 'expired' ? S('Kodun vaxtı bitib. Yenisini göndər.')
        : d.error === 'too_many' ? S('Çox cəhd edildi. Yeni kod göndər.') : S('Təsdiqləmək alınmadı. Yenidən cəhd et.'));
    }
    draw();
    send(false);
  }

  /** Header chip with the signed-in e-mail and a sign-out button. */
  function renderWho(el, s) {
    if (!el) return;
    if (!s) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    var email = (s.user && (s.user.email || (s.user.user_metadata && s.user.user_metadata.email))) || '';
    el.innerHTML = '<span class="email">' + esc(email) + '</span><button type="button">' + S('Çıxış') + '</button>';
    el.querySelector('button').addEventListener('click', function () { signOut(); });
  }

  window.AnacanAccount = {
    API: API, SITE: SITE, client: client, withTimeout: withTimeout, session: session, onChange: onChange, signOut: signOut, call: call,
    setLang: setLang, needsVerification: needsVerification, renderLogin: renderLogin, renderVerify: renderVerify, renderWho: renderWho,
    toast: toast, esc: esc, money: money, day: day,
    key: function () { return publishableKey; },
  };
})();
