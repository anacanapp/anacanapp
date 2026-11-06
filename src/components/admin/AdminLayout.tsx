import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Bell, ChevronDown, ChevronsLeft, Clock, Home, LogOut, Search, ShieldCheck, Star, X } from 'lucide-react';
import { useAdminLanguage } from '@/contexts/AdminLanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { cn } from '@/lib/utils';
import CommandPalette from './CommandPalette';
import { ADMIN_GROUPS, ADMIN_SECTIONS, MOBILE_TABS, canonicalSection, getSection, groupOf, type AdminGroupId, type AdminSection } from './registry';
import { prefetchSection } from './sections';
import { ConfirmProvider } from './kit/Overlays';
import { useIsMobileAdmin, useStoredState } from './kit/hooks';
import { foldText } from './kit/format';
import '@/styles/admin.css';

interface Props {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onExit: () => void;
  /** Mobile app-bar back action; defaults to the dashboard. */
  onBack?: () => void;
}

const FAVOURITES_KEY = 'anacan_admin_favourites_v1', RECENTS_KEY = 'anacan_admin_recent_v1', COLLAPSED_KEY = 'anacan_admin_sidebar_collapsed_v1';
const prefetchProps = (id: string) => ({ onMouseEnter: () => prefetchSection(id), onFocus: () => prefetchSection(id), onTouchStart: () => prefetchSection(id) });

