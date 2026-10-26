/** Date-only arithmetic uses UTC calendar days, never elapsed local DST hours. */
export const CALENDAR_DAY = 86400000;
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? date : null;
}
export function calendarIso(date: Date): string { return date.toISOString().slice(0,10); }
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function addCalendarDays(date: Date, days: number): Date { return new Date(date.getTime() + days * CALENDAR_DAY); }
export function calendarDifference(left: Date, right: Date): number { return Math.round((left.getTime()-right.getTime())/CALENDAR_DAY); }
export interface CycleInput { lastPeriod:string; cycleLength:number; periodLength:number; lutealLength:number }
export interface CycleEstimate {
  periodStart:string; periodEnd:string; ovulation:string; fertileStart:string; fertileEnd:string; additionalDay:string;
  nextPeriod:string; testDate:string;
}
export class CalculatorInputError extends Error {
  readonly code: 'dateError'|'cycleError'|'dueDateError';
  constructor(code: 'dateError'|'cycleError'|'dueDateError') { super(code); this.code=code; }
}
function validCycle(cycle: number) { return Number.isInteger(cycle) && cycle >= 21 && cycle <= 45; }
export function estimateCycle(input: CycleInput, today = todayIso()): CycleEstimate {
  const start = parseCalendarDate(input.lastPeriod), current = parseCalendarDate(today);
  if (!start || !current || start > current) throw new CalculatorInputError('dateError');
  if (!validCycle(input.cycleLength) || !Number.isInteger(input.periodLength) || input.periodLength < 1 || input.periodLength > 10
    || !Number.isInteger(input.lutealLength) || input.lutealLength < 10 || input.lutealLength > 16) throw new CalculatorInputError('cycleError');
  const next = addCalendarDays(start,input.cycleLength), ovulation = addCalendarDays(next,-input.lutealLength);
  return {periodStart:calendarIso(start),periodEnd:calendarIso(addCalendarDays(start,input.periodLength-1)),ovulation:calendarIso(ovulation),
    fertileStart:calendarIso(addCalendarDays(ovulation,-5)),fertileEnd:calendarIso(ovulation),additionalDay:calendarIso(addCalendarDays(ovulation,1)),
    nextPeriod:calendarIso(next),testDate:calendarIso(next)};
}
export interface PregnancyEstimate { dueDate:string; elapsedDays:number; weeks:number; days:number; trimester:1|2|3; remainingDays:number }
export function estimatePregnancy(lastPeriod:string, cycleLength = 28, today = todayIso()): PregnancyEstimate {
  const start = parseCalendarDate(lastPeriod), current = parseCalendarDate(today);
  if (!start || !current || start > current) throw new CalculatorInputError('dateError');
  if (!validCycle(cycleLength)) throw new CalculatorInputError('cycleError');
  const elapsedDays = calendarDifference(current,start);
  if (elapsedDays > 315) throw new CalculatorInputError('dueDateError');
  const due = addCalendarDays(start,280+cycleLength-28), weeks = Math.floor(elapsedDays/7);
  return {dueDate:calendarIso(due),elapsedDays,weeks,days:elapsedDays%7,trimester:weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    remainingDays:calendarDifference(due,current)};
}
export interface CalendarEvent { date:string; endDate?:string; title:string; description:string; id:string }
function icsEscape(value:string) { return value.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'); }
export function makeCalendarFile(events:CalendarEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Anacan//Date estimates//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const event of events) {
    const start = parseCalendarDate(event.date), end = parseCalendarDate(event.endDate || event.date);
    if (!start || !end || end < start) throw new Error('CALENDAR_EVENT_DATE_INVALID');
    const uid = `anacan-${event.id.replace(/[^a-zA-Z0-9-]/g,'')}-${event.date.replace(/-/g,'')}@anacan.az`;
    lines.push('BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${event.date.replace(/-/g,'')}`,
      `DTEND;VALUE=DATE:${calendarIso(addCalendarDays(end,1)).replace(/-/g,'')}`,`SUMMARY:${icsEscape(event.title)}`,
      `DESCRIPTION:${icsEscape(event.description)}`,'TRANSP:TRANSPARENT','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 folds at 75 UTF-8 octets, including continuation whitespace.
  const encoder = new TextEncoder();
  return lines.map(line => {
    let output = '', column = 0;
    for (const character of line) {
      const bytes = encoder.encode(character).length;
      if (column+bytes > 75) { output+='\r\n '; column=1; }
      output+=character; column+=bytes;
    }
    return output;
  }).join('\r\n')+'\r\n';
}
