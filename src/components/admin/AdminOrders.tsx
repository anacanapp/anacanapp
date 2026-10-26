import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Package, Search, Eye, Truck, CheckCircle, XCircle,
  Clock, MapPin, Phone, User, ChevronDown, ChevronUp } from
'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAllOrders, Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

const STATUS_CONFIG: Record<string, {label: string;color: string;icon: React.ComponentType<any>;}> = {
  pending: { label: tr("adminorders_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: tr("adminorders_tesdiqlendi_0c46e4", "Təsdiqləndi"), color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  processing: { label: tr("adminorders_hazirlanir_c15a4b", "Hazırlanır"), color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: tr("adminorders_gonderildi_6cf847", "Göndərildi"), color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  delivered: { label: tr("adminorders_catdirildi_324039", "Çatdırıldı"), color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: tr("adminorders_legv_edildi_bfa98b", "Ləğv edildi"), color: 'bg-red-100 text-red-800', icon: XCircle }
};

const AdminOrders = () => {
  const { orders, loading, updateOrderStatus } = useAllOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
    order.order_number.toLowerCase().includes(search.toLowerCase()) ||
    order.shipping_address?.name?.toLowerCase().includes(search.toLowerCase()) ||
    order.shipping_address?.phone?.includes(search);

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const toggleExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => ['confirmed', 'processing'].includes(o.status)).length,
    completed: orders.filter((o) => o.status === 'delivered').length,
    revenue: orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total_amount, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{tr("adminorders_sifarisler_660280", "Sifarişlər")}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">{tr("adminorders_umumi_1b5521", "Ümumi")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">{tr("adminorders_gozleyir_9ac18a", "Gözləyir")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            <p className="text-sm text-muted-foreground">{tr("adminorders_hazirlanir_c15a4b", "Hazırlanır")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">{tr("adminorders_catdirildi_324039", "Çatdırıldı")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.revenue.toFixed(2)} ₼</p>
            <p className="text-sm text-muted-foreground">{tr("adminorders_gelir_92208b", "Gəlir")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("adminorders_sifaris_nomresi_ad_ve_ya_telefon_24cdf0", "Sifariş nömrəsi, ad və ya telefon...")}
            className="ps-10" />
          
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("adminorders_hamisi_c73c4d", "Hamısı")}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) =>
            <SelectItem key={key} value={key}>{label}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ?
        <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{tr("adminorders_sifaris_tapilmadi_08e5bf", "Sifariş tapılmadı")}</p>
          </div> :

        filteredOrders.map((order) => {
          const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedOrders.has(order.id);

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border overflow-hidden">
              
                {/* Order Header */}
                <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(order.id)}>
                
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusConfig.color}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{order.order_number}</span>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{format(new Date(order.created_at), 'd MMMM, HH:mm', { locale: getCurrentDateLocale() })}</span>
                      <span className="font-medium text-foreground">{order.total_amount.toFixed(2)} ₼</span>
                      {order.shipping_address?.name &&
                    <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {order.shipping_address.name}
                        </span>
                    }
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                    value={order.status}
                    onValueChange={(value) => updateOrderStatus(order.id, value as Order['status'])}>
                    
                      <SelectTrigger className="w-[140px] h-8" onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, { label }]) =>
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded &&
              <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                    {/* Shipping Address */}
                    {order.shipping_address &&
                <div className="bg-muted/50 rounded-lg p-3">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {tr("adminorders_catdirilma_unvani_10ea11", "\xC7atd\u0131r\u0131lma \xDCnvan\u0131")}
                        </h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          {order.shipping_address.name && <p>{order.shipping_address.name}</p>}
                          {order.shipping_address.phone &&
                    <p className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {order.shipping_address.phone}
                            </p>
                    }
                          {order.shipping_address.address && <p>{order.shipping_address.address}</p>}
                          {order.shipping_address.city && <p>{order.shipping_address.city}</p>}
                        </div>
                      </div>
                }

                    {/* Order Items */}
                    {order.items && order.items.length > 0 &&
                <div>
                        <h4 className="font-semibold text-sm mb-2">{tr("adminorders_mehsullar_24a4ce", "Məhsullar")}</h4>
                        <div className="space-y-2">
                          {order.items.map((item) =>
                    <div key={item.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
                              <span className="text-sm">{item.product_name}</span>
                              <div className="text-sm text-muted-foreground">
                                {item.quantity} x {item.unit_price.toFixed(2)} ₼ = {item.total_price.toFixed(2)} ₼
                              </div>
                            </div>
                    )}
                        </div>
                      </div>
                }

                    {/* Notes */}
                    {order.notes &&
                <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
                        <h4 className="font-semibold text-sm mb-1">{tr("adminorders_qeydler_a7a98b", "Qeydlər")}</h4>
                        <p className="text-sm text-muted-foreground">{order.notes}</p>
                      </div>
                }
                  </div>
              }
              </motion.div>);

        })
        }
      </div>
    </div>);

};

export default AdminOrders;