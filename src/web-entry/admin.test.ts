import { afterEach, expect, it, vi } from 'vitest';
import { verifyAdminSession } from './admin';
vi.mock('@/integrations/supabase/client', () => ({ supabase:{} }));
afterEach(() => vi.restoreAllMocks());
function client({ session=true,user=true,role=true,error=false }: { session?:boolean;user?:boolean;role?:boolean;error?:boolean }={}) {
  return { auth:{ getSession:vi.fn(async()=>({data:{session:session?{user:{id:'actor'}}:null}})),
    getUser:vi.fn(async()=>({data:{user:user?{id:'actor'}:null},error:error?new Error('denied'):null})) },
    rpc:vi.fn(async()=>({data:role,error:null})) };
}
it('requires server-confirmed user identity and live admin membership', async()=>{
  const backend=client();expect(await verifyAdminSession(backend as any)).toBe(true);
  expect(backend.rpc).toHaveBeenCalledWith('has_role',{_user_id:'actor',_role:'admin'});
});
it('rejects cached/forged sessions and non-administrators', async()=>{
  expect(await verifyAdminSession(client({session:false}) as any)).toBe(false);
  expect(await verifyAdminSession(client({user:false}) as any)).toBe(false);
  expect(await verifyAdminSession(client({role:false}) as any)).toBe(false);
  expect(await verifyAdminSession(client({error:true}) as any)).toBe(false);
});
