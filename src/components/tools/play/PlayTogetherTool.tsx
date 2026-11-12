import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, Clock, Heart, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { logEvent } from '@/lib/analytics';
import { bookCover, type Book } from '@/lib/books/catalog';
import { useUserStore } from '@/store/userStore';
import { hasPlayContent, loadPlayContent, mergePlayLocale, type PlayContent } from '@/data/play-together';
import { PLAY_UI_AZ } from '@/data/play-together/ui-az';
import type { PlayUiText } from '@/data/play-together/types';
import {
  PLAY_AGE_BANDS, PLAY_CATEGORIES, bandForMonths, booksForAgeGroup, booksForGame, dayKey, gamesForAge, handsOnSkills,
  logPlayed, minutesOn, monthsForBand, playedOn, readPlayState, screenGuideFor, todaysPicks, toggleFav, unlogPlayed,
  weekStrip, writePlayState, type PlayAgeBand, type PlayCategory, type PlayGame, type PlayState,
} from '@/lib/play-together';
import { ToolHeader, ToolLoading, ToolPage } from '../anacan/ToolKit';
import './play-together.css';

const CAT_EMOJI: Record<PlayCategory, string> = { craft: '✂️', move: '🤸', pretend: '🎭', kitchen: '🥣', calm: '🧩', outdoor: '🌳', words: '🎵' };

