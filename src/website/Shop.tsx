import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Eyebrow } from './components';
import {
  BOOK_AGES, CAKE_CATEGORIES, FLAVORS, PHOTO_BOX, WEEKDAYS, ageLabel, bookTotal, bookUnit, cakeCategory, cakeSpecs, cakeStory, cakeTag, cakeUnit,
  coverUrl, isBento, money, nextTier, readShopCatalog, readShopReady, shopDays, startShopCheckout,
  type CakeLine, type ShopBook, type ShopCake, type ShopKind,
} from './shop-data';
import './shop.css';

/** anacan.az shop (Azerbaijani only): PDF print books and cakes, paid with Epoint via the web-shop function.
 * The server renders the page frame; the catalogue, cart and checkout load in the browser. */
export default function ShopPage({ kind }: { kind: ShopKind }) {
  return kind === 'books' ? <BooksShop /> : <CakesShop />;
}

// ---------- shared ----------
const cartKey = (kind: ShopKind) => `anacan_web_cart_${kind}`;
function useStoredCart<T>(kind: ShopKind): [T[], (next: T[]) => void, boolean] {
  const [cart, setCart] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(cartKey(kind)) || '[]'); if (Array.isArray(value)) setCart(value); } catch { /* private mode */ }
    setLoaded(true);
  }, [kind]);
  const save = (next: T[]) => { setCart(next); try { localStorage.setItem(cartKey(kind), JSON.stringify(next)); } catch { /* private mode */ } };
  return [cart, save, loaded];
}
function usePaymentStatus() {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { try { setStatus(new URLSearchParams(window.location.search).get('odenis')); } catch { /* ignore */ } }, []);
  return status;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
  }, [onClose]);
  return <div className="shop-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="shop-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="shop-sheet-head"><h2>{title}</h2><button type="button" className="shop-x" aria-label="Bağla" onClick={onClose} autoFocus><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
