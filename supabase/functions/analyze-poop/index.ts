/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';
import { serverCopy } from '../_shared/localized-copy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoopAnalysisRequest {
  imageBase64: string;
  language?: string;
  userContext?: {
    babyName?: string;
    babyAgeMonths?: number;
    babyAgeDays?: number;
    babyGender?: string;
  };
}

interface ImageValidation {
  isValidDiaperImage: boolean;
  imageType: string;
  confidence: number;
  message: string;
}

// Stage 1: Validate if image contains a diaper/poop
async function validateImage(imageBase64: string, _apiKey?: string, language: string = 'az'): Promise<ImageValidation> {
  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

  // User-visible rejection messages, localized
  const VALIDATION_MESSAGES: Record<string, Record<string, string>> = {
    az: {
      'diaper_empty': 'Bu bez boşdur, nəcis görünmür. Nəcis olan bez şəkli çəkin.',
      'baby_photo': 'Bu körpə şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
      'adult_content': 'Bu şəkil körpə bezi deyil. Zəhmət olmasa düzgün şəkil seçin.',
      'food': 'Bu yemək şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
      'animal': 'Bu heyvan şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
      'screenshot': 'Bu ekran görüntüsüdür. Zəhmət olmasa körpə bezinin real şəklini çəkin.',
      'landscape': 'Bu mənzərə şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
      'object': 'Bu əşya şəklidir. Zəhmət olmasa körpə bezinin şəklini çəkin.',
      'other': 'Bu şəkil analiz üçün uyğun deyil. Körpə bezinin içindəki nəcisin şəklini çəkin.',
      'unknown': 'Şəkil tanınmadı. Zəhmət olmasa daha aydın şəkil çəkin.',
      'valid': 'Şəkil uyğundur',
      'failed': 'Şəkil yoxlanıla bilmədi. Yenidən cəhd edin.',
    },
    en: {
      'success': 'The image was analyzed successfully',
      'diaper_empty': 'This diaper is empty, no stool is visible. Take a photo of a diaper with stool.',
      'baby_photo': 'This is a baby photo. Please take a photo of the diaper.',
      'adult_content': 'This image is not a baby diaper. Please choose a proper image.',
      'food': 'This is a food photo. Please take a photo of the diaper.',
      'animal': 'This is an animal photo. Please take a photo of the diaper.',
      'screenshot': 'This is a screenshot. Please take a real photo of the diaper.',
      'landscape': 'This is a landscape photo. Please take a photo of the diaper.',
      'object': 'This is an object photo. Please take a photo of the diaper.',
      'other': 'This image is not suitable for analysis. Take a photo of the stool inside the diaper.',
      'unknown': 'The image was not recognized. Please take a clearer photo.',
      'valid': 'The image is suitable',
      'failed': 'The image could not be checked. Please try again.',
    },
    ru: {
      'diaper_empty': 'Этот подгузник пуст, стула не видно. Сфотографируйте подгузник со стулом.',
      'baby_photo': 'Это фото малыша. Пожалуйста, сфотографируйте подгузник.',
      'adult_content': 'На этом фото не детский подгузник. Пожалуйста, выберите подходящее фото.',
      'food': 'Это фото еды. Пожалуйста, сфотографируйте подгузник.',
      'animal': 'Это фото животного. Пожалуйста, сфотографируйте подгузник.',
      'screenshot': 'Это скриншот. Пожалуйста, сделайте настоящее фото подгузника.',
      'landscape': 'Это фото пейзажа. Пожалуйста, сфотографируйте подгузник.',
      'object': 'Это фото предмета. Пожалуйста, сфотографируйте подгузник.',
      'other': 'Это фото не подходит для анализа. Сфотографируйте стул внутри подгузника.',
      'unknown': 'Изображение не распознано. Пожалуйста, сделайте более чёткое фото.',
      'valid': 'Изображение подходит',
      'failed': 'Не удалось проверить изображение. Попробуйте ещё раз.',
    },
    tr: {
      'diaper_empty': 'Bu bez boş, dışkı görünmüyor. Dışkılı bezin fotoğrafını çekin.',
      'baby_photo': 'Bu bir bebek fotoğrafı. Lütfen bebek bezinin fotoğrafını çekin.',
      'adult_content': 'Bu görsel bebek bezi değil. Lütfen uygun bir görsel seçin.',
      'food': 'Bu bir yemek fotoğrafı. Lütfen bebek bezinin fotoğrafını çekin.',
      'animal': 'Bu bir hayvan fotoğrafı. Lütfen bebek bezinin fotoğrafını çekin.',
      'screenshot': 'Bu bir ekran görüntüsü. Lütfen bebek bezinin gerçek fotoğrafını çekin.',
      'landscape': 'Bu bir manzara fotoğrafı. Lütfen bebek bezinin fotoğrafını çekin.',
      'object': 'Bu bir eşya fotoğrafı. Lütfen bebek bezinin fotoğrafını çekin.',
      'other': 'Bu görsel analiz için uygun değil. Bezin içindeki dışkının fotoğrafını çekin.',
      'unknown': 'Görsel tanınamadı. Lütfen daha net bir fotoğraf çekin.',
      'valid': 'Görsel uygun',
      'failed': 'Görsel kontrol edilemedi. Lütfen tekrar deneyin.',
    },
    kk: {
      'diaper_empty': 'Бұл жөргек бос, нәжіс көрінбейді. Нәжіс бар жөргекті суретке түсіріңіз.',
      'baby_photo': 'Бұл бөпенің суреті. Бөпенің жөргегін суретке түсіріңіз.',
      'adult_content': 'Бұл суретте бөпенің жөргегі көрсетілмеген. Дұрыс суретті таңдаңыз.',
      'food': 'Бұл тағамның суреті. Бөпенің жөргегін суретке түсіріңіз.',
      'animal': 'Бұл жануардың суреті. Бөпенің жөргегін суретке түсіріңіз.',
      'screenshot': 'Бұл экран скриншоты. Бөпенің жөргегін шынайы суретке түсіріңіз.',
      'landscape': 'Бұл табиғат көрінісінің суреті. Бөпенің жөргегін суретке түсіріңіз.',
      'object': 'Бұл заттың суреті. Бөпенің жөргегін суретке түсіріңіз.',
      'other': 'Бұл сурет талдауға жарамсыз. Бөпенің жөргегіндегі нәжісті суретке түсіріңіз.',
      'unknown': 'Сурет танылмады. Анығырақ сурет түсіріңіз.',
      'valid': 'Сурет жарамды',
      'failed': 'Суретті тексеру мүмкін болмады. Қайталап көріңіз.',
    },
    uz: {
      'diaper_empty': 'Bu taglik boʻsh, najas koʻrinmayapti. Najas bor taglikni suratga oling.',
      'baby_photo': 'Bu chaqaloqning surati. Iltimos, chaqaloq tagligini suratga oling.',
      'adult_content': 'Bu suratda chaqaloq tagligi koʻrsatilmagan. Iltimos, toʻgʻri suratni tanlang.',
      'food': 'Bu ovqat surati. Iltimos, chaqaloq tagligini suratga oling.',
      'animal': 'Bu hayvon surati. Iltimos, chaqaloq tagligini suratga oling.',
      'screenshot': 'Bu skrinshot. Iltimos, chaqaloq tagligining haqiqiy suratini oling.',
      'landscape': 'Bu manzara surati. Iltimos, chaqaloq tagligini suratga oling.',
      'object': 'Bu buyum surati. Iltimos, chaqaloq tagligini suratga oling.',
      'other': 'Bu surat tahlil uchun yaroqsiz. Taglik ichidagi najasni suratga oling.',
      'unknown': 'Surat aniqlanmadi. Iltimos, aniqroq surat oling.',
      'valid': 'Surat yaroqli',
      'failed': 'Suratni tekshirib boʻlmadi. Qayta urinib koʻring.',
    },
    ka: {
      'diaper_empty': 'ეს საფენი ცარიელია, განავალი არ ჩანს. გადაუღეთ ფოტო საფენს, რომელშიც განავალია.',
      'baby_photo': 'ეს ბავშვის ფოტოა. გთხოვთ, გადაუღოთ ფოტო ბავშვის საფენს.',
      'adult_content': 'ამ სურათზე ბავშვის საფენი არ ჩანს. გთხოვთ, აირჩიოთ სწორი სურათი.',
      'food': 'ეს საჭმლის ფოტოა. გთხოვთ, გადაუღოთ ფოტო ბავშვის საფენს.',
      'animal': 'ეს ცხოველის ფოტოა. გთხოვთ, გადაუღოთ ფოტო ბავშვის საფენს.',
      'screenshot': 'ეს ეკრანის ანაბეჭდია. გთხოვთ, გადაუღოთ ბავშვის საფენის ნამდვილი ფოტო.',
      'landscape': 'ეს პეიზაჟის ფოტოა. გთხოვთ, გადაუღოთ ფოტო ბავშვის საფენს.',
      'object': 'ეს ნივთის ფოტოა. გთხოვთ, გადაუღოთ ფოტო ბავშვის საფენს.',
      'other': 'ეს სურათი ანალიზისთვის გამოუსადეგარია. გადაუღეთ ფოტო საფენში არსებულ განავალს.',
      'unknown': 'სურათი ვერ ამოიცნო. გთხოვთ, გადაიღოთ უფრო მკაფიო ფოტო.',
      'valid': 'სურათი ვარგისია',
      'failed': 'სურათის შემოწმება ვერ მოხერხდა. სცადეთ თავიდან.',
    },
    de: {
      'diaper_empty': 'Diese Windel ist leer, es ist kein Stuhl zu sehen. Fotografiere bitte eine Windel mit Stuhl.',
      'baby_photo': 'Dies ist ein Foto eines Babys. Fotografiere bitte die Windel deines Babys.',
      'adult_content': 'Auf diesem Bild ist keine Babywindel zu sehen. Wähle bitte das richtige Bild aus.',
      'food': 'Dies ist ein Foto von Essen. Fotografiere bitte die Windel deines Babys.',
      'animal': 'Dies ist ein Tierfoto. Fotografiere bitte die Windel deines Babys.',
      'screenshot': 'Dies ist ein Screenshot. Nimm bitte ein echtes Foto von der Windel deines Babys auf.',
      'landscape': 'Dies ist ein Landschaftsfoto. Fotografiere bitte die Windel deines Babys.',
      'object': 'Dies ist ein Foto von einem Gegenstand. Fotografiere bitte die Windel deines Babys.',
      'other': 'Dieses Bild ist für die Analyse ungeeignet. Fotografiere bitte den Stuhl in der Windel deines Babys.',
      'unknown': 'Das Bild wurde nicht erkannt. Nimm bitte ein deutlicheres Foto auf.',
      'valid': 'Das Bild ist geeignet',
      'failed': 'Das Bild konnte nicht überprüft werden. Bitte versuche es erneut.',
    },
    ar: {
      'diaper_empty': 'هذا الحفاض فارغ ولا يظهر فيه براز. التقطي صورة لحفاض يحتوي على براز.',
      'baby_photo': 'هذه صورة رضيع. يُرجى التقاط صورة لحفاض رضيعكِ.',
      'adult_content': 'هذه ليست صورة لحفاض رضيع. يُرجى اختيار الصورة الصحيحة.',
      'food': 'هذه صورة طعام. يُرجى التقاط صورة لحفاض رضيعكِ.',
      'animal': 'هذه صورة حيوان. يُرجى التقاط صورة لحفاض رضيعكِ.',
      'screenshot': 'هذه لقطة شاشة. يُرجى التقاط صورة حقيقية لحفاض رضيعكِ.',
      'landscape': 'هذه صورة لمنظر طبيعي. يُرجى التقاط صورة لحفاض رضيعكِ.',
      'object': 'هذه صورة غرض. يُرجى التقاط صورة لحفاض رضيعكِ.',
      'other': 'هذه الصورة غير مناسبة للتحليل. التقطي صورة للبراز داخل حفاض رضيعكِ.',
      'unknown': 'تعذّر التعرّف على الصورة. يُرجى التقاط صورة أوضح.',
      'valid': 'الصورة مناسبة',
      'failed': 'تعذّر التحقق من الصورة. حاولي مرة أخرى.',
    },
  };
  const vmsg = serverCopy('poopValidation', language, VALIDATION_MESSAGES[language] ?? VALIDATION_MESSAGES.az);
  
  for (const model of models) {
    try {
      const response = await callGeminiSmart(model, {
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64
              }
            },
            {
              text: `Bu şəklin NƏ OLDUĞUNU müəyyən et. YALNIZ aşağıdakı kateqoriyalardan birini seç:

ŞƏKİL TİPLƏRİ:
1. "diaper_with_poop" - Körpə bezi İÇİNDƏ nəcis görünür
2. "diaper_empty" - Boş körpə bezi (nəcis yoxdur)
3. "poop_no_diaper" - Nəcis var amma bez yoxdur (tualet, pot və s.)
4. "baby_photo" - Körpə şəkli (bez/nəcis yoxdur)
5. "adult_content" - Yetkin insan şəkli
6. "food" - Yemək şəkli
7. "animal" - Heyvan şəkli
8. "screenshot" - Ekran görüntüsü, mətni olan şəkil
9. "landscape" - Mənzərə, bina, küçə
10. "object" - Əşya, məhsul
11. "other" - Digər

YALNIZ "diaper_with_poop" və ya "poop_no_diaper" olduqda analiz edilə bilər.

CAVAB FORMATI (STRICT JSON, heç bir əlavə mətn yoxdur):
{
  "imageType": "kateqoriya_adı",
  "isValidForAnalysis": true/false,
  "confidence": 0-100,
  "description": "Şəkildə nə görünür (1 cümlə)"
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 5,
          topP: 0.8,
          maxOutputTokens: 256,
        }
      });

      if (response.status === 429) {
        console.log(`Rate limit on ${model} for validation, trying next...`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Validation error on ${model}:`, errText);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const imageType = result.imageType || 'unknown';
        const isValid = result.isValidForAnalysis === true || 
                       imageType === 'diaper_with_poop' || 
                       imageType === 'poop_no_diaper';
        
        return {
          isValidDiaperImage: isValid,
          imageType: imageType,
          confidence: result.confidence || 0,
          message: isValid ? vmsg['valid'] : (vmsg[imageType] || vmsg['other'])
        };
      }
    } catch (e) {
      console.error(`Validation parse error on ${model}:`, e);
      continue;
    }
  }

  return {
    isValidDiaperImage: false,
    imageType: 'unknown',
    confidence: 0,
    message: vmsg['failed']
  };
}

