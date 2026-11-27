import type React from 'react';
import './books.css';
import { ChevronRight } from 'lucide-react';
import { bookCover, booksForAge, homeBookAge, tintVars } from '@/lib/books/catalog';
import { formatTr, tr } from '@/lib/tr';
import { useBooksText } from './booksCopy';
import { logEvent } from '@/lib/analytics';

/**
 * Ana home: a swipe row of the 10 printable books for the active child's age group (6+ ay … 6+ yaş; the youngest
 * group when there is no child or the baby is under 5 months). Every slide and the header open the book store.
 */
export default function BooksHomeCarousel({ childMonths, onOpen }: { childMonths?: number | null; onOpen: () => void }) {
  const { t } = useBooksText();
  const age = homeBookAge(childMonths);
  const books = booksForAge(age);
  if (!books.length) return null;
  const tint = tintVars(age) as React.CSSProperties;
  const ageLabel = t(`age_${age}` as const);
  const open = (book?: string) => { void logEvent('books_reco_clicked', { mode: 'mommy_carousel', age, ...(book ? { book } : {}) }); onOpen(); };
  const title = tr('dash_books_title', 'Yaşına uyğun kitablar');

  return (
    <section className="a-section bk-home-rail" data-testid="books-home-carousel" data-age={age} style={tint}>
      <div className="a-section-head bk-home-rail-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="a-section-title a-heading">{title}</h2>
          <p className="bk-home-rail-sub">{formatTr('dash_books_sub', '{age} · {n} kitab', { age: ageLabel, n: books.length })}</p>
        </div>
        <button type="button" className="a-section-link bk-home-rail-all" onClick={() => open()}>
          {tr('dash_books_all', 'Hamısı')}
          <ChevronRight size={14} className="rtl:rotate-180" />
        </button>
      </div>
      <ul className="bk-home-rail-track" aria-label={title}>
        {books.map((book) => (
          <li key={book.id}>
            <button type="button" className="bk-home-slide" onClick={() => open(book.id)}>
              <span className="bk-home-slide-cover bk-tint-bg">
                <img src={bookCover(book.id)} alt="" loading="lazy" decoding="async" width={910} height={1287} />
              </span>
              <b>{book.title}</b>
              <span className="bk-home-slide-age bk-tint-ink">{ageLabel}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
