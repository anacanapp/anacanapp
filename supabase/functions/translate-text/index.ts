/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { requireUser } from "../_shared/auth.ts";
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { LANGUAGE_NAMES } from '../_shared/languages.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateRequest {
  text: string;
  targetLanguage?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const { text, targetLanguage } = await req.json() as TranslateRequest;

    if (!text || !text.trim()) {
      throw new Error('Text is required');
    }
    if (targetLanguage && !Object.hasOwn(LANGUAGE_NAMES, targetLanguage)) {
      return new Response(JSON.stringify({ success: false, error: 'unsupported_language' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `You are an expert translator. ${targetLanguage ? `Translate the supplied text into ${LANGUAGE_NAMES[targetLanguage]}.` : 'Translate between Azerbaijani and English.'}
Your goal is to provide a high-quality, natural, and semantically/logically correct translation, NOT a literal, word-for-word translation.

RULES:
1. Auto-detect the source language. ${targetLanguage ? `The REQUIRED target is ${LANGUAGE_NAMES[targetLanguage]}, regardless of the detected source.` : 'Translate Azerbaijani to English, or English to Azerbaijani (polite Siz form).'}
2. Preserve all emojis, line breaks, punctuation, and formatting.
3. Keep the translation tone matching the original (e.g. casual, emotional, serious). Preserve numbers, units, URLs, names and placeholders exactly.
4. STRICTLY do not add any explanation, notes, conversational filler, introductory words, or quotation marks. Return ONLY the translated text.`;

    const response = await callGeminiSmart("gemini-2.5-flash-lite", {
      contents: [{
        role: 'user',
        parts: [{ text }]
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return new Response(
      JSON.stringify({ 
        success: true,
        translatedText
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in translate-text:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