// Stage 2: Analyze the poop
async function analyzePoop(imageBase64: string, _apiKey?: string, userContext?: PoopAnalysisRequest['userContext'], language: string = 'az'): Promise<Response | null> {
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const OUT_LANG: Record<string, string> = { en: 'ENGLISH', ru: 'RUSSIAN', tr: 'TURKISH', kk: 'KAZAKH', uz: 'UZBEK (Latin script)', ka: 'GEORGIAN (ქართული, Mkhedruli script)', de: 'GERMAN', ar: 'ARABIC (feminine address to the mother)', ...EXPANDED_LANGUAGE_NAMES };
  const OUT_LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', tr: 'Turkish', kk: 'Kazakh', uz: 'Uzbek', ka: 'Georgian', de: 'German', ar: 'Arabic', ...EXPANDED_LANGUAGE_NAMES };
  const outLang = OUT_LANG[language];
  
  // Build age context for prompt
  let ageContext = '';
  if (userContext?.babyAgeMonths !== undefined) {
    const months = userContext.babyAgeMonths;
    if (months < 1) {
      ageContext = `Bu ${userContext.babyAgeDays} günlük YENİDOĞULMUŞ körpənin nəcisidir. Yenidoğulmuşlarda ilk günlərdə mekonium (qara-yaşıl) normaldır.`;
    } else if (months < 6) {
      ageContext = `Bu ${months} aylıq körpənin nəcisidir. ${months < 3 ? 'Ana südü ilə qidalanan körpələrdə xardal sarısı nəcis normaldır.' : ''}`;
    } else if (months < 12) {
      ageContext = `Bu ${months} aylıq körpənin nəcisidir. Əlavə qidalara başladıqda nəcisin rəngi və konsistensiyası dəyişə bilər.`;
    } else {
      ageContext = `Bu ${months} aylıq uşağın nəcisidir.`;
    }
    if (userContext.babyName) {
      ageContext = `Körpənin adı ${userContext.babyName}. ` + ageContext;
    }
  }
  
  for (const model of models) {
    console.log(`Trying analysis with model: ${model}`);
    const response = await callGeminiSmart(model, {
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            text: `Sən pediatrik sağlamlıq mütəxəssisisən. Bu körpə bezindəki NƏCİSİ DİQQƏTLƏ analiz et.

${ageContext ? `KÖRPƏ KONTEKST: ${ageContext}` : ''}

ƏN MÜHÜM: Nəcisin RƏNGİNİ, KONSİSTENSİYASINI və GÖRÜNÜŞÜNÜ qiymətləndir.

RƏNG ANALİZİ (TİBBİ ƏHƏMİYYƏT):

✅ NORMAL RƏNGLƏR:
- Qəhvəyi (hər çalar): Normal, sağlam həzm
- Sarı/Xardal: Normal, xüsusilə ana südü ilə qidalanan körpələrdə
- Yaşılımtıl-sarı: Normal, formula ilə qidalanan körpələrdə
- Yaşıl: Adətən normal, dəmir qəbulu və ya yaşıl qidalardan

⚠️ DİQQƏT TƏLƏB EDƏN:
- Qara (mekonium istisna): Həzm qanaması ola bilər - TƏCİLİ
- Qırmızı/Qanlı: Həzm problemləri, anal çat - TƏCİLİ
- Ağ/Solğun/Gil rəngi: Qaraciyər/öd problemi - ÇOX TƏCİLİ
- Çox sulu/köpüklü: İshal, infeksiya riski

KONSİSTENSİYA:
- Normal: Yumşaq, pasta kimi
- Sulu: İshal əlaməti ola bilər
- Bərk: Qəbizlik əlaməti
- Köpüklü: Həzm problemi

CAVAB FORMATI (STRICT JSON):
{
  "colorDetected": "brown|yellow|green|black|red|white|unknown",
  "colorNameAz": "Azərbaycanca rəng adı",
  "consistency": "normal|sulu|bərk|köpüklü",
  "isNormal": true/false,
  "concernLevel": "normal|attention|warning|urgent",
  "explanation": "Azərbaycan dilində ətraflı izahat (2-3 cümlə)",
  "recommendations": ["tövsiyə 1", "tövsiyə 2", "tövsiyə 3"],
  "shouldSeeDoctor": true/false,
  "doctorUrgency": "none|soon|today|immediate"
}

XƏBƏRDARLIQ: Ağ, qara və ya qırmızı rəng gördükdə "urgent" səviyyəsi VER!${outLang ? `\n\nIMPORTANT: Write "colorNameAz", "explanation" and all "recommendations" entries in ${outLang}. Despite the field name "colorNameAz", put the ${OUT_LANG_NAME[language]} color name there. Keep JSON keys and enum values exactly as shown.` : ''}`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 10,
        topP: 0.7,
        maxOutputTokens: 1024,
      }
    });

    if (response.ok) {
      console.log(`Analysis success with model: ${model}`);
      return response;
    }

    if (response.status === 429) {
      console.log(`Rate limit on ${model}, trying next...`);
      continue;
    }

    const errText = await response.text();
    console.error(`Analysis error on ${model}:`, errText);
  }

  return null;
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

    const moderationError = await checkModerationAccess(user.id, 'analyze-poop');
    if (moderationError) return moderationError;
    const usage = await checkAndConsumeServerSide(user.id, 'poop_scanner');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const { imageBase64, userContext, language = 'az' } = await req.json() as PoopAnalysisRequest;

    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    // Stage 1: Validate image
    console.log('Stage 1: Validating image...');
    const validation = await validateImage(imageBase64, undefined, language);
    console.log('Validation result:', validation);

    if (!validation.isValidDiaperImage) {
      // Return validation failure - not a valid diaper/poop image
      return new Response(JSON.stringify({
        success: true,
        isValidImage: false,
        validation: {
          imageType: validation.imageType,
          confidence: validation.confidence,
          message: validation.message
        },
        analysis: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Stage 2: Analyze poop
    console.log('Stage 2: Analyzing poop...');
    const response = await analyzePoop(imageBase64, undefined, userContext, language);

    if (!response) {
      throw new Error('AI analysis failed - all models exhausted');
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    let analysisResult;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      const FALLBACK: Record<string, { colorNameAz: string; explanation: string; recommendations: string[] }> = {
        az: {
          colorNameAz: 'Naməlum',
          explanation: 'Şəkil analiz edildi. Daha aydın şəkil çəkməyə cəhd edin.',
          recommendations: ['Körpənin ümumi vəziyyətini izləyin', 'Hər hansı narahatlıq olsa həkimə müraciət edin'],
        },
        en: {
          colorNameAz: 'Unknown',
          explanation: 'The image was analyzed. Try taking a clearer picture.',
          recommendations: ["Monitor the baby's general condition", 'Consult a doctor if you have any concerns'],
        },
        ru: {
          colorNameAz: 'Неизвестно',
          explanation: 'Изображение проанализировано. Попробуйте сделать более чёткое фото.',
          recommendations: ['Наблюдайте за общим состоянием малыша', 'При любых сомнениях обратитесь к врачу'],
        },
        tr: {
          colorNameAz: 'Bilinmiyor',
          explanation: 'Görsel analiz edildi. Daha net bir fotoğraf çekmeyi deneyin.',
          recommendations: ['Bebeğin genel durumunu takip edin', 'Herhangi bir endişeniz olursa doktora başvurun'],
        },
        kk: {
          colorNameAz: 'Белгісіз',
          explanation: 'Сурет талданды. Анығырақ сурет түсіріп көріңіз.',
          recommendations: ['Бөпенің жалпы жағдайын бақылаңыз', 'Қандай да бір алаңдататын белгі болса, дәрігерге жүгініңіз'],
        },
        uz: {
          colorNameAz: 'Nomaʼlum',
          explanation: 'Surat tahlil qilindi. Aniqroq surat olishga harakat qiling.',
          recommendations: ['Chaqaloqning umumiy holatini kuzatib boring', 'Biror tashvishli holat boʻlsa, shifokorga murojaat qiling'],
        },
        ka: {
          colorNameAz: 'უცნობი',
          explanation: 'სურათი გაანალიზდა. სცადეთ უფრო მკაფიო ფოტოს გადაღება.',
          recommendations: ['დააკვირდით ბავშვის ზოგად მდგომარეობას', 'ნებისმიერი შეშფოთების შემთხვევაში მიმართეთ ექიმს'],
        },
        de: {
          colorNameAz: 'Unbekannt',
          explanation: 'Das Bild wurde analysiert. Versuche bitte, ein deutlicheres Foto aufzunehmen.',
          recommendations: ['Beobachte den Allgemeinzustand deines Babys', 'Wende dich bei Beschwerden oder Bedenken an einen Arzt oder eine Ärztin'],
        },
        ar: {
          colorNameAz: 'غير معروف',
          explanation: 'تم تحليل الصورة. حاولي التقاط صورة أوضح.',
          recommendations: ['راقبي الحالة العامة لرضيعكِ', 'راجعي الطبيب إذا لاحظتِ أي أمر مقلق'],
        },
      };
      const fb = serverCopy('poopFallback', language, FALLBACK[language] ?? FALLBACK.az);
      analysisResult = {
        colorDetected: 'unknown',
        colorNameAz: fb.colorNameAz,
        consistency: 'normal',
        isNormal: true,
        concernLevel: 'normal',
        explanation: fb.explanation,
        recommendations: fb.recommendations,
        shouldSeeDoctor: false,
        doctorUrgency: 'none'
      };
    }

    // Save analysis to database
    const { error: insertError } = await supabase
      .from('poop_analyses')
      .insert({
        user_id: user.id,
        analysis_result: analysisResult,
        color_detected: analysisResult.colorDetected,
        is_normal: analysisResult.isNormal,
        concern_level: analysisResult.concernLevel
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      isValidImage: true,
      validation: {
        imageType: validation.imageType,
        confidence: validation.confidence,
        message: serverCopy<Record<string, string>>('poopValidation', language, { success: 'Şəkil uğurla analiz edildi' }).success
      },
      analysis: analysisResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-poop:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
