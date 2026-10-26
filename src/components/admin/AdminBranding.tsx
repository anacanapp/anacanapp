import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Upload, Image, Smartphone, RefreshCw, X, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAppBranding, useUpdateBranding } from '@/hooks/useAppBranding';
import { supabase } from '@/integrations/supabase/client';

const AdminBranding = () => {
  const { data: branding, isLoading, refetch } = useAppBranding();
  const updateBranding = useUpdateBranding();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (key: string, file: File) => {
    if (!file) return;

    setUploading(key);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `branding/${key}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.
      from('assets').
      upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.
      from('assets').
      getPublicUrl(fileName);

      await updateBranding.mutateAsync({ key, image_url: publicUrl });

      toast({
        title: tr("adminbranding_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminbranding_sekil_yuklendi_474bd5", "Şəkil yükləndi")
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: tr("adminbranding_xeta_3cdbb6", "Xəta"),
        description: tr("adminbranding_sekil_yuklene_bilmedi_3c275f", "Şəkil yüklənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setUploading(null);
    }
  };

  const getBrandingItem = (key: string) => {
    return branding?.find((b) => b.key === key);
  };

  const brandingItems = [
  {
    key: 'splash_screen',
    title: 'Splash Screen',
    description: tr("adminbranding_tetbiq_acilarken_gorunen_sekil_1024x1024_4826d0", "Tətbiq açılarkən görünən şəkil (1024x1024 tövsiyə olunur)"),
    icon: Smartphone,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    key: 'login_logo',
    title: 'Login Logo',
    description: tr("adminbranding_giris_ekranindaki_logo_512x512_tovsiye_o_97c3da", "Giriş ekranındakı logo (512x512 tövsiyə olunur)"),
    icon: Image,
    color: 'from-purple-500 to-pink-500'
  }];


  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
      </Card>);

  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Branding</h1>
        <p className="text-muted-foreground">{tr("adminbranding_tetbiq_sekillerini_idare_edin_a6dccb", "Tətbiq şəkillərini idarə edin")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {brandingItems.map((item, index) => {
          const brandingData = getBrandingItem(item.key);
          const Icon = item.icon;

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}>
              
              <Card className="p-6 overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${item.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="mb-4">
                  {brandingData?.image_url ?
                  <div className="relative aspect-square w-full max-w-[200px] mx-auto rounded-xl overflow-hidden bg-muted">
                      <img
                      src={brandingData.image_url}
                      alt={item.title}
                      className="w-full h-full object-contain" />
                    
                    </div> :

                  <div className="aspect-square w-full max-w-[200px] mx-auto rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  }
                </div>

                {/* Upload */}
                <label className="block">
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(item.key, file);
                    }}
                    disabled={uploading === item.key} />
                  
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={uploading === item.key}
                    asChild>
                    
                    <span className="cursor-pointer">
                      {uploading === item.key ?
                      <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {tr("adminbranding_yuklenir_5557de", "Y\xFCkl\u0259nir...")}
                        </> :

                      <>
                          <Upload className="w-4 h-4" />
                          {tr("adminbranding_sekil_yukle_769aff", "\u015E\u0259kil Y\xFCkl\u0259")}
                        </>
                      }
                    </span>
                  </Button>
                </label>
              </Card>
            </motion.div>);

        })}
      </div>
    </div>);

};

export default AdminBranding;