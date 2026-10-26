import { tr, getPersistedLanguage } from "@/lib/tr";
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, MapPin, Sparkles, Crown, Lock, Phone, Globe, Instagram, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePartnerCategories, usePartnerVenues, localizeCategoryLabel, PartnerVenue } from '@/hooks/usePartnerVenues';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/PremiumModal';
import RedemptionQRSheet from './RedemptionQRSheet';
import { useScrollToTop } from '@/hooks/useScrollToTop';

interface Props {onBack: () => void;}

export default function PartnersScreen({ onBack }: Props) {
  useScrollToTop();
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<PartnerVenue | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const { data: categories } = usePartnerCategories();
  const { data: venues, isLoading } = usePartnerVenues(category);
  const { isPremium } = useSubscription();

  const filtered = (venues || []).filter((v) =>
  !query.trim() || v.name.toLowerCase().includes(query.toLowerCase()) ||
  (v.address || '').toLowerCase().includes(query.toLowerCase())
  );

  const handleRedeem = (v: PartnerVenue) => {
    if (!isPremium) {setShowPremium(true);return;}
    setSelectedVenue(v);
    setQrOpen(true);
  };

  if (selectedVenue && !qrOpen) {
    return (
      <VenueDetail
        venue={selectedVenue}
        isPremium={isPremium}
        onBack={() => setSelectedVenue(null)}
        onRedeem={() => handleRedeem(selectedVenue)} />);


  }

  return (
    <div className="a-scope min-h-screen pb-20 overflow-y-auto" style={{ background: 'var(--a-bg)' }}>
      <div className="sticky top-0 z-10"
      style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
        <div className="flex items-center gap-3 p-3">
          <motion.button onClick={onBack} className="a-icon-btn shrink-0" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-1.5" style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
              <Sparkles size={15} style={{ color: 'var(--a-accent-ink)' }} /> {tr("partnersscreen_partnyor_endirimleri_e44036", "Partnyor Endiriml\u0259ri")}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr("partnersscreen_spa_idman_gozellik_ve_daha_cox_24ad1f", "Spa, idman, g\xF6z\u0259llik v\u0259 daha \xE7ox")}</p>
          </div>
          {!isPremium &&
          <span className="flex items-center gap-1 shrink-0"
          style={{ background: 'var(--a-yellow-1)', color: 'var(--a-yellow-ink)', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
              <Crown className="w-3 h-3" /> Premium
            </span>
          }
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("partnersscreen_mekan_axtar_8b889d", "M\u0259kan axtar...")}
            className="w-full h-10 ps-10 pe-4 outline-none"
            style={{ borderRadius: 999, background: 'var(--a-surface)', border: '1px solid var(--a-line)', fontSize: 13, color: 'var(--a-ink)' }} />
          </div>
        </div>

        <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-hide">
          <CategoryPill active={category === 'all'} onClick={() => setCategory('all')} label={tr("partnersscreen_hamisi_c73c4d", "Ham\u0131s\u0131")} />
          {categories?.map((c) => {
            const label = localizeCategoryLabel(c, getPersistedLanguage());
            return (
              <CategoryPill key={c.key} active={category === c.key} onClick={() => setCategory(c.key)} label={label} />
            );
          })}
        </div>
      </div>

      <div className="p-3 space-y-3 max-w-md mx-auto">
        {isLoading &&
          <div className="py-10 flex justify-center">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
          </div>
        }

        {!isLoading && filtered.length === 0 &&
        <div className="a-card text-center" style={{ padding: '38px 18px' }}>
            <MapPin size={40} className="mx-auto mb-3" style={{ color: 'var(--a-ink-faint)' }} />
            <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{tr("partnersscreen_bu_kateqoriyada_hele_partnyor__9b10b6", "Bu kateqoriyada h\u0259l\u0259 partnyor yoxdur.")}</p>
          </div>
        }

        {filtered.map((v, i) =>
        <motion.button
          key={v.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => setSelectedVenue(v)}
          className="w-full overflow-hidden text-start"
          style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)' }}>

            {v.cover_url &&
          <div className="h-32 overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
                <img src={v.cover_url} alt={v.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
          }
            <div className="p-3 flex items-start gap-3">
              {v.logo_url ?
            <img src={v.logo_url} alt="" loading="lazy" decoding="async" className="w-12 h-12 object-cover shrink-0" style={{ borderRadius: 14, border: '1px solid var(--a-line)' }} /> :

            <div className="w-12 h-12 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-peach-1)' }}>
                  <Sparkles size={19} style={{ color: 'var(--a-accent-ink)' }} />
                </div>
            }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{v.name}</h3>
                  {v.is_featured && <span style={{ fontSize: 9, background: 'var(--a-yellow-1)', color: 'var(--a-yellow-ink)', padding: '2px 7px', borderRadius: 999, fontWeight: 800 }}>★</span>}
                </div>
                {v.address &&
              <p className="truncate flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>
                    <MapPin className="w-3 h-3 shrink-0" /> {v.address}
                  </p>
              }
                <div className="inline-flex items-center gap-1 mt-1.5"
              style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
                  <Sparkles className="w-3 h-3" /> {v.discount_label}
                </div>
              </div>
              <ChevronRight className="rtl:rotate-180 w-4 h-4 mt-3 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
            </div>
          </motion.button>
        )}
      </div>

      {selectedVenue &&
      <RedemptionQRSheet
        open={qrOpen}
        onClose={() => {setQrOpen(false);setSelectedVenue(null);}}
        venueId={selectedVenue.id}
        venueName={selectedVenue.name} />

      }

      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />
    </div>);

}

