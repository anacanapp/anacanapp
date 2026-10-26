import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Calendar, Sparkles, AlertCircle, Heart, Info, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerWheel } from '@/components/ui/date-picker-wheel';
import { useTeething, BabyTooth } from '@/hooks/useTeething';
import { useChildren } from '@/hooks/useChildren';
import ChildSelector from '@/components/mommy/ChildSelector';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface TeethingTrackerProps {
  onBack: () => void;
}

const TeethingTracker = ({ onBack }: TeethingTrackerProps) => {
  useScreenAnalytics('TeethingTracker', 'Tools');
  const { selectedChild, hasChildren, getChildAge } = useChildren();
  const {
    teeth,
    tips,
    symptoms,
    loading,
    toggleTooth,
    isToothEmerged,
    getToothLog,
    updateToothNote,
    emergedCount,
    totalTeeth,
    progress
  } = useTeething();

  const childAge = selectedChild ? getChildAge(selectedChild) : null;

  const [selectedTooth, setSelectedTooth] = useState<BabyTooth | null>(null);
  const [showToothModal, setShowToothModal] = useState(false);
  const [emergedDate, setEmergedDate] = useState('');
  const [notes, setNotes] = useState('');

  const upperTeeth = teeth.filter((t) => t.position === 'upper');
  const lowerTeeth = teeth.filter((t) => t.position === 'lower');

  const handleToothClick = (tooth: BabyTooth) => {
    setSelectedTooth(tooth);
    const log = getToothLog(tooth.id);
    if (log) {
      setEmergedDate(log.emerged_date || '');
      setNotes(log.notes || '');
    } else {
      setEmergedDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
    setShowToothModal(true);
  };

  const handleToggleTooth = async () => {
    if (!selectedTooth) return;

    const isCurrentlyEmerged = isToothEmerged(selectedTooth.id);
    await toggleTooth(selectedTooth.id, !isCurrentlyEmerged, emergedDate);

    if (!isCurrentlyEmerged && notes) {
      await updateToothNote(selectedTooth.id, notes);
    }

    setShowToothModal(false);
  };

  // Severity → anacan palette
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'mild':return { background: 'var(--a-green-1)', color: 'var(--a-green-ink)' };
      case 'moderate':return { background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)' };
      case 'severe':return { background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' };
      default:return { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' };
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'before':return tr("teethingtracker_evvel_b41251", "\u018Fvv\u0259l");
      case 'during':return tr("teethingtracker_zamani_de9ddc", "Zaman\u0131");
      case 'after':return tr("common_sonra", 'Sonra');
      case 'pain_relief':return tr("teethingtracker_agri_kesici_9c92cd", "A\u011Fr\u0131 K\u0259sici");
      case 'general':return tr("teethingtracker_umumi_1b5521", "\xDCmumi");
      default:return category;
    }
  };

  const tabTriggerClass =
  "rounded-full py-1.5 text-[11.5px] font-bold border-0 shadow-none data-[state=active]:shadow-none data-[state=active]:bg-[var(--a-peach-1)] data-[state=active]:text-[var(--a-accent-ink)] text-[var(--a-ink-soft)]";

  const renderToothDiagram = (teethList: BabyTooth[], position: 'upper' | 'lower') => {
    // Arrange teeth in dental arch order
    const sortedTeeth = [...teethList].sort((a, b) => {
      const order = position === 'upper' ?
      ['upper_second_molar_right', 'upper_first_molar_right', 'upper_canine_right', 'upper_lateral_incisor_right', 'upper_central_incisor_right', 'upper_central_incisor_left', 'upper_lateral_incisor_left', 'upper_canine_left', 'upper_first_molar_left', 'upper_second_molar_left'] :
      ['lower_second_molar_right', 'lower_first_molar_right', 'lower_canine_right', 'lower_lateral_incisor_right', 'lower_central_incisor_right', 'lower_central_incisor_left', 'lower_lateral_incisor_left', 'lower_canine_left', 'lower_first_molar_left', 'lower_second_molar_left'];
      return order.indexOf(a.tooth_code) - order.indexOf(b.tooth_code);
    });

    // Tooth size by type (a-palette colors applied inline)
    const getToothSize = (tooth: BabyTooth) => {
      const isMolar = tooth.tooth_type === 'molar';
      const isCanine = tooth.tooth_type === 'canine';
      return isMolar ? 'w-8 h-10' : isCanine ? 'w-6 h-9' : 'w-6 h-8';
    };

    return (
      <div className={`flex justify-center gap-1 ${position === 'lower' ? 'items-start' : 'items-end'}`}>
        {sortedTeeth.map((tooth, index) => {
          const emerged = isToothEmerged(tooth.id);
          const baseSize = getToothSize(tooth);

          // Create arch effect with different heights
          const archOffset = Math.abs(index - 4.5);

          return (
            <motion.button
              key={tooth.id}
              whileHover={{ scale: 1.1, y: position === 'upper' ? 2 : -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleToothClick(tooth)}
              className={`relative transition-all duration-200 ${baseSize} ${
              position === 'upper' ? 'rounded-t-lg rounded-b-[40%]' : 'rounded-b-lg rounded-t-[40%]'}`}
              style={{
                marginTop: position === 'upper' ? `${archOffset * 2}px` : 0,
                marginBottom: position === 'lower' ? `${archOffset * 2}px` : 0,
                background: emerged ?
                'linear-gradient(180deg, var(--a-pink-1), var(--a-pink-2))' :
                'linear-gradient(180deg, var(--a-surface-soft), var(--a-line-strong))',
                border: emerged ? '2px solid var(--a-pink-1)' : '2px solid var(--a-line-strong)',
                boxShadow: emerged ? '0 4px 10px -4px rgba(255, 138, 164, 0.6)' : 'none',
                cursor: 'pointer'
              }}>
              
              {/* Tooth shine effect */}
              <div className={`absolute inset-0 ${position === 'upper' ? 'rounded-t-lg rounded-b-[40%]' : 'rounded-b-lg rounded-t-[40%]'} overflow-hidden`}>
                <div className="absolute top-0 start-0 w-1/3 h-full" style={{ background: 'rgba(255,255,255,0.35)' }} />
              </div>
              
              {/* Root indication for emerged teeth */}
              {emerged &&
              <div
                className={`absolute ${position === 'upper' ? '-bottom-1' : '-top-1'} left-1/2 -translate-x-1/2 w-2 h-2 rounded-full`}
                style={{ background: 'var(--a-pink-1)' }} />
              }
              
              {/* Check mark for emerged */}
              {emerged &&
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute ${position === 'upper' ? '-top-2' : '-bottom-2'} -end-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm z-10`}
                style={{ background: 'var(--a-green-2)' }}>
                
                  <Check className="w-2.5 h-2.5 text-white" />
                </motion.div>
              }
            </motion.button>);

        })}
      </div>);

  };

  if (loading) {
    return <ToolLoading />;
  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={selectedChild ? `${selectedChild.name}${childAge ? ' · ' + childAge.displayText : ''}` : tr("teethingtracker_korpenizin_383c3e", "K\xF6rp\u0259nizin")}
        title={tr("teethingtracker_dis_cixarma_izleyicisi_109c3d", "Diş Çıxarma İzləyicisi")}
        actions={hasChildren ? <ChildSelector compact /> : undefined} />

      <div className="space-y-3">
        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)' }}>
                <Sparkles size={17} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} />
              </span>
              <div>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("teethingtracker_cixan_disler_ab71e7", "Çıxan Dişlər")}</p>
                <p className="a-heading" style={{ margin: 0, fontSize: 20 }}>{emergedCount} <span style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>/ {totalTeeth}</span></p>
              </div>
            </div>
            <div className="text-end">
              <p className="a-heading" style={{ margin: 0, fontSize: 20, color: 'var(--a-berry-ink)' }}>{Math.round(progress)}%</p>
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("teethingtracker_tamamlandi_d6728f", "tamamlandı")}</p>
            </div>
          </div>
          <div className="a-pbar" style={{ marginTop: 12 }}>
            <div className="a-pbar-track">
              <div className="a-pbar-fill" style={{ width: `${Math.max(2, Math.min(100, progress))}%`, background: 'var(--a-grad-pink)' }} />
            </div>
          </div>
        </motion.div>

        {/* Teeth Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="a-card">
          
          <div className="a-card-head" style={{ marginBottom: 4 }}>
            <p className="a-card-title a-heading" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Heart size={14} style={{ color: 'var(--a-pink-2)' }} />
              {tr("teethingtracker_dis_diaqrami_a219c2", "Di\u015F Diaqram\u0131")}
            </p>
          </div>
          <p className="a-list-sub" style={{ margin: '0 0 10px' }}>{tr("teethingtracker_dise_toxunaraq_qeyd_edin_65aadb", "Dişə toxunaraq qeyd edin")}</p>

          {/* Upper Jaw */}
          <div className="space-y-1">
            <p className="a-eyebrow text-center" style={{ marginBottom: 4 }}>{tr("teethingtracker_yuxari_cene_589483", "Yuxarı Çənə")}</p>
            <div
              className="rounded-t-[80px] p-3 pt-5"
              style={{ background: 'linear-gradient(180deg, var(--a-pink-1), transparent)' }}>
              {renderToothDiagram(upperTeeth, 'upper')}
            </div>
          </div>

          {/* Divider - Gum Line */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, var(--a-pink-2), transparent)' }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-2.5 py-0.5 text-[10px] font-bold rounded-full"
                style={{ background: 'var(--a-surface)', color: 'var(--a-pink-ink)', border: '1px solid var(--a-pink-1)' }}>
                {tr("teethingtracker_dis_eti_xetti_22266e", "Di\u015F \u0259ti x\u0259tti")}
              </span>
            </div>
          </div>

          {/* Lower Jaw */}
          <div className="space-y-1">
            <div
              className="rounded-b-[80px] p-3 pb-5"
              style={{ background: 'linear-gradient(0deg, var(--a-pink-1), transparent)' }}>
              {renderToothDiagram(lowerTeeth, 'lower')}
            </div>
            <p className="a-eyebrow text-center" style={{ marginTop: 4 }}>{tr("teethingtracker_asagi_cene_78719d", "Aşağı Çənə")}</p>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 pt-3 mt-2" style={{ borderTop: '1px solid var(--a-line)' }}>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-5 rounded-t-md rounded-b-[30%]"
                style={{ background: 'linear-gradient(180deg, var(--a-pink-1), var(--a-pink-2))', border: '2px solid var(--a-pink-1)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--a-ink)' }}>{tr("teethingtracker_cixib_f2099b", "Çıxıb")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-5 rounded-t-md rounded-b-[30%]"
                style={{ background: 'linear-gradient(180deg, var(--a-surface-soft), var(--a-line-strong))', border: '2px solid var(--a-line-strong)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--a-ink)' }}>{tr("teethingtracker_cixmayib_d90dc0", "Çıxmayıb")}</span>
            </div>
          </div>
        </motion.div>

        {/* Tabs for Tips and Symptoms */}
        <Tabs defaultValue="tips" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-auto rounded-full p-[3px] border-0" style={{ background: 'var(--a-surface-soft)' }}>
            <TabsTrigger value="tips" className={tabTriggerClass}>{tr("teethingtracker_qulluq_meslehetleri_1be08c", "Qulluq Məsləhətləri")}</TabsTrigger>
            <TabsTrigger value="symptoms" className={tabTriggerClass}>{tr("untranslated_simptomlar_xhm7bx", "Simptomlar")}</TabsTrigger>
          </TabsList>

          <TabsContent value="tips" className="space-y-3 mt-4">
            {tips.map((tip) =>
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="a-card">
              
                <div className="flex gap-3">
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', fontSize: 18, flexShrink: 0 }}>
                    {tip.emoji || '💡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="a-list-title" style={{ margin: 0 }}>{tip.title}</p>
                      <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                        {getCategoryLabel(tip.category)}
                      </span>
                    </div>
                    <p className="a-cta-text" style={{ margin: 0 }}>
                      {tip.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="symptoms" className="space-y-3 mt-4">
            {symptoms.map((symptom) =>
            <motion.div
              key={symptom.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="a-card">
              
                <div className="flex gap-3">
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-yellow)', fontSize: 18, flexShrink: 0 }}>
                    {symptom.emoji || '⚠️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="a-list-title" style={{ margin: 0 }}>{symptom.name}</p>
                      <span className="a-rank-tag" style={{ margin: 0, ...getSeverityStyle(symptom.severity) }}>
                        {symptom.severity === 'mild' ? tr("teethingtracker_yungul_2a8010", "Y\xFCng\xFCl") : symptom.severity === 'moderate' ? tr("teethingtracker_severity_orta", 'Orta') : tr("teethingtracker_severity_ciddi", 'Ciddi')}
                      </span>
                    </div>
                    <p className="a-cta-text" style={{ margin: '0 0 8px' }}>
                      {symptom.description}
                    </p>
                    {symptom.relief_tips && symptom.relief_tips.length > 0 &&
                    <div className="flex flex-wrap gap-1">
                        {symptom.relief_tips.map((tip, i) =>
                      <span
                        key={i}
                        className="a-rank-tag"
                        style={{ margin: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                            {tip}
                          </span>
                      )}
                      </div>
                    }
                  </div>
                </div>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Tooth Detail Modal */}
      <Dialog open={showToothModal} onOpenChange={setShowToothModal}>
        <DialogContent className="a-scope max-w-sm rounded-[26px] max-h-[85dvh] overflow-y-auto" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <span className="a-list-icon" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-grad-pink)' }}>
                <Sparkles size={15} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} />
              </span>
              {selectedTooth ? tr("tooth_name_" + selectedTooth.tooth_code, selectedTooth.name) : ''}
            </DialogTitle>
          </DialogHeader>

          {selectedTooth &&
          <div className="space-y-4">
              {/* Tooth Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="a-list-sub" style={{ margin: '0 0 2px' }}>{tr("teethingtracker_tipik_cixma_yasi_1c2740", "Tipik çıxma yaşı")}</p>
                  <p className="a-list-title" style={{ margin: 0 }}>
                    {selectedTooth.typical_emergence_months_min}-{selectedTooth.typical_emergence_months_max} {tr("time_months", "ay")}
                  </p>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="a-list-sub" style={{ margin: '0 0 2px' }}>{tr("teethingtracker_dis_novu_07a451", "Diş növü")}</p>
                  <p className="a-list-title" style={{ margin: 0 }}>
                    {selectedTooth.tooth_type === 'incisor' ? tr("teethingtracker_kesici_569ec2", "K\u0259sici") :
                  selectedTooth.tooth_type === 'canine' ? tr("teethingtracker_kopek_disi_a7a461", "K\xF6p\u0259k di\u015Fi") : tr("teethingtracker_azi_disi_fcdef9", "Az\u0131 di\u015Fi")}
                  </p>
                </div>
              </div>

              {/* Current Status */}
              <div
              className="rounded-2xl p-3"
              style={{ background: isToothEmerged(selectedTooth.id) ? 'var(--a-green-1)' : 'var(--a-yellow-1)' }}>
                <div className="flex items-center gap-2">
                  {isToothEmerged(selectedTooth.id) ?
                <>
                      <Check className="w-4 h-4" style={{ color: 'var(--a-green-ink)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--a-green-ink)' }}>
                        {tr("teethingtracker_bu_dis_cixib_543f0e", "Bu di\u015F \xE7\u0131x\u0131b")}
                      </span>
                    </> :

                <>
                      <AlertCircle className="w-4 h-4" style={{ color: 'var(--a-warn-ink)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--a-warn-ink)' }}>
                        {tr("teethingtracker_bu_dis_hele_cixmayib_df0465", "Bu di\u015F h\u0259l\u0259 \xE7\u0131xmay\u0131b")}
                      </span>
                    </>
                }
                </div>
              </div>

              {/* Date Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                  <Calendar className="w-4 h-4" style={{ color: 'var(--a-ink-soft)' }} />
                  {tr("teethingtracker_cixma_tarixi_3c7ae9", "Çıxma tarixi")}
                </label>
                <DatePickerWheel
                value={emergedDate ? new Date(emergedDate) : undefined}
                onChange={(date) => setEmergedDate(date ? date.toISOString().split('T')[0] : '')}
                minYear={new Date().getFullYear() - 5}
                maxYear={new Date().getFullYear()} />
              
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                  <Info className="w-4 h-4" style={{ color: 'var(--a-ink-soft)' }} />
                  {tr("teethingtracker_qeydler_isteye_bagli_958966", "Qeydl\u0259r (ist\u0259y\u0259 ba\u011Fl\u0131)")}
                </label>
                <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("teethingtracker_her_hansi_qeyd_elave_edin_9c35e2", "Hər hansı qeyd əlavə edin...")}
                rows={2}
                className="a-input"
                style={{ height: 'auto', minHeight: 64 }} />
              
              </div>

              {/* Action Button */}
              <button
              onClick={handleToggleTooth}
              className="a-cta-btn w-full"
              style={{
                justifyContent: 'center', height: 46,
                background: isToothEmerged(selectedTooth.id) ? 'var(--a-pink-2)' : 'var(--a-green-2)'
              }}>
              
                {isToothEmerged(selectedTooth.id) ?
              <>
                    <X size={15} strokeWidth={2.2} />
                    {tr("teethingtracker_cixib_isaresini_sil_abec15", "\xC7\u0131x\u0131b i\u015Far\u0259sini sil")}
                  </> :

              <>
                    <Check size={15} strokeWidth={2.2} />
                    {tr("teethingtracker_cixib_olaraq_isarele_678f2e", "\xC7\u0131x\u0131b olaraq i\u015Far\u0259l\u0259")}
                  </>
              }
              </button>
            </div>
          }
        </DialogContent>
      </Dialog>
    </ToolPage>);

};

export default TeethingTracker;
