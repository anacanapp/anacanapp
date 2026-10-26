import { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBlogAttachment } from '@/hooks/useBlogAttachment';
import BlogAttachmentPicker from './BlogAttachmentPicker';
import CommunityBlogCard from './CommunityBlogCard';
import { OPEN_BLOG_EVENT } from '@/lib/blog-links';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
vi.mock('@/integrations/supabase/backend-config',()=>({getBackendConfig:()=>({url:'https://api.anacan.az'})}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'viewer'}})}));
vi.mock('@/store/userStore',()=>({useUserStore:(select:any)=>select({language:'en'})}));
const blog={id:'11111111-1111-4111-8111-111111111111',slug:'sleep-guide',title:'Sleep guide',excerpt:'Article description',cover_image_url:'https://example.invalid/cover.jpg'};
let client:QueryClient;
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{retry:false}}});mocks.rpc.mockReset();mocks.rpc.mockResolvedValue({data:[blog],error:null});});
afterEach(()=>{cleanup();client.clear();});
function Composer(){const [content,setContent]=useState(''),ref=useRef<HTMLTextAreaElement>(null),attachment=useBlogAttachment(content,setContent,ref);return <><textarea aria-label="Caption" ref={ref} value={content} onChange={event=>{setContent(event.target.value);attachment.setCursor(event.target.selectionStart);}}/><BlogAttachmentPicker attachment={attachment}/><output>{attachment.selected?.id}</output></>;}
it('searches /Blog, attaches its image/title, and preserves independent caption text',async()=>{
 render(<QueryClientProvider client={client}><Composer/></QueryClientProvider>);const field=screen.getByRole('textbox');fireEvent.change(field,{target:{value:'My caption /Blog sleep',selectionStart:22}});
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('search_share_blogs_v1',expect.objectContaining({p_search:'sleep',p_language:'en'})));
 fireEvent.click(await screen.findByRole('button',{name:/Sleep guide/}));await waitFor(()=>expect(field).toHaveValue('My caption '));expect(screen.getByRole('heading',{name:'Sleep guide'})).toBeInTheDocument();expect(document.querySelector('img')).toHaveAttribute('src',blog.cover_image_url);
 fireEvent.change(field,{target:{value:'My caption and my thoughts',selectionStart:26}});expect(screen.getByRole('heading',{name:'Sleep guide'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Remove article'}));expect(screen.queryByRole('heading',{name:'Sleep guide'})).not.toBeInTheDocument();expect(field).toHaveValue('My caption and my thoughts');
});
it('opens a shared card inside the app and hides unpublished/missing metadata',async()=>{
 const listener=vi.fn();window.addEventListener(OPEN_BLOG_EVENT,listener);
 const view=render(<QueryClientProvider client={client}><CommunityBlogCard id={blog.id}/></QueryClientProvider>);fireEvent.click(await screen.findByRole('button',{name:/Sleep guide/}));expect(listener.mock.calls[0][0].detail.slug).toBe('sleep-guide');window.removeEventListener(OPEN_BLOG_EVENT,listener);
 mocks.rpc.mockResolvedValue({data:[],error:null});await act(async()=>{await client.invalidateQueries();});await screen.findByText('This article is no longer available.');expect(screen.queryByRole('button',{name:/Sleep guide/})).not.toBeInTheDocument();view.unmount();
});
