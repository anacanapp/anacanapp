// Ported from: src/pages/Index.tsx (`books` / `my-books` → `<BookStoreScreen initialTab />`, admin or az only — the
//              shell guard), src/components/Dashboard.tsx (`<BooksHomeCard mode="bump" pregnancyWeek />`,
//              `<BooksHomeCarousel childMonths onOpen />`, both `onNavigate('books')`)
//
// Wiring (docs/flutter/WIRING.md):
//   registry: registerBooksFeature
//   HomeSlots(booksHomeCard: booksHomeCardSlot, …)
//   MommyHomeSlots(slots: {MommySlot.booksCarousel: booksCarouselSlot, …})
// The play-together hand-off needs no override: the store takes `pendingBookOpenProvider` on mount.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/shell.dart';
import '../home_mommy/mommy_home_slots.dart' show MommySlotArgs;
import 'book_store_screen.dart';
import 'books_home.dart';

void registerBooksFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.books, (context, a) => BookStoreScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.myBooks, (context, a) => BookStoreScreen(onBack: a.onBack, initialTab: 'mine'));
}

/// `HomeSlots.booksHomeCard`: the bump dashboard card (the host checks admin / az).
Widget booksHomeCardSlot(BuildContext context, int? pregnancyWeek) => Consumer(
      builder: (context, ref, _) => BooksHomeCard(
        mode: 'bump',
        pregnancyWeek: pregnancyWeek,
        onOpen: () => ref.read(shellProvider.notifier).openScreen(ScreenId.books.id),
      ),
    );

/// `MommySlot.booksCarousel` (the host checks admin / az).
Widget booksCarouselSlot(BuildContext context, MommySlotArgs args) =>
    BooksHomeCarousel(childMonths: args.childMonths, onOpen: () => args.onNavigate('books'));
