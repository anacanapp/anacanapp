import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Check, ShoppingCart,
  AlertCircle, Users, User, ChevronDown, ChevronUp, Clock, Sparkles } from
'lucide-react';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useDefaultShoppingItems } from '@/hooks/useDefaultShoppingItems';
import { useToast } from '@/hooks/use-toast';
import { formatRelativeDateAz } from '@/lib/date-utils';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

interface ShoppingListProps {
  onBack: () => void;
}

// Priority → anacan palette
const priorityStyles: Record<string, {bg: string;ink: string;}> = {
  low: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  medium: { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  high: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const priorityLabels = {
  low: tr("shoppinglist_asagi_1c27f1", "A\u015Fa\u011F\u0131"),
  medium: tr("shoppinglist_priority_orta", 'Orta'),
  high: tr("shoppinglist_yuksek_492584", "Y\xFCks\u0259k")
};

const ShoppingList = ({ onBack }: ShoppingListProps) => {
  useScrollToTop();
  const isRtl = useIsRtl();
  useScreenAnalytics('ShoppingList', 'Tools');

  const { profile } = useAuth();
  const { items, loading, addItem, toggleItem, deleteItem, uncheckedCount, checkedCount } = useShoppingItems();
  const { items: defaultItems } = useDefaultShoppingItems();
  const { toast } = useToast();

  const [newItemName, setNewItemName] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const hasPartner = !!profile?.linked_partner_id;
  const isShared = hasPartner;

  // Filter out already added items from recommendations
  const existingItemNames = items.map((i) => i.name.toLowerCase());
  const filteredRecommendations = defaultItems.filter(
    (d) => !existingItemNames.includes(d.name.toLowerCase())
  );

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    setSubmitting(true);
    const result = await addItem({
      name: newItemName.trim(),
      priority: newItemPriority
    });
    setSubmitting(false);

    if (result.error) {
      toast({
        title: tr("shoppinglist_xeta_3cdbb6", 'Xəta'),
        description: tr("shoppinglist_mehsul_elave_edile_bilmedi_47a41c", 'Məhsul əlavə edilə bilmədi'),
        variant: 'destructive'
      });
    } else {
      setNewItemName('');
      toast({ title: tr("shoppinglist_mehsul_elave_edildi_db41ff", 'Məhsul əlavə edildi!') });
    }
  };

  const uncheckedItems = items.filter((item) => !item.is_checked);
  const checkedItems = items.filter((item) => item.is_checked);

  if (loading) {
    return <ToolLoading />;
  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {isShared ? <Users size={10} /> : <User size={10} />}
            {isShared ? tr("shoppinglist_partnyor_ile_ortaq_bbdb50", "Partnyor ilə ortaq") : tr("shoppinglist_sexsi_siyahi_93858e", "Şəxsi siyahı")}
          </span>
        }
        title={isShared ? tr("shoppinglist_ortaq_alisveris_828573", "Ortaq Al\u0131\u015Fveri\u015F") : tr("shoppinglist_alisveris_siyahisi_5fe638", "Al\u0131\u015Fveri\u015F Siyah\u0131s\u0131")}
        actions={
        <span className="a-icon-btn" style={{ cursor: 'default' }}>
            <ShoppingCart size={16} strokeWidth={2} />
          </span>
        } />

      {/* Stats */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 rounded-2xl p-3 flex items-center gap-2" style={{ background: 'var(--a-peach-1)' }}>
          <div className="a-heading" style={{ fontSize: 22, color: 'var(--a-accent-ink)' }}>{uncheckedCount}</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--a-accent-ink)', opacity: 0.8 }}>{tr("shoppinglist_alinacaq_c49c64", "alınacaq")}</div>
        </div>
        <div className="flex-1 rounded-2xl p-3 flex items-center gap-2" style={{ background: 'var(--a-green-1)' }}>
          <div className="a-heading" style={{ fontSize: 22, color: 'var(--a-green-ink)' }}>{checkedCount}</div>
          <div className="text-xs font-semibold" style={{ color: 'var(--a-green-ink)', opacity: 0.8 }}>{tr("shoppinglist_alindi_63cabc", "alındı")}</div>
        </div>
      </div>

      {/* Add item form */}
      <div className="a-card mb-3" style={{ padding: 14 }}>
        <div className="flex gap-2 mb-2">
          <input
            className="a-input flex-1"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={tr("shoppinglist_mehsul_adi_a5d2df", "Məhsul adı...")}
            onKeyPress={(e) => e.key === 'Enter' && handleAddItem()} />
          
          <button
            onClick={handleAddItem}
            disabled={submitting || !newItemName.trim()}
            className="a-cta-btn shrink-0"
            style={{ width: 42, height: 42, padding: 0, justifyContent: 'center', opacity: submitting || !newItemName.trim() ? 0.5 : 1 }}>
            
            <Plus size={16} strokeWidth={2.4} />
          </button>
        </div>
        
        {/* Priority selector */}
        <div className="flex gap-1.5">
          {(['low', 'medium', 'high'] as const).map((priority) =>
          <button
            key={priority}
            onClick={() => setNewItemPriority(priority)}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold transition-all"
            style={newItemPriority === priority ?
            { background: priorityStyles[priority].bg, color: priorityStyles[priority].ink, border: '1px solid transparent', cursor: 'pointer' } :
            { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: '1px solid transparent', cursor: 'pointer' }}>
            
              {priorityLabels[priority]}
            </button>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {filteredRecommendations.length > 0 &&
      <div className="mb-3">
          <button
          onClick={() => setShowRecommendations(!showRecommendations)}
          className="flex items-center gap-2 w-full mb-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)' }}>
          
            <Sparkles className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
            <span className="text-sm font-bold">{tr("shoppinglist_platformanin_tovsiyeleri_2e687e", "Platforman\u0131n t\xF6vsiy\u0259l\u0259ri (")}{filteredRecommendations.length})</span>
            {showRecommendations ? <ChevronUp className="w-4 h-4 ms-auto" /> : <ChevronDown className="w-4 h-4 ms-auto" />}
          </button>

          <AnimatePresence>
            {showRecommendations &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            
                <div className="flex flex-wrap gap-1.5">
                  {filteredRecommendations.slice(0, 8).map((item) =>
              <motion.button
                key={item.id}
                onClick={async () => {
                  const result = await addItem({
                    name: item.name,
                    priority: item.priority
                  });
                  if (!result.error) {
                    toast({ title: `${item.name} ${tr("shopping_item_added", "əlavə edildi!")}` });
                  }
                }}
                className="a-tag"
                whileTap={{ scale: 0.95 }}>
                
                      <Plus className="w-3 h-3" />
                      {item.name}
                    </motion.button>
              )}
                </div>
              </motion.div>
          }
          </AnimatePresence>
        </div>
      }

      {/* Unchecked items */}
      <div className="space-y-1.5 mb-3">
        <AnimatePresence>
          {uncheckedItems.map((item) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: rtlX(-100, isRtl) }}
            className="a-card flex items-center gap-3"
            style={{ padding: '12px 14px' }}>
            
              <button
              onClick={() => toggleItem(item.id)}
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ border: '2px solid var(--a-peach-2)', background: 'none', cursor: 'pointer' }}>
              
              </button>
              <div className="flex-1 min-w-0">
                <p className="a-list-title truncate" style={{ margin: 0 }}>{item.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span
                  className="text-[9px] px-1.5 py-0 rounded-full font-bold"
                  style={{ background: priorityStyles[item.priority].bg, color: priorityStyles[item.priority].ink }}>
                    {priorityLabels[item.priority]}
                  </span>
                  <span className="text-[9px] flex items-center gap-0.5" style={{ color: 'var(--a-ink-faint)' }}>
                    <Clock className="w-2.5 h-2.5" />
                    {formatRelativeDateAz(item.created_at)}
                  </span>
                </div>
              </div>
              <button
              onClick={() => deleteItem(item.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--a-pink-1)', border: 'none', cursor: 'pointer' }}>
              
                <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--a-pink-ink)' }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {uncheckedItems.length === 0 &&
        <div className="a-card text-center" style={{ padding: '26px 18px' }}>
            <div className="text-3xl mb-1">🛒</div>
            <p className="a-list-sub" style={{ margin: 0 }}>{tr("shoppinglist_siyahi_bosdur_c420ab", "Siyahı boşdur")}</p>
          </div>
        }
      </div>

      {/* Completed items toggle */}
      {checkedItems.length > 0 &&
      <div className="mb-4">
          <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 w-full"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-on-bg-soft)' }}>
          
            {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="text-sm font-semibold">{tr("shoppinglist_alinmis_mehsullar_957a1f", "Al\u0131nm\u0131\u015F m\u0259hsullar (")}{checkedCount})</span>
          </button>

          <AnimatePresence>
            {showCompleted &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            
                <div className="space-y-2 mt-3">
                  {checkedItems.map((item) =>
              <div
                key={item.id}
                className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background: 'var(--a-surface-soft)', opacity: 0.7 }}>
                
                      <button
                  onClick={() => toggleItem(item.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--a-green-2)', border: 'none', cursor: 'pointer' }}>
                  
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <p className="flex-1 font-semibold line-through" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{item.name}</p>
                      <button
                  onClick={() => deleteItem(item.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--a-pink-1)', border: 'none', cursor: 'pointer' }}>
                  
                        <Trash2 className="w-4 h-4" style={{ color: 'var(--a-pink-ink)' }} />
                      </button>
                    </div>
              )}
                </div>
              </motion.div>
          }
          </AnimatePresence>
        </div>
      }

      {/* Partner info */}
      {isShared &&
      <div className="a-card flex items-start gap-3" style={{ background: 'var(--a-blue-1)', border: 'none' }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--a-blue-ink)' }} />
          <div>
            <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>{tr("shoppinglist_ortaq_siyahi_e10fff", "Ortaq siyahı")}</p>
            <p className="text-xs" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>
              {tr("shoppinglist_bu_siyahiya_elave_etdiyiniz_me_0ba1c1", "Bu siyah\u0131ya \u0259lav\u0259 etdiyiniz m\u0259hsullar partnyorunuz t\u0259r\u0259find\u0259n d\u0259 g\xF6r\xFCn\xFCr v\u0259 real vaxtda sinxronla\u015F\u0131r.")}
            </p>
          </div>
        </div>
      }
    </ToolPage>);

};

export default ShoppingList;
