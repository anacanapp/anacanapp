/** Formatting helpers shared by admin sections. Azerbaijani locale, AZN currency. */
const LOCALE = 'az-AZ';

export const fmtNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? '—'
    : Number(value).toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtMoney = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : `${fmtNumber(Number(value), 2)} ₼`;

/** Money from minor units (qəpik). */
export const fmtMinor = (minor: number | null | undefined) => minor === null || minor === undefined ? '—' : fmtMoney(Number(minor) / 100);

export const fmtDate = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** "5 dəq əvvəl", "3 saat əvvəl", "2 gün əvvəl" — short relative time. */
export const fmtRelative = (value: string | null | undefined, now = Date.now()) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const seconds = Math.max(0, Math.round((now - Date.parse(value)) / 1000));
  if (seconds < 60) return 'indicə';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dəq əvvəl`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat əvvəl`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} gün əvvəl`;
  return fmtDate(value);
};

/** Lower-case and fold Azerbaijani/Turkish letters so "sifaris" finds "Sifarişlər". */
export const foldText = (text: string) => text.toLocaleLowerCase('az')
  .replace(/ə/g, 'e').replace(/[ıi̇]/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

/** CSV download with formula-injection guard (same rules as the insights export). */
export function downloadCsv(name: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
