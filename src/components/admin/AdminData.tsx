import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Database, Calendar, Baby, Heart, Download, Trash2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DataStats {
  dailyLogs: number;
  babyLogs: number;
  messages: number;
  shoppingItems: number;
}

const AdminData = () => {
  const [stats, setStats] = useState<DataStats>({
    dailyLogs: 0,
    babyLogs: 0,
    messages: 0,
    shoppingItems: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState('daily_logs');
  const [tableData, setTableData] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTableData();
  }, [selectedTable]);

  const fetchStats = async () => {
    try {
      const [dailyRes, babyRes, msgRes, shopRes] = await Promise.all([
      supabase.from('daily_logs').select('id', { count: 'exact', head: true }),
      supabase.from('baby_logs').select('id', { count: 'exact', head: true }),
      supabase.from('partner_messages').select('id', { count: 'exact', head: true }),
      supabase.from('shopping_items').select('id', { count: 'exact', head: true })]
      );

      setStats({
        dailyLogs: dailyRes.count || 0,
        babyLogs: babyRes.count || 0,
        messages: msgRes.count || 0,
        shoppingItems: shopRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async () => {
    try {
      const { data, error } = await supabase.
      from(selectedTable as 'daily_logs' | 'baby_logs' | 'partner_messages' | 'shopping_items').
      select('*').
      order('created_at', { ascending: false }).
      limit(50);

      if (error) throw error;
      setTableData(data || []);
    } catch (error) {
      console.error('Error fetching table data:', error);
    }
  };

  const handleClearOldData = async (table: string) => {
    const confirmed = window.confirm(`${table} cədvəlindəki 30 gündən köhnə məlumatları silmək istəyirsiniz?`);
    if (!confirmed) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase.
      from(table as 'daily_logs' | 'baby_logs' | 'partner_messages' | 'shopping_items').
      delete().
      lt('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      toast({
        title: tr("admindata_ugurlu_7fe64c", "Uğurlu"),
        description: tr("admindata_kohne_melumatlar_silindi_14450f", "K\xF6hn\u0259 m\u0259lumatlar silindi")
      });

      fetchStats();
      fetchTableData();
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: tr("admindata_xeta_3cdbb6", "Xəta"),
        description: tr("admindata_melumatlar_siline_bilmedi_12aa6d", "Məlumatlar silinə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const dataCards = [
  {
    label: tr("admindata_gunluk_qeydler_c69448", "Günlük Qeydlər"),
    value: stats.dailyLogs,
    icon: Calendar,
    color: 'bg-blue-500',
    table: 'daily_logs'
  },
  {
    label: tr("admindata_korpe_qeydleri_53482e", "Körpə Qeydləri"),
    value: stats.babyLogs,
    icon: Baby,
    color: 'bg-pink-500',
    table: 'baby_logs'
  },
  {
    label: 'Mesajlar',
    value: stats.messages,
    icon: Heart,
    color: 'bg-red-500',
    table: 'partner_messages'
  },
  {
    label: tr("admindata_alis_veris_5f0748", "Alış-veriş"),
    value: stats.shoppingItems,
    icon: Database,
    color: 'bg-green-500',
    table: 'shopping_items'
  }];


  const getTableColumns = () => {
    switch (selectedTable) {
      case 'daily_logs':
        return ['log_date', 'mood', 'water_intake', 'symptoms'];
      case 'baby_logs':
        return ['log_type', 'start_time', 'feed_type', 'diaper_type'];
      case 'partner_messages':
        return ['message_type', 'content', 'is_read', 'created_at'];
      case 'shopping_items':
        return ['name', 'quantity', 'priority', 'is_checked'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("admindata_melumatlar_29e562", "Məlumatlar")}</h1>
          <p className="text-muted-foreground">{tr("admindata_istifadeci_melumatlarini_idare_edin_20ce0a", "İstifadəçi məlumatlarını idarə edin")}</p>
        </div>
        <Button variant="outline" onClick={() => {fetchStats();fetchTableData();}} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {tr("admindata_yenile_570ce2", "Yenil\u0259")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dataCards.map((card, index) =>
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}>
          
            <Card
            className={`p-5 cursor-pointer transition-all ${
            selectedTable === card.table ? 'ring-2 ring-primary' : ''}`
            }
            onClick={() => setSelectedTable(card.table)}>
            
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">
                    {loading ? '...' : card.value.toLocaleString()}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl ${card.color}`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Table View */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily_logs">{tr("admindata_gunluk_qeydler_c69448", "Günlük Qeydlər")}</SelectItem>
                <SelectItem value="baby_logs">{tr("admindata_korpe_qeydleri_53482e", "Körpə Qeydləri")}</SelectItem>
                <SelectItem value="partner_messages">Mesajlar</SelectItem>
                <SelectItem value="shopping_items">{tr("admindata_alis_veris_5f0748", "Alış-veriş")}</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {tableData.length} qeyd
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              İxrac et
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => handleClearOldData(selectedTable)}>
              
              <Trash2 className="w-4 h-4" />
              {tr("admindata_kohneleri_sil_e985e3", "K\xF6hn\u0259l\u0259ri sil")}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {getTableColumns().map((col) =>
                <th key={col} className="text-start p-4 font-medium text-muted-foreground">
                    {col}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableData.length === 0 ?
              <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    {tr("admindata_melumat_tapilmadi_660de1", "M\u0259lumat tap\u0131lmad\u0131")}
                  </td>
                </tr> :

              tableData.map((row, index) =>
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="hover:bg-muted/30">
                
                    {getTableColumns().map((col) =>
                <td key={col} className="p-4 text-sm">
                        {typeof row[col] === 'boolean' ?
                  row[col] ? '✓' : '✗' :
                  Array.isArray(row[col]) ?
                  row[col].join(', ') :
                  row[col]?.toString() || '-'
                  }
                      </td>
                )}
                  </motion.tr>
              )
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

};

export default AdminData;