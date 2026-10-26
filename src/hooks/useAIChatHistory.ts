import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  image_url?: string | null;
}

export const useAIChatHistory = (chatType: 'woman' | 'partner') => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // QEYD: '*' seçilir ki, image_url sütunu (Duzelis66) hələ DB-yə əlavə
      // olunmayıbsa belə sorğu SINMASIN — sütun gələndə avtomatik oxunacaq.
      const { data, error } = await (supabase
        .from('ai_chat_messages') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('chat_type', chatType)
        .order('created_at', { ascending: true })
        .limit(100) as { data: any[] | null; error: any }; // Keep last 100 messages

      if (error) throw error;
      // Cast the role to the correct type
      const typedMessages = (data || []).map(m => ({
        ...m,
        role: m.role as 'user' | 'assistant'
      }));
      setMessages(typedMessages);
    } catch (err) {
      console.error('Error fetching AI chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [user, chatType]);

  const addMessage = async (role: 'user' | 'assistant', content: string, imageUrl?: string | null) => {
    if (!user || (!content.trim() && !imageUrl)) return null;

    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          user_id: user.id,
          role,
          content,
          chat_type: chatType,
          // Duzelis66 hələ işə salınmayıbsa sütun yoxdur — o halda aşağıdakı
          // catch onsuz da işə düşməsin deyə yalnız dəyər varsa göndəririk
          ...(imageUrl ? { image_url: imageUrl } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      const typedData = {
        ...data,
        role: data.role as 'user' | 'assistant'
      };
      setMessages(prev => [...prev, typedData]);
      return typedData;
    } catch (err) {
      console.error('Error adding AI chat message:', err);
      return null;
    }
  };

  const clearHistory = async () => {
    if (!user) return;

    try {
      await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('user_id', user.id)
        .eq('chat_type', chatType);
      
      setMessages([]);
    } catch (err) {
      console.error('Error clearing AI chat history:', err);
    }
  };

  return {
    messages,
    loading,
    addMessage,
    clearHistory,
    refetch: fetchMessages,
  };
};
