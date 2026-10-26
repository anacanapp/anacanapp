import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Upload, Trash2, Image, RefreshCw, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePregnancyContentAdmin } from '@/hooks/usePregnancyContent';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface FruitImage {
  id: string;
  week_number: number;
  fruit_name: string;
  fruit_name_az: string;
  emoji: string;
  image_url: string | null;
  length_cm: number;
  weight_g: number;
}

interface WeekFruitData {
  week: number;
  fruits: string[];
  emoji: string;
  imageUrl: string | null;
}

const AdminFruitImages = () => {
    const localize = useAdminLocalize();
  const [fruitImages, setFruitImages] = useState<FruitImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);
  const { toast } = useToast();
  const { content: pregnancyContent } = usePregnancyContentAdmin();

  // Group pregnancy content by week and get unique fruit names
  const getWeekFruits = (): WeekFruitData[] => {
    const weekMap = new Map<number, Set<string>>();

    pregnancyContent.forEach((item) => {
      if (item.week_number && item.baby_size_fruit) {
        if (!weekMap.has(item.week_number)) {
          weekMap.set(item.week_number, new Set());
        }
        weekMap.get(item.week_number)!.add(item.baby_size_fruit);
      }
    });

    const weeks: WeekFruitData[] = [];
    for (let week = 1; week <= 42; week++) {
      const fruits = weekMap.get(week);
      const imageData = fruitImages.find((f) => f.week_number === week);

      weeks.push({
        week,
        fruits: fruits ? Array.from(fruits) : [],
        emoji: imageData?.emoji || '🍎',
        imageUrl: imageData?.image_url || null
      });
    }

    return weeks;
  };

  useEffect(() => {
    fetchFruitImages();
  }, []);

  const fetchFruitImages = async () => {
    try {
      const { data, error } = await supabase.
      from('fruit_size_images').
      select('*').
      order('week_number');

      if (error) throw error;
      setFruitImages(data || []);
    } catch (error) {
      console.error('Error fetching fruit images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (weekNumber: number, file: File) => {
    setUploading(weekNumber);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `fruit-week-${weekNumber}.${fileExt}`;
      const filePath = `fruit-sizes/${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from('assets').
      upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.
      from('assets').
      getPublicUrl(filePath);

      const weekFruits = pregnancyContent.
      filter((item) => item.week_number === weekNumber && item.baby_size_fruit).
      map((item) => item.baby_size_fruit!);
      const fruitName = weekFruits[0] || tr("adminfruitimages_meyve_50ca17", "Meyv\u0259");

      const { error: dbError } = await supabase.
      from('fruit_size_images').
      upsert({
        week_number: weekNumber,
        fruit_name: fruitName,
        fruit_name_az: fruitName,
        emoji: '🍎',
        image_url: urlData.publicUrl,
        length_cm: 0,
        weight_g: 0
      }, { onConflict: 'week_number' });

      if (dbError) throw dbError;

      toast({
        title: tr("adminfruitimages_ugurlu_5c0191", "Uğurlu!"),
        description: `Həftə ${weekNumber} üçün şəkil yükləndi`
      });

      fetchFruitImages();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: tr("adminfruitimages_xeta_3cdbb6", "Xəta"),
        description: error.message || tr("adminfruitimages_sekil_yuklene_bilmedi_3c275f", "\u015E\u0259kil y\xFCkl\u0259n\u0259 bilm\u0259di"),
        variant: 'destructive'
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteImage = async (weekNumber: number) => {
    try {
      const { error } = await supabase.
      from('fruit_size_images').
      update({ image_url: null }).
      eq('week_number', weekNumber);

      if (error) throw error;

      toast({
        title: 'Silindi',
        description: tr("adminfruitimages_sekil_silindi_emoji_gosterilecek_383b6a", "Şəkil silindi, emoji göstəriləcək")
      });

      fetchFruitImages();
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast({
        title: tr("adminfruitimages_xeta_3cdbb6", "Xəta"),
        description: tr("adminfruitimages_sekil_siline_bilmedi_e563ea", "Şəkil silinə bilmədi"),
        variant: 'destructive'
      });
    }
  };

  const weekFruits = getWeekFruits();
  const activeWeeks = weekFruits.filter((w) => w.fruits.length > 0 || w.imageUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminfruitimages_korpe_olcusu_sekilleri_103ec8", "Körpə Ölçüsü Şəkilləri")}</h1>
          <p className="text-muted-foreground">
            {tr("adminfruitimages_hamilelik_kontentindeki_meyve__3105b1", "Hamil\u0259lik Kontentind\u0259ki meyv\u0259 adlar\u0131na uy\u011Fun \u015F\u0259kill\u0259r y\xFCkl\u0259yin.")}
          </p>
        </div>
        <Button variant="outline" onClick={fetchFruitImages} disabled={loading}>
          <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
          {tr("adminfruitimages_yenile_570ce2", "Yenil\u0259")}
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">{tr("adminfruitimages_melumat_menbeyi_afbb10", "Məlumat mənbəyi")}</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {tr("adminfruitimages_meyve_adlari_817c44", "Meyv\u0259 adlar\u0131")} <strong>{tr("adminfruitimages_hamilelik_kontenti_05bc13", "\"Hamiləlik Kontenti\"")}</strong>{tr("adminfruitimages_bolmesindeki_a4ae5e", "bölməsindəki")}<strong>{tr("adminfruitimages_meyve_olcusu_7b1bfe", "\"Meyvə ölçüsü\"")}</strong> {tr("adminfruitimages_sutunundan_gelir_burada_yalniz_7bcd50", "s\xFCtunundan g\u0259lir. \n              Burada yaln\u0131z \u015F\u0259kill\u0259r idar\u0259 olunur.")}
            
            </p>
          </div>
        </div>
      </Card>

      {loading ?
      <Card className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </Card> :
      activeWeeks.length === 0 ?
      <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {tr("adminfruitimages_evvelce_hamilelik_kontenti_bol_73150c", "\u018Fvv\u0259lc\u0259 \"Hamil\u0259lik Kontenti\" b\xF6lm\u0259sin\u0259 ke\xE7ib m\u0259lumat \u0259lav\u0259 edin.")}
          </p>
        </Card> :

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {activeWeeks.map((weekData, index) => {
          const isUploading = uploading === weekData.week;

          return (
            <motion.div
              key={weekData.week}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}>
              
                <Card className="p-3 text-center relative overflow-hidden">
                  <div className="absolute top-1.5 end-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                    {weekData.week}{tr("adminfruitimages_hefte_459cfe", ". h\u0259ft\u0259")}
                  </div>

                  <div className="w-16 h-16 mx-auto mb-2 mt-4 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 dark:from-pink-950/30 dark:to-rose-950/30 flex items-center justify-center overflow-hidden">
                    {weekData.imageUrl ?
                  <img
                    src={weekData.imageUrl}
                    alt={weekData.fruits[0] || tr("adminfruitimages_meyve_50ca17", "Meyv\u0259")}
                    className="w-full h-full object-cover" /> :


                  <span className="text-3xl">{weekData.emoji}</span>
                  }
                  </div>

                  <div className="mb-2">
                    {weekData.fruits.length > 0 ?
                  <p className="font-medium text-foreground text-xs truncate" title={weekData.fruits.join(', ')}>
                        {weekData.fruits[0]}
                        {weekData.fruits.length > 1 &&
                    <span className="text-muted-foreground"> +{weekData.fruits.length - 1}</span>
                    }
                      </p> :

                  <p className="text-xs text-muted-foreground italic">{tr("adminfruitimages_meyve_teyin_edilmeyib_5b0950", "Meyvə təyin edilməyib")}</p>
                  }
                  </div>

                  <div className="flex gap-1 justify-center">
                    <label className="cursor-pointer">
                      <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(weekData.week, file);
                      }}
                      disabled={isUploading} />
                    
                      <Button size="sm" variant="outline" asChild disabled={isUploading} className="h-7 w-7 p-0">
                        <span>
                          {isUploading ?
                        <RefreshCw className="w-3 h-3 animate-spin" /> :

                        <Upload className="w-3 h-3" />
                        }
                        </span>
                      </Button>
                    </label>
                    
                    {weekData.imageUrl &&
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteImage(weekData.week)}
                    className="text-destructive hover:text-destructive h-7 w-7 p-0">
                    
                        <Trash2 className="w-3 h-3" />
                      </Button>
                  }
                  </div>
                </Card>
              </motion.div>);

        })}
        </div>
      }

      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Image className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-foreground">{tr("adminfruitimages_sekil_formati_tovsiyesi_7c1b4d", "Şəkil formatı tövsiyəsi")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tr("adminfruitimages_png_ve_ya_webp_formatinda_200x_a5890c", "PNG v\u0259 ya WebP format\u0131nda, 200x200px \xF6l\xE7\xFCs\xFCnd\u0259 \u015F\u0259ffaf fon il\u0259 \u015F\u0259kill\u0259r t\xF6vsiy\u0259 olunur.")}
            </p>
          </div>
        </div>
      </Card>
    </div>);

};

export default AdminFruitImages;