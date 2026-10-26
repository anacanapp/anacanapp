/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  lifeStage?: "flow" | "bump" | "mommy" | "partner";
  pregnancyWeek?: number;
  isPartner?: boolean;
  language?: string;
  stream?: boolean;
  isWeightAnalysis?: boolean;
  cyclePhase?: "menstrual" | "follicular" | "ovulation" | "luteal";
  cycleDay?: number;
  /** SON user mesajına qoşulan şəkil (Gemini vision) — base64, data: prefikssiz */
  imageBase64?: string;
  imageMime?: string;
  userProfile?: {
    name?: string;
    dueDate?: string;
    babyName?: string;
    babyBirthDate?: string;
    lastPeriodDate?: string;
    cycleLength?: number;
    partnerName?: string;
    // Əkiz/üçüz və s. — sistem promptuna ötürülür ki, AI "körpəniz" əvəzinə
    // "körpələriniz" kimi düzgün say-uzlaşmalı cavab versin (bax prompts.ts)
    multiplesType?: string;
    babyCount?: number;
  };
}

import { getSystemPrompt } from "./prompts.ts";
import { requireUser } from "../_shared/auth.ts";
import { callVertex, isVertexConfigured } from "../_shared/vertex-ai.ts";
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';
import { serverCopy } from '../_shared/localized-copy.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    // Require authenticated caller — prevents abuse of quota.
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    // Server-side gündəlik limit (əvvəllər YALNIZ klient-tərəfi idi — istənilən
    // istifadəçi JWT-si ilə birbaşa çağırıb limitsiz Gemini sorğusu göndərə bilərdi).
    const usage = await checkAndConsumeServerSide(auth.user.id, 'ai_chat');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const useVertex = isVertexConfigured();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!useVertex && !GEMINI_API_KEY) {
      console.error("Neither Vertex AI nor GEMINI_API_KEY configured");
      throw new Error("AI service not configured");
    }
    console.log(`AI backend: ${useVertex ? "Vertex AI" : "Gemini API"}`);


    const {
      messages,
      lifeStage,
      pregnancyWeek,
      isPartner,
      stream = false,
      userProfile,
      isWeightAnalysis,
      cyclePhase,
      cycleDay,
      language = "az",
      imageBase64,
      imageMime,
    } = (await req.json()) as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Invalid messages format");
    }

    // Require explicit lifeStage so flow/mommy users don't get a "bump" persona by mistake.
    // Fall back to "bump" only when truly unknown, and log a warning so we can spot misuse.
    let resolvedLifeStage = lifeStage;
    if (!resolvedLifeStage) {
      console.warn("dr-anacan-chat: lifeStage missing from request — defaulting to 'bump'. Caller should always send lifeStage.");
      resolvedLifeStage = "bump";
    }

    const LANG_NAME: Record<string, string> = { en: "English", ru: "Russian", tr: "Turkish", kk: "Kazakh (қазақ тілі, Cyrillic script)", uz: "Uzbek (oʻzbek tili, Latin script)", ka: "Georgian (ქართული)", de: "German", ar: "Arabic (Modern Standard, addressing the mother in the FEMININE second person)", ...EXPANDED_LANGUAGE_NAMES };
    const replyLangName = LANG_NAME[language];

    // Native-script reminder — appended to the final user turn. The conversation history
    // (welcome message, earlier answers) is often Azerbaijani, and the model tends to mimic
    // the history language; a short directive in the TARGET language right before generation
    // is the most reliable way to force kk/ar/de/… output.
    const NATIVE_DIRECTIVE: Record<string, string> = {
      en: "(Answer in English only.)",
      ru: "(Отвечай только на русском языке.)",
      tr: "(Yalnızca Türkçe cevap ver.)",
      kk: "(Тек қазақ тілінде жауап бер.)",
      uz: "(Faqat oʻzbek tilida (lotin yozuvida) javob ber.)",
      ka: "(უპასუხე მხოლოდ ქართულად.)",
      de: "(Antworte ausschließlich auf Deutsch.)",
      ar: "(أجيبي باللغة العربية الفصحى فقط.)",
      zh: '(请仅使用简体中文回答。)', id: '(Jawab hanya dalam bahasa Indonesia.)',
      fr: '(Répondez uniquement en français.)', es: '(Responde solo en español.)', pt: '(Responda apenas em português europeu.)',
      vi: '(Chỉ trả lời bằng tiếng Việt.)', hi: '(केवल हिन्दी में, देवनागरी लिपि में उत्तर दें।)',
      ja: '(日本語だけで、自然で丁寧に回答してください。)', ko: '(한국어로만 정중하게 답변해 주세요.)',
      pl: '(Odpowiadaj wyłącznie po polsku.)', nl: '(Antwoord uitsluitend in het Nederlands.)', sv: '(Svara endast på svenska.)',
    };
    const nativeDirective = NATIVE_DIRECTIVE[language] ?? "";

    const langInstruction = replyLangName
      ? `\n\nABSOLUTE LANGUAGE RULE (overrides everything else, including the language of previous messages in this conversation): You MUST write EVERY word of EVERY reply in ${replyLangName}. Never answer in Azerbaijani, English or any other language, even if earlier messages in the conversation history are in another language. Keep the same professional tone, no "honey/sweetie" endearments, no markdown decorators, no medical disclaimer headers.`
      : "";


    // Localized fallback/error messages shown directly to the user
    const ERR_TEXTS: Record<string, { unavailable: string; noAnswer: string }> = {
      az: {
        unavailable: "Bağışlayın, xidmət müvəqqəti əlçatmazdır. Zəhmət olmasa bir az sonra yenidən cəhd edin.",
        noAnswer: "Bağışlayın, cavab ala bilmədim. Yenidən cəhd edin.",
      },
      en: {
        unavailable: "Sorry, the service is temporarily unavailable. Please try again a little later.",
        noAnswer: "Sorry, I couldn't get a response. Please try again.",
      },
      ru: {
        unavailable: "Извините, сервис временно недоступен. Пожалуйста, попробуйте ещё раз чуть позже.",
        noAnswer: "Извините, не удалось получить ответ. Попробуйте ещё раз.",
      },
      tr: {
        unavailable: "Üzgünüz, hizmet geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.",
        noAnswer: "Üzgünüm, yanıt alamadım. Lütfen tekrar deneyin.",
      },
      kk: {
        unavailable: "Кешіріңіз, қызмет уақытша қолжетімсіз. Сәл кейінірек қайталап көріңіз.",
        noAnswer: "Кешіріңіз, жауап ала алмадым. Қайталап көріңіз.",
      },
      uz: {
        unavailable: "Kechirasiz, xizmat vaqtincha mavjud emas. Iltimos, birozdan soʻng qayta urinib koʻring.",
        noAnswer: "Kechirasiz, javob ololmadim. Qayta urinib koʻring.",
      },
      ka: {
        unavailable: "უკაცრავად, სერვისი დროებით მიუწვდომელია. გთხოვთ, სცადოთ ცოტა მოგვიანებით.",
        noAnswer: "უკაცრავად, პასუხის მიღება ვერ მოხერხდა. სცადეთ თავიდან.",
      },
      de: {
        unavailable: "Entschuldige, der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später noch einmal.",
        noAnswer: "Entschuldige, ich konnte keine Antwort erhalten. Bitte versuche es erneut.",
      },
      ar: {
        unavailable: "عذرًا، الخدمة غير متاحة مؤقتًا. يُرجى المحاولة مرة أخرى بعد قليل.",
        noAnswer: "عذرًا، تعذّر الحصول على إجابة. حاولي مرة أخرى.",
      },
    };
    const errTexts = serverCopy('chatErrors', language, ERR_TEXTS[language] ?? ERR_TEXTS.az);

    const systemPrompt = (isWeightAnalysis
      ? `Sən çəki məsləhətçisisən. QAYDALAR: Salamlama yoxdur. "Canım", "əzizim", "balacam" kimi ifadələr İSTİFADƏ ETMƏ. Disclaimer/xəbərdarlıq yoxdur. Birbaşa 1-2 cümlə ilə praktik məsləhət ver. ${replyLangName ? `Reply ONLY in ${replyLangName}.` : "Yalnız Azərbaycan dilində."}`
      : getSystemPrompt(resolvedLifeStage, pregnancyWeek, isPartner, userProfile, cyclePhase, cycleDay, language)) + langInstruction;

    // Convert OpenAI-style messages to Gemini format
    // parts tipi: text VƏ YA inline_data (şəkil) ola bilər
    type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
    const geminiContents: Array<{ role: string; parts: GeminiPart[] }> = messages.map((msg: ChatMessage) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }] as GeminiPart[],
    }));

    // Şəkil (vision): SON user mesajına inline_data part-ı əlavə olunur.
    // Ölçü qoruması: client onsuz da sıxır (max 1280px, jpeg) — yenə də 6MB
    // base64 həddi qoyuruq ki, funksiya yaddaş/limit aşmasın.
    if (imageBase64 && imageBase64.length < 6_000_000) {
      for (let i = geminiContents.length - 1; i >= 0; i--) {
        if (geminiContents[i].role === "user") {
          geminiContents[i].parts.push({
            inline_data: {
              mime_type: imageMime || "image/jpeg",
              data: imageBase64,
            },
          });
          break;
        }
      }
    }

    // Reinforce the target language on the final user turn (history is often Azerbaijani)
    if (nativeDirective) {
      for (let i = geminiContents.length - 1; i >= 0; i--) {
        if (geminiContents[i].role === "user") {
          // İlk part həmişə text-dir (yuxarıdakı map belə qurur) — şəkil part-ına toxunma
          const firstPart = geminiContents[i].parts[0] as { text: string };
          firstPart.text = `${firstPart.text}\n\n${nativeDirective}`;
          break;
        }
      }
    }


    const geminiBody = {
      contents: geminiContents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        // KRİTİK: gemini-2.5-* modelləri default olaraq "thinking" (daxili düşünmə) aparır və bu,
        // maxOutputTokens büdcəsindən sərf olunur — bəzi sorğularda (uzun/az-tokenli dillərdə
        // fərqli tokenləşmə səbəbindən, məs. ərəb skripti) düşünmə bütün büdcəni yeyib vizual
        // mətn üçün HEÇ NƏ qalmır → candidates[0].content.parts boş qayıdır (bu, "AI cavab
        // vermir" simptomunun ən mühtəməl kök səbəbidir). Thinking-i deaktiv edirik ki, bütün
        // büdcə birbaşa görünən cavaba getsin.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const endpoint = stream ? "streamGenerateContent" : "generateContent";
    
    let response: Response | null = null;
    let lastError = "";
    
    for (const model of models) {
      try {
        if (useVertex) {
          response = await callVertex({ model, body: geminiBody, stream });
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?${stream ? "alt=sse&" : ""}key=${GEMINI_API_KEY}`;
          response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });
        }
      } catch (err) {
        console.error(`Model ${model} request failed:`, err);
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
      
      if (response.ok) {
        console.log(`Using model: ${model} (${useVertex ? "Vertex" : "Gemini API"})`);
        break;
      }
      
      lastError = await response.text();
      console.error(`Model ${model} failed: ${response.status}`, lastError);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", success: false }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      
      if (response.status >= 500 || response.status === 404) {
        continue; // Try next model on server error or retired model
      }
      
      // For other errors (4xx except 404), don't retry
      break;
    }


    if (!response || !response.ok) {
      return new Response(
        JSON.stringify({ 
          message: errTexts.unavailable, 
          success: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Streaming: transform Gemini SSE to OpenAI-compatible SSE format
    if (stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const transformedStream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                  const geminiData = JSON.parse(jsonStr);
                  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  if (text) {
                    // Convert to OpenAI-compatible delta format
                    const openAIChunk = {
                      choices: [{ delta: { content: text }, index: 0 }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
                  }
                } catch {
                  // Skip unparseable chunks
                }
              }
            }
          } catch (err) {
            console.error("Stream transform error:", err);
            // CRITICAL: always emit [DONE] so the frontend exits its streaming state,
            // otherwise the user sees the "yazılır..." indicator forever.
            try {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {
              // controller might already be closed
            }
            controller.close();
          }
        },
      });

      return new Response(transformedStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    const assistantMessage =
      data.candidates?.[0]?.content?.parts?.[0]?.text || errTexts.noAnswer;
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      // Diaqnostika: boş cavab niyə qayıtdı (safety block, MAX_TOKENS və s.) — dilə görə seçilmiş
      // problemləri (məs. ar) gələcəkdə tez aşkarlamaq üçün.
      console.error("dr-anacan-chat: empty response text", {
        language,
        finishReason: data.candidates?.[0]?.finishReason,
        blockReason: data.promptFeedback?.blockReason,
        safetyRatings: data.candidates?.[0]?.safetyRatings,
      });
    }

    return new Response(
      JSON.stringify({ message: assistantMessage, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in dr-anacan-chat:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
