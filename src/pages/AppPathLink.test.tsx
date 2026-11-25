import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const nav = vi.hoisted(() => ({ navigateFromPush: vi.fn() }));
const store = vi.hoisted(() => ({ isAuthenticated: false }));
vi.mock('@/lib/pushNav', () => nav);
vi.mock('@/store/userStore', () => ({ useUserStore: (select: (s: typeof store) => unknown) => select(store) }));
vi.mock('@/components/StartupScreen', () => ({ default: () => <div>starting</div> }));

import AppPathLink, { PendingAppLink } from './AppPathLink';

const Home = () => <div>home {useLocation().pathname}</div>;
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <PendingAppLink />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<AppPathLink />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { sessionStorage.clear(); nav.navigateFromPush.mockReset(); store.isAuthenticated = false; });

describe('AppPathLink', () => {
  it('shows the 404 card for unknown paths', () => {
    renderAt('/does-not-exist');
    expect(screen.getByText('404')).toBeTruthy();
    expect(nav.navigateFromPush).not.toHaveBeenCalled();
  });

  it('signed in: opens the shared screen through the in-app router', async () => {
    store.isAuthenticated = true;
    renderAt('/tool/kick-counter');
    await waitFor(() => expect(screen.getByText('home /')).toBeTruthy());
    expect(nav.navigateFromPush).toHaveBeenCalledWith({ deeplink: 'anacan://tool/kick-counter' });
  });

  it('signed out: goes home and keeps the link until sign-in', async () => {
    const view = renderAt('/community/post/abc-123');
    await waitFor(() => expect(screen.getByText('home /')).toBeTruthy());
    expect(nav.navigateFromPush).not.toHaveBeenCalled();
    view.unmount();
    store.isAuthenticated = true; // e.g. back from the Google sign-in redirect
    renderAt('/');
    await waitFor(() => expect(nav.navigateFromPush).toHaveBeenCalledWith({ deeplink: 'anacan://community/post/abc-123' }));
  });
});
