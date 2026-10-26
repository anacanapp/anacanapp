import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Plus, Save, Trash2, Languages } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LanguageRow {
  id: string;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  regions: string[];
  disabled_tools: string[];
  sort_order: number;
  icon_url: string | null;
}

const AdminLanguages = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLang, setNewLang] = useState({ code: '', name: '', native_name: '', regions: '', disabled_tools: '' });
  const [showAdd, setShowAdd] = useState(false);

  const { data: languages = [], isLoading } = useQuery({
    queryKey: ['admin-languages'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('app_languages').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data as LanguageRow[];
    }
  });

  // Get translation counts per language
  const { data: translationCounts = {} } = useQuery({
    queryKey: ['admin-translation-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const lang of languages.filter((l) => l.code !== 'az')) {
        const { count, error } = await supabase.
        from('translations').
        select('*', { count: 'exact', head: true }).
        eq('lang', lang.code).
        neq('value', '');
        if (!error) counts[lang.code] = count ?? 0;
      }
      return counts;
    },
    enabled: languages.length > 0
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: {id: string;is_active: boolean;}) => {
      const { error } = await supabase.
      from('app_languages').
      update({ is_active }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
      toast.success(tr("adminlanguages_dil_statusu_yenilendi_b81606", "Dil statusu yenil\u0259ndi"));
    }
  });

  const updateLanguage = useMutation({
    mutationFn: async (lang: Partial<LanguageRow> & {id: string;}) => {
      const { error } = await supabase.
      from('app_languages').
      update(lang).
      eq('id', lang.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
      queryClient.invalidateQueries({ queryKey: ['app-languages'] });
      setEditingId(null);
      toast.success(tr("adminlanguages_dil_yenilendi_e29903", "Dil yenil\u0259ndi"));
    }
  });

  const addLanguage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.
      from('app_languages').
      insert({
        code: newLang.code.trim(),
        name: newLang.name.trim(),
        native_name: newLang.native_name.trim(),
        regions: JSON.parse(`[${newLang.regions.split(',').map((r) => `"${r.trim()}"`).join(',')}]`),
        disabled_tools: newLang.disabled_tools ? JSON.parse(`[${newLang.disabled_tools.split(',').map((t) => `"${t.trim()}"`).join(',')}]`) : [],
        sort_order: languages.length + 1,
        is_active: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
      setShowAdd(false);
      setNewLang({ code: '', name: '', native_name: '', regions: '', disabled_tools: '' });
      toast.success(tr("adminlanguages_yeni_dil_elave_edildi_764b41", "Yeni dil \u0259lav\u0259 edildi"));
    },
    onError: (err) => toast.error(tr("adminlanguages_xeta_dbbc36", "X\u0259ta: ") + (err as Error).message)
  });

  const deleteLang = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('app_languages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-languages'] });
      toast.success('Dil silindi');
    }
  });

  const [editForm, setEditForm] = useState<Record<string, string>>({});

  if (isLoading) return <div className="p-4">{tr("adminlanguages_yuklenir_5557de", "Yüklənir...")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{tr("adminlanguages_dil_idareetmesi_fd660e", "Dil İdarəetməsi")}</h2>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} size="sm">
          <Plus className="w-4 h-4 me-1" /> Yeni Dil
        </Button>
      </div>

      {showAdd &&
      <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kod (az, en, tr...)</Label>
                <Input value={newLang.code} onChange={(e) => setNewLang((p) => ({ ...p, code: e.target.value }))} placeholder="en" />
              </div>
              <div>
                <Label>Ad (English)</Label>
                <Input value={newLang.name} onChange={(e) => setNewLang((p) => ({ ...p, name: e.target.value }))} placeholder="English" />
              </div>
              <div>
                <Label>Yerli Ad (English)</Label>
                <Input value={newLang.native_name} onChange={(e) => setNewLang((p) => ({ ...p, native_name: e.target.value }))} placeholder="English" />
              </div>
              <div>
                <Label>{tr("adminlanguages_bolgeler_vergulle_ae07f8", "Bölgələr (vergüllə)")}</Label>
                <Input value={newLang.regions} onChange={(e) => setNewLang((p) => ({ ...p, regions: e.target.value }))} placeholder="US,GB,AU" />
              </div>
              <div className="col-span-2">
                <Label>{tr("adminlanguages_deaktiv_aletler_vergulle_bos_saxlaya_bil_705444", "Deaktiv alətlər (vergüllə, boş saxlaya bilərsiniz)")}</Label>
                <Input value={newLang.disabled_tools} onChange={(e) => setNewLang((p) => ({ ...p, disabled_tools: e.target.value }))} placeholder="cakes,maternity" />
              </div>
            </div>
            <Button onClick={() => addLanguage.mutate()} disabled={!newLang.code || !newLang.name}>
              <Save className="w-4 h-4 me-1" /> {tr("adminlanguages_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </CardContent>
        </Card>
      }

      <div className="grid gap-4">
        {languages.map((lang) =>
        <Card key={lang.id} className={lang.is_active ? 'border-primary/30' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Languages className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{lang.native_name}</span>
                      <Badge variant="outline">{lang.code}</Badge>
                      {lang.is_active && <Badge className="bg-green-500/20 text-green-700">Aktiv</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tr("adminlanguages_bolgeler_efbefd", "B\xF6lg\u0259l\u0259r:")} {(lang.regions as string[])?.join(', ') || '—'}
                      {lang.code !== 'az' &&
                    <span className="ms-3">
                          {tr("adminlanguages_tercume_17fe4c", "T\u0259rc\xFCm\u0259:")} <strong>{translationCounts[lang.code] ?? 0}</strong> {tr("adminlanguages_acar_44578b", "a\xE7ar")}
                        </span>
                    }
                    </div>
                    {/* Disabled tools display / inline edit */}
                    {editingId === lang.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={editForm[lang.id] ?? (lang.disabled_tools as string[])?.join(', ') ?? ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [lang.id]: e.target.value }))}
                          placeholder="cakes, maternity, ..."
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            const raw = editForm[lang.id] ?? '';
                            const tools = raw.split(',').map((t: string) => t.trim()).filter(Boolean);
                            updateLanguage.mutate({
                              id: lang.id,
                              disabled_tools: tools as any,
                            });
                          }}
                        >
                          <Save className="w-3 h-3 me-1" /> Saxla
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingId(null)}>
                          ×
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        {(lang.disabled_tools as string[])?.length > 0 ? (
                          <span className="text-xs text-orange-600">
                            {tr("adminlanguages_deaktiv_aletler_539f1d", "Deaktiv al\u0259tl\u0259r:")} {(lang.disabled_tools as string[]).join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tr("adminlanguages_deaktiv_alet_yoxdur", "Deaktiv alət yoxdur")}</span>
                        )}
                        {lang.code !== 'az' && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                            setEditingId(lang.id);
                            setEditForm(prev => ({ ...prev, [lang.id]: (lang.disabled_tools as string[])?.join(', ') ?? '' }));
                          }}>
                            ✏️
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lang.code !== 'az' &&
                <>
                      <Switch
                    checked={lang.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: lang.id, is_active: checked })} />
                  
                      <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`"${lang.native_name}" dilini silmək istəyirsiniz?`)) {
                        deleteLang.mutate(lang.id);
                      }
                    }}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                }
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>);

};

export default AdminLanguages;