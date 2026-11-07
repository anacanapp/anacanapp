// deno-lint-ignore-file no-explicit-any
// No npm:/Deno globals here: send-push-notification/index.ts injects the Supabase client, auth
// and env, so this module is importable by the Node test suite (src/lib/interaction-push.test.ts).
import { getFirebaseAccessToken } from './fcm.ts';
import { LANGUAGE_CODES } from './languages.ts';
import { serverCopy } from './localized-copy.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'X-Anacan-Push-Runtime': 'communications-v2',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Server-owned copy using useCommunity/useStories/useDirectMessages and partner
// translation terminology (src/locales and scripts/i18n). No runtime locale imports.
const messages = {
  message: {
    az: "Yeni mesaj", en: "New message", ru: "\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435",
    tr: "Yeni mesaj", kk: "\u0416\u0430\u04a3\u0430 \u0445\u0430\u0431\u0430\u0440\u043b\u0430\u043c\u0430", uz: "Yangi xabar",
    ka: "\u10d0\u10ee\u10d0\u10da\u10d8 \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0", de: "Neue Nachricht", ar: "\u0631\u0633\u0627\u0644\u0629 \u062c\u062f\u064a\u062f\u0629",
  },
  like: {
    az: "Yeni b\u0259y\u0259nm\u0259", en: "New like", ru: "\u041d\u043e\u0432\u044b\u0439 \u043b\u0430\u0439\u043a",
    tr: "Yeni be\u011feni", kk: "\u0416\u0430\u04a3\u0430 \u04b1\u043d\u0430\u0442\u0443", uz: "Yangi yoqtirish",
    ka: "\u10d0\u10ee\u10d0\u10da\u10d8 \u10db\u10dd\u10ec\u10dd\u10dc\u10d4\u10d1\u10d0", de: "Neues Gef\u00e4llt mir", ar: "\u0625\u0639\u062c\u0627\u0628 \u062c\u062f\u064a\u062f",
  },
  comment: {
    az: "Yeni \u015f\u0259rh", en: "New comment", ru: "\u041d\u043e\u0432\u044b\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439",
    tr: "Yeni yorum", kk: "\u0416\u0430\u04a3\u0430 \u043f\u0456\u043a\u0456\u0440", uz: "Yangi izoh",
    ka: "\u10d0\u10ee\u10d0\u10da\u10d8 \u10d9\u10dd\u10db\u10d4\u10dc\u10e2\u10d0\u10e0\u10d8", de: "Neuer Kommentar", ar: "\u062a\u0639\u0644\u064a\u0642 \u062c\u062f\u064a\u062f",
  },
  reply: {
    az: "Yeni cavab", en: "New reply", ru: "\u041d\u043e\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442",
    tr: "Yeni yan\u0131t", kk: "\u0416\u0430\u04a3\u0430 \u0436\u0430\u0443\u0430\u043f", uz: "Yangi javob",
    ka: "\u10d0\u10ee\u10d0\u10da\u10d8 \u10de\u10d0\u10e1\u10e3\u10ee\u10d8", de: "Neue Antwort", ar: "\u0631\u062f \u062c\u062f\u064a\u062f",
  },
  repliedToComment: {
    az: '{sender} rəyinizə cavab yazdı', en: '{sender} replied to your comment', ru: '{sender} ответил(а) на ваш комментарий',
    tr: '{sender} yorumunuza yanıt verdi', kk: '{sender} пікіріңізге жауап берді', uz: '{sender} izohingizga javob berdi',
    ka: '{sender} უპასუხა თქვენს კომენტარს', de: '{sender} hat auf deinen Kommentar geantwortet', ar: '{sender} ردّ على تعليقك',
  },
  commentLike: {
    az: "\u015e\u0259rhiniz b\u0259y\u0259nildi", en: "Your comment was liked", ru: "\u0412\u0430\u0448 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0441\u044f",
    tr: "Yorumunuz be\u011fenildi", kk: "\u041f\u0456\u043a\u0456\u0440\u0456\u04a3\u0456\u0437 \u04b1\u043d\u0430\u0434\u044b", uz: "Izohingiz yoqtirildi",
    ka: "\u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10d9\u10dd\u10db\u10d4\u10dc\u10e2\u10d0\u10e0\u10d8 \u10db\u10dd\u10d8\u10ec\u10dd\u10dc\u10d4\u10e1", de: "Dein Kommentar wurde geliket", ar: "\u062a\u0645 \u0627\u0644\u0625\u0639\u062c\u0627\u0628 \u0628\u062a\u0639\u0644\u064a\u0642\u0643",
  },
  thankYou: {
    az: "T\u0259\u015f\u0259kk\u00fcr ald\u0131n\u0131z!", en: "You got a thank-you!", ru: "\u0412\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u043d\u043e\u0441\u0442\u044c!",
    tr: "Te\u015fekk\u00fcr ald\u0131n\u0131z!", kk: "\u0421\u0456\u0437\u0433\u0435 \u0430\u043b\u0493\u044b\u0441 \u0431\u0456\u043b\u0434\u0456\u0440\u0434\u0456!", uz: "Minnatdorchilik oldingiz!",
    ka: "\u10db\u10d0\u10d3\u10da\u10dd\u10d1\u10d0 \u10db\u10d8\u10d8\u10e6\u10d4\u10d7!", de: "Du hast ein Dankesch\u00f6n erhalten!", ar: "\u062a\u0644\u0642\u064a\u062a \u0634\u0643\u0631\u064b\u0627!",
  },
  contraction: {
    az: "Sanc\u0131 x\u0259b\u0259rdarl\u0131\u011f\u0131", en: "Contraction alert", ru: "\u041e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u0435 \u043e \u0441\u0445\u0432\u0430\u0442\u043a\u0430\u0445",
    tr: "Sanc\u0131 uyar\u0131s\u0131", kk: "\u0422\u043e\u043b\u0493\u0430\u049b \u0442\u0443\u0440\u0430\u043b\u044b \u0435\u0441\u043a\u0435\u0440\u0442\u0443", uz: "To'lg'oq haqida ogohlantirish",
    ka: "\u10e8\u10d4\u10d9\u10e3\u10db\u10e8\u10d5\u10d4\u10d1\u10d8\u10e1 \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0", de: "Wehenalarm", ar: "\u062a\u0646\u0628\u064a\u0647 \u0627\u0644\u0627\u0646\u0642\u0628\u0627\u0636\u0627\u062a",
  },
  shopping: {
    az: "Al\u0131\u015fveri\u015f siyah\u0131s\u0131na \u0259lav\u0259", en: "Shopping list update", ru: "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0432 \u0441\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u043a\u0443\u043f\u043e\u043a",
    tr: "Al\u0131\u015fveri\u015f listesine ekleme", kk: "\u0421\u0430\u0442\u044b\u043f \u0430\u043b\u0443 \u0442\u0456\u0437\u0456\u043c\u0456\u043d\u0435 \u049b\u043e\u0441\u0443", uz: "Xaridlar ro'yxatiga qo'shish",
    ka: "\u10e1\u10d0\u10e7\u10d8\u10d3\u10da\u10d4\u10d1\u10d8\u10e1 \u10e1\u10d8\u10d0\u10e8\u10d8 \u10d3\u10d0\u10db\u10d0\u10e2\u10d4\u10d1\u10d0", de: "Einkaufsliste aktualisiert", ar: "\u0625\u0636\u0627\u0641\u0629 \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062a\u0633\u0648\u0642",
  },
  sos: {
    az: "T\u0259cili x\u0259b\u0259rdarl\u0131q!", en: "Urgent partner alert", ru: "\u042d\u043a\u0441\u0442\u0440\u0435\u043d\u043d\u043e\u0435 \u043e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u0435!",
    tr: "Acil uyar\u0131!", kk: "\u0428\u04b1\u0493\u044b\u043b \u0435\u0441\u043a\u0435\u0440\u0442\u0443!", uz: "Shoshilinch ogohlantirish!",
    ka: "\u10e1\u10d0\u10d2\u10d0\u10dc\u10d2\u10d0\u10e8\u10dd \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0!", de: "Notfallalarm!", ar: "\u062a\u0646\u0628\u064a\u0647 \u0639\u0627\u062c\u0644!",
  },
  birth: {
    az: "Do\u011fu\u015f siqnal\u0131!", en: "Birth alert", ru: "\u0421\u0438\u0433\u043d\u0430\u043b \u0440\u043e\u0434\u043e\u0432!",
    tr: "Do\u011fum sinyali!", kk: "\u0411\u043e\u0441\u0430\u043d\u0443 \u0431\u0435\u043b\u0433\u0456\u0441\u0456!", uz: "Tug'ruq signali!",
    ka: "\u10db\u10e8\u10dd\u10d1\u10d8\u10d0\u10e0\u10dd\u10d1\u10d8\u10e1 \u10e1\u10d8\u10d2\u10dc\u10d0\u10da\u10d8!", de: "Geburtsalarm!", ar: "\u062a\u0646\u0628\u064a\u0647 \u0628\u062f\u0621 \u0627\u0644\u0645\u062e\u0627\u0636!",
  },
  diagnostic: {
    az: "Anacan bildiri\u015f testi", en: "Anacan push test", ru: "\u0422\u0435\u0441\u0442 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 Anacan",
    tr: "Anacan bildirim testi", kk: "Anacan \u0445\u0430\u0431\u0430\u0440\u043b\u0430\u043d\u0434\u044b\u0440\u0443 \u0441\u044b\u043d\u0430\u0493\u044b", uz: "Anacan bildirishnoma testi",
    ka: "Anacan \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d8\u10e1 \u10e2\u10d4\u10e1\u10e2\u10d8", de: "Anacan-Benachrichtigungstest", ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0625\u0634\u0639\u0627\u0631\u0627\u062a Anacan",
  },
  diagnosticBody: {
    az: "Bu, hesab\u0131n\u0131z \u00fc\u00e7\u00fcn s\u0131naq bildiri\u015fidir.", en: "This is a test notification for your account.", ru: "\u042d\u0442\u043e \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u0432\u0430\u0448\u0435\u0433\u043e \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430.",
    tr: "Bu, hesab\u0131n\u0131z i\u00e7in bir test bildirimidir.", kk: "\u0411\u04b1\u043b \u0435\u0441\u0435\u043f\u0442\u0456\u043a \u0436\u0430\u0437\u0431\u0430\u04a3\u044b\u0437\u0493\u0430 \u0430\u0440\u043d\u0430\u043b\u0493\u0430\u043d \u0441\u044b\u043d\u0430\u049b \u0445\u0430\u0431\u0430\u0440\u043b\u0430\u043d\u0434\u044b\u0440\u0443\u044b.", uz: "Bu hisobingiz uchun sinov bildirishnomasi.",
    ka: "\u10d4\u10e1 \u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10d0\u10dc\u10d2\u10d0\u10e0\u10d8\u10e8\u10d8\u10e1 \u10e1\u10d0\u10ea\u10d3\u10d4\u10da\u10d8 \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0\u10d0.", de: "Dies ist eine Testbenachrichtigung f\u00fcr dein Konto.", ar: "\u0647\u0630\u0627 \u0625\u0634\u0639\u0627\u0631 \u062a\u062c\u0631\u064a\u0628\u064a \u0644\u062d\u0633\u0627\u0628\u0643.",
  },
  user: {
    az: "\u0130stifad\u0259\u00e7i", en: "User", ru: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c",
    tr: "Kullan\u0131c\u0131", kk: "\u041f\u0430\u0439\u0434\u0430\u043b\u0430\u043d\u0443\u0448\u044b", uz: "Foydalanuvchi",
    ka: "\u10db\u10dd\u10db\u10ee\u10db\u10d0\u10e0\u10d4\u10d1\u10d4\u10da\u10d8", de: "Nutzer", ar: "\u0645\u0633\u062a\u062e\u062f\u0645",
  },
  anonymous: {
    az: "Anonim", en: "Anonymous", ru: "\u0410\u043d\u043e\u043d\u0438\u043c",
    tr: "Anonim", kk: "\u0410\u043d\u043e\u043d\u0438\u043c", uz: "Anonim",
    ka: "\u10d0\u10dc\u10dd\u10dc\u10d8\u10db\u10e3\u10e0\u10d8", de: "Anonym", ar: "\u0645\u062c\u0647\u0648\u0644",
  },
  postLiked: {
    az: "{sender} payla\u015f\u0131m\u0131n\u0131z\u0131 b\u0259y\u0259ndi.", en: "{sender} liked your post.", ru: "{sender} \u043e\u0446\u0435\u043d\u0438\u043b(\u0430) \u0432\u0430\u0448 \u043f\u043e\u0441\u0442.",
    tr: "{sender} g\u00f6nderinizi be\u011fendi.", kk: "{sender} \u0436\u0430\u0440\u0438\u044f\u043b\u0430\u043d\u044b\u043c\u044b\u04a3\u044b\u0437\u0434\u044b \u04b1\u043d\u0430\u0442\u0442\u044b.", uz: "{sender} postingizni yoqtirdi.",
    ka: "{sender} \u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10de\u10dd\u10e1\u10e2\u10d8 \u10db\u10dd\u10d8\u10ec\u10dd\u10dc\u10d0.", de: "{sender} gef\u00e4llt dein Beitrag.", ar: "{sender} \u0623\u0639\u062c\u0628 \u0628\u0645\u0646\u0634\u0648\u0631\u0643.",
  },
  storyLiked: {
    az: "{sender} story-nizi b\u0259y\u0259ndi.", en: "{sender} liked your story.", ru: "{sender} \u043e\u0446\u0435\u043d\u0438\u043b(\u0430) \u0432\u0430\u0448\u0443 \u0438\u0441\u0442\u043e\u0440\u0438\u044e.",
    tr: "{sender} hikayenizi be\u011fendi.", kk: "{sender} story-\u0456\u04a3\u0456\u0437\u0434\u0456 \u04b1\u043d\u0430\u0442\u0442\u044b.", uz: "{sender} storyingizni yoqtirdi.",
    ka: "{sender} \u10db\u10dd\u10d8\u10ec\u10dd\u10dc\u10d0 \u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10e1\u10d7\u10dd\u10e0\u10d8.", de: "{sender} hat deine Story geliket.", ar: "{sender} \u0623\u0639\u062c\u0628 \u0628\u0642\u0635\u062a\u0643.",
  },
  commentLiked: {
    az: "{sender} \u015f\u0259rhinizi b\u0259y\u0259ndi.", en: "{sender} liked your comment.", ru: "{sender} \u043e\u0446\u0435\u043d\u0438\u043b(\u0430) \u0432\u0430\u0448 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439.",
    tr: "{sender} yorumunuzu be\u011fendi.", kk: "{sender} \u043f\u0456\u043a\u0456\u0440\u0456\u04a3\u0456\u0437\u0434\u0456 \u04b1\u043d\u0430\u0442\u0442\u044b.", uz: "{sender} izohingizni yoqtirdi.",
    ka: "{sender} \u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10d9\u10dd\u10db\u10d4\u10dc\u10e2\u10d0\u10e0\u10d8 \u10db\u10dd\u10d8\u10ec\u10dd\u10dc\u10d0.", de: "{sender} gef\u00e4llt dein Kommentar.", ar: "{sender} \u0623\u0639\u062c\u0628 \u0628\u062a\u0639\u0644\u064a\u0642\u0643.",
  },
  shoppingAdded: {
    az: "{sender} siyah\u0131ya {item} \u0259lav\u0259 etdi. Siyah\u0131n\u0131 yoxla!", en: "{sender} added {item} to the shopping list.", ru: "{sender} \u0434\u043e\u0431\u0430\u0432\u0438\u043b(\u0430) {item} \u0432 \u0441\u043f\u0438\u0441\u043e\u043a \u043f\u043e\u043a\u0443\u043f\u043e\u043a.",
    tr: "{sender} al\u0131\u015fveri\u015f listesine {item} ekledi.", kk: "{sender} \u0441\u0430\u0442\u044b\u043f \u0430\u043b\u0443 \u0442\u0456\u0437\u0456\u043c\u0456\u043d\u0435 {item} \u049b\u043e\u0441\u0442\u044b.", uz: "{sender} xaridlar ro'yxatiga {item} qo'shdi.",
    ka: "{sender} \u10e1\u10d0\u10e7\u10d8\u10d3\u10da\u10d4\u10d1\u10d8\u10e1 \u10e1\u10d8\u10d0\u10e8\u10d8 \u10d3\u10d0\u10d0\u10db\u10d0\u10e2\u10d0 {item}.", de: "{sender} hat {item} zur Einkaufsliste hinzugef\u00fcgt.", ar: "{sender} \u0623\u0636\u0627\u0641 {item} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062a\u0633\u0648\u0642.",
  },
  thanks: {
    az: "{sender} siz\u0259 t\u0259\u015f\u0259kk\u00fcr etdi.", en: "{sender} sent you a thank-you.", ru: "{sender} \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u0442 \u0432\u0430\u0441.",
    tr: "{sender} size te\u015fekk\u00fcr etti.", kk: "{sender} \u0441\u0456\u0437\u0433\u0435 \u0430\u043b\u0493\u044b\u0441 \u0431\u0456\u043b\u0434\u0456\u0440\u0434\u0456.", uz: "{sender} sizga minnatdorchilik bildirdi.",
    ka: "{sender} \u10db\u10d0\u10d3\u10da\u10dd\u10d1\u10d0\u10e1 \u10d2\u10d8\u10ee\u10d3\u10d8\u10d7.", de: "{sender} sagt dir Danke.", ar: "{sender} \u064a\u0634\u0643\u0631\u0643.",
  },
  contractionAlert: {
    az: "{sender} sanc\u0131 bar\u0259d\u0259 x\u0259b\u0259rdarl\u0131q g\u00f6nd\u0259rdi. \u018ftrafl\u0131 m\u0259lumat \u00fc\u00e7\u00fcn Anacan-\u0131 a\u00e7\u0131n.", en: "{sender} sent a contraction alert. Open Anacan for details.", ru: "{sender} \u0441\u043e\u043e\u0431\u0449\u0430\u0435\u0442 \u043e \u0441\u0445\u0432\u0430\u0442\u043a\u0430\u0445. \u041f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438 \u0432 Anacan.",
    tr: "{sender} sanc\u0131 uyar\u0131s\u0131 g\u00f6nderdi. Ayr\u0131nt\u0131lar i\u00e7in Anacan uygulamas\u0131n\u0131 a\u00e7\u0131n.", kk: "{sender} \u0442\u043e\u043b\u0493\u0430\u049b \u0442\u0443\u0440\u0430\u043b\u044b \u0435\u0441\u043a\u0435\u0440\u0442\u0443 \u0436\u0456\u0431\u0435\u0440\u0434\u0456. \u0422\u043e\u043b\u044b\u0493\u044b\u0440\u0430\u049b Anacan-\u043d\u0430\u043d \u049b\u0430\u0440\u0430\u04a3\u044b\u0437.", uz: "{sender} to'lg'oq haqida ogohlantirish yubordi. Tafsilotlar uchun Anacan'ni oching.",
    ka: "{sender} \u10e8\u10d4\u10d9\u10e3\u10db\u10e8\u10d5\u10d4\u10d1\u10d8\u10e1 \u10e8\u10d4\u10e1\u10d0\u10ee\u10d4\u10d1 \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0\u10e1 \u10d2\u10d8\u10d2\u10d6\u10d0\u10d5\u10dc\u10d8\u10d7. \u10d3\u10d4\u10e2\u10d0\u10da\u10d4\u10d1\u10d8\u10e1\u10d7\u10d5\u10d8\u10e1 \u10d2\u10d0\u10ee\u10e1\u10d4\u10dc\u10d8\u10d7 Anacan.", de: "{sender} hat einen Wehenalarm gesendet. Details findest du in Anacan.", ar: "{sender} \u0623\u0631\u0633\u0644 \u062a\u0646\u0628\u064a\u0647\u064b\u0627 \u0628\u0634\u0623\u0646 \u0627\u0644\u0627\u0646\u0642\u0628\u0627\u0636\u0627\u062a. \u0627\u0641\u062a\u062d Anacan \u0644\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644.",
  },
  image: {
    az: "\u015e\u0259kil g\u00f6nd\u0259rdi.", en: "Sent a photo.", ru: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u043b(\u0430) \u0444\u043e\u0442\u043e.",
    tr: "Foto\u011fraf g\u00f6nderdi.", kk: "\u0421\u0443\u0440\u0435\u0442 \u0436\u0456\u0431\u0435\u0440\u0434\u0456.", uz: "Rasm yubordi.",
    ka: "\u10e4\u10dd\u10e2\u10dd \u10d2\u10d0\u10db\u10dd\u10d2\u10d6\u10d0\u10d5\u10dc\u10d0.", de: "Hat ein Bild gesendet.", ar: "\u0623\u0631\u0633\u0644 \u0635\u0648\u0631\u0629.",
  },
  video: {
    az: "Video g\u00f6nd\u0259rdi.", en: "Sent a video.", ru: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u043b(\u0430) \u0432\u0438\u0434\u0435\u043e.",
    tr: "Video g\u00f6nderdi.", kk: "\u0412\u0438\u0434\u0435\u043e \u0436\u0456\u0431\u0435\u0440\u0434\u0456.", uz: "Video yubordi.",
    ka: "\u10d5\u10d8\u10d3\u10d4\u10dd \u10d2\u10d0\u10db\u10dd\u10d2\u10d6\u10d0\u10d5\u10dc\u10d0.", de: "Hat ein Video gesendet.", ar: "\u0623\u0631\u0633\u0644 \u0645\u0642\u0637\u0639 \u0641\u064a\u062f\u064a\u0648.",
  },
  audio: {
    az: "S\u0259s mesaj\u0131 g\u00f6nd\u0259rdi.", en: "Sent an audio message.", ru: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u043b(\u0430) \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.",
    tr: "Sesli mesaj g\u00f6nderdi.", kk: "\u0414\u0430\u0443\u044b\u0441\u0442\u044b\u049b \u0445\u0430\u0431\u0430\u0440\u043b\u0430\u043c\u0430 \u0436\u0456\u0431\u0435\u0440\u0434\u0456.", uz: "Ovozli xabar yubordi.",
    ka: "\u10ee\u10db\u10dd\u10d5\u10d0\u10dc\u10d8 \u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d0 \u10d2\u10d0\u10db\u10dd\u10d2\u10d6\u10d0\u10d5\u10dc\u10d0.", de: "Hat eine Sprachnachricht gesendet.", ar: "\u0623\u0631\u0633\u0644 \u0631\u0633\u0627\u0644\u0629 \u0635\u0648\u062a\u064a\u0629.",
  },
  love: {
    az: "Sevgi g\u00f6nd\u0259rdi.", en: "Sent you love.", ru: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u043b(\u0430) \u0432\u0430\u043c \u043b\u044e\u0431\u043e\u0432\u044c.",
    tr: "Size sevgi g\u00f6nderdi.", kk: "\u0421\u0456\u0437\u0433\u0435 \u0441\u04af\u0439\u0456\u0441\u043f\u0435\u043d\u0448\u0456\u043b\u0456\u043a \u0436\u0456\u0431\u0435\u0440\u0434\u0456.", uz: "Sizga mehr yubordi.",
    ka: "\u10e1\u10d8\u10e7\u10d5\u10d0\u10e0\u10e3\u10da\u10d8 \u10d2\u10d0\u10db\u10dd\u10d2\u10d8\u10d2\u10d6\u10d0\u10d5\u10dc\u10d0\u10d7.", de: "Hat dir Liebe geschickt.", ar: "\u0623\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062d\u0628.",
  },
  openMessage: {
    az: "Mesaj\u0131 g\u00f6rm\u0259k \u00fc\u00e7\u00fcn Anacan-\u0131 a\u00e7\u0131n.", en: "Open Anacan to view the message.", ru: "\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 Anacan, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435.",
    tr: "Mesaj\u0131 g\u00f6rmek i\u00e7in Anacan uygulamas\u0131n\u0131 a\u00e7\u0131n.", kk: "\u0425\u0430\u0431\u0430\u0440\u043b\u0430\u043c\u0430\u043d\u044b \u043a\u04e9\u0440\u0443 \u04af\u0448\u0456\u043d Anacan-\u0434\u044b \u0430\u0448\u044b\u04a3\u044b\u0437.", uz: "Xabarni ko'rish uchun Anacan'ni oching.",
    ka: "\u10e8\u10d4\u10e2\u10e7\u10dd\u10d1\u10d8\u10dc\u10d4\u10d1\u10d8\u10e1 \u10e1\u10d0\u10dc\u10d0\u10ee\u10d0\u10d5\u10d0\u10d3 \u10d2\u10d0\u10ee\u10e1\u10d4\u10dc\u10d8\u10d7 Anacan.", de: "\u00d6ffne Anacan, um die Nachricht zu lesen.", ar: "\u0627\u0641\u062a\u062d Anacan \u0644\u0639\u0631\u0636 \u0627\u0644\u0631\u0633\u0627\u0644\u0629.",
  },
};
const contracts: Record<string, { context: string; title: keyof typeof messages; fields: string[] }> = {
  diagnostic: { context: 'self', title: 'diagnostic', fields: [] },
  direct_message: { context: 'direct_message', title: 'message', fields: ['sender_id', 'messageId'] },
  group_message: { context: 'group_message', title: 'message', fields: ['groupId', 'messageId'] },
  // Sender-side request: the server fans one group message out to every current member,
  // through the same per-recipient pipeline (and claim) as a single group_message push.
  group_message_fanout: { context: 'group_message_fanout', title: 'message', fields: ['groupId', 'messageId'] },
  community_like: { context: 'community_post', title: 'like', fields: ['postId', 'groupId'] },
  community_comment: { context: 'community_post', title: 'comment', fields: ['postId'] },
  story_like: { context: 'community_story', title: 'like', fields: ['storyId'] },
  story_reply: { context: 'community_story', title: 'reply', fields: ['storyId'] },
  comment_like: { context: 'post_comment', title: 'commentLike', fields: ['commentId', 'postId'] },
  community_reply: { context: 'post_comment', title: 'reply', fields: ['commentId', 'postId'] },
  partner_message: { context: 'partner', title: 'message', fields: ['messageId'] },
  thank_you: { context: 'partner', title: 'thankYou', fields: ['messageId'] },
  contraction_511: { context: 'partner', title: 'contraction', fields: [] },
  shopping_list: { context: 'partner', title: 'shopping', fields: [] },
  sos_alert: { context: 'partner', title: 'sos', fields: ['alertId'] },
  birth_alert: { context: 'partner', title: 'birth', fields: ['alertId'] },
};

