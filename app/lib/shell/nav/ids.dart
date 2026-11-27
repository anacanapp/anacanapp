// Ported from: src/pages/Index.tsx (tab ids, renderContent, sub-screen chain and its role/stage guards),
//              src/components/BottomNav.tsx (womanTabs / partnerTabs), src/components/ToolsHub.tsx
//              (renderToolById ids and aliases), src/lib/merged-tools.ts, docs/MERGED_TOOLS.md,
//              src/components/aptek/AptekScreen.tsx (initialAptekView), src/lib/freemium.ts (isCakesAvailable)
import '../../core/i18n/app_languages.dart' show normalizeAppLanguage;

/// `activeTab` values.
enum ShellTab {
  home('home'),
  tools('tools'),
  community('community'),
  ai('ai'),
  profile('profile'),

  /// Only reachable by link (`/cakes`, tour); rendered for admins or where cakes are available.
  cakes('cakes'),

  /// Partner role.
  together('together'),

  /// Partner role (Messages).
  chat('chat');

  const ShellTab(this.id);
  final String id;

  /// Unknown ids map to null (Index renders nothing and resets to `home`).
  static ShellTab? tryParse(String? id) {
    for (final t in values) {
      if (t.id == id) return t;
    }
    return null;
  }
}

/// One bottom-nav entry.
class NavTabSpec {
  const NavTabSpec(this.tab, this.labelKey, this.labelAz, {this.special = false});
  final ShellTab tab;
  final String labelKey;
  final String labelAz;

  /// The AI pill (`special: true`).
  final bool special;
}

/// `womanTabs` in nav order.
const List<NavTabSpec> kWomanNavTabs = [
  NavTabSpec(ShellTab.home, 'bottomnav_esas_6d87f7', 'Əsas'),
  NavTabSpec(ShellTab.tools, 'bottomnav_aletler_4778b4', 'Alətlər'),
  NavTabSpec(ShellTab.community, 'bottomnav_cemiyyet_2dc44d', 'Cəmiyyət'),
  NavTabSpec(ShellTab.ai, 'bottomnav_anacan_ai', 'Anacan.AI', special: true),
  NavTabSpec(ShellTab.profile, 'bottomnav_profil', 'Profil'),
];

/// `partnerTabs` in nav order.
const List<NavTabSpec> kPartnerNavTabs = [
  NavTabSpec(ShellTab.home, 'partnerv2_nav_bugun', 'Bu gün'),
  NavTabSpec(ShellTab.together, 'partnerv2_birlikde', 'Birlikdə'),
  NavTabSpec(ShellTab.chat, 'bottomnav_mesajlar', 'Mesajlar'),
  NavTabSpec(ShellTab.ai, 'bottomnav_meslehet_9a0892', 'Məsləhət', special: true),
  NavTabSpec(ShellTab.profile, 'bottomnav_profil', 'Profil'),
];

/// `isCakesAvailable(countryCode, language)`.
bool isCakesAvailable(String? countryCode, String? language) {
  final lang = (language == null || language.isEmpty) ? 'az' : language;
  final countryOk = countryCode == null || countryCode == 'AZ';
  final langOk = lang == 'az' || lang == 'ru' || lang == 'kk' || lang == 'uz' || lang == 'ka';
  return countryOk && langOk;
}

/// Facts the render guards read (role, stage, admin, language, cakes).
class ShellGuardContext {
  const ShellGuardContext({
    required this.role,
    required this.lifeStage,
    required this.isAdmin,
    required this.language,
    required this.cakesAvailable,
  });

  /// `userStore.role` (`woman` | `partner` | …).
  final String? role;

  /// `flow` | `bump` | `mommy` | `partner` | null.
  final String? lifeStage;
  final bool isAdmin;
  final String language;

  /// `isCakesAvailable(profile.country_code || storedCountry, language)`.
  final bool cakesAvailable;

  bool get isPartnerRole => role == 'partner';
}

/// Whether `renderContent()` returns something for [tab] (the bottom nav and the empty-tab reset use it).
bool tabHasContent(ShellTab tab, ShellGuardContext c) {
  if (c.isPartnerRole && tab != ShellTab.community) {
    return const {ShellTab.home, ShellTab.together, ShellTab.chat, ShellTab.ai, ShellTab.profile}.contains(tab);
  }
  switch (tab) {
    case ShellTab.home:
    case ShellTab.tools:
    case ShellTab.community:
    case ShellTab.ai:
    case ShellTab.profile:
      return true;
    case ShellTab.cakes:
      return c.isAdmin || c.cakesAvailable;
    case ShellTab.together:
    case ShellTab.chat:
      return false;
  }
}

/// Who may see a sub-screen (the `&& role …` / `&& lifeStage …` conditions of the Index chain).
enum ScreenGuard { none, partnerOnly, notPartner, mommyOnly, bumpNotPartner, adminOnly, azOrAdmin }

