import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { tr } from "@/lib/tr";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="a-scope flex min-h-screen items-center justify-center relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <div className="a-card text-center relative z-10" style={{ padding: '36px 44px' }}>
        <div className="mx-auto mb-4 flex items-center justify-center"
        style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-peach-1)', fontSize: 28 }}>
          🧭
        </div>
        <h1 className="mb-2" style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--a-ink)' }}>404</h1>
        <p className="mb-5" style={{ fontSize: 15, color: 'var(--a-ink-soft)' }}>{tr("notfound_oops_page_not_found", "Oops! Page not found")}</p>
        <a href="/"
        className="inline-flex items-center justify-center rounded-full text-white hover:opacity-95 transition-opacity"
        style={{ background: 'var(--a-peach-2)', padding: '11px 26px', fontSize: 13.5, fontWeight: 700, boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
          {tr("notfound_return_to_home", "Return to Home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
