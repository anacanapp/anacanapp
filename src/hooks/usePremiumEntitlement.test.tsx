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
it('expires a household lease as well and never keeps a boolean grant for days offline', async () => {
 mocks.rpc.mockResolvedValue({data:access(false,true),error:null});const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.householdPremium).toBe(true);
 await settle(30001);expect(result.current.isPremium).toBe(false);
});
it('uses a monotonic deadline even if the device clock moves backwards', async () => {
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();vi.setSystemTime(new Date('2020-01-01'));await settle(30001);expect(result.current.isPremium).toBe(false);
});
it('applies a confirmed refund immediately and a later network error cannot restore it', async () => {
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();expect(result.current.isPremium).toBe(true);
 mocks.rpc.mockResolvedValue({data:access(false),error:null});await act(async()=>{await result.current.refresh();});await settle();expect(result.current.isPremium).toBe(false);
 mocks.rpc.mockResolvedValue({data:null,error:{code:'NETWORK'}});await act(async()=>{await result.current.refresh();});await settle();expect(result.current.isPremium).toBe(false);
});
it('a failed refresh cannot extend the last successful grant', async () => {
 const {result}=renderHook(()=>usePremiumEntitlement(),{wrapper});await settle();mocks.rpc.mockRejectedValue(new Error('offline'));await act(async()=>{await result.current.refresh();});await settle(30001);expect(result.current.isPremium).toBe(false);
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
