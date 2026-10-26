import { describe, expect, it } from 'vitest';
import copy from '../../../scripts/i18n/brand-lead-copy.json';
import { APP_LANGUAGES } from '../app-languages';
import { isLeadEmail, isLeadPhone, leadFieldLabel, leadText, normalizeLeadPhone, parsePublicLeadForm, validateLead, type PublicLeadForm } from './leadForm';

const form = (patch: Partial<PublicLeadForm> = {}): PublicLeadForm => ({ id: 'form', revision: 2, language: 'az', privacy_url: null, retention_days: 90, sponsor_name: 'Brand',
  fields: [{ key: 'name', required: true }, { key: 'phone', required: true }, { key: 'email', required: false }, { key: 'question_1', required: false }],
  copy: { title: 'Pulsuz nümunə', consent: 'Brend sizinlə əlaqə saxlayacaq.', question_1: 'Körpənin yaşı?' }, ...patch });

describe('consumer lead copy', () => {
  it('ships every key in all 21 app languages with the same placeholders', () => {
    const languages = copy.languages as Record<string, Record<string, string>>, english = Object.keys(copy.languages.en);
    expect(Object.keys(languages).sort()).toEqual(APP_LANGUAGES.map(item => item.code).sort());
    for (const [code, values] of Object.entries(languages)) {
      expect(Object.keys(values).sort(), code).toEqual([...english].sort());
      for (const key of english) expect(values[key].match(/\{\w+\}/g) ?? [], `${code}.${key}`).toEqual(copy.languages.en[key as keyof typeof copy.languages.en].match(/\{\w+\}/g) ?? []);
    }
  });
  it('interpolates the brand and retention and resolves unknown languages like the app', () => {
    expect(leadText('privacy_note', 'az', { brand: 'Brend', days: 90 })).toContain('Brend');
    expect(leadText('privacy_note', 'az', { brand: 'Brend', days: 90 })).toContain('90');
    expect(leadText('submit', 'en')).toBe('Send'); expect(leadText('submit', 'xx')).toBe(leadText('submit', 'az'));
    expect(leadText('success', 'ar', { brand: 'X' })).toContain('X');
  });
});

describe('lead form validation (mirror of submit_ad_lead_v1)', () => {
  it('validates contact formats and normalizes phone numbers', () => {
    expect(isLeadEmail('ana@example.az')).toBe(true); expect(isLeadEmail('ana@example')).toBe(false);
    expect(normalizeLeadPhone('+994 (50) 123-45-67')).toBe('+994501234567');
    expect(isLeadPhone('+994 50 123 45 67')).toBe(true); expect(isLeadPhone('12')).toBe(false); expect(isLeadPhone('+99450abc')).toBe(false);
  });
  it('requires consent and required fields, and returns only cleaned answers for enabled fields', () => {
    const missing = validateLead(form(), { name: ' ' }, false);
    expect(missing.valid).toBe(false);
    expect(missing.errors).toMatchObject({ name: 'required', phone: 'required', consent: 'consent' });
    const ok = validateLead(form(), { name: ' Aynur ', phone: '+994 50 123 45 67', question_2: 'ignored' } as any, true);
    expect(ok).toMatchObject({ valid: true, clean: { name: 'Aynur', phone: '+994501234567' } });
    expect(ok.clean).not.toHaveProperty('question_2');
    expect(validateLead(form(), { name: 'A', phone: '+994501234567', email: 'bad' }, true).errors).toEqual({ email: 'email' });
  });
  it('accepts only a sane public projection and drops unsafe privacy links', () => {
    expect(parsePublicLeadForm(null)).toBeNull();
    expect(parsePublicLeadForm({ ...form(), fields: [{ key: 'ssn', required: true }] })).toBeNull();
    expect(parsePublicLeadForm({ ...form(), privacy_url: 'javascript:alert(1)' })?.privacy_url).toBeNull();
    expect(parsePublicLeadForm({ ...form(), privacy_url: 'https://brand.example/privacy', retention_days: 900 })).toMatchObject({ privacy_url: 'https://brand.example/privacy', retention_days: 90 });
  });
  it('labels brand questions with the brand copy and standard fields with app copy', () => {
    expect(leadFieldLabel(form(), 'question_1', 'az')).toBe('Körpənin yaşı?');
    expect(leadFieldLabel(form(), 'phone', 'ru')).toBe('Номер телефона');
  });
});
