import { useEffect, useRef, useState } from 'react';
import { useBanners, BannerPlacement, Banner, useIncrementBannerClick, useIncrementBannerImpression } from '@/hooks/useBanners';
import { useSubscription } from '@/hooks/useSubscription';
import { ExternalLink, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { createBrandExposure } from '@/lib/ads/brandMeasurement';
import { safeAdUrl } from '@/lib/brand-ads';
import { leadText } from '@/lib/ads/leadForm';
import NativeAdCard from './NativeAdCard';
import LeadFormSheet from './LeadFormSheet';

interface BannerSlotProps {
  placement: BannerPlacement;
  onNavigate?: (screen: string) => void;
  onToolOpen?: (toolId: string) => void;
  className?: string;
}

const BannerSlot = ({ placement, onNavigate, onToolOpen, className = '' }: BannerSlotProps) => {
  const { data: banners, isLoading } = useBanners(placement);
  const { isPremium } = useSubscription();
  const incrementClick = useIncrementBannerClick();
  const incrementImpression = useIncrementBannerImpression();
  const firedImpressions = useRef<Set<string>>(new Set());
  const [lead, setLead] = useState<{ banner: string; delivery: string | null } | null>(null);

  // Premium-only bannerləri qeyri-premium istifadəçilər üçün filtrləmək — hook qaydalarına
  // uyğun olsun deyə (heç bir early return-dan ƏVVƏL) hesablanır, yüklənərkən boş massivə düşür
  // Brand creatives reach Premium only when the brand explicitly targets that tier (v3).
  const tier = isPremium ? 'premium' : 'free';
  const visibleBanners = (banners || []).filter((b) => b.branded
    ? (b.audience_tiers?.length ? b.audience_tiers.includes(tier) : !isPremium)
    : (!b.is_premium_only || isPremium));
  const visibleIds = visibleBanners.map((b) => b.id).join(',');

  // Hər banner faktiki göründükdə (bu slot render olunanda) BİR DƏFƏ görüntülənmə qeyd olunur
  // (view_count + banner_impressions.seen_count — admin hədəfləmədə "maks. göstərilmə" üçün)
  useEffect(() => {
    visibleBanners.forEach((banner) => {
      if (!banner.branded && !firedImpressions.current.has(banner.id)) {
        firedImpressions.current.add(banner.id);
        incrementImpression.mutate(banner.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  if (isLoading || !banners?.length) return null;
  if (!visibleBanners.length) return null;

  const handleBannerClick = (banner: Banner, ticket?: Promise<string | null | undefined>) => {
    if (banner.link_type === 'lead_form') {
      if (!banner.branded || !banner.lead_form) return;
      setLead({ banner: banner.id, delivery: null });
      void ticket?.then(delivery => { if (delivery) setLead(old => old?.banner === banner.id ? { ...old, delivery } : old); });
      return;
    }
    if (!banner.link_url) return;
    if (banner.link_type === 'external' && !safeAdUrl(banner.link_url)) return;
    if (!banner.branded) incrementClick.mutate(banner.id);

    switch (banner.link_type) {
      case 'external':
        window.open(safeAdUrl(banner.link_url)!, '_blank', 'noopener,noreferrer');
        break;
      case 'internal':
        if (onNavigate) {
          const screen = banner.link_url.replace('/', '');
          onNavigate(screen);
        }
        break;
      case 'tool':
        if (onToolOpen) {
          onToolOpen(banner.link_url);
        }
        break;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleBanners.map((banner) => (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <MeasuredBanner banner={banner} onClick={(ticket) => handleBannerClick(banner, ticket)} />
        </motion.div>
      ))}
      {lead && <LeadFormSheet bannerId={lead.banner} deliveryId={lead.delivery} onClose={() => setLead(null)} />}
    </div>
  );
};

interface BannerItemProps {
  banner: Banner;
  onClick: () => void;
}
interface MeasuredBannerProps {
  banner: Banner;
  onClick: (ticket?: Promise<string | null | undefined>) => void;
}

function MeasuredBanner({ banner, onClick }: MeasuredBannerProps) {
  const { user } = useAuth(), language = useUserStore(state => state.language);
  const node = useRef<HTMLDivElement>(null), exposure = useRef<ReturnType<typeof createBrandExposure> | null>(null);
  useEffect(() => {
    const version = banner.measurement_version;
    if (!user || !banner.branded || (version !== 2 && version !== 3) || !node.current || banner.banner_type === 'image' && !safeAdUrl(banner.image_url)) return;
    const measurement = createBrandExposure({ rpc: (name, args) => (supabase as any).rpc(name, args), actor: user.id, banner: banner.id, language, platform: Capacitor.getPlatform(), version });
    exposure.current = measurement; let ratio = 0;
    const update = () => {
      const image = node.current?.querySelector('img[data-creative-image]');
      const loaded = !(image instanceof HTMLImageElement) || image.complete && image.naturalWidth > 0;
      measurement.visible(ratio >= .5 && document.visibilityState === 'visible' && loaded);
    };
    const observer = new IntersectionObserver(entries => { ratio = entries[0]?.intersectionRatio || 0; update(); }, { threshold: [0, .5, 1] });
    observer.observe(node.current); document.addEventListener('visibilitychange', update);
    node.current.addEventListener('load', update, true); const element = node.current;
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); element.removeEventListener('load', update, true); measurement.dispose(); exposure.current = null; };
  }, [user?.id, banner.id, banner.branded, banner.measurement_version, banner.creative_revision, language]);
  const click = () => {
    const actionable = banner.link_type === 'lead_form' ? !!banner.lead_form : !!banner.link_url && (banner.link_type !== 'external' || safeAdUrl(banner.link_url));
    onClick(actionable ? exposure.current?.click() : undefined);
  };
  const v3 = banner.measurement_version === 3;
  return <div ref={node}>{banner.sponsor_name && !(v3 && banner.banner_type === 'native') && <span className="mb-1 block text-[10px] text-muted-foreground">{banner.sponsor_name}</span>}
    {banner.banner_type === 'native'
      ? v3 || banner.native_template ? <NativeAdCard ad={banner} sponsorLabel={banner.branded ? `${leadText('sponsored', language)} · ${banner.sponsor_name ?? ''}` : undefined} codeLabel={leadText('offer_code', language)} onClick={click} />
        : <NativeBanner banner={banner} onClick={click} />
      : <ImageBanner banner={banner} onClick={() => click()} />}</div>;
}

const NativeBanner = ({ banner, onClick }: BannerItemProps) => {
  const bgColor = banner.background_color || '#F48155';
  const textColor = banner.text_color || '#FFFFFF';

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl p-4 flex items-center gap-4 transition-transform active:scale-[0.98] shadow-lg"
      style={{ 
        background: `linear-gradient(135deg, ${bgColor} 0%, ${adjustColor(bgColor, -20)} 100%)`,
        color: textColor 
      }}
    >
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-6 h-6" style={{ color: textColor }} />
      </div>
      
      <div className="flex-1 text-start">
        <h3 className="font-semibold text-base" style={{ color: textColor }}>
          {banner.title}
        </h3>
        {banner.description && (
          <p className="text-sm opacity-90 line-clamp-1" style={{ color: textColor }}>
            {banner.description}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {banner.button_text && (
          <span className="text-sm font-medium hidden sm:block" style={{ color: textColor }}>
            {banner.button_text}
          </span>
        )}
        {banner.link_type === 'external' ? (
          <ExternalLink className="w-5 h-5" style={{ color: textColor }} />
        ) : (
          <ChevronRight className="rtl:rotate-180 w-5 h-5" style={{ color: textColor }} />
        )}
      </div>
    </button>
  );
};

const ImageBanner = ({ banner, onClick }: BannerItemProps) => {
  if (!safeAdUrl(banner.image_url)) return null;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl overflow-hidden transition-transform active:scale-[0.98] shadow-lg relative"
    >
      <img 
        src={banner.image_url} 
        data-creative-image="true"
        alt={banner.title}
        className="w-full h-auto object-cover"
      />
      {banner.link_type === 'external' && (
        <div className="absolute top-2 end-2 bg-black/50 rounded-full p-1.5">
          <ExternalLink className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
};

// Helper function to darken/lighten colors
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

export default BannerSlot;
