import '../../src/lib/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/contexts/AuthContext';
import TwoFriends from '../../src/components/games/iki-dost/TwoFriends';
import MiniGamesHub from '../../src/components/games/MiniGamesHub';
import '../../src/index.css';

const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={query}><AuthProvider>
  {new URLSearchParams(location.search).has('hub') ? <MiniGamesHub onBack={() => history.back()} /> : <TwoFriends onBack={() => history.back()} />}
</AuthProvider></QueryClientProvider></StrictMode>);
