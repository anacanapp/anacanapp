import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Ban, Check, Globe, Loader2, LockKeyhole, LogOut, Settings2, Shield, Trash2, UserPlus, UserX, Users, X } from 'lucide-react';
import { useChatGroups, type GroupAction } from '@/hooks/useChatGroups';
import { useFullScreenChat } from '@/hooks/useChatChrome';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAdSafetyBlock } from '@/components/ads/AdExperienceProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConversationScreen from '@/components/chat/ConversationScreen';
import ChatMemberPicker from '@/components/chat/ChatMemberPicker';
import { chatError } from '@/lib/chat';
import type { PublicProfileCard } from '@/lib/public-profile-cards';
import { tr } from '@/lib/group-i18n';
import { pushBackHandler } from '@/lib/backButton';
import '@/styles/chat.css';

export default function GroupChatScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  useFullScreenChat(); useAdSafetyBlock(true);
  const state=useChatGroups(groupId), {toast}=useToast(), {user}=useAuth(), group=state.group;
  const [details,setDetails]=useState(false),[adding,setAdding]=useState(false),[editing,setEditing]=useState(false),[people,setPeople]=useState<PublicProfileCard[]>([]);
  const [tab,setTab]=useState<'member'|'requested'|'invited'|'blocked'>('member');
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[visibility,setVisibility]=useState<'public'|'private'>('private'),[posting,setPosting]=useState<'members'|'admins'>('members');
  const failed=(error:unknown)=>toast({title:chatError(error),variant:'destructive'});
  const act=(action:GroupAction,targets:string[]=[])=>state.manage({group:groupId,action,people:targets}).catch(failed);
  const isBlocked=group?.access_state==='blocked';
  useEffect(()=>{
    if(group?.is_member&&!details&&!adding&&!editing)return;
    return pushBackHandler(()=>{if(editing)setEditing(false);else if(adding)setAdding(false);else if(details)setDetails(false);else onBack();return true;});
  },[group?.is_member,details,adding,editing,onBack]);
  if (!group?.is_member) return createPortal(<section className="chat-screen a-scope"><header className="chat-topbar"><button className="chat-icon-button" onClick={onBack} aria-label={tr('common_geri','Geri')}><ArrowLeft className="rtl:rotate-180" size={20}/></button><strong>{tr('chat_groups','Qruplar')}</strong></header>
    <div className="chat-empty">{state.loading?<Loader2 className="animate-spin"/>:!group?<><Users size={36}/><p>{chatError(state.error || new Error('CHAT_GROUP_UNAVAILABLE'))}</p><button onClick={()=>state.refetch()}>{tr('chat_retry','Yenidən cəhd et')}</button></>:<>
      <span className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-4xl">{group.icon_emoji||'💬'}</span><h1 className="text-xl font-bold">{group.name}</h1>
      <p className="flex items-center gap-1 text-xs">{group.chat_visibility==='public'?<Globe size={13}/>:<LockKeyhole size={13}/>} {tr(group.chat_visibility==='public'?'group_public':'group_private')} · {group.member_count} {tr('chat_members','üzv')}</p>
      <p className="max-w-sm whitespace-pre-wrap">{group.description}</p><p className="max-w-sm">{tr(isBlocked?'group_blocked':group.access_state==='invited'?'group_invited_note':group.chat_visibility==='public'?'group_public_note':'group_private_note')}</p>
      {!isBlocked && (group.access_state==='requested'?<><strong>{tr('group_pending')}</strong><button disabled={state.managing} onClick={()=>act('cancel_request')}>{tr('common_legv_et','Ləğv et')}</button></>:
        <><button className="a-btn-solid px-6" disabled={state.managing} onClick={()=>act(group.access_state==='invited'?'accept_invite':'join')}>{state.managing?<Loader2 size={17} className="animate-spin"/>:tr(group.access_state==='invited'?'group_accept':group.chat_visibility==='public'?'chat_join':'group_request', 'Qoşul')}</button>
          {group.access_state==='invited'&&<button disabled={state.managing} onClick={()=>act('decline_invite')}>{tr('group_reject')}</button>}</>)}
    </>}</div></section>,document.body);
  const beginEdit=()=>{setName(group.name);setDescription(group.description||'');setVisibility(group.chat_visibility);setPosting(group.chat_posting_policy||'members');setEditing(true);};
  const labels={member:tr('chat_members','Üzvlər'),requested:tr('group_requests'),invited:tr('group_invites'),blocked:tr('group_bans')};
  return <>
    <ConversationScreen kind="group" target={groupId} title={group.name} avatar={group.cover_image_url} canModerate={group.can_manage}
      readOnly={group.chat_posting_policy==='admins'&&!group.can_manage}
      subtitle={`${tr(group.chat_visibility==='public'?'group_public':'group_private')} · ${group.member_count} ${tr('chat_members','üzv')}${group.pending_count?` · ${group.pending_count} ${tr('group_requests')}`:''}`}
      onBack={onBack} onDetails={()=>setDetails(true)}/>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent overlayClassName="z-[90]" className="z-[100] max-w-md max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{group.name}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">{tr(group.chat_visibility==='public'?'group_public':'group_private')} · {tr(group.chat_visibility==='public'?'group_public_note':'group_private_note')}</p>
      {group.description&&<p className="text-sm whitespace-pre-wrap">{group.description}</p>}
      {group.is_owner&&<div className="flex gap-2"><button className="a-btn-solid gap-2" onClick={()=>setAdding(true)}><UserPlus size={16}/>{tr('group_invite')}</button><button className="a-btn-solid gap-2" onClick={beginEdit}><Settings2 size={16}/>{tr('group_settings')}</button></div>}
      <div className="flex gap-1 overflow-x-auto pb-1">{(['member',...(group.is_owner?['requested','invited','blocked']:[])] as (keyof typeof labels)[]).map(value=><button type="button" key={value} onClick={()=>setTab(value)} className={`rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap ${tab===value?'bg-primary text-primary-foreground':'bg-muted'}`}>{labels[value]} ({state.members.filter(item=>item.state===value).length})</button>)}</div>
      {state.membersLoading?<Loader2 size={20} className="animate-spin"/>:state.membersError?<p role="alert">{chatError(state.membersError)}</p>:!state.members.some(item=>item.state===tab)?<p className="text-xs text-muted-foreground py-3">{tr('group_no_people')}</p>:null}
      <div className="space-y-2">{state.members.filter(item=>item.state===tab).map(member=><div key={member.user_id} className="flex items-center gap-2 py-1">
        <Avatar className="h-9 w-9"><AvatarImage src={member.avatar_url||undefined}/><AvatarFallback>{member.name?.charAt(0)||'•'}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.name||tr('chat_member','Üzv')}</p><p className="text-[10px] text-primary">{member.user_id===group.created_by?tr('group_owner'):member.role==='admin'?tr('group_administrator'):''}</p></div>
        {member.state==='requested'&&group.is_owner&&<><button className="chat-icon-button text-primary" aria-label={tr('group_approve')} disabled={state.managing} onClick={()=>act('approve',[member.user_id])}><Check size={17}/></button><button className="chat-icon-button" aria-label={tr('group_reject')} disabled={state.managing} onClick={()=>act('reject',[member.user_id])}><X size={17}/></button></>}
        {member.state==='blocked'&&group.is_owner&&<button className="text-xs text-primary" disabled={state.managing} onClick={()=>act('unblock',[member.user_id])}>{tr('group_unblock')}</button>}
        {member.state==='invited'&&group.is_owner&&<button className="chat-icon-button" aria-label={tr('group_reject')} disabled={state.managing} onClick={()=>act('remove',[member.user_id])}><X size={17}/></button>}
        {['requested','invited'].includes(member.state)&&group.is_owner&&<button className="chat-icon-button text-destructive" aria-label={tr('group_block')} disabled={state.managing} onClick={()=>{if(confirm(`${tr('group_block')}: ${member.name}?`))void act('block',[member.user_id]);}}><Ban size={16}/></button>}
        {member.state==='member'&&group.can_manage&&member.user_id!==user?.id&&member.user_id!==group.created_by&&<div className="flex flex-wrap justify-end gap-0.5 max-w-36">
          {group.is_owner&&<><button className="chat-icon-button" aria-label={tr(member.role==='admin'?'group_demote':'group_make_administrator')} disabled={state.managing} onClick={()=>act(member.role==='admin'?'demote':'promote',[member.user_id])}><Shield size={16}/></button>
            <button className="chat-icon-button" aria-label={tr('group_transfer')} disabled={state.managing} onClick={()=>{if(confirm(`${tr('group_transfer')}: ${member.name}?`))void act('transfer',[member.user_id]);}}><Users size={16}/></button></>}
          {(group.is_owner||member.role!=='admin')&&<><button className="chat-icon-button" aria-label={tr('chat_remove_member','Üzvü çıxar')} disabled={state.managing} onClick={()=>{if(confirm(tr('chat_remove_member_confirm','Bu üzvü qrupdan çıxarmaq istəyirsiniz?')))void act('remove',[member.user_id]);}}><UserX size={16}/></button>
            <button className="chat-icon-button text-destructive" aria-label={tr('group_block')} disabled={state.managing} onClick={()=>{if(confirm(`${tr('group_block')}: ${member.name}?`))void act('block',[member.user_id]);}}><Ban size={16}/></button></>}
        </div>}
      </div>)}</div>
      <button className="flex justify-center gap-2 rounded-xl border p-3 text-sm" disabled={state.managing} onClick={()=>{if(confirm(tr('chat_leave_confirm','Qrupdan ayrılmaq istəyirsiniz?')))void state.manage({group:groupId,action:'leave'}).then(onBack).catch(failed);}}><LogOut size={16}/>{tr('chat_leave','Qrupdan ayrıl')}</button>
      {group.is_owner&&<button className="flex justify-center gap-2 text-sm text-destructive" disabled={state.managing} onClick={()=>{if(confirm(tr('group_delete_confirm')))void state.manage({group:groupId,action:'delete'}).then(onBack).catch(failed);}}><Trash2 size={16}/>{tr('group_delete')}</button>}
    </DialogContent></Dialog>
    <Dialog open={adding} onOpenChange={setAdding}><DialogContent overlayClassName="z-[105]" className="z-[110] max-w-md"><DialogHeader><DialogTitle>{tr('group_invite')}</DialogTitle></DialogHeader>
      <ChatMemberPicker selected={people} onChange={setPeople} excluded={state.members.filter(item=>item.state!=='requested').map(item=>item.user_id)}/>
      <button className="a-btn-solid justify-center" disabled={!people.length||state.managing} onClick={()=>state.manage({group:groupId,action:'invite',people:people.map(person=>person.user_id)}).then(()=>{setAdding(false);setPeople([]);}).catch(failed)}>{state.managing?<Loader2 className="animate-spin" size={17}/>:tr('group_invite')}</button>
    </DialogContent></Dialog>
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent overlayClassName="z-[105]" className="z-[110] max-w-md"><DialogHeader><DialogTitle>{tr('group_settings')}</DialogTitle></DialogHeader>
      <input aria-label={tr('chat_group_name','Qrupun adı')} className="rounded-xl border p-3 text-sm" value={name} maxLength={80} onChange={event=>setName(event.target.value)}/>
      <textarea aria-label={tr('group_description')} className="rounded-xl border p-3 text-sm" value={description} maxLength={500} onChange={event=>setDescription(event.target.value)}/>
      <div className="grid grid-cols-2 gap-2">{(['public','private'] as const).map(value=><button type="button" key={value} aria-pressed={visibility===value} className={`rounded-xl border p-3 ${visibility===value?'border-primary bg-primary/10':''}`} onClick={()=>setVisibility(value)}>{tr(value==='public'?'group_public':'group_private')}</button>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={posting==='admins'} onChange={event=>setPosting(event.target.checked?'admins':'members')}/>{tr('group_admins_only')}</label>
      <button className="a-btn-solid justify-center" disabled={!name.trim()||state.updating} onClick={()=>state.update({group:groupId,name:name.trim(),description,visibility,posting}).then(()=>setEditing(false)).catch(failed)}>{state.updating?'…':tr('common_saxla','Saxla')}</button>
    </DialogContent></Dialog>
  </>;
}
