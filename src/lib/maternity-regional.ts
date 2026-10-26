import { addDays, addMonths, differenceInCalendarDays, format, isValid, parseISO, subDays, subMonths } from 'date-fns';
import policy from '@/data/maternity-regional.json';

export type MaternityCountry = keyof typeof policy.countries;
export const REGIONAL_MATERNITY_COUNTRIES = Object.keys(policy.countries) as MaternityCountry[];
export const isRegionalMaternityCountry = (code: string): code is MaternityCountry => Object.prototype.hasOwnProperty.call(policy.countries, code);
export const maternityPolicy = policy;
export type PortuguesePlan = '120' | '150' | 'shared150' | 'shared180' | 'shared180-90';
export interface RegionalMaternityInput {
  country: MaternityCountry; dueDate: string; startDate?: string; birthCount?: number; existingChildren?: number;
  complicated?: boolean; premature?: boolean; certifiedExtraMonths?: number; soleParent?: boolean; includeFlexible?: boolean;
  portuguesePlan?: PortuguesePlan; ownDays?: number; combinedPoland?: boolean; shortInsuranceJapan?: boolean;
  earnings?: number[]; paidSalaryDaily?: number; swedenIncomeDays?: number; swedenMinimumDays?: number;
}
export interface RegionalMaternityResult {
  days: number; months?: number; entitlementDays: number; before: number; start: Date; end: Date; returnDate: Date;
  money: number | null; daily: number | null; currency: string; agency: boolean; yearUnsupported: boolean;
  incomeDays?: number; minimumDays?: number;
}
function civil(value: string) {
  const date = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date) || format(date, 'yyyy-MM-dd') !== value) throw new Error('MATERNITY_DATE_INVALID');
  return date;
}
const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Country-specific planning arithmetic. Entitlement and personal award remain
 * with the relevant agency; unknown schemes never turn into a zero cash award. */
