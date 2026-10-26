import '@/styles/aptek.css';
import { Minus, Plus, ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { ap, formatAzn, type AptekKey } from '@/lib/aptek-i18n';
import type { AptekProduct } from '@/hooks/useAptek';
import type { AptekBundle } from '@/lib/aptek-pricing';

export const discountPct = (p: Pick<AptekProduct, 'price' | 'original_price'>) =>
  p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0;

export const ageLabel = (months: number | null) => (months == null ? ap('age_any') : ap('age_from', { n: months }));

export function QtyStepper({ value, onChange, small }: { value: number; onChange: (n: number) => void; small?: boolean }) {
  const step = (d: number) => { void hapticFeedback.light(); onChange(Math.max(0, Math.min(20, value + d))); };
  return (
    <span className={`ap-qty${small ? ' sm' : ''}`}>
      <button type="button" onClick={() => step(-1)} aria-label={ap('qty_minus')}><Minus size={small ? 15 : 18} /></button>
      <span className="a3-num" aria-live="polite">{value}</span>
      <button type="button" onClick={() => step(1)} disabled={value >= 20} aria-label={ap('qty_plus')}><Plus size={small ? 15 : 18} /></button>
    </span>
  );
}

export function ProductCard({ product, qty, onOpen, onQty, variant }: {
  product: AptekProduct;
  qty: number;
  onOpen: () => void;
  onQty: (n: number) => void;
  variant?: 'rail' | 'small';
}) {
  const off = discountPct(product);
  return (
    <article className={`ap-card${variant === 'rail' ? ' rail' : variant === 'small' ? ' rail small' : ''}`}>
      <button type="button" className="ap-img" onClick={onOpen} aria-label={product.name}>
        {product.images[0] && <img src={product.images[0]} alt="" loading="lazy" decoding="async" />}
        {off > 0 && <span className="ap-off a3-num">−{off}%</span>}
      </button>
      <div className="ap-body">
        <button type="button" className="ap-name" onClick={onOpen} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}>{product.name}</button>
        <span className="a3-meta">{ageLabel(product.min_age_months)}</span>
        <div className="ap-foot">
          <span className="ap-price a3-num">
            <b>{formatAzn(product.price)}</b>
            {off > 0 && product.original_price && <s>{formatAzn(product.original_price)}</s>}
          </span>
          {qty > 0
            ? <QtyStepper small value={qty} onChange={onQty} />
            : <button type="button" className="ap-add" onClick={() => { void hapticFeedback.light(); onQty(1); }} aria-label={`${ap('add_to_cart')}: ${product.name}`}><Plus size={18} /></button>}
        </div>
      </div>
    </article>
  );
}

export function BundleCard({ bundle, products, pct, inCart, onAddAll, onOpenProduct, wide }: {
  bundle: AptekBundle;
  products: AptekProduct[];
  pct: number;
  inCart: (productId: string) => boolean;
  onAddAll: () => void;
  onOpenProduct: (p: AptekProduct) => void;
  wide?: boolean;
}) {
  const items = bundle.skus.map((sku) => products.find((p) => p.sku === sku)).filter((p): p is AptekProduct => !!p);
  if (items.length !== bundle.skus.length) return null; // a set with a missing product can't be completed
  const sum = items.reduce((s, p) => s + p.price, 0);
  const done = items.every((p) => inCart(p.id));
  const title = ap(`bundle_${bundle.id}_t` as AptekKey);
  return (
    <article className={`ap-bundle${wide ? ' wide' : ''}`}>
      <div className={`ap-bthumbs ${bundle.tone || 'c-peach'}`}>
        {items.map((p, i) => (
          <span key={p.id} style={{ display: 'contents' }}>
            {i > 0 && <span className="ap-bplus" aria-hidden="true"><Plus size={12} /></span>}
            <button type="button" className="ap-thumb" onClick={() => onOpenProduct(p)} aria-label={p.name}>
              {p.images[0] && <img src={p.images[0]} alt="" loading="lazy" />}
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="a3-chip ac" style={{ alignSelf: 'flex-start' }}>{ap('bundle_save', { pct })}</span>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title.startsWith('bundle_') ? bundle.id : title}</p>
        <p className="a3-meta" style={{ margin: 0 }}>{ap(`bundle_${bundle.id}_d` as AptekKey)}</p>
        <p className="ap-bprice a3-num"><b>{formatAzn(Math.round(sum * (100 - pct)) / 100)}</b><s>{formatAzn(sum)}</s></p>
      </div>
      <button type="button" className={`a3-btn ${done ? 'soft' : 'accent'} block sm`} onClick={onAddAll} disabled={done}>
        {done ? <><Check size={16} />{ap('bundle_done')}</> : <><ShoppingBag size={16} />{ap('bundle_add')}</>}
      </button>
    </article>
  );
}

/** Contextual product suggestion card used outside the store (home, tools). */
export function OfferCard({ title, why, products, qtyOf, onQty, onOpenProduct, onOpenStore }: {
  title: string;
  why: string;
  products: AptekProduct[];
  qtyOf: (id: string) => number;
  onQty: (id: string, n: number) => void;
  onOpenProduct: (p: AptekProduct) => void;
  onOpenStore: () => void;
}) {
  if (!products.length) return null;
  return (
    <section className="a3-sec">
      <div className="ap-offer">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span className="a3-ico-sq sm c-green"><ShoppingBag size={16} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="a3-eyebrow" style={{ margin: 0 }}>{ap('title')}</p>
            <p style={{ margin: '2px 0 0', fontWeight: 700 }}>{title}</p>
            <p className="a3-meta" style={{ margin: '2px 0 0' }}>{why}</p>
          </div>
        </div>
        <div className="a3-rail">
          {products.map((p) => (
            <ProductCard key={p.id} variant="small" product={p} qty={qtyOf(p.id)} onOpen={() => onOpenProduct(p)} onQty={(n) => onQty(p.id, n)} />
          ))}
        </div>
        <button type="button" className="a3-link" onClick={onOpenStore} style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
          {ap('see_store')} <ChevronRight size={14} className="rtl:rotate-180" />
        </button>
      </div>
    </section>
  );
}
