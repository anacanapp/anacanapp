import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { getLocaleTag } from '@/lib/i18n';
import { tr, getPersistedLanguage } from '@/lib/tr';
import { isRtlLang } from '@/lib/rtl';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';

export interface ReportRow { label: string; value: string; }
export interface ReportTable { title: string; headers: string[]; rows: string[][]; widths?: number[]; }
export interface DoctorReportData {
  userName: string;
  stageTitle: string;
  periodLabel: string;
  dateRangeLabel?: string;
  generatedAt?: Date;
  stageRows: ReportRow[];
  trends: { label: string; value: string; trend: string }[];
  bpRows?: { date: string; reading: string; category: string; pulse?: string }[];
  babyCareRows?: ReportRow[];
  fetalGrowthRows?: ReportRow[];
  historyTables?: ReportTable[];
  weightSeries?: { date: string; weight: number }[];
  coverage?: { records: number; recordedDays: number };
  notes?: string;
}

const INK: [number, number, number] = [31, 49, 62];
const MUTED: [number, number, number] = [91, 107, 119];
const ACCENT: [number, number, number] = [188, 94, 70];
const SOFT: [number, number, number] = [246, 248, 250];
const LINE: [number, number, number] = [221, 228, 234];
const PT = 25.4 / 72;
const ARABIC = /[\u0600-\u06ff\u0750-\u077f]/;
const fontCache = new Map<string, Promise<string>>();
const clean = (value: unknown) => String(value ?? '—').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const mirror = (text: string) => text.replace(/[()[\]{}<>«»]/g, char => ({ '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' })[char]!);
type Weight = 'normal' | 'bold';

function fontData(path: string): Promise<string> {
  let pending = fontCache.get(path);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(path, { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('REPORT_FONT_UNAVAILABLE');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length < 100 || bytes[0] !== 0 || bytes[1] !== 1) throw new Error('REPORT_FONT_INVALID');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary);
      } finally { clearTimeout(timer); }
    })().catch(error => { fontCache.delete(path); throw error; });
    fontCache.set(path, pending);
  }
  return pending;
}

async function registerFonts(doc: jsPDF, arabic: boolean) {
  const fonts = [
    { file: 'NotoSans-Regular.ttf', family: 'NotoSans', weight: 'normal' },
    { file: 'NotoSans-Bold.ttf', family: 'NotoSans', weight: 'bold' },
    ...(arabic ? [
      { file: 'NotoNaskhArabic-Regular.ttf', family: 'NotoArabic', weight: 'normal' },
      { file: 'NotoNaskhArabic-Bold.ttf', family: 'NotoArabic', weight: 'bold' },
    ] : []),
  ];
  const data = await Promise.all(fonts.map(font => fontData(`/fonts/${font.file}`)));
  // VFS belongs to each document. Cache bytes, never a previous document's registration.
  fonts.forEach((font, index) => { doc.addFileToVFS(font.file, data[index]); doc.addFont(font.file, font.family, font.weight); });
}

