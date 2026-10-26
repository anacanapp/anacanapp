import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConversationListScreen from './ConversationListScreen';
const state=vi.hoisted(()=>({groups:[
 {id:'joined',name:'Joined room',is_member:true,member_count:2,last_message:'Hello group',last_message_type:'text',last_message_at:'2026-09-21T10:00:00Z',unread_count:2},
 {id:'created-empty',name:'My new room',is_member:true,is_owner:true,created_at:'2026-09-21T11:00:00Z',unread_count:0},
 {id:'invite',name:'Invitation room',is_member:false,access_state:'invited'},
],loading:false,error:null}));
vi.mock('@/hooks/useDirectMessages',()=>({useDirectMessages:()=>({conversations:[],loading:false})}));
vi.mock('@/hooks/usePartnerConversation',()=>({usePartnerConversation:()=>({messages:null,loading:false})}));
vi.mock('@/hooks/useChatGroups',()=>({useChatGroups:()=>state}));
vi.mock('@/components/community/GroupChatScreen',()=>({default:({groupId,onBack}:any)=><div data-testid="group" data-group={groupId}><button onClick={onBack}>Return inbox</button></div>}));
vi.mock('@/lib/tr',()=>({tr:(_key:string,fallback:string)=>fallback}));
vi.mock('@/lib/date-utils',()=>({getCurrentDateLocale:()=>undefined}));
afterEach(cleanup);
it('lists joined and newly created empty groups in Messages and opens the exact room',()=>{
 render(<ConversationListScreen onBack={()=>{}} onOpenChat={()=>{}}/>);
 expect(screen.getByText('My new room')).toBeVisible();expect(screen.getByText('Hello group')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:/Joined room/}));expect(screen.getByTestId('group')).toHaveAttribute('data-group','joined');
 fireEvent.click(screen.getByText('Return inbox'));expect(screen.getByText('My new room')).toBeVisible();
});
it('shows invitations separately and routes acceptance to the group preview',()=>{
 const onOpenGroup=vi.fn();render(<ConversationListScreen onBack={()=>{}} onOpenChat={()=>{}} onOpenGroup={onOpenGroup}/>);
 fireEvent.click(screen.getByRole('button',{name:/Invitation room/}));expect(onOpenGroup).toHaveBeenCalledWith('invite');
 expect(screen.getByText('Dəvətlər')).toBeVisible();
});
