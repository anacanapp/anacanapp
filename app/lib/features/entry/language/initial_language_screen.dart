// Ported from: src/components/InitialLanguageScreen.tsx, src/lib/geoLanguage.ts (usage),
//              src/lib/app-languages.ts (localizedCountryName)
//
// First-launch language (step 1) and country (step 2) picker. Texts come from startup copy
// (`startupText`) + the inline maps of the React file, because this screen renders before any
// dictionary is loaded (it is also excluded from the inline-localization plugin).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart' hide rtlX;
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../data/countries.g.dart';
import '../data/country_names.g.dart';
import '../entry_services.dart';
import '../widgets/entry_widgets.dart';

/// One tile of the language grid (`{code, label, nativeLabel, subLabel, flag}`).
class LanguageTile {
  const LanguageTile({required this.code, required this.nativeLabel, required this.subLabel, required this.flag});
  final String code;
  final String nativeLabel;
  final String subLabel;
  final String flag;
}

/// `FALLBACK_LANGS` (APP_LANGUAGES order).
final List<LanguageTile> kFallbackLanguageTiles = [
  for (final l in kAppLanguages) LanguageTile(code: l.code, nativeLabel: l.nativeName, subLabel: l.name, flag: l.flag),
];

final Map<String, String> _flagByCode = {for (final l in kAppLanguages) l.code: l.flag};
final Set<String> _countryCodes = {for (final c in kCountryRows) c.$1};

/// `localizedCountryName(code, language, fallback)`.
String localizedCountryName(String code, String language, [String? fallback]) =>
    kCountryNames[normalizeAppLanguage(language)]?[code.toUpperCase()] ?? fallback ?? code;

/// CLDR likely regions of the app languages (`new Intl.Locale(tag).maximize().region` for a bare language tag).
const Map<String, String> _likelyRegion = {
  'az': 'AZ', 'en': 'US', 'tr': 'TR', 'ru': 'RU', 'de': 'DE', 'ar': 'EG', 'ka': 'GE', 'kk': 'KZ', 'uz': 'UZ',
  'zh': 'CN', 'id': 'ID', 'fr': 'FR', 'es': 'ES', 'pt': 'BR', 'vi': 'VN', 'hi': 'IN', 'ja': 'JP', 'ko': 'KR',
  'pl': 'PL', 'nl': 'NL', 'sv': 'SE', 'ky': 'KG', 'et': 'EE', 'tk': 'TM', 'uk': 'UA',
};

/// `guessCountryFromLocale(countries)`: the first device locale whose (maximized) region is a known country.
String? guessCountryFromLocales(List<Locale> locales) {
  for (final loc in locales) {
    final region = (loc.countryCode != null && loc.countryCode!.isNotEmpty)
        ? loc.countryCode!.toUpperCase()
        : _likelyRegion[loc.languageCode.toLowerCase()];
    if (region != null && _countryCodes.contains(region)) return region;
  }
  return null;
}

/// `filteredCountries`: search on the English or localized name; without a query the guessed country first.
List<(String, String)> filterCountries(String query, String? guessed, String language) {
  if (query.isNotEmpty) {
    final q = query.toLowerCase();
    return [
      for (final c in kCountryRows)
        if (c.$2.toLowerCase().contains(q) || localizedCountryName(c.$1, language, c.$2).toLowerCase().contains(q)) c,
    ];
  }
  if (guessed != null) {
    final idx = kCountryRows.indexWhere((c) => c.$1 == guessed);
    if (idx > 0) return [kCountryRows[idx], ...kCountryRows.take(idx), ...kCountryRows.skip(idx + 1)];
  }
  return kCountryRows;
}

class InitialLanguageScreen extends ConsumerStatefulWidget {
  const InitialLanguageScreen({super.key});

  @override
  ConsumerState<InitialLanguageScreen> createState() => _InitialLanguageScreenState();
}

class _InitialLanguageScreenState extends ConsumerState<InitialLanguageScreen> {
  int _step = 1;
  late String _selected = ref.read(userStoreProvider).language.isEmpty ? 'az' : ref.read(userStoreProvider).language;
  bool _switching = false;
  bool _languageError = false;
  String _query = '';
  final TextEditingController _search = TextEditingController();
  List<LanguageTile> _langs = kFallbackLanguageTiles;
  late String? _guessed = guessCountryFromLocales(ref.read(deviceLocalesProvider));
  String? _geo;
  bool _geoKnown = false;
  bool _userPicked = false;
  final ScrollController _grid = ScrollController();
  final Map<String, GlobalKey> _tileKeys = {};

