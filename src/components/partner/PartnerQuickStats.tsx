import { motion } from 'framer-motion';
import { Trophy, Target, Heart, MessageCircle, Star, Zap } from 'lucide-react';
import { usePartnerStats } from '@/hooks/usePartnerStats';
import { tr } from "@/lib/tr";

const PartnerQuickStats = () => {
  const { stats, loading } = usePartnerStats();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) =>
        <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
        )}
      </div>);

  }

  const statItems = [
  {
    icon: Trophy,
    value: stats.totalPoints,
    label: tr("partnerquickstats_umumi_xal_3ce85a", 'Ümumi Xal'),
    gradient: 'from-amber-500 to-orange-600',
    delay: 0
  },
  {
    icon: Target,
    value: stats.completedMissions,
    label: tr("partnerquickstats_tamamlanmis_e36252", 'Tamamlanmış'),
    gradient: 'from-emerald-500 to-teal-600',
    delay: 0.05
  },
  {
    icon: Heart,
    value: stats.lovesSent,
    label: 'Sevgi',
    gradient: 'from-pink-500 to-rose-600',
    delay: 0.1
  },
  {
    icon: MessageCircle,
    value: stats.messagesSent,
    label: 'Mesaj',
    gradient: 'from-partner to-indigo-600',
    delay: 0.15
  }];


  return (
    <div className="space-y-3">
      {/* Level Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-partner via-indigo-600 to-violet-700 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
        
        <div className="absolute -top-10 -end-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        
        <motion.div
          className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}>
          
          <Star className="w-8 h-8 text-amber-300 fill-amber-300" />
        </motion.div>
        
        <div className="flex-1">
          <p className="text-white/70 text-xs font-medium">{tr("partnerquickstats_partner_seviyyesi_9a38f6", "Partner Səviyyəsi")}</p>
          <h3 className="text-white text-2xl font-black">{tr("partnerquickstats_seviyye_8266e7", "S\u0259viyy\u0259")} {stats.level}</h3>
        </div>
        
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}>
          
          <Zap className="w-8 h-8 text-amber-300" />
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: item.delay }}
              className={`bg-gradient-to-br ${item.gradient} rounded-2xl p-4 relative overflow-hidden`}>
              
              <div className="absolute -top-4 -end-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
              <Icon className="w-5 h-5 text-white/80 mb-2" />
              <p className="text-3xl font-black text-white">{item.value}</p>
              <p className="text-white/70 text-xs font-medium">{item.label}</p>
            </motion.div>);

        })}
      </div>
    </div>);

};

export default PartnerQuickStats;