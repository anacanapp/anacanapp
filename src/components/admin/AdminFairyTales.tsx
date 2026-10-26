import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { BookHeart, Plus, Edit, Trash2, Save, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminUsageStats from './AdminUsageStats';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface FairyTaleTheme {
  id: string;
  name: string;
  name_az: string;
  description: string | null;
  description_az: string | null;
  emoji: string | null;
  cover_image_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

const AdminFairyTales = () => {
    const localize = useAdminLocalize();
  const [editingTheme, setEditingTheme] = useState<FairyTaleTheme | null>(null);
  const [newTheme, setNewTheme] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch themes
  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['admin-fairy-tale-themes'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('fairy_tale_themes').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data as FairyTaleTheme[];
    }
  });

  // Fetch user-generated tales count
  const { data: talesStats } = useQuery({
    queryKey: ['admin-fairy-tales-stats'],
    queryFn: async () => {
      const { count, error } = await supabase.
      from('fairy_tales').
      select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { totalTales: count || 0 };
    }
  });

  // Save theme mutation
  const saveMutation = useMutation({
    mutationFn: async (theme: Partial<FairyTaleTheme>) => {
      if (theme.id) {
        const { error } = await supabase.
        from('fairy_tale_themes').
        update(theme).
        eq('id', theme.id);
        if (error) throw error;
      } else {
        const { name, name_az, ...rest } = theme;
        if (!name || !name_az) throw new Error('Name required');
        const { error } = await supabase.
        from('fairy_tale_themes').
        insert({ name, name_az, ...rest });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fairy-tale-themes'] });
      setEditingTheme(null);
      setNewTheme(false);
      toast({ title: tr("adminfairytales_tema_yadda_saxlanildi_b505df", "Tema yadda saxlanıldı") });
    },
    onError: () => {
      toast({ title: tr("adminfairytales_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  // Delete theme mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('fairy_tale_themes').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fairy-tale-themes'] });
      toast({ title: 'Tema silindi' });
    },
    onError: () => {
      toast({ title: tr("adminfairytales_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  // Toggle active status
  const toggleActive = async (theme: FairyTaleTheme) => {
    await saveMutation.mutateAsync({ id: theme.id, is_active: !theme.is_active });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookHeart className="w-5 h-5 text-indigo-500" />
            {tr("adminfairytales_sehrli_nagilci_25f8c2", "Sehrli Na\u011F\u0131l\xE7\u0131")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tr("adminfairytales_ai_nagil_temalari_ve_statistik_f771a0", "AI na\u011F\u0131l temalar\u0131 v\u0259 statistika")}
          </p>
        </div>
        <Button onClick={() => setNewTheme(true)}>
          <Plus className="w-4 h-4 me-1" />
          Yeni Tema
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-500">{talesStats?.totalTales || 0}</div>
            <p className="text-sm text-muted-foreground">{tr("adminfairytales_yaradilmis_nagillar_80b7b7", "Yaradılmış Nağıllar")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{themes.filter((t) => t.is_active).length}</div>
            <p className="text-sm text-muted-foreground">Aktiv Temalar</p>
          </CardContent>
        </Card>
      </div>

      {/* New Theme Form */}
      {newTheme &&
      <Card>
          <CardHeader>
            <CardTitle>Yeni Tema</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeForm
            onSave={(data) => saveMutation.mutate(data)}
            onCancel={() => setNewTheme(false)}
            isLoading={saveMutation.isPending} />
          
          </CardContent>
        </Card>
      }

      {/* Themes List */}
      {isLoading ?
      <div className="text-center py-8">{tr("adminfairytales_yuklenir_5557de", "Yüklənir...")}</div> :

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme, index) =>
        <motion.div
          key={theme.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}>
          
              <Card className={!theme.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  {editingTheme?.id === theme.id ?
              <ThemeForm
                theme={theme}
                onSave={(data) => saveMutation.mutate({ ...data, id: theme.id })}
                onCancel={() => setEditingTheme(null)}
                isLoading={saveMutation.isPending} /> :


              <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{theme.emoji || '📖'}</span>
                          <div>
                            <h3 className="font-bold">{theme.name_az}</h3>
                            <p className="text-xs text-muted-foreground">{theme.name}</p>
                          </div>
                        </div>
                        <Switch
                    checked={theme.is_active ?? true}
                    onCheckedChange={() => toggleActive(theme)} />
                  
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {theme.description_az}
                      </p>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingTheme(theme)}>
                          <Edit className="w-3 h-3 me-1" />
                          {tr("adminfairytales_redakte_d53ba7", "Redakt\u0259")}
                        </Button>
                        <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(theme.id)}>
                    
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
              }
                </CardContent>
              </Card>
            </motion.div>
        )}
        </div>
      }

      <AdminUsageStats
        eventNames={['fairy_tale_generated']}
        title={tr("adminfairytales_nagil_generatoru_istifade_statistikasi_b567b1", "📖 Nağıl Generatoru İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

interface ThemeFormProps {
  theme?: FairyTaleTheme;
  onSave: (data: Partial<FairyTaleTheme>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ThemeForm = ({ theme, onSave, onCancel, isLoading }: ThemeFormProps) => {
  // NOT: `...theme` spread olunur ki, mövcud name_en/ru/tr/kk/de/ar və
  // description_en/ru/tr/kk/de/ar dəyərləri admin dili dəyişdirildikdə boş
  // görünməsin (Save tərəfi artıq bütün formu göndərir, yalnız Open (bərpa)
  // tərəfi əskik idi).
  const [form, setForm] = useState<Record<string, any>>({
    ...theme,
    name: theme?.name || '',
    name_az: theme?.name_az || '',
    description: theme?.description || '',
    description_az: theme?.description_az || '',
    emoji: theme?.emoji || '📖',
    cover_image_url: theme?.cover_image_url || '',
    sort_order: theme?.sort_order || 0,
    is_active: theme?.is_active ?? true
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Ad (EN)</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Forest Adventure" />
          
        </div>
        <div>
          <label className="text-sm font-medium">Ad (AZ)</label>
          <LocalizedInput formData={form} setFormData={setForm} field="name" label="Meşə Macərası" />
          
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{tr("adminfairytales_tesvir_en_c64521", "Təsvir (EN)")}</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminfairytales_tesvir_az_2c237a", "Təsvir (AZ)")}</label>
          <LocalizedTextarea formData={form} setFormData={setForm} field="description" label="Description" />
          
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Emoji</label>
          <Input
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminfairytales_sira_421c5f", "Sıra")}</label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">Cover URL</label>
          <Input
            value={form.cover_image_url}
            onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
            placeholder="https://..." />
          
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={isLoading}>
          <Save className="w-4 h-4 me-1" />
          {isLoading ? tr("adminfairytales_saxlanir_9ea540", "Saxlan\u0131r...") : 'Yadda saxla'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 me-1" />
          {tr("adminfairytales_legv_et_b5e49c", "L\u0259\u011Fv et")}
        </Button>
      </div>
    </div>);

};

export default AdminFairyTales;