import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Check, Download, Library, Loader2, Mail, Plus, Printer, ShoppingBag, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { AGE_TINT, BOOK_AGES, BOOK_TOPICS, BOOKS, bookAgeForMonths, bookCover, findBook, type Book, type BookAge, type BookTopic } from '@/lib/books/catalog';
import { BOOK_BASE_PRICE, bookOrderTotal, bookUnitPrice, formatAzn, nextBookTier } from '@/lib/books/pricing';
import { bookDownloadUrl, fetchBookPaymentsReady, fetchMyBooks, openExternal, readCart, startBookCheckout, writeCart } from '@/lib/books/api';
import { useBooksText } from './booksCopy';
import { logEvent } from '@/lib/analytics';
import './books.css';

type Tab = 'store' | 'mine';
const TIERS = [1, 3, 5, 10];
const PENDING_KEY = 'anacan_books_pending_v1';
function readPending(): { orderId: string; ids: string[]; value: number } | null {
  try { const value = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); return value && Array.isArray(value.ids) ? value : null; } catch { return null; }
}

export default function BookStoreScreen({ onBack, initialTab = 'store' }: { onBack: () => void; initialTab?: Tab }) {
  useScrollToTop();
  const { t, language } = useBooksText();
  const { user } = useAuth();
  const client = useQueryClient();
  const { selectedChild, getChildAge } = useChildren();
  const childMonths = selectedChild ? getChildAge(selectedChild)?.months ?? null : null;
  const childAge = bookAgeForMonths(childMonths);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [age, setAge] = useState<BookAge | 'all'>(childAge ?? 'all');
  const [topic, setTopic] = useState<BookTopic | 'all'>('all');
  const [cart, setCart] = useState<string[]>(() => readCart());
  const [detail, setDetail] = useState<Book | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: ready = false } = useQuery({ queryKey: ['books-payments-ready'], queryFn: fetchBookPaymentsReady, staleTime: 60_000 });
  const { data: owned = [], isLoading: ownedLoading } = useQuery({ queryKey: ['my-books', user?.id], queryFn: fetchMyBooks, enabled: !!user, refetchOnWindowFocus: 'always' });
  const ownedIds = useMemo(() => new Set(owned.map(row => row.book_id)), [owned]);

  useEffect(() => { writeCart(cart); }, [cart]);
  useEffect(() => { void logEvent('books_store_viewed', { tab: initialTab, child_age: childAge ?? 'none' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A purchase is confirmed when the books of the last checkout appear in "Kitablarım".
  useEffect(() => {
    const pending = readPending();
    if (!pending || !pending.ids.length || !pending.ids.every(id => ownedIds.has(id))) return;
    void logEvent('books_purchase_confirmed', { order_id: pending.orderId, book_count: pending.ids.length, value: pending.value, currency: 'AZN' });
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  }, [ownedIds]);
  // Children load after the first render: open on the child's age group unless the person already chose.
  const [agePicked, setAgePicked] = useState(false);
  useEffect(() => { if (childAge && !agePicked) setAge(childAge); }, [childAge, agePicked]);
  const pickAge = (value: BookAge | 'all') => { setAgePicked(true); setAge(value); };
  // Books bought on another device or just paid for leave the cart.
  useEffect(() => { if (ownedIds.size) setCart(ids => ids.filter(id => !ownedIds.has(id))); }, [ownedIds]);

  const visible = BOOKS.filter(book => (age === 'all' || book.age === age) && (topic === 'all' || book.topic === topic));
  const inCart = (id: string) => cart.includes(id);
  const toggle = (id: string) => {
    const adding = !cart.includes(id);
    void logEvent(adding ? 'book_added_to_cart' : 'book_removed_from_cart', { book_id: id, cart_size: cart.length + (adding ? 1 : -1), value: bookUnitPrice(cart.length + 1), currency: 'AZN' });
    setCart(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };
  const addMany = (ids: string[]) => {
    void logEvent('books_collection_added', { age, count: ids.length });
    setCart(current => [...new Set([...current, ...ids.filter(id => !ownedIds.has(id))])]);
  };
  const openDetail = (book: Book) => { void logEvent('book_viewed', { book_id: book.id, age: book.age, topic: book.topic }); setDetail(book); };
  const ageLabel = (value: BookAge) => t(`age_${value}` as const);
  const collection = age !== 'all' ? BOOKS.filter(book => book.age === age && !ownedIds.has(book.id)) : [];

  const checkout = async () => {
    if (!cart.length || busy) return;
    if (!ready) { void logEvent('books_checkout_unavailable', { book_count: cart.length }); toast(t('pay_soon')); return; }
    setBusy(true);
    try {
      const result = await startBookCheckout(cart, language);
      if (result.ok === true) {
        const success = result as { url: string; orderId: string };
        const value = bookOrderTotal(cart.length);
        void logEvent('books_checkout_started', { order_id: success.orderId, book_count: cart.length, value, currency: 'AZN' });
        try { localStorage.setItem(PENDING_KEY, JSON.stringify({ orderId: success.orderId, ids: cart, value })); } catch { /* ignore */ }
        openExternal(success.url); toast(t('pay_waiting')); setCartOpen(false); return;
      }
      const failure = result as { reason: 'unavailable' | 'owned' | 'error'; owned?: string[] };
      if (failure.reason === 'owned') { setCart(ids => ids.filter(id => !failure.owned?.includes(id))); void client.invalidateQueries({ queryKey: ['my-books'] }); toast(t('pay_owned')); }
      else if (failure.reason === 'unavailable') { void logEvent('books_checkout_unavailable', { book_count: cart.length }); toast(t('pay_soon')); }
      else toast.error(t('pay_error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="a-scope safe-top min-h-screen pb-40 overflow-x-hidden books" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label="Back">
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{t('store_eyebrow')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{t('store_title')}</p>
            </div>
          </div>
        </header>

        <div className="bk-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'store'} className={tab === 'store' ? 'on' : ''} onClick={() => setTab('store')}><ShoppingBag size={15} />{t('tab_store')}</button>
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}><Library size={15} />{t('tab_mine')}{owned.length > 0 && <b>{owned.length}</b>}</button>
        </div>

        {tab === 'store' ? (<>
          <section className="bk-hero">
            <div className="bk-hero-text">
              <span className="bk-pill"><Sparkles size={12} />{t('hero_badge')}</span>
              <h1>{t('hero_title')}</h1>
              <p>{t('hero_body')}</p>
            </div>
            <div className="bk-fan" aria-hidden>
              {['6m_05', '3_05', '5_05'].map((id, index) => <img key={id} src={bookCover(id)} alt="" style={{ ['--i' as any]: index }} />)}
            </div>
            <div className="bk-benefits">{(['benefit_1', 'benefit_2', 'benefit_3'] as const).map(key => <span key={key}><Check size={12} />{t(key)}</span>)}</div>
          </section>

          {childAge && selectedChild && (
            <section className="bk-section">
              <div className="bk-head"><h2>{t('for_child', { name: selectedChild.name })}</h2><span className="bk-age" style={{ background: AGE_TINT[childAge].bg, color: AGE_TINT[childAge].ink }}>{ageLabel(childAge)}</span></div>
              <div className="bk-rail">
                {BOOKS.filter(book => book.age === childAge).map(book => (
                  <button key={book.id} className="bk-rail-item" onClick={() => openDetail(book)}>
                    <img src={bookCover(book.id)} alt={book.title} loading="lazy" />
                    {ownedIds.has(book.id) ? <span className="bk-flag own">{t('owned')}</span> : inCart(book.id) && <span className="bk-flag">{t('added')}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bk-section">
            <div className="bk-head"><h2>{t('bundles_title')}</h2></div>
            <p className="bk-sub">{t('bundles_body')}</p>
            <div className="bk-tiers">
              {TIERS.map(count => {
                const unit = bookUnitPrice(count), pct = Math.round((1 - unit / BOOK_BASE_PRICE) * 100);
                const active = cart.length >= count && (count === 10 || cart.length < TIERS[TIERS.indexOf(count) + 1]);
                return (
                  <div key={count} className={`bk-tier${count === 5 ? ' hot' : ''}${count === 10 ? ' best' : ''}${active ? ' active' : ''}`}>
                    {count === 5 && <em>{t('popular')}</em>}{count === 10 && <em>{t('best')}</em>}
                    <b>{t('bundle_n', { n: count })}</b>
                    <strong>{formatAzn(bookOrderTotal(count))}</strong>
                    <span>{t('per_book', { price: formatAzn(unit) })}</span>
                    {pct > 0 ? <i>{t('save', { pct })}</i> : <i className="muted">&nbsp;</i>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bk-section">
            <div className="bk-chips">
              <button className={age === 'all' ? 'on' : ''} onClick={() => pickAge('all')}>{t('age_all')}</button>
              {BOOK_AGES.map(value => (
                <button key={value} className={age === value ? 'on' : ''} onClick={() => pickAge(value)} style={age === value ? { background: AGE_TINT[value].ink } : { color: AGE_TINT[value].ink }}>{ageLabel(value)}</button>
              ))}
            </div>
            <div className="bk-chips soft">
              <button className={topic === 'all' ? 'on' : ''} onClick={() => setTopic('all')}>{t('topic_all')}</button>
              {BOOK_TOPICS.map(value => <button key={value} className={topic === value ? 'on' : ''} onClick={() => setTopic(value)}>{t(`topic_${value}` as const)}</button>)}
            </div>
          </section>

          {age !== 'all' && topic === 'all' && collection.length >= 3 && (
            <section className="bk-collection" style={{ background: AGE_TINT[age].bg }}>
              <div className="bk-collection-covers">{collection.slice(0, 4).map(book => <img key={book.id} src={bookCover(book.id)} alt="" loading="lazy" />)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ color: AGE_TINT[age].ink }}>{t('collection_title', { age: ageLabel(age) })}</b>
                <p>{collection.length === 10 ? t('collection_body') : t('results', { n: collection.length })}</p>
                <button onClick={() => addMany(collection.map(book => book.id))} style={{ background: AGE_TINT[age].ink }}>
                  <Plus size={14} />{t('collection_cta')} · {formatAzn(bookOrderTotal(new Set([...cart, ...collection.map(book => book.id)]).size))}
                </button>
              </div>
            </section>
          )}

          <section className="bk-section">
            <div className="bk-head"><h2>{t('results', { n: visible.length })}</h2><span className="bk-note">{t('language_note')}</span></div>
            <div className="bk-grid">
              {visible.map(book => {
                const own = ownedIds.has(book.id), added = inCart(book.id);
                return (
                  <article key={book.id} className="bk-card">
                    <button className="bk-cover" onClick={() => openDetail(book)} aria-label={book.title}>
                      <img src={bookCover(book.id)} alt={book.title} loading="lazy" />
                    </button>
                    <div className="bk-card-body">
                      <b>{book.title}</b>
                      <span>{t('pages', { n: book.pages })}</span>
                    </div>
                    {own ? <span className="bk-own"><Check size={13} />{t('owned')}</span> : (
                      <button className={`bk-add${added ? ' on' : ''}`} onClick={() => toggle(book.id)} aria-pressed={added}>
                        {added ? <><Check size={14} />{t('added')}</> : <><Plus size={14} />{formatAzn(bookUnitPrice(Math.max(1, cart.length + 1)))}</>}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <p className="bk-legal">{t('personal_use')} · {t('language_note')}</p>
        </>) : (
          <MyBooks owned={owned.map(row => row.book_id)} loading={ownedLoading} onBrowse={() => setTab('store')} />
        )}
      </div>

      <AnimatePresence>
        {tab === 'store' && cart.length > 0 && !cartOpen && (
          <motion.button className="bk-cartbar" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={() => setCartOpen(true)}>
            <span className="bk-cartbar-count">{cart.length}</span>
            <span className="bk-cartbar-text"><b>{formatAzn(bookOrderTotal(cart.length))}</b>
              <small>{nextBookTier(cart.length) ? t('cart_next', { n: nextBookTier(cart.length)!.add, price: formatAzn(nextBookTier(cart.length)!.unit) }) : t('cart_best')}</small></span>
            <span className="bk-cartbar-cta">{t('cart_title')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>{detail && (
        <BookDetail book={detail} owned={ownedIds.has(detail.id)} inCart={inCart(detail.id)} price={bookUnitPrice(Math.max(1, cart.length + (inCart(detail.id) ? 0 : 1)))}
          onToggle={() => toggle(detail.id)} onClose={() => setDetail(null)} onMine={() => { setDetail(null); setTab('mine'); }} />
      )}</AnimatePresence>
      <AnimatePresence>{cartOpen && (
        <CartSheet cart={cart} ready={ready} busy={busy} onRemove={id => setCart(ids => ids.filter(x => x !== id))} onClose={() => setCartOpen(false)} onCheckout={checkout} />
      )}</AnimatePresence>
    </div>
  );
}

function Sheet({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  return (
    <motion.div className="a-scope bk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <motion.div className="bk-sheet safe-bottom" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={event => event.stopPropagation()}>
        <button className="bk-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function PrintGuide() {
  const { t } = useBooksText();
  return (
    <div className="bk-print">
      <h3><Printer size={15} />{t('print_title')}</h3>
      <ol>{(['print_1', 'print_2', 'print_3', 'print_4', 'print_5', 'print_6'] as const).map(key => <li key={key}>{t(key)}</li>)}</ol>
    </div>
  );
}

function BookDetail({ book, owned, inCart, price, onToggle, onClose, onMine }: { book: Book; owned: boolean; inCart: boolean; price: number; onToggle: () => void; onClose: () => void; onMine: () => void }) {
  const { t } = useBooksText();
  const tint = AGE_TINT[book.age];
  return (
    <Sheet onClose={onClose} label={book.title}>
      <div className="bk-detail-top" style={{ background: tint.bg }}>
        <img src={bookCover(book.id)} alt={book.title} />
      </div>
      <div className="bk-detail-tags">
        <span style={{ background: tint.bg, color: tint.ink }}>{t(`age_${book.age}` as const)}</span>
        <span>{t(`topic_${book.topic}` as const)}</span>
        <span>{t('print_meta', { pages: book.pages })}</span>
      </div>
      <h2 className="bk-detail-title">{book.title}</h2>
      <p className="bk-detail-sub">{book.subtitle}</p>
      <h3 className="bk-h3">{t('detail_skills')}</h3>
      <div className="bk-skills">{book.skills.map(skill => <span key={skill}>{skill}</span>)}</div>
      <h3 className="bk-h3">{t('detail_about')}</h3>
      <p className="bk-about">{book.about}</p>
      <PrintGuide />
      <div className="bk-detail-cta">
        {owned ? <button className="bk-primary" onClick={onMine}><Library size={16} />{t('tab_mine')}</button>
          : <button className={`bk-primary${inCart ? ' ghost' : ''}`} onClick={onToggle}>{inCart ? <><Check size={16} />{t('added')}</> : <><Plus size={16} />{t('add')} · {formatAzn(price)}</>}</button>}
      </div>
    </Sheet>
  );
}

function CartSheet({ cart, ready, busy, onRemove, onClose, onCheckout }: { cart: string[]; ready: boolean; busy: boolean; onRemove: (id: string) => void; onClose: () => void; onCheckout: () => void }) {
  const { t } = useBooksText();
  const count = cart.length, total = bookOrderTotal(count), saved = Math.round((count * BOOK_BASE_PRICE - total) * 100) / 100;
  const next = nextBookTier(count);
  const progress = Math.min(1, count / 10);
  return (
    <Sheet onClose={onClose} label={t('cart_title')}>
      <h2 className="bk-detail-title" style={{ marginTop: 4 }}>{t('cart_title')} · {t('cart_count', { n: count })}</h2>
      <div className="bk-ladder">
        <div className="bk-ladder-bar"><i style={{ width: `${progress * 100}%` }} /></div>
        <div className="bk-ladder-steps">{TIERS.map(step => <span key={step} className={count >= step ? 'on' : ''} style={{ left: `${(step / 10) * 100}%` }}><b>{step}</b><small>{formatAzn(bookUnitPrice(step))}</small></span>)}</div>
      </div>
      <p className="bk-nudge">{next ? t('cart_next', { n: next.add, price: formatAzn(next.unit) }) : t('cart_best')}</p>
      {count === 0 ? <p className="bk-sub">{t('cart_empty')}</p> : (
        <ul className="bk-cart-list">
          {cart.map(id => { const book = findBook(id); if (!book) return null; return (
            <li key={id}><img src={bookCover(id)} alt="" /><div><b>{book.title}</b><span>{t(`age_${book.age}` as const)} · {t('pages', { n: book.pages })}</span></div>
              <span className="bk-line-price">{formatAzn(bookUnitPrice(count))}</span>
              <button onClick={() => onRemove(id)} aria-label={t('cart_remove')}><X size={14} /></button></li>
          ); })}
        </ul>
      )}
      <div className="bk-total">
        <div><span>{t('cart_unit', { price: formatAzn(bookUnitPrice(Math.max(1, count))) })}</span>{saved > 0 && <em>{t('cart_saved', { amount: formatAzn(saved) })}</em>}</div>
        <div><span>{t('cart_total')}</span><b>{formatAzn(total)}</b></div>
      </div>
      <button className="bk-primary" disabled={!count || busy} onClick={onCheckout}>{busy ? <Loader2 className="animate-spin" size={16} /> : <ShoppingBag size={16} />}{t('checkout')}</button>
      <p className="bk-paynote">{ready ? t('pay_note') : t('pay_soon')}</p>
    </Sheet>
  );
}

function MyBooks({ owned, loading, onBrowse }: { owned: string[]; loading: boolean; onBrowse: () => void }) {
  const { t } = useBooksText();
  const [pending, setPending] = useState<string | null>(null);
  const download = async (id: string) => {
    setPending(id);
    try { const url = await bookDownloadUrl(id); if (url) { void logEvent('book_downloaded', { book_id: id }); openExternal(url); } else toast.error(t('download_error')); }
    finally { setPending(null); }
  };
  if (loading) return <div className="bk-empty"><Loader2 className="animate-spin" /></div>;
  if (!owned.length) return (
    <div className="bk-empty">
      <BookOpen size={34} />
      <b>{t('mine_empty_title')}</b>
      <p>{t('mine_empty_body')}</p>
      <button className="bk-primary" onClick={onBrowse}><ShoppingBag size={16} />{t('tab_store')}</button>
    </div>
  );
  return (
    <div className="bk-section">
      <p className="bk-mail"><Mail size={14} />{t('email_note')}</p>
      <ul className="bk-mine">
        {owned.map(id => { const book = findBook(id); if (!book) return null; return (
          <li key={id}>
            <img src={bookCover(id)} alt="" />
            <div><b>{book.title}</b><span>{t(`age_${book.age}` as const)} · {t('print_meta', { pages: book.pages })}</span>
              <button className="bk-dl" onClick={() => download(id)} disabled={pending === id}>{pending === id ? <><Loader2 className="animate-spin" size={14} />{t('downloading')}</> : <><Download size={14} />{t('download')}</>}</button>
            </div>
          </li>
        ); })}
      </ul>
      <PrintGuide />
      <p className="bk-legal">{t('personal_use')}</p>
    </div>
  );
}