const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{([a-z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** UI strings of the loaded language, with the few formatted ones as functions. */
function makeT(ui: PlayUiText, language: string) {
  const num = (n: number) => { try { return new Intl.NumberFormat(language).format(n); } catch { return String(n); } };
  const fmtAge = (months: number) => (months < 24 && months % 12 !== 0
    ? fill(ui.ageMonths, { n: num(months) })
    : fill(ui.ageYears, { n: num(Math.round((months / 12) * 2) / 2) }));
  return {
    ...ui,
    minutes: (n: number) => fill(ui.minutes, { n: num(n) }),
    ageFor: (name: string) => fill(ui.ageFor, { name }),
    pages: (n: number) => fill(ui.pages, { n: num(n) }),
    ageRange: (a: number, b: number) => `${fmtAge(a)} - ${fmtAge(b)}`,
  };
}
type PlayT = ReturnType<typeof makeT>;
const PlayTextContext = createContext<PlayT>(makeT(PLAY_UI_AZ, 'az'));
const useT = () => useContext(PlayTextContext);

const BOOKS_OPEN_KEY = 'anacan_books_open_v1';

/** Opens the PDF book store on one book (BookStoreScreen reads the key once). */
function openBookInStore(book: Book) {
  try { sessionStorage.setItem(BOOKS_OPEN_KEY, book.id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('anacan:deeplink', { detail: { action: 'screen', params: { screen: 'books' } } }));
}

export default function PlayTogetherTool({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('PlayTogether', 'Tools');
  const appLanguage = useUserStore((s) => s.language);
  const language = hasPlayContent(appLanguage) ? appLanguage : 'az';
  const [content, setContent] = useState<PlayContent | null>(() => (language === 'az' ? mergePlayLocale('az', { ui: PLAY_UI_AZ, games: {} }) : null));
  useEffect(() => {
    let alive = true;
    if (content?.language !== language) void loadPlayContent(language).then((c) => { if (alive) setContent(c); });
    return () => { alive = false; };
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!content) return <ToolLoading />;
  return (
    <PlayTextContext.Provider value={makeT(content.ui, content.language)}>
      <PlayHome onBack={onBack} games={content.games} showBooks={content.language === 'az'} />
    </PlayTextContext.Provider>
  );
}

/** Book links point to the PDF store, which is Azerbaijani only. */
function PlayHome({ onBack, games: allGames, showBooks }: { onBack: () => void; games: PlayGame[]; showBooks: boolean }) {
  const T = useT();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { selectedChild, getChildAge } = useChildren();
  const childMonths = selectedChild ? getChildAge(selectedChild)?.months ?? null : null;
  const [state, setState] = useState<PlayState>(() => readPlayState(typeof localStorage === 'undefined' ? null : localStorage, userId));
  useEffect(() => { setState(readPlayState(localStorage, userId)); }, [userId]);
  const save = (next: PlayState) => { setState(next); writePlayState(localStorage, userId, next); };

  const childBand = childMonths != null ? bandForMonths(childMonths) : null;
  const band: PlayAgeBand = state.band ?? childBand ?? '2y';
  const months = state.band ? monthsForBand(state.band) : childMonths ?? monthsForBand(band);
  const [cat, setCat] = useState<PlayCategory | 'all' | 'favs'>('all');
  const [open, setOpen] = useState<PlayGame | null>(null);
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => { void logEvent('play_together_opened', { band, has_child: childMonths != null }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const today = dayKey(now);
  const games = useMemo(() => gamesForAge(allGames, months), [allGames, months]);
  const done = playedOn(state, today);
  const picks = useMemo(() => todaysPicks(games, `${today}|${selectedChild?.id ?? 'x'}|${band}`, new Set()), [games, today, selectedChild?.id, band]);
  const list = cat === 'all' ? games : cat === 'favs' ? allGames.filter((g) => state.favs.includes(g.id)) : games.filter((g) => g.cat === cat);
  const cats = PLAY_CATEGORIES.filter((c) => games.some((g) => g.cat === c));
  const week = weekStrip(state, now);
  const ageBooks = useMemo(() => (showBooks ? booksForAgeGroup(months).slice(0, 10) : []), [months, showBooks]);
  const guide = screenGuideFor(months);

  const pickBand = (value: PlayAgeBand) => save({ ...state, band: value === childBand ? null : value });
  const openGame = (game: PlayGame) => { void logEvent('play_game_viewed', { game: game.id, cat: game.cat }); setOpen(game); };
  const togglePlayed = (game: PlayGame) => {
    if (done.has(game.id)) { save(unlogPlayed(state, game.id, new Date())); return; }
    void logEvent('play_game_done', { game: game.id, cat: game.cat, minutes: game.minutes });
    save(logPlayed(state, game, new Date()));
  };
  const showBook = (b: Book, from: string) => { void logEvent('play_book_clicked', { book_id: b.id, from }); setBook(b); };

  if (open) {
    return (
      <PlayGameScreen game={open} played={done.has(open.id)} fav={state.favs.includes(open.id)}
        onBack={() => setOpen(null)} onPlayed={() => togglePlayed(open)} onFav={() => save(toggleFav(state, open.id))}
        onBook={(b) => showBook(b, 'game')} book={book} onCloseBook={() => setBook(null)} showBooks={showBooks} />
    );
  }

  return (
    <ToolPage>
      <ToolHeader title={T.title} eyebrow={T.eyebrow} onBack={onBack} />
      <div className="pt-wrap">
        <div className="pt-ages" role="tablist" aria-label={selectedChild ? T.ageFor(selectedChild.name) : undefined}>
          {PLAY_AGE_BANDS.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={band === b.id} className={`pt-chip${band === b.id ? ' on' : ''}`} onClick={() => pickBand(b.id)}>
              {b.id === childBand && selectedChild ? `${selectedChild.avatar_emoji || '👶'} ` : ''}{T.ageLabel[b.id]}
            </button>
          ))}
        </div>

        <section className="pt-card pt-today" aria-label={T.today}>
          <div className="pt-today-row">
            <div>
              <p className="pt-eyebrow">{T.today}</p>
              <p className="pt-big">{T.minutes(minutesOn(state, today))}</p>
            </div>
            <div className="pt-week" title={T.weekHint}>
              {week.map((d) => <span key={d.day} className={`pt-dot${d.minutes > 0 ? ' on' : ''}${d.today ? ' today' : ''}`} aria-label={`${d.day}: ${d.minutes}`} />)}
            </div>
          </div>
          <p className="pt-guide">📵 {T.guide[guide]}</p>
          <p className="pt-src">{T.guideSource}</p>
        </section>

        <h2 className="pt-h2">{T.picksTitle}</h2>
        <p className="pt-sub">{T.picksSub}</p>
        <div className="pt-picks">
          {picks.map((g) => (
            <button key={g.id} type="button" className={`pt-pick pt-cat-${g.cat}`} onClick={() => openGame(g)}>
              <span className="pt-pick-emoji" aria-hidden>{g.emoji}</span>
              <span className="pt-pick-title">{g.title}</span>
              <span className="pt-pick-meta"><Clock size={12} aria-hidden /> {T.minutes(g.minutes)}{done.has(g.id) && <Check size={13} className="pt-ok" aria-label={T.playedDone} />}</span>
            </button>
          ))}
        </div>

        <h2 className="pt-h2">{T.allGames}</h2>
        <div className="pt-cats">
          <button type="button" className={`pt-chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>{T.all} · {games.length}</button>
          {cats.map((c) => (
            <button key={c} type="button" className={`pt-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{CAT_EMOJI[c]} {T.cats[c]}</button>
          ))}
          <button type="button" className={`pt-chip${cat === 'favs' ? ' on' : ''}`} onClick={() => setCat('favs')}><Heart size={12} aria-hidden /> {T.favs}</button>
        </div>
        <div className="pt-list">
          {list.length === 0 && <p className="pt-empty">{cat === 'favs' ? T.noFavs : T.noGames}</p>}
          {list.map((g) => (
            <button key={g.id} type="button" className="pt-row" onClick={() => openGame(g)}>
              <span className={`pt-row-emoji pt-cat-${g.cat}`} aria-hidden>{g.emoji}</span>
              <span className="pt-row-text">
                <span className="pt-row-title">{g.title}</span>
                <span className="pt-row-sub">{CAT_EMOJI[g.cat]} {T.cats[g.cat]} · {T.minutes(g.minutes)}{showBooks && g.books.length > 0 && <> · <BookOpen size={11} aria-hidden /> {g.books.length}</>}</span>
              </span>
              {done.has(g.id) ? <Check size={16} className="pt-ok" aria-label={T.playedDone} /> : state.favs.includes(g.id) ? <Heart size={14} className="pt-heart" aria-label={T.favs} /> : null}
            </button>
          ))}
        </div>

        {ageBooks.length > 0 && <>
          <h2 className="pt-h2">{T.booksTitle}</h2>
          <p className="pt-sub">{T.booksSub}</p>
          <div className="pt-books">
            {ageBooks.map((b) => (
              <button key={b.id} type="button" className="pt-book" onClick={() => showBook(b, 'age')}>
                <img src={bookCover(b.id)} alt="" loading="lazy" className="pt-book-cover" />
                <span className="pt-book-title">{b.title}</span>
                {handsOnSkills(b).length > 0 && <span className="pt-book-tags">{handsOnSkills(b).slice(0, 2).join(' · ')}</span>}
              </button>
            ))}
          </div>
        </>}
      </div>
      {book && <BookSheet book={book} onClose={() => setBook(null)} />}
    </ToolPage>
  );
}

function PlayGameScreen({ game, played, fav, onBack, onPlayed, onFav, onBook, book, onCloseBook, showBooks }: {
  game: PlayGame; played: boolean; fav: boolean; onBack: () => void; onPlayed: () => void; onFav: () => void;
  onBook: (b: Book) => void; book: Book | null; onCloseBook: () => void; showBooks: boolean;
}) {
  const T = useT();
  const [have, setHave] = useState<Set<number>>(new Set());
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* ignore */ } }, [game.id]);
  const books = showBooks ? booksForGame(game) : [];
  return (
    <ToolPage>
      <ToolHeader title={T.title} eyebrow={T.cats[game.cat]} onBack={onBack}
        actions={<button type="button" className="a-icon-btn" onClick={onFav} aria-label={fav ? T.unfav : T.fav} aria-pressed={fav}>
          <Heart size={16} className={fav ? 'pt-heart' : ''} fill={fav ? 'currentColor' : 'none'} /></button>} />
      <div className="pt-wrap pt-detail">
        <div className={`pt-hero pt-cat-${game.cat}`}>
          <span className="pt-hero-emoji" aria-hidden>{game.emoji}</span>
          <h1 className="pt-hero-title">{game.title}</h1>
          <p className="pt-hero-meta"><Clock size={13} aria-hidden /> {T.minutes(game.minutes)} · {T.ageRange(game.minM, game.maxM)}</p>
        </div>

        <section className="pt-card">
          <p className="pt-eyebrow"><Sparkles size={12} aria-hidden /> {T.why}</p>
          <p className="pt-p">{game.why}</p>
        </section>

        <section className="pt-card">
          <p className="pt-eyebrow">{T.materials}</p>
          <ul className="pt-materials">
            {game.materials.map((m, i) => (
              <li key={m}>
                <button type="button" className={`pt-have${have.has(i) ? ' on' : ''}`} aria-pressed={have.has(i)}
                  onClick={() => setHave((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>
                  <span className="pt-box" aria-hidden>{have.has(i) && <Check size={12} />}</span>{m}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-card">
          <p className="pt-eyebrow">{T.steps}</p>
          <ol className="pt-steps">
            {game.steps.map((s, i) => <li key={i}><span className="pt-num" aria-hidden>{i + 1}</span><span>{s}</span></li>)}
          </ol>
        </section>

        {game.tip && <section className="pt-card pt-tip"><p className="pt-eyebrow">💡 {T.tip}</p><p className="pt-p">{game.tip}</p></section>}
        {game.safety && <section className="pt-card pt-safety" role="note"><p className="pt-eyebrow"><ShieldAlert size={12} aria-hidden /> {T.safety}</p><p className="pt-p">{game.safety}</p></section>}

        {books.length > 0 && <section>
          <h2 className="pt-h2">{T.continueInBook}</h2>
          <p className="pt-sub">{T.continueInBookSub}</p>
          <div className="pt-books">
            {books.map((b) => (
              <button key={b.id} type="button" className="pt-book" onClick={() => onBook(b)}>
                <img src={bookCover(b.id)} alt="" loading="lazy" className="pt-book-cover" />
                <span className="pt-book-title">{b.title}</span>
                <span className="pt-book-tags">{T.ageLabel[b.age as PlayAgeBand] ?? ''}</span>
              </button>
            ))}
          </div>
        </section>}

        <div className="pt-cta-bar">
          <button type="button" className={`a-cta-btn pt-cta${played ? ' done' : ''}`} onClick={onPlayed} aria-pressed={played}>
            <Check size={16} aria-hidden /> {played ? T.playedDone : T.played}
          </button>
        </div>
      </div>
      {book && <BookSheet book={book} onClose={onCloseBook} />}
    </ToolPage>
  );
}

function BookSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const T = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const tags = handsOnSkills(book);
  return createPortal(
    <div className="a-scope pt-sheet-back" onClick={onClose} role="presentation">
      <div className="pt-sheet" role="dialog" aria-modal="true" aria-label={book.title} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="a-icon-btn pt-sheet-x" onClick={onClose} aria-label={T.close}><X size={16} /></button>
        <div className="pt-sheet-head">
          <img src={bookCover(book.id)} alt="" className="pt-sheet-cover" />
          <div>
            <p className="pt-eyebrow">{T.ageLabel[book.age as PlayAgeBand] ?? ''} · {T.pages(book.pages)}</p>
            <h3 className="pt-sheet-title">{book.title}</h3>
            <p className="pt-sub" style={{ margin: 0 }}>{book.subtitle}</p>
          </div>
        </div>
        <p className="pt-p">{book.about}</p>
        <p className="pt-eyebrow">{T.insideBook}</p>
        <div className="pt-tags">{(tags.length ? tags : book.skills).map((s) => <span key={s} className="pt-tag">{s}</span>)}{tags.length > 0 && book.skills.filter((s) => !tags.includes(s)).map((s) => <span key={s} className="pt-tag soft">{s}</span>)}</div>
        <button type="button" className="a-cta-btn pt-cta" onClick={() => { onClose(); openBookInStore(book); }}>
          <BookOpen size={16} aria-hidden /> {T.openStore}
        </button>
      </div>
    </div>,
    document.body,
  );
}
