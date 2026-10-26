/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// name-ai-lookup: Körpə adları alətində tapılmayan adı AI ilə axtarır,
// mənasını 4 dildə çıxarır və bazaya yazır (safety-ai-lookup pattern-i).
// Bir dəfə axtarılan ad bir daha AI-ya getmir — DB-dən gəlir.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser } from "../_shared/auth.ts";
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { LANGUAGE_CODES, EXPANDED_LANGUAGE_NAMES, isExpandedLanguage } from '../_shared/languages.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NameRequest {
  name: string;
  language?: string; // az | en | ru | tr
}

const LANG_FIELD: Record<string, { meaning: string; origin: string }> = {
  az: { meaning: 'meaning_az', origin: 'origin' },
  en: { meaning: 'meaning_en', origin: 'origin_en' },
  ru: { meaning: 'meaning_ru', origin: 'origin_ru' },
  tr: { meaning: 'meaning_tr', origin: 'origin_tr' },
  kk: { meaning: 'meaning_kk', origin: 'origin_kk' },
  uz: { meaning: 'meaning_uz', origin: 'origin_uz' },
  ka: { meaning: 'meaning_ka', origin: 'origin_ka' },
  de: { meaning: 'meaning_de', origin: 'origin_de' },
  ar: { meaning: 'meaning_ar', origin: 'origin_ar' },
  ...Object.fromEntries(Object.keys(EXPANDED_LANGUAGE_NAMES).map(language => [language, { meaning: `meaning_${language}`, origin: `origin_${language}` }])),
};

