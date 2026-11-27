/**
 * Language layer of the pregnancy week pages (owner request 2026-11-16: Russian next to Azerbaijani).
 *   az  /az/hamilelik/heftelik/        /az/hamilelik/<n>-ci-hefte/   (texts: weeks.ts helpers + az.ts)
 *   ru  /ru/беременность/по-неделям/   /ru/беременность/<n>-неделя/  (texts: this file + ru.ts)
 * Sizes and sources are shared (weeks.ts); every visible Russian string lives here.
 */
import {
  PREGNANCY_TRIMESTERS, PREGNANCY_WEEKS_HUB, PREGNANCY_WEEK_NUMBERS, azOrdinal, formatLength, formatWeight, pregnancyTrimester, pregnancyWeekFacts,
  pregnancyWeekHeading, pregnancyWeekLabel, pregnancyWeekQuick, pregnancyWeekSharedWarnings, pregnancyWeekSize, pregnancyWeekSizeShort, pregnancyWeekSlug,
  pregnancyWeekTitle, type PregnancyWeekContent, type PregnancyWeekFact,
} from './weeks';

export const PREGNANCY_WEEK_LANGUAGES = ['az', 'ru'] as const;
export type PregnancyWeekLanguage = typeof PREGNANCY_WEEK_LANGUAGES[number];
export const isPregnancyWeekLanguage = (language: string): language is PregnancyWeekLanguage => (PREGNANCY_WEEK_LANGUAGES as readonly string[]).includes(language);

export interface WeekLocale {
  parent: string; hubSlug: string; parentLabel: string;
  weekSlug(week: number): string;
  label(week: number): string; title(week: number): string; heading(week: number): string; eyebrow(week: number): string;
  quick(content: PregnancyWeekContent): string; facts(week: number): PregnancyWeekFact[]; sizeShort(week: number): string;
  sharedWarnings(week: number): string[];
  hub: { label: string; title: string; heading: string; description: string; intro: string };
  trimesters: Array<{ trimester: 1 | 2 | 3; title: string; range: string; weeks: number[] }>;
  ui: {
    eyebrow: string; trimesters: string; shortAnswer: string; factsTitle: string; factsNote: string; babyTitle: string; warningTitle: string; warningIntro: string;
    faq: string; sources: string; weeks: string; prev: string; next: string; allWeeks: string; disclaimer: string;
    dueTitle: string; dueText: string; dueButton: string;
    hubPill: string; hubGateTitle: string; hubGateText: string; sticky: string; locked: string[];
    pill(week: number): string; gateTitle(week: number): string; gateText: string; inline(week: number): string;
  };
}

const AZ: WeekLocale = {
  parent: 'hamilelik', hubSlug: 'heftelik', parentLabel: 'Hamiləlik', weekSlug: pregnancyWeekSlug,
  label: pregnancyWeekLabel, title: pregnancyWeekTitle, heading: pregnancyWeekHeading,
  eyebrow: week => `${azOrdinal(pregnancyTrimester(week))} trimestr · ${pregnancyWeekLabel(week)}`,
  quick: pregnancyWeekQuick, facts: pregnancyWeekFacts, sizeShort: pregnancyWeekSizeShort, sharedWarnings: pregnancyWeekSharedWarnings,
  hub: PREGNANCY_WEEKS_HUB, trimesters: PREGNANCY_TRIMESTERS,
  ui: {
    eyebrow: 'Hamiləlik', trimesters: 'Trimestrlər', shortAnswer: 'Qısa cavab', factsTitle: 'Əsas göstəricilər',
    factsNote: 'Ölçülər Anacan tətbiqindəki həftəlik cədvələ əsaslanır və orta göstəricidir; ultrasəsdə ölçülən rəqəmlər fərqli ola bilər.',
    babyTitle: 'Körpənin inkişafı', warningTitle: 'Nə vaxt həkimə müraciət etməli',
    warningIntro: 'Aşağıdakılardan hər hansı biri olarsa, gözləmədən həkiminizə və ya doğum evinə müraciət edin; vəziyyət ağırdırsa, 103 təcili tibbi yardım nömrəsinə zəng edin.',
    faq: 'Tez-tez verilən suallar', sources: 'Mənbələr', weeks: 'Həftələr', prev: 'Əvvəlki', next: 'Növbəti', allWeeks: 'Bütün həftələr',
    disclaimer: 'Bu səhifə ümumi maarifləndirmə məqsədi daşıyır və həkim müayinəsini və ya məsləhətini əvəz etmir. Hər hamiləlik fərqlidir; sizə aid suallar üçün həkiminizə müraciət edin.',
    dueTitle: 'Neçənci həftədəsiniz?', dueText: 'Son menstruasiya tarixinə görə hamiləlik həftəsini və təxmini doğuş tarixini hesablayın.', dueButton: 'Doğuş tarixi kalkulyatoru',
    hubPill: 'Öz həftənizi gün-gün Anacan tətbiqində izləyin', hubGateTitle: 'Hər həftənin tam bələdçisi Anacan-dadır',
    hubGateText: 'Saytda hər həftənin qısa xülasəsi var. Anacan son aybaşı tarixinizə görə həftənizi hesablayır və hər gün sizə aid məsləhət göstərir.',
    sticky: 'Hamiləlik təqvimi Anacan-da',
    locked: ['Körpənin inkişafı: tam mətn', 'Bədəninizdə nələr dəyişir', 'Bu həftənin əlamətləri', 'Bu həftə nə etməli: yoxlama siyahısı',
      'Müayinələr və testlər', 'Gündəlik məsləhət və bildirişlər', 'Təpik sayğacı və sancı taymeri', 'Doğum çantası siyahısı'],
    pill: week => `${pregnancyWeekLabel(week)}: tam bələdçi Anacan tətbiqindədir`,
    gateTitle: week => `${pregnancyWeekLabel(week)}: davamı Anacan tətbiqində`,
    gateText: 'Saytda bu həftənin qısa xülasəsini oxudunuz. Bədəninizdəki dəyişikliklər, əlamətlər, müayinələr, yoxlama siyahısı və gündəlik məsləhətlər tətbiqdədir. Pulsuz yükləyin, son aybaşı tarixinizi daxil edin.',
    inline: week => `${pregnancyWeekLabel(week)} və sonrakı hər həftə: Anacan sizə gün-gün nə gözlədiyinizi göstərir.`,
  },
};

/* ---------------- Russian ---------------- */
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const weeksWord = (n: number) => plural(n, 'неделя', 'недели', 'недель');
/** Fruit of the app size table (src/lib/fetal-size.ts, same weeks) in Russian: nominative and accusative ("размером с ..."). */
const RU_FRUIT: Record<number, [string, string]> = {
  4: ['Маковое зернышко', 'маковое зернышко'], 5: ['Кунжутное семечко', 'кунжутное семечко'], 6: ['Чечевица', 'чечевицу'], 7: ['Черника', 'ягоду черники'],
  8: ['Малина', 'малину'], 9: ['Черешня', 'черешню'], 10: ['Клубника', 'клубнику'], 11: ['Инжир', 'инжир'], 12: ['Лайм', 'лайм'], 13: ['Лимон', 'лимон'],
  14: ['Персик', 'персик'], 15: ['Яблоко', 'яблоко'], 16: ['Авокадо', 'авокадо'], 17: ['Груша', 'грушу'], 18: ['Сладкий перец', 'сладкий перец'],
  19: ['Помидор', 'помидор'], 20: ['Банан', 'банан'], 21: ['Морковь', 'морковь'], 22: ['Грейпфрут', 'грейпфрут'], 23: ['Крупное манго', 'крупное манго'],
  24: ['Початок кукурузы', 'початок кукурузы'], 25: ['Цветная капуста', 'цветную капусту'], 26: ['Кабачок', 'кабачок'], 27: ['Брокколи', 'брокколи'],
  28: ['Баклажан', 'баклажан'], 29: ['Мускатная тыква', 'мускатную тыкву'], 30: ['Кочан капусты', 'кочан капусты'], 31: ['Кокос', 'кокос'],
  32: ['Крупный кабачок', 'крупный кабачок'], 33: ['Ананас', 'ананас'], 34: ['Дыня', 'дыню'], 35: ['Медовая дыня', 'медовую дыню'],
  36: ['Кочан салата ромэн', 'кочан салата ромэн'], 37: ['Пучок мангольда', 'пучок мангольда'], 38: ['Лук-порей', 'лук-порей'],
  39: ['Небольшой арбуз', 'небольшой арбуз'], 40: ['Арбуз', 'арбуз'], 41: ['Крупный арбуз', 'крупный арбуз'], 42: ['Большая тыква', 'большую тыкву'],
};
const RU_NONE: Record<number, string> = { 1: 'Оплодотворение еще не произошло', 2: 'Оплодотворение может произойти в конце этой недели', 3: 'Микроскопический, примерно 0,1-0,2 мм' };
const len = (cm: number) => formatLength(cm).replace(' sm', ' см');
const wt = (g: number) => g < 0.1 ? 'меньше 0,1 г' : formatWeight(g).replace(' kq', ' кг').replace(' q', ' г');
const fruit = (week: number) => RU_FRUIT[week] || RU_FRUIT[Math.min(42, Math.max(4, week))];
function ruSizePhrase(week: number) {
  const size = pregnancyWeekSize(week);
  if (size.kind === 'none') return RU_NONE[week].toLocaleLowerCase('ru');
  return `размером примерно с ${fruit(week)[1]} (${len(size.lengthCm)}, ${wt(size.weightG)})`;
}
const RU_WARN = {
  early: ['Сильная боль с одной стороны живота, боль в кончике плеча, головокружение или обморок после положительного теста на беременность (возможна внематочная беременность).',
    'Сильное кровотечение или температура выше 38 °C.'],
  first: ['Сильное кровотечение, выделения со сгустками или сильная схваткообразная боль внизу живота.', 'Резкая боль с одной стороны живота, боль в кончике плеча, головокружение, обморок.',
    'Невозможность удержать в течение дня никакую еду и даже воду, очень мало мочи или темная моча.', 'Температура выше 38 °C, боль в пояснице вместе с жжением при мочеиспускании.'],
  second: ['Кровянистые выделения или подтекание жидкости, похожей на воду.', 'Ритмичное напряжение живота, схватки, боль в пояснице или сильное давление внизу.',
    'Сильная головная боль, нарушение зрения, внезапные отеки лица и рук (после 20-й недели).', 'Температура выше 38 °C, сильная боль в животе, которая не проходит.'],
  third: ['Шевеления малыша стали реже, изменились или прекратились: обратитесь к врачу или в роддом сразу, не дожидаясь утра.', 'Кровянистые выделения или подтекание жидкости, похожей на воду.',
    'Регулярные схватки, боль в пояснице или сильное давление внизу до 37-й недели.', 'Сильная головная боль, нарушение зрения, боль под ребрами, внезапные отеки лица и рук.',
    'Сильный зуд ладоней и стоп (особенно ночью), температура выше 38 °C.'],
};
const ruTrimester = (t: number) => `${t}-й триместр`;
const RU: WeekLocale = {
  parent: 'беременность', hubSlug: 'по-неделям', parentLabel: 'Беременность', weekSlug: week => `${week}-неделя`,
  label: week => `${week}-я неделя`,
  title: week => `${week} неделя беременности: малыш и ощущения`,
  heading: week => `${week} неделя беременности: размер малыша, симптомы и советы`,
  eyebrow: week => `${ruTrimester(pregnancyTrimester(week))} · ${week}-я неделя`,
  quick: content => content.quick.replace('{size}', ruSizePhrase(content.week)),
  facts: week => {
    const size = pregnancyWeekSize(week);
    const facts: PregnancyWeekFact[] = [
      { label: 'Триместр', value: ruTrimester(pregnancyTrimester(week)) },
      { label: 'Срок беременности', value: `${week} ${weeksWord(week)} 0 дней - ${week} ${weeksWord(week)} 6 дней (от первого дня последней менструации)` },
    ];
    if (size.kind === 'none') facts.push({ label: 'Размер малыша', value: RU_NONE[week] });
    else {
      facts.push({ label: 'Длина малыша', value: `примерно ${len(size.lengthCm)}` });
      facts.push({ label: 'Вес малыша', value: `примерно ${wt(size.weightG)}` });
      facts.push({ label: 'Размер для сравнения', value: size.kind === 'term' ? `${fruit(40)[0]} (как на 40-й неделе; каждый малыш индивидуален)` : fruit(week)[0] });
    }
    facts.push({ label: 'До предполагаемой даты родов', value: week < 40 ? `примерно ${40 - week} ${weeksWord(40 - week)}` : week === 40 ? 'предполагаемая дата родов приходится на эту неделю' : `${week - 40} ${weeksWord(week - 40)} после предполагаемой даты родов` });
    return facts;
  },
  sizeShort: week => {
    const size = pregnancyWeekSize(week);
    if (size.kind === 'none') return week === 3 ? 'Микроскопический' : 'Эмбриона еще нет';
    return `${fruit(week)[0]}: ${len(size.lengthCm)}, ${wt(size.weightG)}`;
  },
  sharedWarnings: week => week <= 3 ? RU_WARN.early : week <= 12 ? RU_WARN.first : week <= 23 ? RU_WARN.second : RU_WARN.third,
  hub: {
    label: 'По неделям', title: 'Беременность по неделям: с 1 по 42 неделю',
    heading: 'Беременность по неделям: с 1-й по 42-ю неделю',
    description: 'Беременность по неделям: размер и развитие малыша, срок, ключевые показатели и опасные симптомы, при которых нужно к врачу. С 1-й по 42-ю неделю.',
    intro: 'Для каждой недели: размер малыша, главные показатели, краткое описание и симптомы, при которых нужно срочно обратиться к врачу. Недели считаются от первого дня последней менструации.',
  },
  trimesters: ([1, 2, 3] as const).map(trimester => {
    const weeks = PREGNANCY_WEEK_NUMBERS.filter(week => pregnancyTrimester(week) === trimester);
    return { trimester, title: ruTrimester(trimester), range: `${weeks[0]}-${weeks[weeks.length - 1]} недели`, weeks };
  }),
  ui: {
    eyebrow: 'Беременность', trimesters: 'Триместры', shortAnswer: 'Коротко', factsTitle: 'Основные показатели',
    factsNote: 'Размеры основаны на недельной таблице приложения Anacan и являются средними; на УЗИ цифры могут отличаться.',
    babyTitle: 'Развитие малыша', warningTitle: 'Когда срочно обратиться к врачу',
    warningIntro: 'Если появилось что-то из перечисленного, не ждите: обратитесь к врачу или в роддом; в тяжелом состоянии звоните в скорую помощь (103).',
    faq: 'Частые вопросы', sources: 'Источники', weeks: 'Недели', prev: 'Предыдущая', next: 'Следующая', allWeeks: 'Все недели',
    disclaimer: 'Эта страница носит общий информационный характер и не заменяет осмотр и консультацию врача. Каждая беременность индивидуальна; с личными вопросами обращайтесь к своему врачу.',
    dueTitle: 'Какая у вас неделя?', dueText: 'Рассчитайте срок беременности и предполагаемую дату родов по дате последней менструации.', dueButton: 'Калькулятор даты родов',
    hubPill: 'Следите за своей неделей день за днем в приложении Anacan', hubGateTitle: 'Полный гид по каждой неделе в Anacan',
    hubGateText: 'На сайте краткое описание каждой недели. Anacan рассчитает вашу неделю по дате последней менструации и каждый день покажет советы именно для вас.',
    sticky: 'Календарь беременности в Anacan',
    locked: ['Развитие малыша: полный текст', 'Что меняется в вашем теле', 'Симптомы этой недели', 'Что сделать на этой неделе: чек-лист',
      'Обследования и анализы', 'Ежедневные советы и уведомления', 'Счетчик шевелений и таймер схваток', 'Список вещей в роддом'],
    pill: week => `${week}-я неделя: полный гид в приложении Anacan`,
    gateTitle: week => `${week}-я неделя: продолжение в приложении Anacan`,
    gateText: 'Вы прочитали краткое описание этой недели. Изменения в теле, симптомы, обследования, чек-лист и ежедневные советы в приложении. Скачайте бесплатно и укажите дату последней менструации.',
    inline: week => `${week}-я неделя и каждая следующая: Anacan день за днем покажет, чего ожидать.`,
  },
};

export const weekLocale = (language: string): WeekLocale => language === 'ru' ? RU : AZ;
