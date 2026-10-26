import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { motion } from 'framer-motion';
import {
  Star, Check, X, Trash2, Edit2, Eye, Search,
  MessageSquare, Building2, User, Filter, Save } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
'@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface Review {
  id: string;
  provider_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_active: boolean;
  provider_name?: string;
  user_name?: string;
}

const AdminHealthcareReviews = () => {
    const localize = useAdminLocalize();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(0);

  // Fetch all reviews with provider and user info
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-healthcare-reviews'],
    queryFn: async () => {
      // Fetch reviews
      // DÜZƏLİŞ: limitsiz idi — healthcare_provider_reviews 1000-i keçəndə
      // bu səhifə yalnız ilk 1000 rəyi göstərirdi.
      const reviewsData = await fetchAllRows((from, to) =>
        supabase.from('healthcare_provider_reviews').select('*').order('created_at', { ascending: false }).range(from, to)
      );

      // Fetch providers
      const providerIds = [...new Set((reviewsData || []).map((r) => r.provider_id))];
      const { data: providers } = await supabase.
      from('healthcare_providers').
      select('id, name, name_az').
      in('id', providerIds);

      const providerMap = new Map(providers?.map((p) => [p.id, localize(p, 'name')]) || []);

      // Fetch user profiles
      const userIds = [...new Set((reviewsData || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase.
      from('profiles').
      select('user_id, name').
      in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);

      return (reviewsData || []).map((review) => ({
        ...review,
        provider_name: providerMap.get(review.provider_id) || tr("adminhealthcarereviews_namelum_134662", "Nam\u0259lum"),
        user_name: profileMap.get(review.user_id) || tr("adminhealthcarereviews_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")
      })) as Review[];
    }
  });

  // Approve review
  const approveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.
      from('healthcare_provider_reviews').
      update({ is_active: true }).
      eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-healthcare-reviews'] });
      toast.success(tr("adminhealthcarereviews_rey_tesdiqlendi_7080f5", "R\u0259y t\u0259sdiql\u0259ndi"));
    },
    onError: () => toast.error(tr("adminhealthcarereviews_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  // Reject/Hide review
  const rejectMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.
      from('healthcare_provider_reviews').
      update({ is_active: false }).
      eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-healthcare-reviews'] });
      toast.success(tr("adminhealthcarereviews_rey_gizledildi_1b68f6", "R\u0259y gizl\u0259dildi"));
    },
    onError: () => toast.error(tr("adminhealthcarereviews_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  // Delete review
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.
      from('healthcare_provider_reviews').
      delete().
      eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-healthcare-reviews'] });
      toast.success(tr("adminhealthcarereviews_rey_silindi_833505", "R\u0259y silindi"));
    },
    onError: () => toast.error(tr("adminhealthcarereviews_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  // Update review
  const updateMutation = useMutation({
    mutationFn: async ({ id, rating, comment }: {id: string;rating: number;comment: string;}) => {
      const { error } = await supabase.
      from('healthcare_provider_reviews').
      update({
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString()
      }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-healthcare-reviews'] });
      setEditingReview(null);
      toast.success(tr("adminhealthcarereviews_rey_yenilendi_f1e45d", "R\u0259y yenil\u0259ndi"));
    },
    onError: () => toast.error(tr("adminhealthcarereviews_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  // Filter reviews
  const filteredReviews = reviews.filter((review) => {
    const matchesSearch =
    (review.provider_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (review.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (review.comment || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
    statusFilter === 'all' ||
    statusFilter === 'active' && review.is_active ||
    statusFilter === 'hidden' && !review.is_active;

    return matchesSearch && matchesStatus;
  });

  const openEditDialog = (review: Review) => {
    setEditingReview(review);
    setEditComment(review.comment || '');
    setEditRating(review.rating);
  };

  const handleSaveEdit = () => {
    if (!editingReview) return;
    updateMutation.mutate({
      id: editingReview.id,
      rating: editRating,
      comment: editComment
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminhealthcarereviews_hekim_klinika_reyleri_95060e", "Həkim/Klinika Rəyləri")}</h1>
          <p className="text-muted-foreground">{tr("adminhealthcarereviews_istifadeci_reylerini_idare_edin_a41371", "İstifadəçi rəylərini idarə edin")}</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {reviews.length} {tr("adminhealthcarereviews_rey_bd4873", "r\u0259y")}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminhealthcarereviews_axtar_hekim_istifadeci_rey_7de668", "Axtar (həkim, istifadəçi, rəy)...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10" />
          
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 me-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("adminhealthcarereviews_hamisi_c73c4d", "Hamısı")}</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="hidden">Gizli</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      {isLoading ?
      <div className="space-y-4">
          {[1, 2, 3].map((i) =>
        <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/4 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                </div>
              </div>
            </div>
        )}
        </div> :
      filteredReviews.length === 0 ?
      <div className="text-center py-12 bg-card rounded-xl border border-border">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{tr("adminhealthcarereviews_hec_bir_rey_tapilmadi_ac307a", "Heç bir rəy tapılmadı")}</p>
        </div> :

      <div className="space-y-4">
          {filteredReviews.map((review, index) =>
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`bg-card rounded-xl p-4 border transition-colors ${
          review.is_active ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`
          }>
          
              <div className="flex flex-col sm:flex-row gap-4">
                {/* User Info */}
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{review.user_name}</span>
                      <Badge variant={review.is_active ? 'default' : 'destructive'} className="text-xs">
                        {review.is_active ? 'Aktiv' : 'Gizli'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                      <Building2 className="w-3 h-3" />
                      <span>{review.provider_name}</span>
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) =>
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                    star <= review.rating ?
                    'fill-amber-400 text-amber-400' :
                    'text-muted-foreground/30'}`
                    } />

                  )}
                      <span className="text-sm ms-1">{review.rating}/5</span>
                    </div>

                    {review.comment &&
                <p className="text-sm mt-2 text-muted-foreground">{review.comment}</p>
                }

                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: getCurrentDateLocale() })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col gap-2 shrink-0">
                  {!review.is_active ?
              <Button
                size="sm"
                variant="outline"
                onClick={() => approveMutation.mutate(review.id)}
                className="text-green-600 border-green-600/30 hover:bg-green-600/10">
                
                      <Check className="w-4 h-4 me-1" />
                      {tr("adminhealthcarereviews_tesdiqle_4ffd4c", "T\u0259sdiql\u0259")}
                    </Button> :

              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate(review.id)}
                className="text-amber-600 border-amber-600/30 hover:bg-amber-600/10">
                
                      <Eye className="w-4 h-4 me-1" />
                      {tr("adminhealthcarereviews_gizle_ea86e3", "Gizl\u0259")}
                    </Button>
              }
                  
                  <Button
                size="sm"
                variant="outline"
                onClick={() => openEditDialog(review)}>
                
                    <Edit2 className="w-4 h-4 me-1" />
                    {tr("adminhealthcarereviews_redakte_d53ba7", "Redakt\u0259")}
                  </Button>
                  
                  <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm(tr("adminhealthcarereviews_bu_reyi_silmek_istediyinize_em_665cd0", "Bu r\u0259yi silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
                    deleteMutation.mutate(review.id);
                  }
                }}
                className="text-destructive border-destructive/30 hover:bg-destructive/10">
                
                    <Trash2 className="w-4 h-4 me-1" />
                    Sil
                  </Button>
                </div>
              </div>
            </motion.div>
        )}
        </div>
      }

      {/* Edit Dialog */}
      <Dialog open={!!editingReview} onOpenChange={() => setEditingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminhealthcarereviews_reyi_redakte_et_6a10e1", "Rəyi Redaktə Et")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Reytinq</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) =>
                <button
                  key={star}
                  onClick={() => setEditRating(star)}
                  className="p-1 transition-transform hover:scale-110">
                  
                    <Star
                    className={`w-7 h-7 transition-colors ${
                    star <= editRating ?
                    'fill-amber-400 text-amber-400' :
                    'text-muted-foreground/30'}`
                    } />
                  
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">{tr("adminhealthcarereviews_rey_metni_c32510", "Rəy mətni")}</p>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="w-full p-3 rounded-xl bg-muted border-0 text-sm resize-none h-32 outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={tr("adminhealthcarereviews_rey_metni_45a205", "Rəy mətni...")} />
              
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReview(null)}>
              {tr("adminhealthcarereviews_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 me-2" />
              Yadda saxla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminHealthcareReviews;