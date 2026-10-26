import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useAllDevelopmentTips, useDevelopmentTipsMutations, DevelopmentTip } from '@/hooks/useDevelopmentTips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AGE_GROUPS = [
{ value: 'newborn', label: tr("admindevelopmenttips_yenidogan_0_3_ay_267ade", "Yenidoğan (0-3 ay)") },
{ value: 'infant', label: tr("admindevelopmenttips_korpe_3_6_ay_a4695a", "Körpə (3-6 ay)") },
{ value: 'older', label: tr("admindevelopmenttips_boyuk_6_ay_5bd3b1", "Böyük (6+ ay)") }];


const EMOJIS = ['👁️', '🎵', '🤲', '🧸', '📖', '🎶', '🥣', '🚶', '🗣️', '💪', '🌟', '❤️'];

const AdminDevelopmentTips = () => {
    const localize = useAdminLocalize();
  const { data: tips = [], isLoading } = useAllDevelopmentTips();
  const { createTip, updateTip, deleteTip } = useDevelopmentTipsMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<DevelopmentTip>>({});

  const handleCreate = () => {
    createTip.mutate({
      age_group: 'newborn',
      emoji: '🌟',
      title: 'New Tip',
      title_az: tr("admindevelopmenttips_yeni_tovsiye_597286", "Yeni T\xF6vsiy\u0259"),
      content: 'Tip content',
      content_az: tr("admindevelopmenttips_tovsiye_metni_eea352", "T\xF6vsiy\u0259 m\u0259tni"),
      sort_order: tips.length + 1,
      is_active: true
    }, {
      onSuccess: () => toast.success(tr("admindevelopmenttips_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi")),
      onError: () => toast.error(tr("admindevelopmenttips_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
    });
  };

  const handleUpdate = (id: string) => {
    updateTip.mutate({ id, ...formData }, {
      onSuccess: () => {
        toast.success(tr("admindevelopmenttips_yenilendi_d10a01", "Yenil\u0259ndi"));
        setEditingId(null);
        setFormData({});
      },
      onError: () => toast.error(tr("admindevelopmenttips_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
    });
  };

  const handleDelete = (id: string) => {
    if (confirm(tr("admindevelopmenttips_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      deleteTip.mutate(id, {
        onSuccess: () => toast.success('Silindi'),
        onError: () => toast.error(tr("admindevelopmenttips_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
      });
    }
  };

  const startEdit = (tip: DevelopmentTip) => {
    setEditingId(tip.id);
    setFormData(tip);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({});
  };

  if (isLoading) return <div className="p-4">{tr("admindevelopmenttips_yuklenir_5557de", "Yüklənir...")}</div>;

  // Group by age_group
  const grouped = tips.reduce((acc, tip) => {
    if (!acc[tip.age_group]) acc[tip.age_group] = [];
    acc[tip.age_group].push(tip);
    return acc;
  }, {} as Record<string, DevelopmentTip[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{tr("admindevelopmenttips_inkisaf_tovsiyeleri_9f473e", "İnkişaf Tövsiyələri")}</h2>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 me-2" />
          Yeni
        </Button>
      </div>

      {AGE_GROUPS.map(({ value, label }) =>
      <Card key={value}>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">{label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(grouped[value] || []).map((tip) =>
          <div key={tip.id} className="p-3 bg-muted/50 rounded-lg">
                {editingId === tip.id ?
            <div className="space-y-3">
                    <div className="flex gap-3">
                      <Select
                  value={formData.emoji || tip.emoji}
                  onValueChange={(v) => setFormData({ ...formData, emoji: v })}>
                  
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMOJIS.map((e) =>
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                    )}
                        </SelectContent>
                      </Select>
                      <LocalizedInput formData={formData} setFormData={setFormData} field="title" label="Başlıq" />
                
                      <Select
                  value={formData.age_group || tip.age_group}
                  onValueChange={(v) => setFormData({ ...formData, age_group: v })}>
                  
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_GROUPS.map((ag) =>
                    <SelectItem key={ag.value} value={ag.value}>{ag.label}</SelectItem>
                    )}
                        </SelectContent>
                      </Select>
                    </div>
                    <LocalizedTextarea formData={formData} setFormData={setFormData} field="content" label="Mətn" rows={2} />
              
                    <div className="flex gap-2">
                      <Input
                  type="number"
                  value={formData.sort_order ?? tip.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                  className="w-20"
                  placeholder={tr("admindevelopmenttips_sira_421c5f", "Sıra")} />
                
                      <Button size="sm" onClick={() => handleUpdate(tip.id)}>
                        <Save className="w-4 h-4 me-1" />
                        Yadda saxla
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div> :

            <div className="flex items-start gap-3">
                    <span className="text-2xl">{tip.emoji}</span>
                    <div className="flex-1">
                      <p className="font-medium">{localize(tip, 'title')}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {localize(tip, 'content')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{tip.sort_order}</span>
                      <Switch
                  checked={tip.is_active}
                  onCheckedChange={(checked) => updateTip.mutate({ id: tip.id, is_active: checked })} />
                
                      <Button size="sm" variant="ghost" onClick={() => startEdit(tip)}>
                        {tr("admindevelopmenttips_redakte_d53ba7", "Redakt\u0259")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(tip.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
            }
              </div>
          )}
            {(!grouped[value] || grouped[value].length === 0) &&
          <p className="text-sm text-muted-foreground text-center py-4">
                {tr("admindevelopmenttips_bu_yas_qrupu_ucun_tovsiye_yoxd_3e49db", "Bu ya\u015F qrupu \xFC\xE7\xFCn t\xF6vsiy\u0259 yoxdur")}
              </p>
          }
          </CardContent>
        </Card>
      )}
    </div>);

};

export default AdminDevelopmentTips;