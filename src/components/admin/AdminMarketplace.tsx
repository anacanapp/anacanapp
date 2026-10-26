import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import {
  Search, Filter, Check, X, Trash2, Edit, Eye,
  Loader2, Package, Clock, CheckCircle, XCircle, AlertCircle } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
'@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
'@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  is_free: boolean;
  age_range: string;
  images: string[];
  location_city: string;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

const categories = [
{ id: 'clothing', label: 'Geyim', emoji: '👕' },
{ id: 'toys', label: 'Oyuncaqlar', emoji: '🧸' },
{ id: 'furniture', label: 'Mebel', emoji: '🛏️' },
{ id: 'stroller', label: 'Araba', emoji: '👶' },
{ id: 'feeding', label: 'Qidalanma', emoji: '🍼' },
{ id: 'hygiene', label: 'Gigiyena', emoji: '🛁' },
{ id: 'other', label: tr("adminmarketplace_diger_293b3a", "Digər"), emoji: '📦' }];


const conditions = [
{ id: 'new', label: 'Yeni', color: 'bg-green-500' },
{ id: 'like_new', label: 'Yeni kimi', color: 'bg-emerald-500' },
{ id: 'good', label: tr("adminmarketplace_yaxsi_9d8595", "Yaxşı"), color: 'bg-blue-500' },
{ id: 'fair', label: 'Normal', color: 'bg-yellow-500' }];


const ageRanges = [
'0-3 ay', '3-6 ay', '6-12 ay', tr("adminmarketplace_1_2_yas_aa6324", "1-2 ya\u015F"), tr("adminmarketplace_2_3_yas_d49317", "2-3 ya\u015F"), tr("adminmarketplace_3_yas_dec51d", "3+ ya\u015F")];


