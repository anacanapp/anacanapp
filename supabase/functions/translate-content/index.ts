// ============================================================
// translate-content — DB kontentinin AZ → ru/tr/en toplu tərcüməsi.
// Provayder prioriteti: Claude Fable (ANTHROPIC_API_KEY) → Gemini (fallback).
// Registry-dəki hər cədvəl üçün: hədəf sütunu (`${field}_${lang}`) NULL olan
// sətirləri batch-batch götürür, AI-yə JSON kimi verir, nəticəni yazır.
// Auth: admin JWT (has_role) VƏ YA x-seed-secret == CRON_SECRET (skript üçün).
// Body: { table, lang: 'ru'|'tr'|'en', batchSize?: number, dryRun?: boolean }
// Cavab: { processed, updated, remaining, provider, failures[] }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callGeminiSmart } from '../_shared/vertex-ai.ts';
import { callClaude, isClaudeConfigured, claudeModelName } from '../_shared/claude.ts';
import { callAzureGpt, isAzureGptConfigured, azureGptModelName } from '../_shared/azure-openai.ts';
import { EXPANDED_LANGUAGE_NAMES, outputLanguageRule } from '../_shared/languages.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seed-secret',
};

interface TableCfg {
  /** text → text sütunlar */
  text?: string[];
  /** text[] → text[] sütunlar */
  arr?: string[];
  /** jsonb (string massivi) → jsonb sütunlar */
  json?: string[];
  /** mənbə text[] amma hədəf sütun TEXT-dir (JSON string kimi saxlanır) */
  arrText?: string[];
  /** uzun kontent üçün token limiti */
  maxTokens?: number;
}

const REGISTRY: Record<string, TableCfg> = {
  // ── _ru/_tr sütunları migration ilə əlavə olunan cədvəllər ──
  pregnancy_daily_content: {
    text: ['baby_development', 'baby_message', 'baby_size_fruit', 'body_changes', 'daily_tip',
      'doctor_visit_tip', 'emotional_tip', 'exercise_tip', 'mother_tips', 'mother_warnings',
      'nutrition_tip', 'partner_tip',
      // Əkiz/çoxdöllü hamiləliyə xas məsləhət (Duzelis29/32) — əksər sətirlərdə NULL-dur
      // (yalnız ~12 mərhələ günündə dolu), digər sətirlərdə tərcümə ediləcək heç nə yoxdur.
      'multiples_tip'],
    arr: ['foods_to_avoid', 'mother_symptoms', 'recommended_exercises', 'recommended_foods', 'tests_to_do'],
  },
  weekly_tips: { text: ['title', 'content'], json: ['tips'] },
  baby_daily_info: { text: ['info'] },
  mommy_daily_messages: { text: ['message'] },
  admin_recipes: { text: ['title', 'description', 'category'], arr: ['tags'], json: ['ingredients', 'instructions'] },
  nutrition_tips: { text: ['title', 'content'] },
  trimester_tips: { text: ['tip_text'] },
  blog_categories: { text: ['name', 'description'] },
  intro_slides: { text: ['title', 'subtitle', 'description'] },
  products: { text: ['name', 'description', 'category'] },
  cakes: { text: ['name', 'description', 'milestone_label'] },
  // QEYD: 'importance' slug-dur (essential/recommended) — UI açarlarla göstərir, tərcümə edilmir!
  vitamins: { text: ['dosage'], arr: ['benefits', 'food_sources'] },
  exercises: { text: ['description'] },
  baby_names_db: { text: ['origin', 'meaning'] },
  // ── _ru/_tr sütunları artıq mövcud olan cədvəllər (backfill) ──
  blog_posts: { text: ['title', 'excerpt', 'content'], maxTokens: 32768 },
  faqs: { text: ['question', 'answer'] },
  development_tips: { text: ['title', 'content'] },
  partner_daily_tips: { text: ['tip_text'] },
  flow_insights: { text: ['title', 'content'] },
  flow_phase_tips: { text: ['tip_text'] },
  epds_questions: { text: ['question_text'] },
  hospital_bag_templates: { text: ['item_name', 'notes'] },
  onboarding_stages: { text: ['title', 'subtitle', 'description'] },
  first_aid_scenarios: { text: ['title', 'description'] },
  first_aid_steps: { text: ['title', 'instruction'] },
  play_activities: { text: ['title', 'description', 'instructions'] },
  baby_crisis_periods: { text: ['title', 'description'], arrText: ['symptoms', 'tips'] },
  mental_health_resources: { text: ['name', 'description'] },
  breathing_exercises: { text: ['name', 'description'] },
  // Statik push şablonları (cron: send-daily-notifications)
  scheduled_notifications: { text: ['title', 'body'] },
  // Günə-özəl push bildirişləri (hamiləlik: gün 1-280, ana: gün 1-1460)
  pregnancy_day_notifications: { text: ['title', 'body'] },
  mommy_day_notifications: { text: ['title', 'body'] },
};

