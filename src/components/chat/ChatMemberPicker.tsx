import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { searchPublicProfileCards, type PublicProfileCard } from '@/lib/public-profile-cards';
import { tr } from '@/lib/chat-i18n';

export default function ChatMemberPicker({ selected, onChange, excluded = [] }: {
  selected: PublicProfileCard[]; onChange: (people: PublicProfileCard[]) => void; excluded?: string[];
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState(''), [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['chat-member-search', getBackendConfig().url, user?.id, term], enabled: !!user && term.length >= 2,
    queryFn: () => searchPublicProfileCards(term.replace(/[%,_\\]/g, ''), 20), staleTime: 10000 });
  const people = (query.data || []).filter(person => person.user_id !== user?.id && !excluded.includes(person.user_id));
  return <div className="space-y-3">
    <label className="a-search"><Search size={16} /><input value={search} maxLength={80} onChange={event => setSearch(event.target.value)}
      placeholder={tr('chat_find_member', 'Ad ilə istifadəçi axtarın')} aria-label={tr('chat_find_member', 'Ad ilə istifadəçi axtarın')} /></label>
    {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(person => <button key={person.user_id} type="button" onClick={() => onChange(selected.filter(item => item.user_id !== person.user_id))}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs">{person.name}<X size={12} /></button>)}</div>}
    {query.isFetching && <Loader2 size={18} className="animate-spin mx-auto" />}
    {term.length < 2 && <p className="text-xs text-muted-foreground">{tr('chat_search_two_letters', 'Axtarış üçün ən azı 2 hərf yazın.')}</p>}
    <div className="max-h-72 overflow-y-auto">{people.map(person => {
      const checked = selected.some(item => item.user_id === person.user_id);
      return <button key={person.user_id} type="button" className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-start hover:bg-muted/50"
        onClick={() => onChange(checked ? selected.filter(item => item.user_id !== person.user_id) : [...selected, person].slice(0, 50))}>
        <Avatar className="h-9 w-9"><AvatarImage src={person.avatar_url || undefined} /><AvatarFallback>{person.name?.charAt(0)}</AvatarFallback></Avatar>
        <span className="flex-1 truncate text-sm font-semibold">{person.name}</span><span className={`grid h-5 w-5 place-items-center rounded-full border ${checked ? 'bg-primary border-primary text-white' : 'border-border'}`}>{checked && <Check size={13} />}</span>
      </button>;
    })}</div>
    {term.length >= 2 && !query.isFetching && people.length === 0 && <p className="text-xs text-muted-foreground">{tr('chat_no_members_found', 'İstifadəçi tapılmadı.')}</p>}
  </div>;
}
