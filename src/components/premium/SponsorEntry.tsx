import { useState } from 'react';
import { Users } from 'lucide-react';
import SponsorSheet from '@/components/premium/SponsorSheet';
import { useSponsorText } from '@/data/sponsor';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useUserStore } from '@/store/userStore';

/**
 * "Someone else pays?" entry under the paywall CTA. Native-only, behind the `premium_sponsor` flag.
 * Isolated from PaywallCore so the paywall renders without react-query when the feature is off.
 */
export default function SponsorEntry({ onSelf }: { onSelf: () => void }) {
  const language = useUserStore((s) => s.language);
  const t = useSponsorText(language);
  const setting = useAppSetting('premium_sponsor') as { enabled?: boolean } | undefined;
  const [open, setOpen] = useState(false);
  if (!setting?.enabled || !t) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 mx-auto mt-3"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
        <Users size={14} /> {t.entry}
      </button>
      <SponsorSheet open={open} onClose={() => setOpen(false)} onSelf={onSelf} />
    </>
  );
}
