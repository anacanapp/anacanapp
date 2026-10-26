import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateDoctorReportPdf, deliverPdf } from './pdfReport';
import type { jsPDF } from 'jspdf';

const native = vi.hoisted(() => ({ active: false, available: false, share: vi.fn(), write: vi.fn(), list: vi.fn(), remove: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.active, isPluginAvailable: () => native.available } }));
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: native.write, readdir: native.list, deleteFile: native.remove } }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback, getPersistedLanguage: () => 'az' }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'az-AZ' }));
vi.mock('@/lib/rtl', () => ({ isRtlLang: () => false }));

beforeEach(() => {
  vi.clearAllMocks(); native.active = false; native.available = false;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const bytes = readFileSync(resolve(process.cwd(), 'public', url.replace(/^\/+/, '')));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }));
  native.list.mockResolvedValue({ files: [] });
  native.write.mockResolvedValue({ uri: 'file://cache/report.pdf' });
  native.share.mockResolvedValue({ activityType: 'mail' });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('doctor PDF generation', () => {
  it('registers Unicode font bytes in every document, including repeated exports', async () => {
    const data = { userName: 'Əsmər Əliyeva — Şəfəq', stageTitle: 'Hamiləlik', periodLabel: '1 ay', stageRows: [], trends: [] };
    const first = await generateDoctorReportPdf(data);
    const second = await generateDoctorReportPdf(data);
    for (const doc of [first, second]) {
      doc.setFont('NotoSans', 'normal');
      const font = doc.getFont();
      expect(font.fontName).toBe('NotoSans');
      expect((font.metadata as any).characterToGlyph('Ə'.codePointAt(0))).toBeGreaterThan(0);
      expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(10000);
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('paginates long notes and large reading tables instead of dropping text off the page', async () => {
    const doc = await generateDoctorReportPdf({ userName: 'Test pasiyenti', stageTitle: 'Analıq', periodLabel: 'Hamısı',
      stageRows: [{ label: 'Uzun məlumat', value: 'Məlumat '.repeat(60) }], trends: [],
      bpRows: Array.from({ length: 100 }, (_, n) => ({ date: `15.09.2026 ${n}`, reading: '120/80', pulse: '72', category: 'Normal' })),
      notes: Array.from({ length: 150 }, (_, n) => `Qeyd ${n}: Həkim üçün tam saxlanmalı olan müşahidə.`).join('\n') });
    expect(doc.getNumberOfPages()).toBeGreaterThan(5);
  });
});

describe('PDF delivery', () => {
  const fakeDoc = () => ({ output: vi.fn((type: string) => type === 'datauristring' ? 'data:application/pdf;base64,ZmFrZQ==' : new Blob(['pdf'], { type: 'application/pdf' })), save: vi.fn().mockResolvedValue(undefined) }) as unknown as jsPDF;

  it('downloads an actual PDF when file sharing is unavailable', async () => {
    const doc = fakeDoc();
    expect(await deliverPdf(doc, 'report.pdf', 'download')).toBe('downloaded');
    expect(doc.save).toHaveBeenCalledWith('report.pdf', { returnPromise: true });
  });

  it('shares a native cached PDF URI and keeps recent files available to the receiving app', async () => {
    native.active = true; native.available = true;
    native.list.mockResolvedValue({ files: [{ name: 'old.pdf', mtime: Date.now() - 4 * 86400000 }, { name: 'recent.pdf', mtime: Date.now() }] });
    expect(await deliverPdf(fakeDoc(), 'report.pdf', 'share')).toBe('shared');
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file://cache/report.pdf'] }));
    expect(native.write).toHaveBeenCalledWith(expect.objectContaining({ data: 'ZmFrZQ==', directory: 'CACHE' }));
    expect(native.remove).toHaveBeenCalledTimes(1);
    expect(native.remove).toHaveBeenCalledWith({ path: 'doctor-reports/old.pdf', directory: 'CACHE' });
  });

  it('does not report sharing success or trigger a download when the user cancels', async () => {
    native.active = true; native.available = true;
    native.share.mockRejectedValue(new Error('Share canceled'));
    const doc = fakeDoc();
    expect(await deliverPdf(doc, 'report.pdf', 'share')).toBe('cancelled');
    expect(doc.save).not.toHaveBeenCalled();
  });
});
