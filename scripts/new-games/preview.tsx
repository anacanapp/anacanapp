import '../../src/lib/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/contexts/AuthContext';
import LeafFlight from '../../src/components/games/leaf-flight/LeafFlight';
import ClearTheWay from '../../src/components/games/parking/ClearTheWay';
import MiniGamesHub from '../../src/components/games/MiniGamesHub';
import '../../src/index.css';

const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const game = new URLSearchParams(location.search).get('game');
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={query}><AuthProvider>
  {game === 'flight' ? <LeafFlight onBack={() => history.back()} /> : game === 'parking' ? <ClearTheWay onBack={() => history.back()} /> : <MiniGamesHub onBack={() => history.back()} />}
</AuthProvider></QueryClientProvider></StrictMode>);