const statusLabels: Record<string, {label: string;color: string;icon: React.ReactNode;}> = {
  pending: { label: tr("adminmarketplace_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-500', icon: <Clock className="w-4 h-4" /> },
  active: { label: 'Aktiv', color: 'bg-green-500', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: tr("adminmarketplace_redd_edildi_c40149", "Rədd edildi"), color: 'bg-red-500', icon: <XCircle className="w-4 h-4" /> },
  sold: { label: tr("adminmarketplace_satildi_6a6109", "Satıldı"), color: 'bg-blue-500', icon: <Package className="w-4 h-4" /> },
  inactive: { label: 'Deaktiv', color: 'bg-gray-500', icon: <AlertCircle className="w-4 h-4" /> }
};

const AdminMarketplace = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isMarketplaceEnabled, setIsMarketplaceEnabled] = useState(false);

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '',
    condition: '',
    price: 0,
    is_free: false,
    age_range: '',
    location_city: '',
    status: ''
  });

  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    loadListings();
    loadMarketplaceStatus();
  }, [statusFilter, categoryFilter]);

  const loadMarketplaceStatus = async () => {
    try {
      const { data } = await supabase.
      from('tool_configs').
      select('is_active').
      eq('tool_id', 'second-hand-market').
      single();

      setIsMarketplaceEnabled(data?.is_active || false);
    } catch (error) {
      console.error('Error loading marketplace status:', error);
    }
  };

  const toggleMarketplaceStatus = async () => {
    try {
      const newStatus = !isMarketplaceEnabled;
      const { error } = await supabase.
      from('tool_configs').
      update({ is_active: newStatus }).
      eq('tool_id', 'second-hand-market');

      if (error) throw error;

      setIsMarketplaceEnabled(newStatus);
      toast({
        title: tr("adminmarketplace_ugurlu_5c0191", "Uğurlu!"),
        description: `Bazar ${newStatus ? tr("adminmarketplace_aktivlesdirildi_c35430", "aktivl\u0259\u015Fdirildi") : 'deaktiv edildi'}`
      });
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_status_deyisdirile_bilmedi_de921f", "Status dəyişdirilə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const loadListings = async () => {
    setIsLoading(true);
    try {
      // DÜZƏLİŞ: limitsiz idi — marketplace_listings 1000-i keçəndə
      // "İkinci Əl Bazarı" admin səhifəsi yalnız ilk 1000 elanı göstərirdi.
      const data = await fetchAllRows((from, to) => {
        let query = supabase.
        from('marketplace_listings').
        select('*').
        order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        if (categoryFilter !== 'all') {
          query = query.eq('category', categoryFilter);
        }

        return query.range(from, to);
      });

      setListings(data || []);
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_elanlar_yuklene_bilmedi_3af806", "Elanlar yüklənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (listing: Listing) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.
      from('marketplace_listings').
      update({
        status: 'active',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.user_id,
        admin_notes: null
      }).
      eq('id', listing.id);

      if (error) throw error;

      toast({
        title: tr("adminmarketplace_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminmarketplace_elan_tesdiqlendi_9bfd19", "Elan təsdiqləndi")
      });
      loadListings();
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_elan_tesdiqlene_bilmedi_c7a56a", "Elan təsdiqlənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedListing) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.
      from('marketplace_listings').
      update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.user_id,
        admin_notes: rejectReason
      }).
      eq('id', selectedListing.id);

      if (error) throw error;

      toast({
        title: tr("adminmarketplace_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminmarketplace_elan_redd_edildi_54979d", "Elan rədd edildi")
      });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedListing(null);
      loadListings();
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_elan_redd_edile_bilmedi_1e60a6", "Elan rədd edilə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (listing: Listing) => {
    if (!confirm(tr("adminmarketplace_bu_elani_silmek_istediyinize_e_5115f5", "Bu elan\u0131 silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    try {
      const { error } = await supabase.
      from('marketplace_listings').
      delete().
      eq('id', listing.id);

      if (error) throw error;

      toast({
        title: tr("adminmarketplace_ugurlu_5c0191", "Uğurlu!"),
        description: 'Elan silindi'
      });
      loadListings();
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_elan_siline_bilmedi_38864f", "Elan silinə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (listing: Listing) => {
    setSelectedListing(listing);
    setEditForm({
      title: listing.title,
      description: listing.description || '',
      category: listing.category,
      condition: listing.condition,
      price: listing.price || 0,
      is_free: listing.is_free || false,
      age_range: listing.age_range || '',
      location_city: listing.location_city || '',
      status: listing.status
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedListing) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.
      from('marketplace_listings').
      update({
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        condition: editForm.condition,
        price: editForm.is_free ? 0 : editForm.price,
        is_free: editForm.is_free,
        age_range: editForm.age_range,
        location_city: editForm.location_city,
        status: editForm.status,
        updated_at: new Date().toISOString()
      }).
      eq('id', selectedListing.id);

      if (error) throw error;

      toast({
        title: tr("adminmarketplace_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminmarketplace_elan_yenilendi_b02130", "Elan yeniləndi")
      });
      setShowEditModal(false);
      setSelectedListing(null);
      loadListings();
    } catch (error) {
      toast({
        title: tr("adminmarketplace_xeta_3cdbb6", "Xəta"),
        description: tr("adminmarketplace_elan_yenilene_bilmedi_310c74", "Elan yenilənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryInfo = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[6];
  };

  const getConditionInfo = (condId: string) => {
    return conditions.find((c) => c.id === condId) || conditions[2];
  };

  const filteredListings = listings.filter((listing) =>
  listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  listing.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  listing.location_city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = listings.filter((l) => l.status === 'pending').length;
  const activeCount = listings.filter((l) => l.status === 'active').length;
  const rejectedCount = listings.filter((l) => l.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr("adminmarketplace_ikinci_el_bazari_ad9f9f", "İkinci Əl Bazarı")}</h1>
          <p className="text-muted-foreground">{tr("adminmarketplace_elanlari_idare_edin_6f0fd9", "Elanları idarə edin")}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Bazar statusu:</span>
            <Switch
              checked={isMarketplaceEnabled}
              onCheckedChange={toggleMarketplaceStatus} />
            
            <span className={`text-sm font-medium ${isMarketplaceEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
              {isMarketplaceEnabled ? 'Aktiv' : 'Deaktiv'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">{tr("adminmarketplace_gozleyir_9ac18a", "Gözləyir")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Aktiv</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedCount}</p>
                <p className="text-xs text-muted-foreground">{tr("adminmarketplace_redd_edildi_c40149", "Rədd edildi")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{listings.length}</p>
                <p className="text-xs text-muted-foreground">{tr("adminmarketplace_cemi_84214a", "Cəmi")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Axtar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9" />
              
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("adminmarketplace_butun_statuslar_ec4501", "Bütün statuslar")}</SelectItem>
                <SelectItem value="pending">{tr("adminmarketplace_gozleyir_9ac18a", "Gözləyir")}</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="rejected">{tr("adminmarketplace_redd_edildi_c40149", "Rədd edildi")}</SelectItem>
                <SelectItem value="sold">{tr("adminmarketplace_satildi_6a6109", "Satıldı")}</SelectItem>
                <SelectItem value="inactive">Deaktiv</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Kateqoriya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("adminmarketplace_butun_kateqoriyalar_ada67d", "Bütün kateqoriyalar")}</SelectItem>
                {categories.map((cat) =>
                <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Elanlar ({filteredListings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ?
          <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div> :
          filteredListings.length === 0 ?
          <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{tr("adminmarketplace_elan_tapilmadi_2b9b15", "Elan tapılmadı")}</p>
            </div> :

          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Elan</TableHead>
                    <TableHead>Kateqoriya</TableHead>
                    <TableHead>{tr("adminmarketplace_qiymet_54c4f3", "Qiymət")}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tarix</TableHead>
                    <TableHead className="text-end">{tr("adminmarketplace_emeliyyatlar_54d70c", "Əməliyyatlar")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.map((listing) => {
                  const catInfo = getCategoryInfo(listing.category);
                  const statusInfo = statusLabels[listing.status] || statusLabels.inactive;

                  return (
                    <TableRow key={listing.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                              {catInfo.emoji}
                            </div>
                            <div>
                              <p className="font-medium line-clamp-1">{listing.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {listing.location_city || tr("adminmarketplace_seher_gosterilmeyib_6c3dda", "\u015E\u0259h\u0259r g\xF6st\u0259rilm\u0259yib")}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{catInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {listing.is_free ?
                        <span className="text-green-600 font-medium">Pulsuz</span> :

                        <span className="font-medium">{listing.price} ₼</span>
                        }
                        </TableCell>
                        <TableCell>
                          <Badge
                          variant="outline"
                          className={`${statusInfo.color} text-white border-0`}>
                          
                            {statusInfo.icon}
                            <span className="ms-1">{statusInfo.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(listing.created_at), 'dd MMM yyyy', { locale: getCurrentDateLocale() })}
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            {listing.status === 'pending' &&
                          <>
                                <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(listing)}
                              disabled={isSubmitting}>
                              
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedListing(listing);
                                setShowRejectModal(true);
                              }}
                              disabled={isSubmitting}>
                              
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                          }
                            <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedListing(listing);
                              setShowDetailModal(true);
                            }}>
                            
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(listing)}>
                            
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(listing)}>
                            
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>);

                })}
                </TableBody>
              </Table>
            </div>
          }
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("adminmarketplace_elan_detallari_0ae834", "Elan Detalları")}</DialogTitle>
          </DialogHeader>
          
          {selectedListing &&
          <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-6xl">
                {getCategoryInfo(selectedListing.category).emoji}
              </div>
              
              <div>
                <h3 className="text-xl font-bold">{selectedListing.title}</h3>
                <p className="text-muted-foreground mt-1">{selectedListing.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Kateqoriya</p>
                  <p className="font-medium">{getCategoryInfo(selectedListing.category).label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tr("adminmarketplace_veziyyet_f0e993", "Vəziyyət")}</p>
                  <p className="font-medium">{getConditionInfo(selectedListing.condition).label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tr("adminmarketplace_qiymet_54c4f3", "Qiymət")}</p>
                  <p className="font-medium">
                    {selectedListing.is_free ? 'Pulsuz' : `${selectedListing.price} ₼`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tr("adminmarketplace_yas_araligi_2e277e", "Yaş aralığı")}</p>
                  <p className="font-medium">{selectedListing.age_range || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tr("adminmarketplace_seher_5f373c", "Şəhər")}</p>
                  <p className="font-medium">{selectedListing.location_city || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                  variant="outline"
                  className={`${statusLabels[selectedListing.status]?.color || 'bg-gray-500'} text-white border-0`}>
                  
                    {statusLabels[selectedListing.status]?.label || selectedListing.status}
                  </Badge>
                </div>
              </div>
              
              {selectedListing.admin_notes &&
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Admin qeydi:</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{selectedListing.admin_notes}</p>
                </div>
            }
              
              <div className="text-sm text-muted-foreground">
                <p>{tr("adminmarketplace_yaradilma_44cfee", "Yarad\u0131lma:")} {format(new Date(selectedListing.created_at), 'dd MMMM yyyy, HH:mm', { locale: getCurrentDateLocale() })}</p>
                {selectedListing.reviewed_at &&
              <p>{tr("adminmarketplace_baxis_1e7f87", "Bax\u0131\u015F:")} {format(new Date(selectedListing.reviewed_at), 'dd MMMM yyyy, HH:mm', { locale: getCurrentDateLocale() })}</p>
              }
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminmarketplace_elani_redd_et_2c1ddd", "Elanı rədd et")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {tr("adminmarketplace_bu_elani_redd_etmek_istediyini_eaef01", "Bu elan\u0131 r\u0259dd etm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz? S\u0259b\u0259b yaz\u0131n.")}
            </p>
            
            <Textarea
              placeholder={tr("adminmarketplace_redd_sebebi_c8a02b", "Rədd səbəbi...")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3} />
            
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              {tr("adminmarketplace_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || !rejectReason.trim()}>
              
              {isSubmitting ?
              <Loader2 className="w-4 h-4 me-2 animate-spin" /> :

              <X className="w-4 h-4 me-2" />
              }
              {tr("adminmarketplace_redd_et_627e77", "R\u0259dd et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("adminmarketplace_elani_redakte_et_cb4cd1", "Elanı redaktə et")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{tr("adminmarketplace_basliq_e1f6c5", "Başlıq")}</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">{tr("adminmarketplace_tesvir_f85651", "Təsvir")}</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3} />
              
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Kateqoriya</label>
              <Select
                value={editForm.category}
                onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) =>
                  <SelectItem key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">{tr("adminmarketplace_veziyyet_f0e993", "Vəziyyət")}</label>
              <Select
                value={editForm.condition}
                onValueChange={(v) => setEditForm({ ...editForm, condition: v })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((cond) =>
                  <SelectItem key={cond.id} value={cond.id}>
                      {cond.label}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">{tr("adminmarketplace_yas_araligi_2e277e", "Yaş aralığı")}</label>
              <Select
                value={editForm.age_range}
                onValueChange={(v) => setEditForm({ ...editForm, age_range: v })}>
                
                <SelectTrigger>
                  <SelectValue placeholder={tr("adminmarketplace_secin_5c0c8d", "Seçin")} />
                </SelectTrigger>
                <SelectContent>
                  {ageRanges.map((age) =>
                  <SelectItem key={age} value={age}>{age}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">{tr("adminmarketplace_qiymet_54c4f3", "Qiymət")}</label>
              <div className="flex gap-2 items-center">
                <Switch
                  checked={editForm.is_free}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_free: v, price: v ? 0 : editForm.price })} />
                
                <span className="text-sm">{editForm.is_free ? 'Pulsuz' : 'Pullu'}</span>
              </div>
              {!editForm.is_free &&
              <div className="flex items-center gap-2 mt-2">
                  <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                  className="w-24" />
                
                  <span className="text-muted-foreground">₼</span>
                </div>
              }
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">{tr("adminmarketplace_seher_5f373c", "Şəhər")}</label>
              <Input
                value={editForm.location_city}
                onChange={(e) => setEditForm({ ...editForm, location_city: e.target.value })} />
              
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{tr("adminmarketplace_gozleyir_9ac18a", "Gözləyir")}</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="rejected">{tr("adminmarketplace_redd_edildi_c40149", "Rədd edildi")}</SelectItem>
                  <SelectItem value="sold">{tr("adminmarketplace_satildi_6a6109", "Satıldı")}</SelectItem>
                  <SelectItem value="inactive">Deaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              {tr("adminmarketplace_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ?
              <Loader2 className="w-4 h-4 me-2 animate-spin" /> :

              <Check className="w-4 h-4 me-2" />
              }
              Yadda saxla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminMarketplace;