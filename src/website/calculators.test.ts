import { describe,it,expect } from 'vitest';
import { estimateCycle,estimatePregnancy,makeCalendarFile,parseCalendarDate } from './calculators';

describe('public calendar estimates',()=>{
  it('handles leap days and cycle/luteal settings using calendar dates',()=>{
    const result=estimateCycle({lastPeriod:'2024-02-20',cycleLength:28,periodLength:5,lutealLength:14},'2024-03-01');
    expect(result.ovulation).toBe('2024-03-05');expect(result.nextPeriod).toBe('2024-03-19');expect(result.fertileStart).toBe('2024-02-29');
    expect(estimateCycle({lastPeriod:'2026-09-20',cycleLength:31,periodLength:4,lutealLength:12},'2026-10-06').ovulation).toBe('2026-10-09');
  });
  it('rejects impossible dates, future dates, fractional and missing inputs',()=>{
    expect(parseCalendarDate('2026-02-29')).toBeNull();expect(parseCalendarDate('2026-04-31')).toBeNull();
    expect(()=>estimateCycle({lastPeriod:'2026-10-07',cycleLength:28,periodLength:5,lutealLength:14},'2026-10-06')).toThrow('dateError');
    for(const value of [0,20,46,28.5,NaN])expect(()=>estimateCycle({lastPeriod:'2026-09-20',cycleLength:value,periodLength:5,lutealLength:14},'2026-10-06')).toThrow('cycleError');
  });
  it('does not drift across DST boundaries',()=>{
    const old=process.env.TZ;process.env.TZ='America/New_York';
    try{expect(estimateCycle({lastPeriod:'2026-03-01',cycleLength:28,periodLength:5,lutealLength:14},'2026-03-20').ovulation).toBe('2026-03-15');
      expect(estimatePregnancy('2026-03-01',28,'2026-03-15')).toMatchObject({weeks:2,days:0,elapsedDays:14});}finally{process.env.TZ=old;}
  });
  it('keeps actual pregnancy age and adjusts due date for a regular cycle',()=>{
    expect(estimatePregnancy('2026-09-01',28,'2026-10-06')).toMatchObject({dueDate:'2027-06-08',weeks:5,days:0,trimester:1});
    expect(estimatePregnancy('2026-09-01',31,'2026-10-06').dueDate).toBe('2027-06-11');
    expect(()=>estimatePregnancy('2025-01-01',28,'2026-10-06')).toThrow('dueDateError');
  });
  it('exports all-day events with exclusive end dates, escaped values and UTF-8 folding',()=>{
    const content=makeCalendarFile([{date:'2026-10-01',endDate:'2026-10-06',title:'Qayğı, birlikdə; öyrənilir',description:'ö'.repeat(100)+'\nNext',id:'fertile'}],new Date('2026-10-06T12:00:00Z'));
    expect(content).toContain('DTEND;VALUE=DATE:20261007');expect(content).toContain('Qayğı\\, birlikdə\\; öyrənilir');expect(content).toContain('DTSTAMP:20261006T120000Z');
    for(const line of content.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(content.replace(/\r\n /g,'')).toContain('\\nNext');
  });
});
