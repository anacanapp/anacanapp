import { useState } from 'react';
import { X } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Child } from '@/hooks/useChildren';

/**
 * Mövcud mommy istifadəçiləri üçün birdəfəlik yumşaq sorğu:
 * körpənin due_date-i (EDD) yoxdursa, vaxtında/vaxtından əvvəl doğulduğunu
 * soruşur. Cavabdan EDD bərpa olunur:
 *   vaxtında  → due_date = birth_date (korreksiya 0)
 *   erkən (N həftəlik) → due_date = birth_date + (280 − N×7) gün
 * "X" ilə bağlananda localStorage-də child-a görə yadda saxlanılır.
 */
const dismissKey = (childId: string) => `preemie-backfill-dismissed-${childId}`;

const PrematurityBackfillCard = ({ child, onSaved }: {child: Child;onSaved: () => void;}) => {
  const [dismissed, setDismissed] = useState(() => {
    try {return localStorage.getItem(dismissKey(child.id)) === '1';} catch {return false;}
  });
  const [mode, setMode] = useState<'ask' | 'weeks'>('ask');
  const [gestWeeks, setGestWeeks] = useState(34);
  const [saving, setSaving] = useState(false);

  if (dismissed || child.due_date) return null;

  const dismiss = () => {
    try {localStorage.setItem(dismissKey(child.id), '1');} catch {/* noop */}
    setDismissed(true);
  };

  const save = async (dueDate: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.
      from('user_children').
      update({ due_date: dueDate }).
      eq('id', child.id);
      if (error) throw error;
      toast.success(tr('preemie_backfill_saved', 'Yadda saxlanıldı'));
      setDismissed(true);
      onSaved();
    } catch (e: any) {
      toast.error(tr('preemie_backfill_error', 'Xəta: ') + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  const saveTerm = () => save(child.birth_date);
  const savePreterm = () => {
    const d = new Date(child.birth_date);
    d.setDate(d.getDate() + (280 - gestWeeks * 7));
    save(d.toISOString().split('T')[0]);
  };

  return (
    <section className="a-section">
      <div className="a-card a-fade-in" style={{ padding: 14, position: 'relative' }}>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tr('common_close', 'Bağla')}
          style={{ position: 'absolute', top: 10, insetInlineEnd: 10, color: 'var(--a-ink-soft)' }}>
          <X size={16} />
        </button>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-ink)', paddingInlineEnd: 24 }}>
          {tr('preemie_backfill_q', '{name} vaxtında doğulub?').replace('{name}', child.name)}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 2 }}>
          {tr('preemie_backfill_sub', 'Vaxtından əvvəl doğulan körpələr üçün inkişaf və böyümə korreksiya olunmuş yaşla izlənir.')}
        </p>

        {mode === 'ask' &&
        <div className="flex gap-2 mt-3">
            <button
            type="button"
            disabled={saving}
            onClick={saveTerm}
            className="flex-1"
            style={{ padding: '10px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12.5, background: 'var(--a-surface)', border: '1.5px solid var(--a-peach-2)', color: 'var(--a-ink)' }}>
              {tr('preemie_backfill_term', 'Bəli, vaxtında (37+ həftə)')}
            </button>
            <button
            type="button"
            disabled={saving}
            onClick={() => setMode('weeks')}
            className="flex-1"
            style={{ padding: '10px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12.5, background: 'var(--a-peach-1)', border: '1.5px solid var(--a-peach-2)', color: 'var(--a-accent-ink)' }}>
              {tr('preemie_backfill_preterm', 'Vaxtından əvvəl')}
            </button>
          </div>
        }

        {mode === 'weeks' &&
        <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
              type="button"
              onClick={() => setGestWeeks(Math.max(22, gestWeeks - 1))}
              style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--a-surface)', fontWeight: 800, border: '1px solid var(--a-peach-2)' }}>
                -
              </button>
              <div className="flex-1 h-10 flex items-center justify-center" style={{ borderRadius: 12, background: 'var(--a-surface)' }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{gestWeeks}</span>
                <span className="ms-1.5" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
                  {tr('preemie_backfill_weeks', 'həftəlik doğulub')}
                </span>
              </div>
              <button
              type="button"
              onClick={() => setGestWeeks(Math.min(36, gestWeeks + 1))}
              style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--a-surface)', fontWeight: 800, border: '1px solid var(--a-peach-2)' }}>
                +
              </button>
            </div>
            <button
            type="button"
            disabled={saving}
            onClick={savePreterm}
            className="w-full"
            style={{ padding: '11px 8px', borderRadius: 12, fontWeight: 800, fontSize: 13, background: 'var(--a-peach-2)', color: '#fff' }}>
              {saving ? tr('common_saving', 'Saxlanılır…') : tr('preemie_backfill_save', 'Yadda saxla')}
            </button>
          </div>
        }
      </div>
    </section>);

};

export default PrematurityBackfillCard;
