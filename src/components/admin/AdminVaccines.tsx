import { tr } from "@/lib/tr";import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
'@/components/ui/select';
import { Plus, Pencil, Trash2, Copy, Syringe, Globe, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { VaccineCountry, Vaccine, VaccineSchedule } from '@/hooks/useVaccines';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const useAdminCountries = () =>
useQuery({
  queryKey: ['admin-vaccine-countries'],
  queryFn: async () => {
    const { data, error } = await supabase.
    from('vaccine_countries' as any).select('*').order('sort_order');
    if (error) throw error;
    return (data || []) as unknown as VaccineCountry[];
  }
});

const useAdminVaccines = (country: string) =>
useQuery({
  queryKey: ['admin-vaccines', country],
  enabled: !!country,
  queryFn: async () => {
    const { data, error } = await supabase.
    from('vaccines' as any).select('*').eq('country_code', country).order('sort_order');
    if (error) throw error;
    return (data || []) as unknown as Vaccine[];
  }
});

const useAdminSchedules = (country: string) =>
useQuery({
  queryKey: ['admin-schedules', country],
  enabled: !!country,
  queryFn: async () => {
    const { data, error } = await supabase.
    from('vaccine_schedules' as any).select('*').eq('country_code', country).order('recommended_age_days');
    if (error) throw error;
    return (data || []) as unknown as VaccineSchedule[];
  }
});

export default function AdminVaccines() {
    const localize = useAdminLocalize();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: countries = [] } = useAdminCountries();
  const [country, setCountry] = useState<string>('AZ');
  const [tab, setTab] = useState('countries');

  const { data: vaccines = [] } = useAdminVaccines(country);
  const { data: schedules = [] } = useAdminSchedules(country);

  // Country dialogs
  const [countryDlg, setCountryDlg] = useState<Partial<VaccineCountry> | null>(null);
  const [vaccineDlg, setVaccineDlg] = useState<Partial<Vaccine> | null>(null);
  const [scheduleDlg, setScheduleDlg] = useState<Partial<VaccineSchedule> | null>(null);
  const [copyDlg, setCopyDlg] = useState(false);
  const [copyTarget, setCopyTarget] = useState('');

  const saveCountry = useMutation({
    mutationFn: async (c: Partial<VaccineCountry>) => {
      if (c.id) {
        const { error } = await supabase.from('vaccine_countries' as any).update(c).eq('id', c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vaccine_countries' as any).insert(c);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vaccine-countries'] });
      qc.invalidateQueries({ queryKey: ['vaccine-countries'] });
      toast({ title: tr("adminvaccines_saxlanildi_66ffe7", "Saxlan\u0131ld\u0131") });
      setCountryDlg(null);
    },
    onError: (e: any) => toast({ title: tr("adminvaccines_xeta_3cdbb6", "X\u0259ta"), description: e.message, variant: 'destructive' })
  });

  const delCountry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vaccine_countries' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vaccine-countries'] });
      toast({ title: 'Silindi' });
    }
  });

  const saveVaccine = useMutation({
    mutationFn: async (v: Partial<Vaccine>) => {
      const payload = { ...v, country_code: country };
      if (v.id) {
        const { error } = await supabase.from('vaccines' as any).update(payload).eq('id', v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vaccines' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vaccines', country] });
      toast({ title: tr("adminvaccines_saxlanildi_66ffe7", "Saxlan\u0131ld\u0131") });
      setVaccineDlg(null);
    },
    onError: (e: any) => toast({ title: tr("adminvaccines_xeta_3cdbb6", "X\u0259ta"), description: e.message, variant: 'destructive' })
  });

  const delVaccine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vaccines' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vaccines', country] });
      qc.invalidateQueries({ queryKey: ['admin-schedules', country] });
      toast({ title: 'Silindi' });
    }
  });

  const saveSchedule = useMutation({
    mutationFn: async (s: Partial<VaccineSchedule>) => {
      const payload = { ...s, country_code: country };
      if (s.id) {
        const { error } = await supabase.from('vaccine_schedules' as any).update(payload).eq('id', s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vaccine_schedules' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedules', country] });
      toast({ title: tr("adminvaccines_saxlanildi_66ffe7", "Saxlan\u0131ld\u0131") });
      setScheduleDlg(null);
    },
    onError: (e: any) => toast({ title: tr("adminvaccines_xeta_3cdbb6", "X\u0259ta"), description: e.message, variant: 'destructive' })
  });

  const delSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vaccine_schedules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-schedules', country] });
      toast({ title: 'Silindi' });
    }
  });

  const copyToCountry = useMutation({
    mutationFn: async (targetCode: string) => {
      // copy vaccines
      const { data: existingTargets } = await supabase.
      from('vaccines' as any).select('code').eq('country_code', targetCode);
      const existingCodes = new Set((existingTargets || []).map((v: any) => v.code));

      const newVaccines = vaccines.
      filter((v) => !existingCodes.has(v.code)).
      map(({ id, country_code, ...rest }) => ({ ...rest, country_code: targetCode }));

      if (newVaccines.length === 0) {
        throw new Error(tr("adminvaccines_hedef_olkede_artiq_bu_peyvendl_f64176", "H\u0259d\u0259f \xF6lk\u0259d\u0259 art\u0131q bu peyv\u0259ndl\u0259rin ham\u0131s\u0131 var"));
      }

      const { data: inserted, error: insErr } = await supabase.
      from('vaccines' as any).insert(newVaccines).select();
      if (insErr) throw insErr;

      // map old vaccine_id (by code) -> new id
      const codeToNewId = new Map((inserted as any[]).map((v) => [v.code, v.id]));
      const newSchedules = schedules.
      filter((s) => {
        const v = vaccines.find((vv) => vv.id === s.vaccine_id);
        return v && codeToNewId.has(v.code);
      }).
      map(({ id, vaccine_id, country_code, ...rest }) => {
        const v = vaccines.find((vv) => vv.id === vaccine_id)!;
        return { ...rest, vaccine_id: codeToNewId.get(v.code)!, country_code: targetCode };
      });

      if (newSchedules.length > 0) {
        const { error: schErr } = await supabase.from('vaccine_schedules' as any).insert(newSchedules);
        if (schErr) throw schErr;
      }
      return newVaccines.length;
    },
    onSuccess: (n) => {
      toast({ title: tr("adminvaccines_kocuruldu_e03fb0", "K\xF6\xE7\xFCr\xFCld\xFC"), description: `${n} peyvənd köçürüldü.` });
      setCopyDlg(false);
      qc.invalidateQueries({ queryKey: ['admin-vaccines'] });
      qc.invalidateQueries({ queryKey: ['admin-schedules'] });
    },
    onError: (e: any) => toast({ title: tr("adminvaccines_xeta_3cdbb6", "X\u0259ta"), description: e.message, variant: 'destructive' })
  });

  const vaccinesById = useMemo(() => new Map(vaccines.map((v) => [v.id, v])), [vaccines]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Syringe className="w-5 h-5 text-rose-500" /> {tr("adminvaccines_peyvend_teqvimi_d84c87", "Peyv\u0259nd T\u0259qvimi")}
          </h1>
          <p className="text-xs text-muted-foreground">{tr("adminvaccines_olkeye_gore_peyvendler_ve_qraf_b168bc", "\xD6lk\u0259y\u0259 g\xF6r\u0259 peyv\u0259ndl\u0259r v\u0259 qrafik")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {countries.map((c) =>
              <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.name_az}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setCopyDlg(true)} disabled={vaccines.length === 0}>
            <Copy className="w-4 h-4 me-1" /> {tr("adminvaccines_kocur_5a87f7", "K\xF6\xE7\xFCr")}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="countries"><Globe className="w-3.5 h-3.5 me-1" />{tr("adminvaccines_olkeler_dd8fd5", "\xD6lk\u0259l\u0259r")}</TabsTrigger>
          <TabsTrigger value="vaccines"><Syringe className="w-3.5 h-3.5 me-1" />{tr("adminvaccines_peyvendler_093a96", "Peyv\u0259ndl\u0259r")}</TabsTrigger>
          <TabsTrigger value="schedules"><Calendar className="w-3.5 h-3.5 me-1" />Qrafik</TabsTrigger>
        </TabsList>

        {/* Countries */}
        <TabsContent value="countries" className="space-y-2 mt-3">
          <Button size="sm" onClick={() => setCountryDlg({ is_active: true, sort_order: countries.length, flag_emoji: '🌍' })}>
            <Plus className="w-4 h-4 me-1" /> {tr("adminvaccines_yeni_olke_561985", "Yeni \xF6lk\u0259")}
          </Button>
          {countries.map((c) =>
          <Card key={c.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.flag_emoji}</span>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {c.name_az}
                    {c.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">default</span>}
                    {!c.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700">deaktiv</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.code} • {c.name_en}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setCountryDlg(c)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                if (confirm(`${c.name_az} silinsin? Bütün peyvəndlər də silinəcək.`)) delCountry.mutate(c.id);
              }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Vaccines */}
        <TabsContent value="vaccines" className="space-y-2 mt-3">
          <Button size="sm" onClick={() => setVaccineDlg({ is_mandatory: true, is_active: true, sort_order: vaccines.length, color_hex: '#F28155' })}>
            <Plus className="w-4 h-4 me-1" /> {tr("adminvaccines_yeni_peyvend_c3cef1", "Yeni peyv\u0259nd")}
          </Button>
          {vaccines.map((v) =>
          <Card key={v.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${v.color_hex || '#F28155'}1a`, color: v.color_hex || '#F28155' }}>
                    <Syringe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{v.name_az}</div>
                    <div className="text-[11px] text-muted-foreground">{v.code} • {v.disease_az}</div>
                    {v.short_description_az && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{v.short_description_az}</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setVaccineDlg(v)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                  if (confirm(`${v.name_az} silinsin? Bütün dozalar da silinəcək.`)) delVaccine.mutate(v.id);
                }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Schedules */}
        <TabsContent value="schedules" className="space-y-2 mt-3">
          <Button size="sm" onClick={() => setScheduleDlg({ dose_number: 1, recommended_age_days: 0, sort_order: schedules.length })}>
            <Plus className="w-4 h-4 me-1" /> Yeni doza
          </Button>
          {schedules.map((s) => {
            const v = vaccinesById.get(s.vaccine_id);
            return (
              <Card key={s.id} className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{v?.name_az || '—'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.age_label_az} • {s.dose_label_az} • {s.recommended_age_days} {tr("adminvaccines_gun_54e78d", "g\xFCn")}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setScheduleDlg(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => {
                    if (confirm('Bu doza silinsin?')) delSchedule.mutate(s.id);
                  }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>);

          })}
        </TabsContent>
      </Tabs>

      {/* Country dialog */}
      <Dialog open={!!countryDlg} onOpenChange={(o) => !o && setCountryDlg(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{countryDlg?.id ? tr("adminvaccines_olkeni_redakte_et_3057d4", "\xD6lk\u0259ni redakt\u0259 et") : tr("adminvaccines_yeni_olke_561985", "Yeni \xF6lk\u0259")}</DialogTitle></DialogHeader>
          {countryDlg && (
            <div className="space-y-3">
              <Field label={tr("adminvaccines_kod_mes_az_tr_aa7b00", "Kod (məs. AZ, TR)")}><Input value={countryDlg.code || ''} onChange={(e) => setCountryDlg({ ...countryDlg, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Ad (AZ)"><LocalizedInput formData={countryDlg} setFormData={setCountryDlg} field="name" label="Name" /></Field>
              <Field label="Ad (EN)"><Input value={countryDlg.name_en || ''} onChange={(e) => setCountryDlg({ ...countryDlg, name_en: e.target.value })} /></Field>
              <Field label="Bayraq emoji"><Input value={countryDlg.flag_emoji || ''} onChange={(e) => setCountryDlg({ ...countryDlg, flag_emoji: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_menbe_url_f7f4f2", "M\u0259nb\u0259 URL")}><Input value={countryDlg.source_url || ''} onChange={(e) => setCountryDlg({ ...countryDlg, source_url: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_menbe_adi_72a959", "M\u0259nb\u0259 ad\u0131")}><Input value={countryDlg.source_label || ''} onChange={(e) => setCountryDlg({ ...countryDlg, source_label: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_sira_421c5f", "S\u0131ra")}><Input type="number" value={countryDlg.sort_order ?? 0} onChange={(e) => setCountryDlg({ ...countryDlg, sort_order: +e.target.value })} /></Field>
              <ToggleRow label="Aktiv" value={!!countryDlg.is_active} onChange={(v) => setCountryDlg({ ...countryDlg, is_active: v })} />
              <ToggleRow label="Default" value={!!countryDlg.is_default} onChange={(v) => setCountryDlg({ ...countryDlg, is_default: v })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCountryDlg(null)}>{tr("adminvaccines_legv_f7100a", "L\u0259\u011Fv")}</Button>
            <Button onClick={() => countryDlg && saveCountry.mutate(countryDlg)}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vaccine dialog */}
      <Dialog open={!!vaccineDlg} onOpenChange={(o) => !o && setVaccineDlg(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{vaccineDlg?.id ? tr("adminvaccines_peyvendi_redakte_et_667d25", "Peyv\u0259ndi redakt\u0259 et") : tr("adminvaccines_yeni_peyvend_c3cef1", "Yeni peyv\u0259nd")}</DialogTitle></DialogHeader>
          {vaccineDlg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Kod"><Input value={vaccineDlg.code || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, code: e.target.value })} /></Field>
                <Field label={tr("adminvaccines_reng_hex_3c8123", "R\u0259ng (hex)")}><Input value={vaccineDlg.color_hex || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, color_hex: e.target.value })} /></Field>
              </div>
              <Field label="Ad (AZ)"><LocalizedInput formData={vaccineDlg} setFormData={setVaccineDlg} field="name" label="Name" /></Field>
              <Field label="Ad (EN)"><Input value={vaccineDlg.name_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, name_en: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_qisa_tesvir_az_693f19", "Qısa təsvir (AZ)")}><LocalizedTextarea formData={vaccineDlg} setFormData={setVaccineDlg} field="short_description" label="Short_description" rows={2} /></Field>
              <Field label="Qısa təsvir (EN)"><Textarea rows={2} value={vaccineDlg.short_description_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, short_description_en: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_tam_tesvir_az_d57f71", "Tam təsvir (AZ)")}><LocalizedTextarea formData={vaccineDlg} setFormData={setVaccineDlg} field="full_description" label="Full_description" rows={4} /></Field>
              <Field label="Tam təsvir (EN)"><Textarea rows={4} value={vaccineDlg.full_description_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, full_description_en: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr("adminvaccines_qarsisi_alinan_xestelik_862a71", "Qarşısı alınan xəstəlik")}><LocalizedInput formData={vaccineDlg} setFormData={setVaccineDlg} field="disease" label="Disease" /></Field>
                <Field label="Disease (EN)"><Input value={vaccineDlg.disease_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, disease_en: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr("adminvaccines_vurma_usulu_689cd3", "Vurma üsulu")}><LocalizedInput formData={vaccineDlg} setFormData={setVaccineDlg} field="route" label="Route" /></Field>
                <Field label="Route (EN)"><Input value={vaccineDlg.route_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, route_en: e.target.value })} /></Field>
              </div>
              <Field label={tr("adminvaccines_yan_tesirler_426f38", "Yan təsirlər")}><LocalizedTextarea formData={vaccineDlg} setFormData={setVaccineDlg} field="side_effects" label="Side_effects" rows={2} /></Field>
              <Field label="Side effects (EN)"><Textarea rows={2} value={vaccineDlg.side_effects_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, side_effects_en: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_eks_gosterisler_f34875", "Əks-göstərişlər")}><LocalizedTextarea formData={vaccineDlg} setFormData={setVaccineDlg} field="contraindications" label="Contraindications" rows={2} /></Field>
              <Field label="Contraindications (EN)"><Textarea rows={2} value={vaccineDlg.contraindications_en || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, contraindications_en: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_menbe_url_f7f4f2", "M\u0259nb\u0259 URL")}><Input value={vaccineDlg.source_url || ''} onChange={(e) => setVaccineDlg({ ...vaccineDlg, source_url: e.target.value })} /></Field>
              <Field label={tr("adminvaccines_sira_421c5f", "S\u0131ra")}><Input type="number" value={vaccineDlg.sort_order ?? 0} onChange={(e) => setVaccineDlg({ ...vaccineDlg, sort_order: +e.target.value })} /></Field>
              <ToggleRow label={tr("adminvaccines_mecburi_ffc711", "M\u0259cburi")} value={!!vaccineDlg.is_mandatory} onChange={(v) => setVaccineDlg({ ...vaccineDlg, is_mandatory: v })} />
              <ToggleRow label="Aktiv" value={!!vaccineDlg.is_active} onChange={(v) => setVaccineDlg({ ...vaccineDlg, is_active: v })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVaccineDlg(null)}>{tr("adminvaccines_legv_f7100a", "L\u0259\u011Fv")}</Button>
            <Button onClick={() => vaccineDlg && saveVaccine.mutate(vaccineDlg)}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={!!scheduleDlg} onOpenChange={(o) => !o && setScheduleDlg(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{scheduleDlg?.id ? tr("adminvaccines_dozani_redakte_et_c51553", "Dozan\u0131 redakt\u0259 et") : 'Yeni doza'}</DialogTitle></DialogHeader>
          {scheduleDlg && (
            <div className="space-y-3">
              <Field label="Peyvənd">
                <Select value={scheduleDlg.vaccine_id || ''} onValueChange={v => setScheduleDlg({ ...scheduleDlg, vaccine_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                  <SelectContent>
                    {vaccines.map(v => <SelectItem key={v.id} value={v.id}>{v.name_az}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Doza №"><Input type="number" value={scheduleDlg.dose_number ?? 1} onChange={e => setScheduleDlg({ ...scheduleDlg, dose_number: +e.target.value })} /></Field>
                <Field label="Sıra"><Input type="number" value={scheduleDlg.sort_order ?? 0} onChange={e => setScheduleDlg({ ...scheduleDlg, sort_order: +e.target.value })} /></Field>
              </div>
              <Field label="Doza adı (məs. 1-ci doza)"><LocalizedInput formData={scheduleDlg} setFormData={setScheduleDlg} field="dose_label" label="Dose_label" /></Field>
              <Field label="Yaş etiketi (məs. 2 aylıq)"><LocalizedInput formData={scheduleDlg} setFormData={setScheduleDlg} field="age_label" label="Age_label" /></Field>
              <Field label="Tövsiyə olunan yaş (günlə)"><Input type="number" value={scheduleDlg.recommended_age_days ?? 0} onChange={e => setScheduleDlg({ ...scheduleDlg, recommended_age_days: +e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Min yaş (günlə)"><Input type="number" value={scheduleDlg.min_age_days ?? ''} onChange={e => setScheduleDlg({ ...scheduleDlg, min_age_days: e.target.value === '' ? null : +e.target.value })} /></Field>
                <Field label="Max yaş (günlə)"><Input type="number" value={scheduleDlg.max_age_days ?? ''} onChange={e => setScheduleDlg({ ...scheduleDlg, max_age_days: e.target.value === '' ? null : +e.target.value })} /></Field>
              </div>
              <Field label="Qeyd"><LocalizedTextarea formData={scheduleDlg} setFormData={setScheduleDlg} field="notes" label="Notes" rows={2} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleDlg(null)}>{tr("adminvaccines_legv_f7100a", "Ləğv")}</Button>
            <Button onClick={() => scheduleDlg && saveSchedule.mutate(scheduleDlg)}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy dialog */}
      <Dialog open={copyDlg} onOpenChange={setCopyDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tr("adminvaccines_peyvendleri_basqa_olkeye_kocur_efdaad", "Peyv\u0259ndl\u0259ri ba\u015Fqa \xF6lk\u0259y\u0259 k\xF6\xE7\xFCr")}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            <strong>{country}</strong> {tr("adminvaccines_olkesi_ucun_hazirlanmis_butun__02fbdf", "\xF6lk\u0259si \xFC\xE7\xFCn haz\u0131rlanm\u0131\u015F b\xFCt\xFCn peyv\u0259ndl\u0259r v\u0259 qrafik h\u0259d\u0259f \xF6lk\u0259y\u0259 k\xF6\xE7\xFCr\xFCl\u0259c\u0259k.")}
          </p>
          <Field label={tr("adminvaccines_hedef_olke_58e12e", "H\u0259d\u0259f \xF6lk\u0259")}>
            <Select value={copyTarget} onValueChange={setCopyTarget}>
              <SelectTrigger><SelectValue placeholder={tr("adminvaccines_sec_ac5416", "Se\xE7...")} /></SelectTrigger>
              <SelectContent>
                {countries.filter((c) => c.code !== country).map((c) =>
                <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.name_az}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCopyDlg(false)}>{tr("adminvaccines_legv_f7100a", "L\u0259\u011Fv")}</Button>
            <Button disabled={!copyTarget} onClick={() => copyToCountry.mutate(copyTarget)}>{tr("adminvaccines_kocur_5a87f7", "K\xF6\xE7\xFCr")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}

function Field({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>);

}

function ToggleRow({ label, value, onChange }: {label: string;value: boolean;onChange: (v: boolean) => void;}) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>);

}