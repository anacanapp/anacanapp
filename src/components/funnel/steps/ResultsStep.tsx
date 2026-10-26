import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Button } from '@/components/ui/button';

interface ResultsStepProps {
  lines: string[];
  onContinue: () => void;
}

export default function ResultsStep({ lines, onContinue }: ResultsStepProps) {
  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="flex-1">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔍</span>
        </div>

        <h2 className="text-xl font-bold text-foreground text-center mb-2">{tr("resultsstep_ferdi_analiziniz_404155", "Fərdi Analiziniz")}</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">{tr("resultsstep_cavablariniza_esasen_hazirlandi_43354d", "Cavablarınıza əsasən hazırlandı")}</p>

        <div className="space-y-4">
          {lines.map((line, i) =>
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.25 }}
            className="p-4 bg-card rounded-2xl border border-border">
            
              <p className="text-sm text-foreground leading-relaxed">{line}</p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-8 pb-safe">
        <Button
          onClick={onContinue}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-[hsl(var(--primary-glow,20_90%_60%))] text-primary-foreground shadow-lg">
          {tr("resultsstep_hellimi_goster_2fc23c", "H\u0259llimi g\xF6st\u0259r")}
        
        </Button>
      </div>
    </div>);

}