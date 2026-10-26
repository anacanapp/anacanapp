import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useAllQuickActions, useQuickActionsMutations, QuickAction } from '@/hooks/useQuickActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const ICONS = ['Baby', 'Thermometer', 'Music', 'AlertCircle', 'Sparkles', 'BookOpen', 'Camera', 'Stethoscope', 'Heart', 'Star'];
const AGE_GROUPS = ['newborn', 'infant', 'older', 'all'];
const LIFE_STAGES = ['mommy', 'bump', 'flow'];

const AdminQuickActions = () => {
    const localize = useAdminLocalize();
  const { data: actions = [], isLoading } = useAllQuickActions();
  const { createAction, updateAction, deleteAction } = useQuickActionsMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<QuickAction>>({});

  const handleCreate = () => {
    createAction.mutate({
      life_stage: 'mommy',
      age_group: 'all',
      icon: 'Star',
      label: 'New Action',
      label_az: 'Yeni',
      tool_key: 'new-tool',
      color_from: 'blue-400',
      color_to: 'blue-600',
      sort_order: actions.length + 1,
      is_active: true
    }, {
      onSuccess: () => toast.success(tr("adminquickactions_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi")),
      onError: () => toast.error(tr("adminquickactions_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
    });
  };

  const handleUpdate = (id: string) => {
    updateAction.mutate({ id, ...formData }, {
      onSuccess: () => {
        toast.success(tr("adminquickactions_yenilendi_d10a01", "Yenil\u0259ndi"));
        setEditingId(null);
        setFormData({});
      },
      onError: () => toast.error(tr("adminquickactions_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
    });
  };

  const handleDelete = (id: string) => {
    if (confirm(tr("adminquickactions_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      deleteAction.mutate(id, {
        onSuccess: () => toast.success('Silindi'),
        onError: () => toast.error(tr("adminquickactions_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
      });
    }
  };

  const startEdit = (action: QuickAction) => {
    setEditingId(action.id);
    setFormData(action);
  };

  if (isLoading) return <div className="p-4">{tr("adminquickactions_yuklenir_5557de", "Yüklənir...")}</div>;

  // Group by life_stage and age_group
  const grouped = actions.reduce((acc, action) => {
    const key = `${action.life_stage}-${action.age_group}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{tr("adminquickactions_suretli_kecidler_cee44e", "Sürətli Keçidlər")}</h2>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 me-2" />
          Yeni
        </Button>
      </div>

      {Object.entries(grouped).map(([key, groupActions]) =>
      <Card key={key}>
          <CardHeader className="py-3">
            <CardTitle className="text-lg capitalize">
              {key.replace('-', ' → ')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupActions.map((action) =>
          <div key={action.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {editingId === action.id ?
            <>
                    <Select
                value={formData.icon || action.icon}
                onValueChange={(v) => setFormData({ ...formData, icon: v })}>
                
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICONS.map((icon) =>
                  <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  )}
                      </SelectContent>
                    </Select>
                    <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Azərbaycanca" />
              
                    <Input
                value={formData.tool_key ?? action.tool_key}
                onChange={(e) => setFormData({ ...formData, tool_key: e.target.value })}
                placeholder="Tool key"
                className="w-32" />
              
                    <Select
                value={formData.age_group || action.age_group}
                onValueChange={(v) => setFormData({ ...formData, age_group: v })}>
                
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_GROUPS.map((ag) =>
                  <SelectItem key={ag} value={ag}>{ag}</SelectItem>
                  )}
                      </SelectContent>
                    </Select>
                    <Input
                type="number"
                value={formData.sort_order ?? action.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                className="w-16" />
              
                    <Button size="sm" onClick={() => handleUpdate(action.id)}>
                      <Save className="w-4 h-4" />
                    </Button>
                  </> :

            <>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-${action.color_from} to-${action.color_to} flex items-center justify-center text-white text-xs font-bold`}>
                      {action.icon.slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{localize(action, 'label')}</p>
                      <p className="text-xs text-muted-foreground">{action.tool_key}</p>
                    </div>
                    <span className="text-xs bg-primary/10 px-2 py-1 rounded">{action.age_group}</span>
                    <Switch
                checked={action.is_active}
                onCheckedChange={(checked) => updateAction.mutate({ id: action.id, is_active: checked })} />
              
                    <Button size="sm" variant="ghost" onClick={() => startEdit(action)}>
                      {tr("adminquickactions_redakte_d53ba7", "Redakt\u0259")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(action.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
            }
              </div>
          )}
          </CardContent>
        </Card>
      )}
    </div>);

};

export default AdminQuickActions;