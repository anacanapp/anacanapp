import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChatGroupsPanel from './ChatGroupsPanel';
const state=vi.hoisted(()=>({groups:[] as any[],loading:false,error:null,creating:false,create:vi.fn(),refetch:vi.fn()}));
vi.mock('@/hooks/useChatGroups',()=>({useChatGroups:()=>state}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/lib/tr',()=>({tr:(_key:string,fallback:string)=>fallback}));
vi.mock('@/components/chat/ChatMemberPicker',()=>({default:()=>null}));
beforeEach(()=>{state.groups=[];state.create.mockReset().mockResolvedValue('new-group');});
afterEach(cleanup);
it('creates a Public messaging group with explicit privacy and description',async()=>{
 const onOpen=vi.fn();render(<ChatGroupsPanel onOpen={onOpen}/>);
 fireEvent.click(screen.getByRole('button',{name:'Yeni qrup yarat'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Qrupun adı'}),{target:{value:'My conversation'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Haqqında'}),{target:{value:'Talk together'}});
 fireEvent.click(screen.getByRole('button',{name:/Açıq Hər kəs/}));
 fireEvent.click(screen.getByRole('button',{name:'Yarat'}));
 await waitFor(()=>expect(state.create).toHaveBeenCalledWith(expect.objectContaining({name:'My conversation',visibility:'public',description:'Talk together',people:[]})));
 expect(onOpen).toHaveBeenCalledWith('new-group');
});
it('keeps private request/invitation previews clickable rather than allowing an implicit join',()=>{
 state.groups=[{id:'private',name:'Private room',chat_visibility:'private',is_member:false,access_state:'requested',member_count:2}];
 const onOpen=vi.fn();render(<ChatGroupsPanel onOpen={onOpen}/>);
 fireEvent.click(screen.getByRole('button',{name:/Private room/}));expect(onOpen).toHaveBeenCalledWith('private');
 expect(screen.getByText('Təsdiq gözləyir')).toBeVisible();
});
