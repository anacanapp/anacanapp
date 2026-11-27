import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readCache, writeCache } from '@/lib/offlineCache';
import { __resetUsageRpcForTests, deviceTimeZone, useSubscription } from './useSubscription';
const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),freeLimits:vi.fn(),auth:{user:null as {id:string}|null,profile:null as any}}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:mocks.from,rpc:mocks.rpc}}));
vi.mock('./useAuth',()=>({useAuth:()=>mocks.auth}));
vi.mock('./useAppSettings',()=>({useAppSetting:mocks.freeLimits}));
vi.mock('@/integrations/supabase/backend-config',()=>({getBackendConfig:()=>({url:'https://api.anacan.az'})}));
function query(data:unknown){const execute=vi.fn().mockResolvedValue({data,error:null});return {execute,select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),update:vi.fn().mockReturnThis(),insert:vi.fn().mockReturnThis(),upsert:vi.fn().mockReturnThis(),maybeSingle:vi.fn(()=>execute()),then:(resolve:any,reject:any)=>execute().then(resolve,reject)};}
const premium={id:'sub-a',user_id:'user-a',plan_type:'premium',status:'active',started_at:'2026-09-01',expires_at:'2026-10-01T00:00:00Z'};
let client:QueryClient,subscriptions:ReturnType<typeof query>,usage:ReturnType<typeof query>,photos:ReturnType<typeof query>,own:boolean,household:boolean;
const wrapper=({children}:{children:ReactNode})=>createElement(QueryClientProvider,{client},children);
function grant(){return {protocol:'anacan-premium-access-v1',userId:mocks.auth.user?.id,own:{active:own,expiresAt:'2026-10-01T00:00:00Z',source:'subscription'},household:{active:household,expiresAt:'2026-10-01T00:00:00Z',source:'subscription'},checkedAt:new Date().toISOString(),validUntil:new Date(Date.now()+30000).toISOString()};}
beforeEach(()=>{
 vi.resetAllMocks();__resetUsageRpcForTests();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));localStorage.clear();
 own=true;household=false;mocks.auth.user={id:'user-a'};mocks.auth.profile={user_id:'user-a',linked_partner_id:null,is_premium:true,premium_until:null};
 client=new QueryClient({defaultOptions:{queries:{retry:false}}});subscriptions=query(premium);usage=query([]);photos=query(null);
 mocks.from.mockImplementation(table=>table==='subscriptions'?subscriptions:table==='usage_tracking'?usage:photos);
 mocks.rpc.mockImplementation(name=>Promise.resolve({data:name==='get_premium_access_v1'?grant():household,error:null}));
});
afterEach(()=>{cleanup();client.clear();localStorage.clear();vi.useRealTimers();process.env.TZ=originalTz;});
const originalTz=process.env.TZ;
it('deduplicates subscription, usage and current entitlement reads across consumers',async()=>{
 const first=renderHook(useSubscription,{wrapper}),second=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(second.result.current.loading).toBe(false));
 expect(subscriptions.execute).toHaveBeenCalledOnce();expect(usage.execute).toHaveBeenCalledOnce();expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_premium_access_v1',{p_user_id:'user-a'});expect(first.result.current.isPremium).toBe(true);
});
it('server revocation overrides an active cached row and a stale Premium profile',async()=>{
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.isPremium).toBe(true));own=false;
 await act(async()=>{await result.current.refetch();});await waitFor(()=>expect(result.current.isPremium).toBe(false));
 expect(result.current.subscription?.plan_type).toBe('premium');expect(mocks.auth.profile.is_premium).toBe(true);
});
it('never resurrects Premium from the old month-long offline cache',async()=>{
 writeCache('subscription','user-a',premium);writeCache('household_premium:partner-a','user-a',true);
 subscriptions.execute.mockRejectedValue(new Error('offline'));mocks.rpc.mockRejectedValue(new Error('offline'));
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.subscription).toEqual(premium);expect(result.current.isPremium).toBe(false);
});
it('clears a confirmed missing subscription from the display cache',async()=>{
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));own=false;subscriptions.execute.mockResolvedValue({data:null,error:null});
 await act(async()=>{await result.current.refetch();});expect(readCache('subscription','user-a')).toBeNull();await waitFor(()=>expect(result.current.isPremium).toBe(false));
});
it('does not leak entitlement or usage into a different account',async()=>{
 const {result,rerender}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.isPremium).toBe(true));
 mocks.auth.user={id:'user-b'};own=false;subscriptions.execute.mockResolvedValue({data:null,error:null});rerender();expect(result.current.isPremium).toBe(false);await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.subscription).toBeNull();expect(result.current.canUseWhiteNoise().remainingSeconds).toBe(1200);
});
it('rechecks household authority after an unlink instead of reusing a boolean cache',async()=>{
 own=false;household=true;mocks.auth.profile.linked_partner_id='partner-a';const {result,rerender}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.householdPremium).toBe(true));
 household=false;mocks.auth.profile={...mocks.auth.profile,linked_partner_id:null};rerender();expect(result.current.householdPremium).toBe(false);await waitFor(()=>expect(result.current.loading).toBe(false));
});
it.each([['active',true,false],['cancelled',true,true],['cancelled',false,false],['expired',false,false]])('represents %s with live access %s',async(status,active,cancelledActive)=>{
 own=active as boolean;subscriptions.execute.mockResolvedValue({data:{...premium,status},error:null});const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.ownPremium).toBe(active);expect(result.current.cancelledButActive).toBe(cancelledActive);
});
it('refreshes daily free usage without fabricating unlimited access',async()=>{
 own=false;mocks.freeLimits.mockReturnValue({white_noise_seconds_per_day:100});usage.execute.mockResolvedValue({data:[{id:'usage-a',user_id:'user-a',feature_type:'white_noise',usage_seconds:40}],error:null});
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.canUseWhiteNoise()).toEqual({allowed:true,remainingSeconds:60});
 await act(async()=>{await result.current.trackWhiteNoiseUsage(5);});expect(mocks.rpc).toHaveBeenCalledWith('usage_add_seconds_v1',{p_seconds:5,p_time_zone:deviceTimeZone()});expect(usage.update).not.toHaveBeenCalled();
});
it('adds white noise seconds through the legacy table path on an old server',async()=>{
 own=false;mocks.freeLimits.mockReturnValue({white_noise_seconds_per_day:100});usage.execute.mockResolvedValue({data:[{id:'usage-a',user_id:'user-a',feature_type:'white_noise',usage_seconds:40}],error:null});
 mocks.rpc.mockImplementation(name=>Promise.resolve(name==='usage_add_seconds_v1'?{data:null,error:{code:'PGRST202',message:'Could not find the function'},status:404}:{data:name==='get_premium_access_v1'?grant():household,error:null}));
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));
 await act(async()=>{await result.current.trackWhiteNoiseUsage(5);});expect(usage.update).toHaveBeenCalledWith({usage_seconds:45});
});
it('uses a new usage scope after UTC midnight',async()=>{
 own=false;const {result,rerender}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));vi.setSystemTime(new Date('2026-09-11T00:00:00Z'));rerender();await waitFor(()=>expect(usage.execute).toHaveBeenCalledTimes(2));expect(usage.eq).toHaveBeenCalledWith('usage_date','2026-09-11');
});
it('has no paid capability or backend requests while signed out',async()=>{
 mocks.auth.user=null;const {result}=renderHook(useSubscription,{wrapper});expect(result.current.isPremium).toBe(false);await result.current.refetch();expect(mocks.from).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();expect(await result.current.checkAndConsume('ai_chat')).toMatchObject({allowed:false});
});