  @override
  void initState() {
    super.initState();
    unawaited(ref.read(geoCountryFetcherProvider)().then((country) {
      if (!mounted) return;
      _geo = country;
      _geoKnown = true;
      _applyGeo();
    }));
    unawaited(ref.read(activeLanguagesProvider.future).then((list) {
      if (!mounted) return;
      final mapped = [
        for (final l in list)
          LanguageTile(code: l.code, nativeLabel: l.nativeName, subLabel: l.name, flag: _flagByCode[l.code] ?? 'az'),
      ];
      if (!mapped.any((l) => l.code == 'az')) mapped.insert(0, kFallbackLanguageTiles.first);
      setState(() => _langs = mapped);
      _applyGeo();
    }, onError: (Object _) {}));
  }

  /// IP country's language is preselected (unless the user already tapped a language).
  void _applyGeo() {
    final geo = _geo;
    if (!_geoKnown || geo == null || _userPicked) return;
    final language = languageForCountry(geo, [for (final l in _langs) l.code]);
    setState(() {
      _selected = language;
      if (_countryCodes.contains(geo)) _guessed = geo;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _tileKeys[language]?.currentContext;
      if (ctx != null) unawaited(Scrollable.ensureVisible(ctx, alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd));
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _grid.dispose();
    super.dispose();
  }

  void _select(String code) {
    if (_switching) return;
    _userPicked = true;
    setState(() {
      _selected = code;
      _languageError = false;
    });
  }

  Future<void> _continue() async {
    if (_switching || _selected.isEmpty) return;
    setState(() {
      _switching = true;
      _languageError = false;
    });
    try {
      if (_selected != 'az') {
        final runtime = ref.read(i18nRuntimeProvider);
        await runtime.ensureLanguageReady(_selected);
        unawaited(runtime.loadTranslations(_selected).catchError((Object _) {}));
      }
      ref.read(userStoreProvider.notifier).setLanguage(_selected);
      await Future<void>.delayed(const Duration(milliseconds: 300));
      if (mounted) setState(() => _step = 2);
    } catch (_) {
      if (mounted) setState(() => _languageError = true);
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  void _selectCountry(String code) {
    final store = ref.read(userStoreProvider.notifier);
    store.setCountryCode(code);
    store.setHasSelectedLanguage(true);
    // React reloads the page once for non-az languages (module constants computed at import time);
    // Flutter rebuilds from the language providers instead.
  }

  String _l(String key, Map<String, String> m) => startupText(_selected, key, m[_selected] ?? m['az']!);

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final isRtl = isRtlLang(_selected);
    final pad = MediaQuery.paddingOf(context);
    return Material(type: MaterialType.transparency, child: AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: EdgeInsets.only(top: pad.top, bottom: pad.bottom),
          child: Stack(children: [
            const EntrySky(clouds: 4),
            Positioned.fill(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                    child: PresenceSwitcher(
                      childKey: _step,
                      exitOffset: Offset(rtlX(-30, isRtl), 0),
                      exitDuration: const Duration(milliseconds: 350),
                      child: _step == 1
                          ? MotionIn(
                              key: const ValueKey('step-1'),
                              offset: const Offset(0, 10),
                              duration: const Duration(milliseconds: 350),
                              child: _stepOne(context),
                            )
                          : MotionIn(
                              key: const ValueKey('step-2'),
                              offset: Offset(rtlX(30, isRtl), 0),
                              duration: const Duration(milliseconds: 350),
                              child: _stepTwo(context),
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ),
    ));
  }

  Widget _stepOne(BuildContext context) {
    final a = context.a;
    final expanded = kPackLanguageCodes.contains(_selected);
    final selectLanguage = _l('selectLanguage', const {
      'az': 'Dil seçin', 'en': 'Select Language', 'ru': 'Выберите язык', 'tr': 'Dil seçin', 'kk': 'Тілді таңдаңыз',
      'uz': 'Tilni tanlang', 'ka': 'აირჩიეთ ენა', 'de': 'Sprache auswählen', 'ar': 'اختاري اللغة',
    });
    final cont = _l('continue', const {
      'az': 'Davam et', 'en': 'Continue', 'ru': 'Продолжить', 'tr': 'Devam et', 'kk': 'Жалғастыру', 'uz': 'Davom etish',
      'ka': 'გაგრძელება', 'de': 'Weiter', 'ar': 'متابعة',
    });
    final hint = _l('languageHint', const {
      'az': 'Dili sonradan tənzimləmələrdən dəyişə bilərsiniz',
      'en': 'You can change the language later in settings',
      'ru': 'Язык можно изменить позже в настройках',
      'tr': 'Dili daha sonra ayarlardan değiştirebilirsiniz',
      'kk': 'Тілді кейін баптаулардан өзгерте аласыз',
      'uz': 'Tilni keyinroq sozlamalardan oʻzgartira olasiz',
      'ka': 'ენის შეცვლა მოგვიანებით პარამეტრებში შეგიძლიათ',
      'de': 'Du kannst die Sprache später in den Einstellungen ändern',
      'ar': 'يمكنكِ تغيير اللغة لاحقًا من الإعدادات',
    });
    final white = const Color(0xFFFFFFFF);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // Compact brand
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(children: [
          Container(
            width: 56,
            height: 56,
            margin: const EdgeInsets.only(bottom: 16),
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: a.gradPeach,
              // InitialLanguageScreen.tsx brand tile shadow
              boxShadow: [cssShadow(14, 28, -12, const Color(0x80D96C4A))],
            ),
            child: const BrandMark(size: 36),
          ),
          Text(selectLanguage, textAlign: TextAlign.center, style: css(20, FontWeight.w800, lsEm: -0.01, height: 1.2, color: a.ink)),
          const SizedBox(height: 4),
          Text(expanded ? 'ANACAN' : 'SELECT LANGUAGE',
              textAlign: TextAlign.center, style: css(10.5, FontWeight.w700, lsEm: 0.1, color: a.onBgSoft)),
        ]),
      ),
      // 2-column language grid — the only scrolling part.
      Expanded(
        child: SingleChildScrollView(
          controller: _grid,
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
          child: _grid2(context),
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_languageError)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  startupText(_selected, 'connectionPending', 'Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.'),
                  textAlign: TextAlign.center,
                  style: css(14, FontWeight.w400, height: 20 / 14),
                ),
              ),
            ),
          MotionIn(
            offset: const Offset(0, 10),
            delay: const Duration(milliseconds: 250),
            duration: const Duration(milliseconds: 300),
            child: PressScale(
              scale: 0.98,
              enabled: !_switching,
              onTap: _switching ? null : _continue,
              child: Semantics(
                button: true,
                enabled: !_switching,
                child: Opacity(
                  opacity: _switching ? 0.7 : 1,
                  child: Container(
                    key: const ValueKey('language-continue'),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: a.peach2,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [cssShadow(16, 32, -12, const Color(0x99D96C4A))],
                    ),
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: cont),
                        if (!expanded) ...[
                          TextSpan(
                              text: '·',
                              style: css(14, FontWeight.w400, color: white.withValues(alpha: 0.7))),
                          TextSpan(text: 'Continue', style: css(14, FontWeight.w500, color: white.withValues(alpha: 0.9))),
                        ],
                      ]),
                      textAlign: TextAlign.center,
                      style: css(14, FontWeight.w700, color: white, height: 20 / 14),
                    ).withMiddleDotMargins(!expanded),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(hint, textAlign: TextAlign.center, style: css(11, FontWeight.w400, height: 1.625, color: a.onBgSoft)),
        ]),
      ),
    ]);
  }

  Widget _grid2(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < _langs.length; i += 2) {
      if (i > 0) rows.add(const SizedBox(height: 12));
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: _tile(context, _langs[i], i)),
          const SizedBox(width: 12),
          Expanded(child: i + 1 < _langs.length ? _tile(context, _langs[i + 1], i + 1) : const SizedBox()),
        ]),
      ));
    }
    return Column(children: rows);
  }

  Widget _tile(BuildContext context, LanguageTile lang, int idx) {
    final a = context.a;
    final selected = _selected == lang.code;
    final key = _tileKeys.putIfAbsent(lang.code, GlobalKey.new);
    final delayMs = ((0.08 + idx * 0.035).clamp(0, 0.35) * 1000).round();
    return MotionIn(
      key: key,
      offset: const Offset(0, 12),
      delay: Duration(milliseconds: delayMs),
      duration: const Duration(milliseconds: 300),
      child: PressScale(
        scale: 0.97,
        enabled: !_switching,
        onTap: () => _select(lang.code),
        child: Semantics(
          key: ValueKey('lang-tile-${lang.code}'),
          button: true,
          selected: selected,
          child: Stack(fit: StackFit.passthrough, children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              curve: ACurves.tailwind,
              padding: const EdgeInsets.all(14), // 16 − 2 px border
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(width: 2, color: selected ? a.peach2 : const Color(0x00000000)),
                boxShadow: a.cardShadow,
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    // rounded-md = calc(var(--radius) - 2px) = 14px (tailwind.config.ts, --radius 1rem)
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: a.line),
                    boxShadow: [cssShadow(2, 6, 0, const Color(0x14000000))],
                  ),
                  child: Image.asset(flagAsset(lang.flag), width: 36, height: 24, fit: BoxFit.cover, semanticLabel: lang.code),
                ),
                Text(lang.nativeLabel, textAlign: TextAlign.center, style: css(13.5, FontWeight.w700, color: a.ink)),
                const SizedBox(height: 2),
                Text(cssUppercase(lang.subLabel, ref.read(userStoreProvider).language),
                    textAlign: TextAlign.center, style: css(9.5, FontWeight.w600, lsEm: 0.06, color: a.inkSoft)),
              ]),
            ),
            if (selected)
              PositionedDirectional(
                top: 8,
                end: 8,
                child: MotionIn(
                  key: ValueKey('check-${lang.code}'),
                  opacity: 1,
                  scale: 0,
                  spring: ASprings.spring(stiffness: 400, damping: 18),
                  child: Container(
                    key: ValueKey('lang-selected-${lang.code}'),
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle),
                    child: const AIcon(AIcons.check, size: 12, strokeWidth: 3.5, color: Color(0xFFFFFFFF)),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _stepTwo(BuildContext context) {
    final a = context.a;
    final expanded = kPackLanguageCodes.contains(_selected);
    final selectCountry = _l('selectCountry', const {
      'az': 'Ölkə seçin', 'en': 'Select Country', 'ru': 'Выберите страну', 'tr': 'Ülke seçin', 'kk': 'Елді таңдаңыз',
      'uz': 'Mamlakatni tanlang', 'ka': 'აირჩიეთ ქვეყანა', 'de': 'Land auswählen', 'ar': 'اختاري الدولة',
    });
    final searchPlaceholder = _l('searchPlaceholder', const {
      'az': 'Axtar', 'en': 'Search', 'ru': 'Поиск', 'tr': 'Ara', 'kk': 'Іздеу', 'uz': 'Qidirish', 'ka': 'ძებნა',
      'de': 'Suchen', 'ar': 'بحث',
    });
    final noneFound = _l('noneFound', const {
      'az': 'Ölkə tapılmadı', 'en': 'No countries found', 'ru': 'Страны не найдены', 'tr': 'Ülke bulunamadı',
      'kk': 'Ел табылмады', 'uz': 'Mamlakat topilmadi', 'ka': 'ქვეყანა ვერ მოიძებნა', 'de': 'Kein Land gefunden',
      'ar': 'لم يتم العثور على دولة',
    });
    final countries = filterCountries(_query, _guessed, _selected);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 20),
        child: Row(children: [
          EntryIconButton(
            semanticLabel: startupText(_selected, 'back', 'Back'),
            onTap: () => setState(() => _step = 1),
            child: const AIcon(AIcons.chevronLeft, size: 18, strokeWidth: 2.5, mirrorInRtl: true),
          ),
          Expanded(
            child: Column(children: [
              Text(selectCountry, textAlign: TextAlign.center, style: css(17, FontWeight.w800, height: 1.2, color: a.ink)),
              const SizedBox(height: 2),
              Text(expanded ? 'ANACAN' : 'SELECT COUNTRY',
                  textAlign: TextAlign.center, style: css(9, FontWeight.w800, lsEm: 0.14, color: a.onBgSoft)),
            ]),
          ),
          const SizedBox(width: 40),
        ]),
      ),
      // Search
      Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: a.line),
          boxShadow: a.cardShadow,
        ),
        height: 50,
        child: Stack(alignment: Alignment.center, children: [
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsetsDirectional.only(start: 43, end: 15),
              child: Center(
                child: TextField(
                  key: const ValueKey('country-search'),
                  controller: _search,
                  onChanged: (v) => setState(() => _query = v),
                  // text-sm loses to keyboard.css on phones (16px; the 20px line box stays).
                  style: phoneInputStyle(context, css(14, FontWeight.w400, color: a.ink, height: 1.43), lineHeightPx: 20),
                  cursorColor: a.ink,
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    hintText: searchPlaceholder,
                    hintStyle: phoneInputStyle(context, css(14, FontWeight.w400, color: context.tokens.shadcn.mutedForeground, height: 1.43), lineHeightPx: 20),
                  ),
                ),
              ),
            ),
          ),
          PositionedDirectional(
            start: 16,
            child: AIcon(AIcons.search, size: 16, strokeWidth: 2.5, color: a.inkFaint),
          ),
        ]),
      ),
      // List card
      Expanded(
        child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
          child: countries.isEmpty
              ? SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
                    child: Column(children: [
                      AIcon(AIcons.globe, size: 40, color: a.inkFaint),
                      const SizedBox(height: 12),
                      Text(noneFound, textAlign: TextAlign.center, style: css(13, FontWeight.w400, color: a.inkSoft)),
                    ]),
                  ),
                )
              : _CountryList(
                  countries: countries,
                  guessed: _query.isEmpty ? _guessed : null,
                  language: _selected,
                  onPick: _selectCountry,
                ),
        ),
      ),
    ]);
  }
}

