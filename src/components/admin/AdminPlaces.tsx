import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { MapPin, Trash2, Check, AlertTriangle, Star, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { toast } from 'sonner';
import AdminUsageStats from './AdminUsageStats';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminPlaces = () => {
    const localize = useAdminLocalize();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const queryClient = useQueryClient();

  // Fetch places
  const { data: places = [], isLoading } = useQuery({
    queryKey: ['admin-places', filter],
    queryFn: async () => {
      // DÜZƏLİŞ: limitsiz idi — mom_friendly_places 1000-i keçəndə bu tab
      // yalnız ilk 1000 məkanı göstərirdi.
      return await fetchAllRows((from, to) => {
        let query = supabase.
        from('mom_friendly_places').
        select('*').
        order('created_at', { ascending: false });

        if (filter === 'pending') query = query.eq('is_verified', false);else
        if (filter === 'approved') query = query.eq('is_verified', true);

        return query.range(from, to);
      });
    }
  });

  // Fetch all reviews (including unverified)
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['admin-place-reviews'],
    queryFn: async () => {
      return await fetchAllRows((from, to) =>
        supabase.
        from('place_reviews').
        select('*, mom_friendly_places(name, name_az)').
        order('created_at', { ascending: false }).
        range(from, to)
      );
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      // `is_active` real görünürlük qapısıdır (canlı sorğu yalnız bunu
      // yoxlayır) — əvvəllər yalnız `is_verified` yazılırdı ki, heç bir
      // real sorğu tərəfindən oxunmurdu, "Təsdiqlə" düyməsi kosmetik idi.
      const { error } = await supabase.
      from('mom_friendly_places').
      update({ is_verified: true, is_active: true }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-places'] });
      queryClient.invalidateQueries({ queryKey: ['mom-friendly-places'] });
      toast.success(tr("adminplaces_mekan_tesdiqlendi_aedeb2", "M\u0259kan t\u0259sdiql\u0259ndi"));
    },
    onError: () => toast.error(tr("adminplaces_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete child records first
      await supabase.from('place_verifications').delete().eq('place_id', id);
      await supabase.from('place_reviews').delete().eq('place_id', id);
      // Then delete the place
      const { error } = await supabase.
      from('mom_friendly_places').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-places'] });
      toast.success(tr("adminplaces_mekan_silindi_9b1c9c", "M\u0259kan silindi"));
    },
    onError: () => toast.error(tr("adminplaces_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  const approveReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('place_reviews').
      update({ is_verified: true }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-place-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['mom-friendly-places'] });
      toast.success(tr("adminplaces_rey_tesdiqlendi_7080f5", "R\u0259y t\u0259sdiql\u0259ndi"));
    },
    onError: () => toast.error(tr("adminplaces_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('place_reviews').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-place-reviews'] });
      toast.success(tr("adminplaces_rey_silindi_833505", "R\u0259y silindi"));
    },
    onError: () => toast.error(tr("adminplaces_xeta_bas_verdi_f22fba", "Xəta baş verdi"))
  });

  const pendingPlaces = places.filter((p) => !p.is_verified).length;
  const pendingReviews = reviews.filter((r: any) => !r.is_verified).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cafe':return '☕';
      case 'restaurant':return '🍽️';
      case 'park':return '🌳';
      case 'mall':return '🛍️';
      case 'hospital':return '🏥';
      case 'pharmacy':return '💊';
      case 'playground':return '🎮';
      default:return '📍';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          {tr("adminplaces_ana_dostu_mekanlar_4153ec", "Ana Dostu M\u0259kanlar")}
        </h2>
        <p className="text-sm text-muted-foreground">{tr("adminplaces_mekanlar_ve_reylerin_idare_edilmesi_738512", "Məkanlar və rəylərin idarə edilməsi")}</p>
      </div>

      <Tabs defaultValue="places">
        <TabsList>
          <TabsTrigger value="places" className="relative">
            {tr("adminplaces_mekanlar_ac212e", "M\u0259kanlar")}
            {pendingPlaces > 0 &&
            <span className="ms-2 px-1.5 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full">
                {pendingPlaces}
              </span>
            }
          </TabsTrigger>
          <TabsTrigger value="reviews" className="relative">
            {tr("adminplaces_reyler_032ec8", "R\u0259yl\u0259r")}
            {pendingReviews > 0 &&
            <span className="ms-2 px-1.5 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full">
                {pendingReviews}
              </span>
            }
          </TabsTrigger>
        </TabsList>

        {/* Places Tab */}
        <TabsContent value="places" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
            { label: tr("adminplaces_cemi_84214a", "Cəmi"), count: places.length, f: 'all' as const, color: '' },
            { label: tr("adminplaces_gozleyen_5cab14", "Gözləyən"), count: pendingPlaces, f: 'pending' as const, color: 'text-orange-500' },
            { label: tr("adminplaces_tesdiqlenmis_cf7b5f", "Təsdiqlənmiş"), count: places.filter((p) => p.is_verified).length, f: 'approved' as const, color: 'text-green-500' }].
            map((s) =>
            <Card key={s.f} className="cursor-pointer" onClick={() => setFilter(s.f)}>
                <CardContent className="p-4">
                  <div className={`text-2xl font-bold ${filter === s.f ? 'text-primary' : s.color}`}>{s.count}</div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {isLoading ?
          <div className="text-center py-8">{tr("adminplaces_yuklenir_5557de", "Yüklənir...")}</div> :
          places.length === 0 ?
          <Card><CardContent className="p-8 text-center text-muted-foreground">{tr("adminplaces_bu_filtrde_hec_bir_mekan_yoxdur_5e134d", "Bu filtrdə heç bir məkan yoxdur")}</CardContent></Card> :

          <div className="space-y-3">
              {places.map((place, index) =>
            <motion.div key={place.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-2xl shrink-0">
                            {getCategoryIcon(place.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold">{place.name}</h3>
                              {place.is_verified ?
                          <Badge className="bg-green-500">{tr("adminplaces_tesdiqlenmis_cf7b5f", "Təsdiqlənmiş")}</Badge> :

                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                                  <AlertTriangle className="w-3 h-3 me-1" />{tr("adminplaces_gozleyir_9ac18a", "G\xF6zl\u0259yir")}
                                </Badge>
                          }
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{place.address}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {place.has_breastfeeding_room && <Badge variant="secondary" className="text-xs">{tr("adminplaces_emizdirme_f8d12a", "🤱 Əmizdirmə")}</Badge>}
                              {place.has_changing_table && <Badge variant="secondary" className="text-xs">{tr("adminplaces_deyisdirme_2a0b7d", "👶 Dəyişdirmə")}</Badge>}
                              {place.has_stroller_access && <Badge variant="secondary" className="text-xs">🚼 Araba</Badge>}
                              {place.has_kids_menu && <Badge variant="secondary" className="text-xs">{tr("adminplaces_usaq_menyusu_fa5c7a", "🍽️ Uşaq menyusu")}</Badge>}
                              {place.has_play_area && <Badge variant="secondary" className="text-xs">{tr("adminplaces_oyun_sahesi_6ce71d", "🎮 Oyun sahəsi")}</Badge>}
                            </div>
                            {place.avg_rating > 0 &&
                        <div className="flex items-center gap-1 mt-2">
                                <span className="text-yellow-500">★</span>
                                <span className="text-sm font-medium">{place.avg_rating}</span>
                                <span className="text-xs text-muted-foreground">({place.review_count} {tr("adminplaces_rey_f2285f", "r\u0259y)")}</span>
                              </div>
                        }
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!place.is_verified &&
                      <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => approveMutation.mutate(place.id)}>
                              <Check className="w-4 h-4 me-1" />{tr("adminplaces_tesdiqle_4ffd4c", "T\u0259sdiql\u0259")}
                            </Button>
                      }
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(place.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
            )}
            </div>
          }
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-500">{pendingReviews}</div>
                <p className="text-sm text-muted-foreground">{tr("adminplaces_gozleyen_rey_c37f08", "Gözləyən rəy")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">{reviews.filter((r: any) => r.is_verified).length}</div>
                <p className="text-sm text-muted-foreground">{tr("adminplaces_tesdiqlenmis_rey_bfd7c5", "Təsdiqlənmiş rəy")}</p>
              </CardContent>
            </Card>
          </div>

          {reviewsLoading ?
          <div className="text-center py-8">{tr("adminplaces_yuklenir_5557de", "Yüklənir...")}</div> :
          reviews.length === 0 ?
          <Card><CardContent className="p-8 text-center text-muted-foreground">{tr("adminplaces_hele_rey_yoxdur_1f617a", "Hələ rəy yoxdur")}</CardContent></Card> :

          <div className="space-y-3">
              {reviews.map((review: any, index: number) =>
            <motion.div key={review.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-sm">{review.mom_friendly_places?.name_az || review.mom_friendly_places?.name || tr("adminplaces_namelum_mekan_dda885", "Nam\u0259lum m\u0259kan")}</h3>
                            {review.is_verified ?
                        <Badge className="bg-green-500 text-xs">{tr("adminplaces_tesdiqlenmis_cf7b5f", "Təsdiqlənmiş")}</Badge> :

                        <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">
                                <AlertTriangle className="w-3 h-3 me-1" />{tr("adminplaces_gozleyir_9ac18a", "G\xF6zl\u0259yir")}
                              </Badge>
                        }
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) =>
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`} />
                        )}
                          </div>
                          {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{new Date(review.created_at).toLocaleDateString('az-AZ')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!review.is_verified &&
                      <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => approveReviewMutation.mutate(review.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                      }
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteReviewMutation.mutate(review.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
            )}
            </div>
          }
        </TabsContent>
      </Tabs>

      <AdminUsageStats
        eventNames={['place_viewed']}
        title={tr("adminplaces_mekan_istifade_statistikasi_f80b0c", "📍 Məkan İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

export default AdminPlaces;