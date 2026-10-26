import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { Heart, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { usePartnerData } from '@/hooks/usePartnerData';

const PHASE_INFO: Record<string, {label: string;emoji: string;tip: string;color: string;}> = {
  menstrual: { label: tr("partnerflowstatuscard_menstruasiya_1c9b68", 'Menstruasiya'), emoji: '🩸', tip: tr("partnerflowstatuscard_yumsaq_ol_isti_cay_teklif_et_e_bb3d00", "Yum\u015Faq ol, isti \xE7ay t\u0259klif et, ev i\u015Fl\u0259rind\u0259 k\xF6m\u0259k et."), color: 'from-rose-500 to-red-500' },
  follicular: { label: tr("partnerflowstatuscard_follikular_f123bc", 'Follikular'), emoji: '🌱', tip: tr("partnerflowstatuscard_enerjisi_yuksekdir_birlikde_ak_59c2fd", "Enerjisi y\xFCks\u0259kdir \u2014 birlikd\u0259 aktiv vaxt ke\xE7irin."), color: 'from-emerald-500 to-teal-500' },
  ovulation: { label: tr("partnerflowstatuscard_ovulyasiya_f123bc", 'Ovulyasiya'), emoji: '🌸', tip: tr("partnerflowstatuscard_fertil_dovrdur_yaxinliga_diqqe_610fc2", "Fertil d\xF6vrd\xFCr. Yax\u0131nl\u0131\u011Fa diqq\u0259t g\xF6st\u0259r."), color: 'from-pink-500 to-fuchsia-500' },
  luteal: { label: tr("partnerflowstatuscard_lutein_f123bc", 'Lutein (PMS)'), emoji: '🌙', tip: tr("partnerflowstatuscard_sebirli_ol_menfi_reaksiyalari__ed5047", "S\u0259birli ol, m\u0259nfi reaksiyalar\u0131 \u015F\u0259xsi q\u0259bul etm\u0259."), color: 'from-indigo-500 to-purple-500' }
};

const PartnerFlowStatusCard = () => {
  const { partnerProfile, getCyclePhaseInfo, getDaysUntilNextPeriod } = usePartnerData();

  if (!partnerProfile || partnerProfile.life_stage !== 'flow') return null;
  const phaseInfo = getCyclePhaseInfo();
  if (!phaseInfo) return null;

  const phase = PHASE_INFO[phaseInfo.phase];
  const daysUntilPeriod = getDaysUntilNextPeriod();
  const pmsWarning = phaseInfo.phase === 'luteal' && daysUntilPeriod <= 3 && daysUntilPeriod > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br ${phase.color}`}>
      
      <div className="absolute top-0 end-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/80 text-xs">{partnerProfile.name}</p>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">{phase.emoji}</span>
              {phase.label}
            </h2>
          </div>
          <div className="text-end">
            <p className="text-white/70 text-[10px]">{tr("partnerflowstatuscard_tsikl_gunu_b9e250", "Tsikl g\xFCn\xFC")}</p>
            <p className="text-3xl font-bold text-white">{phaseInfo.dayInCycle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/20 rounded-xl p-2.5">
            <Calendar className="w-4 h-4 text-white mb-1" />
            <p className="text-white text-base font-bold">{daysUntilPeriod}</p>
            <p className="text-white/70 text-[10px]">{tr("partnerflowstatuscard_novbeti_perioda_94038c", "n\xF6vb\u0259ti perioda")}</p>
          </div>
          <div className="bg-white/20 rounded-xl p-2.5">
            {phaseInfo.isFertileDay ? <Sparkles className="w-4 h-4 text-white mb-1" /> : <Heart className="w-4 h-4 text-white mb-1" />}
            <p className="text-white text-base font-bold">{phaseInfo.isFertileDay ? tr("partnerflowstatuscard_fertil_f123bc", 'Fertil') : tr("common_normal", 'Normal')}</p>
            <p className="text-white/70 text-[10px]">{phaseInfo.isFertileDay ? tr("partnerflowstatuscard_reproduktiv_dovr_15efae", "reproduktiv d\xF6vr") : tr("partnerflowstatuscard_gun_54e78d", "g\xFCn")}</p>
          </div>
        </div>

        {pmsWarning &&
        <div className="bg-white/20 rounded-xl p-2.5 mb-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
            <p className="text-white text-xs">{tr("partnerflowstatuscard_pms_dovru_yaxinlasir_elave_des_4d2e8e", "PMS d\xF6vr\xFC yax\u0131nla\u015F\u0131r \u2014 \u0259lav\u0259 d\u0259st\u0259k laz\u0131m ola bil\u0259r \uD83D\uDC95")}</p>
          </div>
        }

        <div className="bg-white/20 rounded-xl p-3">
          <p className="text-white/90 text-xs leading-snug">💡 {phase.tip}</p>
        </div>
      </div>
    </motion.div>);

};

export default PartnerFlowStatusCard;