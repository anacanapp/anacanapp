// Ported from: src/components/books/BooksHomeCard.tsx, src/components/books/BooksHomeCarousel.tsx,
//              src/components/books/books.css (.bk-home-card, .bk-home-rail*, .bk-home-slide*)
import 'dart:math' as math;

import 'package:flutter/rendering.dart' show OverflowBoxFit;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../state/user_store.dart';
import '../settings/ui/settings_ui.dart' show FadeRise, px;
import 'books_catalog.dart';
import 'books_widgets.dart';

/// `BooksHomeCard`: the store entry timed to the child's age (mommy, from 5 months) or late pregnancy (bump, week
/// 28+ → the 6+ month set).
class BooksHomeCard extends ConsumerWidget {
  const BooksHomeCard({super.key, required this.mode, this.childName, this.childMonths, this.pregnancyWeek, required this.onOpen});

  /// `'mommy' | 'bump'`.
  final String mode;
  final String? childName;
  final num? childMonths;
  final int? pregnancyWeek;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    String t(String key, [Map<String, Object?> vars = const {}]) => booksText(key, language, vars);
    String? age;
    String title, body;
    if (mode == 'mommy') {
      age = bookAgeForMonths(childMonths);
      if (age == null) return const SizedBox.shrink();
      title = childName != null && childName!.isNotEmpty ? t('reco_title', {'name': childName}) : t('store_title');
      body = t('reco_body', {'age': t('age_$age')});
    } else {
      if (pregnancyWeek == null || pregnancyWeek! < 28) return const SizedBox.shrink();
      age = '6m';
      title = t('reco_bump_title');
      body = t('reco_bump_body');
    }
    final catalog = ref.watch(bookCatalogProvider).value;
    final covers = catalog == null ? const <Book>[] : booksForAge(catalog, age, 3);
    final a = context.a;
    final tint = bookTint(age, dark: context.tokens.isDark);
    final cardAge = age;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: FadeRise(
        child: Semantics(
          button: true,
          child: GestureDetector(
            key: const ValueKey('books-home-card'),
            behavior: HitTestBehavior.opaque,
            onTap: () {
              ref.read(analyticsSinkProvider).logEvent('books_reco_clicked', {'mode': mode, 'age': cardAge});
              onOpen();
            },
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line)),
              child: Row(children: [
                ExcludeSemantics(
                  child: SizedBox(
                    width: 78,
                    height: 84,
                    child: Stack(clipBehavior: Clip.none, children: [
                      for (var i = 0; i < covers.length; i++)
                        Positioned(
                          left: i * 12.0,
                          top: i == 1 ? 0 : 6,
                          child: Transform.rotate(
                            angle: (i - 1) * 7 * math.pi / 180,
                            child: BookCover(
                              covers[i].id,
                              width: 52,
                              radius: 7,
                              border: Border.all(color: a.surface, width: 2),
                              // 0 8px 16px -10px rgba(0,0,0,.45)
                              shadow: const [BoxShadow(color: Color(0x73000000), offset: Offset(0, 8), blurRadius: 16, spreadRadius: -10)],
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: tint.solid, borderRadius: BorderRadius.circular(999)),
                      child: Text('${t('recommended')} · ${t('age_$age')}', style: px(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(title, style: px(14.5, weight: FontWeight.w800, color: a.ink, height: 1.25)),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(body, style: px(11.5, color: a.inkSoft, height: 1.4)),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(t('reco_cta'), style: px(12, weight: FontWeight.w800, color: tint.ink)),
                        const SizedBox(width: 2),
                        AIcon(AIcons.chevronRight, size: 14, color: tint.ink, mirrorInRtl: true),
                      ]),
                    ),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// `BooksHomeCarousel`: the 10 books of the active child's age group (the youngest group without a child or under 5
/// months). Every slide and the header open the store.
class BooksHomeCarousel extends ConsumerWidget {
  const BooksHomeCarousel({super.key, this.childMonths, required this.onOpen});
  final num? childMonths;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final catalog = ref.watch(bookCatalogProvider).value;
    if (catalog == null) return const SizedBox.shrink();
    final age = homeBookAge(childMonths);
    final books = booksForAge(catalog, age);
    if (books.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    final x = context.aText;
    final tint = bookTint(age, dark: context.tokens.isDark);
    final ageLabel = booksText('age_$age', language);
    final title = tr('dash_books_title', 'Yaşına uyğun kitablar');
    void open([String? book]) {
      ref.read(analyticsSinkProvider).logEvent('books_reco_clicked', {'mode': 'mommy_carousel', 'age': age, 'book': ?book});
      onOpen();
    }

    final slideWidth = MediaQuery.sizeOf(context).width >= 400 ? 108.0 : 100.0;
    return Padding(
      key: ValueKey('books-home-carousel-$age'),
      padding: const EdgeInsets.only(top: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Semantics(header: true, child: Text(title, style: x.aSectionTitle)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(formatTr('dash_books_sub', '{age} · {n} kitab', {'age': ageLabel, 'n': books.length}), style: px(12, weight: FontWeight.w600, color: a.onBgSoft)),
                ),
              ]),
            ),
            const SizedBox(width: 10),
            Semantics(
              button: true,
              child: GestureDetector(
                key: const ValueKey('books-home-all'),
                behavior: HitTestBehavior.opaque,
                onTap: open,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(tr('dash_books_all', 'Hamısı'), style: px(12.5, weight: FontWeight.w700, color: a.coralText)),
                    const SizedBox(width: 2),
                    AIcon(AIcons.chevronRight, size: 14, color: a.coralText, mirrorInRtl: true),
                  ]),
                ),
              ),
            ),
          ]),
        ),
        Transform.translate(
          offset: Offset(Directionality.of(context) == TextDirection.rtl ? 20 : -20, 0),
          child: LayoutBuilder(builder: (context, c) {
            return OverflowBox(
              alignment: AlignmentDirectional.centerStart,
              minWidth: c.maxWidth + 40,
              maxWidth: c.maxWidth + 40,
              fit: OverflowBoxFit.deferToChild,
              child: Semantics(
                label: title,
                child: SingleChildScrollView(
                  key: const ValueKey('books-home-track'),
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(20, 2, 20, 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    for (var i = 0; i < books.length; i++) ...[
                      if (i > 0) const SizedBox(width: 10),
                      PressScale.css(
                        key: ValueKey('books-home-slide-${books[i].id}'),
                        scale: 0.97,
                        onTap: () => open(books[i].id),
                        child: Semantics(
                          button: true,
                          child: SizedBox(
                            width: slideWidth,
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(14), boxShadow: a.cardShadow),
                                child: BookCover(
                                  books[i].id,
                                  radius: 9,
                                  shadow: const [BoxShadow(color: Color(0x73000000), offset: Offset(0, 8), blurRadius: 16, spreadRadius: -12)],
                                ),
                              ),
                              const SizedBox(height: 4),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(books[i].title, maxLines: 2, overflow: TextOverflow.ellipsis, style: px(12.5, weight: FontWeight.w800, color: a.onBg, height: 1.25)),
                              ),
                              const SizedBox(height: 4),
                              Text(ageLabel, style: px(11, weight: FontWeight.w800, color: tint.ink)),
                            ]),
                          ),
                        ),
                      ),
                    ],
                  ]),
                ),
              ),
            );
          }),
        ),
      ]),
    );
  }
}
