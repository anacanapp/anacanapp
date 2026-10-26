export interface PaternityRule {
  days: number;
  payDescription_az: string;
  payDescription_en: string;
}

export interface ParentalRule {
  months: number;
  payDescription_az: string;
  payDescription_en: string;
}

export type CompensationType = 'PERCENTAGE_UNCAPPED' | 'PERCENTAGE_CAPPED' | 'FLAT_RATE' | 'COMPLEX' | 'UNPAID';

export interface CompensationRule {
  type: CompensationType;
  currency: string;
  percentage?: number;
  maxCapDaily?: number;
  maxCapTotal?: number;
  minCapDaily?: number;
  flatRateDaily?: number;
  formulaDescription_az: string;
  formulaDescription_en: string;
}

export interface MaternityRule {
  tenureRequirementMonths?: number;
  paternity?: PaternityRule;
  parental?: ParentalRule;
  compensation?: CompensationRule;
  code: string;
  name_az: string;
  name_en: string;
  flag: string;
  normalDaysBefore: number;
  normalDaysAfter: number;
  complicatedDaysAfter: number;
  multipleDaysBefore: number;
  multipleDaysAfter: number;
  payPercentage: number | null; // null if not easily calculable based on simple %
  payDescription_az: string;
  payDescription_en: string;
  guidelines_az: { title: string; content: string; icon: string }[];
  guidelines_en: { title: string; content: string; icon: string }[];
  /** İstəyə bağlı ru/tr — yoxdursa _en fallback işləyir */
  guidelines_ru?: { title: string; content: string; icon: string }[];
  guidelines_tr?: { title: string; content: string; icon: string }[];
}

