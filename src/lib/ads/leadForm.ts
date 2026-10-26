import copy from '../../../scripts/i18n/brand-lead-copy.json';
import { normalizeAppLanguage } from '../app-languages';

export const LEAD_FIELD_KEYS = ['name', 'phone', 'email', 'question_1', 'question_2', 'question_3'] as const;
export type LeadFieldKey = typeof LEAD_FIELD_KEYS[number];
export interface LeadField { key: LeadFieldKey; required: boolean }
export interface LeadFormCopy { title: string; intro?: string; consent: string; success?: string; question_1?: string; question_2?: string; question_3?: string }
/** Public projection from get_ad_lead_form_v1: no other user's data and no lead answers. */
export interface PublicLeadForm { id: string; revision: number; fields: LeadField[]; copy: LeadFormCopy; language: string; privacy_url: string | null; retention_days: number; sponsor_name: string }
export type LeadText = keyof typeof copy.languages.en;
export type LeadError = 'required' | 'email' | 'phone' | 'consent' | 'empty';

export function leadText(key: LeadText, language: string, values: Record<string, string | number> = {}): string {
  const lang = normalizeAppLanguage(language) as keyof typeof copy.languages;
  const text: string = copy.languages[lang]?.[key] || copy.languages.en[key];
  return text.replace(/\{(\w+)\}/g, (match, name) => name in values ? String(values[name]) : match);
}

export const isLeadEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
export const normalizeLeadPhone = (value: string) => value.replace(/[\s().-]/g, '');
export const isLeadPhone = (value: string) => /^\+?[0-9]{7,15}$/.test(normalizeLeadPhone(value));

export function parsePublicLeadForm(data: unknown): PublicLeadForm | null {
  const form = data as PublicLeadForm | null;
  if (!form || typeof form.id !== 'string' || !Array.isArray(form.fields) || !form.copy?.title || !form.copy?.consent) return null;
  const fields = form.fields.filter(field => LEAD_FIELD_KEYS.includes(field?.key));
  if (!fields.length) return null;
  const privacy = typeof form.privacy_url === 'string' && /^https:\/\/[^\s@/]+(\/\S*)?$/.test(form.privacy_url) ? form.privacy_url : null;
  return { ...form, fields, privacy_url: privacy, retention_days: Math.min(90, Math.max(1, Number(form.retention_days) || 90)) };
}

/** Mirrors submit_ad_lead_v1 so people see errors before the round trip. */
export function validateLead(form: PublicLeadForm, answers: Partial<Record<LeadFieldKey, string>>, consent: boolean) {
  const errors: Partial<Record<LeadFieldKey | 'consent' | 'form', LeadError>> = {};
  const clean: Partial<Record<LeadFieldKey, string>> = {};
  for (const field of form.fields) {
    let value = (answers[field.key] || '').trim();
    if (!value) { if (field.required) errors[field.key] = 'required'; continue; }
    if (field.key === 'email' && !isLeadEmail(value)) errors[field.key] = 'email';
    if (field.key === 'phone') { value = normalizeLeadPhone(value); if (!isLeadPhone(value)) errors[field.key] = 'phone'; }
    clean[field.key] = value.slice(0, field.key.startsWith('question_') ? 500 : 254);
  }
  if (!consent) errors.consent = 'consent';
  if (!Object.keys(clean).length && !Object.keys(errors).some(key => key !== 'consent')) errors.form = 'empty';
  return { errors, clean, valid: !Object.keys(errors).length };
}

export const leadFieldLabel = (form: PublicLeadForm, key: LeadFieldKey, language: string) =>
  key.startsWith('question_') ? form.copy[key as 'question_1'] || '' : leadText(`field_${key}` as LeadText, language);