export function calculateRegionalMaternity(input: RegionalMaternityInput): RegionalMaternityResult {
  const { country } = input;
  if (!isRegionalMaternityCountry(country)) throw new Error('MATERNITY_COUNTRY_INVALID');
  const due = civil(input.dueDate), count = input.birthCount ?? 1, existing = input.existingChildren ?? 0, extra = input.certifiedExtraMonths ?? 0;
  const from: Partial<Record<MaternityCountry, string>> = { CN: '2012-04-28', ID: '2024-07-02', ES: '2025-07-31', VN: '2025-07-01', KR: '2025-02-23', PL: '2023-04-26', SE: '2024-07-01' };
  if (from[country] && input.dueDate < from[country]!) throw new Error('MATERNITY_RULE_DATE_UNSUPPORTED');
  if (!integer(count, 1, country === 'SE' ? 4 : 5) || !integer(existing, 0, 20) || !integer(extra, 0, 3)) throw new Error('MATERNITY_INPUT_INVALID');
  const earnings = input.earnings || [];
  if (earnings.some(value => !Number.isFinite(value) || value < 0 || value > 1e10) || !Number.isFinite(input.paidSalaryDaily ?? 0) || (input.paidSalaryDaily ?? 0) < 0) throw new Error('MATERNITY_INPUT_INVALID');
  let before = 0, days = 0, months: number | undefined, entitlementDays = 0, rate = 1, birthIncludedBefore = false;
  let agency = ['CN','KR','NL'].includes(country), incomeDays: number | undefined, minimumDays: number | undefined;
  switch (country) {
    case 'CN': before = 15; days = 98 + (input.complicated ? 15 : 0) + (count - 1) * 15; break;
    case 'ID': months = 3 + extra; break;
    case 'FR': before = count >= 3 ? 168 : count === 2 ? 84 : existing >= 2 ? 56 : 42; days = before + (count >= 2 ? 154 : existing >= 2 ? 126 : 70); break;
    case 'ES': {
      const additional = (count - 1) * (input.soleParent ? 14 : 7), flexible = input.soleParent ? 28 : 14;
      entitlementDays = (input.soleParent ? 224 : 133) + additional; days = entitlementDays - (input.includeFlexible ? 0 : flexible); break;
    }
    case 'PT': {
      const plans: Record<PortuguesePlan, [number, number, number]> = { '120': [120, 1, 0], '150': [150, .8, 0], shared150: [150, 1, 30], shared180: [180, .83, 30], 'shared180-90': [180, .9, 60] };
      const selected = plans[input.portuguesePlan || '120']; if (!selected) throw new Error('MATERNITY_PLAN_INVALID');
      const [total, fraction, otherDays] = selected; entitlementDays = total; rate = fraction;
      days = input.ownDays ?? total - otherDays;
      if (!integer(days, otherDays ? 72 : 42, total - otherDays)) throw new Error('MATERNITY_PERSONAL_DAYS_INVALID');
      // The reviewed ordinary-programme guide does not quantify multiple-birth extensions.
      if (count > 1) agency = true;
      break;
    }
    case 'VN': months = 6 + count - 1; break;
    case 'IN': before = existing >= 2 ? 42 : 56; days = existing >= 2 ? 84 : 182; break;
    case 'JP': before = count > 1 ? 98 : 42; days = before + 56; birthIncludedBefore = true; break;
    case 'KR': before = count > 1 ? 60 : 45; days = count > 1 ? 120 : input.premature ? 100 : 90; break;
    case 'PL': days = [140,217,231,245,259][count - 1]; rate = input.combinedPoland ? .815 : 1; break;
    case 'NL': before = count > 1 ? 70 : 42; days = count > 1 ? 140 : 112; birthIncludedBefore = true; break;
    case 'SE': {
      const incomePool = count === 1 ? 390 : 480 + (count - 2) * 180, minimumPool = count === 1 ? 90 : 180;
      entitlementDays = incomePool + minimumPool;
      incomeDays = input.swedenIncomeDays ?? (input.soleParent ? incomePool : incomePool / 2);
      minimumDays = input.swedenMinimumDays ?? (input.soleParent ? minimumPool : minimumPool / 2);
      if (!integer(incomeDays, 0, input.soleParent ? incomePool : incomePool - 90) || !integer(minimumDays, 0, minimumPool) || incomeDays + minimumDays < 1) throw new Error('MATERNITY_PERSONAL_DAYS_INVALID');
      days = incomeDays + minimumDays; break;
    }
  }
  let start = input.startDate ? civil(input.startDate) : addDays(due, -before + (birthIncludedBefore ? 1 : 0));
  if (country === 'VN' && (start < subMonths(due, 2) || start > due)) throw new Error('MATERNITY_START_OUTSIDE_WINDOW');
  if (country === 'NL') {
    const earliest = addDays(due, 1 - (count > 1 ? 70 : 42)), latest = addDays(due, 1 - (count > 1 ? 56 : 28));
    if (start < earliest || start > latest) throw new Error('MATERNITY_START_OUTSIDE_WINDOW');
  }
  if (country === 'JP') {
    if (start < addDays(due, 1 - before) || start > addDays(due, 56)) throw new Error('MATERNITY_START_OUTSIDE_WINDOW');
    days = differenceInCalendarDays(addDays(due, 57), start);
  }
  if (['CN','IN','PL','PT'].includes(country) && start > due) throw new Error('MATERNITY_START_OUTSIDE_WINDOW');
  if (country === 'CN' && start < subDays(due, 15) || country === 'IN' && start < subDays(due, before) || country === 'PL' && start < subDays(due, 42) || country === 'PT' && start < subDays(due, 30)) throw new Error('MATERNITY_START_OUTSIDE_WINDOW');
  const end = months ? subDays(addMonths(start, months), 1) : addDays(start, days - 1);
  if (months) days = differenceInCalendarDays(addMonths(start, months), start);
  if (!entitlementDays) entitlementDays = days;
  let money: number | null = null, daily: number | null = null, yearUnsupported = false;
  const amount = earnings[0];
  if (!agency && amount !== undefined && amount > 0) {
    if (country === 'FR') {
      if (start.getFullYear() !== 2026) yearUnsupported = true;
      else if (earnings.length === 3 && earnings.every(value => value > 0)) {
        const monthlyCap = subMonths(start, 1).getFullYear() === 2025 ? 3925 : 4005;
        daily = Math.min(104.02, Math.max(11.12, round2(earnings.reduce((sum, value) => sum + Math.min(value, monthlyCap), 0) / 91.25 * .79)));
      }
    } else if (country === 'JP') {
      const reference = input.shortInsuranceJapan ? Math.min(amount, format(start, 'yyyy-MM-dd') >= '2025-04-01' ? 320000 : 300000) : amount;
      daily = Math.max(0, Math.round(Math.round(reference / 30 / 10) * 10 * 2 / 3) - (input.paidSalaryDaily || 0));
    } else if (country === 'VN') money = amount * months!;
    else if (country === 'ID') money = amount * (Math.min(months!, 4) + Math.max(0, months! - 4) * .75);
    else if (country === 'PT') {
      if (start.getFullYear() !== 2026) yearUnsupported = true;
      else daily = Math.max(14.32, round2(amount / 30 * rate));
    } else if (country === 'SE') money = amount * incomeDays! + 180 * minimumDays!;
    else daily = amount * rate;
    if (daily !== null) money = daily * days;
  }
  return { days, months, entitlementDays, before, start, end, returnDate: addDays(end, 1), money: money === null ? null : round2(money), daily, currency: policy.countries[country].currency, agency, yearUnsupported, incomeDays, minimumDays };
}
