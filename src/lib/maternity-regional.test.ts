import { expect, it } from 'vitest';
import { format } from 'date-fns';
import { calculateRegionalMaternity as calculate, REGIONAL_MATERNITY_COUNTRIES } from './maternity-regional';
const dueDate = '2026-12-01';
it('has one explicit regional rule for each of the twelve expansion countries', () => {
 expect([...REGIONAL_MATERNITY_COUNTRIES].sort()).toEqual(['CN','ES','FR','ID','IN','JP','KR','NL','PL','PT','SE','VN']);
});
it('keeps the Chinese national floor separate from provincial money and adds only specified extensions', () => {
 expect(calculate({ country:'CN',dueDate,earnings:[20000] })).toMatchObject({ days:98,money:null,agency:true });
 expect(calculate({ country:'CN',dueDate,birthCount:2,complicated:true }).days).toBe(128);
});
it('uses actual calendar months and the certified Indonesian staged wage rule', () => {
 const normal = calculate({country:'ID',dueDate:'2026-08-15',earnings:[10000000]});
 expect(normal.months).toBe(3);expect(normal.days).toBe(92);expect(format(normal.end,'yyyy-MM-dd')).toBe('2026-11-14');expect(normal.money).toBe(30000000);
 expect(calculate({country:'ID',dueDate,certifiedExtraMonths:3,earnings:[10000000]}).money).toBe(55000000);
 expect(() => calculate({country:'ID',dueDate,certifiedExtraMonths:4})).toThrow();
});
it('applies French family-size periods, salary ceilings and year-bound cash limits', () => {
 expect(calculate({country:'FR',dueDate,earnings:[8000,8000,8000]})).toMatchObject({days:112,daily:104.02,money:11650.24});
 expect(calculate({country:'FR',dueDate,earnings:[8000,8000,1000]}).daily).toBe(78);
 expect(calculate({country:'FR',dueDate,existingChildren:2}).days).toBe(182);
 expect(calculate({country:'FR',dueDate,birthCount:2}).days).toBe(238);
 expect(calculate({country:'FR',dueDate,birthCount:3}).days).toBe(322);
 expect(calculate({country:'FR',dueDate:'2028-12-01',earnings:[4000,4000,4000]})).toMatchObject({money:null,yearUnsupported:true});
});
it('distinguishes Spain first-year and later flexible weeks, including a sole parent', () => {
 expect(calculate({country:'ES',dueDate,earnings:[50]})).toMatchObject({days:119,entitlementDays:133,money:5950});
 expect(calculate({country:'ES',dueDate,includeFlexible:true}).days).toBe(133);
 expect(calculate({country:'ES',dueDate,soleParent:true})).toMatchObject({days:196,entitlementDays:224});
 expect(calculate({country:'ES',dueDate,soleParent:true,birthCount:2,includeFlexible:true}).days).toBe(238);
 expect(() => calculate({country:'ES',dueDate:'2025-01-01'})).toThrow(/DATE_UNSUPPORTED/);
});
it('does not price the other Portuguese parent leave with the claimant wage', () => {
 expect(calculate({country:'PT',dueDate,earnings:[1350]})).toMatchObject({days:120,daily:45,money:5400});
 expect(calculate({country:'PT',dueDate,portuguesePlan:'shared150',earnings:[1350]})).toMatchObject({days:120,entitlementDays:150,money:5400});
 expect(calculate({country:'PT',dueDate,portuguesePlan:'shared180-90',earnings:[1350]})).toMatchObject({days:120,entitlementDays:180,daily:40.5,money:4860});
 expect(() => calculate({country:'PT',dueDate,portuguesePlan:'shared150',ownDays:150})).toThrow(/PERSONAL_DAYS/);
 expect(calculate({country:'PT',dueDate,birthCount:2,earnings:[1350]})).toMatchObject({agency:true,money:null});
});
it('values Vietnamese leave in insured months and handles a leap-year calendar', () => {
 const value = calculate({country:'VN',dueDate:'2028-01-15',birthCount:2,earnings:[10000000]});
 expect(value.months).toBe(7);expect(value.money).toBe(70000000);expect(format(value.end,'yyyy-MM-dd')).toBe('2028-08-14');expect(value.days).not.toBe(210);
 expect(() => calculate({country:'VN',dueDate,startDate:'2026-08-01'})).toThrow(/START_OUTSIDE/);
});
it('uses India surviving-child rule rather than automatically extending for twins', () => {
 expect(calculate({country:'IN',dueDate,birthCount:2,earnings:[500]})).toMatchObject({days:182,money:91000});
 expect(calculate({country:'IN',dueDate,existingChildren:2})).toMatchObject({days:84,before:42});
});
it('reproduces the Japanese insurer rounding example and its birth-day convention', () => {
 const result = calculate({country:'JP',dueDate,earnings:[170000]});
 expect(result).toMatchObject({days:98,daily:3780,money:370440});expect(format(result.start,'yyyy-MM-dd')).toBe('2026-10-21');expect(format(result.end,'yyyy-MM-dd')).toBe('2027-01-26');
 expect(calculate({country:'JP',dueDate,earnings:[400000],shortInsuranceJapan:true,paidSalaryDaily:1000}).daily).toBe(6113);
 const partial = calculate({country:'JP',dueDate,startDate:dueDate,earnings:[170000]});expect(partial.days).toBe(57);expect(format(partial.end,'yyyy-MM-dd')).toBe('2027-01-26');
});
it('preserves Korean premature/multiple minima and never fabricates the mixed insurance award', () => {
 expect(calculate({country:'KR',dueDate})).toMatchObject({days:90,agency:true,money:null});
 expect(calculate({country:'KR',dueDate,premature:true}).days).toBe(100);
 expect(calculate({country:'KR',dueDate,birthCount:2,premature:true})).toMatchObject({days:120,before:60});
});
it('uses Polish maternity durations and treats the combined allowance option separately', () => {
 expect([1,2,3,4,5].map(birthCount=>calculate({country:'PL',dueDate,birthCount}).days)).toEqual([140,217,231,245,259]);
 expect(calculate({country:'PL',dueDate,earnings:[100],combinedPoland:true}).money).toBe(11410);
});
it('uses UWV due-date counting and a valid prenatal window without an uncapped salary estimate', () => {
 const value=calculate({country:'NL',dueDate,earnings:[5000]});expect(value).toMatchObject({days:112,agency:true,money:null});expect(format(value.start,'yyyy-MM-dd')).toBe('2026-10-21');
 expect(calculate({country:'NL',dueDate,birthCount:2}).days).toBe(140);expect(()=>calculate({country:'NL',dueDate,startDate:'2026-11-25'})).toThrow(/START_OUTSIDE/);
});
it('keeps Swedish family allocation distinct from a person selected benefit days', () => {
 expect(calculate({country:'SE',dueDate,earnings:[800]})).toMatchObject({days:240,entitlementDays:480,incomeDays:195,minimumDays:45,money:164100});
 expect(calculate({country:'SE',dueDate,birthCount:2,soleParent:true})).toMatchObject({days:660,entitlementDays:660});
 expect(()=>calculate({country:'SE',dueDate,swedenIncomeDays:391})).toThrow(/PERSONAL_DAYS/);
});
it('rejects malformed dates and nonfinite or negative earnings', () => {
 expect(()=>calculate({country:'FR',dueDate:'2026-02-30'})).toThrow(/DATE_INVALID/);
 for(const amount of [NaN,Infinity,-1])expect(()=>calculate({country:'PL',dueDate,earnings:[amount]})).toThrow(/INPUT_INVALID/);
});
