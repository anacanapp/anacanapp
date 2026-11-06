/** Azerbaijani-only shop block on the home page: a hero slider (PDF books, monthly cakes, special-day cakes),
 * a 5-column grid of PDF books and a cake carousel. Catalogue reads happen in the browser after hydration;
 * the server render keeps the text and links (no network on SSR). */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebsite } from './context';
import { Arrow, Eyebrow } from './components';
import { ageLabel, bookUnit, cakeTag, coverUrl, isBento, money, readShopCatalog, type ShopBook, type ShopCake } from './shop-data';
import './home-shop.css';

type Slide = { key: string; eyebrow: string; title: string; em: string; text: string; cta: string; link: 'books' | 'cakes'; tint: string; images: string[] };

function useCatalog() {
  const [books, setBooks] = useState<ShopBook[] | null>(null);
  const [cakes, setCakes] = useState<ShopCake[] | null>(null);
  useEffect(() => {
    let live = true;
    readShopCatalog<ShopBook>('books').then((value) => { if (live) setBooks(value); }).catch(() => { if (live) setBooks([]); });
    readShopCatalog<ShopCake>('cakes').then((value) => { if (live) setCakes(value); }).catch(() => { if (live) setCakes([]); });
    return () => { live = false; };
  }, []);
  return { books, cakes };
}

function HeroSlider({ slides }: { slides: Slide[] }) {
  const { href } = useWebsite();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const count = slides.length;
  const go = (next: number) => setIndex((next + count) % count);
  useEffect(() => {
    if (paused || count < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % count), 6500);
    return () => window.clearTimeout(timer);
  }, [index, paused, count]);
  return <div className="hs-slider" role="region" aria-roledescription="carousel" aria-label="Anacan mağaza"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    onTouchStart={(event) => { touch.current = event.touches[0].clientX; }}
    onTouchEnd={(event) => { const start = touch.current; touch.current = null; if (start === null) return; const dx = event.changedTouches[0].clientX - start; if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1)); }}>
    <div className="hs-track" style={{ transform: `translateX(${-index * 100}%)` }}>
      {slides.map((slide, i) => <article key={slide.key} className={`hs-slide hs-tint-${slide.tint}`} aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== index}>
        <div className="hs-copy">
          <Eyebrow>{slide.eyebrow}</Eyebrow>
          <h2>{slide.title} <em>{slide.em}</em></h2>
          <p>{slide.text}</p>
          <a className="site-primary-button" href={href(slide.link)} tabIndex={i === index ? 0 : -1}>{slide.cta}<Arrow diagonal /></a>
        </div>
        <div className={`hs-art hs-art-${slide.images.length}`} aria-hidden="true">
          {slide.images.length ? slide.images.slice(0, 3).map((src, n) => <img key={src + n} src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} />) : <span className="hs-art-wash" />}
        </div>
      </article>)}
    </div>
    {count > 1 && <div className="hs-controls">
      <button type="button" className="hs-arrow" aria-label="Əvvəlki" onClick={() => go(index - 1)}><ChevronLeft size={18} /></button>
      <div className="hs-dots">{slides.map((slide, i) => <button key={slide.key} type="button" aria-label={`${i + 1}-ci slayd`} aria-current={i === index} className={i === index ? 'on' : ''} onClick={() => go(i)} />)}</div>
      <button type="button" className="hs-arrow" aria-label="Növbəti" onClick={() => go(index + 1)}><ChevronRight size={18} /></button>
    </div>}
  </div>;
}

