import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, ChevronLeft, Phone } from 'lucide-react';
import { useFirstAidScenarios, useFirstAidSteps, FirstAidScenario } from '@/hooks/useFirstAid';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { useIsRtl, rtlX } from '@/lib/rtl';

interface FirstAidGuideProps {
  onBack: () => void;
}

const FirstAidGuide = ({ onBack }: FirstAidGuideProps) => {
  useScrollToTop();
  const isRtl = useIsRtl();
  useScreenAnalytics('FirstAidGuide', 'Tools');

  const [selectedScenario, setSelectedScenario] = useState<FirstAidScenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: scenarios = [], isLoading } = useFirstAidScenarios();
  const { data: steps = [] } = useFirstAidSteps(selectedScenario?.id || '');

  // TTS disabled - no auto-speaking

  const handleBack = () => {
    if (selectedScenario) {
      setSelectedScenario(null);
      setCurrentStep(0);
    } else {
      onBack();
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Emergency level → anacan design palette
  const getEmergencyStyle = (level: string) => {
    switch (level) {
      case 'critical':return { grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)', tag: 'var(--a-pink-2)' };
      case 'high':return { grad: 'var(--a-grad-peach)', ink: 'var(--a-accent-ink)', tag: 'var(--a-peach-2)' };
      case 'medium':return { grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)', tag: 'var(--a-yellow-2)' };
      default:return { grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)', tag: 'var(--a-yellow-2)' };
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <ToolPage>
      <ToolHeader
        onBack={handleBack}
        eyebrow={selectedScenario ? <>{tr("firstaidguide_addim_9346cd", "Add\u0131m")} {currentStep + 1} / {steps.length}</> : tr("firstaidguide_tecili_tibbi_yardim_b28b39", "Təcili Tibbi Yardım")}
        title={selectedScenario ? selectedScenario.title_az : tr("firstaidguide_heyat_qurtaran_sos_2f76df", "H\u0259yat Qurtaran SOS")} />

      <AnimatePresence mode="wait">
        {!selectedScenario ?
        <motion.div
          key="scenarios"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}>
          
            {/* Emergency Call Button */}
            <motion.a
            href="tel:103"
            className="a-card block w-full mb-3"
            style={{ background: 'var(--a-pink-2)', border: 'none', textDecoration: 'none', padding: '14px 16px' }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}>
            
              <div className="flex items-center gap-3">
                <span className="a-list-icon" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                  <Phone size={18} strokeWidth={2.2} />
                </span>
                <div className="flex-1">
                  <p className="a-heading" style={{ margin: 0, fontSize: 19, color: '#fff' }}>103</p>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{tr("firstaidguide_tecili_tibbi_yardim_b28b39", "Təcili Tibbi Yardım")}</p>
                </div>
                <span className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }}>
                  <ChevronRight className="rtl:rotate-180" size={15} style={{ color: '#fff' }} />
                </span>
              </div>
            </motion.a>

            <MedicalDisclaimer variant="anacan" className="mb-3" />


            {/* Scenario Selection */}
            <div className="a-section-head" style={{ marginTop: 4 }}>
              <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
                {tr("firstaidguide_tecili_veziyyet_secin_51d6bd", "T\u0259cili V\u0259ziyy\u0259t Se\xE7in")}
              </h2>
              <AlertTriangle size={15} style={{ color: 'var(--a-pink-2)' }} />
            </div>

            {isLoading ?
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) =>
            <div key={i} className="a-card animate-pulse">
                    <div style={{ height: 18, width: '50%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 6 }} />
                    <div style={{ height: 12, width: '75%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
                  </div>
            )}
              </div> :

          <div className="a-list-card pb-4">
                {scenarios.map((scenario, index) => {
              const style = getEmergencyStyle(scenario.emergency_level);
              return (
                <motion.button
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  className="a-list-row w-full text-start"
                  style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}>
                  
                        <span className="a-list-icon" style={{ background: style.grad, fontSize: 18 }}>
                          {scenario.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="a-list-title">{scenario.title_az}</p>
                          <p className="a-list-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scenario.description_az}</p>
                        </div>
                        <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="a-rank-tag" style={{ margin: 0, background: style.grad, color: style.ink }}>
                            {scenario.emergency_level === 'critical' ? tr("firstaid_critical", "KRİTİK") : scenario.emergency_level === 'high' ? tr("firstaidguide_yuksek_22d925", "Y\xDCKS\u018FK") : tr("firstaid_medium", "ORTA")}
                          </span>
                          <ChevronRight size={16} className="rtl:rotate-180 a-list-chevron" />
                        </span>
                      </motion.button>);

            })}
              </div>
          }
          </motion.div> :

        <motion.div
          key="steps"
          className="flex flex-col"
          initial={{ opacity: 0, x: rtlX(30, isRtl) }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: rtlX(-30, isRtl) }}>
          
            {/* Progress */}
            <div className="flex items-center gap-1 mb-3">
              {steps.map((_, i) =>
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all"
              style={{ background: i <= currentStep ? getEmergencyStyle(selectedScenario.emergency_level).tag : 'var(--a-line-strong)' }} />

            )}
            </div>

            {/* Step Content */}
            <div className="flex flex-col items-center text-center">
              {currentStepData &&
            <AnimatePresence mode="wait">
                  <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-sm">
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span
                    className="a-list-icon"
                    style={{ width: 34, height: 34, borderRadius: 11, background: getEmergencyStyle(selectedScenario.emergency_level).grad, fontSize: 15 }}>
                        {currentStep === 0 ? '👋' : currentStep === steps.length - 1 ? '✅' : selectedScenario.icon}
                      </span>
                      <span className="a-tag" style={{ cursor: 'default', padding: '4px 10px', fontSize: 10 }}>
                        {tr("firstaidguide_addim_9346cd", "Add\u0131m")} {currentStep + 1}
                      </span>
                      {currentStepData.is_critical &&
                  <span className="a-tag" style={{ cursor: 'default', padding: '4px 10px', fontSize: 10, background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                          <AlertTriangle size={10} />
                          {tr("firstaid_critical_badge", "Kritik")}
                        </span>
                  }
                      {currentStepData.duration_seconds &&
                  <span className="a-list-time ms-auto" style={{ margin: '0 0 0 auto' }}>
                          ⏱️ {currentStepData.duration_seconds}s
                        </span>
                  }
                    </div>

                    <div className="a-card text-start">
                      <h2 className="a-card-title a-heading" style={{ marginBottom: 6 }}>{currentStepData.title_az}</h2>
                      <p className="a-cta-text">
                        {currentStepData.instruction_az}
                      </p>
                    </div>

                    {/* Navigation */}
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <button
                      className="a-btn-soft flex-1"
                      style={{ justifyContent: 'center', height: 44, opacity: currentStep === 0 ? 0.45 : 1 }}
                      onClick={prevStep}
                      disabled={currentStep === 0}>
                      
                          <ChevronLeft className="rtl:rotate-180" size={15} strokeWidth={2.2} />
                          {tr("firstaidguide_evvelki_936896", "\u018Fvv\u0259lki")}
                        </button>
                        <button
                      className="a-cta-btn flex-1"
                      style={{
                        justifyContent: 'center', height: 44,
                        background: currentStep === steps.length - 1 ? 'var(--a-green-2)' : getEmergencyStyle(selectedScenario.emergency_level).tag
                      }}
                      onClick={currentStep === steps.length - 1 ? handleBack : nextStep}>
                      
                          {currentStep === steps.length - 1 ? tr("firstaid_complete", "Tamamla") : tr("firstaidguide_novbeti_6e8661", "N\xF6vb\u0259ti")}
                          <ChevronRight className="rtl:rotate-180" size={15} strokeWidth={2.2} />
                        </button>
                      </div>

                      <a
                    href="tel:103"
                    className="a-btn-soft w-full"
                    style={{ justifyContent: 'center', height: 40, background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)', textDecoration: 'none' }}>
                    
                        <Phone size={13} strokeWidth={2.2} />
                        {tr("firstaidguide_103_zeng_et_52da85", "103 Z\u0259ng Et")}
                      </a>
                    </div>
                  </motion.div>
                </AnimatePresence>
            }
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </ToolPage>);

};

export default FirstAidGuide;
