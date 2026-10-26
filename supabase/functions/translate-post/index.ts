// ============================================================
// translate-post — Cəmiyyət postunun hədəf dilə tərcüməsi (keşli, hamıya pulsuz).
// Axın: community_post_translations keşi → varsa dərhal qaytar →
//       yoxsa AI (Claude → Azure GPT → Gemini) → keşə upsert → qaytar.
// Hər post+dil cütü ömründə YALNIZ 1 dəfə tərcümə olunur (keş).
// Auth: istənilən daxil olmuş istifadəçi (requireUser).
// Sui-istifadə qapalıdır: yalnız post_id qəbul edir (sərbəst mətn yox).
// Body:  { post_id: uuid, target_lang: 'az'|'en'|'ru'|'tr' }
// Cavab: { success, content, source_lang, cached, provider? }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';
import { callGeminiSmart } from '../_shared/vertex-ai.ts';
import { callClaude, isClaudeConfigured, claudeModelName } from '../_shared/claude.ts';
import { callAzureGpt, isAzureGptConfigured, azureGptModelName } from '../_shared/azure-openai.ts';
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LANGS = ['az', 'en', 'ru', 'tr', 'kk', 'uz', 'ka', 'de', 'ar', ...Object.keys(EXPANDED_LANGUAGE_NAMES)];
const LANG_NAMES: Record<string, string> = {
  az: 'Azerbaijani',
  en: 'English',
  ru: 'Russian',
  tr: 'Turkish',
  kk: 'Kazakh',
  uz: 'Uzbek',
  ka: 'Georgian',
  de: 'German',
  ar: 'Arabic',
  ...EXPANDED_LANGUAGE_NAMES,
};
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MAX_CONTENT_LEN = 6000;
const MAX_TOKENS = 4096;

function buildSystemPrompt(targetLang: string, sourceLang: string | null): string {
  const target = LANG_NAMES[targetLang];
  const source = sourceLang && LANG_NAMES[sourceLang] ? LANG_NAMES[sourceLang] : null;
  const style =
    targetLang === 'ru'
      ? 'Use the formal «вы» form. Use «малыш» for baby, «менструация» for period.'
      : targetLang === 'tr'
        ? 'Use the formal "siz" form. Use "bebek" for baby, "regl" for period.'
        : targetLang === 'kk'
          ? 'Write natural modern Kazakh (Cyrillic script). Use the formal «Сіз» form. Use «бөпе» for baby, «етеккір» for period.'
          : targetLang === 'uz'
            ? 'Write natural modern Uzbek (LATIN script) as used in Uzbekistan. Use the formal "siz" form. Use "chaqaloq" for baby, "hayz" for period.'
            : targetLang === 'ka'
              ? 'Write natural modern Georgian (Mkhedruli script). Use the formal «თქვენ» form. Use «ბავშვი» for baby, «მენსტრუაცია» for period.'
              : targetLang === 'de'
              ? 'Write natural German. Use the informal "du" form (warm parenting-community tone). Use "Baby" for baby, "Periode" for period.'
              : targetLang === 'ar'
                ? 'Write Modern Standard Arabic. Address the mother in the FEMININE second person (أنتِ). Use «الدورة الشهرية» for period, «طفلكِ» for baby.'
                : targetLang === 'az'
                  ? 'Use the formal "siz" form.'
                  : 'Use a warm, natural tone.';
  return [
    `You translate community posts written by mothers in a pregnancy & motherhood app (Anacan).`,
    `Translate the user's message to ${target}.${source ? ` The source language is most likely ${source}, but detect it yourself if it differs.` : ''}`,
    `Rules:`,
    `1) Return ONLY the translated text. No commentary, no quotes around it, no labels.`,
    `2) Preserve emojis, line breaks, punctuation style and formatting exactly.`,
    `3) Keep #hashtags, @mentions and URLs completely unchanged (do not translate them).`,
    `4) Do not add or omit anything; keep the author's tone (casual, warm, mother-to-mother).`,
    `5) Medical terms must stay accurate. Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → ru «мамочка», tr "anneciğim", kk «анашым», uz "Onajon", ka «დედიკო», de "Mami", ar «ماما», en "Mommy".`,
    `6) ${style}`,
    `7) If the text is already fully in ${target}, return it unchanged.`,
  ].join('\n');
}

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith('```')) {
    return t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return t;
}