function BookGrid({ books }: { books: ShopBook[] | null }) {
  const { href } = useWebsite();
  const list = books ? books.slice(0, 10) : null;
  return <div className="hs-block">
    <div className="hs-head"><div><Eyebrow>Çap üçün PDF kitablar</Eyebrow><h2>Yaşına uyğun <em>çap kitabları</em></h2></div>
      <a className="site-text-link" href={href('books')}>Bütün kitablar<Arrow diagonal /></a></div>
    {list && !list.length ? null : <div className="hs-grid5">
      {(list || Array.from({ length: 10 }, () => null)).map((book, i) => book
        ? <a key={book.id} className="hs-book" href={href('books')}>
          <span className="hs-cover"><img src={coverUrl(book)} alt="" loading="lazy" /></span>
          <span className="hs-meta">{ageLabel(book.age_group)} · {book.pages} səh.</span>
          <span className="hs-name">{book.title}</span>
          <span className="hs-price">{money(bookUnit(10))}–{money(bookUnit(1))}</span>
        </a>
        : <span key={i} className="hs-book hs-skel" aria-hidden="true"><span className="hs-cover" /></span>)}
    </div>}
    <p className="hs-note">1 kitab 4 ₼, 10+ kitab hər biri 2 ₼. Ödənişdən sonra PDF e-poçtla gəlir.</p>
  </div>;
}

function CakeCarousel({ cakes }: { cakes: ShopCake[] | null }) {
  const { href } = useWebsite();
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => { const el = rail.current; if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' }); };
  const list = cakes ? cakes.filter((cake) => cake.image_url) : null;
  if (list && !list.length) return null;
  return <div className="hs-block">
    <div className="hs-head"><div><Eyebrow>Anacan tortları</Eyebrow><h2>Hər ay üçün <em>bir tort</em></h2></div>
      <div className="hs-head-actions">
        <button type="button" className="hs-arrow" aria-label="Geri" onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
        <button type="button" className="hs-arrow" aria-label="İrəli" onClick={() => scroll(1)}><ChevronRight size={18} /></button>
        <a className="site-text-link" href={href('cakes')}>Bütün tortlar<Arrow diagonal /></a>
      </div></div>
    <div className="hs-rail" ref={rail} tabIndex={0} aria-label="Tortlar">
      {(list || Array.from({ length: 6 }, () => null)).map((cake, i) => cake
        ? <a key={cake.id} className="hs-cake" href={href('cakes')}>
          <span className="hs-photo"><img src={cake.image_url!} alt="" loading="lazy" />{cakeTag(cake) && <span className="hs-tag">{cakeTag(cake)}</span>}</span>
          <span className="hs-name">{cake.name}</span>
          <span className="hs-price">{money(Number(cake.price))}</span>
        </a>
        : <span key={i} className="hs-cake hs-skel" aria-hidden="true"><span className="hs-photo" /></span>)}
    </div>
  </div>;
}

export default function HomeShop() {
  const { books, cakes } = useCatalog();
  const covers = (books || []).slice(0, 3).map(coverUrl);
  const bento = (cakes || []).filter((cake) => isBento(cake) && cake.image_url).map((cake) => cake.image_url!);
  const special = (cakes || []).filter((cake) => !isBento(cake) && cake.image_url).map((cake) => cake.image_url!);
  const slides: Slide[] = [
    { key: 'books', eyebrow: 'Yeni · PDF kitablar', title: '6 aydan 6 yaşa', em: 'çap kitabları', text: `Boyama, say, hərflər, məntiq və nitq oyunları: ${books?.length || 70} kitab. Ödənişdən sonra dərhal e-poçtla, evdə A4-ə çap edin.`, cta: 'Kitablara bax', link: 'books', tint: 'peach', images: covers },
    { key: 'bento', eyebrow: 'Aylıq bento tortlar', title: 'Körpənin hər ayı üçün', em: 'bir tort', text: '1-ci aydan 1 yaşa qədər hər ay üçün xüsusi bento tort, Anacan qutusunda. Bakı daxili çatdırılma.', cta: 'Tortlara bax', link: 'cakes', tint: 'sky', images: bento.slice(0, 3) },
    { key: 'special', eyebrow: 'Xüsusi günlər', title: '40 gün, ilk diş,', em: 'gender reveal', text: 'Ailənin ən xüsusi anları üçün əl işi tortlar. 4 dad seçimi, foto qutusu ilə. Kartla təhlükəsiz ödəniş.', cta: 'Sifariş et', link: 'cakes', tint: 'mint', images: special.slice(0, 3) },
  ];
  return <section className="site-section hs" id="shop" aria-label="Anacan mağaza">
    <HeroSlider slides={slides} />
    <BookGrid books={books} />
    <CakeCarousel cakes={cakes} />
  </section>;
}
