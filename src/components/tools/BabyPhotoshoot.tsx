import { useState, useEffect, useRef, forwardRef, useMemo, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Sparkles, Loader2, Upload, X,
  Palette, Shirt, Eye, Scissors, Crown, Lock,
  Image as ImageIcon } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { PremiumModal } from '@/components/PremiumModal';
import PhotoGalleryViewer from '@/components/PhotoGalleryViewer';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
import { readImageFileAsDataUrl } from '@/lib/permissions';
import { useIsRtl, rtlX } from '@/lib/rtl';
import { useUserStore } from '@/store/userStore';
import {
  usePhotoshootBackgrounds,
  usePhotoshootEyeColors,
  usePhotoshootHairColors,
  usePhotoshootHairStyles,
  usePhotoshootOutfits,
  usePhotoshootImageStyles } from
'@/hooks/useDynamicTools';

interface BabyPhotoshootProps {
  onBack: () => void;
}

interface GeneratedPhoto {
  id: string;
  url: string;
  theme: string;
  createdAt: string;
}

interface CustomizationOptions {
  gender: "boy" | "girl";
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  outfit: string;
  background: string;
  imageStyle: string;
}

// Fallback data for when DB is loading
const fallbackEyeColors = [
{ color_id: 'keep', color_name: tr("babyphotoshoot_oldugu_kimi_39efcb", "Oldu\u011Fu kimi"), color_name_az: tr("babyphotoshoot_oldugu_kimi_39efcb", "Oldu\u011Fu kimi"), hex_value: 'from-gray-300 to-gray-400' },
{ color_id: 'blue', color_name: 'Blue', color_name_az: 'Mavi', hex_value: 'from-blue-400 to-blue-600' },
{ color_id: 'green', color_name: 'Green', color_name_az: tr("babyphotoshoot_yasil_b257f4", "Ya\u015F\u0131l"), hex_value: 'from-green-400 to-emerald-600' },
{ color_id: 'brown', color_name: 'Brown', color_name_az: tr("babyphotoshoot_qehveyi_b14379", "Q\u0259hv\u0259yi"), hex_value: 'from-amber-600 to-amber-800' }];


const fallbackHairColors = [
{ color_id: 'keep', color_name: 'Keep', color_name_az: tr("babyphotoshoot_oldugu_kimi_39efcb", "Oldu\u011Fu kimi"), hex_value: 'from-gray-300 to-gray-400' },
{ color_id: 'blonde', color_name: 'Blonde', color_name_az: tr("babyphotoshoot_sarisin_4a1ef8", "Sar\u0131\u015F\u0131n"), hex_value: 'from-yellow-300 to-amber-400' },
{ color_id: 'brown', color_name: 'Brown', color_name_az: tr("babyphotoshoot_sabalidi_b768cd", "\u015Eabal\u0131d\u0131"), hex_value: 'from-amber-700 to-amber-900' },
{ color_id: 'black', color_name: 'Black', color_name_az: 'Qara', hex_value: 'from-gray-800 to-black' }];


const fallbackHairStyles = [
{ style_id: 'keep', style_name: 'Keep', style_name_az: tr("babyphotoshoot_oldugu_kimi_39efcb", "Oldu\u011Fu kimi"), emoji: '✨' },
{ style_id: 'curly', style_name: 'Curly', style_name_az: 'Buruq', emoji: '🌀' },
{ style_id: 'straight', style_name: 'Straight', style_name_az: tr("babyphotoshoot_duz_d6038a", "D\xFCz"), emoji: '📏' },
{ style_id: 'wavy', style_name: 'Wavy', style_name_az: tr("babyphotoshoot_dalgali_bc8abd", "Dal\u011Fal\u0131"), emoji: '🌊' }];


// Shared select-pill styles (peach accent)
const optionOn: CSSProperties = { background: 'var(--a-peach-2)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 18px -8px rgba(255, 157, 99, 0.8)' };
const optionOff: CSSProperties = { background: 'var(--a-surface-soft)', color: 'var(--a-ink)', cursor: 'pointer' };

