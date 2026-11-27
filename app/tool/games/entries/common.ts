// JS number/JSON semantics the Dart helpers must reproduce.
import { APP_LANGUAGE_CODES, normalizeAppLanguage } from '@/lib/app-languages';
export function all() {
  const numbers = [0, -0, 1, -1, 0.1, 0.5, 1.5, 2.5, -2.5, 1 / 3, 1e21, 1e-7, 123456789012345680000, 1.5e-7, 2 ** 53, 0.000001, 45.7, 1e20, 5e-324, 1.7976931348623157e308, 360.10000000000002, 199.99999999999997];
  const strings = ['', ' 41 ', '30.5', '-5', 'abc', '0x1F', '1e2', '.5', '5.', '+7', 'Infinity', '-Infinity', '\n12\t', '1_000', '0b101', '0o17', '12px'];
  const ints = [0, 1, -1, 2 ** 31, 2 ** 32, 2 ** 32 + 5, -(2 ** 31) - 1, 4294967296 * 3 + 7, 1731600000000, 2 ** 53, 1.9, -1.9, NaN, Infinity];
  return {
    appLanguages: APP_LANGUAGE_CODES,
    normalized: ['az', 'EN', 'tr_TR', 'pt-BR', ' uk ', 'xx', '', 'zh-Hans-CN'].map(value => ({ value, code: normalizeAppLanguage(value) })),
    numbers: numbers.map(value => ({ value, text: String(value), round: Math.round(value) })),
    toNumber: strings.map(value => ({ value, number: Number.isFinite(Number(value)) ? Number(value) : String(Number(value)) })),
    int32: ints.map(value => ({ value: Number.isFinite(value) ? value : String(value), int32: value | 0, uint32: value >>> 0, imul: Math.imul(value, 0x9E3779B9) })),
    objects: [{ b: 1, a: 2, 10: 'x', 2: 'y', '01': 'z', '-1': 'w' }, { z: [1.0, 2.5, null], q: 'é"\\\n\u0001 ' }].map(value => ({ value: Object.entries(value), json: JSON.stringify(value) })),
  };
}
