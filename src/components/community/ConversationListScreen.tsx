import { useMemo, useState } from 'react';
import { tr } from '@/lib/group-i18n';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDirectMessages, Conversation } from '@/hooks/useDirectMessages';
import { usePartnerConversation } from '@/hooks/usePartnerConversation';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useChatGroups } from '@/hooks/useChatGroups';
import GroupChatScreen from './GroupChatScreen';

interface ConversationListScreenProps {
  onBack: () => void;
  onOpenChat: (userId: string, name: string, avatar: string | null) => void;
  partnerId?: string | null;
  onOpenGroup?: (id: string) => void;
}

const ConversationListScreen = ({ onBack, onOpenChat, partnerId, onOpenGroup }: ConversationListScreenProps) => {
  const { conversations, loading } = useDirectMessages();
  const { messages: partnerMessages, loading: partnerLoading } = usePartnerConversation(partnerId);
  const groupState = useChatGroups(undefined, 'mine', '', false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const selectGroup = (id: string) => onOpenGroup ? onOpenGroup(id) : setOpenGroup(id);

  // Merge partner conversation into the list
  const allConversations = useMemo(() => {
    const list: (Conversation & { group?: boolean })[] = [...conversations];
    if (partnerMessages) {
      // Check if partner already exists in DM conversations
      const existingIdx = list.findIndex((c) => c.user_id === partnerId);
      if (existingIdx === -1 && partnerMessages.conversation) {
        list.unshift(partnerMessages.conversation);
      }
    }
    list.push(...groupState.groups.filter(group => group.is_member).map(group => ({ user_id: group.id, group: true,
      name: group.name, avatar_url: group.cover_image_url, last_message: group.last_message || tr('chat_empty','İlk mesajı göndərin.'),
      last_message_type: group.last_message_type || 'text', last_message_at: group.last_message_at || group.created_at, unread_count: Number(group.unread_count) })));
    return list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }, [conversations, partnerMessages, partnerId, groupState.groups]);

  const getLastMessagePreview = (type: string, content: string | null) => {
    switch (type) {
      case 'image':return tr("conversationlistscreen_sekil_25710e", "\uD83D\uDCF7 \u015E\u0259kil");
      case 'video':return '🎥 Video';
      case 'audio':return tr("conversationlistscreen_ses_mesaji_acd8d9", "\uD83C\uDFA4 S\u0259s mesaj\u0131");
      default:return content?.slice(0, 50) || '';
    }
  };

  if (openGroup) return <GroupChatScreen groupId={openGroup} onBack={() => setOpenGroup(null)} />;
  return (
    <div className="a-scope min-h-screen pb-24" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar safe-area-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("untranslated_mesajlar_ak8wzw", "Mesajlar")}</p>
          </div>
        </header>

        {groupState.groups.some(group => group.access_state === 'invited' && !group.is_member) && <section className="space-y-2 pb-4"><h3 className="text-xs font-bold text-muted-foreground">{tr('group_invites')}</h3>
          {groupState.groups.filter(group => group.access_state === 'invited' && !group.is_member).map(group => <button type="button" key={group.id} onClick={() => selectGroup(group.id)} className="a-card w-full flex items-center gap-3 text-start p-3"><Users size={22} className="text-primary"/><span className="flex-1"><strong className="block text-sm">{group.name}</strong><span className="text-xs text-muted-foreground">{tr('group_invited_note')}</span></span><span className="text-xs font-bold text-primary">{tr('group_accept')}</span></button>)}
        </section>}
        {groupState.error && <button type="button" className="chat-notice w-full" onClick={() => groupState.refetch()}>{tr('chat_groups','Qruplar')} · {tr('chat_retry','Yenidən cəhd et')}</button>}
        {loading || partnerLoading || groupState.loading ?
        <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full animate-spin"
          style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
          </div> :
        allConversations.length === 0 ?
        <div className="a-card" style={{ textAlign: 'center', padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-peach-1)' }}>
              <MessageCircle size={26} style={{ color: 'var(--a-accent-ink)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr("conversationlistscreen_hele_mesajiniz_yoxdur_79d3c7", "Hələ mesajınız yoxdur")}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{tr("conversationlistscreen_istifadeci_profilinden_mesaj_gondere_bil_777661", "İstifadəçi profilindən mesaj göndərə bilərsiniz")}</p>
          </div> :

        <div className="a-list-card" style={{ padding: '4px 0' }}>
            {allConversations.map((conv, idx) =>
          <motion.button
            key={`${conv.group ? 'group' : 'person'}:${conv.user_id}`}
            onClick={() => conv.group ? selectGroup(conv.user_id) : onOpenChat(conv.user_id, conv.name, conv.avatar_url)}
            className="w-full flex items-center gap-3 text-start"
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '12px 16px',
              borderBottom: idx < allConversations.length - 1 ? '1px solid var(--a-line)' : 'none'
            }}>

                <div className="relative shrink-0">
                  <Avatar className="w-12 h-12" style={{ border: '2px solid var(--a-peach-1)' }}>
                    <AvatarImage src={conv.avatar_url || undefined} />
                    <AvatarFallback style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', fontWeight: 700 }}>{conv.group ? <Users size={22}/> : conv.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {conv.unread_count > 0 &&
              <span className="absolute -top-0.5 -end-0.5 flex items-center justify-center"
              style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--a-peach-2)', color: '#fff', fontSize: 10, fontWeight: 800, border: '2px solid var(--a-surface)' }}>
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
              }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate" style={{ fontSize: 14, fontWeight: conv.unread_count > 0 ? 800 : 600, color: 'var(--a-ink)' }}>
                      {conv.name}{conv.group && <span className="ms-1 text-[10px] font-normal text-muted-foreground">· {tr('chat_groups','Qruplar')}</span>}
                    </p>
                    <span className="flex-shrink-0 ms-2" style={{ fontSize: 10, color: 'var(--a-ink-faint)', fontWeight: 500 }}>
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: getCurrentDateLocale() })}
                    </span>
                  </div>
                  <p className="truncate mt-0.5" style={{ fontSize: 12, color: conv.unread_count > 0 ? 'var(--a-ink)' : 'var(--a-ink-soft)', fontWeight: conv.unread_count > 0 ? 600 : 400 }}>
                    {getLastMessagePreview(conv.last_message_type, conv.last_message)}
                  </p>
                </div>
              </motion.button>
          )}
          </div>
        }
      </div>
    </div>);

};

export default ConversationListScreen;