function consumeRpc(result:unknown){mocks.rpc.mockImplementation((name,args)=>Promise.resolve(name==='usage_consume_v1'?(typeof result==='function'?(result as any)(args):result):{data:name==='get_premium_access_v1'?grant():household,error:null}));}
it('consumes a free daily use atomically on the server with the phone time zone',async()=>{
 own=false;consumeRpc({data:{allowed:true,used:2,limit:3,usage_date:'2026-09-10'},error:null});
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));
 await expect(result.current.checkAndConsume('cry_translator')).resolves.toEqual({allowed:true,remaining:1,limit:3});
 expect(mocks.rpc).toHaveBeenCalledWith('usage_consume_v1',{p_feature:'cry_translator',p_time_zone:deviceTimeZone()});
 expect(usage.update).not.toHaveBeenCalled();expect(usage.upsert).not.toHaveBeenCalled();
});
it('reports the server refusal without writing the counter',async()=>{
 own=false;consumeRpc({data:{allowed:false,used:2,limit:2},error:null});
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));
 await expect(result.current.checkAndConsume('horoscope')).resolves.toEqual({allowed:false,remaining:0,limit:2});expect(usage.update).not.toHaveBeenCalled();
});
it('keeps the premium bypass without any usage call',async()=>{
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.isPremium).toBe(true));
 await expect(result.current.checkAndConsume('ai_chat')).resolves.toMatchObject({allowed:true,remaining:Infinity});expect(mocks.rpc).not.toHaveBeenCalledWith('usage_consume_v1',expect.anything());
});
it('falls back to the old table path with the local day when the server has no RPC',async()=>{
 process.env.TZ='Asia/Baku';vi.setSystemTime(new Date('2026-09-10T21:30:00Z')); // 01:30 on 11 Sep in Baku
 own=false;consumeRpc({data:null,error:{code:'PGRST202',message:'Could not find the function public.usage_consume_v1'},status:404});usage.execute.mockResolvedValue({data:null,error:null});
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(usage.eq).toHaveBeenCalledWith('usage_date','2026-09-11');
 await expect(result.current.checkAndConsume('poop_scanner')).resolves.toMatchObject({allowed:true,limit:3});
 expect(usage.upsert).toHaveBeenCalledWith(expect.objectContaining({feature_type:'poop_scanner',usage_date:'2026-09-11',usage_count:1}),{onConflict:'user_id,feature_type,usage_date'});
 // the missing RPC is remembered for the session
 mocks.rpc.mockClear();await result.current.checkAndConsume('poop_scanner');expect(mocks.rpc).not.toHaveBeenCalledWith('usage_consume_v1',expect.anything());
});
it('does not block the user when the server cannot be reached',async()=>{
 own=false;consumeRpc({data:null,error:{message:'Failed to fetch'},status:0});
 const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));
 await expect(result.current.checkAndConsume('ai_chat')).resolves.toMatchObject({allowed:true});expect(usage.upsert).not.toHaveBeenCalled();
});
it('keys the daily usage read by the local calendar day, not UTC',async()=>{
 process.env.TZ='Asia/Baku';vi.setSystemTime(new Date('2026-09-10T20:30:00Z')); // 00:30 on 11 Sep in Baku, still 10 Sep in UTC
 own=false;const {result}=renderHook(useSubscription,{wrapper});await waitFor(()=>expect(result.current.loading).toBe(false));expect(usage.eq).toHaveBeenCalledWith('usage_date','2026-09-11');
 expect(deviceTimeZone()).toBe('Asia/Baku');
});
