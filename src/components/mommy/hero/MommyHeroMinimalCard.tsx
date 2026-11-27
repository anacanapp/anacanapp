import { tr } from "@/lib/tr";
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import type { MommyHeroProps } from './MommyHeroClassic';

/**
 * MINIMAL CARD — Flo/Clue inspired. Crisp white card, large photo on left,
 * typographic age + small stat row on the right. Premium SaaS feel.
 */
const MommyHeroMinimalCard = ({ babyData, exactMonths, remainingDays, babyIllustration }: MommyHeroProps) => {
  const primary = exactMonths > 0 ? exactMonths : babyData.ageInDays;
  const primaryUnit = exactMonths > 0 ? (exactMonths > 1 ? tr("time_months", "ay") : tr("time_month", "ay")) : (primary > 1 ? tr("time_days", "gün") : tr("time_day", "gün"));

  return (
    <motion.div
      className="relative overflow-hidden rounded-[2rem] bg-white border border-black/[0.06] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}>
      
      {/* Faint coral accent strip */}
      <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-[hsl(15,85%,60%)] via-[hsl(340,80%,65%)] to-[hsl(280,70%,65%)]" />

      <div className="relative p-4 flex items-center gap-4">
        {/* Photo */}
        <motion.div
          className="relative shrink-0"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}>
          
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[hsl(15,85%,60%)]/20 to-[hsl(340,70%,70%)]/15 blur-md" />
          <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-[hsl(15,40%,96%)] to-[hsl(340,40%,96%)] overflow-hidden border border-black/5 flex items-center justify-center">
            <img
              src={babyIllustration}
              alt={babyData.name}
              className="w-full h-full object-contain p-1.5"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }} />
            
          </div>
        </motion.div>

        {/* Right column */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[hsl(15,80%,55%)]">
            {tr("mommyherominimalcard_menim_korpem_1dd673", "Mənim körpəm")}
          </p>
          {/* Dark mode düzəlişi: kart HƏMİŞƏ ağ (bg-white) qalır, amma
              text-foreground/text-muted-foreground dark modda ağ/açıq
              rəngə çevrilir — nəticədə ağ kart üzərində ağ mətn itirdi.
              Bu kartın mətn rəngləri buna görə HƏMİŞƏ tünd (light-mode
              foreground/muted-foreground HSL dəyərləri ilə) sabitlənib. */}
          <h2 className="text-2xl font-black text-[hsl(20,30%,15%)] tracking-tight leading-tight mt-0.5 truncate">
            {babyData.name}
          </h2>

          {/* Big age number */}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[44px] font-black text-[hsl(20,30%,15%)] leading-none tracking-tighter tabular-nums">
              {primary}
            </span>
            <span className="text-sm font-bold text-[hsl(20,20%,45%)]">{primaryUnit}</span>
            {exactMonths > 0 && remainingDays > 0 && (
              <span className="text-xs font-medium text-[hsl(20,20%,45%)]/70 ms-1">
                {remainingDays} {remainingDays > 1 ? tr("time_days", "gün") : tr("time_day", "gün")}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Subtle footer with single complementary metric */}
      <div className="relative flex items-center justify-between px-4 py-2.5 border-t border-black/5 bg-[hsl(15,30%,98%)]">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(20,20%,45%)]/70">
          <TrendingUp className="w-3 h-3 text-[hsl(15,80%,55%)]" />
          {Math.floor(babyData.ageInDays / 7)} {tr("mommyherominimalcard_heftelik_seyahet_a5b053", "h\u0259ft\u0259lik s\u0259yah\u0259t")}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(15,80%,55%)]">
          {babyData.ageInDays}{tr("mommyherominimalcard_gun_d96b5d", ". g\xFCn")}
        </div>
      </div>
    </motion.div>);

};

export default MommyHeroMinimalCard;