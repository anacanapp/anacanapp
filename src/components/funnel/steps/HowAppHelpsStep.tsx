import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Button } from '@/components/ui/button';
import { Crown, ArrowRight, Users, Wrench, Globe2, ShieldCheck } from 'lucide-react';
import { fetchActiveLanguages } from '@/lib/i18n';
import type { SymptomMapping } from '../funnelData';

interface HowAppHelpsStepProps {
  mappings: SymptomMapping[];
  onContinue: () => void;
}

export default function HowAppHelpsStep({ mappings, onContinue }: HowAppHelpsStepProps) {
  // Dil sayı hardcode DEYİL — tətbiqdə aktiv olan dillərin real sayı DB-dən
  // (app_languages, is_active=true) çəkilir, əlavə/silinən dil olsa da bu
  // ədəd özü-özünə düzgün qalır. Fetch bitənə qədər indiki bilinən sayı (7)
  // fallback kimi göstərilir ki, rəqəm sıfır/boş görünməsin.
  const [langCount, setLangCount] = useState(7);
  useEffect(() => {
    fetchActiveLanguages()
      .then((list) => { if (list.length > 0) setLangCount(list.length); })
      .catch(() => {});
  }, []);

  // Etibar statistikaları — həllərin altında ümumi dəyər xülasəsi
  const stats = [
  { icon: Wrench, value: '40+', label: tr('howapphelps_stat_tools', 'Peşəkar alət') },
  { icon: Users, value: '5000+', label: tr('howapphelps_stat_moms', 'Ana icmada') },
  { icon: Globe2, value: String(langCount), label: tr('howapphelps_stat_langs', 'Dil dəstəyi') }];

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="flex-1">
        <h2 className="text-xl font-bold text-foreground text-center mb-2">{tr("howapphelpsstep_anacan_nece_komek_edir_a6ab1a", "Anacan Necə Kömək Edir?")}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">{tr("howapphelpsstep_her_probleme_ferdi_hell_97e2f5", "Hər problemə fərdi həll")}</p>

        <div className="space-y-2.5">
          {mappings.map((m, i) => (
            <motion.div
              key={m.toolId + i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 p-3.5 bg-card rounded-2xl border border-border relative overflow-hidden"
            >
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">{m.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-muted-foreground truncate">{m.painPoint}</p>
                  {m.isPremium && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ArrowRight className="rtl:rotate-180 w-3 h-3 text-primary flex-shrink-0" />
                  <p className="text-sm font-semibold text-foreground truncate">{m.solution}</p>
                </div>
              </div>
              {/* Subtle gradient accent */}
              <div className="absolute top-0 end-0 w-16 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
            </motion.div>
          ))}
        </div>

        {/* Dəyər xülasəsi */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: mappings.length * 0.1 + 0.15 }}
          className="grid grid-cols-3 gap-2 mt-5">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-2xl p-3 text-center">
                <Icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
                <p className="text-base font-extrabold text-foreground leading-none">{s.value}</p>
                <p className="text-[10.5px] text-muted-foreground mt-1">{s.label}</p>
              </div>);
          })}
        </motion.div>

        {/* Etibar sətri */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: mappings.length * 0.1 + 0.3 }}
          className="flex items-center justify-center gap-1.5 mt-4">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            {tr('howapphelps_trust_line', 'Məzmun həkim baxışından keçir · Məlumatlarınız qorunur')}
          </p>
        </motion.div>
      </div>

      <div className="mt-8 pb-safe">
        <Button
          onClick={onContinue}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-[hsl(var(--primary-glow,20_90%_60%))] text-primary-foreground shadow-lg"
        >{tr("untranslated_davam_et_rchhd5", "Davam et")}</Button>
      </div>
    </div>
  );
}
