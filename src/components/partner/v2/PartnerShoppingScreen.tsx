import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Plus } from 'lucide-react';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';

/**
 * Sinxron alışveriş siyahısı — tam ekran (köhnə dashboard tabından çıxarılıb).
 */

interface Props {
  onBack: () => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':return '#ff8aa4';
    case 'medium':return '#ffc94d';
    case 'low':return '#63bd8b';
    default:return 'var(--a-ink-faint)';
  }
};

const PartnerShoppingScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { toast } = useToast();
  const { items: shoppingItems, addItem, toggleItem } = useShoppingItems();
  const [newItem, setNewItem] = useState('');

  const shoppingList = shoppingItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    isChecked: item.is_checked,
    addedBy: (item.added_by || 'woman') as 'partner' | 'woman',
    priority: item.priority as 'low' | 'medium' | 'high'
  }));

  const toggleShoppingItem = async (id: string) => {
    await hapticFeedback.light();
    await toggleItem(id);
  };

  const addShoppingItem = async () => {
    if (newItem.trim()) {
      await addItem({ name: newItem, quantity: 1, priority: 'medium' });
      setNewItem('');
      toast({ title: tr('partnerdashboard_mehsul_elave_edildi_4c8d9f', 'Məhsul əlavə edildi! 🛒') });
    }
  };

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerdashboard_sinxronlasdirilmis_siyahi_08835b', 'Sinxronlaşdırılmış siyahı')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('partnerdashboard_alis_veris_siyahisi_a2d4a8', 'Alış-veriş Siyahısı')}</p>
            </div>
          </div>
        </header>

        {/* Add new item */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addShoppingItem()}
            placeholder={tr('partnerdashboard_yeni_mehsul_elave_et_3d6c73', 'Yeni məhsul əlavə et...')}
            className="flex-1 h-12 px-4 outline-none min-w-0"
            style={{ borderRadius: 999, background: 'var(--a-surface)', fontSize: 13, color: 'var(--a-ink)', boxShadow: 'var(--a-card-shadow)' }} />

          <motion.button
            onClick={addShoppingItem}
            disabled={!newItem.trim()}
            className="w-12 h-12 rounded-full text-white flex items-center justify-center disabled:opacity-50 shrink-0"
            style={{ background: 'var(--a-green-2)' }}
            whileTap={{ scale: 0.95 }}
            aria-label={tr('partnerdashboard_yeni_mehsul_elave_et_3d6c73', 'Yeni məhsul əlavə et...')}>
            <Plus size={20} />
          </motion.button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {shoppingList.map((item, idx) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="flex items-center gap-3"
            style={{
              padding: 14,
              borderRadius: 16,
              background: item.isChecked ? 'var(--a-green-1)' : 'var(--a-surface)',
              boxShadow: item.isChecked ? 'none' : 'var(--a-card-shadow)'
            }}>

              <motion.button
              onClick={() => toggleShoppingItem(item.id)}
              className="w-7 h-7 flex items-center justify-center shrink-0"
              style={{
                borderRadius: 10,
                background: item.isChecked ? 'var(--a-green-2)' : 'var(--a-surface-soft)',
                color: '#ffffff'
              }}
              whileTap={{ scale: 0.9 }}>
                {item.isChecked && <span className="text-sm">✓</span>}
              </motion.button>

              <div className="flex-1 min-w-0">
                <p className={item.isChecked ? 'line-through' : ''}
              style={{ fontSize: 13, fontWeight: 600, color: item.isChecked ? 'var(--a-ink-soft)' : 'var(--a-ink)' }}>
                  {item.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: getPriorityColor(item.priority) }} />
                  <span style={{ fontSize: 10, color: 'var(--a-ink-soft)' }}>
                    {item.addedBy === 'partner' ? tr('partnerdashboard_sen_elave_etdin_0008cb', 'Sən əlavə etdin') : tr('partnerdashboard_o_elave_etdi_9aa051', 'O əlavə etdi')}
                  </span>
                </div>
              </div>

              {item.quantity > 1 &&
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', background: 'var(--a-surface-soft)', borderRadius: 10, color: 'var(--a-ink)' }}>
                  x{item.quantity}
                </span>
            }
            </motion.div>
          )}

          {shoppingList.length === 0 &&
          <div className="a-card text-center" style={{ padding: '34px 18px' }}>
              <ShoppingCart size={40} className="mx-auto mb-3" style={{ color: 'var(--a-ink-faint)' }} />
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr('partnerdashboard_siyahi_bosdur_c420ab', 'Siyahı boşdur')}</p>
              <p style={{ fontSize: 12, color: 'var(--a-ink-faint)', marginTop: 2 }}>{tr('partnerdashboard_yuxaridaki_formadan_mehsul_elave_edin_32989e', 'Yuxarıdakı formadan məhsul əlavə edin')}</p>
            </div>
          }
        </div>
      </div>
    </div>);

};

export default PartnerShoppingScreen;