function Chips({ items, value, onChange, label }: { items: Array<[string, string]>; value: string; onChange: (value: string) => void; label: string }) {
  return <div className="shop-chips" role="group" aria-label={label}>
    {items.map(([key, text]) => <button key={key} type="button" className={`shop-chip${value === key ? ' on' : ''}`} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}
function Field({ id, label, value, onChange, type = 'text', ...rest }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; maxLength?: number; placeholder?: string }) {
  return <div className="shop-field"><label htmlFor={id}>{label}</label>
    {type === 'textarea' ? <textarea id={id} className="shop-input" value={value} onChange={(event) => onChange(event.target.value)} maxLength={rest.maxLength} />
      : <input id={id} className="shop-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />}
  </div>;
}
function Banner({ status, kind }: { status: string | null; kind: ShopKind }) {
  if (status === 'ugurlu') return <div className="shop-note ok" role="status">{kind === 'books' ? 'Ödəniş qəbul olundu. PDF linkləri e-poçtunuza göndərildi; spam qovluğunu da yoxlayın.' : 'Ödəniş qəbul olundu. Qənnadı sifarişi təsdiqləyib sizə zəng edəcək.'}</div>;
  if (status === 'xeta') return <div className="shop-note bad" role="status">Ödəniş tamamlanmadı. Səbətiniz saxlanılıb, yenidən cəhd edə bilərsiniz.</div>;
  return null;
}
function CartBar({ summary, hint, onOpen }: { summary: string; hint: string; onOpen: () => void }) {
  return <div className="shop-cartbar"><div><span className="sum"><b>{summary}</b><small>{hint}</small></span><button type="button" className="shop-btn" onClick={onOpen}>Sifarişə keç</button></div></div>;
}
const checkoutError = (code?: string, status?: number) =>
  code === 'payments_unavailable' || code === 'function_disabled' || status === 503 ? 'Ödəniş sistemi hələ aktiv deyil. Səbətiniz saxlanılıb; kart ödənişi aktivləşən kimi sifarişi tamamlaya bilərsiniz.'
    : code === 'too_many_requests' ? 'Çox sayda sifariş cəhdi oldu. Bir saat sonra yenidən yoxlayın.'
      : code === 'invalid_date' ? 'Başqa tarix seçin (ən azı 48 saat sonra).'
        : code === 'network' ? 'Bağlantı alınmadı. İnterneti yoxlayıb yenidən cəhd edin.' : 'Ödəniş başlamadı. Bir az sonra yenidən cəhd edin.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, PHONE = /^\+?[0-9 ()-]{7,20}$/;

// ---------- books ----------
function BooksShop() {
  const [books, setBooks] = useState<ShopBook[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [age, setAge] = useState('all');
  const [open, setOpen] = useState<ShopBook | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [cart, setCart, loaded] = useStoredCart<string>('books');
  const status = usePaymentStatus();
  useEffect(() => {
    readShopCatalog<ShopBook>('books').then(setBooks).catch(() => setFailed(true));
    readShopReady('books').then(setReady);
  }, []);
  const known = useMemo(() => new Set((books || []).map((book) => book.id)), [books]);
  const items = loaded && books ? cart.filter((id) => known.has(id)) : [];
  const list = (books || []).filter((book) => age === 'all' || book.age_group === age);
  const toggle = (id: string) => setCart(items.includes(id) ? items.filter((x) => x !== id) : [...items, id]);
  const missing = age === 'all' ? [] : list.filter((book) => !items.includes(book.id));
  const tier = nextTier(items.length);
  return <div className="shop">
    <section className="shop-hero">
      <div>
        <Eyebrow>Çap üçün PDF kitablar</Eyebrow>
        <h1>Uşağınızın yaşına uyğun <em>çap kitabları</em></h1>
        <p className="lead">6 aydan 6 yaşa qədər {books?.length || 70} kitab: boyama, say, hərflər, məntiq və nitq oyunları. Ödənişdən sonra PDF linkləri e-poçtunuza gəlir, evdə A4 vərəqə çap edirsiniz.</p>
        <div className="shop-tiers">
          {[['1 kitab', '4 ₼'], ['3 kitab', '3 ₼ / kitab'], ['5 kitab', '2,60 ₼ / kitab'], ['10+ kitab', '2 ₼ / kitab']].map(([a, b], i) =>
            <div key={a} className={`shop-tier${i === 3 ? ' best' : ''}`}><b>{b}</b><span>{a}</span></div>)}
        </div>
        <div className="shop-facts"><span>A4, rəngli və ya ağ-qara</span><span>Dərhal e-poçtla</span><span>Kartla təhlükəsiz ödəniş</span></div>
        <Banner status={status} kind="books" />
      </div>
      <div className="shop-hero-art" aria-hidden="true">
        {(books || []).slice(0, 3).map((book, i) => <img key={book.id} src={coverUrl(book)} alt="" loading={i ? 'lazy' : 'eager'} className={`shop-fan shop-fan-${i}`} />)}
      </div>
    </section>
    <div className="shop-bar"><h2>Kataloq</h2><Chips items={BOOK_AGES} value={age} onChange={setAge} label="Yaş" /></div>
    {missing.length > 0 && <div className="shop-collection"><button type="button" className="shop-btn ghost" onClick={() => setCart([...items, ...missing.map((book) => book.id)])}>
      {ageLabel(age)} kolleksiyası: {missing.length} kitabı əlavə et · {money(bookTotal(items.length + missing.length) - bookTotal(items.length))}</button></div>}
    {failed ? <div className="shop-note bad">Kataloq yüklənmədi. Səhifəni yeniləyin və ya bir az sonra yenidən yoxlayın.</div>
      : !books ? <div className="shop-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="shop-skeleton" />)}</div>
        : <div className="shop-grid">{list.map((book) => {
          const inCart = items.includes(book.id);
          return <article key={book.id} className="shop-card book">
            <button type="button" className="open" aria-label={book.title} onClick={() => setOpen(book)}><img src={coverUrl(book)} alt="" loading="lazy" /><span className="shop-tag">{ageLabel(book.age_group)}</span></button>
            <div className="shop-card-body"><h3>{book.title}</h3>{book.subtitle && <p>{book.subtitle}</p>}
              <div className="shop-card-foot"><span className="shop-price">{book.pages} səh.</span>
                <button type="button" className={`shop-btn${inCart ? ' on' : ''}`} aria-pressed={inCart} onClick={() => toggle(book.id)}>{inCart ? 'Səbətdə ✓' : 'Səbətə'}</button></div></div>
          </article>;
        })}</div>}
    {items.length > 0 && <CartBar summary={`${items.length} kitab · ${money(bookTotal(items.length))}`} hint={tier ? `${tier - items.length} kitab da əlavə edin, hər biri ${money(bookUnit(tier))} olsun` : 'Ən sərfəli qiymət: kitabı 2 ₼'} onOpen={() => setCheckout(true)} />}
    {open && <Sheet title={open.title} onClose={() => setOpen(null)}>
      <div className="shop-detail"><img src={coverUrl(open)} alt={open.title} />
        <div>
          <p className="shop-muted">{ageLabel(open.age_group)}{open.subtitle ? ` · ${open.subtitle}` : ''}</p>
          <div className="shop-specs"><span><b>{open.pages} səhifə</b></span><span>A4 PDF</span>{open.size_mb ? <span>{Math.round(open.size_mb)} MB</span> : null}</div>
          {open.about && <p className="shop-about">{open.about}</p>}
          {open.skills?.length ? <div className="shop-chips shop-skills">{open.skills.map((skill) => <span key={skill} className="shop-chip">{skill}</span>)}</div> : null}
          <button type="button" className={`shop-btn wide${items.includes(open.id) ? ' on' : ''}`} onClick={() => { toggle(open.id); setOpen(null); }}>{items.includes(open.id) ? 'Səbətdən çıxar' : 'Səbətə əlavə et'}</button>
        </div></div>
    </Sheet>}
    {checkout && books && <Checkout kind="books" ready={ready} total={bookTotal(items.length)} onClose={() => setCheckout(false)}
      rows={items.map((id) => { const book = books.find((b) => b.id === id)!; return { key: id, image: coverUrl(book), title: book.title, sub: `${ageLabel(book.age_group)} · ${book.pages} səh.`, onRemove: () => toggle(id) }; })}
      payload={() => ({ book_ids: items })} />}
  </div>;
}

// ---------- cakes ----------
function CakesShop() {
  const [cakes, setCakes] = useState<ShopCake[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState<ShopCake | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [cart, setCart, loaded] = useStoredCart<CakeLine>('cakes');
  const status = usePaymentStatus();
  useEffect(() => {
    readShopCatalog<ShopCake>('cakes').then(setCakes).catch(() => setFailed(true));
    readShopReady('cakes').then(setReady);
  }, []);
  const byId = useMemo(() => new Map((cakes || []).map((cake) => [cake.id, cake])), [cakes]);
  const lines = loaded && cakes ? cart.filter((line) => byId.has(line.cake_id)).map((line) => { const cake = byId.get(line.cake_id)!; return { ...line, price: cake.price, name: cake.name, image_url: cake.image_url }; }) : [];
  const categories = CAKE_CATEGORIES.filter(([key]) => key === 'all' || (cakes || []).some((cake) => cakeCategory(cake) === key));
  const list = (cakes || []).filter((cake) => category === 'all' || cakeCategory(cake) === category);
  const total = lines.reduce((sum, line) => sum + cakeUnit(line) * line.qty, 0);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const pics = (cakes || []).filter((cake) => cake.image_url).slice(0, 3);
  return <div className="shop">
    <section className="shop-hero">
      <div>
        <Eyebrow>Anacan tortları</Eyebrow>
        <h1>Körpənin hər ayı üçün <em>bir tort</em></h1>
        <p className="lead">Aylıq bento tortlar, 40 gün, ilk diş, 1 yaş və gender reveal tortları. Hamısı Anacan qutusunda, əl işi, pastel kremlə. Bakı daxili çatdırılma.</p>
        <div className="shop-facts"><span>Ən azı 48 saat qabaqcadan</span><span>4 dad seçimi</span><span>Çatdırılma və ya özün götür</span></div>
        <Banner status={status} kind="cakes" />
      </div>
      <div className="shop-hero-art" aria-hidden="true">{pics.map((cake, i) => <img key={cake.id} src={cake.image_url!} alt="" loading={i ? 'lazy' : 'eager'} className={`shop-pic shop-pic-${i}`} />)}</div>
    </section>
    <div className="shop-bar"><h2>Tortlar</h2><Chips items={categories} value={category} onChange={setCategory} label="Kateqoriya" /></div>
    {failed ? <div className="shop-note bad">Kataloq yüklənmədi. Səhifəni yeniləyin və ya bir az sonra yenidən yoxlayın.</div>
      : !cakes ? <div className="shop-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="shop-skeleton" />)}</div>
        : <div className="shop-grid">{list.map((cake) => <article key={cake.id} className="shop-card">
          <button type="button" className="open" aria-label={cake.name} onClick={() => setOpen(cake)}>{cake.image_url ? <img src={cake.image_url} alt="" loading="lazy" /> : <span className="shop-skeleton" />}{cakeTag(cake) && <span className="shop-tag">{cakeTag(cake)}</span>}</button>
          <div className="shop-card-body"><h3>{cake.name}</h3><div className="shop-card-foot"><span className="shop-price">{money(Number(cake.price))}</span><button type="button" className="shop-btn" onClick={() => setOpen(cake)}>Seç</button></div></div>
        </article>)}</div>}
    {count > 0 && <CartBar summary={`${count} tort · ${money(total)}`} hint="Çatdırılma tarixi növbəti addımda seçilir" onOpen={() => setCheckout(true)} />}
    {open && <CakeSheet cake={open} onClose={() => setOpen(null)} onAdd={(line) => { setCart([...lines, line]); setOpen(null); }} />}
    {checkout && <Checkout kind="cakes" ready={ready} total={total} onClose={() => setCheckout(false)}
      rows={lines.map((line, index) => ({ key: `${line.cake_id}-${index}`, image: line.image_url || '', title: `${line.name} ×${line.qty}`, price: money(cakeUnit(line) * line.qty),
        sub: [line.flavor, line.photo_box ? 'Foto qutusu' : '', ...Object.entries(line.fields || {}).map(([k, v]) => /gizli/i.test(k) ? '••••' : v)].filter(Boolean).join(' · '),
        onRemove: () => setCart(lines.filter((_, i) => i !== index)) }))}
      payload={() => ({ items: lines.map((line) => ({ cake_id: line.cake_id, qty: line.qty, flavor: line.flavor, photo_box: line.photo_box, fields: line.fields })) })} />}
  </div>;
}

function CakeSheet({ cake, onClose, onAdd }: { cake: ShopCake; onClose: () => void; onAdd: (line: CakeLine) => void }) {
  const labels = cake.has_custom_fields && Array.isArray(cake.custom_field_labels) ? cake.custom_field_labels : [];
  const [flavor, setFlavor] = useState(FLAVORS[0]);
  const [photoBox, setPhotoBox] = useState(false);
  const [qty, setQty] = useState(1);
  const [fields, setFields] = useState<Record<string, string>>({});
  const bento = isBento(cake), story = cakeStory(cake.description);
  const unit = Number(cake.price) + (photoBox ? PHOTO_BOX.extra : 0);
  return <Sheet title={cake.name} onClose={onClose}>
    <div className="shop-detail"><img src={(photoBox ? PHOTO_BOX.image : cake.image_url) || ''} alt={cake.name} />
      <div>
        <p className="shop-price">{money(Number(cake.price))}</p>
        <div className="shop-specs">{cakeSpecs(cake.description).map(([label, value]) => <span key={label}><b>{value}</b> {label}</span>)}</div>
        {story && <p className="shop-about shop-muted">{story}</p>}
        <span className="shop-label">Dad</span>
        <Chips items={FLAVORS.map((f) => [f, f])} value={flavor} onChange={setFlavor} label="Dad" />
        {labels.map((label, i) => <Field key={label} id={`shop-f-${i}`} label={label} value={fields[label] || ''} onChange={(value) => setFields({ ...fields, [label]: value })} type={/gizli/i.test(label) ? 'password' : 'text'} maxLength={60} autoComplete="off" />)}
        {bento && <button type="button" className={`shop-upsell${photoBox ? ' on' : ''}`} aria-pressed={photoBox} onClick={() => setPhotoBox(!photoBox)}>
          <img src={PHOTO_BOX.image} alt="" /><span className="shop-upsell-text"><b>Foto qutusuna çevir</b><span>Bento + 6 kapkeyk bir pəncərəli qutuda</span></span><b>+{money(PHOTO_BOX.extra)}</b></button>}
        <div className="shop-qty"><span className="shop-label">Say</span>
          <button type="button" className="shop-btn ghost" aria-label="Azalt" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b>
          <button type="button" className="shop-btn ghost" aria-label="Artır" onClick={() => setQty(Math.min(5, qty + 1))}>+</button></div>
        <button type="button" className="shop-btn wide" onClick={() => onAdd({ cake_id: cake.id, name: cake.name, price: cake.price, image_url: cake.image_url, flavor, photo_box: photoBox, qty, fields })}>Səbətə əlavə et · {money(unit * qty)}</button>
      </div></div>
  </Sheet>;
}

interface Row { key: string; image: string; title: string; sub: string; price?: string; onRemove: () => void }
function Checkout({ kind, ready, total, rows, payload, onClose }: { kind: ShopKind; ready: boolean; total: number; rows: Row[]; payload: () => Record<string, unknown>; onClose: () => void }) {
  const days = useMemo(shopDays, []);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '', mode: 'delivery', slot: '10:00–13:00', date: days[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });
  useEffect(() => { if (!rows.length) onClose(); }, [rows.length, onClose]);
  const pay = async () => {
    setError('');
    if (!ready) { setError(checkoutError('payments_unavailable')); return; }
    const problem = form.name.trim().length < 2 ? 'Adınızı yazın.' : !EMAIL.test(form.email.trim()) ? 'E-poçt ünvanını düzgün yazın.'
      : kind === 'cakes' && !PHONE.test(form.phone.trim()) ? 'Telefon nömrəsini yazın.' : kind === 'cakes' && form.mode === 'delivery' && form.address.trim().length < 5 ? 'Çatdırılma ünvanını yazın.' : '';
    if (problem) { setError(problem); return; }
    setBusy(true);
    const body: Record<string, unknown> = { kind, name: form.name, email: form.email, phone: form.phone, ...payload() };
    if (kind === 'cakes') Object.assign(body, { delivery_date: form.date, slot: form.slot, mode: form.mode, address: form.address, notes: form.notes });
    const result = await startShopCheckout(body);
    if (result.url) { window.location.href = result.url; return; }
    setBusy(false); setError(checkoutError(result.error, result.status));
  };
  return <Sheet title="Sifariş" onClose={onClose}>
    {rows.map((row) => <div key={row.key} className="shop-row">{row.image && <img src={row.image} alt="" />}<div className="t"><b>{row.title}</b><span>{row.sub}</span></div>{row.price && <b>{row.price}</b>}
      <button type="button" className="shop-x" aria-label="Sil" onClick={row.onRemove}><X size={18} /></button></div>)}
    {kind === 'cakes' && <div>
      <p className="shop-label shop-when">Nə vaxt?</p>
      <div className="shop-days">{days.map((value) => { const date = new Date(value + 'T12:00:00Z'); return <button key={value} type="button" className={`shop-day${form.date === value ? ' on' : ''}`} aria-pressed={form.date === value} onClick={() => set('date')(value)}><b>{date.getUTCDate()}</b>{WEEKDAYS[date.getUTCDay()]}</button>; })}</div>
      <div className="shop-slot"><Chips items={[['10:00–13:00', '10:00–13:00'], ['14:00–18:00', '14:00–18:00']]} value={form.slot} onChange={set('slot')} label="Saat" /></div>
      <div className="shop-slot"><Chips items={[['delivery', 'Çatdırılma'], ['pickup', 'Özüm götürəcəm']]} value={form.mode} onChange={set('mode')} label="Çatdırılma" /></div>
      {form.mode === 'delivery' && <Field id="shop-addr" label="Çatdırılma ünvanı" value={form.address} onChange={set('address')} autoComplete="street-address" maxLength={200} />}
    </div>}
    <Field id="shop-name" label="Adınız" value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} />
    <Field id="shop-email" label={kind === 'books' ? 'E-poçt (PDF linkləri bura gələcək)' : 'E-poçt'} value={form.email} onChange={set('email')} type="email" autoComplete="email" maxLength={254} />
    <Field id="shop-phone" label={kind === 'cakes' ? 'Telefon' : 'Telefon (istəyə bağlı)'} value={form.phone} onChange={set('phone')} type="tel" autoComplete="tel" maxLength={24} placeholder="+994 XX XXX XX XX" />
    {kind === 'cakes' && <Field id="shop-notes" label="Qeyd (allergiya, xüsusi istək)" value={form.notes} onChange={set('notes')} type="textarea" maxLength={500} />}
    <div className="shop-total"><span>Cəmi</span><span>{money(total)}</span></div>
    {error && <div className="shop-note bad" role="alert">{error}</div>}
    <button type="button" className="shop-btn wide" disabled={busy} onClick={pay}>{busy ? 'Ödəniş səhifəsi açılır…' : `Kartla ödə · ${money(total)}`}</button>
    <p className="shop-fine">{kind === 'books'
      ? 'Ödəniş Epoint vasitəsilə. PDF-lər yalnız şəxsi istifadə üçündür. Eyni e-poçtla Anacan hesabınız varsa, kitablar tətbiqdə "Kitablarım"da da görünəcək.'
      : 'Ödəniş Epoint vasitəsilə. Ödənişdən sonra qənnadı sifarişi təsdiqləyib sizə zəng edəcək. 48 saatdan əvvəl ləğv pulsuzdur.'}</p>
  </Sheet>;
}
