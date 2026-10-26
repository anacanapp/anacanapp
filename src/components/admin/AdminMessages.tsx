import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { MessageSquare, Heart, Search, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_type: string;
  content: string | null;
  is_read: boolean;
  created_at: string;
}

const AdminMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase.
    channel('admin-messages').
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'partner_messages' },
      () => fetchMessages()
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase.
      from('partner_messages').
      select('*').
      order('created_at', { ascending: false }).
      limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: messages.length,
    love: messages.filter((m) => m.message_type === 'love').length,
    text: messages.filter((m) => m.message_type === 'text').length,
    unread: messages.filter((m) => !m.is_read).length
  };

  const filteredMessages = messages.filter((msg) =>
  msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mesajlar</h1>
          <p className="text-muted-foreground">{tr("adminmessages_partner_mesajlasmalarini_izleyin_ac2a01", "Partner mesajlaşmalarını izləyin")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{tr("adminmessages_umumi_1b5521", "Ümumi")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.love}</p>
              <p className="text-xs text-muted-foreground">Sevgi</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.text}</p>
              <p className="text-xs text-muted-foreground">{tr("adminmessages_metn_6e9f0f", "Mətn")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <MessageSquare className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unread}</p>
              <p className="text-xs text-muted-foreground">{tr("adminmessages_oxunmamis_08b615", "Oxunmamış")}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Mesaj axtar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10" />
          
        </div>
      </Card>

      {/* Messages List */}
      <Card className="divide-y divide-border">
        {loading ?
        <div className="p-8 text-center text-muted-foreground">
            {tr("adminmessages_yuklenir_5557de", "Y\xFCkl\u0259nir...")}
          </div> :
        filteredMessages.length === 0 ?
        <div className="p-8 text-center text-muted-foreground">
            {tr("adminmessages_mesaj_tapilmadi_a4aac3", "Mesaj tap\u0131lmad\u0131")}
          </div> :

        filteredMessages.map((message, index) =>
        <motion.div
          key={message.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          className="p-4 hover:bg-muted/30 transition-colors">
          
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full shrink-0 ${
            message.message_type === 'love' ?
            'bg-red-500/10' :
            'bg-blue-500/10'}`
            }>
                  {message.message_type === 'love' ?
              <Heart className="w-5 h-5 text-red-500" /> :

              <MessageSquare className="w-5 h-5 text-blue-500" />
              }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={message.message_type === 'love' ? 'default' : 'secondary'}>
                      {message.message_type === 'love' ? 'Sevgi' : 'Mesaj'}
                    </Badge>
                    {!message.is_read &&
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                        Yeni
                      </Badge>
                }
                  </div>
                  <p className="text-foreground">
                    {message.content || (message.message_type === 'love' ? tr("adminmessages_sevgi_gonderildi_1a1e5a", "\u2764\uFE0F Sevgi g\xF6nd\u0259rildi") : tr("adminmessages_bos_mesaj_0cd466", "Bo\u015F mesaj"))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(message.created_at).toLocaleString('az-AZ')}
                  </p>
                </div>
              </div>
            </motion.div>
        )
        }
      </Card>
    </div>);

};

export default AdminMessages;