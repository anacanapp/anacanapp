import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PremiumEntitlementMonitor, usePremiumEntitlement } from './usePremiumEntitlement';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';
const mocks = vi.hoisted(() => ({ actor: 'a' as string | null, backend: 'https://api.anacan.az', rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc,
 channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn().mockResolvedValue(undefined),
} }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: mocks.backend }) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mocks.actor ? { id: mocks.actor } : null, profile: { is_premium: true } }) }));
let client: QueryClient;
const now = '2026-09-25T12:00:00.000Z';
function access(own: boolean, household = false, expiry = '2026-10-25T12:00:00Z') { return { protocol:'anacan-premium-access-v1', userId:mocks.actor, own:{active:own,expiresAt:expiry,source:'subscription'}, household:{active:household,expiresAt:expiry,source:'subscription'}, checkedAt:now,validUntil:'2026-09-25T12:00:30Z' }; }
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const settle = async (ms = 5) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); mocks.actor='a'; mocks.backend='https://api.anacan.az'; mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({data:access(true),error:null}); client=new QueryClient({defaultOptions:{queries:{retry:false}}}); localStorage.clear(); });
afterEach(() => { cleanup(); useWhiteNoiseStore.getState().stop(); client.clear(); vi.useRealTimers(); });
it('shares a bounded server grant and ignores stale local/profile Premium booleans', async () => {
 localStorage.setItem('anacan_ocache_v1:subscription',JSON.stringify({userId:'a',savedAt:Date.now(),data:{plan_type:'premium'}}));
 mocks.rpc.mockResolvedValue({data:access(false),error:null});const first=renderHook(()=>usePremiumEntitlement(),{wrapper});renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();
 expect(first.result.current.isPremium).toBe(false);expect(first.result.current.ready).toBe(true);expect(mocks.rpc).toHaveBeenCalledOnce();
});
it('locks at exact own expiry without navigation or another network response', async () => {
 mocks.rpc.mockResolvedValue({data:access(true,false,'2026-09-25T12:00:01Z'),error:null});const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(true);
 await settle(1001);expect(result.current.isPremium).toBe(false);expect(mocks.rpc).toHaveBeenCalledOnce();
});
it('keeps a confirmed household grant past the short lease but never beyond the 72h offline window', async () => {
 mocks.rpc.mockResolvedValue({data:access(false,true),error:null});const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.householdPremium).toBe(true);
 await settle(30001);expect(result.current.householdPremium).toBe(true);
 await settle(72*3600*1000);expect(result.current.isPremium).toBe(false);
});
it('uses a monotonic deadline even if the device clock moves backwards', async () => {
 mocks.rpc.mockResolvedValue({data:access(true,false,'2026-09-25T12:00:01Z'),error:null});
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(true);vi.setSystemTime(new Date('2020-01-01'));await settle(1001);expect(result.current.isPremium).toBe(false);
});
it('applies a confirmed refund immediately and a later network error cannot restore it', async () => {
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(true);
 mocks.rpc.mockResolvedValue({data:access(false),error:null});await act(async()=>{await result.current.refresh();});await settle();expect(result.current.isPremium).toBe(false);
 mocks.rpc.mockResolvedValue({data:null,error:{code:'NETWORK'}});await act(async()=>{await result.current.refresh();});await settle();expect(result.current.isPremium).toBe(false);
});
it('a failed refresh keeps a confirmed grant offline until min(expiry, last confirmation + 72h) and never beyond', async () => {
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();mocks.rpc.mockRejectedValue(new Error('offline'));await act(async()=>{await result.current.refresh();});await settle(30001);
 expect(result.current.isPremium).toBe(true);expect(result.current.error).toBe(true);expect(result.current.revoked).toBe(false);
 await settle(72*3600*1000);expect(result.current.isPremium).toBe(false);
});
it('a cold start offline uses the stored confirmed grant; an explicit inactive answer revokes it', async () => {
 const first=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(first.result.current.isPremium).toBe(true);first.unmount();client.clear();
 mocks.rpc.mockRejectedValue(new Error('offline'));const offline=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();
 expect(offline.result.current.isPremium).toBe(true);expect(offline.result.current.revoked).toBe(false);offline.unmount();client.clear();
 mocks.rpc.mockResolvedValue({data:access(false),error:null});const online=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(online.result.current.isPremium).toBe(false);online.unmount();client.clear();
 mocks.rpc.mockRejectedValue(new Error('offline'));const later=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(later.result.current.isPremium).toBe(false);
});
it('never creates a grant from storage that the server did not confirm for this account and backend', async () => {
 localStorage.setItem('anacan_premium_grant_v1:https://api.anacan.az:a',JSON.stringify({backend:'https://source.example',userId:'a',partner:null,confirmedAt:Date.now(),ownUntil:Date.now()+1e9,householdUntil:0,ownSource:null}));
 localStorage.setItem('anacan_premium_grant_v1:https://api.anacan.az:b',JSON.stringify({backend:'https://api.anacan.az',userId:'b',partner:null,confirmedAt:Date.now(),ownUntil:Date.now()+1e9,householdUntil:0,ownSource:null}));
 mocks.rpc.mockRejectedValue(new Error('offline'));const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(false);
});
it('does not stop background white noise on a network error while a confirmed grant is valid', async () => {
 renderHook(()=>PremiumEntitlementMonitor(),{wrapper});await settle();
 await act(async()=>{useWhiteNoiseStore.setState({isPlaying:true,activeSoundId:'fixture',_audioElement:{pause:vi.fn(),src:'x'} as unknown as HTMLAudioElement});});
 mocks.rpc.mockRejectedValue(new Error('timeout'));await act(async()=>{await client.invalidateQueries();});await settle(30001);
 expect(useWhiteNoiseStore.getState().isPlaying).toBe(true);
});
it.each(['actor','backend'])('does not reuse cached entitlements across a %s change', async boundary => {
 const {result,rerender}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(true);
 if(boundary==='actor')mocks.actor='b';else mocks.backend='https://source.example';mocks.rpc.mockReturnValue(new Promise(()=>{}));rerender();expect(result.current.isPremium).toBe(false);
});
it('rejects grants belonging to another account or with an unbounded lease', async () => {
 mocks.rpc.mockResolvedValue({data:{...access(true),userId:'someone-else'},error:null});const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(false);
 mocks.rpc.mockResolvedValue({data:{...access(true),validUntil:'2027-01-01T00:00:00Z'},error:null});await act(async()=>{await result.current.refresh();});await settle();expect(result.current.isPremium).toBe(false);
});
it('never requests or grants access when signed out', async () => {
 mocks.actor=null;const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each(['expiry','refund'])('stops global background white noise on %s even when its tool is not mounted', async reason => {
 mocks.rpc.mockResolvedValue({data:access(true,false,'2026-09-25T12:00:01Z'),error:null});
 renderHook(()=>PremiumEntitlementMonitor(),{wrapper});await settle();
 const pause=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined);
 const audio={pause,src:'https://example.invalid/sound.mp3'};
 await act(async()=>{useWhiteNoiseStore.setState({isPlaying:true,activeSoundId:'fixture',
  ...(reason==='expiry'?{_audioElement:audio as any}:{_noiseSource:{stop} as any,_audioContext:{close} as any}),
 });});
 expect(useWhiteNoiseStore.getState().isPlaying).toBe(true);
 if(reason==='expiry')await settle(1001);
 else{mocks.rpc.mockResolvedValue({data:access(false),error:null});await act(async()=>{await client.invalidateQueries();});await settle();}
 expect(useWhiteNoiseStore.getState().isPlaying).toBe(false);
 if(reason==='expiry'){expect(pause).toHaveBeenCalledOnce();expect(audio.src).toBe('');}
 else{expect(stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();}
});
it('does not poll the lease: the monitor re-reads on resume, explicit invalidation and every 10 minutes', async () => {
 renderHook(()=>usePremiumEntitlement(true),{wrapper});await settle();expect(mocks.rpc).toHaveBeenCalledTimes(1);
 // Mounting more consumers within the 60s freshness window shares the answer.
 renderHook(()=>usePremiumEntitlement(),{wrapper});await settle(30_000);expect(mocks.rpc).toHaveBeenCalledTimes(1);
 await settle(5*60_000);expect(mocks.rpc).toHaveBeenCalledTimes(1);
 await settle(5*60_000);expect(mocks.rpc).toHaveBeenCalledTimes(2);
 // A purchase/restore/promo invalidates immediately.
 await act(async()=>{await client.invalidateQueries({queryKey:['premium-access-v1']});});await settle();expect(mocks.rpc).toHaveBeenCalledTimes(3);
 // App resume (visibility) re-reads at once.
 await settle(3000);await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});await settle();expect(mocks.rpc).toHaveBeenCalledTimes(4);
});
it('turns a hung entitlement request into an error instead of an endless loading state', async () => {
 mocks.rpc.mockReturnValue(new Promise(()=>{}));const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();
 expect(result.current.loading).toBe(true);await settle(15_001);expect(result.current.loading).toBe(false);expect(result.current.error).toBe(true);
});
