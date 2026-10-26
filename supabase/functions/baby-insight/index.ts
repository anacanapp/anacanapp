/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// baby-insight: Yuxu / Qidalanma / Bez göstəricilərinin körpənin yaşına görə
// Independently requested care sections in all21 languages; no diagnosis.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';
import { serverCopy } from '../_shared/localized-copy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface InsightRequest {
  language?: string;
  section?: 'sleep' | 'feeding' | 'diaper';
  child: {
    ageMonths: number;
    ageDays: number;
    gender?: string;
  };
  stats: {
    localHour: number;        // günün neçəsidir (0-23) — natamam gün konteksti
    sleepMinutes: number;     // bugünkü cəmi yuxu (dəq)
    sleepCount: number;
    feedingCount: number;
    breastCount: number;
    formulaCount: number;
    formulaMl: number;        // cəmi ml (məlumdursa)
    solidCount: number;
    diaperCount: number;
    wetCount: number;
    dirtyCount: number;
    mixedCount: number;
  };
}

type SectionStatus = 'normal' | 'low' | 'high' | 'watch';
interface SectionInsight { status: SectionStatus; note: string; }
interface Insight { sleep: SectionInsight; feeding: SectionInsight; diaper: SectionInsight; }

const FALLBACK: Record<string, Insight> = {
  az: {
    sleep: { status: 'normal', note: 'Yuxu qeydləri toplanır — gün boyu izləməyə davam edin.' },
    feeding: { status: 'normal', note: 'Qidalanma qeydləri toplanır — hər qidalanmanı qeyd etməyə çalışın.' },
    diaper: { status: 'normal', note: 'Bez qeydləri toplanır — nəm bezlər qidalanmanın yaxşı göstəricisidir.' },
  },
  en: {
    sleep: { status: 'normal', note: 'Sleep data is being collected — keep tracking through the day.' },
    feeding: { status: 'normal', note: 'Feeding data is being collected — try to log every feed.' },
    diaper: { status: 'normal', note: 'Diaper data is being collected — wet diapers are a good sign of feeding.' },
  },
  ru: {
    sleep: { status: 'normal', note: 'Данные о сне собираются — продолжайте отмечать в течение дня.' },
    feeding: { status: 'normal', note: 'Данные о кормлении собираются — старайтесь отмечать каждое кормление.' },
    diaper: { status: 'normal', note: 'Данные о подгузниках собираются — мокрые подгузники — хороший признак питания.' },
  },
  tr: {
    sleep: { status: 'normal', note: 'Uyku kayıtları toplanıyor — gün boyunca izlemeye devam edin.' },
    feeding: { status: 'normal', note: 'Beslenme kayıtları toplanıyor — her beslenmeyi kaydetmeye çalışın.' },
    diaper: { status: 'normal', note: 'Bez kayıtları toplanıyor — ıslak bezler beslenmenin iyi bir göstergesidir.' },
  },
  kk: {
    sleep: { status: 'normal', note: 'Ұйқы туралы жазбалар жиналып жатыр — күні бойы бақылауды жалғастырыңыз.' },
    feeding: { status: 'normal', note: 'Тамақтану туралы жазбалар жиналып жатыр — әр тамақтануды белгілеп отыруға тырысыңыз.' },
    diaper: { status: 'normal', note: 'Жөргек туралы жазбалар жиналып жатыр — суланған жөргектер жеткілікті тамақтанудың жақсы көрсеткіші болып саналады.' },
  },
  uz: {
    sleep: { status: 'normal', note: 'Uyqu yozuvlari toʻplanmoqda — kun davomida kuzatishda davom eting.' },
    feeding: { status: 'normal', note: 'Ovqatlanish yozuvlari toʻplanmoqda — har bir ovqatlantirishni qayd etishga harakat qiling.' },
    diaper: { status: 'normal', note: 'Taglik yozuvlari toʻplanmoqda — hoʻl tagliklar yetarli ovqatlanishning yaxshi belgisidir.' },
  },
  ka: {
    sleep: { status: 'normal', note: 'ძილის ჩანაწერები გროვდება — განაგრძეთ დაკვირვება დღის განმავლობაში.' },
    feeding: { status: 'normal', note: 'კვების ჩანაწერები გროვდება — შეეცადეთ, ყოველი კვება აღრიცხოთ.' },
    diaper: { status: 'normal', note: 'საფენების ჩანაწერები გროვდება — სველი საფენები კარგი კვების კარგი მაჩვენებელია.' },
  },
  de: {
    sleep: { status: 'normal', note: 'Schlafaufzeichnungen werden gesammelt — dokumentiere den Schlaf weiterhin über den Tag hinweg.' },
    feeding: { status: 'normal', note: 'Fütterungsaufzeichnungen werden gesammelt — versuche, jede Mahlzeit zu dokumentieren.' },
    diaper: { status: 'normal', note: 'Windelaufzeichnungen werden gesammelt — nasse Windeln sind ein guter Hinweis auf eine ausreichende Nahrungsaufnahme.' },
  },
  ar: {
    sleep: { status: 'normal', note: 'جارٍ جمع سجلات النوم — واصلي المتابعة على مدار اليوم.' },
    feeding: { status: 'normal', note: 'جارٍ جمع سجلات التغذية — حاولي تسجيل كل رضعة.' },
    diaper: { status: 'normal', note: 'جارٍ جمع سجلات الحفاضات — تُعد الحفاضات المبللة مؤشرًا جيدًا على كفاية التغذية.' },
  },
};