const LANG_NAMES: Record<string, string> = { ru: 'Russian', tr: 'Turkish', en: 'English', kk: 'Kazakh', uz: 'Uzbek', ka: 'Georgian', de: 'German', ar: 'Arabic', ...EXPANDED_LANGUAGE_NAMES };
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function buildSystemPrompt(lang: string): string {
  const target = LANG_NAMES[lang];
  const style = lang === 'ru'
    ? 'Use the formal «вы» form when addressing the user. Use «менструация» for period, «малыш» for baby. Emergency number is 103.'
    : lang === 'tr'
      ? 'Use the formal "siz" form when addressing the user. Use "regl" for period, "bebek" for baby. Emergency number is 112.'
      : lang === 'kk'
        ? 'Write natural modern Kazakh (Cyrillic script). Use the formal «Сіз» form when addressing the user. Use «етеккір» for period, «бөпе» for baby, «ДДСҰ» for WHO. Emergency number is 103.'
        : lang === 'uz'
          ? 'Write natural modern Uzbek (LATIN script) as used in Uzbekistan. Use the formal "siz" form when addressing the user. Use "hayz" for period, "chaqaloq" for baby, "JSST" for WHO. Emergency number is 103.'
          : lang === 'ka'
            ? 'Write natural modern Georgian (Mkhedruli script). Use the formal «თქვენ» form when addressing the user. Use «მენსტრუაცია» for period, «ბავშვი» for baby, «ჯანმო» for WHO. Emergency number is 112.'
            : lang === 'de'
            ? 'Write natural German as used in German parenting apps. Use the informal "du" form when addressing the user (warm, familiar tone). Use "Baby" for baby, "Periode" for period. Emergency number is 112.'
            : lang === 'ar'
              ? 'Write Modern Standard Arabic. ALWAYS address the mother in the FEMININE second-person singular (أنتِ). Use «الدورة الشهرية» for period, «طفلكِ»/«رضيعكِ» for baby, «منظمة الصحة العالمية» for WHO. Where the source mentions a specific emergency number (103/112), write «اتصلي بخدمات الطوارئ المحلية» instead.'
              : 'Use a warm, professional tone.';
  return [
    `You are a professional medical/parenting content translator for a pregnancy & motherhood app (Anacan).`,
    `Translate the JSON values from Azerbaijani to ${target}.`,
    `Rules:`,
    `1) Return ONLY valid JSON with EXACTLY the same keys. No extra keys, no commentary.`,
    `2) String values stay strings; array values stay arrays with the same length and order.`,
    `3) Preserve emojis, line breaks (\\n), HTML/Markdown formatting, numbers, units and placeholders like {x} exactly.`,
    `4) Keep brand/product names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: when "Anacan" is an affectionate address to the mother (baby speaking to mom), translate it: ru «мамочка», tr "anneciğim", kk «анашым», uz "Onajon", ka «დედიკო», de "Mami", ar «ماما», en "Mommy".`,
    `5) Medical accuracy over literal wording; natural, warm tone for mothers. ${style}`,
    outputLanguageRule(lang),
  ].join('\n');
}

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return t;
}

