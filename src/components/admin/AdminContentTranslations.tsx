import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Languages, Play, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// translate-content edge function registry-si ilə sinxron siyahı
const TABLES: Array<{ id: string; label: string; heavy?: boolean }> = [
  { id: 'pregnancy_daily_content', label: 'Hamiləlik günlük kontenti (280 gün)', heavy: true },
  { id: 'weekly_tips', label: 'Həftəlik tövsiyələr (bump/mommy)' },
  { id: 'baby_daily_info', label: 'Körpə günlük məlumatı (1460 gün)' },
  { id: 'mommy_daily_messages', label: 'Ana günlük mesajları' },
  { id: 'admin_recipes', label: 'Reseptlər' },
  { id: 'nutrition_tips', label: 'Qidalanma tövsiyələri' },
  { id: 'trimester_tips', label: 'Trimester tövsiyələri' },
  { id: 'blog_posts', label: 'Bloq məqalələri', heavy: true },
  { id: 'blog_categories', label: 'Bloq kateqoriyaları' },
  { id: 'faqs', label: 'FAQ' },
  { id: 'development_tips', label: 'İnkişaf tövsiyələri' },
  { id: 'partner_daily_tips', label: 'Partnyor günlük tövsiyələri' },
  { id: 'flow_insights', label: 'Flow insights' },
  { id: 'flow_phase_tips', label: 'Flow faza tövsiyələri' },
  { id: 'epds_questions', label: 'EPDS sualları' },
  { id: 'hospital_bag_templates', label: 'Xəstəxana çantası şablonları' },
  { id: 'onboarding_stages', label: 'Onboarding mərhələləri' },
  { id: 'first_aid_scenarios', label: 'İlk yardım ssenariləri' },
  { id: 'first_aid_steps', label: 'İlk yardım addımları' },
  { id: 'play_activities', label: 'Oyun fəaliyyətləri' },
  { id: 'baby_crisis_periods', label: 'Kriz dövrləri (wonder weeks)' },
  { id: 'mental_health_resources', label: 'Mental sağlamlıq resursları' },
  { id: 'breathing_exercises', label: 'Nəfəs məşqləri' },
  { id: 'vitamins', label: 'Vitaminlər' },
  { id: 'exercises', label: 'Məşqlər' },
  { id: 'intro_slides', label: 'İntro slaydları' },
  { id: 'products', label: 'Mağaza məhsulları' },
  { id: 'cakes', label: 'Tortlar' },
  { id: 'baby_names_db', label: 'Körpə adları (mənşə/məna)', heavy: true },
  { id: 'scheduled_notifications', label: 'Statik push bildirişləri', heavy: true },
  { id: 'pregnancy_day_notifications', label: 'Hamiləlik günlük pushları (1-280)', heavy: true },
  { id: 'mommy_day_notifications', label: 'Ana günlük pushları (1-1460)', heavy: true },
];

const MAX_ITERATIONS = 400;

const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto (Claude → GPT → Gemini)' },
  { id: 'claude', label: 'Claude (Azure/Anthropic)' },
  { id: 'azure-gpt', label: 'GPT (Azure OpenAI)' },
  { id: 'gemini', label: 'Gemini' },
];