async function translateText(
  content: string,
  targetLang: string,
  sourceLang: string | null,
): Promise<{ text: string; provider: string }> {
  const system = buildSystemPrompt(targetLang, sourceLang);
  let lastErr = '';

  // 1) Claude — ən yüksək keyfiyyət (keş sayəsində hər post+dil yalnız 1 dəfə)
  if (isClaudeConfigured()) {
    try {
      const text = stripFences(
        await callClaude({ system, user: content, maxTokens: MAX_TOKENS, temperature: 0.2 }),
      );
      if (text) return { text, provider: `claude:${claudeModelName()}` };
      lastErr = 'claude: empty response';
    } catch (e) {
      lastErr = `claude: ${(e as Error).message}`;
    }
  }

  // 2) Azure OpenAI GPT — fallback
  if (isAzureGptConfigured()) {
    try {
      const text = stripFences(
        await callAzureGpt({ system, user: content, maxTokens: MAX_TOKENS, temperature: 0.2 }),
      );
      if (text) return { text, provider: `azure-gpt:${azureGptModelName()}` };
      lastErr = `${lastErr} | azure-gpt: empty response`;
    } catch (e) {
      lastErr = `${lastErr} | azure-gpt: ${(e as Error).message}`;
    }
  }

  // 3) Gemini — son fallback
  const body = {
    contents: [{ role: 'user', parts: [{ text: content }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: MAX_TOKENS },
  };
  for (const model of GEMINI_MODELS) {
    try {
      const resp = await callGeminiSmart(model, body);
      if (!resp.ok) {
        lastErr = `${model}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`;
        continue;
      }
      const data = await resp.json();
      const text = stripFences(
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '',
      );
      if (text) return { text, provider: `gemini:${model}` };
      lastErr = `${model}: empty response`;
    } catch (e) {
      lastErr = `${model}: ${(e as Error).message}`;
    }
  }
  throw new Error(lastErr || 'translation failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // ── Auth: daxil olmuş istifadəçi ──
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const postId = String(body?.post_id ?? '');
    const targetLang = String(body?.target_lang ?? '');

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
      return json({ success: false, error: 'invalid post_id' }, 400);
    }
    if (!LANGS.includes(targetLang)) {
      return json({ success: false, error: "target_lang must be 'az'|'en'|'ru'|'tr'" }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1) Keş yoxlaması — varsa dərhal qaytar ──
    const { data: cached } = await admin
      .from('community_post_translations')
      .select('content, model')
      .eq('post_id', postId)
      .eq('lang', targetLang)
      .maybeSingle();

    if (cached?.content) {
      // Mənbə dili cavab üçün postdan oxu (yüngül sorğu)
      const { data: p } = await admin
        .from('community_posts')
        .select('language')
        .eq('id', postId)
        .maybeSingle();
      return json({
        success: true,
        content: cached.content,
        source_lang: p?.language ?? null,
        cached: true,
      });
    }

    // ── 2) Postu oxu ──
    const { data: post, error: postErr } = await admin
      .from('community_posts')
      .select('content, language, is_active')
      .eq('id', postId)
      .maybeSingle();

    if (postErr) return json({ success: false, error: postErr.message }, 500);
    if (!post || post.is_active === false) {
      return json({ success: false, error: 'post not found' }, 404);
    }

    const content = String(post.content ?? '').trim();
    if (!content) return json({ success: false, error: 'post has no text' }, 400);
    if (content.length > MAX_CONTENT_LEN) {
      return json({ success: false, error: 'post too long to translate' }, 400);
    }

    // Eyni dil — tərcüməyə ehtiyac yoxdur
    if (post.language === targetLang) {
      return json({
        success: true,
        content,
        source_lang: post.language,
        cached: false,
        same_language: true,
      });
    }

    // ── 3) AI tərcümə (Claude → Azure GPT → Gemini) ──
    const { text, provider } = await translateText(content, targetLang, post.language ?? null);

    // ── 4) Keşə yaz (yarış-təhlükəsiz: eyni anda 2 sorğu gəlsə, upsert toqquşmur) ──
    const { error: upsertErr } = await admin
      .from('community_post_translations')
      .upsert(
        { post_id: postId, lang: targetLang, content: text, model: provider },
        { onConflict: 'post_id,lang' },
      );
    if (upsertErr) console.error('[translate-post] cache upsert failed:', upsertErr.message);

    return json({
      success: true,
      content: text,
      source_lang: post.language ?? null,
      cached: false,
      provider,
    });
  } catch (e) {
    console.error('[translate-post] error:', e);
    return json({ success: false, error: String((e as Error).message) }, 500);
  }
});
