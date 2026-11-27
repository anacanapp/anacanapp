import { WHO_GROWTH_LMS } from './who-growth-lms';

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

/** Errors of the newer free tools; messages live in the bundled tools content, not in copy JSON. */
export type ToolErrorCode = 'measureError'|'weekError'|'ageError';
export class ToolInputError extends Error {
  readonly code: ToolErrorCode;
  constructor(code: ToolErrorCode) { super(code); this.code=code; }
}
const finiteBetween=(value:number,min:number,max:number)=>Number.isFinite(value)&&value>=min&&value<=max;
// The tiny offset keeps binary halves such as 2.95 (stored as 2.9499...) rounding up.
const round1=(value:number)=>Math.round(value*10+1e-9)/10;

/* Pregnancy weight gain: Institute of Medicine (IOM, now National Academy of Medicine) 2009,
 * "Weight Gain During Pregnancy: Reexamining the Guidelines", Table S-1. BMI uses the WHO cut-offs;
 * first-trimester gain is assumed to be 0.5-2 kg, then the weekly 2nd/3rd trimester rate applies.
 * Twin ranges are the IOM provisional ranges (no weekly rate and no underweight range published). */
export type BmiCategory='underweight'|'normal'|'overweight'|'obese';
export const IOM_2009:Record<BmiCategory,{total:[number,number];rate:[number,number];twins:[number,number]|null}>={
  underweight:{total:[12.5,18],rate:[0.44,0.58],twins:null},
  normal:{total:[11.5,16],rate:[0.35,0.5],twins:[17,25]},
  overweight:{total:[7,11.5],rate:[0.23,0.33],twins:[14,23]},
  obese:{total:[5,9],rate:[0.17,0.27],twins:[11,19]},
};
export const FIRST_TRIMESTER_GAIN:[number,number]=[0.5,2];
export interface PregnancyWeightInput { preWeightKg:number; heightCm:number; currentWeightKg:number; week:number; twins:boolean }
export interface PregnancyWeightEstimate {
  bmi:number; category:BmiCategory; totalRange:[number,number]|null; weeklyRate:[number,number]|null;
  weekRange:[number,number]|null; gain:number; position:'below'|'within'|'above'|null;
}
export function bmiCategory(bmi:number):BmiCategory { return bmi<18.5?'underweight':bmi<25?'normal':bmi<30?'overweight':'obese'; }
/** Recommended cumulative gain range (kg) at a completed pregnancy week for a singleton pregnancy. */
export function recommendedGainAtWeek(category:BmiCategory,week:number):[number,number] {
  const [low,high]=FIRST_TRIMESTER_GAIN,[rateLow,rateHigh]=IOM_2009[category].rate;
  if(week<=13)return [round1(low*week/13),round1(high*week/13)];
  return [round1(low+rateLow*(week-13)),round1(high+rateHigh*(week-13))];
}
export function estimatePregnancyWeight(input:PregnancyWeightInput):PregnancyWeightEstimate {
  const {preWeightKg,heightCm,currentWeightKg,week,twins}=input;
  if(!finiteBetween(preWeightKg,30,250)||!finiteBetween(heightCm,120,220)||!finiteBetween(currentWeightKg,30,300))throw new ToolInputError('measureError');
  if(!Number.isInteger(week)||week<1||week>42)throw new ToolInputError('weekError');
  // BMI is rounded to one decimal before classification so the shown value and the category agree.
  const bmi=round1(preWeightKg/((heightCm/100)**2)),category=bmiCategory(bmi),guide=IOM_2009[category],gain=round1(currentWeightKg-preWeightKg);
  if(twins)return {bmi,category,totalRange:guide.twins,weeklyRate:null,weekRange:null,gain,position:null};
  const weekRange=recommendedGainAtWeek(category,week);
  return {bmi,category,totalRange:guide.total,weeklyRate:guide.rate,weekRange,gain,position:gain<weekRange[0]?'below':gain>weekRange[1]?'above':'within'};
}

/* Conception date. From the last period: ovulation (and so conception) is estimated 14 days before the
 * next expected period, i.e. LMP + cycle length - 14 (day 14 of a 28-day cycle). From a due date:
 * Naegele's rule dates the due date 280 days after the LMP, i.e. 266 days after conception. The likely
 * conception window is +/-2 days; the fertile window is the 6 days ending on ovulation day. */
export interface ConceptionInput { from:'lmp'|'due'; date:string; cycleLength:number }
export interface ConceptionEstimate { conception:string; windowStart:string; windowEnd:string; fertileStart:string; fertileEnd:string; dueDate:string; lastPeriod:string }
export function estimateConception(input:ConceptionInput,today=todayIso()):ConceptionEstimate {
  const current=parseCalendarDate(today);
  if(!current)throw new CalculatorInputError('dateError');
  let conception:Date,lastPeriod:Date,due:Date;
  if(input.from==='lmp'){
    // Reuses the ovulation estimate (luteal phase 14 days) with its date and cycle validation.
    const cycle=estimateCycle({lastPeriod:input.date,cycleLength:input.cycleLength,periodLength:5,lutealLength:14},today);
    lastPeriod=parseCalendarDate(cycle.periodStart)!;conception=parseCalendarDate(cycle.ovulation)!;
    due=addCalendarDays(lastPeriod,280+input.cycleLength-28);
  }else{
    const value=parseCalendarDate(input.date);
    if(!value)throw new CalculatorInputError('dateError');
    if(calendarDifference(value,current)>300||calendarDifference(current,value)>366*3)throw new CalculatorInputError('dueDateError');
    due=value;conception=addCalendarDays(due,-266);lastPeriod=addCalendarDays(due,-280);
  }
  return {conception:calendarIso(conception),windowStart:calendarIso(addCalendarDays(conception,-2)),windowEnd:calendarIso(addCalendarDays(conception,2)),
    fertileStart:calendarIso(addCalendarDays(conception,-5)),fertileEnd:calendarIso(conception),dueDate:calendarIso(due),lastPeriod:calendarIso(lastPeriod)};
}