const AdminContentTranslations = () => {
  const [table, setTable] = useState('weekly_tips');
  const [lang, setLang] = useState('ru');
  const [provider, setProvider] = useState('auto');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const stopRef = useRef(false);

  const appendLog = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString('az-AZ')} — ${line}`, ...prev].slice(0, 200));

  const runOnce = async () => {
    const heavy = TABLES.find((t) => t.id === table)?.heavy;
    const { data, error } = await supabase.functions.invoke('translate-content', {
      body: { table, lang, provider, batchSize: heavy ? 4 : 10 },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as { processed: number; updated: number; remaining: number; done: boolean; provider?: string; failures?: Array<{ id: string; error: string }> };
  };

  const start = async () => {
    setRunning(true);
    stopRef.current = false;
    let totalUpdated = 0;
    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (stopRef.current) { appendLog('⏹ Dayandırıldı'); break; }
        const res = await runOnce();
        totalUpdated += res.updated;
        setRemaining(res.remaining);
        appendLog(`batch: +${res.updated} tərcümə, qalır: ${res.remaining}${res.provider ? ` [${res.provider}]` : ''}`);
        (res.failures || []).forEach((f) => appendLog(`⚠ ${f.id}: ${f.error.slice(0, 120)}`));
        if (res.done) { appendLog(`✅ ${table} → ${lang} tamamlandı (cəmi ${totalUpdated})`); toast.success('Tərcümə tamamlandı'); break; }
        // Sıfır irəliləyiş = hamısı failure → sonsuz dövrədən çıx
        if (res.processed > 0 && res.updated === 0) { appendLog('⚠ İrəliləyiş yoxdur — dayandırıldı (failures-a bax)'); break; }
      }
    } catch (e) {
      appendLog(`❌ Xəta: ${(e as Error).message}`);
      toast.error('Tərcümə xətası');
    } finally {
      setRunning(false);
    }
  };

  const checkRemaining = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-content', {
        body: { table, lang, batchSize: 1, dryRun: true },
      });
      if (error) throw new Error(error.message);
      setRemaining(data?.remaining ?? null);
      appendLog(`ℹ ${table} → ${lang}: qalır ${data?.remaining ?? '?'} sətir`);
    } catch (e) {
      appendLog(`❌ ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" /> Kontent Tərcüməsi (AI)
          </CardTitle>
          <CardDescription>
            DB kontentini AZ → ru/tr/en tərcümə edir. Provayderlər: <strong>Claude</strong> (Azure Foundry
            və ya birbaşa Anthropic — CLAUDE_BASE_URL-ə görə), <strong>GPT</strong> (Azure OpenAI) və Gemini.
            Yalnız boş (NULL) hədəf sütunları doldurur — əl ilə edilmiş və Fable in-session seed
            tərcümələrinə toxunmur. Batch-batch işləyir, istənilən vaxt dayandırıb davam etmək olar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select value={table} onValueChange={setTable} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Cədvəl" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {TABLES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lang} onValueChange={setLang} disabled={running}>
              <SelectTrigger><SelectValue placeholder="Dil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Rus (ru)</SelectItem>
                <SelectItem value="tr">Türk (tr)</SelectItem>
                <SelectItem value="kk">Qazax (kk)</SelectItem>
                <SelectItem value="uz">Özbək (uz)</SelectItem>
                <SelectItem value="ka">Gürcü (ka)</SelectItem>
                <SelectItem value="de">Alman (de)</SelectItem>
                <SelectItem value="ar">Ərəb (ar)</SelectItem>
                <SelectItem value="en">İngilis (en) — backfill</SelectItem>
              </SelectContent>
            </Select>
            <Select value={provider} onValueChange={setProvider} disabled={running}>
              <SelectTrigger><SelectValue placeholder="AI provayder" /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {!running ? (
                <>
                  <Button onClick={start} className="flex-1">
                    <Play className="w-4 h-4 me-1" /> Başlat
                  </Button>
                  <Button variant="outline" onClick={checkRemaining}>Yoxla</Button>
                </>
              ) : (
                <Button variant="destructive" onClick={() => { stopRef.current = true; }} className="flex-1">
                  <Square className="w-4 h-4 me-1" /> Dayandır
                </Button>
              )}
            </div>
          </div>

          {(running || remaining !== null) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {running && <Loader2 className="w-4 h-4 animate-spin" />}
              {remaining !== null && <span>Qalan sətir: <strong>{remaining}</strong></span>}
            </div>
          )}

          {log.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-3 max-h-72 overflow-y-auto space-y-1">
              {log.map((l, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">{l}</div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            💡 Böyük cədvəllər (hamiləlik kontenti, bloq, körpə adları) kiçik batch-lərlə gedir — vaxt aparır.
            Tövsiyə olunan sıra: weekly_tips → pregnancy_daily_content → baby_daily_info → mommy_daily_messages → faqs → blog_posts.
            Nəticəni yoxlamaq üçün tətbiqdə dili dəyişib ekranlara baxın.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminContentTranslations;
