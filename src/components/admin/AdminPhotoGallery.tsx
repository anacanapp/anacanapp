import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Image as ImageIcon, User, Calendar, Palette, Eye, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

interface PhotoRecord {
  id: string;
  user_id: string;
  storage_path: string;
  background_theme: string;
  prompt: string;
  source_image_path: string | null;
  customization: Record<string, any> | null;
  created_at: string;
  userName?: string;
  userEmail?: string;
}

const AdminPhotoGallery = () => {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const PAGE_SIZE = 20;

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const { count } = await supabase.
      from('baby_photos').
      select('*', { count: 'exact', head: true });
      setTotal(count || 0);

      const { data, error } = await supabase.
      from('baby_photos').
      select('*').
      order('created_at', { ascending: false }).
      range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map((p) => p.user_id))];
      const { data: profiles } = await supabase.
      from('profiles').
      select('user_id, name, email').
      in('user_id', userIds.slice(0, 50));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const enriched = (data || []).map((p) => ({
        ...p,
        customization: p.customization as Record<string, any> | null,
        userName: profileMap.get(p.user_id)?.name || tr("adminphotogallery_namelum_134662", "Nam\u0259lum"),
        userEmail: profileMap.get(p.user_id)?.email || ''
      }));

      setPhotos(enriched);
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {fetchPhotos();}, [page]);

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const signAll = async () => {
      const paths = new Set<string>();
      photos.forEach((p) => {
        if (p.storage_path) paths.add(p.storage_path);
        if (p.source_image_path) paths.add(p.source_image_path);
      });
      const entries: Record<string, string> = {};
      await Promise.all(
        Array.from(paths).map(async (path) => {
          const { data } = await supabase.storage.
          from('baby-photos').
          createSignedUrl(path, 60 * 60);
          if (data?.signedUrl) entries[path] = data.signedUrl;
        })
      );
      setSignedUrls(entries);
    };
    if (photos.length > 0) signAll();
  }, [photos]);

  const getPublicUrl = (path: string | null) => {
    if (!path) return null;
    return signedUrls[path] || null;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{tr("adminphotogallery_generasiya_edilmis_fotolar_b3507c", "Generasiya Edilmiş Fotolar")}</h3>
          <span className="text-sm text-muted-foreground">({total} foto)</span>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPhotos} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ?
      <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div> :

      <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((photo) =>
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="cursor-pointer group"
            onClick={() => setSelectedPhoto(photo)}>
            
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="aspect-square relative">
                    <img
                  src={getPublicUrl(photo.storage_path) || ''}
                  alt="Generated"
                  className="w-full h-full object-cover"
                  loading="lazy" />
                
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                      <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white font-medium truncate">{photo.userName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground truncate">{photo.background_theme}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(photo.created_at), 'dd MMM yyyy HH:mm', { locale: getCurrentDateLocale() })}
                    </p>
                  </div>
                </div>
              </motion.div>
          )}
          </div>

          {/* Pagination */}
          {totalPages > 1 &&
        <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                <ChevronLeft className="rtl:rotate-180 w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="rtl:rotate-180 w-4 h-4" />
              </Button>
            </div>
        }
        </>
      }

      {/* Photo Detail Modal */}
      {selectedPhoto &&
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}>
          
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">{tr("adminphotogallery_foto_detallari_8572ca", "Foto Detalları")}</h3>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedPhoto.created_at), 'dd MMMM yyyy, HH:mm', { locale: getCurrentDateLocale() })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPhoto(null)}>✕</Button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Generated Photo */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{tr("adminphotogallery_generasiya_edilmis_0f69a6", "🎨 Generasiya edilmiş")}</p>
                <img
                src={getPublicUrl(selectedPhoto.storage_path) || ''}
                alt="Generated"
                className="w-full rounded-xl border border-border" />
              
              </div>

              {/* Original Photo */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{tr("adminphotogallery_orijinal_sekil_72dccb", "📷 Orijinal şəkil")}</p>
                {selectedPhoto.source_image_path ?
              <img
                src={getPublicUrl(selectedPhoto.source_image_path) || ''}
                alt="Original"
                className="w-full rounded-xl border border-border" /> :


              <div className="aspect-square rounded-xl border border-dashed border-border flex items-center justify-center bg-muted/30">
                    <p className="text-xs text-muted-foreground">{tr("adminphotogallery_orijinal_saxlanmayib_0f1805", "Orijinal saxlanmayıb")}</p>
                  </div>
              }
              </div>
            </div>

            {/* Details */}
            <div className="p-4 border-t border-border space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{tr("adminphotogallery_istifadeci_4eaf5a", "İstifadəçi:")}</span>
                  <p className="font-medium">{selectedPhoto.userName}</p>
                  <p className="text-xs text-muted-foreground">{selectedPhoto.userEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fon:</span>
                  <p className="font-medium">{selectedPhoto.background_theme}</p>
                </div>
              </div>

              {selectedPhoto.customization && Object.keys(selectedPhoto.customization).length > 0 &&
            <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{tr("adminphotogallery_secilmis_parametrler_0f1e7a", "Seçilmiş parametrlər:")}</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedPhoto.customization).map(([key, val]) =>
                <span key={key} className="text-xs bg-muted px-2 py-1 rounded-full">
                        {key}: {String(val)}
                      </span>
                )}
                  </div>
                </div>
            }

              {selectedPhoto.prompt &&
            <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prompt:</p>
                  <p className="text-xs text-foreground bg-muted/50 p-2 rounded-lg max-h-24 overflow-y-auto">
                    {selectedPhoto.prompt}
                  </p>
                </div>
            }
            </div>
          </motion.div>
        </div>
      }
    </div>);

};

export default AdminPhotoGallery;