const LANG_CONF: Record<string, { outLang: string }> = {
  ...Object.fromEntries(Object.entries(EXPANDED_LANGUAGE_NAMES).map(([language, outLang]) => [language, { outLang }])),
  az: { outLang: '' },
  en: { outLang: 'ENGLISH' },
  ru: { outLang: 'RUSSIAN' },
  tr: { outLang: 'TURKISH' },
  kk: { outLang: 'KAZAKH' },
  uz: { outLang: 'UZBEK (Latin script)' },
  ka: { outLang: 'GEORGIAN (ქართული, Mkhedruli script)' },
  de: { outLang: 'GERMAN' },
  ar: { outLang: 'ARABIC (feminine address to the mother)' },
};

import { checkModerationAccess } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const moderationError = await checkModerationAccess(user.id, 'baby-insight');
    if (moderationError) return moderationError;
    let body: InsightRequest;
    try { body = await req.json(); } catch { body = {} as InsightRequest; }
    const { language = 'az', child, stats, section } = body || {};
    if (!child || !stats) return new Response(JSON.stringify({ success: false, error: 'INVALID_INSIGHT_DATA' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!Object.hasOwn(LANG_CONF, language) || section !== undefined && !['sleep','feeding','diaper'].includes(section)) {
      return new Response(JSON.stringify({ success: false, error: 'INVALID_INSIGHT_SCOPE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sections = section ? [section] : ['sleep','feeding','diaper'];
    const fields = { sleep: ['sleepMinutes','sleepCount'], feeding: ['feedingCount','breastCount','formulaCount','formulaMl','solidCount'], diaper: ['diaperCount','wetCount','dirtyCount','mixedCount'] };
    const numbers = [child.ageMonths,child.ageDays,stats.localHour,...sections.flatMap(key => fields[key as keyof typeof fields].map(field => (stats as any)[field]))];
    if (numbers.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000) || stats.localHour > 23) {
      return new Response(JSON.stringify({ success: false, error: 'INVALID_INSIGHT_DATA' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const usage = await checkAndConsumeServerSide(user.id, 'baby_insight');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const langConf = LANG_CONF[language] ?? LANG_CONF.az;

    const ageDesc = child.ageMonths < 1
      ? `${child.ageDays} günlük yenidoğan`
      : child.ageMonths < 24
        ? `${child.ageMonths} aylıq körpə`
        : `${Math.floor(child.ageMonths / 12)} yaşlı uşaq`;

    const sleepH = Math.floor(stats.sleepMinutes / 60);
    const sleepM = stats.sleepMinutes % 60;
    const entries = [
      sections.includes('sleep') ? `- Yuxu: ${sleepH} saat ${sleepM} dəq (${stats.sleepCount} seans)` : '',
      sections.includes('feeding') ? `- Qidalanma: cəmi ${stats.feedingCount} dəfə (ana südü: ${stats.breastCount}, süd əvəzedicisi: ${stats.formulaCount}, cəmi ${stats.formulaMl} ml, əlavə qida: ${stats.solidCount})` : '',
      sections.includes('diaper') ? `- Bez: cəmi ${stats.diaperCount} (nəm: ${stats.wetCount}, çirkli: ${stats.dirtyCount}, qarışıq: ${stats.mixedCount})` : '',
    ].filter(Boolean).join('\n');
    const outputShape = JSON.stringify(Object.fromEntries(sections.map(key => [key, { status: 'normal', note: '...' }])));

    const prompt = `${langConf.outLang ? `OUTPUT LANGUAGE: ${langConf.outLang}. Every "note" value MUST be written in natural, fluent ${langConf.outLang} — NEVER in Azerbaijani, even though the instructions below are written in Azerbaijani.

` : ''}Sən Anacan tətbiqinin pediatrik məlumat köməkçisisən (həkim DEYİLSƏN, diaqnoz qoymursan).
Körpənin BUGÜNKÜ qulluq göstəricilərini yaşına uyğun normalarla (ÜST/AAP təlimatları əsasında) müqayisə et.

KÖRPƏ: ${ageDesc}${child.gender ? ` (${child.gender === 'girl' ? 'qız' : 'oğlan'})` : ''}
VAXT KONTEKSTİ: hazırda saat təxminən ${stats.localHour}:00 — gün hələ bitməyib, göstəriciləri günün bu hissəsinə görə qiymətləndir (məsələn, səhər saatlarında az qeyd normaldır).

BUGÜNKÜ QEYDLƏR:
${entries}

YAŞ NORMALARI (istinad üçün, 24 saatlıq):
- 0-3 ay: yuxu 14-17s; qidalanma 8-12 dəfə; nəm bez 6+; nəcis 3-4+ (yaş artdıqca seyrəkləşə bilər)
- 4-6 ay: yuxu 12-16s; qidalanma 6-8 dəfə; nəm bez 5-6
- 7-12 ay: yuxu 12-15s; qidalanma 5-6 dəfə + əlavə qida; nəm bez 5-6
- 13-24 ay: yuxu 11-14s; 3 əsas + 2 qəlyanaltı; bez 4-6
- 24+ ay: yuxu 10-13s; 3 əsas + qəlyanaltılar

QAYDALAR:
1. Hər bölmə üçün status seç: "normal" | "low" (günün vaxtına görə gözləniləndən az) | "high" (çox) | "watch" (diqqət tələb edir, məs. 0 nəm bez axşama yaxın)
2. Hər note MAKSİMUM 140 simvol, konkret və faydalı olsun (rəqəm + qısa istiqamət). Ümumi sözlərdən qaç.
3. Sakitləşdirici, dəstəkləyici ton. Qorxutma. Ciddi hal şübhəsində "həkimlə məsləhətləşin" de.
4. Qeyd azdırsa bunu nəzərə al — valideyn hər şeyi qeyd etməyə bilər.

YALNIZ bu JSON formatında cavab ver (başqa heç nə yazma):
${outputShape}
Analyze ONLY these sections: ${sections.join(', ')}. Do not infer or discuss measurements from an unrequested section.${langConf.outLang ? `

IMPORTANT: Write ALL "note" text values ONLY in ${langConf.outLang} (correct spelling and grammar — not a transliteration of Azerbaijani). Keep JSON keys and status enum values exactly as shown.` : ''}`;

    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    let geminiResponse: Response | null = null;
    for (const model of models) {
      geminiResponse = await callGeminiSmart(model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      });
      if (geminiResponse.ok) break;
    }

    let insight: Partial<Insight> | null = null;
    if (geminiResponse && geminiResponse.ok) {
      const g = await geminiResponse.json();
      const textContent = g?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const m = textContent.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          const ok = (s: any): s is SectionInsight =>
            s && typeof s.note === 'string' && !!s.note.trim() && ['normal', 'low', 'high', 'watch'].includes(s.status);
          if (sections.every(key => ok(parsed[key]))) {
            insight = Object.fromEntries(sections.map(key => [key, { status: parsed[key].status, note: String(parsed[key].note).slice(0, 200) }]));
          }
        } catch { /* fallback aşağıda */ }
      }
    }

    if (!insight) {
      if (section) return new Response(JSON.stringify({ success: false, error: 'AI_INSIGHT_UNAVAILABLE' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      insight = serverCopy('babyFallback', language, FALLBACK[language] ?? FALLBACK.az);
    }

    return new Response(JSON.stringify({ success: true, insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('baby-insight request failed');
    return new Response(JSON.stringify({ success: false, error: 'AI_INSIGHT_UNAVAILABLE' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