/** Adı bazadakı standart formaya salır: "aylin" → "Aylin" */
function properCase(s: string, language: string): string {
  const locale = isExpandedLanguage(language) ? language : 'az';
  const t = s.trim().toLocaleLowerCase(locale);
  return t.charAt(0).toLocaleUpperCase(locale) + t.slice(1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { name: rawName, language = 'az' } = await req.json() as NameRequest;
    const displayLang = LANGUAGE_CODES.includes(language) ? language : 'az';
    // Siyahı seqmenti (baby_names_db.lang) — hər dilin öz seqmenti var (Duzelis2/3/4.sql
    // ilə kk/de/ar üçün real yerli ad dəstləri əlavə olundu; əvvəllər kk→az, de/ar→en
    // körpüsü ilə "yerli olmayan" adlar göstərilirdi).
    const lang = displayLang;

    const name = properCase(String(rawName || ''), displayLang);
    if (name.length < 2 || name.length > 30 || !/^[\p{L}\s'-]+$/u.test(name)) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_name' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Artıq bazadadır? (istənilən lang seqmentində — dublikat yaratmayaq)
    const { data: existing } = await supabase
      .from('baby_names_db')
      .select('*')
      .ilike('name', name)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const f = LANG_FIELD[displayLang];
      return new Response(JSON.stringify({
        success: true,
        found: true,
        fromDb: true,
        item: existing,
        display: {
          name: existing.name,
          gender: existing.gender,
          meaning: existing[f.meaning] || (displayLang === 'kk' || displayLang === 'uz' || displayLang === 'ka' ? existing.meaning_ru : null) || (displayLang === 'de' || displayLang === 'ar' || isExpandedLanguage(displayLang) ? existing.meaning_en : null) || existing.meaning_az || existing.meaning,
          origin: existing[f.origin] || (displayLang === 'kk' || displayLang === 'uz' || displayLang === 'ka' ? existing.origin_ru : null) || (displayLang === 'de' || displayLang === 'ar' || isExpandedLanguage(displayLang) ? existing.origin_en : null) || existing.origin,
          popularity: existing.popularity || 0,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2) AI axtarışı — 7 dildə məna + mənşə
    const prompt = `Sən körpə adları üzrə etimoloji məlumat bazasısan.
Ad: "${name}"

Bu adın həqiqi şəxs adı olub-olmadığını müəyyən et (Azərbaycan, türk, ərəb, fars, rus, qazax, alman, Avropa və s. mənşəli qadın/kişi adları).

QAYDALAR:
1. YALNIZ aşağıdakı JSON formatında cavab ver (başqa heç nə yazma, markdown yox):
{"found":true,"gender":"girl","origin_az":"Ərəb mənşəli","origin_en":"Arabic","origin_ru":"Арабское","origin_tr":"Arapça kökenli","origin_kk":"Араб тілінен","origin_uz":"Arab tilidan","origin_ka":"არაბული წარმოშობის","origin_de":"Arabischer Herkunft","origin_ar":"من أصل عربي","meaning_az":"...","meaning_en":"...","meaning_ru":"...","meaning_tr":"...","meaning_kk":"...","meaning_uz":"...","meaning_ka":"...","meaning_de":"...","meaning_ar":"..."}
2. gender: "boy" | "girl" | "unisex"
3. Hər meaning_* qısa və dəqiq olsun (maksimum 120 simvol), həmin dildə yazılsın (meaning_kk qazax dilində kiril, meaning_uz özbək dilində latın yazısı, meaning_ka gürcü dilində Mxedruli yazısı, meaning_de alman, meaning_ar ərəb dilində).
4. Ad real şəxs adı deyilsə (təsadüfi söz, əşya, təhqir və s.): {"found":false}
5. Uydurma etimologiya vermə — əmin deyilsənsə found:false qaytar.
6. Also provide meaning_zh/origin_zh in Simplified Mandarin, meaning_id/origin_id in Indonesian, meaning_fr/origin_fr in French, meaning_es/origin_es in Spanish, meaning_pt/origin_pt in European Portuguese, meaning_vi/origin_vi in Vietnamese, meaning_hi/origin_hi in Devanagari Hindi, meaning_ja/origin_ja in Japanese, meaning_ko/origin_ko in Korean, meaning_pl/origin_pl in Polish, meaning_nl/origin_nl in Dutch, and meaning_sv/origin_sv in Swedish. These are translations of the same verified etymology, not new claims. Keep the supplied name unchanged.`;

    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let aiText = '';
    for (const model of models) {
      const resp = await callGeminiSmart(model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      });
      if (resp.ok) {
        const g = await resp.json();
        aiText = g?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (aiText) break;
      }
    }

    const m = aiText.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI response parse failed');
    const parsed = JSON.parse(m[0]);

    if (!parsed.found) {
      return new Response(JSON.stringify({ success: true, found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (isExpandedLanguage(displayLang) && (!String(parsed[`meaning_${displayLang}`] || '').trim()
      || !String(parsed[`origin_${displayLang}`] || '').trim())) throw new Error('localized_response_missing');

    const gender = ['boy', 'girl', 'unisex'].includes(parsed.gender) ? parsed.gender : 'unisex';
    const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

    // 3) Bazaya yaz — istifadəçinin dil seqmentinə (lang) düşür,
    //    bütün dillərin tərcümələri ilə birlikdə
    const row = {
      name,
      gender,
      lang,
      origin: clip(parsed.origin_az, 80),
      origin_en: clip(parsed.origin_en, 80),
      origin_ru: clip(parsed.origin_ru, 80),
      origin_tr: clip(parsed.origin_tr, 80),
      origin_kk: clip(parsed.origin_kk, 80),
      origin_uz: clip(parsed.origin_uz, 80),
      origin_ka: clip(parsed.origin_ka, 80),
      origin_de: clip(parsed.origin_de, 80),
      origin_ar: clip(parsed.origin_ar, 80),
      meaning: clip(parsed.meaning_az, 200),
      meaning_az: clip(parsed.meaning_az, 200),
      meaning_en: clip(parsed.meaning_en, 200),
      meaning_ru: clip(parsed.meaning_ru, 200),
      meaning_tr: clip(parsed.meaning_tr, 200),
      meaning_kk: clip(parsed.meaning_kk, 200),
      meaning_uz: clip(parsed.meaning_uz, 200),
      meaning_ka: clip(parsed.meaning_ka, 200),
      meaning_de: clip(parsed.meaning_de, 200),
      meaning_ar: clip(parsed.meaning_ar, 200),
      ...Object.fromEntries(Object.keys(EXPANDED_LANGUAGE_NAMES).flatMap(language => [[`origin_${language}`, clip(parsed[`origin_${language}`], 80)], [`meaning_${language}`, clip(parsed[`meaning_${language}`], 200)]])),
      popularity: 25,
      is_active: true,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('baby_names_db')
      .insert(row)
      .select()
      .maybeSingle();

    if (insErr) console.error('name insert failed:', insErr.message);

    const f = LANG_FIELD[displayLang];
    return new Response(JSON.stringify({
      success: true,
      found: true,
      fromDb: false,
      item: inserted ?? row,
      display: {
        name,
        gender,
        meaning: (row as any)[f.meaning] || row.meaning_az,
        origin: (row as any)[f.origin] || row.origin,
        popularity: row.popularity,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('name-ai-lookup error:', error);
    return new Response(JSON.stringify({ success: false, error: String((error as Error)?.message ?? error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