const GROUP_WINDOW_MS = 900_000;
const GROUP_MESSAGE_TYPES = ['text', 'image', 'video', 'audio'];
/** Parallel per-recipient deliveries in one fan-out. */
export const FANOUT_CONCURRENCY = 8;
/** Recipients not started within this budget are skipped ('deadline') so the request ends in time. */
export const FANOUT_BUDGET_MS = 60_000;
const FANOUT_PAGE = 1000;
const FANOUT_MAX_PAGES = 20;

type Db = any;
type Outcome = { status: number; body: Record<string, unknown> };
type Interaction = {
  id: string; content?: string; message?: string; name?: string; message_type?: string; is_anonymous?: boolean; created_at?: string;
};
type FcmAccess = { accessToken: string; projectId: string };

export interface InteractionPushDeps {
  requireUser(req: Request): Promise<{ user: { id: string } | null; error: Response | null }>;
  /** Service-role client (bypasses RLS); every row is verified here before use. */
  serviceClient(): Db;
  env(name: string): string | undefined;
  firebaseAccessToken?(serviceAccountJson: string): Promise<FcmAccess>;
  fetch?: typeof fetch;
  now?(): number;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function checked<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error('database_operation_failed');
  return data;
}

function preview(value: unknown, length = 200): string {
  if (typeof value !== 'string') return '';
  // Bound Unicode output and remove control/bidi characters used to spoof labels.
  return Array.from(value.slice(0, length * 2)
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ').trim()).slice(0, length).join('');
}

function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  return () => (value ??= load());
}