/// `activeScreen` ids rendered by Index (in the order of its if-chain). [prefix] screens take a
/// parameter after `/` (`legal/<docType>`, `blog/<slug>`, `aptek/<view>`).
enum ScreenId {
  mommyPeriod('mommy-period', guard: ScreenGuard.mommyOnly),
  moderator('moderator'),
  moderationHistory('moderation-history'),
  notifications('notifications'),
  settings('settings'),
  adPreferences('ad-preferences'),
  widgets('widgets'),
  books('books', guard: ScreenGuard.azOrAdmin),
  myBooks('my-books', guard: ScreenGuard.azOrAdmin),
  illness('illness'),
  recovery('recovery', guard: ScreenGuard.notPartner),
  recoveryKegel('recovery/kegel', guard: ScreenGuard.notPartner),
  healthSync('health-sync'),
  qaygicash('qaygicash'),
  recap('recap'),
  referral('referral'),
  doctorReport('doctor-report'),
  calendar('calendar'),
  aptek('aptek', prefix: true),
  editProfile('edit-profile'),
  help('help'),
  privacy('privacy'),
  partnerPrivacy('partner-privacy'),
  appearance('appearance'),
  billing('billing'),
  legal('legal', prefix: true),
  blog('blog', prefix: true),
  shop('shop', guard: ScreenGuard.adminOnly),
  nameVoting('name-voting', guard: ScreenGuard.partnerOnly),
  partnerHospitalBag('partner-hospital-bag', guard: ScreenGuard.partnerOnly),
  dailySummary('daily-summary', guard: ScreenGuard.partnerOnly),
  partnerShopping('partner-shopping', guard: ScreenGuard.partnerOnly),
  partnerAppointments('partner-appointments', guard: ScreenGuard.partnerOnly),
  partnerBabyDay('partner-baby-day', guard: ScreenGuard.partnerOnly),
  partnerWeeklyStats('partner-weekly-stats', guard: ScreenGuard.partnerOnly),
  partnerSurprises('partner-surprises', guard: ScreenGuard.partnerOnly),
  partnerParenting('partner-parenting', guard: ScreenGuard.partnerOnly),
  hospitalRun('hospital-run', guard: ScreenGuard.partnerOnly),
  liveContractions('live-contractions', guard: ScreenGuard.partnerOnly),
  partnerSharing('partner-sharing', guard: ScreenGuard.notPartner),
  nightShift('night-shift'),
  postpartumSupport('postpartum-support', guard: ScreenGuard.partnerOnly),
  lossGuide('loss-guide', guard: ScreenGuard.notPartner),
  lossGuideSigns('loss-guide/signs', guard: ScreenGuard.notPartner),
  lossMemories('loss-memories', guard: ScreenGuard.notPartner),
  partnerLossSupport('partner-loss-support', guard: ScreenGuard.partnerOnly),
  babyChat('baby-chat', guard: ScreenGuard.bumpNotPartner),
  partnerNotifications('partner-notifications'),
  birthPlan('birth-plan'),
  partners('partners'),

  /// Not a sub-screen: for admins it opens the web admin panel and clears `activeScreen`.
  admin('admin', guard: ScreenGuard.adminOnly);

  const ScreenId(this.id, {this.guard = ScreenGuard.none, this.prefix = false});
  final String id;
  final ScreenGuard guard;
  final bool prefix;

  bool allows(ShellGuardContext c) {
    switch (guard) {
      case ScreenGuard.none:
        return true;
      case ScreenGuard.partnerOnly:
        return c.isPartnerRole;
      case ScreenGuard.notPartner:
        return !c.isPartnerRole;
      case ScreenGuard.mommyOnly:
        return c.lifeStage == 'mommy';
      case ScreenGuard.bumpNotPartner:
        return !c.isPartnerRole && c.lifeStage == 'bump';
      case ScreenGuard.adminOnly:
        return c.isAdmin;
      case ScreenGuard.azOrAdmin:
        return c.isAdmin || normalizeAppLanguage(c.language) == 'az';
    }
  }
}

/// A parsed `activeScreen` string.
class ShellScreen {
  const ShellScreen(this.id, this.raw, [this.param]);
  final ScreenId id;

  /// The exact `activeScreen` string.
  final String raw;

  /// `legal/<doc>` → doc, `blog/<slug>` → slug (may be ''), `aptek/<view>` → view; null for the bare id.
  final String? param;

  /// `legal` `initialDocument`, `blog` `initialSlug` (undefined for the bare id, as in Index).
  String? get initialParam => param;

  @override
  bool operator ==(Object other) => other is ShellScreen && other.id == id && other.raw == raw && other.param == param;
  @override
  int get hashCode => Object.hash(id, raw, param);
  @override
  String toString() => 'ShellScreen($raw)';

  /// Parses any string Index understands; null for unknown ids.
  static ShellScreen? tryParse(String? raw) {
    if (raw == null) return null;
    for (final s in ScreenId.values) {
      if (raw == s.id) return ShellScreen(s, raw);
      if (s.prefix && raw.startsWith('${s.id}/')) return ShellScreen(s, raw, raw.substring(s.id.length + 1));
    }
    return null;
  }
}

