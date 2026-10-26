import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Frown } from 'lucide-react';
import { useSubmitCancellationReason, CancellationReasonCode } from '@/hooks/useSubscriptionCancellation';
import { useAutoGrowTextarea } from '@/hooks/useAutoGrowTextarea';
import { analytics } from '@/lib/analytics';
import { tr } from '@/lib/tr';

interface CancellationReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Səbəb qeyd olunduqdan (və ya "Keç"dən) SONRA çağırılır — əsl
   *  platform-spesifik ləğv/yönləndirmə axını (Customer Center / Play Store) buradan davam edir. */
  onProceed: () => void;
  planType?: string | null;
  wasTrial?: boolean;
}

const REASONS: { code: CancellationReasonCode; labelKey: string; labelDefault: string }[] = [
  { code: 'too_expensive', labelKey: 'cancelreason_too_expensive', labelDefault: 'Qiymət mənim üçün baha oldu' },
  { code: 'not_using_enough', labelKey: 'cancelreason_not_using_enough', labelDefault: 'Kifayət qədər istifadə etmirəm' },
  { code: 'missing_features', labelKey: 'cancelreason_missing_features', labelDefault: 'İstədiyim funksiyaları tapmadım' },
  { code: 'technical_issues', labelKey: 'cancelreason_technical_issues', labelDefault: 'Texniki problemlər yaşadım' },
  { code: 'found_alternative', labelKey: 'cancelreason_found_alternative', labelDefault: 'Başqa bir tətbiq/alternativ tapdım' },
  { code: 'temporary_break', labelKey: 'cancelreason_temporary_break', labelDefault: 'Müvəqqəti fasilə vermək istəyirəm' },
  { code: 'other', labelKey: 'cancelreason_other', labelDefault: 'Digər səbəb' },
];

/**
 * Premium/free trial ləğv etməzdən ƏVVƏL göstərilən "niyə gedirsiniz?" popup-u.
 * Səbəb `subscription_cancellations` cədvəlinə (admin panelində tam görünən)
 * yazılır, sonra əsl platform-ləğv axını (`onProceed`) davam edir — istəsə
 * "Keç" ilə heç bir səbəb yazmadan da davam edə bilər.
 */
export const CancellationReasonDialog = ({ isOpen, onClose, onProceed, planType, wasTrial }: CancellationReasonDialogProps) => {
  const [selected, setSelected] = useState<CancellationReasonCode | null>(null);
  const [otherText, setOtherText] = useState('');
  const { ref: otherTextRef } = useAutoGrowTextarea(otherText, 100);
  const submitReason = useSubmitCancellationReason();

  const reset = () => {
    setSelected(null);
    setOtherText('');
  };

  const handleSkip = () => {
    reset();
    onClose();
    onProceed();
  };

  const handleSubmit = async () => {
    if (!selected) return;
    try {
      await submitReason.mutateAsync({
        reasonCode: selected,
        reasonText: selected === 'other' ? otherText : null,
        planType,
        wasTrial,
      });
      analytics.logPremiumCancelled();
    } catch (e) {
      console.error('Cancellation reason submit error:', e);
      // Səbəbin qeydə alınması uğursuz olsa belə, istifadəçini ləğv axınından
      // MƏHRUM ETMİRİK — bu YALNIZ daxili feedback, ləğv prosesini bloklamamalıdır.
    }
    reset();
    onClose();
    onProceed();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md max-w-[92vw] rounded-2xl" style={{ background: 'var(--a-surface)' }}>
        <DialogHeader>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-1" style={{ background: 'var(--a-yellow-1)' }}>
            <Frown className="w-5 h-5" style={{ color: 'var(--a-warn-ink)' }} />
          </div>
          <DialogTitle style={{ color: 'var(--a-ink)' }}>
            {tr('cancelreason_title', 'Getməzdən əvvəl bir sualımız var')}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--a-ink-soft)' }}>
            {tr('cancelreason_subtitle', 'Ayrıldığınız üçün üzgünük. Səbəbini bilmək Anacan-ı sizin üçün daha yaxşı etməyə kömək edir.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-1">
          {REASONS.map((r) => {
            const isActive = selected === r.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => setSelected(r.code)}
                className="w-full flex items-center gap-3 text-start transition-colors"
                style={{
                  padding: '11px 14px',
                  borderRadius: 14,
                  border: isActive ? '1.5px solid var(--a-peach-2)' : '1.5px solid var(--a-line)',
                  background: isActive ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    flexShrink: 0,
                    border: isActive ? '5px solid var(--a-peach-2)' : '1.5px solid var(--a-ink-faint)',
                    background: 'transparent',
                    transition: 'border-width 0.15s',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>
                  {tr(r.labelKey, r.labelDefault)}
                </span>
              </button>
            );
          })}

          {selected === 'other' && (
            <textarea
              ref={otherTextRef}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={tr('cancelreason_other_placeholder', 'İstəsəniz, ətraflı yaza bilərsiniz...')}
              rows={1}
              className="w-full text-[13px] resize-none focus:outline-none"
              style={{
                marginTop: 2,
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid var(--a-line-strong)',
                background: 'var(--a-surface)',
                color: 'var(--a-ink)',
                lineHeight: 1.4,
                overflowY: 'hidden',
              }}
              autoFocus
            />
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 h-11 rounded-full font-bold text-sm"
            style={{ color: 'var(--a-ink-soft)' }}
          >
            {tr('cancelreason_skip', 'Keç')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selected || submitReason.isPending}
            className="flex-1 h-11 rounded-full font-bold text-sm text-white border-0"
            style={{
              background: 'var(--a-peach-2)',
              opacity: !selected || submitReason.isPending ? 0.5 : 1,
            }}
          >
            {submitReason.isPending ? (
              <Loader2 className="w-4 h-4 mx-auto animate-spin" />
            ) : (
              tr('cancelreason_continue', 'Göndər və davam et')
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancellationReasonDialog;