/**
 * Group, sender membership and message checks shared by group_message and group_message_fanout:
 * an active group, the caller is a member, and the message is the caller's own recent
 * (15 minutes, up to 1 s of clock skew) text/media message in that group.
 */
async function verifyGroupMessage(db: Db, callerId: string, groupId: string, messageId: string,
  interactionId: string | null | undefined, nowMs: number) {
  const group = await checked(db.from('community_groups').select('id,name').eq('id', groupId).eq('is_active', true).maybeSingle()) as { name?: string } | null;
  const senderMember = await checked(db.from('group_memberships').select('user_id').eq('group_id', groupId).eq('user_id', callerId).maybeSingle());
  if (!group || !senderMember) return null;
  if (interactionId && interactionId !== messageId) return null;
  const message = await checked(db.from('group_messages').select('id,content,message_type,created_at')
    .eq('id', messageId).eq('sender_id', callerId).eq('group_id', groupId)
    .gte('created_at', new Date(nowMs - GROUP_WINDOW_MS).toISOString())
    .lte('created_at', new Date(nowMs + 1000).toISOString())
    .in('message_type', GROUP_MESSAGE_TYPES).maybeSingle()) as Interaction | null;
  if (!message || typeof message.id !== 'string' || !uuid.test(message.id)) return null;
  return { group, message };
}

