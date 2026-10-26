import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, Bell, ChevronDown, ChevronsLeft, Crown, FileText, Globe, Home, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, ShoppingBag, Users, Wrench, X } from 'lucide-react';
import { useAdminLanguage } from '@/contexts/AdminLanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/userStore';
import { isRtlLang } from '@/lib/rtl';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import { getLocaleTag } from '@/lib/i18n';
import { tr } from '@/lib/tr';
import { moderationText } from '@/lib/community-moderation-i18n';
import '@/styles/admin.css';

const groups = [
  { id: 'overview', label: 'İdarəetmə', icon: LayoutDashboard, items: [
    ['dashboard', 'İcmal'], ['premium-analytics', 'Premium mərkəzi'], ['push-notifications', 'Bildiriş kampaniyaları'],
    ['analytics', 'İstifadə analitikası'], ['country-stats', 'Ölkələr'], ['quick-actions', 'Sürətli keçidlər']] },
  { id: 'people', label: 'İstifadəçilər və icma', icon: Users, items: [
    ['users', 'İstifadəçilər'], ['subscriptions', 'Premium hüquqlarının idarəsi'], ['verified-badges', 'Mavi tik'], ['community', 'Cəmiyyət'],
    ['moderation', 'Moderasiya'], ['ad-moderation', 'Reklam moderasiyası'], ['support', 'Dəstək müraciətləri'], ['messages', 'Mesajlar'], ['mommy-daily-messages', 'Anaya mesaj']] },
  { id: 'content', label: 'Məzmun', icon: FileText, items: [
    ['blog', 'Bloq'], ['dynamic-content', 'Dinamik məzmun'], ['content', 'Digər kontent'], ['data', 'Məlumatlar'], ['faq', 'FAQ'],
    ['pregnancy', 'Hamiləlik'], ['flow-content', 'Menstruasiya'], ['partner-tips', 'Partnyor məsləhətləri'], ['mental-health', 'Mental sağlamlıq'],
    ['first-aid', 'İlk yardım'], ['recipes', 'Reseptlər']] },
  { id: 'tools', label: 'Alətlər və modullar', icon: Wrench, items: [
    ['tools-config', 'Alət konfiqurasiyaları'], ['tools', 'Alət sıralaması'], ['development-tips', 'İnkişaf tövsiyələri'], ['baby-growth', 'İnkişaf izləyicisi'],
    ['teething', 'Diş çıxarma'], ['crisis-calendar', 'Kriz təqvimi'], ['baby-daily-info', 'Günlük ana məlumatları'], ['phase-tips', 'Faza məsləhətləri'],
    ['trimester-tips', 'Trimester tövsiyələri'], ['vitamins', 'Vitaminlər'], ['vaccines', 'Peyvənd təqvimi'], ['maternity', 'Dekret kalkulyatoru'],
    ['default-shopping', 'Alışveriş siyahısı'], ['fairy-tales', 'Sehrli nağılçı']] },
  { id: 'commerce', label: 'Satış və reklam', icon: ShoppingBag, items: [
    ['admob', 'AdMob reklamları'], ['orders', 'Sifarişlər'], ['epoint', 'Epoint ödəniş'], ['products', 'Məhsullar'], ['affiliate', 'Affiliate məhsullar'],
    ['marketplace', 'İkinci əl bazarı'], ['play-activities', 'Ağıllı oyun qutusu'], ['album-orders', 'Albom sifarişləri'], ['cakes', 'Tortlar'],
    ['photoshoot', 'Fotosessiya'], ['coupons', 'Kuponlar']] },
  { id: 'places', label: 'Məkanlar və partnyorlar', icon: Globe, items: [
    ['places', 'Ana dostu məkanlar'], ['places-config', 'Məkan konfiqurasiyası'], ['healthcare-reviews', 'Həkim / klinika rəyləri'],
    ['partner-config', 'Partnyor konfiqurasiyası'], ['partner-venues', 'Partnyor məkanları'], ['partner-redemptions', 'Endirim hesabatı']] },
  { id: 'design', label: 'Görünüş və onboarding', icon: Crown, items: [
    ['premium-config', 'Premium səhifəsi'], ['intro-slides', 'Qarşılama ekranları'], ['onboarding', 'Qeydiyyat mərhələləri'], ['banners', 'Bannerlər'],
    ['branding', 'Branding'], ['baby-illustrations', 'Körpə illüstrasiyaları'], ['fetus-illustrations', 'Fetus şəkilləri'], ['fruit-images', 'Körpə ölçüsü şəkilləri']] },
  { id: 'system', label: 'Sistem və dillər', icon: Settings, items: [
    ['settings', 'Tənzimləmələr'], ['security', 'Təhlükəsizlik'], ['legal', 'Hüquqi sənədlər'], ['force-update', 'Versiya idarəsi'],
    ['languages', 'Dillər'], ['translations', 'Tərcümələr'], ['content-i18n', 'Kontent tərcüməsi'], ['deeplinks', 'Deeplinklər'],
    ['crash-reports', 'Xəta hesabatları'], ['revenuecat-debug', 'RevenueCat diaqnostika']] },
];
const aliases: Record<string, string> = { premium: 'premium-analytics', notifications: 'push-notifications', ads: 'admob' };
interface Props { children: ReactNode; activeTab: string; onTabChange: (tab: string) => void; onExit: () => void }
export default function AdminLayout({ children, activeTab, onTabChange, onExit }: Props) {
  const [collapsed, setCollapsed] = useState(false), [mobileOpen, setMobileOpen] = useState(false), [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['overview']));
  const { profile, signOut } = useAuth(), { adminLanguage, setAdminLanguage } = useAdminLanguage();
  const language = useUserStore(state => state.language), rtl = isRtlLang(language);
  const localizedGroups = groups.map(group => ({ ...group, label: tr(`admin_nav_group_${group.id}`, group.label),
    items: group.items.map(([id, label]) => [id, id === 'ad-moderation' ? moderationText('title', language) : tr(`admin_nav_${id}`, label)]) }));
  const allItems = localizedGroups.flatMap(group => group.items);
  const backend = getBackendConfig(), content = useRef<HTMLDivElement>(null);
  const selected = aliases[activeTab] ?? activeTab;
  const current = allItems.find(([id]) => id === selected);
  useEffect(() => {
    const group = groups.find(group => group.items.some(([id]) => id === selected));
    if (group) setExpanded(previous => new Set(previous).add(group.id));
    setMobileOpen(false); content.current?.scrollTo({ top: 0 });
  }, [selected]);
  const navigate = (id: string) => { onTabChange(id); setMobileOpen(false); };
  const navigation = (compact = false) => <div className="admin-navigation">
    <div className="admin-brand"><span className="admin-brand-icon"><ShieldCheck size={21} /></span>{!compact && <div><strong>Anacan</strong><small>İdarəetmə mərkəzi</small></div>}</div>
    {!compact && <div className="admin-menu-search"><Search size={16} /><Input aria-label="Admin menyusunda axtar" placeholder="Bölmə axtar…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Axtarışı təmizlə" onClick={() => setSearch('')}><X size={14} /></button>}</div>}
    <nav aria-label="Admin bölmələri" className="admin-menu">
      {localizedGroups.map(group => {
        const items = group.items.filter(([id, label]) => `${label} ${id}`.toLocaleLowerCase(getLocaleTag()).includes(search.trim().toLocaleLowerCase(getLocaleTag())));
        if (!items.length) return null;
        const open = !!search || expanded.has(group.id);
        return <section key={group.id} className="admin-menu-group">
          {!compact && <button className="admin-group-toggle" aria-expanded={open} onClick={() => setExpanded(previous => {
            const next = new Set(previous); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next;
          })}><group.icon size={15} /><span>{group.label}</span><ChevronDown size={14} className={open ? 'rotate-180' : ''} /></button>}
          {(compact || open) && items.map(([id, label]) => <button key={id} title={compact ? label : undefined} aria-label={label}
            aria-current={id === selected ? 'page' : undefined} onClick={() => navigate(id)} className={cn('admin-menu-item', id === selected && 'is-active')}>
            {id === 'premium-analytics' ? <Crown size={18} /> : id === 'push-notifications' ? <Bell size={18} /> : id === 'dashboard' ? <BarChart3 size={18} /> : <group.icon size={16} />}
            {!compact && <span>{label}</span>}
          </button>)}
        </section>;
      })}
      {search && !allItems.some(([id, label]) => `${id} ${label}`.toLocaleLowerCase(getLocaleTag()).includes(search.trim().toLocaleLowerCase(getLocaleTag()))) && <p className="p-4 text-sm text-muted-foreground">Bölmə tapılmadı.</p>}
    </nav>
    <div className="admin-sidebar-bottom">{!compact && <div className="admin-account"><span>{profile?.name?.charAt(0) || 'A'}</span><div><strong>{profile?.name || 'Administrator'}</strong><small>{profile?.email}</small></div></div>}
      <Button variant="outline" size="sm" onClick={onExit} title="Tətbiqə qayıt"><Home size={16} />{!compact && 'Tətbiqə qayıt'}</Button>
      <Button variant="ghost" size="sm" onClick={async () => { const result = await signOut(); if (!result.error) onExit(); }} title="Hesabdan çıxış"><LogOut size={16} />{!compact && 'Hesabdan çıxış'}</Button>
    </div>
  </div>;
  return <div className={cn('admin-shell', collapsed && 'is-collapsed')} data-ad-block="true" data-testid="admin-shell">
    <aside className="admin-desktop-sidebar">{navigation(collapsed)}</aside>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side={rtl ? 'right' : 'left'} className="admin-mobile-sidebar p-0" aria-describedby="admin-menu-description">
      <SheetTitle className="sr-only">Admin menyusu</SheetTitle><SheetDescription id="admin-menu-description" className="sr-only">İdarəetmə bölməsini seçin.</SheetDescription>{navigation()}
    </SheetContent></Sheet>
    <main className="admin-main"><header className="admin-topbar">
      <div className="admin-topbar-title"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Admin menyusunu aç" onClick={() => setMobileOpen(true)}><Menu size={21} /></Button>
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? 'Menyunu genişləndir' : 'Menyunu yığ'} onClick={() => setCollapsed(!collapsed)}><ChevronsLeft size={19} className={collapsed ? 'rotate-180' : ''} /></Button>
        <div><small>İdarəetmə /</small><strong>{current?.[1] || 'Dashboard'}</strong></div>
      </div>
      <div className="admin-topbar-actions"><span className="admin-backend-badge">{backend.azure ? 'Azure' : 'Source'}</span>
        <Select value={adminLanguage} onValueChange={value => setAdminLanguage(value as typeof adminLanguage)}><SelectTrigger aria-label="Məzmunun redaktə dili" className="w-[76px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{APP_LANGUAGE_CODES.map(lang => <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" size="icon" aria-label="Bildiriş kampaniyalarını aç" onClick={() => navigate('push-notifications')}><Bell size={18} /></Button>
      </div>
    </header><div ref={content} className="admin-content" data-testid="admin-content"><div className="admin-content-inner">{children}</div></div></main>
  </div>;
}
