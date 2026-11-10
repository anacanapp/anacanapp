/** SSR renderer and tests: register every tool data set synchronously at import. */
import namesAz from './data/names-az.json' with { type: 'json' };
import namesKa from './data/names-ka.json' with { type: 'json' };
import regional from '../../data/maternity-regional.json' with { type: 'json' };
import { maternityRules } from '../../data/maternityRules';
import type { NameRow } from './names';
import { registerMaternity, registerNames } from './tool-data';

registerNames('az', namesAz as NameRow[]);
registerNames('ka', namesKa as NameRow[]);
registerMaternity(maternityRules, Object.keys(regional.countries));
