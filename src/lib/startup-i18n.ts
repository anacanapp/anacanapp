import { normalizeAppLanguage, readAppLanguage } from './app-languages';

// SDK-free, eagerly bundled copy: language selection and admission errors appear
// before the main translation chunks or an authenticated backend are available.
export type StartupKey = 'selectLanguage' | 'selectCountry' | 'searchPlaceholder' | 'noneFound'
  | 'continue' | 'languageHint' | 'back' | 'updateRequired' | 'connectionPending' | 'retry';
const COPY: Record<string, Partial<Record<StartupKey, string>>> = {
  vi: {
    selectLanguage: 'Chọn ngôn ngữ', selectCountry: 'Chọn quốc gia', searchPlaceholder: 'Tìm kiếm', noneFound: 'Không tìm thấy quốc gia',
    continue: 'Tiếp tục', languageHint: 'Bạn có thể đổi ngôn ngữ sau trong phần cài đặt', back: 'Quay lại',
    updateRequired: 'Hãy cập nhật Anacan trong cửa hàng ứng dụng để tiếp tục.', connectionPending: 'Đang chuẩn bị kết nối. Vui lòng thử lại sau giây lát.', retry: 'Thử lại',
  },
  hi: {
    selectLanguage: 'भाषा चुनें', selectCountry: 'देश चुनें', searchPlaceholder: 'खोजें', noneFound: 'कोई देश नहीं मिला',
    continue: 'जारी रखें', languageHint: 'आप बाद में सेटिंग में भाषा बदल सकते हैं', back: 'वापस',
    updateRequired: 'जारी रखने के लिए ऐप स्टोर में Anacan अपडेट करें।', connectionPending: 'कनेक्शन तैयार हो रहा है। कृपया थोड़ी देर बाद फिर कोशिश करें।', retry: 'फिर कोशिश करें',
  },
  ja: {
    selectLanguage: '言語を選択', selectCountry: '国・地域を選択', searchPlaceholder: '検索', noneFound: '国・地域が見つかりません',
    continue: '続ける', languageHint: '言語は後から設定で変更できます', back: '戻る',
    updateRequired: '続けるには、アプリストアでAnacanを更新してください。', connectionPending: '接続を準備しています。しばらくしてからもう一度お試しください。', retry: '再試行',
  },
  ko: {
    selectLanguage: '언어 선택', selectCountry: '국가 선택', searchPlaceholder: '검색', noneFound: '검색된 국가가 없어요',
    continue: '계속', languageHint: '설정에서 나중에 언어를 변경할 수 있어요', back: '뒤로',
    updateRequired: '계속하려면 앱 스토어에서 Anacan을 업데이트해 주세요.', connectionPending: '연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요.', retry: '다시 시도',
  },
  pl: {
    selectLanguage: 'Wybierz język', selectCountry: 'Wybierz kraj', searchPlaceholder: 'Szukaj', noneFound: 'Nie znaleziono kraju',
    continue: 'Dalej', languageHint: 'Język możesz później zmienić w ustawieniach', back: 'Wstecz',
    updateRequired: 'Aby kontynuować, zaktualizuj Anacan w sklepie z aplikacjami.', connectionPending: 'Przygotowujemy połączenie. Spróbuj ponownie za chwilę.', retry: 'Spróbuj ponownie',
  },
  nl: {
    selectLanguage: 'Taal kiezen', selectCountry: 'Land kiezen', searchPlaceholder: 'Zoeken', noneFound: 'Geen landen gevonden',
    continue: 'Doorgaan', languageHint: 'Je kunt de taal later wijzigen in de instellingen', back: 'Terug',
    updateRequired: 'Werk Anacan bij in de appwinkel om door te gaan.', connectionPending: 'De verbinding wordt voorbereid. Probeer het zo opnieuw.', retry: 'Opnieuw proberen',
  },
  sv: {
    selectLanguage: 'Välj språk', selectCountry: 'Välj land', searchPlaceholder: 'Sök', noneFound: 'Inga länder hittades',
    continue: 'Fortsätt', languageHint: 'Du kan ändra språket senare i inställningarna', back: 'Tillbaka',
    updateRequired: 'Uppdatera Anacan i appbutiken för att fortsätta.', connectionPending: 'Anslutningen förbereds. Försök igen om en stund.', retry: 'Försök igen',
  },
  zh: {
    selectLanguage: '选择语言', selectCountry: '选择国家或地区', searchPlaceholder: '搜索', noneFound: '未找到国家或地区',
    continue: '继续', languageHint: '您可以稍后在设置中更改语言', back: '返回',
    updateRequired: '请在应用商店更新 Anacan 后继续使用。', connectionPending: '正在准备连接，请稍后重试。', retry: '重试',
  },
  id: {
    selectLanguage: 'Pilih bahasa', selectCountry: 'Pilih negara', searchPlaceholder: 'Cari', noneFound: 'Negara tidak ditemukan',
    continue: 'Lanjutkan', languageHint: 'Anda dapat mengubah bahasa nanti di pengaturan', back: 'Kembali',
    updateRequired: 'Perbarui Anacan di toko aplikasi untuk melanjutkan.', connectionPending: 'Koneksi sedang disiapkan. Silakan coba lagi sebentar.', retry: 'Coba lagi',
  },
  fr: {
    selectLanguage: 'Choisir la langue', selectCountry: 'Choisir le pays', searchPlaceholder: 'Rechercher', noneFound: 'Aucun pays trouvé',
    continue: 'Continuer', languageHint: 'Vous pourrez changer la langue dans les paramètres', back: 'Retour',
    updateRequired: 'Mettez Anacan à jour dans la boutique d’applications pour continuer.', connectionPending: 'Connexion en cours de préparation. Veuillez réessayer dans un instant.', retry: 'Réessayer',
  },
  es: {
    selectLanguage: 'Elegir idioma', selectCountry: 'Elegir país', searchPlaceholder: 'Buscar', noneFound: 'No se encontraron países',
    continue: 'Continuar', languageHint: 'Puedes cambiar el idioma más tarde en los ajustes', back: 'Volver',
    updateRequired: 'Actualiza Anacan en la tienda de aplicaciones para continuar.', connectionPending: 'Se está preparando la conexión. Vuelve a intentarlo en un momento.', retry: 'Reintentar',
  },
  pt: {
    selectLanguage: 'Escolher idioma', selectCountry: 'Escolher país', searchPlaceholder: 'Pesquisar', noneFound: 'Nenhum país encontrado',
    continue: 'Continuar', languageHint: 'Pode alterar o idioma mais tarde nas definições', back: 'Voltar',
    updateRequired: 'Atualize o Anacan na loja de aplicações para continuar.', connectionPending: 'A preparar a ligação. Tente novamente dentro de instantes.', retry: 'Tentar novamente',
  },
  en: { updateRequired: 'Update Anacan in the app store to continue.', connectionPending: 'Preparing the connection. Please try again shortly.', retry: 'Try again' },
  tr: { updateRequired: 'Devam etmek için Anacan’ı uygulama mağazasından güncelleyin.', connectionPending: 'Bağlantı hazırlanıyor. Lütfen biraz sonra tekrar deneyin.', retry: 'Tekrar dene' },
  ru: { updateRequired: 'Обновите Anacan в магазине приложений, чтобы продолжить.', connectionPending: 'Подготовка подключения. Повторите попытку чуть позже.', retry: 'Повторить' },
  de: { updateRequired: 'Aktualisiere Anacan im App-Store, um fortzufahren.', connectionPending: 'Die Verbindung wird vorbereitet. Versuche es gleich noch einmal.', retry: 'Erneut versuchen' },
  ar: { updateRequired: 'حدّثي Anacan من متجر التطبيقات للمتابعة.', connectionPending: 'جارٍ تجهيز الاتصال. حاولي مرة أخرى بعد قليل.', retry: 'حاولي مرة أخرى' },
  ka: { updateRequired: 'გასაგრძელებლად განაახლეთ Anacan აპების მაღაზიიდან.', connectionPending: 'კავშირი მზადდება. ცოტა ხანში სცადეთ ხელახლა.', retry: 'ხელახლა ცდა' },
  kk: { updateRequired: 'Жалғастыру үшін Anacan қолданбасын дүкеннен жаңартыңыз.', connectionPending: 'Байланыс дайындалуда. Сәлден кейін қайталап көріңіз.', retry: 'Қайталап көру' },
  uz: { updateRequired: 'Davom etish uchun Anacan’ni ilovalar do‘konida yangilang.', connectionPending: 'Ulanish tayyorlanmoqda. Birozdan keyin qayta urinib ko‘ring.', retry: 'Qayta urinish' },
};

export function startupText(language: string, key: StartupKey, fallback: string): string {
  return COPY[normalizeAppLanguage(language)]?.[key] ?? fallback;
}

export function storedStartupLanguage(): string {
  return readAppLanguage();
}
