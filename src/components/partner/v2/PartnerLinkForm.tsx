import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { feature37Text } from '@/lib/feature37-i18n';
import { getPartnerLinkErrorMessage } from '@/lib/partner-link';

/** In-app pairing for a partner account that is not linked (or was unlinked). */
export default function PartnerLinkForm({ onLinked }: { onLinked?: () => void }) {
  const { linkPartner } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    const { error: linkError } = await linkPartner(code);
    setBusy(false);
    if (linkError) {
      setError(getPartnerLinkErrorMessage(linkError));
      return;
    }
    toast({ title: feature37Text('partner_linked_ok') });
    onLinked?.();
  };

  return (
    <form onSubmit={submit} className="a-card w-full max-w-sm text-start" style={{ padding: 18 }}>
      <label htmlFor="partner-link-code" style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--a-ink)', marginBottom: 4 }}>
        {feature37Text('partner_link_title')}
      </label>
      <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', margin: '0 0 10px' }}>{feature37Text('partner_link_hint')}</p>
      <input
        id="partner-link-code"
        className="a-input"
        value={code}
        onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
        placeholder="ANACAN-XXXXXX"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={32}
        aria-invalid={!!error}
        style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.06em' }}
      />
      {error && <p role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-coral-strong, #d93a40)', margin: '8px 0 0' }}>{error}</p>}
      <button type="submit" className="a-btn-solid" disabled={busy || !code.trim()}
        style={{ width: '100%', marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy || !code.trim() ? 0.6 : 1 }}>
        <Link2 size={17} />
        {feature37Text('partner_link_submit')}
      </button>
    </form>
  );
}
