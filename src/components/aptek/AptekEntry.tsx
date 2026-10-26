import '@/styles/aptek.css';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAptekAvailable, useAptekCart, useAptekProducts, type AptekProduct } from '@/hooks/useAptek';
import { homeOfferContext, offerProducts, type OfferContext } from '@/lib/aptek-offers';
import { ap, formatAzn, type AptekKey } from '@/lib/aptek-i18n';
import { Mascot } from '@/components/anacan/Mascot';
import { OfferCard } from './AptekParts';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';

/** Opens an Aptek screen from places that have no navigation prop (tool screens). */
export const openAptekScreen = (screen: string) =>
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen } }));

const fold = (v: string) => v.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Top-bar cart shortcut; renders nothing when the store isn't available. */
export function AptekCartButton({ onOpen }: { onOpen: (screen: string) => void }) {
  const { available } = useAptekAvailable();
  const cart = useAptekCart();
  if (!available) return null;
  return (
    <button type="button" className="a3-icon-btn" onClick={() => onOpen('aptek/cart')} aria-label={ap('cart_n', { n: cart.count })}>
      <ShoppingBag size={19} />
      {cart.count > 0 && <span className="a3-count a3-num">{cart.count > 99 ? '99+' : cart.count}</span>}
    </button>
  );
}

/**
 * Home placement: a contextual offer for the baby's age / pregnancy, or the store banner
 * when the placement is switched off. Formula is never offered here.
 */
export function AptekHomeCard({ stage, babyMonths, babyName, context, onOpen }: {
  stage: 'bump' | 'mommy' | 'flow';
  babyMonths?: number | null;
  babyName?: string;
  /** Overrides the age-based context (e.g. 'bag' from the hospital bag). */
  context?: OfferContext;
  onOpen?: (screen: string) => void;
}) {
  const { available, config } = useAptekAvailable();
  const { data: products = [] } = useAptekProducts(available);
  const cart = useAptekCart();
  if (!available || !products.length || stage === 'flow') return null;
  const open = onOpen || openAptekScreen;

  const ctx = context || homeOfferContext(stage, babyMonths ?? null);
  const list = ctx && config?.placements.home !== false ? offerProducts(ctx, products, config, babyMonths ?? null) : [];
  const setQty = (id: string, n: number) => {
    const wasEmpty = cart.quantityOf(id) === 0;
    cart.setQuantity(id, n).catch(() => toast.error(ap('err_generic')));
    if (wasEmpty && n > 0) toast.success(ap('added'), { duration: 1500 });
  };

  if (ctx && list.length) {
    return (
      <OfferCard
        title={ap(`offer_${ctx}_t` as AptekKey)}
        why={ap(`offer_${ctx}_why` as AptekKey, { name: babyName || '', n: babyMonths ?? 0 })}
        products={list}
        qtyOf={cart.quantityOf}
        onQty={setQty}
        onOpenProduct={(p) => open(`aptek/p:${p.id}`)}
        onOpenStore={() => open('aptek')} />
    );
  }

  return (
    <section className="a3-sec">
      <button type="button" className="ap-banner" onClick={() => open('aptek')}>
        <span className="ap-banner-txt">
          <span className="a3-eyebrow">{ap('title')} · {ap('with_partner')}</span>
          <b>{ap('hero_title')}</b>
          <span className="a3-meta">{ap('hero_meta', { n: products.length, free: config?.free_shipping_min ?? 30 })}</span>
        </span>
        <Mascot stage={stage} pose="mode" width={88} />
        <ChevronRight size={18} className="rtl:rotate-180" />
      </button>
    </section>
  );
}

/** Product hits for the global search sheet. */
export function AptekSearchResults({ query, onOpen, close }: { query: string; onOpen: (screen: string) => void; close: () => void }) {
  const { available, config } = useAptekAvailable();
  const { data: products = [] } = useAptekProducts(available && !!query);
  if (!available || !query || config?.placements.search === false) return null;
  const hits: AptekProduct[] = products.filter((p) => fold(`${p.name} ${p.brand || ''}`).includes(query)).slice(0, 4);
  if (!hits.length) return null;
  return (
    <section className="a3-sec">
      <h3 className="a3-eyebrow">{ap('products_title')}</h3>
      <div className="a3-card" style={{ paddingBlock: 4 }}>
        <div className="a3-list">
          {hits.map((p) => (
            <button key={p.id} type="button" className="a3-li" onClick={() => { close(); onOpen(`aptek/p:${p.id}`); }}>
              <span className="ap-thumb sm">{p.images[0] && <img src={p.images[0]} alt="" />}</span>
              <span className="grow" style={{ textAlign: 'start', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="a3-meta a3-num">{formatAzn(p.price)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