const BabyPhotoshoot = forwardRef<HTMLDivElement, BabyPhotoshootProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('BabyPhotoshoot', 'Tools');
  const isRtl = useIsRtl();

  const [step, setStep] = useState(0);
  const [customization, setCustomization] = useState<CustomizationOptions>({
    gender: 'boy',
    eyeColor: 'keep',
    hairColor: 'keep',
    hairStyle: 'keep',
    outfit: 'keep',
    background: '',
    imageStyle: 'realistic'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [photos, setPhotos] = useState<GeneratedPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPremium, canUseBabyPhotoshoot, freeLimits } = useSubscription();

  // Fetch dynamic data from database
  const { data: dbBackgrounds = [] } = usePhotoshootBackgrounds(customization.gender);
  const { data: dbEyeColors = [] } = usePhotoshootEyeColors();
  const { data: dbHairColors = [] } = usePhotoshootHairColors();
  const { data: dbHairStyles = [] } = usePhotoshootHairStyles();
  const { data: dbOutfits = [] } = usePhotoshootOutfits(customization.gender);
  const { data: dbImageStyles = [] } = usePhotoshootImageStyles();

  const language = useUserStore((s) => s.language);

  // Map DB data or use fallbacks
  const currentBackgrounds = useMemo(() => {
    if (dbBackgrounds.length > 0) {
      // Group backgrounds by category
      const grouped: Record<string, any[]> = {};
      dbBackgrounds.forEach((bg: any) => {
        const cat = bg[`category_name_${language}`] || bg.category_name_az || bg.category_name;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: bg.theme_id,
          name: bg[`theme_name_${language}`] || bg.theme_name_az || bg.theme_name,
          category: cat,
          premium: false, // Can add is_premium to DB if needed
          emoji: bg.theme_emoji || '🎨',
          description: bg.prompt_template || ''
        });
      });
      return Object.values(grouped).flat();
    }
    return []; // Will use fallback in render
  }, [dbBackgrounds, language]);

  // Map Tailwind gradient classes (stored in DB) to actual CSS hex colors for inline styles
  const gradientToHex: Record<string, [string, string]> = {
    'from-gray-300 to-gray-400': ['#d1d5db', '#9ca3af'],
    'from-blue-400 to-blue-600': ['#60a5fa', '#2563eb'],
    'from-green-400 to-emerald-600': ['#4ade80', '#059669'],
    'from-amber-600 to-amber-800': ['#d97706', '#92400e'],
    'from-amber-400 to-green-600': ['#fbbf24', '#16a34a'],
    'from-gray-400 to-slate-600': ['#9ca3af', '#475569'],
    'from-amber-500 to-orange-600': ['#f59e0b', '#ea580c'],
    'from-violet-400 to-purple-600': ['#a78bfa', '#9333ea'],
    'from-yellow-300 to-amber-400': ['#fde047', '#fbbf24'],
    'from-amber-700 to-amber-900': ['#b45309', '#78350f'],
    'from-gray-800 to-black': ['#1f2937', '#000000'],
    'from-orange-600 to-red-700': ['#ea580c', '#b91c1c'],
    'from-orange-300 to-pink-400': ['#fdba74', '#f472b6'],
    'from-gray-100 to-gray-300': ['#f3f4f6', '#d1d5db'],
    'from-red-800 to-amber-900': ['#991b1b', '#78350f'],
    'from-amber-800 to-red-900': ['#92400e', '#7f1d1d']
  };

  const getGradientStyle = (hexValue: string): CSSProperties => {
    const colors = gradientToHex[hexValue];
    if (colors) {
      return { background: `linear-gradient(to right, ${colors[0]}, ${colors[1]})` };
    }
    // Fallback: try to render as-is
    return { background: `linear-gradient(to right, #d1d5db, #9ca3af)` };
  };

  const eyeColorOptions = useMemo(() => {
    const source = dbEyeColors.length > 0 ? dbEyeColors : fallbackEyeColors;
    return source.map((c: any) => ({
      id: c.color_id,
      name: c[`color_name_${language}`] || c.color_name_az || c.color_name,
      hexValue: c.hex_value || 'from-gray-300 to-gray-400'
    }));
  }, [dbEyeColors, language]);

  const hairColorOptions = useMemo(() => {
    const source = dbHairColors.length > 0 ? dbHairColors : fallbackHairColors;
    return source.map((c: any) => ({
      id: c.color_id,
      name: c[`color_name_${language}`] || c.color_name_az || c.color_name,
      hexValue: c.hex_value || 'from-gray-300 to-gray-400'
    }));
  }, [dbHairColors, language]);

  const hairStyleOptions = useMemo(() => {
    if (dbHairStyles.length > 0) {
      return dbHairStyles.map((s) => ({
        id: s.style_id,
        name: s[`style_name_${language}` as keyof typeof s] || s.style_name_az || s.style_name,
        emoji: s.emoji || '✨'
      }));
    }
    return fallbackHairStyles.map((s: any) => ({
      id: s.style_id,
      name: s[`style_name_${language}`] || s.style_name_az || s.style_name,
      emoji: s.emoji
    }));
  }, [dbHairStyles, language]);

  const currentOutfits = useMemo(() => {
    if (dbOutfits.length > 0) {
      return dbOutfits.map((o) => ({
        id: o.outfit_id,
        name: o[`outfit_name_${language}` as keyof typeof o] || o.outfit_name_az || o.outfit_name,
        emoji: o.emoji || '👕',
        premium: false // Can add is_premium to DB if needed
      }));
    }
    return []; // Will use fallback
  }, [dbOutfits, language]);

  const imageStyleOptions = useMemo(() => {
    if (dbImageStyles.length > 0) {
      return dbImageStyles.map((s) => ({
        id: s.style_id,
        name: s[`style_name_${language}` as keyof typeof s] || s.style_name_az || s.style_name,
        emoji: s.emoji || '🎨',
        promptModifier: s.prompt_modifier || ''
      }));
    }
    // Fallback
    return [
    { id: 'realistic', name: 'Realistik', emoji: '📷', promptModifier: 'ultra realistic, photorealistic' },
    { id: '3d_disney', name: '3D Disney', emoji: '🏰', promptModifier: '3D Disney Pixar style' }];

  }, [dbImageStyles, language]);


  useEffect(() => {
    const fetchPhotos = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase.
        from('baby_photos').
        select('*').
        eq('user_id', user.id).
        order('created_at', { ascending: false });

        if (error) throw error;

        const photosWithUrls = await Promise.all(
          (data || []).map(async (photo) => {
            const { data: signed } = await supabase.storage.
            from('baby-photos').
            createSignedUrl(photo.storage_path, 60 * 60 * 24);
            return {
              id: photo.id,
              url: signed?.signedUrl || '',
              theme: photo.background_theme,
              createdAt: photo.created_at
            };
          })
        );

        setPhotos(photosWithUrls);
      } catch (error) {
        console.error('Error fetching photos:', error);
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchPhotos();
  }, [user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: tr("babyphotoshoot_fayl_cox_boyukdur_f5cf61", 'Fayl çox böyükdür'),
        description: tr("babyphotoshoot_maksimum_5mb_sekil_yukleye_bilersiniz_6129b3", 'Maksimum 5MB şəkil yükləyə bilərsiniz'),
        variant: 'destructive'
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: tr("babyphotoshoot_yanlis_fayl_tipi_96b7fc", 'Yanlış fayl tipi'),
        description: tr("babyphotoshoot_yalniz_sekil_fayllari_yukleye_bilersiniz_ed2541", 'Yalnız şəkil faylları yükləyə bilərsiniz'),
        variant: 'destructive'
      });
      return;
    }

    // Yaddaş: ~1280px-ə kiçildilmiş JPEG data URL (çox-MB base64 state-də qalmasın)
    void readImageFileAsDataUrl(file).then((base64) => {
      setSourceImage(base64);
      setSourceImagePreview(base64);
    }).catch(() => {});
  };

  const handleRemoveImage = () => {
    setSourceImage(null);
    setSourceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectBackground = (bgId: string, isPremiumBg: boolean) => {
    if (isPremiumBg && !isPremium) {
      setPremiumFeature(tr("babyphotoshoot_premium_fonlar", 'Premium fonlar'));
      setShowPremiumModal(true);
      return;
    }
    setCustomization((prev) => ({ ...prev, background: bgId }));
  };

  const handleSelectOutfit = (outfitId: string, isPremiumOutfit: boolean) => {
    if (isPremiumOutfit && !isPremium) {
      setPremiumFeature(tr("babyphotoshoot_premium_geyimler_3cf1de", "Premium geyiml\u0259r"));
      setShowPremiumModal(true);
      return;
    }
    setCustomization((prev) => ({ ...prev, outfit: outfitId }));
  };

  const handleGenerate = async () => {
    if (!customization.background) {
      toast({
        title: tr("babyphotoshoot_fon_secin_4449cc", 'Fon seçin'),
        description: tr("babyphotoshoot_zehmet_olmasa_bir_fon_secin_270d75", 'Zəhmət olmasa bir fon seçin'),
        variant: 'destructive'
      });
      return;
    }

    if (!sourceImage) {
      toast({
        title: tr("babyphotoshoot_sekil_yukleyin_1e520a", 'Şəkil yükləyin'),
        description: tr("babyphotoshoot_zehmet_olmasa_korpenin_seklini_yukleyin_cfd8d4", 'Zəhmət olmasa körpənin şəklini yükləyin'),
        variant: 'destructive'
      });
      return;
    }

    // Check free tier limits
    const { allowed, remainingCount } = await canUseBabyPhotoshoot();
    if (!allowed) {
      setPremiumFeature(tr("babyphotoshoot_daha_cox_foto_yaratmaq_a5deeb", "Daha \xE7ox foto yaratmaq"));
      setShowPremiumModal(true);
      return;
    }

    setIsGenerating(true);

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}

    try {
      const { data, error } = await supabase.functions.invoke('generate-baby-photo', {
        body: {
          backgroundTheme: customization.background,
          sourceImageBase64: sourceImage,
          customization: {
            gender: customization.gender,
            eyeColor: customization.eyeColor,
            hairColor: customization.hairColor,
            hairStyle: customization.hairStyle,
            outfit: customization.outfit,
            imageStyle: customization.imageStyle
          }
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.photo) {
        setPhotos((prev) => [data.photo, ...prev]);
        // Open gallery showing new photo
        setGalleryIndex(0);
        setGalleryOpen(true);

        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch {}

        toast({
          title: tr("babyphotoshoot_foto_hazirdir_5183c4", 'Foto hazırdır! 📸'),
          description: tr("babyphotoshoot_yeni_foto_ugurla_yaradildi_849a22", 'Yeni foto uğurla yaradıldı')
        });
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: tr("babyphotoshoot_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        description: error.message || tr("babyphotoshoot_foto_yaradila_bilmedi_9792b9", "Foto yarad\u0131la bilm\u0259di"),
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase.
      from('baby_photos').
      delete().
      eq('id', photoId);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));

      toast({
        title: tr("babyphotoshoot_foto_silindi", 'Foto silindi'),
        description: tr("babyphotoshoot_foto_ugurla_silindi_a3226a", 'Foto uğurla silindi')
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: tr("babyphotoshoot_xeta_3cdbb6", 'Xəta'),
        description: tr("babyphotoshoot_foto_siline_bilmedi_55a923", 'Foto silinə bilmədi'),
        variant: 'destructive'
      });
    }
  };

  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, 2));
    window.scrollTo({ top: 0 });
    document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0 });
  };
  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0 });
    document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0 });
  };

  const canProceed = () => {
    switch (step) {
      case 0:return !!sourceImage && !!customization.gender;
      case 1:return !!customization.background;
      case 2:return !!customization.background && !!sourceImage;
      default:return false;
    }
  };

  const groupedBackgrounds = currentBackgrounds.reduce<Record<string, Array<{id: string;name: string;category: string;premium: boolean;emoji: string;description: string;}>>>((acc, bg) => {
    if (!acc[bg.category]) acc[bg.category] = [];
    acc[bg.category].push(bg);
    return acc;
  }, {});

  const sectionHead = (icon: React.ReactNode, title: string, sub?: string) =>
  <div className="flex items-center gap-2 mb-3">
      <span className="a-list-icon" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-surface-soft)' }}>
        {icon}
      </span>
      <div>
        <h2 className="a-list-title" style={{ margin: 0 }}>{title}</h2>
        {sub && <p className="a-list-sub" style={{ margin: 0 }}>{sub}</p>}
      </div>
    </div>;

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-3">
            
            {/* Image Upload */}
            <div className="a-card">
              {sectionHead(
                <Upload size={15} strokeWidth={2.2} style={{ color: 'var(--a-peach-2)' }} />,
                tr("babyphotoshoot_korpenin_seklini_yukleyin_b1c595", "Körpənin Şəklini Yükləyin"),
                tr("babyphotoshoot_uzu_aydin_gorunen_foto_secin_9b42f9", "Üzü aydın görünən foto seçin")
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden" />
              

              {sourceImagePreview ?
              <div className="relative">
                  <img
                  src={sourceImagePreview}
                  alt={tr("babyphotoshoot_yuklenmis_sekil_641af4", "Yüklənmiş şəkil")}
                  className="w-full h-44 object-cover rounded-2xl" />
                
                  <motion.button
                  onClick={handleRemoveImage}
                  className="absolute top-3 end-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: 'var(--a-pink-2)' }}
                  whileTap={{ scale: 0.9 }}>
                  
                    <X className="w-5 h-5 text-white" />
                  </motion.button>
                </div> :

              <motion.button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-44 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all"
                style={{ border: '2px dashed var(--a-peach-2)', background: 'var(--a-surface-soft)', cursor: 'pointer' }}
                whileTap={{ scale: 0.98 }}>
                
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
                      <Camera className="w-6 h-6" style={{ color: 'var(--a-accent-ink)' }} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("babyphotoshoot_sekil_secin_e3e1f3", "Şəkil seçin")}</p>
                    <p className="text-sm mt-1" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("untranslated_maksimum_5mb_86tog9", "Maksimum 5MB")}</p>
                  </div>
                </motion.button>
              }
            </div>

            {/* Gender Selection */}
            <div className="a-card">
              <h2 className="a-list-title mb-3" style={{ margin: '0 0 12px' }}>{tr("babyphotoshoot_cinsiyyet_secin_186992", "Cinsiyyət Seçin")}</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                { id: 'boy', name: tr("babyphotoshoot_oglan_e9715e", "Oğlan"), emoji: '👦', grad: 'var(--a-grad-blue)', ink: 'var(--a-blue-ink)' },
                { id: 'girl', name: tr("babyphotoshoot_qiz_79bf6b", "Qız"), emoji: '👧', grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)' }].
                map((option) =>
                <motion.button
                  key={option.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, gender: option.id as any, background: '', outfit: 'keep' }))}
                  className="p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all"
                  style={customization.gender === option.id ?
                  { background: option.grad, color: option.ink, boxShadow: 'var(--a-card-shadow)', transform: 'scale(1.03)', cursor: 'pointer' } :
                  optionOff}
                  whileTap={{ scale: 0.95 }}>
                  
                    <span className="text-3xl">{option.emoji}</span>
                    <span className="font-bold text-sm">{option.name}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Free tier info */}
            {!isPremium &&
            <div className="rounded-2xl p-3 flex items-start gap-2" style={{ background: 'var(--a-yellow-1)' }}>
                <Crown className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--a-warn-ink)' }} />
                <div>
                  <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>
                    {tr("babyphotoshoot_pulsuz_ilk_foto_3c7a2d", "Pulsuz: ilk")} {freeLimits.baby_photoshoot_count} {tr("babyphotoshoot_foto_suffix_3c7a2d", "foto")}
                  </p>
                  <p className="text-xs mt-1" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.85 }}>
                    {tr("babyphotoshoot_limitsiz_foto_ucun_premium_a_k_965e5c", "Limitsiz foto \xFC\xE7\xFCn Premium-a ke\xE7in")}
                  </p>
                </div>
              </div>
            }
          </motion.div>);


      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-3">
            
            {/* Image Style Selection */}
            <div className="a-card">
              {sectionHead(
                <Sparkles size={15} strokeWidth={2.2} style={{ color: 'var(--a-lav-2)' }} />,
                tr("babyphotoshoot_sekil_novu_c47221", "Şəkil Növü"),
                tr("babyphotoshoot_foto_stilini_secin_e2d6a1", "Foto stilini seçin")
              )}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {imageStyleOptions.map((style) =>
                <motion.button
                  key={style.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, imageStyle: style.id }))}
                  className="p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all"
                  style={customization.imageStyle === style.id ?
                  { background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)', boxShadow: 'var(--a-card-shadow)', transform: 'scale(1.03)', cursor: 'pointer' } :
                  optionOff}
                  whileTap={{ scale: 0.95 }}>
                  
                    <span className="text-xl sm:text-2xl">{style.emoji}</span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-center leading-tight">{style.name}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Background Selection by Category */}
            {Object.entries(groupedBackgrounds).map(([category, backgrounds]) =>
            <div key={category} className="a-card">
                <h3 className="a-list-title mb-3 flex items-center gap-2" style={{ margin: '0 0 12px' }}>
                  {category === 'Realist' && '📷'}
                  {category === 'Estetik' && '✨'}
                  {category === 'Fantaziya' && '🎭'}
                  {category === tr("babyphotoshoot_movsumi_a19c3b", "M\xF6vs\xFCmi") && '🌈'}
                  {category === 'Bayram' && '🎉'}
                  {category === tr("babyphotoshoot_minimalist_ve_tebii_b2ab8e", "Minimalist v\u0259 T\u0259bii") && '🌿'}
                  {category === tr("babyphotoshoot_nagilvari_868d22", "Na\u011F\u0131lvari") && '📖'}
                  {category === tr("babyphotoshoot_yaradici_28b2b1", "Yarad\u0131c\u0131") && '🎨'}
                  {category === tr("babyphotoshoot_klassik_ve_vintage_994561", "Klassik v\u0259 Vintage") && '🕰️'}
                  {category}
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  {backgrounds.map((bg) =>
                <motion.button
                  key={bg.id}
                  onClick={() => handleSelectBackground(bg.id, bg.premium)}
                  className="relative p-2 rounded-xl flex flex-col items-center gap-0.5 transition-all min-w-0"
                  style={customization.background === bg.id ?
                  { background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)', transform: 'scale(1.03)', cursor: 'pointer' } :
                  optionOff}
                  whileTap={{ scale: 0.95 }}>
                  
                      {bg.premium && !isPremium &&
                  <div className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--a-yellow-2)' }}>
                          <Lock className="w-2.5 h-2.5" style={{ color: '#5a3d00' }} />
                        </div>
                  }
                      <span className="text-lg sm:text-xl">{bg.emoji}</span>
                      <span className="text-[8px] sm:text-[9px] font-semibold text-center leading-tight truncate w-full">{bg.name}</span>
                    </motion.button>
                )}
                </div>
              </div>
            )}
          </motion.div>);


      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-3">
            
            {/* Eye Color */}
            <div className="a-card">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5" style={{ color: 'var(--a-blue-2)' }} />
                <h2 className="a-list-title" style={{ margin: 0 }}>{tr("babyphotoshoot_goz_rengi_8fe8d7", "Göz Rəngi")}</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {eyeColorOptions.map((option) =>
                <motion.button
                  key={option.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, eyeColor: option.id }))}
                  className="flex-shrink-0 p-2 rounded-xl flex flex-col items-center gap-1 transition-all"
                  style={{ cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    <div
                    className="w-8 h-8 rounded-full"
                    style={{
                      ...getGradientStyle(option.hexValue),
                      ...(customization.eyeColor === option.id ? { boxShadow: '0 0 0 2px var(--a-surface), 0 0 0 4px var(--a-peach-2)' } : {})
                    }} />
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--a-ink)' }}>{option.name}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Hair Color */}
            <div className="a-card">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-5 h-5" style={{ color: 'var(--a-yellow-2)' }} />
                <h2 className="a-list-title" style={{ margin: 0 }}>{tr("babyphotoshoot_sac_rengi_68dd12", "Saç Rəngi")}</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {hairColorOptions.map((option) =>
                <motion.button
                  key={option.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, hairColor: option.id }))}
                  className="flex-shrink-0 p-2 rounded-xl flex flex-col items-center gap-1 transition-all"
                  style={{ cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    <div
                    className="w-8 h-8 rounded-full"
                    style={{
                      ...getGradientStyle(option.hexValue),
                      ...(customization.hairColor === option.id ? { boxShadow: '0 0 0 2px var(--a-surface), 0 0 0 4px var(--a-peach-2)' } : {})
                    }} />
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--a-ink)' }}>{option.name}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Hair Style */}
            <div className="a-card">
              <div className="flex items-center gap-2 mb-3">
                <Scissors className="w-5 h-5" style={{ color: 'var(--a-lav-2)' }} />
                <h2 className="a-list-title" style={{ margin: 0 }}>{tr("babyphotoshoot_sac_formasi_5d3388", "Saç Forması")}</h2>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {hairStyleOptions.map((option) =>
                <motion.button
                  key={option.id}
                  onClick={() => setCustomization((prev) => ({ ...prev, hairStyle: option.id }))}
                  className="flex-shrink-0 p-2 rounded-xl flex flex-col items-center gap-0.5 transition-all min-w-[52px]"
                  style={customization.hairStyle === option.id ? optionOn : optionOff}
                  whileTap={{ scale: 0.95 }}>
                  
                    <span className="text-lg">{option.emoji}</span>
                    <span className="text-[8px] font-semibold truncate w-full text-center">{option.name}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Outfit */}
            <div className="a-card">
              <div className="flex items-center gap-2 mb-3">
                <Shirt className="w-5 h-5" style={{ color: 'var(--a-pink-2)' }} />
                <h2 className="a-list-title" style={{ margin: 0 }}>{tr("untranslated_geyim_hftttf", "Geyim")}</h2>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {currentOutfits.map((outfit) =>
                <motion.button
                  key={outfit.id}
                  onClick={() => handleSelectOutfit(outfit.id, outfit.premium)}
                  className="relative p-2 rounded-xl flex flex-col items-center gap-0.5 transition-all min-w-0"
                  style={customization.outfit === outfit.id ? optionOn : optionOff}
                  whileTap={{ scale: 0.95 }}>
                  
                    {outfit.premium && !isPremium &&
                  <div className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-yellow-2)' }}>
                        <Lock className="w-2 h-2" style={{ color: '#5a3d00' }} />
                      </div>
                  }
                    <span className="text-lg">{outfit.emoji}</span>
                    <span className="text-[7px] sm:text-[8px] font-semibold leading-tight text-center truncate w-full">{outfit.name}</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>);


      default:
        return null;
    }
  };

  // Gallery component - always visible
  const renderGallery = () =>
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-6">
    
      <div className="a-section-head">
        <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
          {tr("babyphotoshoot_foto_qalereyasi_0ec00d", "Foto Qalereyas\u0131")}
        </h2>
        {photos.length > 0 ?
      <span className="a-section-link">{photos.length} {tr("babyphotoshoot_foto_suffix_3c7a2d", "foto")}</span> :
      <ImageIcon size={15} style={{ color: 'var(--a-on-bg-soft)' }} />
      }
      </div>

      {loadingPhotos ?
    <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--a-peach-2)' }} />
        </div> :
    photos.length === 0 ?
    <div className="a-card text-center" style={{ padding: '26px 18px' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--a-grad-peach)' }}>
            <Camera className="w-7 h-7" style={{ color: 'var(--a-accent-ink)' }} />
          </div>
          <h3 className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("babyphotoshoot_hele_foto_yoxdur_3ce618", "Hələ foto yoxdur")}</h3>
          <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
            {tr("babyphotoshoot_sekil_yukleyin_ve_foto_yaradin_7b1eb6", "\u015E\u0259kil y\xFCkl\u0259yin v\u0259 foto yarad\u0131n!")}
          </p>
        </div> :

    <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) =>
      <motion.div
        key={photo.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: Math.min(index * 0.03, 0.3) }}
        className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group"
        style={{ boxShadow: 'var(--a-card-shadow)' }}
        onClick={() => {
          setGalleryIndex(index);
          setGalleryOpen(true);
        }}>
        
              <img
          src={photo.url}
          alt="Baby photo"
          className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
      )}
        </div>
    }
    </motion.div>;


  const stepTitles = [tr("babyphotoshoot_sekil_43e2e3", "Şəkil"), tr("babyphotoshoot_fon_e484a2", "Fon"), tr("babyphotoshoot_detallar_8614ad", "Detallar")];

  return (
    <div ref={ref}>
      <ToolPage className="pb-40">
        <ToolHeader
          onBack={onBack}
          eyebrow={tr("babyphotoshoot_ai_ile_sehrli_fotolar_0fce8f", "AI ilə sehrli fotolar")}
          title={tr("babyphotoshoot_korpe_fotosessiyasi_546576", "Körpə Fotosessiyası")} />

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {stepTitles.map((title, index) =>
          <motion.button
            key={index}
            onClick={() => setStep(index)}
            className="flex flex-col items-center gap-0.5"
            style={{ opacity: step === index ? 1 : 0.6, cursor: 'pointer' }}>
            
              <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
              style={
              step === index ?
              { background: 'var(--a-peach-2)', color: '#fff' } :
              step > index ?
              { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' } :
              { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)' }}>
                {index + 1}
              </div>
              <span className="text-[9px] font-semibold" style={{ color: 'var(--a-on-bg)' }}>{title}</span>
            </motion.button>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
        
        {/* Gallery always visible at bottom */}
        {renderGallery()}

        {/* Fixed Bottom Buttons — nav-ın ÜSTÜNDƏ dayanır (altında qalmasın) */}
        <div
          className="fixed start-0 end-0 z-50 px-5 py-3"
          style={{ bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', background: 'var(--a-nav-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--a-line)' }}>
          
          <div className="flex gap-3">
            {step > 0 &&
            <button
              onClick={prevStep}
              className="a-btn-soft flex-1"
              style={{ justifyContent: 'center', height: 52 }}>
              {tr("common_geri", "Geri")}
            </button>
            }
            {step < 2 ?
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="a-cta-btn flex-1"
              style={{ justifyContent: 'center', height: 52, opacity: !canProceed() ? 0.5 : 1 }}>{tr("untranslated_davam_et_rchhd5", "Davam et")}</button> :

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !customization.background || !sourceImage}
              className="a-cta-btn flex-1"
              style={{ justifyContent: 'center', height: 52, fontSize: 14, opacity: isGenerating || !customization.background || !sourceImage ? 0.6 : 1 }}>
              
                {isGenerating ?
              <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{tr("babyphotoshoot_yaradilir_9bb5ed", "Yaradılır...")}</span>
                  </div> :

              <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>{tr("babyphotoshoot_sekil_yarat_6d7c0c", "Şəkil Yarat")}</span>
                  </div>
              }
              </button>
            }
          </div>
        </div>

        {/* Photo Gallery Viewer */}
        <PhotoGalleryViewer
          photos={photos}
          initialIndex={galleryIndex}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onDelete={async (photoId) => {
            await handleDeletePhoto(photoId);
          }} />
        

        {/* Premium Modal */}
        <PremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          feature={premiumFeature} />
        
      </ToolPage>
    </div>);

});

BabyPhotoshoot.displayName = 'BabyPhotoshoot';

export default BabyPhotoshoot;
