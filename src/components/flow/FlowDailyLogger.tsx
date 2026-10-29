import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile, Frown, Meh, Heart, Moon, Thermometer,
  Droplets, ChevronDown, ChevronUp, Check, Plus,
  Zap, CloudRain, Sun, Sparkles } from
'lucide-react';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFlowDailyLog, useSaveFlowDailyLog, useFlowSymptoms, FlowDailyLog } from '@/hooks/useFlowDailyLogs';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";
import { usePeriodDayLogs } from '@/hooks/usePeriodDayLogs';
import { periodFlowLabel } from '@/lib/period-flow';

interface FlowDailyLoggerProps {
  date?: Date;
  compact?: boolean;
  onSave?: () => void;
}

const MOOD_OPTIONS = [
{ value: 1, emoji: '😢', label: tr("flowdailylogger_cox_pis_e041c5", 'Çox pis'), color: 'bg-red-100 border-red-300 text-red-700' },
{ value: 2, emoji: '😔', label: tr("common_pis", 'Pis'), color: 'bg-orange-100 border-orange-300 text-orange-700' },
{ value: 3, emoji: '😐', label: 'Normal', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
{ value: 4, emoji: '😊', label: tr("flowdailylogger_yaxsi_9d8595", 'Yaxşı'), color: 'bg-green-100 border-green-300 text-green-700' },
{ value: 5, emoji: '🥰', label: tr("flowdailylogger_ela_720a0e", 'Əla'), color: 'bg-pink-100 border-pink-300 text-pink-700' }];


const ENERGY_OPTIONS = [
{ value: 1, icon: CloudRain, label: tr("flowdailylogger_cox_asagi_e45510", 'Çox aşağı'), color: 'text-slate-400' },
{ value: 2, icon: Meh, label: tr("flowdailylogger_asagi_1c27f1", 'Aşağı'), color: 'text-slate-500' },
{ value: 3, icon: Sun, label: 'Normal', color: 'text-yellow-500' },
{ value: 4, icon: Zap, label: tr("flowdailylogger_yuksek_492584", 'Yüksək'), color: 'text-orange-500' },
{ value: 5, icon: Sparkles, label: tr("flowdailylogger_cox_yuksek_c4d475", 'Çox yüksək'), color: 'text-amber-500' }];


const flowOptions = () => [
{ value: 'unspecified', label: tr('flow_had_flow', 'Axın oldu'), emoji: '🩸', color: 'bg-red-100' },
{ value: 'none', label: tr("common_yoxdur", 'Yoxdur'), emoji: '⚪', color: 'bg-slate-100' },
{ value: 'spotting', label: tr("flowdailylogger_lekelenme_8e7b1e", 'Ləkələnmə'), emoji: '🔵', color: 'bg-blue-100' },
{ value: 'light', label: tr("flowdailylogger_yungul_2a8010", 'Yüngül'), emoji: '🩸', color: 'bg-red-100' },
{ value: 'medium', label: tr("common_orta", 'Orta'), emoji: '🩸🩸', color: 'bg-red-200' },
{ value: 'heavy', label: tr("flowdailylogger_guclu_0fda31", 'Güclü'), emoji: '🩸🩸🩸', color: 'bg-red-300' }];


const SLEEP_QUALITY = [
{ value: 1, label: tr("flowdailylogger_cox_pis_e041c5", 'Çox pis'), emoji: '😫' },
{ value: 2, label: tr("common_pis", 'Pis'), emoji: '😴' },
{ value: 3, label: 'Normal', emoji: '😐' },
{ value: 4, label: tr("flowdailylogger_yaxsi_9d8595", 'Yaxşı'), emoji: '😌' },
{ value: 5, label: tr("flowdailylogger_ela_720a0e", 'Əla'), emoji: '😇' }];


// Flow P0: servikal maye (fertillik göstəricisi)
const MUCUS_OPTIONS = [
{ value: 'dry', label: tr("flowdailylogger_mucus_dry", 'Quru'), emoji: '🏜️' },
{ value: 'sticky', label: tr("flowdailylogger_mucus_sticky", 'Yapışqan'), emoji: '🍯' },
{ value: 'creamy', label: tr("flowdailylogger_mucus_creamy", 'Kremvari'), emoji: '🥛' },
{ value: 'watery', label: tr("flowdailylogger_mucus_watery", 'Sulu'), emoji: '💧' },
{ value: 'eggwhite', label: tr("flowdailylogger_mucus_eggwhite", 'Yumurta ağı'), emoji: '🥚' }];


// Flow P0: cinsi əlaqə
const SEX_OPTIONS = [
{ value: 'none', label: tr("common_yoxdur", 'Yoxdur'), emoji: '➖' },
{ value: 'protected', label: tr("flowdailylogger_sex_protected", 'Qorunmalı'), emoji: '🛡️' },
{ value: 'unprotected', label: tr("flowdailylogger_sex_unprotected", 'Qorunmasız'), emoji: '💞' }];


// Flow P0: libido
const LIBIDO_OPTIONS = [
{ value: 1, label: tr("flowdailylogger_asagi_1c27f1", 'Aşağı'), emoji: '🤍' },
{ value: 2, label: tr("common_orta", 'Orta'), emoji: '💗' },
{ value: 3, label: tr("flowdailylogger_yuksek_492584", 'Yüksək'), emoji: '❤️‍🔥' }];


// Flow P1: ovulyasiya (OPK/LH) testi
const OPK_OPTIONS = [
{ value: 'negative', label: tr("flowdailylogger_opk_negative", 'Mənfi'), emoji: '➖' },
{ value: 'positive', label: tr("flowdailylogger_opk_positive", 'Müsbət'), emoji: '➕' },
{ value: 'peak', label: tr("flowdailylogger_opk_peak", 'Pik'), emoji: '🌟' }];


const FlowDailyLogger = ({ date = new Date(), compact = false, onSave }: FlowDailyLoggerProps) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: existingLog, isLoading } = useFlowDailyLog(dateStr);
  const { data: periodLogs = [] } = usePeriodDayLogs();
  const periodLog = periodLogs.find(log => log.log_date === dateStr);
  const existingFlow = periodLog ? periodFlowLabel(periodLog.flow_intensity) : existingLog?.flow_intensity ?? null;
  const { data: symptoms = [] } = useFlowSymptoms();
  const saveLog = useSaveFlowDailyLog();
  const language = useUserStore((s) => s.language);

  const [expanded, setExpanded] = useState(!compact);
  const [flowEdited, setFlowEdited] = useState(false);
  const [formData, setFormData] = useState<Partial<FlowDailyLog>>({
    mood: null,
    energy_level: null,
    symptoms: [],
    pain_level: null,
    flow_intensity: null,
    sleep_hours: null,
    sleep_quality: null,
    temperature: null,
    water_glasses: 0,
    notes: null,
    cervical_mucus: null,
    sexual_activity: null,
    libido: null,
    ovulation_test: null
  });

  useEffect(() => {
      setFormData({
        mood: existingLog?.mood ?? null,
        energy_level: existingLog?.energy_level ?? null,
        symptoms: existingLog?.symptoms || [],
        pain_level: existingLog?.pain_level ?? null,
        flow_intensity: existingFlow,
        sleep_hours: existingLog?.sleep_hours ?? null,
        sleep_quality: existingLog?.sleep_quality ?? null,
        temperature: existingLog?.temperature ?? null,
        water_glasses: existingLog?.water_glasses || 0,
        notes: existingLog?.notes ?? null,
        cervical_mucus: existingLog?.cervical_mucus ?? null,
        sexual_activity: existingLog?.sexual_activity ?? null,
        libido: existingLog?.libido ?? null,
        ovulation_test: existingLog?.ovulation_test ?? null
      });
      setFlowEdited(false);
  }, [dateStr, existingLog, existingFlow]);

  const toggleSymptom = (symptomKey: string) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms?.includes(symptomKey) ?
      prev.symptoms.filter((s) => s !== symptomKey) :
      [...(prev.symptoms || []), symptomKey]
    }));
  };

  const handleSave = async () => {
    try {
      await saveLog.mutateAsync({
        log_date: dateStr,
        ...formData,
        flow_intensity: flowEdited ? formData.flow_intensity : undefined,
      });
      toast.success(tr("flowdailylogger_gundelik_qeyd_saxlanildi_03bc8a", "G\xFCnd\u0259lik qeyd saxlan\u0131ld\u0131!"));
      onSave?.();
    } catch (error) {
      toast.error(tr("flowdailylogger_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify({
    mood: existingLog?.mood ?? null,
    energy_level: existingLog?.energy_level ?? null,
    symptoms: existingLog?.symptoms || [],
    pain_level: existingLog?.pain_level ?? null,
    flow_intensity: existingFlow,
    sleep_hours: existingLog?.sleep_hours ?? null,
    sleep_quality: existingLog?.sleep_quality ?? null,
    temperature: existingLog?.temperature ?? null,
    water_glasses: existingLog?.water_glasses || 0,
    notes: existingLog?.notes ?? null,
    cervical_mucus: (existingLog as any)?.cervical_mucus ?? null,
    sexual_activity: (existingLog as any)?.sexual_activity ?? null,
    libido: (existingLog as any)?.libido ?? null,
    ovulation_test: (existingLog as any)?.ovulation_test ?? null
  });

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ height: 48, borderRadius: 14, background: 'var(--a-surface-soft)' }} />
      </div>);

  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in"
      style={{ padding: 0, overflow: 'hidden' }}>
      
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="a-list-row w-full"
        style={{ width: '100%', textAlign: 'start', background: 'none', border: 'none', borderTop: 'none', cursor: 'pointer', padding: '16px 18px' }}>
        
        <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
          <Heart size={17} strokeWidth={2} />
        </span>
        <div>
          <p className="a-list-title">{tr("flowdailylogger_gundelik_qeyd_32e154", "Gündəlik Qeyd")}</p>
          <p className="a-list-sub">
            {format(date, 'd MMMM, EEEE', { locale: getCurrentDateLocale() })}
          </p>
        </div>
        <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {existingLog &&
          <span className="a-tag on" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={11} /> {tr("flowdailylogger_doldurulub", "Doldurulub")}
            </span>
          }
          {expanded ? <ChevronUp size={17} className="a-list-chevron" /> : <ChevronDown size={17} className="a-list-chevron" />}
        </span>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{ borderTop: '1px solid var(--a-line)' }}>
          
            <div className="p-4 space-y-6">
              {/* Mood */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">{tr("flowdailylogger_ehval_0457f9", "Əhval")}</label>
                <div className="flex gap-2 justify-between">
                  {MOOD_OPTIONS.map((option) =>
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({ ...prev, mood: option.value }))}
                  className={`flex-1 py-3 rounded-xl text-center transition-all ${
                  formData.mood === option.value ?
                  `${option.color} border-2 scale-105` :
                  'bg-muted hover:bg-muted/80 border-2 border-transparent'}`
                  }>
                  
                      <span className="text-2xl">{option.emoji}</span>
                      <p className="text-[10px] mt-1 font-medium">{option.label}</p>
                    </button>
                )}
                </div>
              </div>

              {/* Energy */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">{tr("flowdailylogger_enerji_seviyyesi_961691", "Enerji Səviyyəsi")}</label>
                <div className="flex gap-2 justify-between">
                  {ENERGY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setFormData((prev) => ({ ...prev, energy_level: option.value }))}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${
                      formData.energy_level === option.value ?
                      'bg-primary/10 border-2 border-primary scale-105' :
                      'bg-muted hover:bg-muted/80 border-2 border-transparent'}`
                      }>
                      
                        <Icon className={`w-6 h-6 mx-auto ${option.color}`} />
                        <p className="text-[10px] mt-1 font-medium">{option.label}</p>
                      </button>);

                })}
                </div>
              </div>

              {/* Flow Intensity */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-red-500" /> {tr("flowdailylogger_qanaxma_e42bdc", "Qanaxma")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {flowOptions().map((option) =>
                <button
                  key={option.value}
                  aria-pressed={formData.flow_intensity === option.value}
                  onClick={() => { setFlowEdited(true); setFormData((prev) => ({
                    ...prev,
                    flow_intensity: option.value as FlowDailyLog['flow_intensity']
                  })); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  formData.flow_intensity === option.value ?
                  `${option.color} border-2 border-red-300` :
                  'bg-muted hover:bg-muted/80 border-2 border-transparent'}`
                  }>
                  
                      {option.emoji} {option.label}
                    </button>
                )}
                </div>
              </div>

              {/* Servikal maye (Flow P0) */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  {tr("flowdailylogger_servikal_maye", "Servikal maye")}
                  <span className="ms-1.5" style={{ fontSize: 11, fontWeight: 500, color: 'var(--a-ink-soft)' }}>
                    ({tr("flowdailylogger_fertillik_gostericisi", "fertillik göstəricisi")})
                  </span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {MUCUS_OPTIONS.map((option) =>
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({
                    ...prev,
                    cervical_mucus: prev.cervical_mucus === option.value ? null : option.value as FlowDailyLog['cervical_mucus']
                  }))}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: formData.cervical_mucus === option.value ? 'var(--a-blue-1)' : 'var(--a-surface-soft)',
                    color: formData.cervical_mucus === option.value ? 'var(--a-blue-ink)' : 'var(--a-ink-soft)',
                    border: formData.cervical_mucus === option.value ? '2px solid var(--a-blue-2)' : '2px solid transparent'
                  }}>

                      {option.emoji} {option.label}
                    </button>
                )}
                </div>
              </div>

              {/* Ovulyasiya testi (Flow P1) */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  {tr("flowdailylogger_ovulyasiya_testi", "Ovulyasiya testi")}
                  <span className="ms-1.5" style={{ fontSize: 11, fontWeight: 500, color: 'var(--a-ink-soft)' }}>
                    (OPK/LH)
                  </span>
                </label>
                <div className="flex gap-2">
                  {OPK_OPTIONS.map((option) =>
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({
                    ...prev,
                    ovulation_test: prev.ovulation_test === option.value ? null : option.value as FlowDailyLog['ovulation_test']
                  }))}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: formData.ovulation_test === option.value ? 'var(--a-green-1)' : 'var(--a-surface-soft)',
                    color: formData.ovulation_test === option.value ? 'var(--a-green-ink)' : 'var(--a-ink-soft)',
                    border: formData.ovulation_test === option.value ? '2px solid var(--a-green-2)' : '2px solid transparent'
                  }}>

                      {option.emoji} {option.label}
                    </button>
                )}
                </div>
                {(formData.ovulation_test === 'positive' || formData.ovulation_test === 'peak') &&
              <p className="text-xs mt-2" style={{ color: 'var(--a-green-ink)', fontWeight: 600 }}>
                    {formData.ovulation_test === 'peak' ?
                tr("flowdailylogger_opk_peak_hint", "🌟 Pik LH — ovulyasiya təxminən 24 saat ərzində gözlənilir") :
                tr("flowdailylogger_opk_positive_hint", "➕ LH yüksəlişi — ovulyasiya 24-36 saat ərzində gözlənilir")}
                  </p>
              }
              </div>

              {/* Cinsi əlaqə + Libido (Flow P0) */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    {tr("flowdailylogger_cinsi_elaqe", "Cinsi əlaqə")}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SEX_OPTIONS.map((option) =>
                  <button
                    key={option.value}
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      sexual_activity: prev.sexual_activity === option.value ? null : option.value as FlowDailyLog['sexual_activity']
                    }))}
                    className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: formData.sexual_activity === option.value ? 'var(--a-pink-1)' : 'var(--a-surface-soft)',
                      color: formData.sexual_activity === option.value ? 'var(--a-pink-ink)' : 'var(--a-ink-soft)',
                      border: formData.sexual_activity === option.value ? '2px solid var(--a-pink-2)' : '2px solid transparent'
                    }}>

                        {option.emoji} {option.label}
                      </button>
                  )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    {tr("flowdailylogger_libido", "Libido")}
                  </label>
                  <div className="flex gap-2">
                    {LIBIDO_OPTIONS.map((option) =>
                  <button
                    key={option.value}
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      libido: prev.libido === option.value ? null : option.value
                    }))}
                    className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: formData.libido === option.value ? 'var(--a-pink-1)' : 'var(--a-surface-soft)',
                      color: formData.libido === option.value ? 'var(--a-pink-ink)' : 'var(--a-ink-soft)',
                      border: formData.libido === option.value ? '2px solid var(--a-pink-2)' : '2px solid transparent'
                    }}>

                        {option.emoji} {option.label}
                      </button>
                  )}
                  </div>
                </div>
              </div>

              {/* Pain Level */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  {tr("flowdailylogger_agri_seviyyesi_57b383", "A\u011Fr\u0131 S\u0259viyy\u0259si:")} {formData.pain_level ?? 0}/10
                </label>
                <Slider
                value={[formData.pain_level ?? 0]}
                onValueChange={([value]) => setFormData((prev) => ({ ...prev, pain_level: value }))}
                max={10}
                step={1}
                className="w-full" />
              
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{tr("flowdailylogger_agri_yoxdur_25522a", "Ağrı yoxdur")}</span>
                  <span>{tr("flowdailylogger_cox_agrili_ee7bd3", "Çox ağrılı")}</span>
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">{tr("untranslated_simptomlar_xhm7bx", "Simptomlar")}</label>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom) =>
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.symptom_key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  formData.symptoms?.includes(symptom.symptom_key) ?
                  'bg-primary text-primary-foreground' :
                  'bg-muted hover:bg-muted/80 text-muted-foreground'}`
                  }>
                  
                      {symptom.emoji} {language === 'en' ? symptom.label : (symptom.label_az || symptom.label)}
                    </button>
                )}
                </div>
              </div>

              {/* Sleep */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-500" /> {tr("flowdailylogger_yuxu_saat_33bd1e", "Yuxu (saat)")}
                  </label>
                  <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={formData.sleep_hours ?? ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    sleep_hours: e.target.value ? parseFloat(e.target.value) : null
                  }))}
                  placeholder="7.5"
                  className="text-center" />
                
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{tr("flowdailylogger_yuxu_keyfiyyeti_0bb5f7", "Yuxu Keyfiyyəti")}</label>
                  <div className="flex gap-1">
                    {SLEEP_QUALITY.map((option) =>
                  <button
                    key={option.value}
                    onClick={() => setFormData((prev) => ({ ...prev, sleep_quality: option.value }))}
                    className={`flex-1 py-2 rounded-lg text-lg transition-all ${
                    formData.sleep_quality === option.value ?
                    'bg-indigo-100 dark:bg-indigo-900/30 scale-110' :
                    'hover:bg-muted'}`
                    }
                    title={option.label}>
                    
                        {option.emoji}
                      </button>
                  )}
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-red-500" /> {tr("flowdailylogger_beden_temperaturu_c_527103", "B\u0259d\u0259n Temperaturu (\xB0C)")}
                </label>
                <Input
                type="number"
                min={35}
                max={42}
                step={0.1}
                value={formData.temperature ?? ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  temperature: e.target.value ? parseFloat(e.target.value) : null
                }))}
                placeholder="36.6"
                className="max-w-[150px]" />
              
                <p className="text-xs text-muted-foreground mt-1">
                  {tr("flowdailylogger_bbt_olcme_zamani_deqiq_netice__7b2954", "BBT \xF6l\xE7m\u0259 zaman\u0131 d\u0259qiq n\u0259tic\u0259 \xFC\xE7\xFCn s\u0259h\u0259r yuxudan durduqda \xF6l\xE7\xFCn")}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{tr("flowdailylogger_qeydler_a7a98b", "Qeydlər")}</label>
                <Textarea
                value={formData.notes ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value || null }))}
                placeholder={tr("flowdailylogger_bu_gun_haqqinda_qeydlerinizi_yazin_eca8f7", "Bu gün haqqında qeydlərinizi yazın...")}
                rows={3} />
              
              </div>

              {/* Save Button */}
              <Button
              onClick={handleSave}
              disabled={saveLog.isPending || !hasChanges}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white">
              
                {saveLog.isPending ? tr("flowdailylogger_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : existingLog ? tr("flowdailylogger_yenile_570ce2", "Yenil\u0259") : tr("flowdailylogger_saxla_7dcde1", "Saxla")}
              </Button>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

};

export default FlowDailyLogger;