/** The recipient must have been a member when the message was written (created_at >= joined_at). */
function memberAtMessage(member: { joined_at?: string } | null, message: Interaction) {
  if (!member) return false;
  return !(Date.parse(String(message.created_at)) < Date.parse(String(member.joined_at)));
}

interface Delivery {
  db: Db;
  deps: InteractionPushDeps;
  callerId: string;
  targetId: string;
  kind: string;
  context: string;
  interaction: Interaction | null;
  groupName: string;
  action: Record<string, string>;
  /** Raw profile name of the sender; memoized across a fan-out. */
  senderName(): Promise<unknown>;
  /** null when FCM is not configured; memoized across a fan-out. */
  fcm(): Promise<FcmAccess | null>;
}

/**
 * The per-recipient pipeline: localized copy, preferences, durable claim (dedup per
 * interaction + recipient + kind), device tokens, FCM send and send log.
 */
async function deliver(d: Delivery): Promise<Outcome> {
  const { db, targetId, kind, context, interaction } = d;
  const action = { ...d.action };
  const preferences = await checked(db.from('user_preferences')
    .select('language,push_enabled,push_messages,push_likes,push_comments,push_community').eq('user_id', targetId).maybeSingle()) as Record<string, unknown> | null;
  const language = typeof preferences?.language === 'string' && LANGUAGE_CODES.includes(preferences.language) ? preferences.language : 'az';
  const translated = serverCopy<Record<string, string>>('push', language, {});
  const text = (key: keyof typeof messages) => translated[key] || (messages[key] as Record<string, string>)[language] || messages[key].az;
  let sender = text('anonymous');
  if (interaction && !interaction.is_anonymous) sender = preview(await d.senderName(), 50) || text('user');
  const format = (key: keyof typeof messages) => text(key).replace(/\{(sender|item)\}/g,
    (_match, field: string) => field === 'sender' ? sender : preview(interaction?.name, 100));
  let body = text('diagnosticBody');
  if (interaction) {
    if (kind.endsWith('_like')) {
      body = format(kind === 'community_like' ? 'postLiked' : kind === 'story_like' ? 'storyLiked' : 'commentLiked');
    } else if (kind === 'shopping_list') {
      body = format('shoppingAdded');
    } else if (kind === 'thank_you') {
      body = format('thanks');
    } else if (kind === 'contraction_511') {
      body = format('contractionAlert');
    } else {
      const media = interaction.message_type;
      // User-written message/comment/alert text stays in its original language.
      const content = media === 'image' || media === 'video' || media === 'audio' || media === 'love'
        ? text(media) : preview(interaction.content ?? interaction.message, 150);
      body = `${sender}: ${content || text('openMessage')}`;
    }
    if (context === 'direct_message' || context === 'group_message' || kind === 'partner_message') {
      action.sender_id = d.callerId;
      action.messageId = interaction.id;
    }
  }
  body = preview(body);
  const title = kind === 'community_reply' ? preview(format('repliedToComment'), 60) : d.groupName || text(contracts[kind].title);
  const social = ['community_post', 'community_story', 'post_comment', 'group_message'].includes(context);
  const category = kind.endsWith('_like') ? 'push_likes'
    : (context === 'direct_message' || context === 'group_message' || kind === 'partner_message') ? 'push_messages' : social ? 'push_comments' : null;
  const enabled = preferences?.push_enabled !== false && (!social || preferences?.push_community !== false)
    && (!category || preferences?.[category] !== false);

  // The SQL RPC commits the durable claim and in-app notification together.
  // Claims are never released after an uncertain FCM outcome. This prevents
  // repeated attempts, not loss or duplication inside FCM/device delivery.
  const claimed = await checked(db.rpc('claim_communication_notification_v2', {
    p_interaction_id: interaction?.id ?? null, p_target_user_id: targetId, p_kind: kind,
    p_title: title, p_body: body, p_data: action,
  }));
  if (claimed === false) return { status: 200, body: { success: true, sent: 0, skipped: 'duplicate' } };
  if (claimed !== true) throw new Error('invalid_claim_result');
  if (!enabled) return { status: 200, body: { success: true, sent: 0, skipped: 'preferences_disabled' } };

  const tokens = await checked(db.from('device_tokens').select('token').eq('user_id', targetId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10)) as { token: unknown }[] | null;
  if (!tokens?.length) return { status: 200, body: { success: true, sent: 0, skipped: 'no_device_tokens' } };
  if (tokens.some(({ token }) => typeof token !== 'string' || !token || token.length > 4096)) {
    throw new Error('invalid_device_tokens');
  }
  const access = await d.fcm();
  if (!access) return { status: 503, body: { error: 'fcm_not_configured' } };
  const { accessToken, projectId } = access;
  const send = d.deps.fetch ?? fetch;
  let sent = 0;
  let failed = 0;
  for (const { token } of tokens as { token: string }[]) {
    let success = false;
    let dead = false;
    let code = 'FCM_UNAVAILABLE';
    try {
      // Keep provider responses and token fragments out of both console and DB logs.
      const response = await send(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token, notification: { title, body }, data: action,
          android: { priority: 'HIGH', notification: { sound: 'default' } },
          apns: { headers: { 'apns-priority': '10', 'apns-push-type': 'alert' }, payload: { aps: { sound: 'default', badge: 1 } } },
        } }),
      });
      success = response.ok;
      if (!success) {
        const result = await response.json().catch(() => null);
        const details = result?.error?.details;
        const fcm = Array.isArray(details) ? details.find((detail) => detail?.['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError') : null;
        const errorCode = fcm?.errorCode ?? result?.error?.status;
        code = ['UNREGISTERED', 'NOT_FOUND', 'INVALID_ARGUMENT', 'QUOTA_EXCEEDED', 'UNAVAILABLE', 'INTERNAL',
          'SENDER_ID_MISMATCH', 'THIRD_PARTY_AUTH_ERROR', 'PERMISSION_DENIED', 'UNAUTHENTICATED'].includes(errorCode) ? errorCode : 'FCM_REJECTED';
        dead = fcm?.errorCode === 'UNREGISTERED';
      }
    } catch { /* Delivery may be uncertain; retain the claim and token. */ }
    if (success) sent++; else failed++;
    const log = await checked(db.from('notification_send_log').insert({
      user_id: targetId, title: '[redacted]', body: '[redacted]', source_type: 'dynamic',
      source_notification_id: interaction?.id ?? null, notification_type: kind,
      status: success ? 'sent' : 'failed', reason: success ? null : 'fcm_failed', error_code: success ? null : code,
    }).select('id').single()) as { id?: string } | null;
    if (!log?.id) throw new Error('send_log_write_failed');
    if (dead) await checked(db.from('device_tokens').delete().eq('user_id', targetId).eq('token', token));
  }
  return { status: sent ? 200 : 502, body: { success: failed === 0, sent, failed } };
}