export const maternityRules: MaternityRule[] = [
  {
    code: 'AZ',
    name_az: 'Azərbaycan',
    name_en: 'Azerbaijan',
    flag: '🇦🇿',
    normalDaysBefore: 70,
    normalDaysAfter: 56,
    complicatedDaysAfter: 70,
    multipleDaysBefore: 84,
    multipleDaysAfter: 110,
    payPercentage: 100,
    payDescription_az: '100% əmək haqqı ödənilir',

    tenureRequirementMonths: 6,
    paternity: {
      days: 14,
      payDescription_az: 'Ödənişsiz',
      payDescription_en: 'Unpaid'
    },
    parental: {
      months: 36,
      payDescription_az: 'Qismən ödənişli (1.5 yaşa qədər sabit məbləğ)',
      payDescription_en: 'Partially paid (fixed amount until 1.5 years)'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "AZN",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% of salary is paid',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Azərbaycan Respublikasının Əmək Məcəlləsinə əsasən, qadınlara hamiləliyə və doğuşa görə 126 təqvim günü (doğuşdan əvvəl 70, doğuşdan sonra 56 gün) ödənişli məzuniyyət verilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'According to the Labor Code of the Republic of Azerbaijan, women are granted 126 calendar days (70 days before birth, 56 days after) of paid maternity leave.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'TR',
    name_az: 'Türkiyə',
    name_en: 'Turkey',
    flag: '🇹🇷',
    normalDaysBefore: 56,
    normalDaysAfter: 56,
    complicatedDaysAfter: 56,
    multipleDaysBefore: 70,
    multipleDaysAfter: 56,
    payPercentage: 66.6,
    payDescription_az: 'Gündəlik qazancın 2/3 hissəsi',

    tenureRequirementMonths: 3,
    paternity: {
      days: 5,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 6,
      payDescription_az: 'Ödənişsiz (istəyə görə 6 aya qədər)',
      payDescription_en: 'Unpaid (optional up to 6 months)'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "TRY",
      "percentage": 66.66,
      "formulaDescription_az": "Gündəlik maaşın 2/3 hissəsi",
      "formulaDescription_en": "2/3 of daily salary"
    },
    payDescription_en: '2/3 of daily earnings',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Türkiyədə qanuni analıq məzuniyyəti ümumilikdə 16 həftədir (doğuşdan əvvəl 8, doğuşdan sonra 8 həftə). Çoxdöllü hamiləlikdə doğuşdan əvvəlki dövrə əlavə 2 həftə əlavə olunur.',
        icon: '⚖️'
      }
    ],
    guidelines_tr: [
      {
        title: 'Mevzuat',
        content: 'Türkiye’de yasal doğum izni toplam 16 haftadır (doğumdan önce 8, sonra 8 hafta). Çoğul gebeliklerde doğum öncesine 2 hafta daha eklenir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Turkey, statutory maternity leave is 16 weeks in total (8 weeks before, 8 weeks after birth). For multiple pregnancies, an extra 2 weeks are added before birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'US',
    name_az: 'ABŞ',
    name_en: 'USA',
    flag: '🇺🇸',
    normalDaysBefore: 14,
    normalDaysAfter: 70,
    complicatedDaysAfter: 70,
    multipleDaysBefore: 14,
    multipleDaysAfter: 70,
    payPercentage: 0,
    payDescription_az: 'FMLA çərçivəsində ödənişsizdir (bəzi ştatlar istisna olmaqla)',

    tenureRequirementMonths: 12,
    paternity: {
      days: 84,
      payDescription_az: 'Ödənişsiz (FMLA çərçivəsində)',
      payDescription_en: 'Unpaid (under FMLA)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "UNPAID",
      "currency": "USD",
      "formulaDescription_az": "Ödənişsiz",
      "formulaDescription_en": "Unpaid"
    },
    payDescription_en: 'Unpaid under FMLA (with some state exceptions)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'ABŞ-da Ailə və Tibbi Məzuniyyət Aktı (FMLA) çərçivəsində 12 həftəyə qədər ödənişsiz məzuniyyət verilir. Bəzi ştatlarda və şirkətlərdə ödənişli məzuniyyət tətbiq olunur.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In the US, the Family and Medical Leave Act (FMLA) provides up to 12 weeks of unpaid leave. Some states and employers offer paid leave programs.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'GB',
    name_az: 'Böyük Britaniya',
    name_en: 'United Kingdom',
    flag: '🇬🇧',
    normalDaysBefore: 77, // Up to 11 weeks before
    normalDaysAfter: 287, // Up to 52 weeks total (39 weeks paid)
    complicatedDaysAfter: 287,
    multipleDaysBefore: 77,
    multipleDaysAfter: 287,
    payPercentage: null,
    payDescription_az: 'İlk 6 həftə 90%, sonrakı 33 həftə sabit SMP məbləği',

    tenureRequirementMonths: 6,
    paternity: {
      days: 14,
      payDescription_az: 'Həftəlik sabit məbləğ və ya 90%',
      payDescription_en: 'Weekly flat rate or 90%'
    },
    parental: {
      months: 12,
      payDescription_az: 'Bölüşdürülə bilən məzuniyyət (Shared Parental Leave)',
      payDescription_en: 'Shared Parental Leave'
    },
    compensation: {
      "type": "COMPLEX",
      "currency": "GBP",
      "formulaDescription_az": "İlk 6 həftə maaşın 90%-i, qalan həftələr sabit 184.03 GBP (həftəlik) və ya 90% (hansı azdırsa)",
      "formulaDescription_en": "First 6 weeks 90% of salary, remaining weeks flat 184.03 GBP (weekly) or 90% (whichever is lower)"
    },
    payDescription_en: '90% for first 6 weeks, then flat SMP rate for 33 weeks',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İngiltərədə qadınlar 52 həftəyə qədər analıq məzuniyyəti götürə bilərlər. Bunun 39 həftəsi Qanuni Analıq Ödənişi (SMP) ilə ödənilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In the UK, mothers can take up to 52 weeks of maternity leave. 39 weeks are paid under Statutory Maternity Pay (SMP).',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'DE',
    name_az: 'Almaniya',
    name_en: 'Germany',
    flag: '🇩🇪',
    normalDaysBefore: 42, // 6 weeks
    normalDaysAfter: 56,  // 8 weeks
    complicatedDaysAfter: 84, // 12 weeks for premature/multiple
    multipleDaysBefore: 42,
    multipleDaysAfter: 84,
    payPercentage: 100,
    payDescription_az: '100% əmək haqqı (Mutterschaftsgeld + işəgötürən əlavəsi)',

    tenureRequirementMonths: 0,
    paternity: {
      days: 0,
      payDescription_az: 'Xüsusi atalıq yoxdur (Valideyn məzuniyyəti istifadə edilir)',
      payDescription_en: 'No specific paternity (Uses Shared Parental Leave)'
    },
    parental: {
      months: 36,
      payDescription_az: 'İlk 14 ay 67% (Elterngeld)',
      payDescription_en: 'First 14 months 67% (Elterngeld)'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "EUR",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% of salary (Mutterschaftsgeld + employer supplement)',
    guidelines_az: [
      {
        title: 'Mutterschutz',
        content: 'Almaniyada qanuni analıq mühafizəsi dövrü doğuşdan 6 həftə əvvəl başlayır və doğuşdan 8 həftə sonra (çoxdöllü hamiləlikdə 12 həftə) bitir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Mutterschutz',
        content: 'In Germany, statutory maternity protection (Mutterschutz) starts 6 weeks before birth and ends 8 weeks after (12 weeks for multiple births).',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'RU',
    name_az: 'Rusiya',
    name_en: 'Russia',
    flag: '🇷🇺',
    normalDaysBefore: 70,
    normalDaysAfter: 70,
    complicatedDaysAfter: 86,
    multipleDaysBefore: 84,
    multipleDaysAfter: 110,
    payPercentage: 100,
    payDescription_az: '100% əmək haqqı (maksimum limitlə)',

    tenureRequirementMonths: 6,
    paternity: {
      days: 5,
      payDescription_az: 'Ödənişsiz (işəgötürənin razılığı ilə)',
      payDescription_en: 'Unpaid (with employer consent)'
    },
    parental: {
      months: 36,
      payDescription_az: '1.5 yaşa qədər 40%',
      payDescription_en: '40% until 1.5 years'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "RUB",
      "percentage": 100,
      "maxCapDaily": 4039.7,
      "minCapDaily": 632.6,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum 4039 RUB limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at 4,039 RUB daily)"
    },
    payDescription_en: '100% of salary (capped at maximum limit)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Rusiyada standart analıq məzuniyyəti 140 gündür (70 gün əvvəl, 70 gün sonra). Mürəkkəb doğuşlarda və çoxdöllü hamiləliklərdə bu müddət artırılır.',
        icon: '⚖️'
      }
    ],
    guidelines_ru: [
      {
        title: 'Законодательство',
        content: 'Стандартный декретный отпуск в России — 140 дней (70 до и 70 после родов). При осложнённых родах и многоплодной беременности срок продлевается.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Standard maternity leave in Russia is 140 days (70 before, 70 after). This is extended for complicated births and multiple pregnancies.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'FR',
    name_az: 'Fransa',
    name_en: 'France',
    flag: '🇫🇷',
    normalDaysBefore: 42, // 6 weeks
    normalDaysAfter: 70, // 10 weeks
    complicatedDaysAfter: 70,
    multipleDaysBefore: 84, // 12 weeks
    multipleDaysAfter: 154, // 22 weeks
    payPercentage: 100,
    payDescription_az: 'Sosial sığorta tərəfindən ödənilən günlük müavinət',

    tenureRequirementMonths: 10,
    paternity: {
      days: 25,
      payDescription_az: 'Ödənişli (Gündəlik limitlə)',
      payDescription_en: 'Paid (with daily cap)'
    },
    parental: {
      months: 36,
      payDescription_az: 'Sabit müavinət',
      payDescription_en: 'Fixed allowance'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "EUR",
      "percentage": 100,
      "maxCapDaily": 100.36,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum 100.36 EUR limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at 100.36 EUR daily)"
    },
    payDescription_en: 'Daily allowance paid by social security',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Fransada 1-ci və 2-ci uşaq üçün 16 həftə (6 həftə əvvəl, 10 həftə sonra) məzuniyyət verilir. 3-cü uşaq və ya əkizlərdə müddət artırılır.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In France, maternity leave is 16 weeks (6 before, 10 after) for the 1st and 2nd child. It increases for a 3rd child or multiple births.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'IT',
    name_az: 'İtaliya',
    name_en: 'Italy',
    flag: '🇮🇹',
    normalDaysBefore: 60, // 2 months
    normalDaysAfter: 90, // 3 months
    complicatedDaysAfter: 90,
    multipleDaysBefore: 60,
    multipleDaysAfter: 90,
    payPercentage: 80,
    payDescription_az: 'INPS tərəfindən 80% ödənilir (bəzi hallarda işəgötürən 100%-ə tamamlayır)',

    tenureRequirementMonths: 0,
    paternity: {
      days: 10,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 10,
      payDescription_az: '30% ödənişli',
      payDescription_en: '30% paid'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "EUR",
      "percentage": 80,
      "formulaDescription_az": "Gündəlik maaşın 80%-i",
      "formulaDescription_en": "80% of daily salary"
    },
    payDescription_en: '80% paid by INPS (often topped up to 100% by employer)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İtaliyada analıq məzuniyyəti 5 aydır. Adətən doğuşdan 2 ay əvvəl başlayır və 3 ay sonra bitir. Seçimdən asılı olaraq 1 ay əvvəl və 4 ay sonra da götürülə bilər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Maternity leave in Italy is 5 months. Usually 2 months before and 3 months after birth, but can be adjusted to 1 month before and 4 after.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'ES',
    name_az: 'İspaniya',
    name_en: 'Spain',
    flag: '🇪🇸',
    normalDaysBefore: 28, // 4 weeks voluntarily before
    normalDaysAfter: 84, // 12 weeks
    complicatedDaysAfter: 84,
    multipleDaysBefore: 28,
    multipleDaysAfter: 98, // +1 week per extra child for each parent
    payPercentage: 100,
    payDescription_az: '100% Sosial Təminat tərəfindən ödənilir',

    tenureRequirementMonths: 6,
    paternity: {
      days: 112,
      payDescription_az: 'Ödənişli (100% - analıq ilə eyni)',
      payDescription_en: 'Paid (100% - same as maternity)'
    },
    parental: {
      months: 36,
      payDescription_az: 'Ödənişsiz',
      payDescription_en: 'Unpaid'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "EUR",
      "percentage": 100,
      "maxCapDaily": 155,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum ~155 EUR limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at ~155 EUR daily)"
    },
    payDescription_en: '100% paid by Social Security',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İspaniyada analar üçün 16 həftə ödənişli məzuniyyət nəzərdə tutulur (doğuşdan sonra ilk 6 həftə məcburidir).',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Spain, mothers get 16 weeks of paid leave (the first 6 weeks after birth are compulsory).',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'CA',
    name_az: 'Kanada',
    name_en: 'Canada',
    flag: '🇨🇦',
    normalDaysBefore: 84, // Can start 12 weeks before
    normalDaysAfter: 105, // Up to 15 weeks maternity
    complicatedDaysAfter: 105,
    multipleDaysBefore: 84,
    multipleDaysAfter: 105,
    payPercentage: 55,
    payDescription_az: 'EI tərəfindən 55% (maksimum limitlə)',

    tenureRequirementMonths: 14,
    paternity: {
      days: 35,
      payDescription_az: 'Maksimum 5 həftə (55% ödənişli)',
      payDescription_en: 'Max 5 weeks (55% paid)'
    },
    parental: {
      months: 18,
      payDescription_az: '35 həftə (55%) və ya 61 həftə (33%)',
      payDescription_en: '35 weeks (55%) or 61 weeks (33%)'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "CAD",
      "percentage": 55,
      "maxCapDaily": 95.42,
      "formulaDescription_az": "Gündəlik maaşın 55%-i (Gündəlik maksimum 95.42 CAD limitlə)",
      "formulaDescription_en": "55% of daily salary (capped at 95.42 CAD daily)"
    },
    payDescription_en: '55% paid by EI (up to a maximum amount)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Kanadada Məşğulluq Sığortası (EI) çərçivəsində 15 həftə analıq məzuniyyəti verilir. Bundan əlavə 35-61 həftəlik valideyn məzuniyyəti də götürülə bilər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Canada, EI provides 15 weeks of maternity leave. Additionally, 35 to 61 weeks of parental leave can be shared between parents.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'AU',
    name_az: 'Avstraliya',
    name_en: 'Australia',
    flag: '🇦🇺',
    normalDaysBefore: 42,
    normalDaysAfter: 140, // 20 weeks total PPL
    complicatedDaysAfter: 140,
    multipleDaysBefore: 42,
    multipleDaysAfter: 140,
    payPercentage: null,
    payDescription_az: 'Milli minimum əmək haqqı səviyyəsində',

    tenureRequirementMonths: 10,
    paternity: {
      days: 14,
      payDescription_az: 'Milli minimum əmək haqqı',
      payDescription_en: 'National Minimum Wage'
    },
    parental: {
      months: 24,
      payDescription_az: 'Ödənişsiz qorunan məzuniyyət',
      payDescription_en: 'Unpaid protected leave'
    },
    compensation: {
      "type": "FLAT_RATE",
      "currency": "AUD",
      "flatRateDaily": 130.84,
      "formulaDescription_az": "Milli minimum əmək haqqı səviyyəsində (Gündəlik ~130.84 AUD)",
      "formulaDescription_en": "National minimum wage rate (~130.84 AUD daily)"
    },
    payDescription_en: 'Paid at the National Minimum Wage',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Avstraliyada hökumət tərəfindən 20 həftəlik (100 gün) Valideyn Məzuniyyəti Ödənişi minimum əmək haqqı səviyyəsində təmin edilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Australia, the government provides 20 weeks (100 days) of Parental Leave Pay at the National Minimum Wage rate.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'AE',
    name_az: 'BƏƏ',
    name_en: 'UAE',
    flag: '🇦🇪',
    normalDaysBefore: 30,
    normalDaysAfter: 30, // 60 days total
    complicatedDaysAfter: 45, // 15 extra days for illness/complications
    multipleDaysBefore: 30,
    multipleDaysAfter: 30,
    payPercentage: null,
    payDescription_az: 'İlk 45 gün 100%, sonrakı 15 gün 50%',

    tenureRequirementMonths: 0,
    paternity: {
      days: 5,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "COMPLEX",
      "currency": "AED",
      "formulaDescription_az": "İlk 45 gün maaşın 100%-i, sonrakı 15 gün 50%-i",
      "formulaDescription_en": "First 45 days 100% of salary, next 15 days 50%"
    },
    payDescription_en: 'First 45 days at 100%, next 15 days at 50%',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'BƏƏ özəl sektorunda analıq məzuniyyəti 60 gündür (45 gün tam maaş, 15 gün yarım maaş).',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In the UAE private sector, maternity leave is 60 days (45 days full pay, 15 days half pay).',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'SA',
    name_az: 'Səudiyyə Ərəbistanı',
    name_en: 'Saudi Arabia',
    flag: '🇸🇦',
    normalDaysBefore: 28, // 4 weeks
    normalDaysAfter: 42, // 6 weeks (Total 10 weeks)
    complicatedDaysAfter: 60, // Month extra unpaid optionally
    multipleDaysBefore: 28,
    multipleDaysAfter: 42,
    payPercentage: 100,
    payDescription_az: '100% işəgötürən tərəfindən (stajdan asılıdır)',

    tenureRequirementMonths: 0,
    paternity: {
      days: 3,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "SAR",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% by employer (depends on tenure)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Səudiyyə Ərəbistanında qadınlar 10 həftə (4 həftə əvvəl, 6 həftə sonra) tam ödənişli məzuniyyət hüququna malikdir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Saudi Arabia, female employees are entitled to 10 weeks (4 before, 6 after) of fully paid maternity leave.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'KZ',
    name_az: 'Qazaxıstan',
    name_en: 'Kazakhstan',
    flag: '🇰🇿',
    normalDaysBefore: 70,
    normalDaysAfter: 56, // Total 126
    complicatedDaysAfter: 70, // Total 140
    multipleDaysBefore: 70,
    multipleDaysAfter: 70,
    payPercentage: 100,
    payDescription_az: 'Dövlət Sosial Sığorta Fondu tərəfindən ödənilir',

    tenureRequirementMonths: 0,
    paternity: {
      days: 5,
      payDescription_az: 'Ödənişsiz',
      payDescription_en: 'Unpaid'
    },
    parental: {
      months: 12,
      payDescription_az: '1.5 yaşa qədər 40%',
      payDescription_en: '40% until 1.5 years'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "KZT",
      "percentage": 100,
      "maxCapDaily": 19561,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum ~19,561 KZT limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at ~19,561 KZT daily)"
    },
    payDescription_en: 'Paid by the State Social Insurance Fund',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Qazaxıstanda normal doğuş üçün 126 gün, mürəkkəb və ya çoxdöllü doğuşlar üçün 140 gün məzuniyyət verilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Kazakhstan, maternity leave is 126 days for normal birth, and 140 days for complicated or multiple births.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'GE',
    name_az: 'Gürcüstan',
    name_en: 'Georgia',
    flag: '🇬🇪',
    normalDaysBefore: 70,
    normalDaysAfter: 56, // 126 days paid
    complicatedDaysAfter: 70, // 140 days
    multipleDaysBefore: 70,
    multipleDaysAfter: 70,
    payPercentage: null,
    payDescription_az: 'Dövlət tərəfindən maksimum 1000 GEL (birdəfəlik)',

    tenureRequirementMonths: 0,
    paternity: {
      days: 0,
      payDescription_az: 'Xüsusi yoxdur',
      payDescription_en: 'None specific'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "GEL",
      "percentage": 100,
      "maxCapTotal": 1000,
      "formulaDescription_az": "Maaşın 100%-i (Lakin ümumi dövlət tərəfindən maksimum 1000 GEL ödənilir)",
      "formulaDescription_en": "100% of salary (capped at a total of 1000 GEL)"
    },
    payDescription_en: 'State pays a maximum of 1000 GEL (one-time)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Gürcüstanda 730 gün məzuniyyət götürülə bilər, lakin bunun yalnız 126 günü (mürəkkəb hallarda 140 gün) dövlət tərəfindən məhdud məbləğlə ödənilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Georgia, up to 730 days of leave is allowed, but only 126 days (140 for complicated) are paid by the state up to a cap.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'UA',
    name_az: 'Ukrayna',
    name_en: 'Ukraine',
    flag: '🇺🇦',
    normalDaysBefore: 70,
    normalDaysAfter: 56,
    complicatedDaysAfter: 70,
    multipleDaysBefore: 70,
    multipleDaysAfter: 70,
    payPercentage: 100,
    payDescription_az: '100% Sosial Sığorta tərəfindən',

    tenureRequirementMonths: 6,
    paternity: {
      days: 14,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 36,
      payDescription_az: 'Ödənişsiz (iş yeri qorunur)',
      payDescription_en: 'Unpaid (job protected)'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "UAH",
      "percentage": 100,
      "maxCapDaily": 3501,
      "minCapDaily": 233,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum 3501 UAH limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at 3501 UAH daily)"
    },
    payDescription_en: '100% by Social Insurance Fund',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Ukraynada qadınlara analıq məzuniyyəti kimi 126 gün (doğuşdan əvvəl 70, sonra 56) verilir. Mürəkkəb hallarda bu müddət 140 günə çatır.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Ukraine, women receive 126 days (70 before, 56 after) of maternity leave. In complicated cases, it increases to 140 days.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'UZ',
    name_az: 'Özbəkistan',
    name_en: 'Uzbekistan',
    flag: '🇺🇿',
    normalDaysBefore: 70,
    normalDaysAfter: 56,
    complicatedDaysAfter: 70,
    multipleDaysBefore: 70,
    multipleDaysAfter: 70,
    payPercentage: 100,
    payDescription_az: '100% dövlət tərəfindən',

    tenureRequirementMonths: 6,
    paternity: {
      days: 0,
      payDescription_az: 'Xüsusi yoxdur',
      payDescription_en: 'None specific'
    },
    parental: {
      months: 36,
      payDescription_az: '2 yaşa qədər qismən ödənişli',
      payDescription_en: 'Partially paid up to 2 years'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "UZS",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% paid by the state',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Özbəkistanda hamiləliyə və doğuşa görə 126 gün (çətin doğuşlarda 140 gün) məzuniyyət tam əmək haqqı ilə ödənilir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Uzbekistan, maternity leave is 126 days (140 days for difficult births) fully paid at the regular salary rate.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'IN',
    name_az: 'Hindistan',
    name_en: 'India',
    flag: '🇮🇳',
    normalDaysBefore: 56, // 8 weeks
    normalDaysAfter: 126, // 18 weeks (Total 26 weeks)
    complicatedDaysAfter: 126,
    multipleDaysBefore: 56,
    multipleDaysAfter: 126,
    payPercentage: 100,
    payDescription_az: '100% işəgötürən tərəfindən',

    tenureRequirementMonths: 3,
    paternity: {
      days: 15,
      payDescription_az: 'Yalnız dövlət işçiləri üçün (100%)',
      payDescription_en: 'For government employees only (100%)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "INR",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% paid by employer',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Hindistan qanunvericiliyinə görə, analar 26 həftə (təxminən 6 ay) ödənişli məzuniyyət əldə edirlər. (İlk 2 uşaq üçün).',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Under the Maternity Benefit Act in India, mothers get 26 weeks of paid leave for their first two children.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'CN',
    name_az: 'Çin',
    name_en: 'China',
    flag: '🇨🇳',
    normalDaysBefore: 15,
    normalDaysAfter: 83, // Total 98 days minimum standard
    complicatedDaysAfter: 98, // +15 days
    multipleDaysBefore: 15,
    multipleDaysAfter: 98, // +15 days per extra child
    payPercentage: 100,
    payDescription_az: '100% Sığorta və ya İşəgötürən tərəfindən',

    tenureRequirementMonths: 0,
    paternity: {
      days: 15,
      payDescription_az: 'Ödənişli (Regionlara görə)',
      payDescription_en: 'Paid (Varies by region)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "CNY",
      "percentage": 100,
      "maxCapDaily": 1000,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Regionlara görə fərqli maksimum limitlərlə)",
      "formulaDescription_en": "100% of daily salary (capped based on regional average wage)"
    },
    payDescription_en: '100% paid by Insurance or Employer',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Çində baza analıq məzuniyyəti 98 gündür (15 gün doğuşdan əvvəl). Bəzi əyalətlər (Pekin, Şanxay) bunu daha da uzadır (əlavə 30-60 gün).',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In China, basic maternity leave is 98 days (15 before birth). Many provinces offer additional leave of 30-60 days.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'JP',
    name_az: 'Yaponiya',
    name_en: 'Japan',
    flag: '🇯🇵',
    normalDaysBefore: 42, // 6 weeks
    normalDaysAfter: 56, // 8 weeks
    complicatedDaysAfter: 56,
    multipleDaysBefore: 98, // 14 weeks before for twins+
    multipleDaysAfter: 56,
    payPercentage: 67,
    payDescription_az: 'Gündəlik qazancın təxminən 67%-i',

    tenureRequirementMonths: 12,
    paternity: {
      days: 28,
      payDescription_az: '67% ödənişli',
      payDescription_en: '67% paid'
    },
    parental: {
      months: 12,
      payDescription_az: '67%-dən 50%-ə qədər ödənişli',
      payDescription_en: '67% to 50% paid'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "JPY",
      "percentage": 67,
      "maxCapDaily": 15190,
      "formulaDescription_az": "Gündəlik maaşın 67%-i (Gündəlik maksimum 15,190 JPY limitlə)",
      "formulaDescription_en": "67% of daily salary (capped at 15,190 JPY daily)"
    },
    payDescription_en: 'Approximately 67% of daily wage',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Yaponiyada qadınlar doğuşdan 6 həftə əvvəl və 8 həftə sonra (ümumilikdə 14 həftə) məzuniyyətə çıxırlar. Doğuşdan sonrakı ilk 6 həftə işləmək qadağandır.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Maternity leave in Japan is 6 weeks before and 8 weeks after birth (14 weeks). Working is strictly prohibited for 6 weeks after birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'KR',
    name_az: 'Cənubi Koreya',
    name_en: 'South Korea',
    flag: '🇰🇷',
    normalDaysBefore: 45,
    normalDaysAfter: 45, // Total 90 days
    complicatedDaysAfter: 45,
    multipleDaysBefore: 60,
    multipleDaysAfter: 60, // Total 120 days
    payPercentage: 100,
    payDescription_az: '100% (şirkət və dövlət arasında bölünür)',

    tenureRequirementMonths: 6,
    paternity: {
      days: 10,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 12,
      payDescription_az: '80% ödənişli (limitlə)',
      payDescription_en: '80% paid (capped)'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "KRW",
      "percentage": 100,
      "maxCapDaily": 70000,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Dövlət tərəfindən aylıq maksimum limitlərlə)",
      "formulaDescription_en": "100% of daily salary (with state monthly caps)"
    },
    payDescription_en: '100% (shared by employer and state)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Cənubi Koreyada 90 günlük ödənişli analıq məzuniyyəti var. Doğuşdan sonra ən azı 45 gün istifadə edilməlidir.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'South Korea provides 90 days of paid maternity leave. At least 45 days must be taken after the birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'BR',
    name_az: 'Braziliya',
    name_en: 'Brazil',
    flag: '🇧🇷',
    normalDaysBefore: 28,
    normalDaysAfter: 92, // Total 120 days
    complicatedDaysAfter: 92,
    multipleDaysBefore: 28,
    multipleDaysAfter: 92,
    payPercentage: 100,
    payDescription_az: '100% INSS tərəfindən',

    tenureRequirementMonths: 0,
    paternity: {
      days: 5,
      payDescription_az: 'Ödənişli (100%)',
      payDescription_en: 'Paid (100%)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "BRL",
      "percentage": 100,
      "maxCapDaily": 259,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Maksimum INSS limiti ilə)",
      "formulaDescription_en": "100% of daily salary (capped at INSS limit)"
    },
    payDescription_en: '100% paid by INSS',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Braziliyada analar tam maaşla 120 gün (4 ay) məzuniyyət əldə edirlər. Bəzi şirkətlər bu müddəti 180 günə (6 ay) qədər artıra bilər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Mothers in Brazil receive 120 days (4 months) of fully paid leave. Some companies extend this to 180 days (6 months).',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'PL',
    name_az: 'Polşa',
    name_en: 'Poland',
    flag: '🇵🇱',
    normalDaysBefore: 42, // 6 weeks voluntarily
    normalDaysAfter: 98, // Total 20 weeks
    complicatedDaysAfter: 98,
    multipleDaysBefore: 42,
    multipleDaysAfter: 175, // Up to 31-37 weeks depending on number of children
    payPercentage: 100,
    payDescription_az: '100% ZUS tərəfindən (və ya 1 il üçün 81,5%)',

    tenureRequirementMonths: 0,
    paternity: {
      days: 14,
      payDescription_az: '100% ödənişli',
      payDescription_en: '100% paid'
    },
    parental: {
      months: 41,
      payDescription_az: '70% ödənişli',
      payDescription_en: '70% paid'
    },
    compensation: {
      "type": "PERCENTAGE_UNCAPPED",
      "currency": "PLN",
      "percentage": 100,
      "formulaDescription_az": "Gündəlik maaşın 100%-i",
      "formulaDescription_en": "100% of daily salary"
    },
    payDescription_en: '100% by ZUS (or 81.5% if spread over a year)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Polşada analıq məzuniyyəti tək uşaq üçün 20 həftədir. Məzuniyyətin 6 həftəsi doğuşdan əvvəl istifadə oluna bilər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Poland, maternity leave is 20 weeks for a single child. Up to 6 weeks can be taken before birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'IL',
    name_az: 'İsrail',
    name_en: 'Israel',
    flag: '🇮🇱',
    normalDaysBefore: 49, // 7 weeks
    normalDaysAfter: 56, // Total 15 weeks (105 days) paid
    complicatedDaysAfter: 56,
    multipleDaysBefore: 49,
    multipleDaysAfter: 77, // Extra 3 weeks per extra child
    payPercentage: 100,
    payDescription_az: '100% Milli Sığorta tərəfindən',

    tenureRequirementMonths: 10,
    paternity: {
      days: 6,
      payDescription_az: 'Məzuniyyət/Xəstəlik günləri hesabına',
      payDescription_en: 'Deducted from sick/vacation days'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "ILS",
      "percentage": 100,
      "maxCapDaily": 1655,
      "formulaDescription_az": "Gündəlik maaşın 100%-i (Gündəlik maksimum 1655 ILS limitlə)",
      "formulaDescription_en": "100% of daily salary (capped at 1655 ILS daily)"
    },
    payDescription_en: '100% by National Insurance',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İsraildə analıq məzuniyyəti 15 həftə ödənişlidir. İşlədiyi müddətdən asılı olaraq analar əlavə ödənişsiz həftələr də ala bilərlər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Israel, maternity leave is 15 weeks paid. Depending on tenure, mothers can take additional unpaid weeks.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'SE',
    name_az: 'İsveç',
    name_en: 'Sweden',
    flag: '🇸🇪',
    normalDaysBefore: 60, // Pregnancy benefit can start 60 days before
    normalDaysAfter: 180, // Very flexible parental leave system
    complicatedDaysAfter: 180,
    multipleDaysBefore: 60,
    multipleDaysAfter: 270,
    payPercentage: 80,
    payDescription_az: 'Gündəlik qazancın 80%-i (tavansız limitsiz deyil)',

    tenureRequirementMonths: 8,
    paternity: {
      days: 10,
      payDescription_az: '80% ödənişli',
      payDescription_en: '80% paid'
    },
    parental: {
      months: 16,
      payDescription_az: '80% ödənişli (480 gün ümumi)',
      payDescription_en: '80% paid (480 days total)'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "SEK",
      "percentage": 80,
      "maxCapDaily": 1218,
      "formulaDescription_az": "Gündəlik maaşın 80%-i (Gündəlik maksimum 1218 SEK limitlə)",
      "formulaDescription_en": "80% of daily salary (capped at 1218 SEK daily)"
    },
    payDescription_en: '80% of daily wage (up to a ceiling)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İsveçdə xüsusi "analıq məzuniyyəti" anlayışından çox, paylaşıla bilən 480 günlük "valideyn məzuniyyəti" (Parental Leave) var. Analar doğuşdan 60 gün əvvəl ödənişli məzuniyyətə başlaya bilərlər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'Sweden has a highly flexible 480-day parental leave system rather than strict maternity leave. Mothers can start taking days 60 days before the expected birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'CH',
    name_az: 'İsveçrə',
    name_en: 'Switzerland',
    flag: '🇨🇭',
    normalDaysBefore: 0, // No statutory paid leave before birth federally, though sickness can be used
    normalDaysAfter: 98, // 14 weeks
    complicatedDaysAfter: 98,
    multipleDaysBefore: 0,
    multipleDaysAfter: 98,
    payPercentage: 80,
    payDescription_az: '80% (maksimum limitlə)',

    tenureRequirementMonths: 5,
    paternity: {
      days: 14,
      payDescription_az: '80% ödənişli',
      payDescription_en: '80% paid'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "CHF",
      "percentage": 80,
      "maxCapDaily": 220,
      "formulaDescription_az": "Gündəlik maaşın 80%-i (Gündəlik maksimum 220 CHF limitlə)",
      "formulaDescription_en": "80% of daily salary (capped at 220 CHF daily)"
    },
    payDescription_en: '80% (up to a maximum limit)',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'İsveçrədə federal qanuna əsasən 14 həftə (98 gün) ödənişli analıq məzuniyyəti doğuşdan sonra başlayır. Doğuşdan sonrakı ilk 8 həftə ərzində işləmək qadağandır.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In Switzerland, federal law provides 14 weeks (98 days) of paid leave starting at birth. Working is prohibited for 8 weeks after birth.',
        icon: '⚖️'
      }
    ]
  },
  {
    code: 'ZA',
    name_az: 'Cənubi Afrika',
    name_en: 'South Africa',
    flag: '🇿🇦',
    normalDaysBefore: 28, // 4 weeks
    normalDaysAfter: 84, // Total 4 consecutive months
    complicatedDaysAfter: 84,
    multipleDaysBefore: 28,
    multipleDaysAfter: 84,
    payPercentage: null,
    payDescription_az: 'UIF vasitəsilə maaşın 38-60%-i',

    tenureRequirementMonths: 3,
    paternity: {
      days: 10,
      payDescription_az: '66% ödənişli (UIF)',
      payDescription_en: '66% paid (UIF)'
    },
    parental: {
      months: 0,
      payDescription_az: 'Yoxdur',
      payDescription_en: 'None'
    },
    compensation: {
      "type": "PERCENTAGE_CAPPED",
      "currency": "ZAR",
      "percentage": 60,
      "maxCapDaily": 590,
      "formulaDescription_az": "Gündəlik maaşın 60%-i (Maksimum UIF limiti ilə)",
      "formulaDescription_en": "60% of daily salary (capped at UIF limit)"
    },
    payDescription_en: '38-60% of salary via UIF',
    guidelines_az: [
      {
        title: 'Qanunvericilik',
        content: 'Cənubi Afrikada qadınlar 4 aylıq ardıcıl analıq məzuniyyətinə çıxa bilərlər. Bu müddət doğuşdan 4 həftə əvvəl başlaya bilər.',
        icon: '⚖️'
      }
    ],
    guidelines_en: [
      {
        title: 'Legislation',
        content: 'In South Africa, women are entitled to 4 consecutive months of maternity leave, which can start up to 4 weeks before the expected date of birth.',
        icon: '⚖️'
      }
    ]
  }
];
