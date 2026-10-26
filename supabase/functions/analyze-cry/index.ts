/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { EXPANDED_LANGUAGE_NAMES, isExpandedLanguage } from '../_shared/languages.ts';
import { serverCopy } from '../_shared/localized-copy.ts';

const CRY_FALLBACK_COPY = {
  shortExplanation: 'The recording is too short. At least 3 seconds of audio is needed for an accurate analysis.',
  shortRecommendations: ['Record at least 3 seconds of audio', 'Hold the microphone close to the baby'],
  noCryRecommendations: ['Try again when the baby is crying', 'Move the microphone closer to the baby', 'Minimize background noise'],
  classificationExplanation: 'Baby crying was detected, but the exact type could not be determined.',
  classificationRecommendations: ["Check the baby's overall condition", 'Check the diaper', 'Check if the baby is hungry'],
};
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CryAnalysisRequest {
  audioBase64: string;
  audioDuration: number;
  language?: string;
  userContext?: {
    babyName?: string;
    babyAgeMonths?: number;
    babyAgeDays?: number;
    babyGender?: string;
  };
}

// Two-stage analysis for accurate cry detection
// NOTE: This approach is intentionally conservative to minimize false positives and provide professional pediatric recommendations.
async function detectIfCrying(
  audioBase64: string,
  _apiKey?: string
): Promise<{ isCrying: boolean; confidence: number; soundType: string }> {
  // Using the more capable gemini-2.5-flash model instead of lite for better audio precision and less hallucination
  const response = await callGeminiSmart("gemini-2.5-flash", {
    contents: [{
      role: 'user',
      parts: [
            {
              inlineData: {
                mimeType: 'audio/webm',
                data: audioBase64
              }
            },
            {
              text: `CRITICAL AUDIO CLASSIFICATION TASK

You are an expert pediatric audio analyst AI. You must be extremely strict, objective, and skeptical.
Your task is to classify this audio recording.

IMPORTANT RULE 1: If the audio is mostly SILENT, or just background hiss/static, or general room noise, you MUST return "silence" or "noise".
IMPORTANT RULE 2: If there is no clear human baby (0-12 months) crying, you must NOT classify it as crying.
IMPORTANT RULE 3: Do NOT hallucinate sounds. If you don't hear a baby crying clearly, it is NOT crying.
IMPORTANT RULE 4: Explicitly ignore false positives such as: White noise machines, toys playing music, adult singing (lullabies), pets, and street noise.

STEP 1: Identify the main sound.
- Is it completely silent or just static? -> "silence"
- Is it general background noise (traffic, wind, rustling, fan, white noise machine)? -> "noise"
- Is there an adult speaking, singing, or breathing? -> "adult_voice"
- Is there a baby making happy/neutral sounds? -> "baby_cooing"
- Is there a baby CRYING (sustained, rhythmic wailing)? -> "baby_crying"
- Is it a musical toy or TV? -> "music_tv"

STEP 2: For baby crying, verify it is rhythmic and sustained. A single short shout, cough, or sneeze is NOT crying.

Return ONLY this JSON (no markdown, no extra keys):
{
  "soundType": "baby_crying|baby_cooing|cough|sneeze|adult_voice|scream|music_tv|bang|noise|silence|animal|unknown",
  "isBabyVocalization": true or false,
  "isBabyCrying": true or false,
  "cryPattern": "rhythmic_cry|single_scream|intermittent|none|unknown",
  "confidence": 0-100,
  "reasoning": "What you actually heard in detail. Explain why it is or isn't a baby crying."
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 512,
        }
      });

  if (!response.ok) {
    console.error('Detection API error:', response.status);
    return { isCrying: false, confidence: 0, soundType: 'unknown' };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as {
        soundType?: unknown;
        isBabyVocalization?: unknown;
        isBabyCrying?: unknown;
        cryPattern?: unknown;
        confidence?: unknown;
      };

      const soundType = typeof result.soundType === 'string' ? result.soundType : 'unknown';
      const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
      const isBabyVocalization = result.isBabyVocalization === true;
      const isBabyCrying = result.isBabyCrying === true;
      const cryPattern = typeof result.cryPattern === 'string' ? result.cryPattern : 'unknown';

      // Conservative gate:
      // - must be infant vocalization
      // - must be explicitly baby_crying
      // - must be rhythmic, sustained crying (not a single scream)
      // - must meet a higher confidence threshold
      const isCrying =
        isBabyVocalization &&
        isBabyCrying &&
        soundType === 'baby_crying' &&
        (cryPattern === 'rhythmic_cry' || cryPattern === 'intermittent') &&
        confidence >= 85;

      return { isCrying, confidence, soundType };
    }
  } catch (e) {
    console.error('Detection parse error:', e);
  }
  
  return { isCrying: false, confidence: 0, soundType: 'unknown' };
}

// Classify cry type only if crying is confirmed
async function classifyCryType(audioBase64: string, _apiKey?: string, userContext?: CryAnalysisRequest['userContext'], language: string = 'az'): Promise<any> {
  // Build age context for prompt
  let ageContext = '';
  if (userContext?.babyAgeMonths !== undefined) {
    const months = userContext.babyAgeMonths;
    if (months < 1) {
      ageContext = `Bu ${userContext.babyAgeDays} günlük YENİDOĞULMUŞ körpədir.`;
    } else if (months < 3) {
      ageContext = `Bu ${months} aylıq yenidoğulmuş körpədir (0-3 ay dövrü).`;
    } else if (months < 6) {
      ageContext = `Bu ${months} aylıq kiçik körpədir (3-6 ay dövrü).`;
    } else if (months < 12) {
      ageContext = `Bu ${months} aylıq körpədir (6-12 ay dövrü).`;
    } else {
      ageContext = `Bu ${months} aylıq (${Math.floor(months/12)} yaş) uşaqdır.`;
    }
    if (userContext.babyName) {
      ageContext = `Körpənin adı ${userContext.babyName}. ` + ageContext;
    }
  }

  const OUT_LANG: Record<string, string> = { en: 'ENGLISH', ru: 'RUSSIAN', tr: 'TURKISH', kk: 'KAZAKH', uz: 'UZBEK (Latin script)', ka: 'GEORGIAN (ქართული, Mkhedruli script)', de: 'GERMAN', ar: 'ARABIC (feminine address to the mother)', ...EXPANDED_LANGUAGE_NAMES };
  const outLang = OUT_LANG[language];

  const response = await callGeminiSmart("gemini-2.5-flash", {
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'audio/webm',
            data: audioBase64
          }
        },
        {
          text: `Sən peşəkar pediatr və çox dəqiq AI-sən. Birinci mərhələ bu səsdə körpə ağlaması olduğunu təxmin edib, lakin sən YENİDƏN və ÇOX DİQQƏTLƏ yoxlamalısan.

Əgər səs sadəcə səssizlik, ağ küy (white noise), oyuncaq musiqisi, böyük adam səsi (hətta laylay çalsa belə) və ya heyvan səsidirsə, DƏRHAL "no_cry_detected" və ya "false_positive" qaytar. Xəyalpərəstlik etmə, olmayan səsi uydurma.

${ageContext ? `KÖRPƏ KONTEKST: ${ageContext}` : ''}

${userContext?.babyAgeMonths !== undefined && userContext.babyAgeMonths < 4 ? `
XÜSUSI QEYD: Bu 4 aydan kiçik körpədir. "Dunstan Baby Language" metodundan istifadə edərək səsləri analiz et:
- "Neh" səsi (dil damağa dəyir) -> "hungry" (Acıqma)
- "Owh" səsi (əsnəməyə bənzər) -> "tired" (Yorğunluq, yuxu)
- "Heh" səsi (qısa, qırıq-qırıq) -> "discomfort" (Narahatlıq - bez, isti/soyuq)
- "Eairh" səsi (sıxılmış, gərgin) -> "colic" (Qaz sancısı, alt qaz)
- "Eh" səsi (döş qəfəsindən qısa) -> "discomfort" (Gəyirmə ehtiyacı)
` : `
XÜSUSI QEYD: Bu 4 aydan böyük körpədir. Ağlamanın emosional və fiziki səbəblərinə diqqət yetir (diş çıxarma, ayrılıq qorxusu, həddən artıq stimulyasiya, aclıq).
`}

Ağlama növləri (ƏGƏR HƏQİQƏTƏN AĞLAYIRSA):
- "hungry": Ritmik ağlama, ağız hərəkətləri ilə
- "tired": Monoton, zəif, əsnəməyə bənzər
- "pain": Ani, kəskin, çox yüksək tonlu qışqırıq
- "discomfort": Narahat, qıcıqlanma (bez, gəyirmə)
- "colic": Şiddətli, sıxılmış, qaz sancısına bənzər
- "attention": Aralıqlı, sızlanma
- "overstimulated": Yorğun, həddən artıq stimulyasiya
- "sick": Zəif, iniltili

Əgər ağlama deyilsə:
- "no_cry_detected": Səssizlik və ya sadəcə səs-küy
- "false_positive": Böyük adam, TV, heyvan, ağ küy (white noise)

JSON CAVAB:
{
  "cryType": "hungry|tired|pain|discomfort|colic|attention|overstimulated|sick|no_cry_detected|false_positive",
  "confidence": 70-100,
  "explanation": "Nə eşitdiyin barədə və analiz haqqında valideynə çox professional, empatiyalı və sakitləşdirici tərzdə izahat${userContext?.babyName ? ` (${userContext.babyName} adını istifadə et)` : ''}. Əgər səbəb qazdırsa 'Eairh' səsini eşitdiyini vurğula. DİL: ${outLang || 'Azərbaycan'} (bax aşağıdakı QEYD).",
  "recommendations": ["Ayaqları qarına doğru hərəkət etdirərək qazı çıxarmağa kömək et (Bicycle legs)", "Dəri-dəriyə təmas qur (Skin-to-skin)", "Tövsiyə 3"],
  "urgency": "low|medium|high"
}${outLang ? `\n\nIMPORTANT: Write the "explanation" and all "recommendations" entries in ${outLang} in a highly professional, empathetic, pediatric tone. Keep JSON keys and enum values exactly as shown.` : ''}`
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 10,
      topP: 0.5,
      maxOutputTokens: 1024,
    }
  });

  if (!response.ok) {
    throw new Error('Classification failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('No JSON in classification response');
}

import { checkModerationAccess } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AI handled by callGeminiSmart

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

    const moderationError = await checkModerationAccess(user.id, 'analyze-cry');
    if (moderationError) return moderationError;
    const usage = await checkAndConsumeServerSide(user.id, 'cry_translator');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const { audioBase64, audioDuration, userContext, language = 'az' } = await req.json() as CryAnalysisRequest;

    if (!audioBase64) {
      throw new Error('Audio data is required');
    }

    // Validate minimum duration - 3 seconds minimum
    if (audioDuration < 3) {
      return new Response(JSON.stringify({
        success: true,
        analysis: {
          cryType: 'no_cry_detected',
          confidence: 0,
          explanation: isExpandedLanguage(language) ? serverCopy('cryFallback', language, CRY_FALLBACK_COPY).shortExplanation : language === 'en'
            ? 'The recording is too short. At least 3 seconds of audio is needed for an accurate analysis.'
            : language === 'ru'
            ? 'Запись слишком короткая. Для точного анализа нужно минимум 3 секунды звука.'
            : language === 'tr'
            ? 'Kayıt çok kısa. Doğru bir analiz için en az 3 saniyelik ses gerekiyor.'
            : language === 'kk'
            ? 'Дыбыс тым қысқа. Нақтырақ талдау үшін кемінде 3 секундтық дыбыс қажет.'
            : language === 'uz'
            ? 'Ovoz juda qisqa. Aniqroq tahlil uchun kamida 3 soniyalik ovoz kerak.'
            : language === 'ka'
            ? 'ჩანაწერი ძალიან მოკლეა. ზუსტი ანალიზისთვის მინიმუმ 3 წამიანი ხმაა საჭირო.'
            : language === 'de'
            ? 'Die Aufnahme ist zu kurz. Für eine genauere Analyse werden mindestens 3 Sekunden Audio benötigt.'
            : language === 'ar'
            ? 'التسجيل الصوتي قصير جدًا. يلزم تسجيل مدته ٣ ثوانٍ على الأقل لإجراء تحليل أدق.'
            : 'Səs çox qısadır. Daha dəqiq analiz üçün minimum 3 saniyə səs lazımdır.',
          recommendations: isExpandedLanguage(language) ? serverCopy('cryFallback', language, CRY_FALLBACK_COPY).shortRecommendations : language === 'en'
            ? ['Record at least 3 seconds of audio', 'Hold the microphone close to the baby']
            : language === 'ru'
            ? ['Запишите минимум 3 секунды звука', 'Держите микрофон ближе к малышу']
            : language === 'tr'
            ? ['En az 3 saniye ses kaydedin', 'Mikrofonu bebeğe yakın tutun']
            : language === 'kk'
            ? ['Кемінде 3 секунд дыбыс жазыңыз', 'Бөпенің жылаған дауысын жақыннан жазыңыз']
            : language === 'uz'
            ? ['Kamida 3 soniya ovoz yozing', 'Chaqaloqning yigʻisini yaqindan yozing']
            : language === 'ka'
            ? ['ჩაწერეთ მინიმუმ 3 წამიანი ხმა', 'მიკროფონი ბავშვთან ახლოს დაიჭირეთ']
            : language === 'de'
            ? ['Nimm mindestens 3 Sekunden Audio auf', 'Nimm das Weinen deines Babys aus der Nähe auf']
            : language === 'ar'
            ? ['سجّلي صوتًا لمدة ٣ ثوانٍ على الأقل', 'سجّلي بكاء رضيعكِ من مسافة قريبة']
            : ['Minimum 3 saniyə səs yazın', 'Körpənin ağlamasını yaxından yazın'],
          urgency: 'low',
          isCryDetected: false
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Stage 1: Detecting if audio contains baby crying...');
    
    // STAGE 1: First detect if there's actually crying
    const detection = await detectIfCrying(audioBase64);
    
    console.log('Detection result:', JSON.stringify(detection));

    // If no crying detected, return immediately
    if (!detection.isCrying) {
      const soundTypeMessagesAz: Record<string, string> = {
        'cough': 'Bu səs öskürəkdir, körpə ağlaması deyil.',
        'sneeze': 'Bu səs asqırmadır, körpə ağlaması deyil.',
        'adult_voice': 'Bu səs böyük insana aiddir, körpə ağlaması deyil.',
        'scream': 'Bu səs qışqırıq / böyük səsdir, körpə ağlaması kimi qiymətləndirilmir.',
        'bang': 'Bu zərbə / çırpma kimi səsdir, körpə ağlaması deyil.',
        'music_tv': 'Bu TV/musiqi və ya media səsidir, körpə ağlaması deyil.',
        'animal': 'Bu heyvan səsi ola bilər, körpə ağlaması deyil.',
        'silence': 'Səs faylında əsasən səssizlik var.',
        'noise': 'Bu ətraf mühit səsidir, körpə ağlaması deyil.',
        'baby_cooing': 'Körpə xoşbəxt səslər çıxarır, ağlamır.',
        'unknown': 'Körpə ağlaması aşkar edilmədi.'
      };
      const soundTypeMessagesEn: Record<string, string> = {
        'cough': 'This is a cough, not a baby cry.',
        'sneeze': 'This is a sneeze, not a baby cry.',
        'adult_voice': 'This sounds like an adult voice, not a baby cry.',
        'scream': 'This is a scream or loud sound, not classified as baby crying.',
        'bang': 'This is a bang or impact sound, not a baby cry.',
        'music_tv': 'This is TV/music or media audio, not a baby cry.',
        'animal': 'This may be an animal sound, not a baby cry.',
        'silence': 'The audio is mostly silent.',
        'noise': 'This is environmental noise, not a baby cry.',
        'baby_cooing': 'The baby is making happy sounds, not crying.',
        'unknown': 'No baby crying was detected.'
      };
      const soundTypeMessagesRu: Record<string, string> = {
        'cough': 'Это кашель, а не плач малыша.',
        'sneeze': 'Это чихание, а не плач малыша.',
        'adult_voice': 'Это голос взрослого, а не плач малыша.',
        'scream': 'Это крик или громкий звук, он не распознан как плач малыша.',
        'bang': 'Это звук удара, а не плач малыша.',
        'music_tv': 'Это звук ТВ/музыки или медиа, а не плач малыша.',
        'animal': 'Возможно, это звук животного, а не плач малыша.',
        'silence': 'В записи в основном тишина.',
        'noise': 'Это окружающий шум, а не плач малыша.',
        'baby_cooing': 'Малыш издаёт довольные звуки, он не плачет.',
        'unknown': 'Плач малыша не обнаружен.'
      };
      const soundTypeMessagesTr: Record<string, string> = {
        'cough': 'Bu bir öksürük sesi, bebek ağlaması değil.',
        'sneeze': 'Bu bir hapşırma sesi, bebek ağlaması değil.',
        'adult_voice': 'Bu bir yetişkin sesi, bebek ağlaması değil.',
        'scream': 'Bu bir çığlık veya yüksek ses, bebek ağlaması olarak değerlendirilmedi.',
        'bang': 'Bu bir darbe/çarpma sesi, bebek ağlaması değil.',
        'music_tv': 'Bu TV/müzik veya medya sesi, bebek ağlaması değil.',
        'animal': 'Bu bir hayvan sesi olabilir, bebek ağlaması değil.',
        'silence': 'Ses kaydında çoğunlukla sessizlik var.',
        'noise': 'Bu bir ortam gürültüsü, bebek ağlaması değil.',
        'baby_cooing': 'Bebek mutlu sesler çıkarıyor, ağlamıyor.',
        'unknown': 'Bebek ağlaması tespit edilmedi.'
      };
      const soundTypeMessagesKk: Record<string, string> = {
        'cough': 'Бұл — жөтел дыбысы, бөпенің жылауы емес.',
        'sneeze': 'Бұл — түшкіру дыбысы, бөпенің жылауы емес.',
        'adult_voice': 'Бұл — ересек адамның дауысы, бөпенің жылауы емес.',
        'scream': 'Бұл — айқай немесе қатты дауыс, бөпенің жылауы ретінде бағаланбайды.',
        'bang': 'Бұл — соғу немесе тарсылдау дыбысы, бөпенің жылауы емес.',
        'music_tv': 'Бұл — теледидар, музыка немесе басқа медиа дыбысы, бөпенің жылауы емес.',
        'animal': 'Бұл жануардың дыбысы болуы мүмкін, бөпенің жылауы емес.',
        'silence': 'Дыбыс файлында негізінен тыныштық жазылған.',
        'noise': 'Бұл — қоршаған орта дыбысы, бөпенің жылауы емес.',
        'baby_cooing': 'Бөпе қуанышты дыбыстар шығарып жатыр, жылап жатқан жоқ.',
        'unknown': 'Бөпенің жылауы анықталмады.'
      };
      const soundTypeMessagesUz: Record<string, string> = {
        'cough': 'Bu yoʻtal ovozi, chaqaloq yigʻisi emas.',
        'sneeze': 'Bu aksirish ovozi, chaqaloq yigʻisi emas.',
        'adult_voice': 'Bu katta odamning ovozi, chaqaloq yigʻisi emas.',
        'scream': 'Bu qichqiriq yoki baland ovoz, chaqaloq yigʻisi sifatida baholanmaydi.',
        'bang': 'Bu zarba yoki taqillash ovozi, chaqaloq yigʻisi emas.',
        'music_tv': 'Bu televizor/musiqa yoki media ovozi, chaqaloq yigʻisi emas.',
        'animal': 'Bu hayvon ovozi boʻlishi mumkin, chaqaloq yigʻisi emas.',
        'silence': 'Ovoz faylida asosan jimlik yozilgan.',
        'noise': 'Bu atrof-muhit shovqini, chaqaloq yigʻisi emas.',
        'baby_cooing': 'Chaqaloq xursand tovushlar chiqaryapti, yigʻlamayapti.',
        'unknown': 'Chaqaloq yigʻisi aniqlanmadi.'
      };
      const soundTypeMessagesKa: Record<string, string> = {
        'cough': 'ეს ხველის ხმაა და არა ბავშვის ტირილი.',
        'sneeze': 'ეს დაცემინების ხმაა და არა ბავშვის ტირილი.',
        'adult_voice': 'ეს მოზრდილი ადამიანის ხმაა და არა ბავშვის ტირილი.',
        'scream': 'ეს ყვირილი ან ხმამაღალი ხმაა და ბავშვის ტირილად არ ფასდება.',
        'bang': 'ეს დარტყმის ან ბრახუნის ხმაა და არა ბავშვის ტირილი.',
        'music_tv': 'ეს ტელევიზორის/მუსიკის ან მედიის ხმაა და არა ბავშვის ტირილი.',
        'animal': 'ეს შესაძლოა ცხოველის ხმა იყოს და არა ბავშვის ტირილი.',
        'silence': 'აუდიოფაილში ძირითადად სიჩუმეა.',
        'noise': 'ეს გარემოს ხმაურია და არა ბავშვის ტირილი.',
        'baby_cooing': 'ბავშვი მხიარულ ხმებს გამოსცემს, არ ტირის.',
        'unknown': 'ბავშვის ტირილი ვერ აღმოჩნდა.'
      };
      const soundTypeMessagesDe: Record<string, string> = {
        'cough': 'Dieses Geräusch ist Husten und kein Babyweinen.',
        'sneeze': 'Dieses Geräusch ist Niesen und kein Babyweinen.',
        'adult_voice': 'Diese Stimme gehört zu einer erwachsenen Person und ist kein Babyweinen.',
        'scream': 'Dieses Geräusch ist ein Schrei bzw. ein lautes Geräusch und wird nicht als Babyweinen eingestuft.',
        'bang': 'Dieses Geräusch klingt wie ein Schlag oder Knall und ist kein Babyweinen.',
        'music_tv': 'Dieses Geräusch stammt vom Fernseher, aus Musik oder anderen Medien und ist kein Babyweinen.',
        'animal': 'Dieses Geräusch könnte von einem Tier stammen und ist kein Babyweinen.',
        'silence': 'Die Audiodatei enthält überwiegend Stille.',
        'noise': 'Dies sind Umgebungsgeräusche und kein Babyweinen.',
        'baby_cooing': 'Dein Baby macht zufriedene Laute und weint nicht.',
        'unknown': 'Es wurde kein Babyweinen erkannt.'
      };
      const soundTypeMessagesAr: Record<string, string> = {
        'cough': 'هذا صوت سعال، وليس بكاء رضيع.',
        'sneeze': 'هذا صوت عطاس، وليس بكاء رضيع.',
        'adult_voice': 'هذا صوت شخص بالغ، وليس بكاء رضيع.',
        'scream': 'هذا صوت صراخ أو صوت مرتفع، ولا يُصنَّف على أنه بكاء رضيع.',
        'bang': 'هذا صوت ضربة أو ارتطام، وليس بكاء رضيع.',
        'music_tv': 'هذا صوت تلفاز أو موسيقى أو وسائط، وليس بكاء رضيع.',
        'animal': 'قد يكون هذا صوت حيوان، وليس بكاء رضيع.',
        'silence': 'يحتوي الملف الصوتي على صمت في معظمه.',
        'noise': 'هذه ضوضاء محيطة، وليست بكاء رضيع.',
        'baby_cooing': 'رضيعكِ يصدر أصواتًا سعيدة ولا يبكي.',
        'unknown': 'لم يُكتشف بكاء رضيع.'
      };
      const messages = isExpandedLanguage(language) ? serverCopy('crySounds', language, soundTypeMessagesEn) : language === 'en' ? soundTypeMessagesEn
        : language === 'ru' ? soundTypeMessagesRu
        : language === 'tr' ? soundTypeMessagesTr
        : language === 'kk' ? soundTypeMessagesKk
        : language === 'uz' ? soundTypeMessagesUz
        : language === 'ka' ? soundTypeMessagesKa
        : language === 'de' ? soundTypeMessagesDe
        : language === 'ar' ? soundTypeMessagesAr
        : soundTypeMessagesAz;
      const explanation = messages[detection.soundType] || messages['unknown'];

      return new Response(JSON.stringify({
        success: true,
        analysis: {
          cryType: 'no_cry_detected',
          confidence: detection.confidence,
          explanation: explanation,
          recommendations: isExpandedLanguage(language) ? serverCopy('cryFallback', language, CRY_FALLBACK_COPY).noCryRecommendations : language === 'en'
            ? ['Try again when the baby is crying', 'Move the microphone closer to the baby', 'Minimize background noise']
            : language === 'ru'
            ? ['Попробуйте ещё раз, когда малыш будет плакать', 'Поднесите микрофон ближе к малышу', 'Сведите фоновый шум к минимуму']
            : language === 'tr'
            ? ['Bebek ağlarken tekrar deneyin', 'Mikrofonu bebeğe yaklaştırın', 'Ortam gürültüsünü en aza indirin']
            : language === 'kk'
            ? ['Бөпе жылаған кезде қайталап көріңіз', 'Микрофонды бөпеге жақындатыңыз', 'Айналадағы дыбыстарды барынша азайтыңыз']
            : language === 'uz'
            ? ['Chaqaloq yigʻlaganda qayta urinib koʻring', 'Mikrofonni chaqaloqqa yaqinlashtiring', 'Atrofdagi shovqinni kamaytiring']
            : language === 'ka'
            ? ['სცადეთ თავიდან, როცა ბავშვი ტირის', 'მიკროფონი ბავშვთან უფრო ახლოს დაიჭირეთ', 'მაქსიმალურად შეამცირეთ ფონური ხმაური']
            : language === 'de'
            ? ['Versuche es erneut, wenn dein Baby weint', 'Halte das Mikrofon näher an dein Baby', 'Reduziere die Umgebungsgeräusche auf ein Minimum']
            : language === 'ar'
            ? ['حاولي مرة أخرى عندما يبكي رضيعكِ', 'قرّبي الميكروفون من رضيعكِ', 'قلّلي الأصوات المحيطة إلى أدنى حد']
            : ['Körpə ağladıqda yenidən cəhd edin', 'Mikrofonu körpəyə yaxınlaşdırın', 'Ətraf səsləri minimuma endirin'],
          urgency: 'low',
          isCryDetected: false,
          detectedSound: detection.soundType
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Stage 2: Classifying cry type...');

    // STAGE 2: Crying confirmed, now classify the type
    let analysisResult;
    try {
      analysisResult = await classifyCryType(audioBase64, undefined, userContext, language);
      analysisResult.isCryDetected = true;
    } catch (classifyError) {
      console.error('Classification error:', classifyError);
      analysisResult = {
        cryType: 'discomfort',
        confidence: 70,
        explanation: isExpandedLanguage(language) ? serverCopy('cryFallback', language, CRY_FALLBACK_COPY).classificationExplanation : language === 'en'
          ? 'Baby crying was detected, but the exact type could not be determined.'
          : language === 'ru'
          ? 'Плач малыша обнаружен, но его точный тип определить не удалось.'
          : language === 'tr'
          ? 'Bebek ağlaması tespit edildi ancak tam türü belirlenemedi.'
          : language === 'kk'
          ? 'Бөпенің жылауы анықталды, бірақ оның нақты түрін анықтау мүмкін болмады.'
          : language === 'uz'
          ? 'Chaqaloq yigʻisi aniqlandi, ammo uning aniq turini aniqlab boʻlmadi.'
          : language === 'ka'
          ? 'ბავშვის ტირილი აღმოჩნდა, მაგრამ მისი ზუსტი ტიპის დადგენა ვერ მოხერხდა.'
          : language === 'de'
          ? 'Babyweinen wurde erkannt, die genaue Art konnte jedoch nicht bestimmt werden.'
          : language === 'ar'
          ? 'اكتُشف بكاء رضيع، لكن تعذّر تحديد نوعه بدقة.'
          : 'Körpə ağlaması aşkar edildi, lakin dəqiq növü müəyyən edilə bilmədi.',
        recommendations: isExpandedLanguage(language) ? serverCopy('cryFallback', language, CRY_FALLBACK_COPY).classificationRecommendations : language === 'en'
          ? ["Check the baby's overall condition", 'Check the diaper', 'Check if the baby is hungry']
          : language === 'ru'
          ? ['Проверьте общее состояние малыша', 'Проверьте подгузник', 'Проверьте, не голоден ли малыш']
          : language === 'tr'
          ? ['Bebeğin genel durumunu kontrol edin', 'Bezini kontrol edin', 'Aç olup olmadığını kontrol edin']
          : language === 'kk'
          ? ['Бөпенің жағдайын тексеріңіз', 'Жөргегін тексеріңіз', 'Қарны ашқан-ашпағанын тексеріңіз']
          : language === 'uz'
          ? ['Chaqaloqning umumiy holatini tekshiring', 'Tagligini tekshiring', 'Och yoki toʻqligini tekshiring']
          : language === 'ka'
          ? ['შეამოწმეთ ბავშვის ზოგადი მდგომარეობა', 'შეამოწმეთ საფენი', 'შეამოწმეთ, ხომ არ შია ბავშვს']
          : language === 'de'
          ? ['Überprüfe, wie es deinem Baby geht', 'Überprüfe die Windel', 'Prüfe, ob dein Baby hungrig ist']
          : language === 'ar'
          ? ['تحقّقي من حالة رضيعكِ', 'تحقّقي من حفاضه', 'تحقّقي مما إذا كان جائعًا']
          : ['Körpənin vəziyyətini yoxlayın', 'Bezini yoxlayın', 'Ac olub-olmadığını yoxlayın'],
        urgency: 'medium',
        isCryDetected: true
      };
    }

    // Save to database
    const { error: insertError } = await supabase
      .from('cry_analyses')
      .insert({
        user_id: user.id,
        audio_duration_seconds: audioDuration,
        analysis_result: analysisResult,
        cry_type: analysisResult.cryType,
        confidence_score: analysisResult.confidence
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-cry:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