export async function generateDoctorReportPdf(data: DoctorReportData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const createdAt = data.generatedAt || new Date();
  const rtl = isRtlLang(getPersistedLanguage());
  const arabic = rtl || ARABIC.test(JSON.stringify(data));
  await registerFonts(doc, arabic);
  const title = tr('pdf_report_subtitle', 'Həkim Hesabatı');
  doc.setProperties({ title: `${title} — ${data.userName}`, author: 'Anacan', creator: 'Anacan', subject: data.periodLabel });
  doc.setCreationDate(createdAt);
  const languages = APP_LANGUAGE_CODES;
  const language = languages.find(value => value === getPersistedLanguage());
  // jsPDF's metadata locale list does not contain Uzbek; its text still uses
  // the selected UI translations and the existing Unicode font path.
  if (language && language !== 'uz') doc.setLanguage(language);

  const pageW = 210, pageH = 297, margin = 16, width = pageW - margin * 2, bottom = 276;
  const lineHeight = (size: number) => size * PT * 1.4;
  let y = 0, sectionNumber = 0;
  let pendingSection: { lines: string[]; number: number } | null = null;
  const measureCache = new Map<string, number>();
  const canvas = document.createElement('canvas');
  const canvasContext = canvas.getContext('2d');
  type Run = { text: string; font: string; };
  const runs = (value: string): Run[] => {
    if (!arabic || !ARABIC.test(value)) return [{ text: value, font: 'NotoSans' }];
    const result: Run[] = [];
    for (const char of value) {
      const family = ARABIC.test(char) ? 'NotoArabic' : 'NotoSans';
      const last = result[result.length - 1];
      if (last && (char === ' ' || last.font === family)) last.text += char;
      else result.push({ text: char, font: family });
    }
    return result;
  };
  const shaped = (run: Run) => run.font === 'NotoArabic' ? doc.processArabic(run.text) : ARABIC.test(run.text) || !rtl ? run.text : mirror(run.text);
  const rasterNeeded = (value: string, weight: Weight) => runs(value).some(run => {
    doc.setFont(run.font, weight);
    const metadata = doc.getFont().metadata as any;
    return typeof metadata.characterToGlyph === 'function' && Array.from(shaped(run)).some(char => !/\s/.test(char) && metadata.characterToGlyph(char.codePointAt(0)) === 0);
  });
  const measure = (value: string, size: number, weight: Weight = 'normal') => {
    const key = `${weight}:${size}:${value}`;
    const cached = measureCache.get(key);
    if (cached !== undefined) return cached;
    let result = 0;
    if (canvasContext && rasterNeeded(value, weight)) {
      canvasContext.font = `${weight === 'bold' ? '700' : '400'} ${size * 4}px Arial, sans-serif`;
      result = canvasContext.measureText(value).width / 4 * PT;
    } else {
      result = runs(value).reduce((total, run) => {
        doc.setFont(run.font, weight); doc.setFontSize(size);
        return total + doc.getTextWidth(shaped(run));
      }, 0);
    }
    measureCache.set(key, result);
    return result;
  };
  const write = (value: string, x: number, baseline: number, size = 10, weight: Weight = 'normal', color: [number, number, number] = INK, align: 'left' | 'center' | 'right' = 'left') => {
    const text = clean(value);
    const textWidth = measure(text, size, weight);
    if (canvasContext && rasterNeeded(text, weight)) {
      // Preserve uncommon scripts/emoji with browser shaping rather than silently dropping glyphs.
      const scale = 4;
      canvasContext.font = `${weight === 'bold' ? '700' : '400'} ${size * scale}px Arial, sans-serif`;
      const metrics = canvasContext.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent || size * scale;
      const descent = metrics.actualBoundingBoxDescent || size * scale * 0.25;
      canvas.width = Math.ceil(metrics.width + 16); canvas.height = Math.ceil(ascent + descent + 16);
      canvasContext.font = `${weight === 'bold' ? '700' : '400'} ${size * scale}px Arial, sans-serif`;
      canvasContext.fillStyle = `rgb(${color.join(',')})`; canvasContext.textBaseline = 'alphabetic';
      canvasContext.direction = ARABIC.test(text) ? 'rtl' : 'ltr'; canvasContext.textAlign = 'left';
      canvasContext.fillText(text, 8, 8 + ascent);
      const left = align === 'right' ? x - textWidth : align === 'center' ? x - textWidth / 2 : x;
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', left - 8 / scale * PT, baseline - (8 + ascent) / scale * PT, canvas.width / scale * PT, canvas.height / scale * PT);
      return;
    }
    doc.setTextColor(...color);
    if (!arabic || !ARABIC.test(text)) {
      doc.setFont('NotoSans', weight); doc.setFontSize(size); doc.text(text, x, baseline, { align });
      return;
    }
    let right = align === 'right' ? x : align === 'center' ? x + textWidth / 2 : x + textWidth;
    for (const run of runs(text)) {
      doc.setFont(run.font, weight); doc.setFontSize(size);
      const content = run.font === 'NotoArabic' ? run.text : mirror(run.text);
      doc.text(content, right, baseline, { align: 'right' });
      right -= measure(run.text, size, weight);
    }
  };
  const wrap = (value: string, maxWidth: number, size: number, weight: Weight = 'normal'): string[] => {
    const lines: string[] = [];
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/(\s+)/)) {
        if (measure(line + word, size, weight) <= maxWidth) { line += word; continue; }
        if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
        for (const char of Array.from(word.trimStart())) {
          if (line && measure(line + char, size, weight) > maxWidth) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };
  const paragraph = (text: string, size = 10, color = INK) => {
    for (const line of wrap(text, width, size)) {
      ensureSpace(lineHeight(size));
      write(line, rtl ? pageW - margin : margin, y + size * PT, size, 'normal', color, rtl ? 'right' : 'left');
      y += lineHeight(size);
    }
  };
  const runningHeader = () => {
    doc.setFillColor(...INK); doc.rect(0, 0, pageW, 2, 'F');
    write('Anacan', rtl ? pageW - margin : margin, 13, 12, 'bold', INK, rtl ? 'right' : 'left');
    write(title, rtl ? margin : pageW - margin, 13, 9, 'normal', MUTED, rtl ? 'left' : 'right');
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(margin, 18, pageW - margin, 18);
    y = 25;
  };
  const ensureSpace = (needed: number) => {
    const headingHeight = pendingSection ? 10 + Math.max(8, pendingSection.lines.length * lineHeight(11.5)) : 0;
    if (y + needed + headingHeight > bottom) { doc.addPage(); runningHeader(); }
    if (pendingSection) {
      const heading = pendingSection;
      pendingSection = null;
      y += 4;
      const badgeX = rtl ? pageW - margin - 10 : margin;
      doc.setFillColor(252, 239, 234); doc.roundedRect(badgeX, y, 10, 8, 2, 2, 'F');
      write(String(heading.number).padStart(2, '0'), badgeX + 5, y + 5.5, 8.5, 'bold', ACCENT, 'center');
      heading.lines.forEach((line, index) => write(line, rtl ? pageW - margin - 15 : margin + 15, y + 5.5 + index * lineHeight(11.5), 11.5, 'bold', INK, rtl ? 'right' : 'left'));
      y += Math.max(8, heading.lines.length * lineHeight(11.5)) + 6;
    }
  };
  const section = (text: string) => {
    // Draw a heading only when its first card, paragraph or table header also fits.
    pendingSection = { lines: wrap(text, width - 16, 11.5, 'bold'), number: ++sectionNumber };
  };
  const cards = (rows: ReportRow[]) => {
    const gap = 6, cellWidth = (width - gap) / 2;
    for (let index = 0; index < rows.length; index += 2) {
      const pair = rows.slice(index, index + 2).map(row => ({ label: wrap(row.label, cellWidth - 12, 8.5), value: wrap(row.value, cellWidth - 12, 11, 'bold') }));
      const height = Math.max(...pair.map(row => 12 + row.label.length * lineHeight(8.5) + row.value.length * lineHeight(11)));
      if (height > bottom - 30) {
        for (const row of rows.slice(index, index + 2)) { paragraph(`${row.label}:`, 9, MUTED); paragraph(row.value, 10); y += 4; }
        continue;
      }
      ensureSpace(height + 5);
      pair.forEach((row, col) => {
        const x = margin + (rtl ? 1 - col : col) * (cellWidth + gap);
        doc.setFillColor(...SOFT); doc.roundedRect(x, y, cellWidth, height, 2.5, 2.5, 'F');
        const anchor = rtl ? x + cellWidth - 6 : x + 6;
        row.label.forEach((line, n) => write(line, anchor, y + 7 + n * lineHeight(8.5), 8.5, 'normal', MUTED, rtl ? 'right' : 'left'));
        const valueY = y + 10 + row.label.length * lineHeight(8.5);
        row.value.forEach((line, n) => write(line, anchor, valueY + n * lineHeight(11), 11, 'bold', INK, rtl ? 'right' : 'left'));
      });
      y += height + 5;
    }
  };
  const table = (headers: string[], rows: string[][], fractions?: number[]) => {
    const proportions = fractions || headers.map(() => 1);
    const sum = proportions.reduce((n, value) => n + value, 0);
    const widths = proportions.map(value => width * value / sum);
    const cellX = (col: number) => rtl ? pageW - margin - widths.slice(0, col + 1).reduce((n, value) => n + value, 0) : margin + widths.slice(0, col).reduce((n, value) => n + value, 0);
    const headerLines = headers.map((header, i) => wrap(header, widths[i] - 8, 8.5, 'bold'));
    const headerHeight = Math.max(...headerLines.map(lines => lines.length)) * lineHeight(8.5) + 6;
    const drawHeader = () => {
      ensureSpace(headerHeight + 10); doc.setFillColor(...INK); doc.roundedRect(margin, y, width, headerHeight, 1.5, 1.5, 'F');
      headerLines.forEach((lines, i) => lines.forEach((line, n) => write(line, rtl ? cellX(i) + widths[i] - 4 : cellX(i) + 4, y + 5 + n * lineHeight(8.5), 8.5, 'bold', [255,255,255], rtl ? 'right' : 'left')));
      y += headerHeight;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const lines = headers.map((_header, i) => wrap(row[i] ?? '—', widths[i] - 8, 9));
      const count = Math.max(...lines.map(value => value.length));
      let offset = 0;
      while (offset < count) {
        if (y + lineHeight(9) + 7 > bottom) { doc.addPage(); runningHeader(); drawHeader(); }
        const take = Math.min(count - offset, Math.max(1, Math.floor((bottom - y - 7) / lineHeight(9))));
        const height = take * lineHeight(9) + 7;
        if (rowIndex % 2 === 0) { doc.setFillColor(...SOFT); doc.rect(margin, y, width, height, 'F'); }
        lines.forEach((column, i) => column.slice(offset, offset + take).forEach((line, n) => write(line, rtl ? cellX(i) + widths[i] - 4 : cellX(i) + 4, y + 5 + n * lineHeight(9), 9, i === 1 ? 'bold' : 'normal', INK, rtl ? 'right' : 'left')));
        doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(margin, y + height, pageW - margin, y + height);
        y += height; offset += take;
      }
    });
    y += 5;
  };

  // Cover / patient identification.
  doc.setFillColor(...ACCENT); doc.rect(0, 0, pageW, 3, 'F');
  write('Anacan', rtl ? pageW - margin : margin, 17, 18, 'bold', INK, rtl ? 'right' : 'left');
  write(tr('pdf_health_record', 'SAĞLAMLIQ HESABATI'), rtl ? pageW - margin : margin, 24, 8.5, 'bold', MUTED, rtl ? 'right' : 'left');
  const date = format(createdAt, 'dd.MM.yyyy');
  write(date, rtl ? margin : pageW - margin, 16, 9, 'normal', MUTED, rtl ? 'left' : 'right');
  write(data.periodLabel, rtl ? margin : pageW - margin, 23, 9, 'bold', ACCENT, rtl ? 'left' : 'right');
  y = 36;
  const nameLines = wrap(data.userName, width - 14, 17, 'bold');
  nameLines.forEach(line => { ensureSpace(9); write(line, rtl ? pageW - margin : margin, y, 17, 'bold', INK, rtl ? 'right' : 'left'); y += lineHeight(17); });
  paragraph(data.stageTitle, 10, MUTED);
  if (data.dateRangeLabel) paragraph(data.dateRangeLabel, 9, MUTED);
  y += 4;
  if (data.coverage) {
    cards([
      { label: tr('pdf_record_count', 'Hesabata daxil olan qeydlər'), value: String(data.coverage.records) },
      { label: tr('pdf_recorded_days', 'Qeyd aparılmış günlər'), value: String(data.coverage.recordedDays) },
    ]);
  }
  if (data.stageRows.length) { section(tr('pdf_section_basics', 'Cari məlumatlar')); cards(data.stageRows); }
  if (data.trends.length) {
    section(tr('pdf_section_trends', 'Sağlamlıq göstəriciləri'));
    table([tr('pdf_metric', 'Göstərici'), tr('pdf_value', 'Nəticə'), tr('pdf_coverage_change', 'Əhatə / dəyişiklik')], data.trends.map(row => [row.label, row.value, row.trend]), [1.1, 1, 1.2]);
  }
  if (data.weightSeries && data.weightSeries.length > 0) {
    section(tr('pdf_weight_history', 'Çəki qeydləri'));
    table([tr('pdf_date', 'Tarix'), tr('pdf_weight_kg', 'Çəki (kq)')], data.weightSeries.map(row => [row.date, row.weight.toLocaleString(getLocaleTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })]), [1,1]);
  }
  if (data.babyCareRows?.length) {
    section(tr('pdf_section_babycare', 'Körpə qulluğu'));
    paragraph(tr('pdf_logged_days_note', 'Ortalamalar yalnız müvafiq qeydin olduğu günlərə əsaslanır. Davam edən yuxu intervalları yuxu müddətinə daxil edilmir.'), 8.5, MUTED);
    y += 4; cards(data.babyCareRows);
  }
  if (data.fetalGrowthRows?.length) { section(tr('pdf_section_fetalgrowth', 'Fetal böyümə')); cards(data.fetalGrowthRows); }
  if (data.bpRows?.length) {
    section(tr('pdf_section_bp_period', 'Dövr üzrə qan təzyiqi'));
    table([tr('pdf_date_time', 'Tarix / saat'), tr('pdf_bp_mmhg', 'Təzyiq (mmHg)'), tr('pdf_pulse', 'Nəbz'), tr('pdf_reading_range', 'Ölçmə aralığı')], data.bpRows.map(row => [row.date, row.reading, row.pulse || '—', row.category]), [1.15, 1, 0.55, 1.5]);
  }
  for (const history of data.historyTables || []) {
    if (history.rows.length) { section(history.title); table(history.headers, history.rows, history.widths); }
  }
  if (data.notes?.trim()) { section(tr('pdf_section_notes', 'Həkim üçün qeydlər')); paragraph(data.notes.trim(), 10); y += 5; }
  if (data.coverage?.records === 0) { section(tr('pdf_no_observations', 'Müşahidələr')); paragraph(tr('pdf_no_records_period', 'Seçilmiş dövr üçün sağlamlıq qeydi yoxdur.'), 10, MUTED); }

  const count = doc.getNumberOfPages();
  const footer = wrap(tr('pdf_footer', 'Anacan tətbiqi ilə yaradılıb · Bu hesabat tibbi sənəd deyil, məlumat xarakterlidir.'), width - 20, 7);
  for (let page = 1; page <= count; page++) {
    doc.setPage(page); doc.setDrawColor(...LINE); doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
    footer.forEach((line, index) => write(line, rtl ? pageW - margin : margin, pageH - 11 + index * lineHeight(7), 7, 'normal', MUTED, rtl ? 'right' : 'left'));
    write(`${page} / ${count}`, rtl ? margin : pageW - margin, pageH - 11, 8, 'bold', MUTED, rtl ? 'left' : 'right');
  }
  return doc;
}

