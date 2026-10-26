import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Calendar, Plus, Trash2, Save, Edit2, AlertTriangle,
  Sparkles, Clock, ChevronDown, ChevronUp } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useAllBabyCrisisPeriods,
  useCreateBabyCrisisPeriod,
  useUpdateBabyCrisisPeriod,
  useDeleteBabyCrisisPeriod,
  BabyCrisisPeriod } from
'@/hooks/useBabyCrisisPeriods';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger } from
"@/components/ui/collapsible";
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminBabyCrisisCalendar = () => {
    const localize = useAdminLocalize();
  const { toast } = useToast();
  const { data: crisisPeriods = [], isLoading } = useAllBabyCrisisPeriods();
  const createMutation = useCreateBabyCrisisPeriod();
  const updateMutation = useUpdateBabyCrisisPeriod();
  const deleteMutation = useDeleteBabyCrisisPeriod();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    week_start: 5,
    week_end: 5,
    leap_number: 1,
    title: '',
    title_az: '',
    description: '',
    description_az: '',
    symptoms: '',
    symptoms_az: '',
    tips: '',
    tips_az: '',
    duration_days: 7,
    severity: 'medium',
    emoji: '😢',
    color: '#F48155',
    is_active: true
  });

  const severityColors = {
    mild: 'bg-green-500/10 text-green-600 border-green-500/30',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    intense: 'bg-red-500/10 text-red-600 border-red-500/30'
  };

  const severityLabels = {
    mild: tr("adminbabycrisiscalendar_yungul_2a8010", "Y\xFCng\xFCl"),
    medium: 'Orta',
    intense: tr("adminbabycrisiscalendar_siddetli_2dc9e7", "\u015Eidd\u0259tli")
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      week_start: 5,
      week_end: 5,
      leap_number: crisisPeriods.length + 1,
      title: '',
      title_az: '',
      description: '',
      description_az: '',
      symptoms: '',
      symptoms_az: '',
      tips: '',
      tips_az: '',
      duration_days: 7,
      severity: 'medium',
      emoji: '😢',
      color: '#F48155',
      is_active: true
    });
    setDialogOpen(true);
  };

  const handleEdit = (period: BabyCrisisPeriod) => {
    setEditingId(period.id);
    setFormData({
      // NOT: bütün sətir (...period) spread olunur ki, mövcud title_en/ru/tr,
      // description_en/ru/tr, symptoms_en/ru/tr, tips_en/ru/tr dəyərləri
      // admin dili dəyişdirildikdə boş görünməsin.
      ...period,
      week_start: period.week_start,
      week_end: period.week_end,
      leap_number: period.leap_number || 0,
      title: period.title,
      title_az: period.title_az || '',
      description: period.description || '',
      description_az: period.description_az || '',
      symptoms: period.symptoms?.join('\n') || '',
      symptoms_az: period.symptoms_az?.join('\n') || '',
      tips: period.tips?.join('\n') || '',
      tips_az: period.tips_az?.join('\n') || '',
      duration_days: period.duration_days || 7,
      severity: period.severity,
      emoji: period.emoji,
      color: period.color,
      is_active: period.is_active
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // NOT: əvvəllər yalnız title/title_az/description/description_az/
    // symptoms(_az)/tips(_az) göndərilirdi - LocalizedInput/Textarea admin
    // dili en/ru/tr olanda title_en/description_ru/symptoms_tr/tips_ru və s.
    // formData-ya yazırdı, amma bunlar heç vaxt göndərilmirdi (sessiz itki,
    // 3 dil üçün). `..._en/_ru/_tr` sütunları TEXT tipindədir (massiv deyil)
    // və oxuma tərəfi (`mapRowTranslation`) sətri "\n" ilə bölə bildiyi üçün
    // eyni sətir-formatını göndərmək kifayətdir (bax src/lib/tr.ts).
    const { week_start, week_end, leap_number, title, title_az, description, description_az, symptoms, symptoms_az, tips, tips_az, duration_days, severity, emoji, color, is_active, ...rest } = formData;
    const payload = {
      ...rest,
      week_start,
      week_end,
      leap_number: leap_number || null,
      title,
      title_az: title_az || null,
      description: description || null,
      description_az: description_az || null,
      symptoms: symptoms.split('\n').filter(Boolean),
      symptoms_az: symptoms_az.split('\n').filter(Boolean),
      tips: tips.split('\n').filter(Boolean),
      tips_az: tips_az.split('\n').filter(Boolean),
      duration_days,
      severity,
      emoji,
      color,
      is_active,
      sort_order: week_start
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast({ title: tr("adminbabycrisiscalendar_kriz_dovru_yenilendi_3afe9c", "Kriz dövrü yeniləndi!") });
      } else {
        await createMutation.mutateAsync(payload as any);
        toast({ title: tr("adminbabycrisiscalendar_kriz_dovru_yaradildi_377ff6", "Kriz dövrü yaradıldı!") });
      }
      setDialogOpen(false);
    } catch (error) {
      toast({ title: tr("adminbabycrisiscalendar_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminbabycrisiscalendar_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Silindi!' });
    } catch (error) {
      toast({ title: tr("adminbabycrisiscalendar_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            {tr("adminbabycrisiscalendar_kriz_teqvimi_aa2ea5", "Kriz T\u0259qvimi")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {tr("adminbabycrisiscalendar_korpelerin_inkisaf_sicrayislar_89e452", "K\xF6rp\u0259l\u0259rin inki\u015Faf s\u0131\xE7ray\u0131\u015Flar\u0131 v\u0259 kriz d\xF6vrl\u0259ri (Wonder Weeks)")}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 me-2" />
          {tr("adminbabycrisiscalendar_yeni_kriz_dovru_88ca15", "Yeni Kriz D\xF6vr\xFC")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{crisisPeriods.length}</div>
            <p className="text-sm text-muted-foreground">{tr("adminbabycrisiscalendar_umumi_kriz_dovru_ca0915", "Ümumi kriz dövrü")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {crisisPeriods.filter((p) => p.severity === 'mild').length}
            </div>
            <p className="text-sm text-muted-foreground">{tr("adminbabycrisiscalendar_yungul_2a8010", "Yüngül")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">
              {crisisPeriods.filter((p) => p.severity === 'medium').length}
            </div>
            <p className="text-sm text-muted-foreground">Orta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">
              {crisisPeriods.filter((p) => p.severity === 'intense').length}
            </div>
            <p className="text-sm text-muted-foreground">{tr("adminbabycrisiscalendar_siddetli_2dc9e7", "Şiddətli")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Crisis Periods List */}
      <div className="space-y-3">
        {crisisPeriods.map((period, index) =>
        <Collapsible key={period.id} open={expandedId === period.id}>
            <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`border rounded-xl overflow-hidden ${!period.is_active ? 'opacity-50' : ''}`}>
            
              <CollapsibleTrigger asChild>
                <button
                onClick={() => setExpandedId(expandedId === period.id ? null : period.id)}
                className="w-full p-4 flex items-center gap-4 bg-card hover:bg-muted/50 transition-colors text-start">
                
                  <div className="text-3xl">{period.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground">{localize(period, 'title')}</h3>
                      {period.leap_number &&
                    <Badge variant="secondary" className="text-xs">
                          Leap #{period.leap_number}
                        </Badge>
                    }
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {period.week_start === period.week_end ?
                      `Həftə ${period.week_start}` :
                      `Həftə ${period.week_start}-${period.week_end}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{period.duration_days} {tr("adminbabycrisiscalendar_gun_54e78d", "g\xFCn")}
                      </span>
                    </div>
                  </div>
                  <Badge className={severityColors[period.severity as keyof typeof severityColors]}>
                    {severityLabels[period.severity as keyof typeof severityLabels]}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(period);
                    }}>
                    
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(period.id);
                    }}>
                    
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {expandedId === period.id ?
                  <ChevronUp className="w-4 h-4 text-muted-foreground" /> :

                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                  </div>
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-4 pt-0 border-t bg-muted/30 grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Simptomlar
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {((localize(period, 'symptoms') || []) as unknown as string[]).map((s, i) =>
                    <li key={i}>• {s}</li>
                    )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {tr("adminbabycrisiscalendar_tovsiyeler_17a8f7", "T\xF6vsiy\u0259l\u0259r")}
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {((localize(period, 'tips') || []) as unknown as string[]).map((t, i) =>
                    <li key={i}>• {t}</li>
                    )}
                    </ul>
                  </div>
                  {(localize(period, 'description')) &&
                <div className="md:col-span-2">
                      <h4 className="font-semibold text-sm text-foreground mb-2">{tr("adminbabycrisiscalendar_aciqlama_c33d69", "Açıqlama")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {localize(period, 'description')}
                      </p>
                    </div>
                }
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {editingId ? tr("adminbabycrisiscalendar_kriz_dovrundu_redakte_et_2ffb08", "Kriz D\xF6vr\xFCnd\xFC Redakt\u0259 Et") : tr("adminbabycrisiscalendar_yeni_kriz_dovru_88ca15", "Yeni Kriz D\xF6vr\xFC")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_baslangic_hefte_24d6e7", "Başlanğıc həftə")}</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.week_start}
                  onChange={(e) => setFormData((prev) => ({ ...prev, week_start: parseInt(e.target.value) }))} />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_bitis_heftesi_8cb7ed", "Bitiş həftəsi")}</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.week_end}
                  onChange={(e) => setFormData((prev) => ({ ...prev, week_end: parseInt(e.target.value) }))} />
                
              </div>
              <div>
                <label className="text-sm font-medium">Leap #</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.leap_number}
                  onChange={(e) => setFormData((prev) => ({ ...prev, leap_number: parseInt(e.target.value) }))} />
                
              </div>
            </div>

            {/* Title */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_basliq_en_4ac905", "Başlıq (EN)")}</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="The World of..." />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_basliq_az_3e294a", "Başlıq (AZ)")}</label>
                <LocalizedInput formData={formData} setFormData={setFormData} field="title" label="...Dünyası" />
                
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_aciqlama_en_6fb6db", "Açıqlama (EN)")}</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2} />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_aciqlama_az_86f364", "Açıqlama (AZ)")}</label>
                <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Description" rows={2} />
                
              </div>
            </div>

            {/* Symptoms */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_simptomlar_en_her_setirde_bir_b0a595", "Simptomlar (EN) - hər sətirdə bir")}</label>
                <Textarea
                  value={formData.symptoms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, symptoms: e.target.value }))}
                  placeholder="Crying more&#10;Sleep problems"
                  rows={3} />
                
              </div>
              <div>
                <label className="text-sm font-medium">Simptomlar (AZ)</label>
                <LocalizedTextarea formData={formData} setFormData={setFormData} field="symptoms" label="Daha çox ağlama&#10;Yuxu problemləri" rows={3} />
                
              </div>
            </div>

            {/* Tips */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_tovsiyeler_en_28e0bf", "Tövsiyələr (EN)")}</label>
                <Textarea
                  value={formData.tips}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tips: e.target.value }))}
                  placeholder="Extra cuddles&#10;Patience"
                  rows={3} />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_tovsiyeler_az_12e64c", "Tövsiyələr (AZ)")}</label>
                <LocalizedTextarea formData={formData} setFormData={setFormData} field="tips" label="Əlavə qucaqlaşma&#10;Səbir" rows={3} />
                
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_muddet_gun_f19d66", "Müddət (gün)")}</label>
                <Input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData((prev) => ({ ...prev, duration_days: parseInt(e.target.value) }))} />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_siddet_afc814", "Şiddət")}</label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, severity: v }))}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">{tr("adminbabycrisiscalendar_yungul_2a8010", "Yüngül")}</SelectItem>
                    <SelectItem value="medium">Orta</SelectItem>
                    <SelectItem value="intense">{tr("adminbabycrisiscalendar_siddetli_2dc9e7", "Şiddətli")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Emoji</label>
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData((prev) => ({ ...prev, emoji: e.target.value }))}
                  placeholder="😢" />
                
              </div>
              <div>
                <label className="text-sm font-medium">{tr("adminbabycrisiscalendar_reng_8c6bc5", "Rəng")}</label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))} />
                
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                {tr("adminbabycrisiscalendar_legv_et_b5e49c", "L\u0259\u011Fv et")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.title || createMutation.isPending || updateMutation.isPending}
                className="flex-1">
                
                <Save className="w-4 h-4 me-2" />
                {editingId ? tr("adminbabycrisiscalendar_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminBabyCrisisCalendar;