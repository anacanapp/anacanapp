/** Registers every language's calculator texts; imported by server-side renderers and tests only. */
import { registerCalcContent } from './index';
import az from './locales/az';
import en from './locales/en';
import tr from './locales/tr';
import ru from './locales/ru';
import de from './locales/de';
import ar from './locales/ar';
import ka from './locales/ka';
import kk from './locales/kk';
import uz from './locales/uz';
import zh from './locales/zh';
import id from './locales/id';
import fr from './locales/fr';
import es from './locales/es';
import pt from './locales/pt';
import vi from './locales/vi';
import hi from './locales/hi';
import ja from './locales/ja';
import ko from './locales/ko';
import pl from './locales/pl';
import nl from './locales/nl';
import sv from './locales/sv';

export const ALL_CALC_CONTENT = { az, en, tr, ru, de, ar, ka, kk, uz, zh, id, fr, es, pt, vi, hi, ja, ko, pl, nl, sv };
for (const [language, content] of Object.entries(ALL_CALC_CONTENT)) registerCalcContent(language as keyof typeof ALL_CALC_CONTENT, content);
