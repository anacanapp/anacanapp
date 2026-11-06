import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SearchInput } from './Toolbar';

export interface PickedUser { user_id: string; name: string | null; email: string | null }

/**
 * Server-side user lookup (name/email ilike, 20 results) instead of loading every profile into a <Select>.
 */
export function UserPicker({ value, onChange, placeholder = 'Ad və ya email yazın…' }: { value: string; onChange: (user: PickedUser) => void; placeholder?: string }) {
  const [query, setQuery] = useState(''), [results, setResults] = useState<PickedUser[]>([]), [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = query.trim().replace(/[,()*%\\]/g, ' ');
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from('profiles').select('user_id, name, email').or(`name.ilike.*${term}*,email.ilike.*${term}*`).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (!cancelled) { setResults((data ?? []) as PickedUser[]); setLoading(false); } }, () => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);
  return (
    <div className="grid gap-2">
      <SearchInput value={query} onChange={setQuery} placeholder={placeholder} label="İstifadəçi axtar" delay={250} />
      {loading && <span className="ak-hint inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Axtarılır…</span>}
      {!loading && query.trim().length >= 2 && !results.length && <span className="ak-hint">Tapılmadı.</span>}
      {results.length > 0 && (
        <ul className="grid max-h-60 overflow-y-auto rounded-lg border" role="listbox" aria-label="Nəticələr">
          {results.map(user => (
            <li key={user.user_id}>
              <button type="button" role="option" aria-selected={user.user_id === value} onClick={() => onChange(user)}
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted', user.user_id === value && 'bg-primary/10')}>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{user.name || '—'}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
                {user.user_id === value && <Check size={14} className="text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