function fcmLoader(deps: InteractionPushDeps) {
  return async (): Promise<FcmAccess | null> => {
    const account = deps.env('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!account) return null;
    return (deps.firebaseAccessToken ?? getFirebaseAccessToken)(account);
  };
}

function senderNameLoader(db: Db, callerId: string) {
  return async () => (await checked(db.from('profiles').select('name').eq('user_id', callerId).maybeSingle()) as { name?: unknown } | null)?.name;
}

/**
 * group_message_fanout: the sender asks once; the server pushes to every current member
 * except the sender. Each recipient goes through deliver() with exactly the action a
 * single group_message push builds, so the durable claim also dedups against parallel
 * per-member calls from older app builds for the same message.
 */
async function fanOutGroupMessage(db: Db, deps: InteractionPushDeps, callerId: string, groupId: string,
  messageId: string, interactionId: string | null | undefined): Promise<Outcome> {
  const clock = deps.now ?? Date.now;
  const started = clock();
  const verified = await verifyGroupMessage(db, callerId, groupId, messageId, interactionId, started);
  if (!verified) return { status: 403, body: { error: 'no_verified_interaction' } };
  const { group, message } = verified;

  const members: { user_id: string; joined_at?: string }[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < FANOUT_MAX_PAGES; page++) {
    const rows = await checked(db.from('group_memberships').select('user_id,joined_at').eq('group_id', groupId)
      .neq('user_id', callerId).order('user_id', { ascending: true })
      .range(page * FANOUT_PAGE, (page + 1) * FANOUT_PAGE - 1)) as { user_id?: unknown; joined_at?: string }[] | null;
    for (const row of rows ?? []) {
      const id = typeof row.user_id === 'string' ? row.user_id.toLowerCase() : '';
      if (!uuid.test(id) || id === callerId || seen.has(id)) continue;
      seen.add(id);
      members.push({ user_id: id, joined_at: row.joined_at });
    }
    if (!rows || rows.length < FANOUT_PAGE) break;
  }

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1; };
  const recipients = members.filter((member) => memberAtMessage(member, message) || (skip('not_member'), false));
  const senderName = memo(senderNameLoader(db, callerId));
  const fcm = memo(fcmLoader(deps));
  const groupName = preview(group.name, 50);
  let sent = 0;
  let delivered = 0;
  let next = 0;
  const worker = async () => {
    while (next < recipients.length) {
      const recipient = recipients[next++];
      if (clock() - started > FANOUT_BUDGET_MS) { skip('deadline'); continue; }
      try {
        const outcome = await deliver({
          db, deps, callerId, targetId: recipient.user_id, kind: 'group_message', context: 'group_message',
          interaction: message, groupName, senderName, fcm,
          action: { context: 'group_message', type: 'group_message', groupId, interactionId: message.id },
        });
        const count = typeof outcome.body.sent === 'number' ? outcome.body.sent : 0;
        sent += count;
        if (count > 0) delivered++;
        else skip(typeof outcome.body.skipped === 'string' ? outcome.body.skipped
          : typeof outcome.body.error === 'string' ? outcome.body.error : 'fcm_failed');
      } catch { skip('error'); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(FANOUT_CONCURRENCY, recipients.length) }, worker));
  const ok = !['error', 'deadline', 'fcm_failed', 'fcm_not_configured'].some((reason) => skipped[reason]);
  return { status: 200, body: { ok, success: ok, sent, recipients: members.length, delivered, skipped } };
}