async function translateRow(
  payload: Record<string, unknown>,
  lang: string,
  maxTokens: number,
  preferredProvider: string = 'auto'
): Promise<{ out: Record<string, unknown>; provider: string }> {
  let lastErr = '';

  const tryClaude = preferredProvider === 'auto' || preferredProvider === 'claude';
  const tryAzureGpt = preferredProvider === 'auto' || preferredProvider === 'azure-gpt';
  const tryGemini = preferredProvider === 'auto' || preferredProvider === 'gemini';

  // 1) Claude — birinci prioritet (birbaşa Anthropic və ya Azure Foundry, CLAUDE_BASE_URL-ə görə)
  if (tryClaude && isClaudeConfigured()) {
    try {
      const text = await callClaude({
        system: buildSystemPrompt(lang),
        user: JSON.stringify(payload),
        maxTokens,
        temperature: 0.2,
      });
      const parsed = JSON.parse(stripFences(text));
      if (parsed && typeof parsed === 'object') {
        return { out: parsed, provider: `claude:${claudeModelName()}` };
      }
      lastErr = 'claude: non-object JSON';
    } catch (e) {
      lastErr = `claude: ${(e as Error).message}`;
    }
  }

  // 2) Azure OpenAI GPT — alternativ seçim / fallback
  if (tryAzureGpt && isAzureGptConfigured()) {
    try {
      const text = await callAzureGpt({
        system: buildSystemPrompt(lang),
        user: JSON.stringify(payload),
        maxTokens,
        temperature: 0.2,
      });
      const parsed = JSON.parse(stripFences(text));
      if (parsed && typeof parsed === 'object') {
        return { out: parsed, provider: `azure-gpt:${azureGptModelName()}` };
      }
      lastErr = `${lastErr} | azure-gpt: non-object JSON`;
    } catch (e) {
      lastErr = `${lastErr} | azure-gpt: ${(e as Error).message}`;
    }
  }

  // 3) Gemini — son fallback
  if (!tryGemini) throw new Error(lastErr || 'selected provider not configured/failed');
  const body = {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
    systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  };
  for (const model of MODELS) {
    try {
      const resp = await callGeminiSmart(model, body);
      if (!resp.ok) { lastErr = `${model}: HTTP ${resp.status} ${await resp.text()}`; continue; }
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      if (!text) { lastErr = `${model}: empty response`; continue; }
      const parsed = JSON.parse(stripFences(text));
      if (parsed && typeof parsed === 'object') return { out: parsed, provider: `gemini:${model}` };
      lastErr = `${model}: non-object JSON`;
    } catch (e) {
      lastErr = `${model}: ${(e as Error).message}`;
    }
  }
  throw new Error(lastErr || 'translation failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Auth: skript sirri VƏ YA admin JWT ──
    const secret = req.headers.get('x-seed-secret');
    let authorized = !!secret && secret === Deno.env.get('CRON_SECRET');
    if (!authorized) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) return json({ error: 'unauthorized' }, 401);
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user?.id) return json({ error: 'unauthorized' }, 401);
      const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'admin',
      });
      if (roleErr || !isAdmin) return json({ error: 'admin role required' }, 403);
      authorized = true;
    }

    const body = await req.json();
    const table = String(body?.table ?? '');
    const lang = String(body?.lang ?? '');
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 8, 1), 25);
    const dryRun = !!body?.dryRun;
    const provider = ['auto', 'claude', 'azure-gpt', 'gemini'].includes(String(body?.provider))
      ? String(body?.provider)
      : 'auto';

    const cfg = REGISTRY[table];
    if (!cfg) return json({ error: `unknown table '${table}'`, tables: Object.keys(REGISTRY) }, 400);
    if (!['ru', 'tr', 'en', 'kk', 'uz', 'ka', 'de', 'ar'].includes(lang)) return json({ error: "lang must be 'ru' | 'tr' | 'en' | 'kk' | 'uz' | 'ka' | 'de' | 'ar'" }, 400);

    const textF = cfg.text ?? [];
    const arrF = cfg.arr ?? [];
    const jsonF = cfg.json ?? [];
    const arrTextF = cfg.arrText ?? [];
    const allFields = [...textF, ...arrF, ...jsonF, ...arrTextF];
    const orFilter = allFields.map((f) => `${f}_${lang}.is.null`).join(',');

    // Qalan sətir sayı
    const { count: remainingBefore, error: cntErr } = await admin
      .from(table).select('id', { count: 'exact', head: true }).or(orFilter);
    if (cntErr) return json({ error: `count failed: ${cntErr.message}` }, 500);
    if (!remainingBefore) return json({ table, lang, processed: 0, updated: 0, remaining: 0, done: true });

    const { data: rows, error: selErr } = await admin.from(table).select('*').or(orFilter).limit(batchSize);
    if (selErr) return json({ error: `select failed: ${selErr.message}` }, 500);

    let updated = 0;
    let lastProvider = isClaudeConfigured() ? `claude:${claudeModelName()}` : 'gemini';
    const failures: Array<{ id: string; error: string }> = [];

    for (const row of rows ?? []) {
      // Tərcümə olunacaq sahələri topla (mənbə: base ?? _az; hədəf boş olanlar)
      const payload: Record<string, unknown> = {};
      for (const f of allFields) {
        const target = row[`${f}_${lang}`];
        if (target !== null && target !== undefined && String(target).length > 0) continue;
        const src = row[f] ?? row[`${f}_az`];
        if (src === null || src === undefined) continue;
        if (typeof src === 'string' && !src.trim()) continue;
        if (Array.isArray(src) && src.length === 0) continue;
        payload[f] = src;
      }
      if (Object.keys(payload).length === 0) continue;
      if (dryRun) { updated++; continue; }

      try {
        const { out, provider: usedProvider } = await translateRow(payload, lang, cfg.maxTokens ?? 8192, provider);
        lastProvider = usedProvider;
        const update: Record<string, unknown> = {};
        for (const f of Object.keys(payload)) {
          const v = out[f];
          if (v === null || v === undefined) continue;
          if (arrTextF.includes(f)) {
            update[`${f}_${lang}`] = JSON.stringify(Array.isArray(v) ? v : [String(v)]);
          } else if (arrF.includes(f) || jsonF.includes(f)) {
            update[`${f}_${lang}`] = Array.isArray(v) ? v : [String(v)];
          } else {
            update[`${f}_${lang}`] = typeof v === 'string' ? v : JSON.stringify(v);
          }
        }
        if (Object.keys(update).length === 0) { failures.push({ id: row.id, error: 'empty translation' }); continue; }
        const { error: updErr } = await admin.from(table).update(update).eq('id', row.id);
        if (updErr) { failures.push({ id: row.id, error: updErr.message }); continue; }
        updated++;
      } catch (e) {
        failures.push({ id: row.id, error: (e as Error).message });
      }
    }

    const { count: remainingAfter } = await admin
      .from(table).select('id', { count: 'exact', head: true }).or(orFilter);

    return json({
      table, lang,
      processed: rows?.length ?? 0,
      updated,
      remaining: remainingAfter ?? 0,
      done: (remainingAfter ?? 0) === 0,
      provider: lastProvider,
      failures: failures.slice(0, 10),
    });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