/// The sub-screen Index renders for [raw], or null when the id is unknown, `admin`, or its guard fails
/// (then the tab frame stays visible while `activeScreen` remains set, exactly like Index).
ShellScreen? resolveSubScreen(String? raw, ShellGuardContext c) {
  final s = ShellScreen.tryParse(raw);
  if (s == null || s.id == ScreenId.admin) return null;
  return s.id.allows(c) ? s : null;
}

/// `initialAptekView(screen)`.
({String name, String? id}) initialAptekView(String? screen) {
  final parts = screen?.split('/');
  final sub = parts != null && parts.length > 1 ? parts[1] : null;
  if (sub == 'cart') return (name: 'cart', id: null);
  if (sub == 'orders') return (name: 'orders', id: null);
  if (sub != null && sub.startsWith('p:')) return (name: 'product', id: sub.substring(2));
  return (name: 'home', id: null);
}

/// Tools rendered by ToolsHub (`renderToolById`), canonical id first, then the aliases that open it.
enum ToolId {
  photoshoot('photoshoot'),
  nutrition('nutrition'),
  shopping('shopping'),
  safety('safety'),
  kick('kick'),
  contraction('contraction'),
  weight('weight'),
  whitenoise('whitenoise', aliases: ['white-noise']),
  names('names', aliases: ['baby-names']),
  hospital('hospital'),
  exercise('exercise', aliases: ['exercises']),
  mood('mood', aliases: ['mood-diary']),
  blog('blog'),
  recipes('recipes'),
  doctors('doctors'),
  bloodSugar('blood-sugar'),
  bloodPressure('blood-pressure'),
  dangerSigns('danger-signs'),
  preemieHub('preemie-hub'),
  pregnancyAlbum('pregnancy-album'),
  babyAlbum('baby-album'),
  cryTranslator('cry-translator'),
  poopScanner('poop-scanner'),
  weatherClothing('weather-clothing'),
  noiseMeter('noise-meter'),
  secondhandMarket('secondhand-market', aliases: ['second-hand-market']),
  momFriendlyMap('mom-friendly-map'),
  smartPlayBox('smart-play-box'),
  playTogether('play-together'),
  kidExercises('kid-exercises'),
  mentalHealth('mental-health'),
  firstAid('first-aid'),
  fairyTale('fairy-tale'),
  horoscope('horoscope'),
  babyGrowth('baby-growth', aliases: ['growth-tracker']),
  fetalGrowth('fetal-growth'),
  affiliate('affiliate', aliases: ['affiliate-products']),
  maternityCalculator('maternity-calculator', aliases: ['maternity']),
  teething('teething', aliases: ['teething-tracker']),
  vaccineCalendar('vaccine-calendar', aliases: ['vaccines-calendar']),
  vitaminTracker('vitamin-tracker', aliases: ['vitamins']),
  cakes('cakes'),
  babyTracker('baby-tracker'),
  sleepTraining('sleep-training'),
  solidFoodGuide('solid-food-guide'),
  weaning('weaning'),
  parenting('parenting'),
  miniGames('mini-games');

  const ToolId(this.id, {this.aliases = const []});
  final String id;
  final List<String> aliases;

  /// The tool [raw] renders (canonical id or any alias); null = ToolsHub shows its list.
  static ToolId? tryParse(String? raw) {
    if (raw == null) return null;
    for (final t in values) {
      if (t.id == raw || t.aliases.contains(raw)) return t;
    }
    return null;
  }
}

// ── merged tools (src/lib/merged-tools.ts) ──

/// `TOOL_HOST`.
const Map<String, String> kToolHost = {
  'mood': 'mental-health', 'mood-diary': 'mental-health',
  'baby-growth': 'baby-tracker', 'growth-tracker': 'baby-tracker',
  'teething': 'baby-tracker', 'teething-tracker': 'baby-tracker',
  'blood-sugar': 'blood-pressure',
  'noise-meter': 'whitenoise',
};

/// `HOST_SECTIONS` (tab order, host first).
const Map<String, List<String>> kHostSections = {
  'mental-health': ['mental-health', 'mood'],
  'baby-tracker': ['baby-tracker', 'baby-growth', 'teething'],
  'blood-pressure': ['blood-pressure', 'blood-sugar'],
  'whitenoise': ['whitenoise', 'noise-meter'],
};

const Map<String, String> _alias = {
  'mood-diary': 'mood', 'growth-tracker': 'baby-growth', 'teething-tracker': 'teething', 'white-noise': 'whitenoise',
};

/// `canonicalToolId(id)`.
String canonicalToolId(String id) => _alias[id] ?? id;

/// `TOOL_COMPANION` (the sleep pair links to each other).
const Map<String, String> kToolCompanion = {'whitenoise': 'sleep-training', 'sleep-training': 'whitenoise'};

/// `resolveToolTarget(id, available)`.
({String host, String section}) resolveToolTarget(String id, bool Function(String toolId) available) {
  final c = canonicalToolId(id);
  final host = kToolHost[id] ?? kToolHost[c];
  if (host != null && available(host)) return (host: host, section: c);
  return (host: c, section: c);
}

/// `isMergedAway(id, available)`.
bool isMergedAway(String id, bool Function(String toolId) available) {
  final host = kToolHost[id] ?? kToolHost[canonicalToolId(id)];
  return host != null && available(host);
}
