import { motion, AnimatePresence } from 'framer-motion';
import { tr } from '@/lib/tr';
import { X, Minus, Plus, Trash2, ShoppingCart, Send, Cake as CakeIcon } from 'lucide-react';
import { useCakeCart } from '@/hooks/useCakeCart';

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
          <motion.div
          className="fixed inset-0 bg-black/50 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose} />
        
          <motion.div
          className="a-scope fixed bottom-0 start-0 end-0 z-50 rounded-t-[26px] max-h-[85vh] flex flex-col"
          style={{ background: 'var(--a-surface)' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
          
            {/* Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--a-line)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" style={{ color: 'var(--a-peach-2)' }} />
                <h3 className="a-heading" style={{ margin: 0, fontSize: 17, color: 'var(--a-ink)' }}>{tr("cakecartdrawer_sebet_7b0121", "S\u0259b\u0259t (")}{totalItems})</h3>
              </div>
              <button onClick={onClose} className="a-icon-btn" aria-label="Close">
                <X size={15} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ?
            <div className="text-center py-12">
                  <div className="text-5xl mb-3">🛒</div>
                  <p className="a-list-sub" style={{ margin: 0 }}>{tr("cakecartdrawer_sebet_bosdur_ff5b34", "Səbət boşdur")}</p>
                </div> :

            items.map((item, index) =>
            <div key={index} className="flex gap-3 rounded-2xl p-3" style={{ background: 'var(--a-surface-soft)' }}>
                    {item.cake.image_url ?
              <img src={item.cake.image_url} alt={item.cake.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" /> :

              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--a-peach-1)' }}>
                        <CakeIcon className="w-6 h-6" style={{ color: 'var(--a-accent-ink)' }} />
                      </div>
              }
                    <div className="flex-1 min-w-0">
                      <h4 className="a-list-title truncate" style={{ margin: 0 }}>{item.cake.name}</h4>
                      <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{item.cake.price}₼</p>
                      {Object.entries(item.customFields).length > 0 &&
                <div className="mt-1 space-y-0.5">
                          {Object.entries(item.customFields).map(([k, v]) =>
                  v && <p key={k} className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{k}: {v}</p>
                  )}
                        </div>
                }
                      <div className="flex items-center gap-2 mt-2">
                        <button
                    onClick={() => updateQuantity(index, item.quantity - 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', cursor: 'pointer', color: 'var(--a-ink)' }}>
                    
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center" style={{ color: 'var(--a-ink)' }}>{item.quantity}</span>
                        <button
                    onClick={() => updateQuantity(index, item.quantity + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--a-peach-1)', border: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)' }}>
                    
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                    onClick={() => removeItem(index)}
                    className="ms-auto p-1.5 rounded-lg"
                    style={{ background: 'var(--a-pink-1)', border: 'none', cursor: 'pointer' }}>
                    
                          <Trash2 className="w-4 h-4" style={{ color: 'var(--a-pink-ink)' }} />
                        </button>
                      </div>
                    </div>
                  </div>
            )
            }
            </div>

            {/* Footer */}
            {items.length > 0 &&
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--a-line)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: 'var(--a-ink-soft)' }}>{tr("cakecartdrawer_cemi_fbbec6", "Cəmi:")}</span>
                  <span className="a-heading" style={{ fontSize: 20, color: 'var(--a-accent-ink)' }}>{totalPrice.toFixed(2)}₼</span>
                </div>
                <button className="a-cta-btn w-full" style={{ justifyContent: 'center', height: 52, fontSize: 14 }} onClick={onCheckout}>
                  <Send size={16} strokeWidth={2.2} />
                  {tr("cakecartdrawer_sifaris_ver_f2be54", "Sifari\u015F ver")}
                </button>
              </div>
          }
          </motion.div>
        </>
      }
    </AnimatePresence>);

};

export default CakeCartDrawer;
