import { motion, AnimatePresence } from 'framer-motion';
import { tr } from '@/lib/tr';
import { X, Minus, Plus, Trash2, ShoppingBag, Cake as CakeIcon } from 'lucide-react';
import { useCakeCart, cakeUnitPrice } from '@/hooks/useCakeCart';
import { money } from './cakeUi';
import './cakes.css';

interface CakeCartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

const CakeCartDrawer = ({ open, onClose, onCheckout }: CakeCartDrawerProps) => {
  const { items, removeItem, updateQuantity, totalPrice, totalItems } = useCakeCart();

  return (
    <AnimatePresence>
      {open &&
      <>
          <motion.div className="fixed inset-0 z-50" style={{ background: 'rgba(20,10,8,.5)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
          role="dialog" aria-modal="true" aria-label={tr('cakesscreen_cart', 'Səbət')}
          className="a-scope ck fixed bottom-0 start-0 end-0 z-50 flex flex-col"
          style={{ borderRadius: '26px 26px 0 0', maxHeight: '86vh', minHeight: 'auto', background: 'var(--a-bg)' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}><span style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--a-line-strong, var(--a-line))' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 12px' }}>
              <h2 className="ck-title" style={{ fontSize: 21 }}>{tr('cakesscreen_cart', 'Səbət')}{totalItems > 0 ? ` · ${totalItems}` : ''}</h2>
              <button type="button" className="ck-iconbtn" onClick={onClose} aria-label={tr('common_close', 'Bağla')}><X size={17} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.length === 0 ?
            <div className="ck-empty" style={{ margin: '8px 0 20px' }}>
                  <ShoppingBag size={34} style={{ margin: '0 auto 10px', color: 'var(--a-coral-text)' }} />
                  {tr('cakecartdrawer_sebet_bosdur_ff5b34', 'Səbət boşdur')}
                </div> :
            items.map((item, index) => {
              const details = Object.entries(item.customFields).filter(([, v]) => v).map(([k, v]) => /gizli|secret/i.test(k) ? `${k}: ••••` : v).join(' · ');
              return (
                <div key={index} className="ck-row" style={{ alignItems: 'flex-start' }}>
                      {item.cake.image_url ? <img src={item.cake.image_url} alt="" /> :
                  <span style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--a-coral-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CakeIcon size={22} /></span>}
                      <div className="ck-row-main">
                        <b>{item.cake.name}</b>
                        {details && <span>{details}</span>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                          <div className="ck-stepper" style={{ height: 36, borderRadius: 12 }}>
                            <button type="button" style={{ width: 30, height: 32 }} onClick={() => updateQuantity(index, item.quantity - 1)} aria-label="−"><Minus size={14} /></button>
                            <span style={{ fontSize: 14 }}>{item.quantity}</span>
                            <button type="button" style={{ width: 30, height: 32 }} onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="+"><Plus size={14} /></button>
                          </div>
                          <b style={{ fontSize: 15, color: 'var(--a-ink)' }}>{money(cakeUnitPrice(item) * item.quantity)}</b>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeItem(index)} aria-label={tr('common_delete', 'Sil')} style={{ border: 0, background: 'none', color: 'var(--a-ink-soft)', padding: 4, cursor: 'pointer' }}><Trash2 size={17} /></button>
                    </div>);
            })
            }
            </div>

            {items.length > 0 &&
          <div style={{ padding: '12px 18px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)', borderTop: '1px solid var(--a-line)', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--a-surface)' }}>
                <div className="ck-line" style={{ fontSize: 16 }}><span>{tr('cakecartdrawer_cemi_fbbec6', 'Cəmi:')}</span><b>{money(totalPrice)}</b></div>
                <button type="button" className="ck-cta" style={{ flex: 'none' }} onClick={onCheckout}>{tr('cakecartdrawer_checkout', 'Sifarişə keç')} · {money(totalPrice)}</button>
              </div>
          }
          </motion.div>
        </>
      }
    </AnimatePresence>);
};

export default CakeCartDrawer;
