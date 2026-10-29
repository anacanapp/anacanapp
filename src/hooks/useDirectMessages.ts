import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import type { PushEventData } from '@/lib/push';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { compressImageForUpload } from '@/lib/image-compress';

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  user_id: string;
  name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_type: string;
  last_message_at: string;
  unread_count: number;
}

export const useDirectMessages = (otherUserId?: string) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.
      from('direct_messages').
      select('*').
      or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).
      order('created_at', { ascending: false }).
      limit(500);

      if (error) throw error;
      if (!data || data.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Group by conversation partner
      const convMap = new Map<string, {messages: any[];unread: number;}>();
      for (const msg of data) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { messages: [], unread: 0 });
        }
        const conv = convMap.get(partnerId)!;
        conv.messages.push(msg);
        if (msg.receiver_id === user.id && !msg.is_read) conv.unread++;
      }

      // Fetch profile info for all partners
      const partnerIds = Array.from(convMap.keys());
      const { data: profiles } = await (supabase as any).
      from('public_profile_cards').
      select('user_id, name, avatar_url').
      in('user_id', partnerIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const convList: Conversation[] = partnerIds.map((pid) => {
        const conv = convMap.get(pid)!;
        const lastMsg = conv.messages[0];
        const profile = profileMap.get(pid) as any;
        return {
          user_id: pid,
          name: profile?.name || tr("usedirectmessages_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
          avatar_url: profile?.avatar_url || null,
          last_message: lastMsg.content,
          last_message_type: lastMsg.message_type,
          last_message_at: lastMsg.created_at,
          unread_count: conv.unread
        };
      });

      convList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      setConversations(convList);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!user || !otherUserId) return;
    try {
      const { data, error } = await supabase.
      from('direct_messages').
      select('*').
      or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      ).
      order('created_at', { ascending: true }).
      limit(200);

      if (error) throw error;
      setMessages(data as DirectMessage[] || []);

      // Mark unread as read
      const unread = (data || []).filter((m) => m.receiver_id === user.id && !m.is_read);
      if (unread.length > 0) {
        await supabase.
        from('direct_messages').
        update({ is_read: true }).
        in('id', unread.map((m) => m.id));
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [user, otherUserId]);

  const sendMessage = async (content: string, type: string = 'text', mediaUrl?: string) => {
    if (!user || !otherUserId) return null;
    try {
      const { data, error } = await supabase.
      from('direct_messages').
      insert({
        sender_id: user.id,
        receiver_id: otherUserId,
        content: type === 'text' ? content : null,
        message_type: type,
        media_url: mediaUrl || null
      }).
      select().
      single();

      if (error) throw error;

      // The Azure function verifies the exact persisted row. Unsupported message
      // types remain stored, but are not submitted to a contract that rejects them.
      if (['text', 'image', 'video', 'audio'].includes(data.message_type)) {
        try {
          const { invokeSendPush } = await import('@/lib/push');
          await invokeSendPush({
            userId: data.receiver_id,
            title: tr("directmessages_yeni_mesaj", 'Yeni mesaj') + ' 💬',
            body: data.message_type === 'text' ? (data.content || '').length > 60 ? `${data.content!.slice(0, 60)}...` : data.content || tr("directmessages_yeni_mesaj", 'Yeni mesaj') :
            data.message_type === 'image' ? tr("usedirectmessages_sekil_gonderdi_9e8836", "\uD83D\uDCF7 \u015E\u0259kil g\xF6nd\u0259rdi") :
            data.message_type === 'video' ? tr("usedirectmessages_video_gonderdi_41246c", "\uD83C\uDFA5 Video g\xF6nd\u0259rdi") :
            data.message_type === 'audio' ? tr("usedirectmessages_ses_mesaji_gonderdi_5b803e", "\uD83C\uDFA4 S\u0259s mesaj\u0131 g\xF6nd\u0259rdi") :
            tr("directmessages_yeni_mesaj", 'Yeni mesaj'),
            data: {
              type: 'direct_message',
              context: 'direct_message',
              sender_id: data.sender_id,
              messageId: data.id,
              interactionId: data.id
            } satisfies PushEventData,
            kind: 'direct_message'
          });
        } catch (pushErr) {
          console.warn('Push notification failed:', pushErr);
        }
      }

      if (data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.id)) return prev;
          return [...prev, data as DirectMessage];
        });
      }

      return data;
    } catch (err: any) {
      console.error('Error sending DM:', err);
      toast({ title: tr("usedirectmessages_mesaj_gonderilmedi_7df412", "Mesaj göndərilmədi"), description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const uploadMedia = async (original: Blob, type: 'image' | 'video' | 'audio', signal?: AbortSignal) => {
    if (!user || signal?.aborted) return null;
    const file = type === 'image' ? await compressImageForUpload(original) : original;
    
    let ext = 'jpg';
    let contentType = 'image/jpeg';
    
    if (type === 'audio') {
      const fileType = file.type || '';
      if (fileType.includes('mp4')) ext = 'mp4';
      else if (fileType.includes('ogg')) ext = 'ogg';
      else if (fileType.includes('webm')) ext = 'webm';
      else ext = 'm4a';
      contentType = fileType || 'audio/mp4';
    } else if (type === 'video') {
      ext = 'mp4';
      contentType = 'video/mp4';
    } else {
      const fileType = file.type || '';
      if (fileType.includes('png')) ext = 'png';
      else if (fileType.includes('gif')) ext = 'gif';
      else if (fileType.includes('webp')) ext = 'webp';
      contentType = fileType || 'image/jpeg';
    }

    const fileName = `${user.id}/${Date.now()}.${ext}`;

    // Let the request finish so cancellation can remove the exact uploaded path.
    const { data, error } = await supabase.storage.
    from('chat-media').
    upload(fileName, file, { contentType, upsert: false });

    if (error) throw error;
    if (signal?.aborted) {
      try {
        const { error: removalError } = await supabase.storage.from('chat-media').remove([data.path]);
        if (removalError) throw removalError;
      } catch {
        console.error('Failed to remove cancelled chat media upload');
      }
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data.path);
    return publicUrl;
  };

  // Initial fetch
  useEffect(() => {
    if (otherUserId) {
      fetchMessages();
    } else {
      fetchConversations();
    }
  }, [otherUserId, fetchMessages, fetchConversations]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    // The conversation list refetch is heavy; coalesce bursts of inserts
    // (leading + trailing, >= 2s). An open thread refreshes immediately.
    let lastConversations = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    const throttledConversations = () => {
      const wait = 2000 - (Date.now() - lastConversations);
      if (wait <= 0) { lastConversations = Date.now(); void fetchConversations(); return; }
      if (!trailing) trailing = setTimeout(() => { trailing = null; lastConversations = Date.now(); void fetchConversations(); }, wait);
    };
    const onInsert = () => {
      if (otherUserId) fetchMessages();else
      throttledConversations();
    };

    const channel = supabase.
    channel(`dm_realtime:${user.id}:${otherUserId ?? 'inbox'}:${crypto.randomUUID()}`).
    on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages',
      filter: `receiver_id=eq.${user.id}`
    }, onInsert).
    on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages',
      filter: `sender_id=eq.${user.id}`
    }, onInsert).
    subscribe();

    return () => {
      if (trailing) clearTimeout(trailing);
      trailing = null;
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, fetchMessages, fetchConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return {
    messages,
    conversations,
    loading,
    sendMessage,
    uploadMedia,
    totalUnread,
    refetch: otherUserId ? fetchMessages : fetchConversations
  };
};
