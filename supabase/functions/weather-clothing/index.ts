/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';
import { serverCopy } from '../_shared/localized-copy.ts';
import { checkModerationAccess } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UserContext {
  babyAgeMonths?: number;
  babyAgeDays?: number;
  pregnancyWeek?: number;
  lifeStage?: string;
}

interface WeatherRequest {
  lat: number;
  lng: number;
  language?: string;
  userContext?: UserContext;
}

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

    const moderationError = await checkModerationAccess(user.id, 'weather-clothing');
    if (moderationError) return moderationError;
    const { lat, lng, userContext, language = 'az' } = await req.json() as WeatherRequest;

    if (!lat || !lng) {
      throw new Error('Location coordinates required');
    }

    // Fetch weather data from Open-Meteo (FREE, no API key needed)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,wind_gusts_10m,weather_code,uv_index&hourly=temperature_2m&daily=uv_index_max&timezone=auto`;
    
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }
    const weatherData = await weatherResponse.json();

    // Per-language config: geocoding locale, "unknown city" fallback, AI output language
    const LANG_CONF: Record<string, { geo: string; unknown: string; outLang: string }> = {
      az: { geo: 'az', unknown: 'Naməlum', outLang: '' },
      en: { geo: 'en', unknown: 'Unknown', outLang: 'ENGLISH' },
      ru: { geo: 'ru', unknown: 'Неизвестно', outLang: 'RUSSIAN' },
      tr: { geo: 'tr', unknown: 'Bilinmiyor', outLang: 'TURKISH' },
      kk: { geo: 'kk', unknown: 'Белгісіз', outLang: 'KAZAKH' },
      uz: { geo: 'uz', unknown: 'Nomaʼlum', outLang: 'UZBEK (Latin script)' },
      ka: { geo: 'ka', unknown: 'უცნობი', outLang: 'GEORGIAN' },
      de: { geo: 'de', unknown: 'Unbekannt', outLang: 'GERMAN' },
      ar: { geo: 'ar', unknown: 'غير معروف', outLang: 'ARABIC (feminine address to the mother)' },
      zh: { geo: 'zh-CN', unknown: '未知', outLang: EXPANDED_LANGUAGE_NAMES.zh },
      id: { geo: 'id', unknown: 'Tidak diketahui', outLang: EXPANDED_LANGUAGE_NAMES.id },
      fr: { geo: 'fr', unknown: 'Inconnu', outLang: EXPANDED_LANGUAGE_NAMES.fr },
      es: { geo: 'es', unknown: 'Desconocido', outLang: EXPANDED_LANGUAGE_NAMES.es },
      pt: { geo: 'pt-PT', unknown: 'Desconhecido', outLang: EXPANDED_LANGUAGE_NAMES.pt },
      vi: { geo: 'vi', unknown: 'Không xác định', outLang: EXPANDED_LANGUAGE_NAMES.vi },
      hi: { geo: 'hi', unknown: 'अज्ञात', outLang: EXPANDED_LANGUAGE_NAMES.hi },
      ja: { geo: 'ja', unknown: '不明', outLang: EXPANDED_LANGUAGE_NAMES.ja },
      ko: { geo: 'ko', unknown: '알 수 없음', outLang: EXPANDED_LANGUAGE_NAMES.ko },
      pl: { geo: 'pl', unknown: 'Nieznane', outLang: EXPANDED_LANGUAGE_NAMES.pl },
      nl: { geo: 'nl', unknown: 'Onbekend', outLang: EXPANDED_LANGUAGE_NAMES.nl },
      sv: { geo: 'sv', unknown: 'Okänd', outLang: EXPANDED_LANGUAGE_NAMES.sv },
    };
    const langConf = LANG_CONF[language] ?? LANG_CONF.az;

    // Get city name from reverse geocoding
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${langConf.geo}`;
    let cityName = langConf.unknown;
    try {
      const geoResponse = await fetch(geoUrl, {
        headers: { 'User-Agent': 'AnacanApp/1.0' }
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        cityName = geoData.address?.city || geoData.address?.town || geoData.address?.state || langConf.unknown;
      }
    } catch {
      console.log('Geocoding failed, using default');
    }

    // Get air quality data (Open-Meteo Air Quality API - FREE)
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,dust,grass_pollen,birch_pollen,olive_pollen,alder_pollen`;
    let airData = null;
    try {
      const airResponse = await fetch(airUrl);
      if (airResponse.ok) {
        airData = await airResponse.json();
      }
    } catch {
      console.log('Air quality fetch failed');
    }

    const current = weatherData.current;

    // Build context-aware prompt based on user data
    let userContextPrompt = '';
    
    if (userContext?.babyAgeMonths !== undefined) {
      const ageMonths = userContext.babyAgeMonths;
      let ageDescription = '';
      
      if (ageMonths < 1) {
        ageDescription = `YENİDOĞULMUŞ (${userContext.babyAgeDays} günlük) körpə`;
      } else if (ageMonths < 3) {
        ageDescription = `${ageMonths} aylıq YENİDOĞULMUŞ körpə`;
      } else if (ageMonths < 6) {
        ageDescription = `${ageMonths} aylıq KİÇİK körpə`;
      } else if (ageMonths < 12) {
        ageDescription = `${ageMonths} aylıq körpə`;
      } else if (ageMonths < 24) {
        ageDescription = `${ageMonths} aylıq (${Math.floor(ageMonths/12)} yaşında) BALACA UŞAQ`;
      } else {
        ageDescription = `${Math.floor(ageMonths/12)} yaşında UŞAQ`;
      }
      
      // KRİTİK BUG DÜZƏLİŞİ: bu qeydlər əvvəllər YALNIZ yaşa görə idi, hava
      // şəraitindən (temperatur) tamamilə asılı deyildi — nəticədə 10 aylıq
      // körpə üçün YAY istisində belə "papaq və əlcək çox vacibdir" tövsiyəsi
      // veriliridi. İndi bu tövsiyələr temperatura görə ŞƏRTLƏNDİRİLİB.
      const feelsLike = current.apparent_temperature;
      const isHot = feelsLike >= 24;
      const isCold = feelsLike < 15;
      userContextPrompt = `
İSTİFADƏÇİ KONTEKST:
- Körpənin yaşı: ${ageDescription}
- Körpənin dəqiq yaşı: ${ageMonths} ay (${userContext.babyAgeDays} gün)

YAŞ ƏSASINDA XÜSUSİ QEYDLƏR:
${ageMonths < 3 && isCold ? '- Yenidoğulmuşlar temperatur tənzimləməsində zəifdir, soyuq havada 1 qat əlavə geyim lazımdır' : ''}
${ageMonths < 3 && isHot ? '- Yenidoğulmuşlar temperatur tənzimləməsində zəifdir, İSTİ HAVADA overheating (həddindən artıq qızma) riski var — çox nazik, tək qatlı, tərləməyən pambıq geyim seçin' : ''}
${ageMonths < 6 ? '- Günəşdən mütləq qorumaq lazımdır, birbaşa günəş şüası OLMAMALIDIR (kölgə/çətir/nazik günəşlik papaq)' : ''}
${ageMonths < 12 && isCold ? '- Soyuq havada papaq və əlcək çox vacibdir (istilik itkisinin çoxu başdan gedir)' : ''}
${ageMonths < 12 && isHot ? '- İSTİ HAVADA papaq/əlcək/isti geyim LAZIM DEYİL — yüngül, nəfəs alan, tərləməyən pambıq geyim seçin; yalnız günəşdən qorunmaq üçün nazik, geniş kənarlı bir günəşlik papaq kifayətdir' : ''}
${ageMonths >= 12 && ageMonths < 24 ? '- Hərəkətli uşaq üçün rahat geyim seçin' : ''}
`;
    } else if (userContext?.pregnancyWeek) {
      userContextPrompt = `
İSTİFADƏÇİ KONTEKST:
- Hamiləlik həftəsi: ${userContext.pregnancyWeek}. həftə
- Trimester: ${userContext.pregnancyWeek <= 12 ? '1-ci' : userContext.pregnancyWeek <= 27 ? '2-ci' : '3-cü'} trimester

HAMİLƏLİK XÜSUSİ QEYDLƏR:
${userContext.pregnancyWeek >= 28 ? '- 3-cü trimesterdə şişkinlik ola bilər, rahat ayaqqabı tövsiyə edin' : ''}
${userContext.pregnancyWeek >= 20 ? '- Hamilə qadınlar daha tez istiləyir, bunu nəzərə alın' : ''}
- Həmişə rahat, elastik geyim tövsiyə edin
- UV qorunması vacibdir (piqmentasiya riski)
`;
    }

    // Cari tarix/ay/mövsüm — AI-yə əlavə (ehtiyat) kontekst kimi, ki, sadəcə
    // xam temperatur rəqəminə deyil, "yay/qış" anlayışına da əsaslana bilsin.
    const now = new Date();
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const currentMonthName = monthNames[now.getMonth()];

    // Use Gemini to generate personalized advice (with model fallback)
    const promptText = `Sən körpə və ana üçün hava və geyim məsləhətçisisən. Azərbaycan dilində cavab ver.

${userContextPrompt}

CARİ HAVA VƏZİYYƏTİ:
- Tarix: ${currentMonthName} ayı
- Şəhər: ${cityName}
- Temperatur: ${current.temperature_2m}°C
- Hiss olunan: ${current.apparent_temperature}°C
- Rütubət: ${current.relative_humidity_2m}%
- Külək: ${current.wind_speed_10m} km/h
- Külək şırnaqdırı: ${current.wind_gusts_10m} km/h
- Yağış: ${current.precipitation} mm
- UV indeksi: ${current.uv_index}
- Hava kodu: ${current.weather_code}
${airData ? `
- Hava keyfiyyəti (AQI): ${airData.current?.european_aqi || 'N/A'}
- Toz: ${airData.current?.dust || 'N/A'}
- Çəmən poleni: ${airData.current?.grass_pollen || 'N/A'}
- Ağcaqayın poleni: ${airData.current?.birch_pollen || 'N/A'}
` : ''}

TAPŞIRIQ: Bu hava şəraitində${userContext?.babyAgeMonths !== undefined ? ` ${userContext.babyAgeMonths} aylıq (${userContext.babyAgeDays} günlük) körpə` : userContext?.pregnancyWeek ? ` hamiləliyin ${userContext.pregnancyWeek}. həftəsindəki ana` : ' körpə'} üçün:
0. ƏN VACİB QAYDA — TEMPERATUR HƏR ZAMAN ƏSAS MEYARDIR: hiss olunan temperatur ${current.apparent_temperature}°C-dir. Əgər bu, 24°C-dən yuxarıdırsa (İSTİ/YAY hava) — YÜNGÜL, nazik, nəfəs alan, tərləməyən geyim tövsiyə et; papaq/əlcək/isti pencək/şərf KİMİ QIŞ GEYİMLƏRİNİ HEÇ VAXT tövsiyə ETMƏ (yalnız günəş qorunması üçün nazik günəşlik papaq istisnadır). Əgər 15°C-dən aşağıdırsa (SOYUQ/QIŞ hava) — isti, qatlı geyim (papaq, əlcək daxil) tövsiyə et. Aralıqdaykən (15-24°C) mülayim, çox qatlı olmayan geyim tövsiyə et. Aşağıdakı "YAŞ ƏSASINDA XÜSUSİ QEYDLƏR" bölməsi artıq bu temperatur qaydasına uyğun yazılıb — onunla ZİDDİYYƏT təşkil edən əlavə fikir YARATMA.
1. BAYIRDA geyim tövsiyəsi ver - konkret, dəqiq, yaşa VƏ temperatura uyğun
2. EV DAXİLİNDƏ necə geyinməli - ev geyimi tövsiyəsi ver
3. Evin ideal temperaturu neçə dərəcə olmalıdır - yaşa uyğun
4. Əgər pollen yüksəkdirsə, xəbərdarlıq ver
5. UV yüksəkdirsə, qoruma tövsiyəsi ver
6. Külək şiddətli isə, xəbərdarlıq ver
7. Yaş/həftəyə xas xüsusi tövsiyələr əlavə et (temperatur qaydası ilə UYĞUN ŞƏKİLDƏ)

CAVAB FORMATI (STRICT JSON):
{
  "temperature": ${current.temperature_2m},
  "feelsLike": ${current.apparent_temperature},
  "humidity": ${current.relative_humidity_2m},
  "windSpeed": ${current.wind_speed_10m},
  "uvIndex": ${current.uv_index},
  "weatherDescription": "hava təsviri (qısa)",
  "clothingAdvice": "BAYIRDA konkret geyim tövsiyəsi (3-4 cümlə)",
  "clothingItems": ["geyim 1", "geyim 2", "geyim 3", "geyim 4"],
  "indoorClothingAdvice": "Ev daxilində geyim tövsiyəsi (2-3 cümlə)",
  "indoorClothingItems": ["ev geyimi 1", "ev geyimi 2", "ev geyimi 3"],
  "idealRoomTemperature": "optimal otaq temperaturu aralığı (məs: 20-22°C)",
  "roomTemperatureAdvice": "Otaq temperaturu haqqında ətraflı məsləhət (2-3 cümlə)",
  "warnings": ["xəbərdarlıq 1", "xəbərdarlıq 2"],
  "pollenWarning": "pollen xəbərdarlığı və ya null",
  "uvWarning": "UV xəbərdarlığı və ya null",
  "outdoorAdvice": "Bayırda gəzmə tövsiyəsi",
  "safeToGoOut": true,
  "alertLevel": "safe|caution|warning|danger"
}${langConf.outLang ? `\n\nIMPORTANT: Write ALL output text fields (weatherDescription, clothingAdvice, clothingItems, indoorClothingAdvice, indoorClothingItems, roomTemperatureAdvice, warnings, pollenWarning, uvWarning, outdoorAdvice) in ${langConf.outLang}. Keep JSON keys, numeric values and enum values exactly as shown.` : ''}`;

    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    let geminiResponse: Response | null = null;
    for (const model of models) {
      geminiResponse = await callGeminiSmart(model, {
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      });
      if (geminiResponse.ok) {
        console.log(`weather-clothing using model: ${model}`);
        break;
      }
      const errText = await geminiResponse.text();
      console.error(`weather-clothing model ${model} failed: ${geminiResponse.status}`, errText);
    }

    if (!geminiResponse || !geminiResponse.ok) {
      throw new Error('AI analysis failed');
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let advice;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        advice = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
      // Override AI-generated numeric values with actual API data
      advice.temperature = current.temperature_2m;
      advice.feelsLike = current.apparent_temperature;
      advice.humidity = current.relative_humidity_2m;
      advice.windSpeed = current.wind_speed_10m;
      advice.uvIndex = current.uv_index;
    } catch {
      // KRİTİK BUG DÜZƏLİŞİ: bu fallback mətni (AI cavabı JSON kimi parse
      // olunmadıqda işə düşür) əvvəllər HƏMİŞƏ "Papaq, Əlcək" (qış geyimi)
      // göstərirdi — temperaturdan asılı olmadan. İndi hiss olunan
      // temperatura görə isti/soyuq/mülayim variantlar arasında seçilir.
      const fbFeelsLike = current.apparent_temperature;
      const tempBand: 'hot' | 'cold' | 'mild' = fbFeelsLike >= 24 ? 'hot' : fbFeelsLike < 15 ? 'cold' : 'mild';

      const FALLBACK_TEXTS: Record<string, Record<'hot' | 'cold' | 'mild', {
        weatherDescription: string; clothingAdvice: string; clothingItems: string[];
        indoorClothingAdvice: string; indoorClothingItems: string[];
        roomTemperatureAdvice: string; outdoorAdvice: string;
      }>> = {
        az: {
          hot: {
            weatherDescription: 'İsti hava',
            clothingAdvice: 'Körpəni yüngül, nazik, nəfəs alan pambıq geyimlə geyindirin. Papaq/əlcək kimi qış geyimi lazım deyil — yalnız günəşdən qorunmaq üçün nazik günəşlik papaq taxın.',
            clothingItems: ['Yüngül pambıq bodi', 'Nazik şort/etek', 'Günəşlik papaq'],
            indoorClothingAdvice: 'Evdə də yüngül, nazik pambıq geyim kifayətdir.',
            indoorClothingItems: ['Yüngül pambıq bodi', 'Bosonoq/nazik corab'],
            roomTemperatureAdvice: 'Otaq temperaturunu 20-22°C arasında saxlayın, lazım gələrsə kondisioner/ventilyator işlədin.',
            outdoorAdvice: 'Günün ən isti saatlarında (12:00-16:00) bayıra çıxmaqdan çəkinin',
          },
          cold: {
            weatherDescription: 'Soyuq hava',
            clothingAdvice: 'Körpəni qatlı, isti geyimlə geyindirin: pambıq alt qat + isti üst geyim.',
            clothingItems: ['İsti kombinezon', 'Papaq', 'Əlcək'],
            indoorClothingAdvice: 'Evdə rahat pambıq geyim geyindirin.',
            indoorClothingItems: ['Pambıq bodi', 'Corab'],
            roomTemperatureAdvice: 'Otaq temperaturunu 20-22°C arasında saxlayın.',
            outdoorAdvice: 'Bayırda çox uzun qalmayın, əlləri/başı isti saxlayın',
          },
          mild: {
            weatherDescription: 'Mülayim hava',
            clothingAdvice: 'Körpəni mülayim, çox qatlı olmayan geyimlə geyindirin.',
            clothingItems: ['Uzun qollu bodi', 'Yüngül şalvar', 'Nazik jaket'],
            indoorClothingAdvice: 'Evdə rahat pambıq geyim geyindirin.',
            indoorClothingItems: ['Pambıq bodi', 'Corab'],
            roomTemperatureAdvice: 'Otaq temperaturunu 20-22°C arasında saxlayın.',
            outdoorAdvice: 'Hava şəraitini izləyin',
          },
        },
        en: {
          hot: {
            weatherDescription: 'Hot weather',
            clothingAdvice: 'Dress your baby in light, thin, breathable cotton clothes. Winter items like hats/mittens are not needed — only a thin sun hat for sun protection.',
            clothingItems: ['Light cotton bodysuit', 'Thin shorts/skirt', 'Sun hat'],
            indoorClothingAdvice: 'Light, thin cotton clothes are enough indoors too.',
            indoorClothingItems: ['Light cotton bodysuit', 'Barefoot/thin socks'],
            roomTemperatureAdvice: 'Keep the room temperature between 20-22°C, use AC/a fan if needed.',
            outdoorAdvice: 'Avoid going out during the hottest hours (12pm-4pm)',
          },
          cold: {
            weatherDescription: 'Cold weather',
            clothingAdvice: 'Dress your baby in warm, layered clothing: a cotton base layer plus a warm outer layer.',
            clothingItems: ['Warm onesie', 'Hat', 'Mittens'],
            indoorClothingAdvice: 'Dress your baby in comfortable cotton clothes at home.',
            indoorClothingItems: ['Cotton bodysuit', 'Socks'],
            roomTemperatureAdvice: 'Keep the room temperature between 20-22°C.',
            outdoorAdvice: 'Keep outdoor time short, keep hands/head warm',
          },
          mild: {
            weatherDescription: 'Mild weather',
            clothingAdvice: 'Dress your baby in moderate clothing, not too many layers.',
            clothingItems: ['Long-sleeve bodysuit', 'Light pants', 'Thin jacket'],
            indoorClothingAdvice: 'Dress your baby in comfortable cotton clothes at home.',
            indoorClothingItems: ['Cotton bodysuit', 'Socks'],
            roomTemperatureAdvice: 'Keep the room temperature between 20-22°C.',
            outdoorAdvice: 'Monitor the weather conditions',
          },
        },
        ru: {
          hot: {
            weatherDescription: 'Жаркая погода',
            clothingAdvice: 'Оденьте малыша в лёгкую, тонкую, дышащую хлопковую одежду. Шапочка и варежки не нужны — только тонкая панама от солнца.',
            clothingItems: ['Лёгкий хлопковый боди', 'Тонкие шортики', 'Панама от солнца'],
            indoorClothingAdvice: 'Дома тоже достаточно лёгкой хлопковой одежды.',
            indoorClothingItems: ['Лёгкий хлопковый боди', 'Без носков/тонкие носочки'],
            roomTemperatureAdvice: 'Поддерживайте температуру в комнате 20-22°C, используйте кондиционер/вентилятор при необходимости.',
            outdoorAdvice: 'Избегайте прогулок в самые жаркие часы (12:00-16:00)',
          },
          cold: {
            weatherDescription: 'Холодная погода',
            clothingAdvice: 'Одевайте малыша многослойно и тепло: хлопковый низ плюс тёплый верх.',
            clothingItems: ['Тёплый комбинезон', 'Шапочка', 'Варежки'],
            indoorClothingAdvice: 'Дома одевайте малыша в удобную хлопковую одежду.',
            indoorClothingItems: ['Хлопковый боди', 'Носочки'],
            roomTemperatureAdvice: 'Поддерживайте температуру в комнате 20-22°C.',
            outdoorAdvice: 'Не гуляйте долго, держите руки/голову в тепле',
          },
          mild: {
            weatherDescription: 'Умеренная погода',
            clothingAdvice: 'Одевайте малыша умеренно, без лишних слоёв.',
            clothingItems: ['Боди с длинным рукавом', 'Лёгкие штанишки', 'Тонкая курточка'],
            indoorClothingAdvice: 'Дома одевайте малыша в удобную хлопковую одежду.',
            indoorClothingItems: ['Хлопковый боди', 'Носочки'],
            roomTemperatureAdvice: 'Поддерживайте температуру в комнате 20-22°C.',
            outdoorAdvice: 'Следите за погодными условиями',
          },
        },
        tr: {
          hot: {
            weatherDescription: 'Sıcak hava',
            clothingAdvice: 'Bebeğinizi hafif, ince, nefes alan pamuklu kıyafetlerle giydirin. Şapka/eldiven gibi kış giysileri gerekmez — sadece güneşten korunmak için ince bir güneş şapkası yeterlidir.',
            clothingItems: ['Hafif pamuklu body', 'İnce şort', 'Güneş şapkası'],
            indoorClothingAdvice: 'Evde de hafif, ince pamuklu kıyafetler yeterlidir.',
            indoorClothingItems: ['Hafif pamuklu body', 'Çıplak ayak/ince çorap'],
            roomTemperatureAdvice: 'Oda sıcaklığını 20-22°C arasında tutun, gerekirse klima/vantilatör kullanın.',
            outdoorAdvice: 'En sıcak saatlerde (12:00-16:00) dışarı çıkmaktan kaçının',
          },
          cold: {
            weatherDescription: 'Soğuk hava',
            clothingAdvice: 'Bebeğinizi katlı ve sıcak tutan kıyafetlerle giydirin: pamuklu alt katman artı sıcak üst katman.',
            clothingItems: ['Sıcak tulum', 'Şapka', 'Eldiven'],
            indoorClothingAdvice: 'Evde rahat pamuklu giysiler giydirin.',
            indoorClothingItems: ['Pamuklu body', 'Çorap'],
            roomTemperatureAdvice: 'Oda sıcaklığını 20-22°C arasında tutun.',
            outdoorAdvice: 'Dışarıda uzun süre kalmayın, el/baş sıcak tutulmalı',
          },
          mild: {
            weatherDescription: 'Ilıman hava',
            clothingAdvice: 'Bebeğinizi ılımlı, fazla katmanlı olmayan kıyafetlerle giydirin.',
            clothingItems: ['Uzun kollu body', 'Hafif pantolon', 'İnce ceket'],
            indoorClothingAdvice: 'Evde rahat pamuklu giysiler giydirin.',
            indoorClothingItems: ['Pamuklu body', 'Çorap'],
            roomTemperatureAdvice: 'Oda sıcaklığını 20-22°C arasında tutun.',
            outdoorAdvice: 'Hava koşullarını takip edin',
          },
        },
      };
      const fb = serverCopy('weatherFallback', language, FALLBACK_TEXTS[language] ?? FALLBACK_TEXTS.az)[tempBand];
      advice = {
        temperature: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        uvIndex: current.uv_index,
        weatherDescription: fb.weatherDescription,
        clothingAdvice: fb.clothingAdvice,
        clothingItems: fb.clothingItems,
        indoorClothingAdvice: fb.indoorClothingAdvice,
        indoorClothingItems: fb.indoorClothingItems,
        idealRoomTemperature: '20-22°C',
        roomTemperatureAdvice: fb.roomTemperatureAdvice,
        warnings: [],
        pollenWarning: null,
        uvWarning: null,
        outdoorAdvice: fb.outdoorAdvice,
        safeToGoOut: true,
        alertLevel: 'safe'
      };
    }

    // Save to database
    await supabase.from('weather_clothing_logs').insert({
      user_id: user.id,
      location_lat: lat,
      location_lng: lng,
      city_name: cityName,
      weather_data: weatherData.current,
      clothing_advice: advice.clothingAdvice,
      pollen_advice: advice.pollenWarning
    });

    return new Response(JSON.stringify({
      success: true,
      cityName,
      advice,
      userContext
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in weather-clothing:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Weather fetch failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
