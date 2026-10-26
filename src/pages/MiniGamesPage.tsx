import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

// Standalone, auth-free entry point for local/dev testing of the Mini Games
// section (e.g. http://localhost:8080/mini-games). Production users reach the
// same MiniGamesHub component through Tools -> "Mini Oyunlar" inside the main
// authenticated app shell (see ToolsHub.tsx).
const MiniGamesHub = lazy(() => import('@/components/games/MiniGamesHub'));

const MiniGamesPage = () => {
  const navigate = useNavigate();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      {/* The app's global CSS pins html/body/#root (position: fixed, overflow:
          hidden) and normally relies on Index.tsx's own scroll container for
          content taller than the viewport. This standalone route needs the
          same treatment so long screens (e.g. the 40-level grid) stay
          reachable when testing outside the authenticated app shell. */}
      <div className="fixed inset-0 overflow-y-auto overscroll-none" data-scroll-container>
        <MiniGamesHub onBack={() => navigate('/')} />
      </div>
    </Suspense>
  );
};

export default MiniGamesPage;