/* Period calendar: the ovulation estimate of `estimateCycle` repeated for the following cycles. */
export function shiftCycle(estimate:CycleEstimate,days:number):CycleEstimate {
  return Object.fromEntries(Object.entries(estimate).map(([key,value])=>[key,calendarIso(addCalendarDays(parseCalendarDate(value)!,days))])) as unknown as CycleEstimate;
}
/** `count` consecutive cycles. The first one starts on the last period, or, when that period is older
 * than one cycle, on the latest expected period on or before today, so the list always shows the
 * upcoming periods. */
export function estimatePeriodCalendar(input:CycleInput,count=6,today=todayIso()):CycleEstimate[] {
  const first=estimateCycle(input,today),late=calendarDifference(parseCalendarDate(today)!,parseCalendarDate(first.nextPeriod)!);
  const skipped=late>0?Math.ceil(late/input.cycleLength):0;
  return Array.from({length:count},(_,index)=>shiftCycle(first,(skipped+index)*input.cycleLength));
}

/* Baby growth: WHO Child Growth Standards (2006), LMS method with the WHO restricted z-score
 * beyond +/-3 SD (WHO technical report chapter 7, as implemented in WHO's `anthro` package). */
export type GrowthIndicator='weight'|'length'|'head';
export type GrowthSex='male'|'female';
export interface Lms { l:number; m:number; s:number }
export const GROWTH_MAX_DAYS=1096;
export function whoLms(indicator:GrowthIndicator,sex:GrowthSex,ageDays:number):Lms {
  const table=WHO_GROWTH_LMS[indicator][sex];
  if(!Number.isFinite(ageDays)||ageDays<0||ageDays>GROWTH_MAX_DAYS)throw new ToolInputError('ageError');
  if(ageDays===0)return {l:table[1],m:table[2],s:table[3]};
  for(let index=4;index<table.length;index+=4){
    if(table[index]<ageDays)continue;
    const leftDay=table[index-4],ratio=(ageDays-leftDay)/(table[index]-leftDay);
    const at=(offset:number)=>table[index-4+offset]+(table[index+offset]-table[index-4+offset])*ratio;
    return {l:at(1),m:at(2),s:at(3)};
  }
  throw new ToolInputError('ageError');
}
export function lmsValue({l,m,s}:Lms,z:number):number { return l===0?m*Math.exp(s*z):m*(1+l*s*z)**(1/l); }
export function whoZScore(value:number,lms:Lms):number {
  const {l,m,s}=lms,z=l===0?Math.log(value/m)/s:((value/m)**l-1)/(l*s);
  if(z>3){const sd3=lmsValue(lms,3);return 3+(value-sd3)/(sd3-lmsValue(lms,2));}
  if(z<-3){const sd3=lmsValue(lms,-3);return -3+(value-sd3)/(lmsValue(lms,-2)-sd3);}
  return z;
}
/** Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(z:number):number {
  const x=Math.abs(z)/Math.SQRT2,t=1/(1+0.3275911*x);
  const erf=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return z>=0?(1+erf)/2:(1-erf)/2;
}
export interface GrowthInput { indicator:GrowthIndicator; sex:GrowthSex; birthDate:string; measureDate:string; value:number }
export interface GrowthEstimate { ageDays:number; ageMonths:number; ageRestDays:number; z:number; percentile:number; median:number }
const GROWTH_LIMITS:Record<GrowthIndicator,[number,number]>={weight:[0.5,35],length:[35,130],head:[25,60]};
export function estimateGrowth(input:GrowthInput,today=todayIso()):GrowthEstimate {
  const birth=parseCalendarDate(input.birthDate),measured=parseCalendarDate(input.measureDate),current=parseCalendarDate(today);
  if(!birth||!measured||!current||birth>measured||measured>current)throw new CalculatorInputError('dateError');
  const ageDays=calendarDifference(measured,birth);
  if(ageDays>GROWTH_MAX_DAYS)throw new ToolInputError('ageError');
  if(!finiteBetween(input.value,...GROWTH_LIMITS[input.indicator]))throw new ToolInputError('measureError');
  const lms=whoLms(input.indicator,input.sex,ageDays),z=Math.round(whoZScore(input.value,lms)*100)/100;
  // Completed months use the WHO average month of 30.4375 days.
  const ageMonths=Math.floor(ageDays/30.4375);
  return {ageDays,ageMonths,ageRestDays:ageDays-Math.floor(ageMonths*30.4375),z,percentile:normalCdf(z)*100,median:lms.m};
}
/** Reference curve points [age in days, value] for the chart. */
export function whoCurve(indicator:GrowthIndicator,sex:GrowthSex,z:number,maxDays:number,step=14):Array<[number,number]> {
  const points:Array<[number,number]>=[];
  for(let day=0;day<maxDays;day+=step)points.push([day,lmsValue(whoLms(indicator,sex,day),z)]);
  points.push([maxDays,lmsValue(whoLms(indicator,sex,maxDays),z)]);
  return points;
}
