import { ChevronRight } from 'lucide-react';
import { AGE_TINT, BOOKS, bookAgeForMonths, bookCover, type BookAge } from '@/lib/books/catalog';
import { useBooksText } from './booksCopy';

/**
 * Dashboard entry to the printable books shop, timed to the child's age: from 5 months on a
 * mother sees the books of her child's age group; in late pregnancy (week 28+) the 6+ month set.
 */
export default function BooksHomeCard({ mode, childName, childMonths, pregnancyWeek, onOpen }: {
  mode: 'mommy' | 'bump'; childName?: string | null; childMonths?: number | null; pregnancyWeek?: number | null; onOpen: () => void;
}) {
  const { t } = useBooksText();
  let age: BookAge | null = null, title = '', body = '';
  if (mode === 'mommy') {
    age = bookAgeForMonths(childMonths);
    if (!age) return null;
    title = childName ? t('reco_title', { name: childName }) : t('store_title');
    body = t('reco_body', { age: t(`age_${age}` as const) });
  } else {
    if (!pregnancyWeek || pregnancyWeek < 28) return null;
    age = '6m'; title = t('reco_bump_title'); body = t('reco_bump_body');
  }
  const covers = BOOKS.filter(book => book.age === age).slice(0, 3);
  const tint = AGE_TINT[age];
  return (
    <section className="a-section">
      <button type="button" onClick={onOpen} className="a-card a-fade-in w-full text-start" style={{ display: 'flex', alignItems: 'center', gap: 14, background: tint.bg, boxShadow: 'none' }}>
        <span aria-hidden style={{ position: 'relative', width: 78, height: 84, flexShrink: 0 }}>
          {covers.map((book, index) => (
            <img key={book.id} src={bookCover(book.id)} alt="" loading="lazy"
              style={{ position: 'absolute', width: 52, borderRadius: 7, left: index * 12, top: index === 1 ? 0 : 6, transform: `rotate(${(index - 1) * 7}deg)`, boxShadow: '0 8px 16px -10px rgba(0,0,0,.45)', border: '2px solid #fff' }} />
          ))}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, color: '#fff', background: tint.ink, borderRadius: 999, padding: '3px 8px' }}>{t('recommended')} · {t(`age_${age}` as const)}</span>
          <b style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)', marginTop: 6, lineHeight: 1.25 }}>{title}</b>
          <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.4, color: 'var(--a-ink-soft)', marginTop: 3 }}>{body}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 800, color: tint.ink, marginTop: 6 }}>{t('reco_cta')}<ChevronRight className="rtl:rotate-180" size={14} /></span>
        </span>
      </button>
    </section>
  );
}
