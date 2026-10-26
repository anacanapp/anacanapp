import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Gamepad2, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { useSkillCategories, FALLBACK_SKILL_CATEGORIES } from '@/hooks/useSkillCategories';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminPlayActivities = () => {
    const localize = useAdminLocalize();
  const { data: dbSkillCategories = [] } = useSkillCategories();
  const skillCategories = dbSkillCategories.length > 0 ?
  dbSkillCategories.map((s) => ({ value: s.skill_key, label: localize(s, 'label'), color: s.color })) :
  FALLBACK_SKILL_CATEGORIES.map((s) => ({ value: s.skill_key, label: s.label_az, color: s.color }));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['admin-play-activities'],
    queryFn: async () => {
      return await fetchAllRows((from, to) =>
        supabase.from('play_activities').select('*').order('min_age_days').range(from, to)
      );
    }
  });

  // Save activity mutation
  const saveMutation = useMutation({
    mutationFn: async (activity: {id?: string;title: string;title_az: string;description?: string;description_az?: string;min_age_days: number;max_age_days: number;duration_minutes?: number;skill_tags?: string[];required_items?: string[];is_active?: boolean;difficulty_level?: string;}) => {
      if (activity.id) {
        const { id, ...updateData } = activity;
        const { error } = await supabase.
        from('play_activities').
        update(updateData).
        eq('id', id);
        if (error) throw error;
      } else {
        const { id, ...insertData } = activity;
        const { error } = await supabase.
        from('play_activities').
        insert([insertData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-play-activities'] });
      setEditingId(null);
      setNewActivity(false);
      toast({ title: tr("adminplayactivities_aktivlik_yadda_saxlanildi_6e3342", "Aktivlik yadda saxlanıldı") });
    },
    onError: () => {
      toast({ title: tr("adminplayactivities_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  // Delete activity mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('play_activities').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-play-activities'] });
      toast({ title: 'Aktivlik silindi' });
    },
    onError: () => {
      toast({ title: tr("adminplayactivities_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  // Filter activities
  const filteredActivities = activities.filter((a) =>
  filterCategory === 'all' || a.skill_tags && a.skill_tags.includes(filterCategory)
  );

  const getSkillCategoryColor = (tags: string[] | null) => {
    if (!tags || tags.length === 0) return 'bg-gray-500';
    const first = tags[0];
    const category = skillCategories.find((c) => c.value === first);
    return category?.color || 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-500" />
            {tr("adminplayactivities_agilli_oyun_qutusu_db6ef9", "A\u011F\u0131ll\u0131 Oyun Qutusu")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tr("adminplayactivities_yasa_uygun_inkisafetdirici_oyu_f92c72", "Ya\u015Fa uy\u011Fun inki\u015Fafetdirici oyunlar")}
          </p>
        </div>
        <Button onClick={() => setNewActivity(true)}>
          <Plus className="w-4 h-4 me-1" />
          Yeni Oyun
        </Button>
      </div>

      {/* Stats & Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kateqoriya" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("adminplayactivities_hamisi_c73c4d", "Hamısı")}</SelectItem>
            {skillCategories.map((cat) =>
            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filteredActivities.length} aktivlik</Badge>
      </div>

      {/* New Activity Form */}
      {newActivity &&
      <Card>
          <CardHeader>
            <CardTitle>Yeni Oyun</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityForm
            onSave={(data) => saveMutation.mutate(data)}
            onCancel={() => setNewActivity(false)}
            isLoading={saveMutation.isPending} />
          
          </CardContent>
        </Card>
      }

      {/* Activities List */}
      {isLoading ?
      <div className="text-center py-8">{tr("adminplayactivities_yuklenir_5557de", "Yüklənir...")}</div> :

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredActivities.map((activity, index) =>
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}>
          
              <Card className={!activity.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  {editingId === activity.id ?
              <ActivityForm
                activity={activity}
                onSave={(data) => saveMutation.mutate({ ...data, id: activity.id })}
                onCancel={() => setEditingId(null)}
                isLoading={saveMutation.isPending} /> :


              <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🎮</span>
                          <div>
                            <h3 className="font-bold">{localize(activity, 'title')}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`${getSkillCategoryColor(activity.skill_tags)} text-white text-xs`}>
                                {activity.skill_tags?.[0] ? skillCategories.find((c) => c.value === activity.skill_tags![0])?.label || tr("adminplayactivities_diger_293b3a", "Dig\u0259r") : tr("adminplayactivities_diger_293b3a", "Dig\u0259r")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {Math.floor((activity.min_age_days || 0) / 30)}-{Math.floor((activity.max_age_days || 365) / 30)} ay
                              </span>
                            </div>
                          </div>
                        </div>
                        <Switch
                    checked={activity.is_active ?? true}
                    onCheckedChange={() => saveMutation.mutate({ id: activity.id, title: activity.title, title_az: activity.title_az, min_age_days: activity.min_age_days, max_age_days: activity.max_age_days, is_active: !activity.is_active })} />
                  
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {localize(activity, 'description')}
                      </p>
                      
                      {activity.required_items && activity.required_items.length > 0 &&
                <div className="flex flex-wrap gap-1">
                          {activity.required_items.slice(0, 3).map((item, i) =>
                  <Badge key={i} variant="outline" className="text-xs">
                              {item}
                            </Badge>
                  )}
                          {activity.required_items.length > 3 &&
                  <Badge variant="outline" className="text-xs">
                              +{activity.required_items.length - 3}
                            </Badge>
                  }
                        </div>
                }
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(activity.id)}>
                          <Edit className="w-3 h-3 me-1" />
                          {tr("adminplayactivities_redakte_d53ba7", "Redakt\u0259")}
                        </Button>
                        <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(activity.id)}>
                    
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
    </div>);

};

interface ActivityFormProps {
  activity?: {id: string;title: string;title_az?: string | null;description?: string | null;description_az?: string | null;min_age_days?: number | null;max_age_days?: number | null;duration_minutes?: number | null;skill_tags?: string[] | null;required_items?: string[] | null;difficulty_level?: string | null;is_active?: boolean | null;};
  onSave: (data: {title: string;title_az: string;description?: string;description_az?: string;min_age_days: number;max_age_days: number;duration_minutes?: number;skill_tags?: string[];required_items?: string[];difficulty_level?: string;is_active?: boolean;}) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ActivityForm = ({ activity, onSave, onCancel, isLoading }: ActivityFormProps) => {
  // NOT: `...activity` spread olunur ki, mövcud title_ru/tr/kk/de/ar və
  // description_ru/tr/kk/de/ar dəyərləri admin dili dəyişdirildikdə boş
  // görünməsin (bax handleSave-dəki eyni qeyd).
  const [form, setForm] = useState<Record<string, any>>({
    ...activity,
    title: activity?.title || '',
    title_az: activity?.title_az || '',
    description: activity?.description || '',
    description_az: activity?.description_az || '',
    min_age_days: activity?.min_age_days || 0,
    max_age_days: activity?.max_age_days || 365,
    duration_minutes: activity?.duration_minutes || 10,
    skill_tags: activity?.skill_tags?.join(', ') || '',
    required_items: activity?.required_items?.join('\n') || '',
    difficulty_level: activity?.difficulty_level || 'easy',
    is_active: activity?.is_active ?? true
  });

  const handleSave = () => {
    // NOT: əvvəllər sabit sahə siyahısı göndərilirdi - LocalizedInput/
    // Textarea admin dili ru/tr/kk/de/ar olanda title_ru/description_kk və
    // s. yazırdı, amma bunlar heç vaxt göndərilmirdi (sessiz itki, ən aydın
    // nümunə). İndi bütün form spread olunur, yalnız xüsusi emal tələb edən
    // sahələr (massivlər) üstünə yazılır.
    onSave({
      ...form,
      title: form.title,
      title_az: form.title_az || undefined,
      description: form.description || undefined,
      description_az: form.description_az || undefined,
      min_age_days: form.min_age_days,
      max_age_days: form.max_age_days,
      duration_minutes: form.duration_minutes,
      skill_tags: form.skill_tags.split(',').map((s: string) => s.trim()).filter(Boolean),
      required_items: form.required_items.split('\n').filter((i: string) => i.trim()),
      difficulty_level: form.difficulty_level,
      is_active: form.is_active
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_basliq_en_4ac905", "Başlıq (EN)")}</label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_basliq_az_3e294a", "Başlıq (AZ)")}</label>
          <LocalizedInput formData={form} setFormData={setForm} field="title" label="Title" />
          
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_tesvir_en_c64521", "Təsvir (EN)")}</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_tesvir_az_2c237a", "Təsvir (AZ)")}</label>
          <LocalizedTextarea formData={form} setFormData={setForm} field="description" label="Description" />
          
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_min_yas_gun_3267aa", "Min Yaş (gün)")}</label>
          <Input
            type="number"
            value={form.min_age_days}
            onChange={(e) => setForm({ ...form, min_age_days: parseInt(e.target.value) || 0 })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_max_yas_gun_370335", "Max Yaş (gün)")}</label>
          <Input
            type="number"
            value={form.max_age_days}
            onChange={(e) => setForm({ ...form, max_age_days: parseInt(e.target.value) || 365 })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_muddet_deq_cbf031", "Müddət (dəq)")}</label>
          <Input
            type="number"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 10 })} />
          
        </div>
        <div>
          <label className="text-sm font-medium">{tr("adminplayactivities_cetinlik_19294d", "Çətinlik")}</label>
          <Select value={form.difficulty_level} onValueChange={(v) => setForm({ ...form, difficulty_level: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Asan</SelectItem>
              <SelectItem value="medium">Orta</SelectItem>
              <SelectItem value="hard">{tr("adminplayactivities_cetin_4bf032", "Çətin")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">{tr("adminplayactivities_bacariq_etiketleri_vergulle_ayirin_468018", "Bacarıq Etiketləri (vergüllə ayırın)")}</label>
        <Input
          value={form.skill_tags}
          onChange={(e) => setForm({ ...form, skill_tags: e.target.value })}
          placeholder="motor, sensory, cognitive" />
        
      </div>
      
      <div>
        <label className="text-sm font-medium">{tr("adminplayactivities_teleb_olunan_esyalar_her_setirde_bir_0998f2", "Tələb Olunan Əşyalar (hər sətirdə bir)")}</label>
        <Textarea
          value={form.required_items}
          onChange={(e) => setForm({ ...form, required_items: e.target.value })}
          placeholder={tr("adminplayactivities_guzgu_10_yastiq_10_top_65b3ec", "Güzgü&#10;Yastıq&#10;Top")}
          rows={4} />
        
      </div>
      
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isLoading || !form.title}>
          <Save className="w-4 h-4 me-1" />
          {isLoading ? tr("adminplayactivities_saxlanir_9ea540", "Saxlan\u0131r...") : 'Yadda saxla'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 me-1" />
          {tr("adminplayactivities_legv_et_b5e49c", "L\u0259\u011Fv et")}
        </Button>
      </div>
    </div>);

};

export default AdminPlayActivities;