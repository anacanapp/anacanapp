import { useState, useMemo, useEffect, useRef } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calculator, Baby, FileText, ChevronRight,
  Banknote, Calendar, Info, CheckCircle2, AlertCircle, HelpCircle,
  Globe, CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays, subDays } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

import { useMaternityBenefits } from '@/hooks/useMaternityBenefits';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import MarkdownContent from '@/components/MarkdownContent';
import { tr } from "@/lib/tr";
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';

import { maternityRules, MaternityRule } from '@/data/maternityRules';
import { REGIONAL_MATERNITY_COUNTRIES, isRegionalMaternityCountry } from '@/lib/maternity-regional';
import { localizedCountryName } from '@/lib/app-languages';
import { regionalCountry } from '@/lib/vaccine-schedule';
import RegionalMaternityCalculator from './RegionalMaternityCalculator';

const maternityCountryCodes = [...new Set([...maternityRules.map(rule => rule.code), ...REGIONAL_MATERNITY_COUNTRIES])];

interface MaternityCalculatorProps {
  onBack: () => void;
}

const MaternityCalculator = ({ onBack }: MaternityCalculatorProps) => {
  useScreenAnalytics('MaternityCalculator', 'Tools');
  useScrollToTop();

  const language = useUserStore((state) => state.language);
  const isAZ = language === 'az';
  const storeCountryCode = useUserStore((state) => state.countryCode);
  const { profile } = useAuth();

  const { config, guidelines: dbGuidelines, loading, calculateBenefit } = useMaternityBenefits();
  const [activeTab, setActiveTab] = useState('calculator');
  const [salary, setSalary] = useState('');
  const [pregnancyType, setPregnancyType] = useState<'normal' | 'complicated' | 'multiple'>('normal');
  // Default ölkə İSTİFADƏÇİNİN HƏQİQİ ÖLKƏSİNƏ görə (əvvəllər səhvən UI dilinə görə seçilirdi,
  // məs. rus dilində olan Almaniyada yaşayan istifadəçi səhvən RU görürdü). Kalkulyator yalnız
  // 27 ölkəni dəstəklədiyi üçün siyahıda olmayan ölkələr üçün dilə-əsaslı təxminə enirik;
  // istifadəçi istənilən vaxt açılan siyahıdan dəyişə bilər.
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() => {
    const country = regionalCountry(language, profile?.country_code, storeCountryCode);
    return maternityCountryCodes.includes(country) ? country : 'AZ';
  });
  const countryChosen = useRef(false);
  useEffect(() => {
    if (countryChosen.current) return;
    const country = regionalCountry(language, profile?.country_code, storeCountryCode);
    if (maternityCountryCodes.includes(country)) setSelectedCountryCode(country);
  }, [profile?.country_code, storeCountryCode, language]);
  const [eddDate, setEddDate] = useState<string>('');
  const [role, setRole] = useState<'mother' | 'father'>('mother');

  // Profildə artıq bilinən doğum tarixini yenidən soruşmaq əvəzinə avtomatik doldur
  // (əvvəllər hər dəfə boş başlayırdı, halbuki WeightTracker kimi digər alətlər
  // artıq eyni profil məlumatını istifadə edir). İstifadəçi istənilən vaxt dəyişə bilər.
  useEffect(() => {
    if (eddDate) return;
    const knownDueDate = (profile as any)?.due_date;
    if (knownDueDate) {
      setEddDate(new Date(knownDueDate).toISOString().split('T')[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Profildə çoxdöllü hamiləlik (əkiz/üçüz/dördüz) varsa, hamiləlik növünü
  // avtomatik "Çoxdöllü" seç — istifadəçi istənilən vaxt əl ilə dəyişə bilər
  // (bəzi ölkələrdə hüquqi tərif tam üst-üstə düşməyə bilər).
  useEffect(() => {
    const isMultiples = !!profile?.multiples_type && profile.multiples_type !== 'single';
    if (isMultiples) setPregnancyType('multiple');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
  
  const [result, setResult] = useState<any>(null);
  const [expandedGuideline, setExpandedGuideline] = useState<string | null>(null);
  const chooseCountry = (country: string) => { countryChosen.current = true; setSelectedCountryCode(country); setResult(null); setSalary(''); };

  const selectedRule = useMemo(() => {
    return maternityRules.find(r => r.code === selectedCountryCode) || maternityRules[0];
  }, [selectedCountryCode]);

  const handleCalculate = () => {
    if (!eddDate) return;

    const edd = new Date(eddDate);
    if (isNaN(edd.getTime())) return;

    let daysBefore = 0;
    let daysAfter = 0;
    let leaveStartDate: Date;
    
    if (role === 'father') {
      // Paternity leave usually starts on or just after birth
      daysAfter = selectedRule.paternity?.days || 0;
      leaveStartDate = edd; // Father's leave starts on birth date
    } else {
      daysBefore = selectedRule.normalDaysBefore;
      daysAfter = selectedRule.normalDaysAfter;

      if (pregnancyType === 'complicated') {
        daysAfter = selectedRule.complicatedDaysAfter;
      } else if (pregnancyType === 'multiple') {
        daysBefore = selectedRule.multipleDaysBefore;
        daysAfter = selectedRule.multipleDaysAfter;
      }
      leaveStartDate = subDays(edd, daysBefore);
    }

    const totalDays = daysBefore + daysAfter;
    const leaveEndDate = addDays(leaveStartDate, totalDays > 0 ? totalDays - 1 : 0);
    const returnToWorkDate = addDays(leaveEndDate, 1);

    let benefitResult = null;
    
    // Calculate for AZ using backend config if possible (Mother only)
    if (selectedCountryCode === 'AZ' && config && role === 'mother') {
      const salaryNum = parseFloat(salary) || 0;
      benefitResult = {
        ...calculateBenefit(salaryNum, pregnancyType),
        currency: 'AZN',
        isNativeAz: true,
        formula: isAZ ? selectedRule.compensation?.formulaDescription_az : selectedRule.compensation?.formulaDescription_en
      };
    } else if (selectedRule.compensation && selectedRule.compensation.type !== 'UNPAID') {
      const salaryNum = parseFloat(salary) || 0;
      const comp = selectedRule.compensation;
      const dailyWage = salaryNum / 30.416; // Average days in month
      
      let dailyBenefit = 0;
      let totalBenefit = 0;
      
      if (comp.type === 'PERCENTAGE_UNCAPPED' || comp.type === 'PERCENTAGE_CAPPED') {
        dailyBenefit = dailyWage * ((comp.percentage || 100) / 100);
        
        if (comp.maxCapDaily && dailyBenefit > comp.maxCapDaily) dailyBenefit = comp.maxCapDaily;
        if (comp.minCapDaily && dailyBenefit < comp.minCapDaily) dailyBenefit = comp.minCapDaily;
        
        totalBenefit = dailyBenefit * totalDays;
        
        if (comp.maxCapTotal && totalBenefit > comp.maxCapTotal) totalBenefit = comp.maxCapTotal;
      } else if (comp.type === 'FLAT_RATE') {
        dailyBenefit = comp.flatRateDaily || 0;
        totalBenefit = dailyBenefit * totalDays;
      } else if (comp.type === 'COMPLEX') {
        if (selectedCountryCode === 'GB') {
          const firstPhaseDays = Math.min(totalDays, 42); // 6 weeks
          const secondPhaseDays = Math.max(0, Math.min(totalDays - 42, 231)); // 33 weeks
          const firstPhaseBenefit = (dailyWage * 0.9) * firstPhaseDays;
          const secondPhaseDaily = Math.min(26.29, dailyWage * 0.9);
          const secondPhaseBenefit = secondPhaseDaily * secondPhaseDays;
          totalBenefit = firstPhaseBenefit + secondPhaseBenefit;
        } else if (selectedCountryCode === 'AE') {
           const firstPhaseDays = Math.min(totalDays, 45);
           const secondPhaseDays = Math.max(0, Math.min(totalDays - 45, 15));
           totalBenefit = (dailyWage * firstPhaseDays) + (dailyWage * 0.5 * secondPhaseDays);
        }
      }
      
      benefitResult = {
        maternityBenefit: totalBenefit,
        dailySalary: dailyWage,
        totalBenefit: totalBenefit,
        isCustom: true,
        currency: comp.currency,
        formula: isAZ ? comp.formulaDescription_az : comp.formulaDescription_en
      };
    }
    
    if (role === 'father' && selectedRule.paternity) {
       benefitResult = {
         isPaternity: true,
         formula: isAZ ? selectedRule.paternity.payDescription_az : selectedRule.paternity.payDescription_en
       };
    }

    setResult({
      daysBefore,
      daysAfter,
      totalDays,
      leaveStartDate,
      leaveEndDate,
      returnToWorkDate,
      benefitResult,
      rule: selectedRule,
      role
    });
  };

  const pregnancyTypes = [
    {
      value: 'normal',
      label: tr("maternitycalculator_normal_hamilelik_fa223b", 'Normal hamiləlik'),
      description: isAZ ? `${selectedRule.normalDaysBefore + selectedRule.normalDaysAfter} gün` : `${selectedRule.normalDaysBefore + selectedRule.normalDaysAfter} days`,
      icon: '👶'
    },
    {
      value: 'complicated',
      label: tr("maternitycalculator_agir_dogus_3e1a6b", 'Ağır doğuş/Mürəkkəb'),
      description: isAZ ? `${selectedRule.normalDaysBefore + selectedRule.complicatedDaysAfter} gün` : `${selectedRule.normalDaysBefore + selectedRule.complicatedDaysAfter} days`,
      icon: '🏥'
    },
    {
      value: 'multiple',
      label: tr("maternitycalculator_coxdollu_hamilelik_e3c1aa", 'Çoxdöllü hamiləlik'),
      description: isAZ ? `${selectedRule.multipleDaysBefore + selectedRule.multipleDaysAfter} gün` : `${selectedRule.multipleDaysBefore + selectedRule.multipleDaysAfter} days`,
      icon: '👶👶'
    }
  ];

  const guidelines = selectedCountryCode === 'AZ' && dbGuidelines && dbGuidelines.length > 0 
    ? dbGuidelines.map(g => ({
        id: g.id,
        title: g.title,
        content: g.content,
        icon: g.icon || '⚖️'
      }))
    : (
      // Dil üzrə seçim: az→az, ru→ru||en, tr→tr||en, kk/uz/ka→ru||en (statik datada kk/uz/ka yoxdur), digər→en
      language === 'az' ? selectedRule.guidelines_az :
      language === 'ru' || language === 'kk' || language === 'uz' || language === 'ka' ? (selectedRule.guidelines_ru || selectedRule.guidelines_en) :
      language === 'tr' ? (selectedRule.guidelines_tr || selectedRule.guidelines_en) :
      selectedRule.guidelines_en
      ).map((g, i) => ({
        id: `guide-${i}`,
        title: g.title,
        content: g.content,
        icon: g.icon
      }));

  if (isRegionalMaternityCountry(selectedCountryCode)) return <RegionalMaternityCalculator key={selectedCountryCode} country={selectedCountryCode}
    countries={maternityCountryCodes} initialDueDate={eddDate || profile?.due_date?.slice(0, 10)} onCountryChange={chooseCountry} onBack={onBack} />;

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--a-bg)' }}>
        <div className="animate-spin w-8 h-8 rounded-full" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const dateLocale = getCurrentDateLocale();
  const formatDate = (date: Date) => format(date, 'dd MMMM yyyy', { locale: dateLocale });

  return (
    <div className="a-scope" style={{ background: 'var(--a-bg)', minHeight: '100%', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{localizedCountryName(selectedCountryCode, language)} {selectedRule.flag}</p>
              <p className="a3-tool-title">{tr("maternitycalculator_title_3c7a2d", "Dekret Kalkulyatoru")}</p>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-auto rounded-full p-[3px] border-0" style={{ background: 'var(--a-surface-soft)' }}>
            <TabsTrigger
              value="calculator"
              className="rounded-full py-1.5 text-[11.5px] font-bold border-0 shadow-none data-[state=active]:shadow-none data-[state=active]:bg-[var(--a-peach-1)] data-[state=active]:text-[var(--a-accent-ink)] text-[var(--a-ink-soft)]">
              <Calculator className="w-3.5 h-3.5 me-1.5" />
              {tr("maternitycalculator_calculate_3c7a2d", "Hesabla")}
            </TabsTrigger>
            <TabsTrigger
              value="guide"
              className="rounded-full py-1.5 text-[11.5px] font-bold border-0 shadow-none data-[state=active]:shadow-none data-[state=active]:bg-[var(--a-peach-1)] data-[state=active]:text-[var(--a-accent-ink)] text-[var(--a-ink-soft)]">
              <FileText className="w-3.5 h-3.5 me-1.5" />
              {tr("maternitycalculator_beledci_013a52", "Bələdçi")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="mt-4 space-y-3">
            
            {/* Country Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="a-card">
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading">🌍 {tr("country", "Ölkə")}</h3>
              </div>
              <Select value={selectedCountryCode} onValueChange={chooseCountry}>
                <SelectTrigger className="h-12 rounded-xl border-0 text-sm font-semibold" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink)' }}>
                  <SelectValue placeholder={tr("select_country", "Ölkə seçin")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {maternityCountryCodes.map((code) => (
                    <SelectItem key={code} value={code} className="text-base py-3">
                      {localizedCountryName(code, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            {/* Role Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="a-card">
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading">{tr("maternitycalculator_rolunuz", "Rolunuz")}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRole('mother')}
                  className={`a-choice peach${role === 'mother' ? '' : ''}`}
                  style={role === 'mother' ? { borderColor: 'var(--a-peach-2)', background: 'var(--a-tag-on-bg)', color: 'var(--a-accent-ink)', fontWeight: 700 } : { background: 'var(--a-surface-soft)' }}
                >
                  <span className="text-xl">🤰</span>
                  <span className="a-choice-label">{tr("maternitycalculator_ana", "Ana")}</span>
                </button>
                <button
                  onClick={() => setRole('father')}
                  className="a-choice"
                  style={role === 'father' ? { borderColor: 'var(--a-peach-2)', background: 'var(--a-tag-on-bg)', color: 'var(--a-accent-ink)', fontWeight: 700 } : { background: 'var(--a-surface-soft)' }}
                >
                  <span className="text-xl">👨‍🍼</span>
                  <span className="a-choice-label">{tr("maternitycalculator_ata", "Ata")}</span>
                </button>
              </div>
            </motion.div>

            {/* Expected Due Date Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="a-card min-w-0">
              <div className="a-card-head min-w-0" style={{ marginBottom: 10 }}>
                <h3 id="maternity-edd-label" className="a-card-title a-heading flex min-w-0 items-start gap-2" style={{ lineHeight: 1.4 }}>
                  <span aria-hidden="true" className="shrink-0">📅</span>
                  <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{tr("maternitycalculator_edd_date", "Təxmini Doğuş Tarixi (EDD)")}</span>
                </h3>
              </div>
              <input
                type="date"
                aria-labelledby="maternity-edd-label"
                value={eddDate}
                onChange={(e) => setEddDate(e.target.value)}
                className="a-input a-date-input"
                style={{ padding: '13px 14px', fontSize: 14 }}
              />
            </motion.div>

            {/* Salary Input */}
            {role === 'mother' && selectedRule.compensation && selectedRule.compensation.type !== 'UNPAID' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="a-card">
                <div className="a-card-head" style={{ marginBottom: 10 }}>
                  <h3 className="a-card-title a-heading">💵 {tr("maternitycalculator_ayliq_emek_haqqiniz", "Aylıq əmək haqqınız")} ({selectedRule.compensation.currency})</h3>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder={`${tr('mc_example_prefix', 'Məsələn')}: ${
                    ({ AZN: '800', TRY: '20000', RUB: '50000', USD: '2000', EUR: '2000', GBP: '1800', AED: '8000' } as Record<string, string>)[
                    selectedRule.compensation.currency] || '1000'}`}
                    className="a-input"
                    style={{ width: '100%', padding: '13px 60px 13px 14px', fontSize: 15, fontWeight: 700 }}
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 a-list-value" style={{ color: 'var(--a-ink-soft)' }}>
                    {selectedRule.compensation.currency}
                  </span>
                </div>
                {selectedCountryCode === 'AZ' && config && parseFloat(salary) > 0 && parseFloat(salary) < config.minSalary &&
                <p className="a-today-info-tip" style={{ marginTop: 10 }}>
                    <AlertCircle size={13} />
                    <span>{tr("maternitycalculator_minimum_emek_haqqi_f94050", "Minimum əmək haqqı (")}{config.minSalary} AZN) {tr("maternitycalculator_azn_esas_goturulecek_5cb1de", "əsas götürüləcək")}</span>
                  </p>
                }
              </motion.div>
            )}

            {/* Pregnancy Type Selection (Only for mother) */}
            {role === 'mother' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="a-card">
              <div className="a-card-head" style={{ marginBottom: 10 }}>
                <h3 className="a-card-title a-heading">{tr("maternitycalculator_hamilelik_novu_ace2e8", "Hamiləlik növü")}</h3>
              </div>
              <RadioGroup
                value={pregnancyType}
                onValueChange={(v) => setPregnancyType(v as 'normal' | 'complicated' | 'multiple')}
                className="space-y-2">
                {pregnancyTypes.map((type) =>
                <label
                  key={type.value}
                  className="flex items-center gap-3 cursor-pointer transition-all"
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    border: pregnancyType === type.value ? '1.5px solid var(--a-peach-2)' : '1.5px solid var(--a-line)',
                    background: pregnancyType === type.value ? 'var(--a-tag-on-bg)' : 'var(--a-surface-soft)'
                  }}>
                    <RadioGroupItem value={type.value} id={type.value} />
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <p className="a-list-title">{type.label}</p>
                      <p className="a-list-sub">{type.description}</p>
                    </div>
                  </label>
                )}
              </RadioGroup>
            </motion.div>
            )}

            {/* Calculate Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}>
              <button
                onClick={handleCalculate}
                disabled={!eddDate || (role === 'mother' && selectedRule.compensation?.type !== 'UNPAID' && (!salary || parseFloat(salary) <= 0))}
                className="a-btn-solid w-full"
                style={{ justifyContent: 'center', padding: '14px 18px', fontSize: 14, opacity: (!eddDate || (role === 'mother' && selectedRule.compensation?.type !== 'UNPAID' && (!salary || parseFloat(salary) <= 0))) ? 0.45 : 1 }}>
                <Calculator size={17} strokeWidth={2.2} />
                {tr("maternitycalculator_calculate_3c7a2d", "Hesabla")}
              </button>
            </motion.div>

            {/* Results */}
            <AnimatePresence>
              {result &&
              <motion.div
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                className="space-y-3 pb-8">
                
                  {/* Total Result Card (anacan-demo CTA) */}
                  <div className="a-cta" style={{ background: 'var(--a-grad-green)' }}>
                    <span className="a-cta-shape" style={{ width: 120, height: 120, top: -40, insetInlineEnd: -30, background: 'rgba(255,255,255,0.35)' }} />
                    <div className="a-cta-top">
                      <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-green-ink)' }}>
                        {result.rule.flag} {isAZ ? result.rule.name_az : result.rule.name_en} · {tr("maternitycalculator_cemi_mezuniyyet_93196a", "Cəmi məzuniyyət")}
                      </span>
                    </div>
                    {/* Dark mode düzəlişi: #14532d/rgba(20,83,45,x) dark modda
                        --a-grad-green-in tünd tint-inə qarşı oxunmurdu. */}
                    <h2 className="a-cta-title a-heading" style={{ color: 'var(--a-green-ink)', fontSize: 30, margin: '14px 0 4px' }}>
                      {result.totalDays} {tr("maternitycalculator_gun_54e78d", "gün")}
                    </h2>
                    <p className="a-cta-text" style={{ color: 'color-mix(in srgb, var(--a-green-ink) 75%, transparent)' }}>
                      {result.daysBefore} {tr("days_before", "gün əvvəl")} + {result.daysAfter} {tr("days_after", "gün sonra")}
                    </p>
                  </div>

                  {/* Visual Timeline */}
                  <div className="a-card">
                    <div className="a-card-head" style={{ marginBottom: 14 }}>
                      <h3 className="a-card-title a-heading">📅 {tr("maternitycalculator_zaman_xetti_visual", "Zaman Xətti")}</h3>
                    </div>
                    <div className="relative ps-6 space-y-5 ms-2" style={{ borderLeft: '2px solid var(--a-line-strong)' }}>
                      {/* Start Date */}
                      <div className="relative">
                        <span className="absolute top-1 w-4 h-4 rounded-full" style={{ insetInlineStart: -33, background: 'var(--a-peach-1)', border: '2.5px solid var(--a-peach-2)' }} />
                        <p className="a-list-title">{formatDate(result.leaveStartDate)}</p>
                        <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{result.role === 'father' ? tr("maternitycalculator_paternity_start", "Atalıq məzuniyyətinin başlanğıcı") : tr("maternitycalculator_leave_start_date", "Məzuniyyətin Başlanğıcı")}</p>
                      </div>
                      
                      {/* EDD */}
                      {result.role === 'mother' && (
                        <div className="relative">
                          <span className="absolute top-1 w-4 h-4 rounded-full" style={{ insetInlineStart: -33, background: 'var(--a-yellow-1)', border: '2.5px solid var(--a-yellow-2)' }} />
                          <p className="a-list-title">{formatDate(new Date(eddDate))}</p>
                          <p className="a-list-sub" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{tr("maternitycalculator_edd_date", "Təxmini Doğuş Tarixi (EDD)")}</p>
                        </div>
                      )}
                      
                      {/* End Date */}
                      <div className="relative">
                        <span className="absolute top-1 w-4 h-4 rounded-full" style={{ insetInlineStart: -33, background: 'var(--a-pink-1)', border: '2.5px solid var(--a-pink-2)' }} />
                        <p className="a-list-title">{formatDate(result.leaveEndDate)}</p>
                        <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{tr("maternitycalculator_leave_end_date", "Məzuniyyətin Sonu")}</p>
                      </div>
                      
                      {/* Return to Work */}
                      <div className="relative">
                        <span className="absolute top-1 w-4 h-4 rounded-full" style={{ insetInlineStart: -33, background: 'var(--a-green-1)', border: '2.5px solid var(--a-green-2)' }} />
                        <p className="a-list-title">{formatDate(result.returnToWorkDate)}</p>
                        <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{tr("maternitycalculator_return_to_work", "İşə Qayıdış Tarixi")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  {result.benefitResult ? (
                    <div className="a-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 18px 12px' }}>
                        <h3 className="a-card-title a-heading">💰 {tr("financial_details", "Maliyyə Hesablaması")}</h3>
                      </div>
                      <div>
                        <div className="flex justify-between items-center" style={{ padding: '12px 18px', borderTop: '1px solid var(--a-line)' }}>
                          <span className="a-list-sub" style={{ margin: 0 }}>{tr("maternitycalculator_orta_gunluk_emek_haqqi_39d8be", "Orta günlük əmək haqqı")}</span>
                          <span className="a-list-title">{result.benefitResult.dailySalary.toFixed(2)} {result.benefitResult.currency}</span>
                        </div>
                        <div className="flex justify-between items-center" style={{ padding: '12px 18px', borderTop: '1px solid var(--a-line)' }}>
                          <span className="a-list-sub" style={{ margin: 0 }}>{tr("maternitycalculator_dekret_odenisi_af1939", "Dekret ödənişi")}</span>
                          <span className="a-list-title" style={{ color: 'var(--a-green-ink)' }}>{result.benefitResult.maternityBenefit.toLocaleString(getLocaleTag(), {maximumFractionDigits: 2})} {result.benefitResult.currency}</span>
                        </div>
                        {result.benefitResult.isNativeAz && result.benefitResult.birthBenefit && (
                          <div className="flex justify-between items-center" style={{ padding: '12px 18px', borderTop: '1px solid var(--a-line)' }}>
                            <span className="a-list-sub" style={{ margin: 0 }}>{tr("maternitycalculator_dogum_muavineti_22766f", "Doğum müavinəti")}</span>
                            <span className="a-list-title" style={{ color: 'var(--a-green-ink)' }}>+{result.benefitResult.birthBenefit} {result.benefitResult.currency}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center" style={{ padding: '14px 18px', borderTop: '1px solid var(--a-line)', background: 'var(--a-green-1)' }}>
                          <span className="a-list-title" style={{ color: 'var(--a-green-ink)' }}>{tr("total_payment", "Yekun Ödəniş")}</span>
                          <span className="a-heading" style={{ fontSize: 19, fontWeight: 800, color: 'var(--a-green-ink)' }}>
                            {result.benefitResult.totalBenefit.toLocaleString(getLocaleTag(), {maximumFractionDigits: 2})} {result.benefitResult.currency}
                          </span>
                        </div>
                      </div>
                      <div style={{ background: 'var(--a-surface-soft)', padding: '12px 18px' }}>
                        {result.benefitResult.formula && (
                          <p className="a-list-sub" style={{ margin: '0 0 8px', whiteSpace: 'normal' }}>
                            <strong style={{ color: 'var(--a-ink)' }}>Formula:</strong> {result.benefitResult.formula}
                          </p>
                        )}
                        <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal', display: 'flex', gap: 5, color: 'var(--a-yellow-ink)' }}>
                          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{tr("maternitycalculator_approximate_note", "Qeyd: Hesablama qanunvericiliyin ümumi şərtlərinə əsaslanır və təxminidir. Real məbləğ stajdan və vergilərdən asılı olaraq dəyişə bilər.")}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="a-card">
                      <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
                        <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
                          <Banknote size={17} strokeWidth={2} />
                        </span>
                        <p className="a-list-title">{tr("payment_rules", "Ödəniş Qaydaları")}</p>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                        {result.role === 'father' && result.rule.paternity ? (isAZ ? result.rule.paternity.payDescription_az : result.rule.paternity.payDescription_en) : (isAZ ? result.rule.payDescription_az : result.rule.payDescription_en)}
                      </p>
                    </div>
                  )}

                  {/* Tenure Requirements */}
                  {result.rule.tenureRequirementMonths !== undefined && result.rule.tenureRequirementMonths > 0 && (
                    <div className="a-card">
                      <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
                        <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
                          <CheckCircle2 size={17} strokeWidth={2} />
                        </span>
                        <p className="a-list-title">{tr("maternity_is_staji_telebi", "İş Stajı Tələbi")}</p>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                        {tr("maternity_staj_metni", "Məzuniyyət ödənişi almaq üçün son iş yerində minimum {n} ay iş stajınız olmalıdır.").replace('{n}', String(result.rule.tenureRequirementMonths))}
                      </p>
                    </div>
                  )}

                  {/* Parental Leave */}
                  {result.rule.parental && result.rule.parental.months > 0 && (
                    <div className="a-card">
                      <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
                        <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
                          <Baby size={17} strokeWidth={2} />
                        </span>
                        <div>
                          <p className="a-list-title">{tr("maternity_usaga_qulluq_mezuniyyeti", "Uşağa Qulluq Məzuniyyəti")}</p>
                          <p className="a-list-sub">{tr("maternity_muddet", "Müddət")}: {result.rule.parental.months} {tr("common_ay_unit", "ay")}</p>
                        </div>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--a-ink-soft)' }}>
                        {isAZ ? result.rule.parental.payDescription_az : result.rule.parental.payDescription_en}
                      </p>
                    </div>
                  )}
                </motion.div>
              }
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="guide" className="mt-4 space-y-2.5 pb-8">
            {guidelines.map((guide, index) =>
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className="a-card"
              style={{ padding: 0, overflow: 'hidden' }}>
                <button
                onClick={() => setExpandedGuideline(expandedGuideline === guide.id ? null : guide.id)}
                className="a-list-row w-full text-start"
                style={{ width: '100%', background: 'none', border: 'none', borderTop: 'none', cursor: 'pointer' }}>
                  <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 18 }}>{guide.icon}</span>
                  <p className="a-list-title" style={{ flex: 1, whiteSpace: 'normal' }}>{guide.title}</p>
                  <ChevronRight
                  size={16}
                  className={`a-list-chevron transition-transform ${
                  expandedGuideline === guide.id ? 'rotate-90' : 'rtl:rotate-180'}`
                  } />
                </button>
                <AnimatePresence>
                  {expandedGuideline === guide.id &&
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: 14 }}>
                          <MarkdownContent content={guide.content} />
                        </div>
                      </div>
                    </motion.div>
                }
                </AnimatePresence>
              </motion.div>
            )}
            
            {/* DSMF Contact - Only for AZ */}
            {selectedCountryCode === 'AZ' && (
              <div className="a-today-info-tip" style={{ marginTop: 12 }}>
                <HelpCircle size={15} />
                <span>
                  <strong>{tr("maternitycalculator_elave_melumat_ucun_9e3dfc", "Əlavə məlumat üçün")}</strong> — {tr("maternitycalculator_dsmf_qaynar_xetti_d8e628", "DSMF qaynar xətti:")} <strong>142</strong>
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MaternityCalculator;