extension on Text {
  /// `<span className="mx-1.5">·</span>`: 6 px on each side of the middle dot.
  Widget withMiddleDotMargins(bool apply) {
    if (!apply) return this;
    final span = textSpan as TextSpan;
    final children = <InlineSpan>[];
    for (final c in span.children!) {
      if (c is TextSpan && c.text == '·') {
        children
          ..add(const WidgetSpan(child: SizedBox(width: 6)))
          ..add(c)
          ..add(const WidgetSpan(child: SizedBox(width: 6)));
      } else {
        children.add(c);
      }
    }
    return Text.rich(TextSpan(children: children), textAlign: textAlign, style: style);
  }
}

class _CountryList extends StatefulWidget {
  const _CountryList({required this.countries, required this.guessed, required this.language, required this.onPick});
  final List<(String, String)> countries;
  final String? guessed;
  final String language;
  final ValueChanged<String> onPick;

  @override
  State<_CountryList> createState() => _CountryListState();
}

class _CountryListState extends State<_CountryList> with SingleTickerProviderStateMixin {
  // Rows enter with opacity 0 / y 6, delay min(idx·20 ms, 300 ms), 250 ms. One clock for the whole list.
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 550));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else if (_c.value == 0 && !_c.isAnimating) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ListView.builder(
      padding: EdgeInsets.zero,
      itemCount: widget.countries.length,
      itemBuilder: (context, idx) {
        final (iso, name) = widget.countries[idx];
        final guessed = widget.guessed == iso;
        final label = localizedCountryName(iso, widget.language, name);
        final row = GestureDetector(
          key: ValueKey('country-$iso'),
          behavior: HitTestBehavior.opaque,
          onTap: () => widget.onPick(iso),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              // `var(--a-peach-soft, rgba(255,157,99,0.08))` — the variable is not defined, the fallback applies
              color: guessed ? const Color(0x14FF9D63) : null,
              border: Border(bottom: BorderSide(color: a.line)),
            ),
            child: Row(children: [
              Container(
                width: 24,
                height: 16,
                margin: const EdgeInsetsDirectional.only(end: 12),
                clipBehavior: Clip.antiAlias,
                // rounded-sm = calc(var(--radius) - 4px) = 12px
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: a.line)),
                child: Image.asset(flagAsset(iso), fit: BoxFit.cover, semanticLabel: label),
              ),
              Expanded(
                child: Text(label, textAlign: TextAlign.start, style: css(13.5, FontWeight.w600, color: a.ink)),
              ),
              if (guessed)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: AIcon(AIcons.check, key: const ValueKey('country-guessed'), size: 14, strokeWidth: 3, color: a.peach2),
                ),
              AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint),
            ]),
          ),
        );
        final delay = (idx * 20).clamp(0, 300) / 550;
        final span = 250 / 550;
        return AnimatedBuilder(
          animation: _c,
          child: row,
          builder: (context, child) {
            final p = ACurves.framerDefault.transform(((_c.value - delay) / span).clamp(0.0, 1.0));
            if (p >= 1) return child!;
            return Opacity(opacity: p, child: Transform.translate(offset: Offset(0, 6 * (1 - p)), child: child));
          },
        );
      },
    );
  }
}
