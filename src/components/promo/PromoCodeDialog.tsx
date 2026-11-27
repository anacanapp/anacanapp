import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';
import { usePromoText } from '@/data/promo';
import { fill } from '@/lib/feature-text';
import { clearPendingPromo, normalizePromoCode, promoDurationLabel, promoErrorText, redeemPromo } from '@/lib/promo';

/** Profile › Hədiyyə kodu: type a QR campaign code by hand (installed from the store without opening the link). */
export default function PromoCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const text = usePromoText(useUserStore((state) => state.language) || 'az');
  const client = useQueryClient();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!text) return null;

  const apply = async () => {
    const code = normalizePromoCode(value);
    if (!code) { setError(text.err_not_found); return; }
    setBusy(true); setError(null);
    const result = await redeemPromo(code);
    setBusy(false);
    if ('code' in result) { setError(promoErrorText(text, result.code)); return; }
    clearPendingPromo();
    toast.success(fill(text.success, { duration: promoDurationLabel(text, result.duration) }));
    void client.invalidateQueries({ predicate: (query) => ['premium-access-v1', 'subscription', 'household-premium'].includes(String(query.queryKey[0])) });
    setValue(''); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setError(null); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{text.profile_title}</DialogTitle>
          <DialogDescription>{text.profile_sub}</DialogDescription>
        </DialogHeader>
        <Input value={value} autoFocus autoCapitalize="characters" autoComplete="off" aria-label={text.profile_title}
          onChange={(e) => { setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void apply(); }}
          className="h-12 rounded-xl font-mono text-lg tracking-[0.1em]" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button onClick={apply} disabled={busy || !value} className="h-12 rounded-full font-bold">{busy ? text.loading : text.apply}</Button>
      </DialogContent>
    </Dialog>
  );
}
