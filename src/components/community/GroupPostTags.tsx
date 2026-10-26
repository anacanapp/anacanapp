import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Loader2, LockKeyhole, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useChatGroups } from '@/hooks/useChatGroups';
import { navigateFromPush } from '@/lib/pushNav';
import { tr } from '@/lib/group-i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserStore } from '@/store/userStore';
import { normalizeAppLanguage } from '@/lib/app-languages';

export function GroupTagPicker({ value, onChange, disabled = false }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const state=useChatGroups(undefined,'mine'), [open,setOpen]=useState(false);
  const groups=state.groups.filter(group=>group.is_owner);
  return <div className="space-y-2"><button type="button" disabled={disabled} onClick={()=>setOpen(true)} className="a-tag inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"><Users size={14}/>{tr('group_tag')}{value.length?` (${value.length})`:''}</button>
    {!!value.length&&<div className="flex gap-1.5 flex-wrap">{groups.filter(group=>value.includes(group.id)).map(group=><button type="button" key={group.id} onClick={()=>onChange(value.filter(id=>id!==group.id))} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{group.name}<X size={12}/></button>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{tr('group_tag')}</DialogTitle></DialogHeader><p className="text-xs text-muted-foreground">{tr('group_tag_note')}</p>
      {state.loading?<Loader2 size={20} className="animate-spin"/>:state.error?<button onClick={()=>state.refetch()}>{tr('chat_retry','Yenidən cəhd et')}</button>:!groups.length?<p className="text-sm text-muted-foreground">{tr('chat_no_groups','Hələ qrup yoxdur.')}</p>:
        <div className="space-y-2 max-h-72 overflow-y-auto">{groups.map(group=><label key={group.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30"><input type="checkbox" checked={value.includes(group.id)} disabled={!value.includes(group.id)&&value.length>=3} onChange={()=>onChange(value.includes(group.id)?value.filter(id=>id!==group.id):[...value,group.id])}/><span className="flex-1 text-sm font-semibold">{group.name}</span><span className="text-[11px] text-muted-foreground">{tr(group.chat_visibility==='public'?'group_public':'group_private')}</span></label>)}</div>}
      <button type="button" className="a-btn-solid justify-center" onClick={()=>setOpen(false)}>{tr('common_saxla','Saxla')}</button>
    </DialogContent></Dialog>
  </div>;
}
export default function GroupPostTags({ ids }: { ids: string[] }) {
  const {user}=useAuth(), backend=getBackendConfig().url;
  const language=normalizeAppLanguage(useUserStore(state=>state.language));
  const query=useQuery({queryKey:['chat-group-cards-v3',backend,user?.id,ids,language],enabled:!!user&&ids.length>0,staleTime:30000,
    queryFn:async()=>{const {data,error}=await (supabase as any).rpc('chat_group_cards_v4',{p_groups:ids,p_language:language});if(error)throw error;
      return ((data||[]) as {id:string;name:string;chat_visibility:'public'|'private';member_count:number;discovery_language:string}[]).filter(group=>group.discovery_language===language);}});
  if(!query.data?.length)return null;
  return <div className="space-y-2 mt-3" onClick={event=>event.stopPropagation()}>{query.data.map(group=><button type="button" key={group.id} data-chat-group-tag={group.id} onClick={()=>navigateFromPush({type:'group_message',groupId:group.id})} className="w-full flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-start">
    <Users size={24} className="text-primary"/><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.name}</strong><span className="flex items-center gap-1 text-[11px] text-muted-foreground">{group.chat_visibility==='public'?<Globe size={11}/>:<LockKeyhole size={11}/>} {tr(group.chat_visibility==='public'?'group_public':'group_private')} · {group.member_count} {tr('chat_members','üzv')}</span></span><span className="text-xs font-bold text-primary">{tr(group.chat_visibility==='public'?'chat_join':'group_request','Qoşul')}</span>
  </button>)}</div>;
}