export default function AdminLayout({ children, activeTab, onTabChange, onExit, onBack }: Props) {
  const mobile = useIsMobileAdmin();
  const selected = canonicalSection(activeTab) ?? 'dashboard';
  const current = getSection(selected)!, currentGroup = groupOf(selected);
  const [collapsed, setCollapsed] = useStoredState<boolean>(COLLAPSED_KEY, false);
  const [favourites, setFavourites] = useStoredState<string[]>(FAVOURITES_KEY, ['orders', 'users', 'support', 'push-notifications']);
  const [recents, setRecents] = useStoredState<string[]>(RECENTS_KEY, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [listOpen, setListOpen] = useState<false | 'all' | AdminGroupId>(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['overview', currentGroup?.id ?? 'overview']));
  const content = useRef<HTMLDivElement>(null), positions = useRef<Record<string, number>>({}), userScrolled = useRef(false), programmatic = useRef(0);

  // Admin-only design tokens also reach Radix portals (dialogs, menus) while the shell is mounted.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('admin-active');
    return () => root.classList.remove('admin-active');
  }, []);

  useEffect(() => {
    setRecents(previous => [selected, ...previous.filter(id => id !== selected)].slice(0, 6));
    if (currentGroup) setExpanded(previous => previous.has(currentGroup.id) ? previous : new Set(previous).add(currentGroup.id));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll restoration per section: remembered while the shell lives; data arrives from cache so a few retries are enough.
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const target = positions.current[selected] ?? 0;
    const restore = () => { programmatic.current = Date.now(); element.scrollTop = target; };
    userScrolled.current = false;
    restore();
    if (!target) return;
    const timers = [80, 250, 600].map(delay => setTimeout(() => { if (!userScrolled.current && element.scrollTop !== target) restore(); }, delay));
    return () => timers.forEach(clearTimeout);
  }, [selected]);
  const onScroll = () => {
    if (!content.current || Date.now() - programmatic.current < 120) return; // ignore our own restore
    positions.current[selected] = content.current.scrollTop; userScrolled.current = true;
  };

  const navigate = useCallback((id: string) => { setListOpen(false); onTabChange(id); }, [onTabChange]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(open => !open); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isFavourite = favourites.includes(selected);
  const toggleFavourite = (id = selected) => setFavourites(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id].slice(0, 12));

  const shell = (
    <div className={cn('admin-shell', collapsed && !mobile && 'is-collapsed', mobile ? 'is-mobile' : 'is-desktop')} data-ad-block="true" data-testid="admin-shell">
      {!mobile && <DesktopSidebar collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} selected={selected} favourites={favourites} recents={recents}
        expanded={expanded} setExpanded={setExpanded} onNavigate={navigate} onOpenPalette={() => setPaletteOpen(true)} onExit={onExit} />}
      <main className="admin-main">
        {mobile ? (
          <header className="as-appbar">
            {selected === 'dashboard'
              ? <span className="as-appbar-brand" aria-hidden><ShieldCheck size={18} /></span>
              : <button type="button" className="as-icon-btn" aria-label="Geri" onClick={() => (onBack ? onBack() : navigate('dashboard'))}><ArrowLeft size={20} className="rtl:rotate-180" /></button>}
            <div className="as-appbar-title"><small>{currentGroup?.label ?? 'İdarəetmə'}</small><strong>{current.label}</strong></div>
            <button type="button" className="as-icon-btn" aria-label="Bölmə axtar" onClick={() => setPaletteOpen(true)}><Search size={20} /></button>
          </header>
        ) : (
          <header className="as-topbar">
            <nav className="as-breadcrumb" aria-label="Yer">
              <button type="button" onClick={() => navigate('dashboard')}>İdarəetmə</button>
              {currentGroup && currentGroup.id !== 'overview' && <><span aria-hidden>/</span><span>{currentGroup.label}</span></>}
              <span aria-hidden>/</span><strong aria-current="page">{current.label}</strong>
              <button type="button" className={cn('as-fav-toggle', isFavourite && 'is-on')} aria-pressed={isFavourite}
                aria-label={isFavourite ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'} title={isFavourite ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'} onClick={() => toggleFavourite()}>
                <Star size={14} />
              </button>
            </nav>
            <div className="as-topbar-actions">
              <button type="button" className="as-search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Bölmə axtar (Ctrl+K)">
                <Search size={14} /><span>Bölməyə keç…</span><kbd>⌘K</kbd>
              </button>
              <TopbarControls onBell={() => navigate('push-notifications')} />
            </div>
          </header>
        )}
        <div ref={content} className="as-content" data-testid="admin-content" onScroll={onScroll}>
          <div className="as-content-inner">{children}</div>
        </div>
        {mobile && (
          <nav className="as-tabbar" aria-label="Əsas bölmələr">
            {MOBILE_TABS.map(tab => {
              const active = tab.all ? listOpen === 'all' : tab.group ? listOpen === tab.group || (!listOpen && tab.match.includes(selected)) : !listOpen && tab.match.includes(selected);
              return (
                <button key={tab.key} type="button" className={cn('as-tab', active && 'is-active')} aria-current={active ? 'page' : undefined}
                  {...(tab.section ? prefetchProps(tab.section) : {})}
                  onClick={() => tab.section ? navigate(tab.section) : setListOpen(listOpen === (tab.all ? 'all' : tab.group!) ? false : (tab.all ? 'all' : tab.group!))}>
                  <tab.icon size={20} aria-hidden /><span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </main>
      {mobile && listOpen && <MobileSectionList filter={listOpen} selected={selected} favourites={favourites} recents={recents} onToggleFavourite={toggleFavourite}
        onNavigate={navigate} onClose={() => setListOpen(false)} onExit={onExit} />}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={navigate} favourites={favourites} recents={recents} current={selected} />
    </div>
  );
  return <ConfirmProvider>{shell}</ConfirmProvider>;
}

function TopbarControls({ onBell }: { onBell: () => void }) {
  const { adminLanguage, setAdminLanguage } = useAdminLanguage();
  const backend = getBackendConfig();
  return (
    <>
      <span className="as-backend-badge" title="Məlumat mənbəyi">{backend.azure ? 'Azure' : 'Source'}</span>
      <select className="as-lang" aria-label="Məzmunun redaktə dili" value={adminLanguage} onChange={event => setAdminLanguage(event.target.value as typeof adminLanguage)}>
        {APP_LANGUAGE_CODES.map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
      </select>
      <button type="button" className="as-icon-btn" aria-label="Bildiriş kampaniyalarını aç" onClick={onBell}><Bell size={17} /></button>
    </>
  );
}

function MenuItem({ section, active, compact, onNavigate, trailing }: { section: AdminSection; active: boolean; compact?: boolean; onNavigate: (id: string) => void; trailing?: ReactNode }) {
  return (
    <button type="button" className={cn('as-menu-item', active && 'is-active')} aria-current={active ? 'page' : undefined} aria-label={section.label}
      title={compact ? section.label : undefined} onClick={() => onNavigate(section.id)} {...prefetchProps(section.id)}>
      <section.icon size={16} aria-hidden />{!compact && <span>{section.label}</span>}{!compact && trailing}
    </button>
  );
}

function DesktopSidebar({ collapsed, onCollapse, selected, favourites, recents, expanded, setExpanded, onNavigate, onOpenPalette, onExit }: {
  collapsed: boolean; onCollapse: () => void; selected: string; favourites: string[]; recents: string[];
  expanded: Set<string>; setExpanded: (updater: (previous: Set<string>) => Set<string>) => void;
  onNavigate: (id: string) => void; onOpenPalette: () => void; onExit: () => void;
}) {
  const { profile, signOut } = useAuth();
  const pinned = favourites.map(id => getSection(id)).filter((item): item is AdminSection => !!item);
  const recent = recents.filter(id => id !== selected && !favourites.includes(id)).slice(0, 4).map(id => getSection(id)).filter((item): item is AdminSection => !!item);
  return (
    <aside className="as-sidebar" aria-label="Admin menyusu">
      <div className="as-brand">
        <span className="as-brand-icon"><ShieldCheck size={18} /></span>
        {!collapsed && <div><strong>Anacan</strong><small>İdarəetmə mərkəzi</small></div>}
        <button type="button" className="as-icon-btn as-collapse" aria-label={collapsed ? 'Menyunu genişləndir' : 'Menyunu yığ'} onClick={onCollapse}>
          <ChevronsLeft size={16} className={cn(collapsed && 'rotate-180', 'rtl:-scale-x-100')} />
        </button>
      </div>
      {!collapsed && <button type="button" className="as-sidebar-search" onClick={onOpenPalette}><Search size={14} /><span>Axtar…</span><kbd>⌘K</kbd></button>}
      <nav className="as-menu" aria-label="Admin bölmələri">
        {pinned.length > 0 && (
          <section className="as-menu-group">
            {!collapsed && <div className="as-group-label"><Star size={12} />Seçilmişlər</div>}
            {pinned.map(section => <MenuItem key={`fav-${section.id}`} section={section} active={section.id === selected} compact={collapsed} onNavigate={onNavigate} />)}
          </section>
        )}
        {!collapsed && recent.length > 0 && (
          <section className="as-menu-group">
            <div className="as-group-label"><Clock size={12} />Son baxılanlar</div>
            {recent.map(section => <MenuItem key={`recent-${section.id}`} section={section} active={false} onNavigate={onNavigate} />)}
          </section>
        )}
        {ADMIN_GROUPS.map(group => {
          const items = ADMIN_SECTIONS.filter(section => section.group === group.id);
          const open = collapsed || expanded.has(group.id);
          return (
            <section key={group.id} className="as-menu-group">
              {!collapsed && (
                <button type="button" className="as-group-toggle" aria-expanded={open}
                  onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>
                  <group.icon size={13} aria-hidden /><span>{group.label}</span><em>{items.length}</em><ChevronDown size={13} className={cn(open && 'rotate-180')} />
                </button>
              )}
              {collapsed && <div className="as-group-divider" aria-hidden />}
              {open && items.map(section => <MenuItem key={section.id} section={section} active={section.id === selected} compact={collapsed} onNavigate={onNavigate} />)}
            </section>
          );
        })}
      </nav>
      <div className="as-sidebar-foot">
        {!collapsed && <div className="as-account"><span>{profile?.name?.charAt(0) || 'A'}</span><div><strong>{profile?.name || 'Administrator'}</strong><small>{profile?.email}</small></div></div>}
        <div className="as-foot-actions">
          <button type="button" className="as-foot-btn" onClick={onExit} title="Tətbiqə qayıt"><Home size={15} />{!collapsed && 'Tətbiqə qayıt'}</button>
          <button type="button" className="as-foot-btn is-icon" title="Hesabdan çıxış" aria-label="Hesabdan çıxış" onClick={async () => { const result = await signOut(); if (!result.error) onExit(); }}><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
  );
}

function MobileSectionList({ filter, selected, favourites, recents, onToggleFavourite, onNavigate, onClose, onExit }: {
  filter: 'all' | AdminGroupId; selected: string; favourites: string[]; recents: string[]; onToggleFavourite: (id: string) => void;
  onNavigate: (id: string) => void; onClose: () => void; onExit: () => void;
}) {
  const [query, setQuery] = useState('');
  const { profile, signOut } = useAuth();
  const q = foldText(query.trim());
  const groups = useMemo(() => ADMIN_GROUPS.filter(group => filter === 'all' || group.id === filter).map(group => ({
    group, items: ADMIN_SECTIONS.filter(section => section.group === group.id && (!q || foldText(`${section.label} ${section.id} ${section.keywords ?? ''}`).includes(q))),
  })).filter(entry => entry.items.length), [filter, q]);
  const quick = filter === 'all' && !q ? [...new Set([...favourites, ...recents])].map(id => getSection(id)).filter((item): item is AdminSection => !!item).slice(0, 8) : [];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="as-sheet" role="dialog" aria-modal="true" aria-label={filter === 'all' ? 'Bütün bölmələr' : ADMIN_GROUPS.find(group => group.id === filter)?.label} data-testid="admin-all-sections">
      <header className="as-sheet-head">
        <strong>{filter === 'all' ? 'Bütün bölmələr' : ADMIN_GROUPS.find(group => group.id === filter)?.label}</strong>
        <button type="button" className="as-icon-btn" aria-label="Bağla" onClick={onClose}><X size={20} /></button>
      </header>
      <label className="as-sheet-search"><Search size={16} aria-hidden /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bölmə axtar…" aria-label="Bölmə axtar" /></label>
      <div className="as-sheet-body">
        {quick.length > 0 && (
          <section className="as-sheet-group">
            <h3>Seçilmiş və son</h3>
            <div className="as-quick-grid">{quick.map(section => (
              <button key={section.id} type="button" className={cn('as-quick', section.id === selected && 'is-active')} onClick={() => onNavigate(section.id)} {...prefetchProps(section.id)}>
                <section.icon size={18} aria-hidden /><span>{section.label}</span>
              </button>
            ))}</div>
          </section>
        )}
        {groups.map(({ group, items }) => (
          <section key={group.id} className="as-sheet-group">
            <h3><group.icon size={13} aria-hidden />{group.label}</h3>
            <ul>{items.map(section => (
              <li key={section.id}>
                <button type="button" className={cn('as-sheet-item', section.id === selected && 'is-active')} onClick={() => onNavigate(section.id)} {...prefetchProps(section.id)}>
                  <section.icon size={18} aria-hidden /><span>{section.label}</span>
                </button>
                <button type="button" className={cn('as-sheet-star', favourites.includes(section.id) && 'is-on')} aria-pressed={favourites.includes(section.id)}
                  aria-label={`${section.label}: seçilmişlərə`} onClick={() => onToggleFavourite(section.id)}><Star size={16} /></button>
              </li>
            ))}</ul>
          </section>
        ))}
        {!groups.length && <p className="as-sheet-empty">Bölmə tapılmadı.</p>}
        {filter === 'all' && !q && (
          <section className="as-sheet-group as-sheet-account">
            <h3>Hesab</h3>
            <div className="as-account"><span>{profile?.name?.charAt(0) || 'A'}</span><div><strong>{profile?.name || 'Administrator'}</strong><small>{profile?.email}</small></div></div>
            <div className="as-sheet-controls"><TopbarControls onBell={() => onNavigate('push-notifications')} /></div>
            <div className="as-foot-actions">
              <button type="button" className="as-foot-btn" onClick={onExit}><Home size={15} />Tətbiqə qayıt</button>
              <button type="button" className="as-foot-btn" onClick={async () => { const result = await signOut(); if (!result.error) onExit(); }}><LogOut size={15} />Hesabdan çıxış</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
