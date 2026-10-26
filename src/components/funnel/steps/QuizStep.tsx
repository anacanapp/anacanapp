import { tr } from "@/lib/tr";import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useIsRtl, rtlX } from '@/lib/rtl';
import type { QuizQuestion } from '../funnelData';

interface QuizStepProps {
  questions: QuizQuestion[];
  onComplete: (answers: Record<string, string>) => void;
}

export default function QuizStep({ questions, onComplete }: QuizStepProps) {
  const isRtl = useIsRtl();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const question = questions[currentQ];
  if (!question) return null;

  const handleNext = () => {
    if (!selected) return;
    const updated = { ...answers, [question.id]: selected };
    setAnswers(updated);
    setSelected(null);
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      onComplete(updated);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      {/* Mini progress */}
      <div className="flex gap-1.5 mb-8">
        {questions.map((_, i) =>
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
          i <= currentQ ? 'bg-primary' : 'bg-muted'}`
          } />

        )}
      </div>

      <motion.div
        key={currentQ}
        initial={{ opacity: 0, x: rtlX(30, isRtl) }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: rtlX(-30, isRtl) }}
        transition={{ duration: 0.25 }}
        className="flex-1">
        
        <h2 className="text-xl font-bold text-foreground mb-6 leading-tight">
          {question.question}
        </h2>

        <div className="space-y-3">
          {question.options.map((opt) =>
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-start ${
            selected === opt.id ?
            'border-primary bg-primary/10 shadow-md' :
            'border-border bg-card hover:border-primary/40'}`
            }>
            
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
            </button>
          )}
        </div>
      </motion.div>

      <div className="mt-8 pb-safe">
        <Button
          onClick={handleNext}
          disabled={!selected}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-[hsl(var(--primary-glow,20_90%_60%))] text-primary-foreground shadow-lg">
          
          {currentQ < questions.length - 1 ? tr("quizstep_davam_et_a832bc", "Davam et") : tr("quizstep_neticeleri_gor_ddd101", "N\u0259tic\u0259l\u0259ri g\xF6r")}
        </Button>
      </div>
    </div>);

}