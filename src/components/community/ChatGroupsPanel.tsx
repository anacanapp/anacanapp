import { useRef, useState } from 'react';
import { ChevronRight, Globe, Loader2, LockKeyhole, Plus, Users } from 'lucide-react';
import { useChatGroups } from '@/hooks/useChatGroups';
import { useToast } from '@/hooks/use-toast';
import { chatError } from '@/lib/chat';
import type { PublicProfileCard } from '@/lib/public-profile-cards';
import { tr } from '@/lib/group-i18n';
import ChatMemberPicker from '@/components/chat/ChatMemberPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ChatGroupsPanel({ onOpen, search = '' }: { onOpen: (id: string) => void; search?: string }) {
  const [scope, setScope] = useState<'all' | 'mine' | 'public' | 'private'>('all');
  const state = useChatGroups(undefined, scope, search), { toast } = useToast();
  const [creating, setCreating] = useState(false), [name, setName] = useState(''), [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private'), [people, setPeople] = useState<PublicProfileCard[]>([]);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const submit = async () => {
    if (!name.trim() || state.creating) return;
    const fingerprint = JSON.stringify([name.trim(), description.trim(), visibility, people.map(person => person.user_id).sort()]);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const id = await state.create({ id: attempt.current.id, name: name.trim(), description: description.trim(), visibility, people: people.map(person => person.user_id) });
      setCreating(false); setName(''); setDescription(''); setPeople([]); attempt.current = null; onOpen(id);
    } catch (error) { toast({ title: chatError(error), variant: 'destructive' }); }
  };
  return <div className="space-y-4 py-3">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{tr('chat_groups', 'Qruplar')}</h2><p className="text-xs text-muted-foreground">{tr('group_public')} · {tr('group_private')}</p></div>
      <button type="button" onClick={() => setCreating(true)} className="a-btn-solid gap-1.5"><Plus size={17} />{tr('chat_create_group', 'Yeni qrup yarat')}</button></div>
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {([['all',tr('common_all','Hamısı')],['mine',tr('chat_my_groups','Qruplarım')],['public',tr('group_public')],['private',tr('group_private')]] as const).map(([value,label]) =>
        <button type="button" key={value} role="tab" aria-selected={scope===value} onClick={() => setScope(value)} className={`rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap ${scope===value?'bg-primary text-primary-foreground':'bg-muted/50 text-muted-foreground'}`}>{label}</button>)}
    </div>
    {state.loading ? <div className="chat-empty"><Loader2 className="animate-spin" /></div> : state.error ? <div className="chat-empty" role="alert"><p>{chatError(state.error)}</p><button onClick={() => state.refetch()}>{tr('chat_retry','Yenidən cəhd et')}</button></div> :
      !state.groups.length ? <div className="chat-empty"><Users size={32}/><p>{tr('chat_no_groups','Hələ qrup yoxdur. İlk yazışma qrupunuzu yaradın.')}</p></div> :
      <div className="space-y-2">{state.groups.map(group => <button type="button" key={group.id} onClick={() => onOpen(group.id)} className="a-card w-full flex items-center gap-3 p-4 text-start">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl">{group.icon_emoji || '💬'}</span>
        <span className="flex-1 min-w-0"><strong className="block truncate text-sm">{group.name}</strong>
          <span className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">{group.chat_visibility==='public'?<Globe size={11}/>:<LockKeyhole size={11}/>} {tr(group.chat_visibility==='public'?'group_public':'group_private')} · {group.member_count} {tr('chat_members','üzv')}</span>
          {group.description && <span className="block truncate text-xs text-muted-foreground mt-1">{group.description}</span>}
          {group.is_owner ? <span className="text-[10px] font-semibold text-primary">{tr('group_owner')}</span> : group.access_state==='invited' ? <span className="text-[10px] font-semibold text-primary">{tr('group_invites')}</span> : group.access_state==='requested' ? <span className="text-[10px] text-muted-foreground">{tr('group_pending')}</span> : null}
        </span>
        {group.unread_count>0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{group.unread_count>99?'99+':group.unread_count}</span>}<ChevronRight size={17} className="rtl:rotate-180 text-muted-foreground"/>
      </button>)}</div>}
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{tr('chat_create_group','Yeni qrup yarat')}</DialogTitle></DialogHeader>
      <input aria-label={tr('chat_group_name','Qrupun adı')} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" maxLength={80} value={name} onChange={event=>setName(event.target.value)} placeholder={tr('chat_group_name','Qrupun adı')}/>
      <textarea aria-label={tr('group_description')} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" maxLength={500} value={description} onChange={event=>setDescription(event.target.value)} placeholder={tr('group_description')}/>
      <div className="grid grid-cols-2 gap-2">{(['public','private'] as const).map(value=><button type="button" key={value} aria-pressed={visibility===value} onClick={()=>setVisibility(value)} className={`rounded-xl border p-3 text-start ${visibility===value?'border-primary bg-primary/10':'border-border'}`}>
        <span className="flex items-center gap-2 font-bold text-sm">{value==='public'?<Globe size={16}/>:<LockKeyhole size={16}/>} {tr(value==='public'?'group_public':'group_private')}</span><span className="block mt-1 text-xs text-muted-foreground">{tr(value==='public'?'group_public_note':'group_private_note')}</span></button>)}</div>
      <p className="text-xs font-semibold">{tr('group_invite')}</p><ChatMemberPicker selected={people} onChange={setPeople}/>
      <button type="button" className="a-btn-solid w-full justify-center" disabled={!name.trim()||state.creating} onClick={submit}>{state.creating?<Loader2 size={18} className="animate-spin"/>:tr('chat_create','Yarat')}</button>
    </DialogContent></Dialog>
  </div>;
}
