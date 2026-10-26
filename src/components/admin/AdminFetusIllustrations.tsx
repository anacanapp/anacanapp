import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Baby, Upload, Trash2, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useAllFetusIllustrations,
  useUpsertFetusIllustration,
  useDeleteFetusIllustration,
} from '@/hooks/useFetusIllustrations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocalizedInput } from './ui/LocalizedInput';
import { LocalizedTextarea } from './ui/LocalizedTextarea';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';

// Hamiləlik (bump) rejimində 9 aylıq fetus şəkillərini idarə edir.
// Şəkillər bazadan gəlir — dəyişiklik tətbiq yeniləmədən bütün
// cihazlarda görünür (cihazda ~30 dəqiqəlik keş var).
const AdminFetusIllustrations = () => {
  const localize = useAdminLocalize();
  const { toast } = useToast();
  const { data: illustrations = [], isLoading } = useAllFetusIllustrations();
  const upsertMutation = useUpsertFetusIllustration();
  const deleteMutation = useDeleteFetusIllustration();

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    title_az: '',
    description_az: '',
    image_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const allMonths = Array.from({ length: 9 }, (_, i) => i + 1);

  const getIllustrationForMonth = (month: number) =>
    illustrations.find((i) => i.month_number === month);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, month: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `fetus-month-${month}-${Date.now()}.${fileExt}`;
      const filePath = `fetus-illustrations/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
      toast({ title: tr('adminbabyillustrations_sekil_yuklendi_0c2f85', 'Şəkil yükləndi!') });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: tr('adminbabyillustrations_yukleme_xetasi_eebca5', 'Yükləmə xətası'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedMonth || !formData.image_url) {
      toast({ title: tr('adminbabyillustrations_sekil_teleb_olunur_7f45a4', 'Şəkil tələb olunur'), variant: 'destructive' });
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        ...formData,
        month_number: selectedMonth,
        image_url: formData.image_url,
        title_az: formData.title_az || null,
        description_az: formData.description_az || null,
      });

      toast({ title: tr('adminbabyillustrations_yadda_saxlanildi_4472d8', 'Yadda saxlanıldı!') });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: tr('adminbabyillustrations_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr('adminbabyillustrations_silmek_istediyinize_eminsiniz_09658f', 'Silmək istədiyinizə əminsiniz?'))) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Silindi!' });
    } catch (error) {
      toast({ title: tr('adminbabyillustrations_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  const openEditDialog = (month: number) => {
    const existing = getIllustrationForMonth(month);
    setSelectedMonth(month);
    setFormData({
      ...existing,
      title_az: existing?.title_az || '',
      description_az: existing?.description_az || '',
      image_url: existing?.image_url || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedMonth(null);
    setFormData({ title_az: '', description_az: '', image_url: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Baby className="w-6 h-6 text-primary" />
            {tr('adminfetus_basliq_7f2a01', 'Fetus Şəkilləri')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {tr('adminfetus_aciqlama_3d1b02', 'Hamiləlik bölməsində aya uyğun fetus şəkillərini idarə edin (1-9 ay). Dəyişikliklər tətbiq yeniləmədən bütün cihazlarda görünür.')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{illustrations.length}</div>
            <p className="text-sm text-muted-foreground">{tr('adminbabyillustrations_yuklenmis_sekil_641af4', 'Yüklənmiş şəkil')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{9 - illustrations.length}</div>
            <p className="text-sm text-muted-foreground">{tr('adminbabyillustrations_bos_ay_66cb4e', 'Boş ay')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{Math.round(illustrations.length / 9 * 100)}%</div>
            <p className="text-sm text-muted-foreground">Tamamlanma</p>
          </CardContent>
        </Card>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        {allMonths.map((month) => {
          const illustration = getIllustrationForMonth(month);
          return (
            <motion.button
              key={month}
              onClick={() => openEditDialog(month)}
              className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                illustration
                  ? 'border-primary bg-primary/5'
                  : 'border-dashed border-muted-foreground/30 bg-muted/30 hover:border-primary/50'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {illustration ? (
                <img
                  src={illustration.image_url}
                  alt={`${month} ay`}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <Plus className="w-5 h-5 text-muted-foreground" />
              )}
              <span className={`text-xs font-medium ${illustration ? 'text-primary' : 'text-muted-foreground'}`}>
                {month} {tr('adminfetus_ay_label_9c4d03', 'ay')}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-primary" />
              {selectedMonth} {tr('adminfetus_ayliq_fetus_5e6f04', 'Aylıq Fetus')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Preview / Upload */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center">
              {formData.image_url ? (
                <div className="relative">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-32 h-32 object-contain mx-auto"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-0 end-0"
                    onClick={() => setFormData((prev) => ({ ...prev, image_url: '' }))}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {uploading
                        ? tr('adminbabyillustrations_yuklenir_5557de', 'Yüklənir...')
                        : tr('adminbabyillustrations_sekil_yukleyin_1e520a', 'Şəkil yükləyin')}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => selectedMonth && handleFileUpload(e, selectedMonth)}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">{tr('adminbabyillustrations_basliq_az_3e294a', 'Başlıq (AZ)')}</label>
                <LocalizedInput formData={formData} setFormData={setFormData} field="title" label={`${selectedMonth} aylıq fetus`} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{tr('adminbabyillustrations_aciqlama_az_86f364', 'Açıqlama (AZ)')}</label>
                <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Bu ayda fetusun xüsusiyyətləri..." rows={3} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {getIllustrationForMonth(selectedMonth || 0) && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const ill = getIllustrationForMonth(selectedMonth || 0);
                    if (ill) handleDelete(ill.id);
                    setDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 me-2" />
                  Sil
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!formData.image_url || upsertMutation.isPending}
                className="flex-1"
              >
                <Save className="w-4 h-4 me-2" />
                Yadda saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFetusIllustrations;
