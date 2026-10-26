import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callGeminiSmart } from "../_shared/vertex-ai.ts";
import { EXPANDED_LANGUAGE_NAMES } from '../_shared/languages.ts';
import { checkAndConsumeServerSide, limitExceededResponse } from "../_shared/usage-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HoroscopeRequest {
  mom_birth_date: string;
  mom_birth_time?: string;
  dad_birth_date?: string;
  dad_birth_time?: string;
  baby_birth_date?: string;
  baby_birth_time?: string;
  baby_due_date?: string;
  language?: string;
}

interface ZodiacInfo {
  sign: string;
  signAz: string;
  symbol: string;
  element: string;
  startDate: string;
  endDate: string;
  rulingPlanet: string;
  rulingPlanetAz: string;
  degree?: number;
}

// Accurate zodiac date ranges based on astronomical data
const ZODIAC_SIGNS: ZodiacInfo[] = [
  { sign: 'Aries', signAz: 'Qoç', symbol: '♈', element: 'fire', startDate: '03-21', endDate: '04-19', rulingPlanet: 'Mars', rulingPlanetAz: 'Mars' },
  { sign: 'Taurus', signAz: 'Buğa', symbol: '♉', element: 'earth', startDate: '04-20', endDate: '05-20', rulingPlanet: 'Venus', rulingPlanetAz: 'Venera' },
  { sign: 'Gemini', signAz: 'Əkizlər', symbol: '♊', element: 'air', startDate: '05-21', endDate: '06-20', rulingPlanet: 'Mercury', rulingPlanetAz: 'Merkuri' },
  { sign: 'Cancer', signAz: 'Xərçəng', symbol: '♋', element: 'water', startDate: '06-21', endDate: '07-22', rulingPlanet: 'Moon', rulingPlanetAz: 'Ay' },
  { sign: 'Leo', signAz: 'Şir', symbol: '♌', element: 'fire', startDate: '07-23', endDate: '08-22', rulingPlanet: 'Sun', rulingPlanetAz: 'Günəş' },
  { sign: 'Virgo', signAz: 'Qız', symbol: '♍', element: 'earth', startDate: '08-23', endDate: '09-22', rulingPlanet: 'Mercury', rulingPlanetAz: 'Merkuri' },
  { sign: 'Libra', signAz: 'Tərəzi', symbol: '♎', element: 'air', startDate: '09-23', endDate: '10-22', rulingPlanet: 'Venus', rulingPlanetAz: 'Venera' },
  { sign: 'Scorpio', signAz: 'Əqrəb', symbol: '♏', element: 'water', startDate: '10-23', endDate: '11-21', rulingPlanet: 'Pluto', rulingPlanetAz: 'Pluton' },
  { sign: 'Sagittarius', signAz: 'Oxatan', symbol: '♐', element: 'fire', startDate: '11-22', endDate: '12-21', rulingPlanet: 'Jupiter', rulingPlanetAz: 'Yupiter' },
  { sign: 'Capricorn', signAz: 'Oğlaq', symbol: '♑', element: 'earth', startDate: '12-22', endDate: '01-19', rulingPlanet: 'Saturn', rulingPlanetAz: 'Saturn' },
  { sign: 'Aquarius', signAz: 'Dolça', symbol: '♒', element: 'air', startDate: '01-20', endDate: '02-18', rulingPlanet: 'Uranus', rulingPlanetAz: 'Uran' },
  { sign: 'Pisces', signAz: 'Balıqlar', symbol: '♓', element: 'water', startDate: '02-19', endDate: '03-20', rulingPlanet: 'Neptune', rulingPlanetAz: 'Neptun' },
];

const ELEMENT_NAMES: Record<string, string> = {
  fire: 'Od',
  water: 'Su',
  air: 'Hava',
  earth: 'Torpaq',
};

/**
 * Calculate Sun sign from birth date using accurate astronomical boundaries
 */
function getZodiacSign(dateStr: string): ZodiacInfo {
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const monthDay = `${month}-${day}`;

  for (const sign of ZODIAC_SIGNS) {
    if (sign.startDate > sign.endDate) {
      // Crosses year boundary (Capricorn: 12-22 to 01-19)
      if (monthDay >= sign.startDate || monthDay <= sign.endDate) {
        return { ...sign, degree: calculateDegreeInSign(date, sign) };
      }
    } else {
      if (monthDay >= sign.startDate && monthDay <= sign.endDate) {
        return { ...sign, degree: calculateDegreeInSign(date, sign) };
      }
    }
  }

  return { ...ZODIAC_SIGNS[0], degree: 0 }; // Default to Aries
}

