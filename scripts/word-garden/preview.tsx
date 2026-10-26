// Development-only acceptance entry. Real game, lexicon and worker; optional
// application providers keep their network fully interceptable in browser tests.
import '../../src/lib/polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/contexts/AuthContext';
import WordGarden from '../../src/components/games/word-garden/WordGarden';
import MiniGamesHub from '../../src/components/games/MiniGamesHub';
import '../../src/index.css';

const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const showHub = new URLSearchParams(location.search).has('hub');
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={query}><AuthProvider>
  {showHub ? <MiniGamesHub onBack={() => history.back()} /> : <WordGarden onBack={() => history.back()} />}
</AuthProvider></QueryClientProvider></StrictMode>);
