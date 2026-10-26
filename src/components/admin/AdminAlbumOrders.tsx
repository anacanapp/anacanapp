import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Loader2, Eye, Package, Check, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

const ORDER_STATUSES = [
{ value: 'pending', label: tr("adminalbumorders_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-100 text-yellow-700' },
{ value: 'confirmed', label: tr("adminalbumorders_tesdiqlendi_0c46e4", "Təsdiqləndi"), color: 'bg-blue-100 text-blue-700' },
{ value: 'preparing', label: tr("adminalbumorders_hazirlanir_c15a4b", "Hazırlanır"), color: 'bg-purple-100 text-purple-700' },
{ value: 'delivered', label: tr("adminalbumorders_catdirildi_324039", "Çatdırıldı"), color: 'bg-emerald-100 text-emerald-700' },
{ value: 'cancelled', label: tr("adminalbumorders_legv_f7100a", "Ləğv"), color: 'bg-red-100 text-red-700' }];


const PAYMENT_STATUSES = [
{ value: 'pending', label: tr("adminalbumorders_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-100 text-yellow-700' },
{ value: 'paid', label: tr("adminalbumorders_odenilib_4f2298", "Ödənilib"), color: 'bg-green-100 text-green-700' },
{ value: 'failed', label: tr("adminalbumorders_ugursuz_541932", "Uğursuz"), color: 'bg-red-100 text-red-700' }];


const AdminAlbumOrders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-album-orders'],
    queryFn: async () => {
      return await fetchAllRows((from, to) =>
        supabase.from('album_orders' as any).select('*').order('created_at', { ascending: false }).range(from, to)
      );
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, paymentStatus }: {id: string;status?: string;paymentStatus?: string;}) => {
      const update: any = {};
      if (status) update.status = status;
      if (paymentStatus) update.payment_status = paymentStatus;
      const { error } = await supabase.from('album_orders' as any).update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-album-orders'] });
      toast({ title: tr("adminalbumorders_status_yenilendi_890662", "Status yeniləndi") });
    },
    onError: () => {
      toast({ title: tr("adminalbumorders_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          {tr("adminalbumorders_albom_sifarisleri_9cca14", "Albom Sifari\u015Fl\u0259ri (")}{orders.length})
        </h2>
      </div>

      {orders.length === 0 ?
      <div className="text-center py-12 text-muted-foreground">{tr("adminalbumorders_hele_sifaris_yoxdur_b283b8", "Hələ sifariş yoxdur")}</div> :

      <div className="space-y-3">
          {orders.map((order: any) => {
          const statusInfo = ORDER_STATUSES.find((s) => s.value === order.status) || ORDER_STATUSES[0];
          const paymentInfo = PAYMENT_STATUSES.find((s) => s.value === order.payment_status) || PAYMENT_STATUSES[0];
          return (
            <motion.div
              key={order.id}
              className="bg-card rounded-xl border p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}>
              
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{order.order_number || order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_name} • {order.contact_phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.album_type === 'pregnancy' ? tr("adminalbumorders_hamilelik_13a4c0", "\uD83D\uDCF8 Hamil\u0259lik") : tr("adminalbumorders_korpe_1fb363", "\uD83D\uDC76 K\xF6rp\u0259")} • {new Date(order.created_at).toLocaleDateString('az-AZ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentInfo.color}`}>{paymentInfo.label}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <select
                  value={order.status}
                  onChange={(e) => updateStatus.mutate({ id: order.id, status: e.target.value })}
                  className="text-xs rounded-lg border bg-background px-2 py-1 flex-1">
                  
                    {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select
                  value={order.payment_status}
                  onChange={(e) => updateStatus.mutate({ id: order.id, paymentStatus: e.target.value })}
                  className="text-xs rounded-lg border bg-background px-2 py-1 flex-1">
                  
                    {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {order.payment_proof_url &&
                <Button size="sm" variant="outline" className="px-2" onClick={() => window.open(order.payment_proof_url, '_blank')}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                }
                </div>
              </motion.div>);

        })}
        </div>
      }
    </div>);

};

export default AdminAlbumOrders;