function CategoryPill({ active, onClick, label }: {active: boolean;onClick: () => void;label: string;}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 transition-colors"
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        background: active ? 'var(--a-peach-1)' : 'var(--a-surface)',
        color: active ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)',
        border: active ? '1.5px solid var(--a-peach-2)' : '1.5px solid var(--a-line)'
      }}>
      {label}</button>);

}

function VenueDetail({ venue, isPremium, onBack, onRedeem }: {venue: PartnerVenue;isPremium: boolean;onBack: () => void;onRedeem: () => void;}) {
  useScrollToTop();
  return (
    <div className="a-scope min-h-screen pb-32 overflow-y-auto" style={{ background: 'var(--a-bg)' }}>
      <div className="relative">
        {venue.cover_url ?
        <img src={venue.cover_url} alt={venue.name} className="w-full h-56 object-cover" /> :

        <div className="w-full h-56 flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
            <Sparkles size={60} style={{ color: 'var(--a-accent-ink)', opacity: 0.5 }} />
          </div>
        }
        <button onClick={onBack} className="a-icon-btn absolute top-3 start-3" style={{ borderRadius: 999 }} aria-label={tr("common_geri", "Geri")}>
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="p-4 -mt-8 relative max-w-md mx-auto">
        <div className="a-card" style={{ padding: 16 }}>
          <div className="flex items-start gap-3">
            {venue.logo_url &&
            <img src={venue.logo_url} alt="" className="w-14 h-14 object-cover -mt-8" style={{ borderRadius: 16, border: '3px solid var(--a-surface)' }} />
            }
            <div className="flex-1">
              <h1 style={{ fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{venue.name}</h1>
              {venue.address &&
              <p className="flex items-center gap-1 mt-1" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
                  <MapPin className="w-3 h-3" /> {venue.address}
                </p>
              }
            </div>
          </div>

          <div className="mt-3" style={{ background: 'var(--a-peach-1)', borderRadius: 16, padding: 14, border: '1px solid rgba(255,157,99,0.4)' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--a-accent-ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tr("partnersscreen_senin_endirimin_535d41", "S\u0259nin endirimin")}</p>
            <p className="mt-1" style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-accent-ink)' }}>{venue.discount_label}</p>
            {venue.discount_terms && <p className="mt-1" style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{venue.discount_terms}</p>}
          </div>

          {venue.description && <p className="mt-3 leading-relaxed whitespace-pre-line" style={{ fontSize: 13, color: 'var(--a-body-text)' }}>{venue.description}</p>}

          <div className="grid grid-cols-3 gap-2 mt-4">
            {venue.phone &&
            <a href={`tel:${venue.phone}`} className="flex flex-col items-center gap-1 p-2.5" style={{ background: 'var(--a-surface-soft)', borderRadius: 14 }}>
                <Phone size={16} style={{ color: 'var(--a-accent-ink)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("partnersscreen_zeng_4cba42", "Z\u0259ng")}</span>
              </a>
            }
            {venue.website &&
            <a href={venue.website} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2.5" style={{ background: 'var(--a-surface-soft)', borderRadius: 14 }}>
                <Globe size={16} style={{ color: 'var(--a-accent-ink)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("untranslated_veb_sayt_16w317", "Veb sayt")}</span>
              </a>
            }
            {venue.instagram &&
            <a href={`https://instagram.com/${venue.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2.5" style={{ background: 'var(--a-surface-soft)', borderRadius: 14 }}>
                <Instagram size={16} style={{ color: 'var(--a-accent-ink)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)' }}>Instagram</span>
              </a>
            }
            {venue.latitude && venue.longitude &&
            <a href={`https://maps.google.com/?q=${venue.latitude},${venue.longitude}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2.5" style={{ background: 'var(--a-surface-soft)', borderRadius: 14 }}>
                <MapPin size={16} style={{ color: 'var(--a-accent-ink)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("partnersscreen_xerite_a1e08d", "X\u0259rit\u0259")}</span>
              </a>
            }
          </div>

          {venue.gallery_urls && venue.gallery_urls.length > 0 &&
          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
              {venue.gallery_urls.map((g, i) =>
            <img key={i} src={g} alt="" loading="lazy" decoding="async" className="w-28 h-28 object-cover flex-shrink-0" style={{ borderRadius: 14 }} />
            )}
            </div>
          }
        </div>

        <div className="fixed start-0 end-0 bottom-0 p-4"
        style={{ background: 'linear-gradient(to top, var(--a-bg) 55%, transparent)', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
          <Button onClick={onRedeem} size="lg"
          className="w-full h-12 text-base font-bold rounded-full text-white border-0 max-w-md mx-auto flex hover:opacity-95"
          style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>
            {isPremium ?
            <><Sparkles className="w-5 h-5 me-2" />{tr("untranslated_endirimi_al_qr_yarat_6yd90i", "Endirimi al — QR yarat")}</> :

            <><Lock className="w-5 h-5 me-2" /> {tr("partnersscreen_premium_ile_endirim_al_634879", "Premium il\u0259 endirim al")}</>
            }
          </Button>
        </div>
      </div>
    </div>);

}