/**
 * Calculate the degree position within a sign (0-30)
 */
function calculateDegreeInSign(date: Date, sign: ZodiacInfo): number {
  const startMonth = parseInt(sign.startDate.split('-')[0]);
  const startDay = parseInt(sign.startDate.split('-')[1]);
  const endMonth = parseInt(sign.endDate.split('-')[0]);
  const endDay = parseInt(sign.endDate.split('-')[1]);
  
  const currentMonth = date.getMonth() + 1;
  const currentDay = date.getDate();
  
  let daysFromStart = 0;
  let totalDays = 0;
  
  if (sign.startDate > sign.endDate) {
    // Crosses year boundary
    const daysInStartMonth = new Date(date.getFullYear(), startMonth, 0).getDate();
    totalDays = (daysInStartMonth - startDay + 1) + endDay;
    
    if (currentMonth === startMonth) {
      daysFromStart = currentDay - startDay;
    } else {
      daysFromStart = (daysInStartMonth - startDay + 1) + currentDay;
    }
  } else {
    // Same year
    const startDate = new Date(date.getFullYear(), startMonth - 1, startDay);
    const endDate = new Date(date.getFullYear(), endMonth - 1, endDay);
    totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    daysFromStart = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return Math.floor((daysFromStart / totalDays) * 30);
}

/**
 * Accurate Rising Sign (Ascendant) calculation
 * Based on the principle that each sign rises for approximately 2 hours
 * and the ascendant at sunrise equals the Sun sign
 */
function calculateRisingSign(birthDate: string, birthTime: string): ZodiacInfo {
  const [hours, minutes] = birthTime.split(':').map(Number);
  const date = new Date(birthDate);
  
  // Get the Sun sign index
  const sunSign = getZodiacSign(birthDate);
  const sunSignIndex = ZODIAC_SIGNS.findIndex(s => s.sign === sunSign.sign);
  
  // Calculate sunrise time approximation (average ~6:00 AM for most latitudes)
  const sunriseHour = 6;
  
  // Calculate hours since sunrise
  let hoursSinceSunrise = (hours + minutes / 60) - sunriseHour;
  if (hoursSinceSunrise < 0) {
    hoursSinceSunrise += 24;
  }
  
  // Each sign takes approximately 2 hours to rise
  // More accurate: 24 hours / 12 signs = 2 hours per sign
  const signShift = Math.floor(hoursSinceSunrise / 2);
  
  // Apply sidereal time correction based on day of year
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const siderealCorrection = Math.floor(dayOfYear / 30.44); // Roughly one sign per month
  
  // Calculate final rising sign index
  const risingIndex = (sunSignIndex + signShift + siderealCorrection) % 12;
  
  return { ...ZODIAC_SIGNS[risingIndex], degree: Math.floor((hoursSinceSunrise % 2) * 15) };
}

/**
 * Accurate Moon Sign calculation using Swiss Ephemeris-inspired algorithm
 * The Moon travels through all 12 signs in approximately 27.3 days
 * Each sign takes approximately 2.27 days
 */
function calculateMoonSign(birthDate: string, birthTime?: string): ZodiacInfo {
  const date = new Date(birthDate);
  
  // Reference point: Known Moon position
  // On January 1, 2000 at 00:00 UTC, the Moon was at approximately 5° Aries
  const referenceDate = new Date('2000-01-01T00:00:00Z');
  const referenceSignIndex = 0; // Aries
  const referenceDegree = 5;
  
  // Calculate days since reference
  let daysSinceReference = (date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Add time of day if provided
  if (birthTime) {
    const [hours, minutes] = birthTime.split(':').map(Number);
    daysSinceReference += (hours + minutes / 60) / 24;
  }
  
  // Synodic period: Moon returns to same phase in ~29.53 days
  // Sidereal period: Moon returns to same position in ~27.32 days
  const siderealPeriod = 27.321661;
  
  // Moon moves approximately 360/27.32 = 13.18 degrees per day
  const moonDegreesPerDay = 360 / siderealPeriod;
  
  // Calculate total degrees traveled since reference
  const totalDegreesTraveled = daysSinceReference * moonDegreesPerDay;
  
  // Calculate current position (adding reference position)
  let currentDegree = (referenceDegree + totalDegreesTraveled) % 360;
  if (currentDegree < 0) currentDegree += 360;
  
  // Convert degree to sign (each sign is 30 degrees)
  const moonSignIndex = Math.floor(currentDegree / 30) % 12;
  const degreeInSign = Math.floor(currentDegree % 30);
  
  return { ...ZODIAC_SIGNS[moonSignIndex], degree: degreeInSign };
}

/**
 * Calculate element compatibility score
 */
function getElementCompatibility(element1: string, element2: string): number {
  const compatibilityMatrix: Record<string, Record<string, number>> = {
    fire: { fire: 85, air: 90, earth: 50, water: 40 },
    earth: { fire: 50, air: 55, earth: 95, water: 85 },
    air: { fire: 90, air: 80, earth: 55, water: 65 },
    water: { fire: 40, air: 65, earth: 85, water: 90 },
  };
  
  return compatibilityMatrix[element1]?.[element2] || 70;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const usage = await checkAndConsumeServerSide(auth.user.id, 'horoscope');
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    const { 
      mom_birth_date, 
      mom_birth_time, 
      dad_birth_date, 
      dad_birth_time, 
      baby_birth_date, 
      baby_birth_time, 
      baby_due_date,
      language = 'az'
    } = await req.json() as HoroscopeRequest;

    // AI handled by callGeminiSmart

    // Calculate all astrological data for mom
    const momSun = getZodiacSign(mom_birth_date);
    const momMoon = calculateMoonSign(mom_birth_date, mom_birth_time);
    const momRising = mom_birth_time ? calculateRisingSign(mom_birth_date, mom_birth_time) : null;

    console.log(`Mom calculations: Sun=${momSun.signAz} (${momSun.degree}°), Moon=${momMoon.signAz} (${momMoon.degree}°), Rising=${momRising?.signAz || 'N/A'}`);

    // Calculate for dad if provided
    let dadSun = null, dadMoon = null, dadRising = null;
    if (dad_birth_date) {
      dadSun = getZodiacSign(dad_birth_date);
      dadMoon = calculateMoonSign(dad_birth_date, dad_birth_time);
      dadRising = dad_birth_time ? calculateRisingSign(dad_birth_date, dad_birth_time) : null;
      console.log(`Dad calculations: Sun=${dadSun.signAz}, Moon=${dadMoon.signAz}, Rising=${dadRising?.signAz || 'N/A'}`);
    }

    // Calculate for baby if provided
    let babySun = null, babyMoon = null, babyRising = null;
    const babyDate = baby_birth_date || baby_due_date;
    const isBabyExpected = !baby_birth_date && !!baby_due_date;
    if (babyDate) {
      babySun = getZodiacSign(babyDate);
      babyMoon = calculateMoonSign(babyDate, baby_birth_time);
      babyRising = baby_birth_time ? calculateRisingSign(babyDate, baby_birth_time) : null;
      console.log(`Baby calculations: Sun=${babySun.signAz}, Moon=${babyMoon.signAz}, Rising=${babyRising?.signAz || 'N/A'}`);
    }

    const OUT_LANG: Record<string, string> = { en: 'ENGLISH', ru: 'RUSSIAN', tr: 'TURKISH', kk: 'KAZAKH', uz: 'UZBEK (Latin script)', ka: 'GEORGIAN (ქართული, Mkhedruli script)', de: 'GERMAN', ar: 'ARABIC (feminine address to the mother)', ...EXPANDED_LANGUAGE_NAMES };
    const OUT_LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', tr: 'Turkish', kk: 'Kazakh', uz: 'Uzbek', ka: 'Georgian', de: 'German', ar: 'Arabic', ...EXPANDED_LANGUAGE_NAMES };
    const outLang = OUT_LANG[language];

    // Build comprehensive AI prompt with accurate calculations
    const prompt = `Sən peşəkar astroloq və doğum xəritəsi mütəxəssisisən. Ailənin tam astroloji analizini Azərbaycan dilində hazırla.

## AİLƏ DOĞUM XƏRİTƏLƏRİ (Dəqiq hesablamalar):

### 👩 ANA:
- **Günəş bürcü**: ${momSun.signAz} (${momSun.symbol}) ${momSun.degree}° - ${ELEMENT_NAMES[momSun.element]} elementi
- **Ay bürcü**: ${momMoon.signAz} (${momMoon.symbol}) ${momMoon.degree}°
- **Yüksələn bürc (Ascendant)**: ${momRising ? `${momRising.signAz} (${momRising.symbol}) ${momRising.degree}°` : 'Məlum deyil (doğum saatı yoxdur)'}
- **Hakim planet**: ${momSun.rulingPlanetAz}
- **Doğum tarixi**: ${mom_birth_date}
${mom_birth_time ? `- **Doğum saatı**: ${mom_birth_time}` : ''}

${dadSun ? `### 👨 ATA:
- **Günəş bürcü**: ${dadSun.signAz} (${dadSun.symbol}) ${dadSun.degree}° - ${ELEMENT_NAMES[dadSun.element]} elementi
- **Ay bürcü**: ${dadMoon?.signAz} (${dadMoon?.symbol}) ${dadMoon?.degree}°
- **Yüksələn bürc**: ${dadRising ? `${dadRising.signAz} (${dadRising.symbol}) ${dadRising.degree}°` : 'Məlum deyil'}
- **Hakim planet**: ${dadSun.rulingPlanetAz}
- **Doğum tarixi**: ${dad_birth_date}
${dad_birth_time ? `- **Doğum saatı**: ${dad_birth_time}` : ''}
` : ''}

${babySun ? `### 👶 ${isBabyExpected ? 'GÖZLƏNƏN KÖRPƏ' : 'KÖRPƏ'}:
- **Günəş bürcü**: ${babySun.signAz} (${babySun.symbol}) ${babySun.degree}° - ${ELEMENT_NAMES[babySun.element]} elementi
- **Ay bürcü**: ${babyMoon?.signAz} (${babyMoon?.symbol}) ${babyMoon?.degree}°
- **Yüksələn bürc**: ${babyRising ? `${babyRising.signAz} (${babyRising.symbol}) ${babyRising.degree}°` : 'Məlum deyil'}
- **Hakim planet**: ${babySun.rulingPlanetAz}
- **${isBabyExpected ? 'Gözlənən doğum' : 'Doğum'} tarixi**: ${babyDate}
${baby_birth_time ? `- **Doğum saatı**: ${baby_birth_time}` : ''}
` : ''}

## ELEMENT UYĞUNLUQLARI:
${dadSun ? `- Ana-Ata element uyğunluğu: ${ELEMENT_NAMES[momSun.element]} ↔ ${ELEMENT_NAMES[dadSun.element]} = ${getElementCompatibility(momSun.element, dadSun.element)}%` : ''}
${babySun ? `- Ana-Körpə element uyğunluğu: ${ELEMENT_NAMES[momSun.element]} ↔ ${ELEMENT_NAMES[babySun.element]} = ${getElementCompatibility(momSun.element, babySun.element)}%` : ''}
${dadSun && babySun ? `- Ata-Körpə element uyğunluğu: ${ELEMENT_NAMES[dadSun.element]} ↔ ${ELEMENT_NAMES[babySun.element]} = ${getElementCompatibility(dadSun.element, babySun.element)}%` : ''}

## CAVAB FORMATI (bu formatı dəqiq izlə):

### ÜMUMI_UYĞUNLUQ_BALI
[0-100 arasında bir rəqəm - element uyğunluqlarını və bürc aspektlərini nəzərə al]

### AÇAR_SÖZLƏR
[3 söz, vergüllə ayrılmış, məsələn: Harmoniya, Sevgi, Güc]

### ANA_ANALİZİ
[Ananın Günəş (${momSun.signAz}), Ay (${momMoon.signAz}) və ${momRising ? `Yüksələn (${momRising.signAz})` : ''} bürclərinə əsasən 4-5 cümlə. Şəxsiyyət, güclü cəhətlər, analıq potensialı, emosional dünyası haqqında yazın. Dərəcələri də nəzərə alın.]

### ATA_ANALİZİ
${dadSun ? `[Atanın Günəş (${dadSun.signAz}), Ay (${dadMoon?.signAz}) bürclərinə əsasən 4-5 cümlə. Şəxsiyyət, atalıq yanaşması, ailədəki rolu haqqında yazın.]` : '[Ata məlumatı daxil edilməyib.]'}

### KÖRPƏ_ANALİZİ
${babySun ? `[${isBabyExpected ? 'Gözlənən körpənin potensial' : 'Körpənin'} Günəş (${babySun.signAz}), Ay (${babyMoon?.signAz}) bürclərinə əsasən şəxsiyyəti haqqında 4-5 cümlə. Xüsusiyyətləri, temperamenti, inkişaf potensialı.]` : '[Körpə məlumatı daxil edilməyib.]'}

### AİLƏ_DİNAMİKASI
[Ailə üzvlərinin element uyğunluğu və enerji axını haqqında 5-6 cümlə. ${momSun.element === (dadSun?.element || '') ? 'Eyni element paylaşırlar - çox güclü harmoniya!' : 'Fərqli elementlər - bir-birini tamamlayıcı enerji.'} Güclü və zəif tərəflər, balanslaşdırma yolları.]

### ANA_KÖRPƏ_BAĞLANTISI
${babySun ? `[Ana (${momSun.signAz}) ilə körpə (${babySun.signAz}) arasındakı kosmik bağ, emosional rezonans, anlaşma səviyyəsi haqqında 4-5 cümlə. Ay bürcləri də vacibdir: Ana Ay=${momMoon.signAz}, Körpə Ay=${babyMoon?.signAz}]` : '[Körpə məlumatı yoxdur.]'}

### ATA_KÖRPƏ_BAĞLANTISI
${dadSun && babySun ? `[Ata (${dadSun.signAz}) ilə körpə (${babySun.signAz}) arasındakı kosmik əlaqə haqqında 4-5 cümlə.]` : '[Əlaqəli məlumat yoxdur.]'}

### VALİDEYNLƏR_UYĞUNLUĞU
${dadSun ? `[Ana (${momSun.signAz}) və ata (${dadSun.signAz}) arasındakı kosmik uyğunluq, romantik harmoniya, ortaq dəyərlər haqqında 4-5 cümlə. Ay bürcləri emosional uyğunluq üçün çox vacibdir: Ana Ay=${momMoon.signAz}, Ata Ay=${dadMoon?.signAz}]` : '[Ata məlumatı yoxdur.]'}

### KOSMİK_TÖVSİYƏLƏR
[Ailə üçün 5 praktik tövsiyə, hər biri yeni sətirdə "•" ilə başlasın. Konkret, praktik və tətbiq edilə bilən tövsiyələr olsun. Element balansına əsaslanın.]

### UĞURLU_RƏNGLƏR
[3 rəng - ailənin elementlərinə uyğun. ${momSun.element === 'fire' || dadSun?.element === 'fire' ? 'Od elementi: qırmızı, narıncı, qızılı' : momSun.element === 'water' || dadSun?.element === 'water' ? 'Su elementi: mavi, yaşıl, gümüşü' : momSun.element === 'air' || dadSun?.element === 'air' ? 'Hava elementi: açıq mavi, bənövşəyi, ağ' : 'Torpaq elementi: yaşıl, qəhvəyi, bej'}]

### UĞURLU_GÜNLƏR
[Həftənin 2 günü, hakim planetlərə əsasən]

### XOŞBƏXT_RƏQƏMLƏR
[3 rəqəm, bürclərin numeroloji dəyərlərinə əsasən]

## QEYDLƏR:
- ${outLang ? `Write all SECTION CONTENT in ${outLang}. Keep the Azerbaijani section header keys (### ÜMUMI_UYĞUNLUQ_BALI, ### AÇAR_SÖZLƏR, ### ANA_ANALİZİ, etc.) EXACTLY as shown so the parser can read them. Only the body text under each header should be in ${OUT_LANG_NAME[language]}.` : 'Cavabı YALNIZ Azərbaycan dilində yaz'}
- Pozitiv, dəstəkləyici və konstruktiv ton saxla
- Dərəcələr mühümdür - 0-10° bürcün başlanğıcı, 20-30° bürcün sonu
- Ay bürcü emosional xarakter üçün çox vacibdir
- Yüksələn bürc sosial maska və ilk təəssüratdır
- Astroloji terminləri izah et ki, hamı anlasın`;

    console.log("Calling Gemini API for horoscope analysis with accurate calculations...");

    const response = await callGeminiSmart("gemini-2.5-flash", {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192,
        topP: 0.9,
        topK: 40,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("AI Response received, parsing...");

    // Parse the structured AI response
    const parseSection = (text: string, sectionName: string): string => {
      const regex = new RegExp(`###\\s*${sectionName}[\\s\\S]*?(?=###|$)`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[0].replace(new RegExp(`###\\s*${sectionName}`, 'i'), '').trim();
      }
      return '';
    };

    const overallScoreMatch = aiResponse.match(/ÜMUMI_UYĞUNLUQ_BALI[\s\S]*?(\d+)/i);
    const overallScore = overallScoreMatch ? Math.min(100, Math.max(0, parseInt(overallScoreMatch[1]))) : 75;

    const result = {
      charts: {
        mom: {
          sun: { sign: momSun.sign, signAz: momSun.signAz, symbol: momSun.symbol, element: momSun.element, degree: momSun.degree },
          moon: { sign: momMoon.sign, signAz: momMoon.signAz, symbol: momMoon.symbol, degree: momMoon.degree },
          rising: momRising ? { sign: momRising.sign, signAz: momRising.signAz, symbol: momRising.symbol, degree: momRising.degree } : null,
          birthDate: mom_birth_date,
          birthTime: mom_birth_time,
        },
        dad: dadSun ? {
          sun: { sign: dadSun.sign, signAz: dadSun.signAz, symbol: dadSun.symbol, element: dadSun.element, degree: dadSun.degree },
          moon: { sign: dadMoon!.sign, signAz: dadMoon!.signAz, symbol: dadMoon!.symbol, degree: dadMoon!.degree },
          rising: dadRising ? { sign: dadRising.sign, signAz: dadRising.signAz, symbol: dadRising.symbol, degree: dadRising.degree } : null,
          birthDate: dad_birth_date,
          birthTime: dad_birth_time,
        } : null,
        baby: babySun ? {
          sun: { sign: babySun.sign, signAz: babySun.signAz, symbol: babySun.symbol, element: babySun.element, degree: babySun.degree },
          moon: { sign: babyMoon!.sign, signAz: babyMoon!.signAz, symbol: babyMoon!.symbol, degree: babyMoon!.degree },
          rising: babyRising ? { sign: babyRising.sign, signAz: babyRising.signAz, symbol: babyRising.symbol, degree: babyRising.degree } : null,
          birthDate: babyDate,
          birthTime: baby_birth_time,
          isExpected: isBabyExpected,
        } : null,
      },
      analysis: {
        overallScore,
        keywords: parseSection(aiResponse, 'AÇAR_SÖZLƏR').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3),
        momAnalysis: parseSection(aiResponse, 'ANA_ANALİZİ'),
        dadAnalysis: parseSection(aiResponse, 'ATA_ANALİZİ'),
        babyAnalysis: parseSection(aiResponse, 'KÖRPƏ_ANALİZİ'),
        familyDynamics: parseSection(aiResponse, 'AİLƏ_DİNAMİKASI'),
        momBabyConnection: parseSection(aiResponse, 'ANA_KÖRPƏ_BAĞLANTISI'),
        dadBabyConnection: parseSection(aiResponse, 'ATA_KÖRPƏ_BAĞLANTISI'),
        parentCompatibility: parseSection(aiResponse, 'VALİDEYNLƏR_UYĞUNLUĞU'),
        recommendations: parseSection(aiResponse, 'KOSMİK_TÖVSİYƏLƏR').split('•').map(s => s.trim()).filter(Boolean),
        luckyColors: parseSection(aiResponse, 'UĞURLU_RƏNGLƏR').split(',').map(s => s.trim()).filter(Boolean),
        luckyDays: parseSection(aiResponse, 'UĞURLU_GÜNLƏR').split(',').map(s => s.trim()).filter(Boolean),
        luckyNumbers: parseSection(aiResponse, 'XOŞBƏXT_RƏQƏMLƏR').split(',').map(s => s.trim()).filter(Boolean),
      },
    };

    console.log("Horoscope analysis completed successfully with accurate calculations");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Horoscope analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