export type PdfDeliveryResult = 'shared' | 'downloaded' | 'cancelled';
const isCancelled = (error: unknown) => {
  const value = error as { name?: string; message?: string };
  return value?.name === 'AbortError' || /share cancel(l)?ed/i.test(value?.message || '');
};

export async function deliverPdf(doc: jsPDF, fileName: string, mode: 'download' | 'share'): Promise<PdfDeliveryResult> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-') || 'anacan-report.pdf';
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const folder = 'doctor-reports';
    // Keep recently shared URIs valid for receiving Android apps; prune only older cache files.
    try {
      const old = await Filesystem.readdir({ path: folder, directory: Directory.Cache });
      await Promise.all(old.files.filter(file => file.name.endsWith('.pdf') && file.mtime < Date.now() - 3 * 86400000)
        .map(file => Filesystem.deleteFile({ path: `${folder}/${file.name}`, directory: Directory.Cache })));
    } catch { /* The report cache may not exist yet. */ }
    const data = doc.output('datauristring').split(',')[1];
    const saved = await Filesystem.writeFile({ path: `${folder}/${Date.now()}-${safeName}`, directory: Directory.Cache, data, recursive: true });
    try {
      await Share.share({ title: safeName, files: [saved.uri], dialogTitle: tr('pdf_share_title', 'Hesabatı paylaş / saxla') });
      return 'shared';
    } catch (error) { if (isCancelled(error)) return 'cancelled'; throw error; }
  }
  const file = new File([doc.output('blob')], safeName, { type: 'application/pdf' });
  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: safeName }); return 'shared'; }
    catch (error) { if (isCancelled(error)) return 'cancelled'; }
  }
  await doc.save(safeName, { returnPromise: true });
  return 'downloaded';
}
