import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import BlogLinkHost from './BlogLinkHost';
import { blogLinks, openAppBlog } from '@/lib/blog-links';

const mocks = vi.hoisted(() => ({ user: 'user-a', loaded: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user ? { id: mocks.user } : null, profileLoaded: mocks.loaded }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ lifeStage: 'mommy' }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://api.anacan.az' }) }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/BlogScreen', () => ({ default: ({ initialSlug, onBack }: any) => <div><h1>{initialSlug}</h1><button onClick={onBack}>Return to conversation</button></div> }));
function Draft() { const [value, setValue] = useState(''); return <textarea aria-label="Message draft" value={value} onChange={event => setValue(event.target.value)} />; }
beforeEach(() => { mocks.user = 'user-a'; mocks.loaded = true; sessionStorage.clear(); });
afterEach(cleanup);
it('opens the exact linked article without losing the originating conversation draft', async () => {
 render(<BlogLinkHost>{() => <Draft />}</BlogLinkHost>); const field = screen.getByRole('textbox'); fireEvent.change(field, { target: { value: 'Unsent message' } });
 act(() => { openAppBlog(blogLinks('exact-article').app); }); await screen.findByRole('heading', { name: 'exact-article' });
 expect(field.isConnected).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Return to conversation' }));
 await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(screen.getByRole('textbox')).toBe(field); expect(field).toHaveValue('Unsent message');
});
it('closes a linked article immediately when the account changes', async () => {
 const view = render(<BlogLinkHost>{() => <Draft />}</BlogLinkHost>); act(() => { openAppBlog(blogLinks('private-context').app); }); await screen.findByRole('heading', { name: 'private-context' });
 mocks.user = 'user-b'; view.rerender(<BlogLinkHost>{() => <Draft />}</BlogLinkHost>); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