export function createInteractionPushHandler(deps: InteractionPushDeps) {
  return (req: Request) => handleInteractionPush(req, deps);
}

export async function handleInteractionPush(req: Request, deps: InteractionPushDeps) {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const auth = await deps.requireUser(req);
    if (auth.error || !auth.user) return auth.error ?? json(401, { error: 'unauthorized' });
    const callerId = auth.user.id.toLowerCase();
    if (!uuid.test(callerId)) return json(401, { error: 'unauthorized' });

    if (Number(req.headers.get('content-length')) > 8192) return json(413, { error: 'payload_too_large' });
    const reader = req.body?.getReader();
    if (!reader) return json(400, { error: 'invalid_payload' });
    const decoder = new TextDecoder();
    let raw = '';
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          return json(413, { error: 'payload_too_large' });
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return json(400, { error: 'invalid_payload' }); }
    const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
    if (!object(payload) || Object.keys(payload).some((key) => !['userId', 'title', 'body', 'data'].includes(key))
      || typeof payload.userId !== 'string' || !uuid.test(payload.userId)
      || typeof payload.title !== 'string' || !payload.title.trim() || bytes(payload.title) > 256
      || typeof payload.body !== 'string' || !payload.body.trim() || bytes(payload.body) > 1024
      || !object(payload.data) || bytes(JSON.stringify(payload.data)) > 1024) {
      return json(400, { error: 'invalid_payload' });
    }
    const data = payload.data;
    const requestedKind = data.type;
    if (typeof requestedKind !== 'string' || !own(contracts, requestedKind) || data.context !== contracts[requestedKind].context) {
      return json(400, { error: 'unsupported_context_or_type' });
    }
    let kind = requestedKind;
    const contract = contracts[kind];
    const ids: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'context' || key === 'type') continue;
      if (!contract.fields.includes(key) && !(key === 'interactionId' && kind !== 'diagnostic')) {
        return json(400, { error: 'unsupported_data_field' });
      }
      if (key === 'groupId' && value === null) ids[key] = null;
      else if (typeof value === 'string' && uuid.test(value)) ids[key] = value.toLowerCase();
      else return json(400, { error: 'invalid_identifier' });
    }
    const targetId = payload.userId.toLowerCase();
    const context = contract.context;
    const forbidden = () => json(403, { error: 'no_verified_interaction' });
    const supabase = deps.serviceClient();
    const nowMs = (deps.now ?? Date.now)();

    if (kind === 'group_message_fanout') {
      // userId names the sender (the caller), never a recipient.
      if (targetId !== callerId) return forbidden();
      if (!ids.groupId || !ids.messageId) return json(400, { error: 'missing_group_or_message_id' });
      const outcome = await fanOutGroupMessage(supabase, deps, callerId, ids.groupId, ids.messageId, ids.interactionId);
      return json(outcome.status, outcome.body);
    }

    if ((context === 'self') !== (callerId === targetId)) return forbidden();
    if (ids.sender_id && ids.sender_id !== callerId) return forbidden();

    const now = new Date(nowMs).toISOString();
    const since = new Date(nowMs - 120_000).toISOString();
    // PostgreSQL timestamps have finer precision; tolerate up to one second of clock skew.
    const until = new Date(nowMs + 1000).toISOString();
    const recent = (table: string, columns: string) => supabase.from(table).select(`id,${columns}`)
      .gte('created_at', since).lte('created_at', until)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1);
    let query: ReturnType<typeof recent> | undefined;
    let groupName = '';
    const action: Record<string, string> = { context, type: kind };
    // Shipped callers omit row IDs. Resolve only the latest matching row, never
    // the latest *unclaimed* row: a retry must not drain earlier interactions.
    let interaction: Interaction | null = null;

    if (context === 'partner') {
      const caller = await checked(supabase.from('profiles').select('id,linked_partner_id').eq('user_id', callerId).maybeSingle()) as any;
      if (!caller?.linked_partner_id) return forbidden();
      const partner = await checked(supabase.from('profiles').select('user_id,linked_partner_id')
        .eq('id', caller.linked_partner_id).maybeSingle()) as any;
      if (partner?.user_id !== targetId || partner.linked_partner_id !== caller.id) return forbidden();
      if (kind === 'shopping_list') {
        query = recent('shopping_items', 'name').eq('user_id', callerId).eq('partner_id', targetId);
      } else if (kind === 'sos_alert' || kind === 'birth_alert') {
        if (!ids.alertId) return json(400, { error: 'missing_alert_id' });
        query = recent('sos_alerts', 'message').eq('sender_id', callerId).eq('receiver_id', targetId)
          .eq('id', ids.alertId).eq('alert_type', kind === 'birth_alert' ? 'birth' : 'emergency');
        action.alertId = ids.alertId;
      } else {
        query = recent('partner_messages', 'content,message_type').eq('sender_id', callerId).eq('receiver_id', targetId);
        query = kind === 'partner_message' ? query.in('message_type', ['text', 'image', 'audio', 'video', 'love'])
          : kind === 'thank_you' ? query.in('message_type', ['thank_you', 'text']) : query.eq('message_type', kind);
      }
    } else if (context === 'direct_message') {
      query = recent('direct_messages', 'content,message_type').eq('sender_id', callerId).eq('receiver_id', targetId)
        .in('message_type', ['text', 'image', 'video', 'audio']);
    } else if (context === 'group_message') {
      if (!ids.groupId || !ids.messageId) return json(400, { error: 'missing_group_or_message_id' });
      // Older apps fan a group message out themselves (one call per member, 4 at a time), so in
      // big groups the last calls arrive minutes later: group messages get a 15-minute window.
      // Unknown/inactive group, non-member sender, or a message that is not the caller's own
      // recent group message stay 403.
      const verified = await verifyGroupMessage(supabase, callerId, ids.groupId, ids.messageId, ids.interactionId, nowMs);
      if (!verified) return forbidden();
      const targetMember = await checked(supabase.from('group_memberships').select('user_id,joined_at')
        .eq('group_id', ids.groupId).eq('user_id', targetId).maybeSingle()) as { joined_at?: string } | null;
      // A recipient who left (or joined after the message) is an expected outcome of a
      // client-side fan-out, not an error: answer 200 so old builds stop reporting failures.
      if (!memberAtMessage(targetMember, verified.message)) return json(200, { success: true, sent: 0, skipped: 'not_member' });
      groupName = preview(verified.group.name, 50);
      interaction = verified.message;
      action.groupId = ids.groupId;
      action.interactionId = interaction.id;
    } else if (context === 'community_post') {
      if (!ids.postId) return json(400, { error: 'missing_post_id' });
      const post = await checked(supabase.from('community_posts').select('user_id,group_id')
        .eq('id', ids.postId).eq('is_active', true).maybeSingle()) as any;
      if (!post || post.user_id !== targetId || (own(ids, 'groupId') && ids.groupId !== post.group_id)) return forbidden();
      action.postId = ids.postId;
      if (post.group_id) action.groupId = post.group_id;
      query = kind === 'community_like'
        ? recent('post_likes', 'user_id').eq('post_id', ids.postId).eq('user_id', callerId)
        : recent('post_comments', 'content,is_anonymous').eq('post_id', ids.postId).eq('user_id', callerId)
          .eq('is_active', true).is('parent_comment_id', null);
    } else if (context === 'community_story') {
      if (!ids.storyId) return json(400, { error: 'missing_story_id' });
      const story = await checked(supabase.from('community_stories').select('user_id')
        .eq('id', ids.storyId).gt('expires_at', now).maybeSingle()) as any;
      if (story?.user_id !== targetId) return forbidden();
      action.storyId = ids.storyId;
      query = kind === 'story_like'
        ? recent('story_likes', 'user_id').eq('story_id', ids.storyId).eq('user_id', callerId)
        : recent('story_replies', 'content').eq('story_id', ids.storyId).eq('user_id', callerId).eq('is_active', true);
    } else if (context === 'post_comment') {
      if (!ids.commentId || !ids.postId) return json(400, { error: 'missing_comment_or_post_id' });
      const comment = await checked(supabase.from('post_comments').select('user_id,post_id')
        .eq('id', ids.commentId).eq('is_active', true).maybeSingle()) as any;
      if (comment?.user_id !== targetId || comment.post_id !== ids.postId) return forbidden();
      const post = await checked(supabase.from('community_posts').select('id')
        .eq('id', comment.post_id).eq('is_active', true).maybeSingle());
      if (!post) return forbidden();
      action.postId = comment.post_id;
      action.commentId = ids.commentId;
      query = kind === 'comment_like'
        ? recent('comment_likes', 'user_id').eq('comment_id', ids.commentId).eq('user_id', callerId)
        : recent('post_comments', 'content,is_anonymous').eq('parent_comment_id', ids.commentId)
          .eq('post_id', comment.post_id).eq('user_id', callerId).eq('is_active', true);
    }

    if (query) {
      if (ids.interactionId) query = query.eq('id', ids.interactionId);
      if (ids.messageId) query = query.eq('id', ids.messageId);
      interaction = await checked(query.maybeSingle()) as Interaction | null;
      if (!interaction || !uuid.test(interaction.id)) return forbidden();
      action.interactionId = interaction.id;
      // PartnerCareCard can persist a plain text fallback. It proves a message,
      // not a thank-you event; canonicalize copy, preferences, claims and logging.
      if (kind === 'thank_you' && interaction.message_type === 'text') kind = 'partner_message';
      action.type = kind;
    } else if (!interaction && kind !== 'diagnostic') return forbidden();

    const outcome = await deliver({
      db: supabase, deps, callerId, targetId, kind, context, interaction, groupName, action,
      senderName: senderNameLoader(supabase, callerId), fcm: fcmLoader(deps),
    });
    return json(outcome.status, outcome.body);
  } catch {
    console.error('[send-push-notification] operation_failed');
    return json(503, { error: 'push_operation_failed' });
  }
}
