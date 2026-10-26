import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Review } from '../funnelData';

interface ReviewsStepProps {
  reviews: Review[];
  onContinue: () => void;
}

export default function ReviewsStep({ reviews, onContinue }: ReviewsStepProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="flex-1">
        <h2 className="text-xl font-bold text-foreground text-center mb-2">{tr("reviewsstep_diger_analar_ne_deyir_6be761", "Digər Analar Nə Deyir?")}</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">{tr("reviewsstep_real_istifadeci_reyleri_c97721", "Real istifadəçi rəyləri")}</p>

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-3xl border border-border p-6 shadow-sm"
            >
              <div className="flex gap-0.5 mb-4 justify-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-foreground text-center leading-relaxed mb-4 italic">
                "{reviews[active].text}"
              </p>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{reviews[active].name}</p>
                <p className="text-xs text-muted-foreground">{reviews[active].context}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Nav arrows */}
          {reviews.length > 1 && (
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setActive((active - 1 + reviews.length) % reviews.length)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <ChevronLeft className="rtl:rotate-180 w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-1.5">
                {reviews.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === active ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>
              <button
                onClick={() => setActive((active + 1) % reviews.length)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <ChevronRight className="rtl:rotate-180 w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
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
