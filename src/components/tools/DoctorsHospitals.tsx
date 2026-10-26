import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Star, MapPin, Phone, Globe, Clock,
  Stethoscope, Building2, User, ChevronRight, Filter, Heart,
  Mail, DollarSign, Calendar, X, GraduationCap, Award, Briefcase, Languages } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useAuth } from '@/hooks/useAuth';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import ProviderReviews from './doctors/ProviderReviews';
import { tr, mapRowsTranslation } from "@/lib/tr";
import { useUserStore } from '@/store/userStore';
import { localizedCountryName } from '@/lib/app-languages';
import { regionalCountry } from '@/lib/vaccine-schedule';
import { getBackendConfig } from '@/integrations/supabase/backend-config';

interface DoctorsHospitalsProps {
  onBack: () => void;
}

interface Service {
  name: string;
  name_az: string;
  price: number;
}

interface WorkingHours {
  [key: string]: string;
}

interface HealthcareProvider {
  id: string;
  name: string;
  name_az: string | null;
  provider_type: string;
  specialty: string | null;
  specialty_az: string | null;
  description: string | null;
  description_az: string | null;
  address: string | null;
  address_az: string | null;
  city: string | null;
  country_code: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  working_hours: unknown;
  services: unknown;
  image_url: string | null;
  rating: number;
  review_count: number;
  latitude: number | null;
  longitude: number | null;
  is_featured: boolean;
  accepts_reservations: boolean;
  sort_order?: number | null;
}

const getProviderTypeLabels = (): Record<string, {label: string;icon: typeof Stethoscope;}> => ({
  hospital: { label: tr("doctorshospitals_xestexana_04539b", 'Xəstəxana'), icon: Building2 },
  clinic: { label: tr("doctorshospitals_klinika_3c7a2d", "Klinika"), icon: Building2 },
  doctor: { label: tr("doctorshospitals_hekim_c127f7", 'Həkim'), icon: User }
});

const getSpecialtyCategories = () => [
{ id: 'all', label: tr("doctorshospitals_hamisi_c73c4d", 'Hamısı'), emoji: '✨' },
{ id: 'hospital', label: tr("doctorshospitals_xestexana_04539b", 'Xəstəxana'), emoji: '🏥' },
{ id: 'gynecology', label: tr("common_ginekologiya", 'Ginekologiya'), emoji: '👩‍⚕️' },
{ id: 'ivf', label: 'IVF', emoji: '🔬' },
{ id: 'pediatrics', label: tr("common_pediatriya", 'Pediatriya'), emoji: '👶' },
{ id: 'mammology', label: tr("common_mamologiya", 'Mamologiya'), emoji: '🩺' }];


const getDayLabels = (): Record<string, string> => ({
  monday: tr("doctorshospitals_bazar_ertesi_4c733b", "Bazar ert\u0259si"),
  tuesday: tr("doctorshospitals_cersenbe_axsami_01435c", "\xC7\u0259r\u015F\u0259nb\u0259 ax\u015Fam\u0131"),
  wednesday: tr("doctorshospitals_cersenbe_50bb90", "\xC7\u0259r\u015F\u0259nb\u0259"),
  thursday: tr("doctorshospitals_cume_axsami_8a8cf4", "C\xFCm\u0259 ax\u015Fam\u0131"),
  friday: tr("doctorshospitals_cume_faba24", "C\xFCm\u0259"),
  saturday: tr("doctorshospitals_senbe_02045c", "\u015E\u0259nb\u0259"),
  sunday: tr("common_bazar", 'Bazar')
});

const parseDescription = (text: string) => {
  if (!text) return { basicDescription: '' };
  
  const result: any = {
    experience: '',
    languages: '',
    education: '',
    master: '',
    interests: '',
    servicesList: '',
    basicDescription: ''
  };

  const lines = text.split('\n');
  const remainingLines: string[] = [];
  
  let parsingHeaders = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (parsingHeaders) {
      if (line.startsWith('Təcrübə:')) result.experience = line.replace('Təcrübə:', '').trim();
      else if (line.startsWith('Dillər:')) result.languages = line.replace('Dillər:', '').trim();
      else if (line.startsWith('Təhsil:')) result.education = line.replace('Təhsil:', '').trim();
      else if (line.startsWith('Magistr:')) result.master = line.replace('Magistr:', '').trim();
      else if (line.startsWith('Maraq sahələri:')) result.interests = line.replace('Maraq sahələri:', '').trim();
      else if (line.startsWith('Xidmətlər:')) result.servicesList = line.replace('Xidmətlər:', '').trim();
      else if (line === '') {
         // skip empty lines
      } else {
         parsingHeaders = false;
         remainingLines.push(line);
      }
    } else {
       remainingLines.push(line);
    }
  }
  
  result.basicDescription = remainingLines.join('\n').trim();
  
  if (!result.experience && !result.languages && !result.education && !result.interests && !result.servicesList) {
    return { basicDescription: text };
  }
  
  return result;
};

const DoctorsHospitals = ({ onBack }: DoctorsHospitalsProps) => {
  useScrollToTop();
  useScreenAnalytics('DoctorsHospitals', 'Tools');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<HealthcareProvider | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const language = useUserStore((state) => state.language);
  const providerTypeLabels = getProviderTypeLabels();
  const specialtyCategories = getSpecialtyCategories();
  const storeCountry = useUserStore((state) => state.countryCode);
  const { profile: dhProfile } = useAuth();
  // Saved account country is authoritative; language only suggests a country
  // when no country has been selected. This never writes the account country.
  const activeCountry = regionalCountry(language, dhProfile?.country_code, storeCountry);

  const { data: providers = [], isLoading } = useQuery({
    // QEYD: queryKey-də `language` YOXDUR — dil dəyişəndə sorğu YENİDƏN getmir,
    // yalnız aşağıdakı mapRowsTranslation həmin renderdə mətni tərcümə edir.
    // Bununla siyahının tərkibi (hansı provider-lər göstərilir) heç vaxt dilə bağlı olmur.
    queryKey: ['healthcare-providers', activeCountry, getBackendConfig().url],
    queryFn: async () => {
      const { data, error } = (await supabase.
      from('healthcare_providers').
      select('*').
      eq('is_active', true).
      eq('country_code', activeCountry).
      order('is_featured', { ascending: false }).
      order('rating', { ascending: false })) as {data: HealthcareProvider[] | null;error: unknown;};
      if (error) throw error;
      return data || [];
    }
  });

  // Tərcümə render zamanı, cari dilə görə — providers massivinin özü (server sorğusu)
  // dildən asılı deyil, yalnız bu massivin GÖSTƏRİLƏN mətni dilə görə dəyişir.
  const translatedProviders = mapRowsTranslation(providers, language, ['name', 'specialty', 'description', 'address']).map((p: any) => {
    let services = p.services;
    if (Array.isArray(services)) {
      services = services.map((s: any) => ({
        ...s,
        name: language === 'az' ? (s.name_az ?? s.name) : (s[`name_${language}`] ?? s.name_az ?? s.name)
      }));
    }
    return { ...p, services };
  }) as HealthcareProvider[];

  const filteredProviders = translatedProviders.filter((provider) => {
    const matchesSearch = (provider.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (provider.specialty || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = false;
    if (activeFilter === 'all') {
      matchesFilter = true;
    } else if (activeFilter === 'hospital') {
      matchesFilter = provider.provider_type === 'hospital' || provider.provider_type === 'clinic';
    } else if (activeFilter === 'gynecology') {
      matchesFilter = provider.provider_type === 'doctor' && (
      (provider.specialty || '').toLowerCase().includes('ginekoloq') ||
      (provider.specialty || '').toLowerCase().includes('mama'));
    } else if (activeFilter === 'ivf') {
      matchesFilter = provider.provider_type === 'doctor' && (
      (provider.specialty || '').toLowerCase().includes('ivf') ||
      (provider.specialty || '').toLowerCase().includes('fertillik'));
    } else if (activeFilter === 'pediatrics') {
      matchesFilter = provider.provider_type === 'doctor' && (
      (provider.specialty || '').toLowerCase().includes('pediatr') ||
      (provider.specialty || '').toLowerCase().includes('neonatoloq') ||
      (provider.specialty || '').toLowerCase().includes(tr("doctorshospitals_usaq_36b348", "u\u015Faq")));
    } else if (activeFilter === 'mammology') {
      matchesFilter = provider.provider_type === 'doctor' && (
      (provider.specialty || '').toLowerCase().includes('mamoloq') ||
      (provider.specialty || '').toLowerCase().includes('onkoloq'));
    }

    return matchesSearch && matchesFilter;
  });

  // Reservation handler - prepared but not active
  const handleReservation = (provider: HealthcareProvider) => {
    // This function is ready but disabled
    // setShowReservationModal(true);
    console.log('Reservation feature is disabled');
  };

  const selected = translatedProviders.find(provider => provider.id === selectedProvider?.id);
  if (selected) {
    return (
      <ProviderDetail
        provider={selected}
        onBack={() => setSelectedProvider(null)}
        onReserve={handleReservation} />);


  }

  return (
    <div className="a-scope pb-24" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr("doctorshospitals_klinika_3c7a2d", "Klinika")} · {tr("doctorshospitals_hekim_c127f7", 'Həkim')}</p>
              <p className="a3-tool-title">{tr("doctorshospitals_hekimler_ve_xestexanalar_b29ffa", "H\u0259kiml\u0259r v\u0259 X\u0259st\u0259xanalar")}</p>
            </div>
          </div>
        </header>
        <p className="a-list-sub" data-testid="healthcare-country">{localizedCountryName(activeCountry, language)}</p>

        {/* Search */}
        <div className="a-search">
          <Search size={15} strokeWidth={2} color="var(--a-ink-faint)" />
          <input
            type="text"
            placeholder={tr("doctorshospitals_hekim_xestexana_axtar_be2094", "Həkim, xəstəxana axtar...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          
        </div>

        {/* Filter chips */}
        <div className="a-tag-row hide-scrollbar" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginTop: 12, marginBottom: 0, paddingBottom: 4 }}>
          {specialtyCategories.map((filter) =>
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`a-tag${activeFilter === filter.id ? ' on' : ''}`}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            
              <span>{filter.emoji}</span>
              {filter.label}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-3 space-y-2.5">
          {isLoading ?
          Array(4).fill(0).map((_, i) =>
          <div key={i} className="a-card animate-pulse">
                <div className="flex gap-3">
                  <div style={{ width: 64, height: 64, borderRadius: 15, background: 'var(--a-surface-soft)', flexShrink: 0 }} />
                  <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 16, width: '75%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
                    <div style={{ height: 12, width: '50%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
                    <div style={{ height: 12, width: '66%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
                  </div>
                </div>
              </div>
          ) :
          filteredProviders.length === 0 ?
          <div className="a-card" style={{ textAlign: 'center', padding: '32px 18px' }}>
              <Building2 size={40} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} />
              <p className="a-list-sub" style={{ margin: 0 }}>
                {providers.length === 0 ?
              tr("doctorshospitals_bu_olke_ucun_helelik_siyahi_yoxdur", "Ölkəniz üçün hələlik siyahı yoxdur — tezliklə əlavə olunacaq") :
              tr("doctorshospitals_hec_bir_netice_tapilmadi_5745d9", "Heç bir nəticə tapılmadı")}
              </p>
            </div> :

          filteredProviders.map((provider, index) =>
          <motion.button
            key={provider.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.3) }}
            onClick={() => setSelectedProvider(provider)}
            className="a-card w-full text-start"
            style={{ padding: '14px 16px', cursor: 'pointer' }}>
            
                <div className="flex gap-3">
                  {/* Image */}
                  <span className="a-article-thumb" style={{ width: 64, height: 64, background: 'var(--a-peach-1)' }}>
                    {provider.image_url ?
                <img src={provider.image_url} alt={provider.name} loading="lazy" decoding="async" /> :

                <Building2 size={24} style={{ color: 'var(--a-accent-ink)' }} />
                }
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div style={{ minWidth: 0 }}>
                        {provider.is_featured &&
                    <span className="a-partner-recommended" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: 'var(--a-yellow-ink)', marginBottom: 2 }}>
                            ⭐ {tr("doctorshospitals_tovsiyye_olunan_626cbb", "\u2B50 T\xF6vsiyy\u0259 olunan").replace('⭐ ', '')}
                          </span>
                    }
                        <h3 className="a-list-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.name}</h3>
                      </div>
                      <ChevronRight size={15} className="rtl:rotate-180 a-list-chevron" style={{ marginTop: 3 }} />
                    </div>
                    
                    <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--a-peach-2)', fontWeight: 600 }}>
                      {(() => {
                    const TypeIcon = providerTypeLabels[provider.provider_type]?.icon || Building2;
                    return <TypeIcon size={11} />;
                  })()}
                      <span>{providerTypeLabels[provider.provider_type]?.label || provider.provider_type}</span>
                      {provider.specialty &&
                  <span style={{ color: 'var(--a-ink-soft)' }}> · {provider.specialty}</span>
                  }
                    </p>

                    {provider.address &&
                <p className="a-list-sub" style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <MapPin size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.address}</span>
                      </p>
                }

                    {provider.rating > 0 &&
                <p style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, fontWeight: 800, color: 'var(--a-ink)' }}>
                        <Star size={12} style={{ fill: 'var(--a-yellow-2)', color: 'var(--a-yellow-2)' }} />
                        {provider.rating.toFixed(1)}
                        {provider.review_count > 0 &&
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--a-ink-faint)' }}>({provider.review_count})</span>
                  }
                      </p>
                }
                  </div>
                </div>
              </motion.button>
          )
          }
        </div>
      </div>
    </div>);

};

interface ProviderDetailProps {
  provider: HealthcareProvider;
  onBack: () => void;
  onReserve: (provider: HealthcareProvider) => void;
}

const ProviderDetail = ({ provider, onBack, onReserve }: ProviderDetailProps) => {
  const providerTypeLabels = getProviderTypeLabels();
  const dayLabels = getDayLabels();
  const TypeIcon = providerTypeLabels[provider.provider_type]?.icon || Building2;
  const queryClient = useQueryClient();

  // Subscribe to realtime updates for this provider's reviews
  useEffect(() => {
    const channel = supabase.
    channel(`provider-${provider.id}`).
    on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'healthcare_provider_reviews',
        filter: `provider_id=eq.${provider.id}`
      },
      () => {
        // Refresh only this provider's reviews + rating, not the whole provider list
        queryClient.invalidateQueries({ queryKey: ['provider-reviews', provider.id] });
        queryClient.invalidateQueries({ queryKey: ['healthcare-provider', provider.id] });
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [provider.id, queryClient]);

  // Fetch latest provider data for real-time rating updates
  const { data: latestProvider } = useQuery({
    queryKey: ['healthcare-provider', provider.id],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('healthcare_providers').
      select('rating, review_count').
      eq('id', provider.id).
      single();
      if (error) throw error;
      return data;
    }
  });

  const currentRating = latestProvider?.rating ?? provider.rating;
  const currentReviewCount = latestProvider?.review_count ?? provider.review_count;

  const parsedDesc = parseDescription(provider.description || '');

  return (
    <div className="a-scope pb-24" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      {/* Hero */}
      <div className="relative h-48" style={{ background: 'var(--a-grad-peach)' }}>
        {provider.image_url &&
        <img
          src={provider.image_url}
          alt={provider.name}
          className="w-full h-full object-cover" />

        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--a-bg), transparent 60%)' }} />
        <button
          onClick={onBack}
          className="a-icon-btn absolute top-4 start-4">
          
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Content */}
      <div className="a-shell -mt-12 relative z-10">
        {/* Main Card */}
        <div className="a-card mb-3">
          {provider.is_featured &&
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: 'var(--a-yellow-ink)', marginBottom: 6 }}>
              {tr("doctorshospitals_tovsiyye_olunan_626cbb", "⭐ Tövsiyyə olunan")}
            </span>
          }
          
          <h1 className="a-heading" style={{ margin: '0 0 4px', fontSize: 19, color: 'var(--a-ink)' }}>{provider.name}</h1>
          
          <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 10px', color: 'var(--a-peach-2)', fontWeight: 600 }}>
            <TypeIcon size={13} />
            <span>{providerTypeLabels[provider.provider_type]?.label}</span>
            {provider.specialty &&
            <span style={{ color: 'var(--a-ink-soft)' }}> · {provider.specialty}</span>
            }
          </p>

          {currentReviewCount > 0 && <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) =>
              <Star
                key={star}
                size={15}
                style={star <= Math.round(currentRating) ? { fill: 'var(--a-yellow-2)', color: 'var(--a-yellow-2)' } : { color: 'var(--a-line-strong)' }} />

              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--a-ink)' }}>{currentRating > 0 ? currentRating.toFixed(1) : '0.0'}</span>
            <span className="a-list-sub" style={{ margin: 0 }}>({currentReviewCount} {tr("doctorshospitals_rey_f2285f", "rəy)")}</span>
          </div>}

          {/* Detailed Badges */}
          {(parsedDesc.experience || parsedDesc.languages || parsedDesc.education) &&
          <div className="a-tag-row" style={{ marginBottom: 12 }}>
            {parsedDesc.experience &&
              <span className="a-tag" style={{ cursor: 'default', background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                <Briefcase size={11} />
                {parsedDesc.experience}
              </span>
            }
            {parsedDesc.languages &&
              <span className="a-tag" style={{ cursor: 'default', background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                <Languages size={11} />
                {parsedDesc.languages}
              </span>
            }
            {parsedDesc.education &&
              <span className="a-tag" style={{ cursor: 'default', background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
                <GraduationCap size={11} />
                {parsedDesc.education}
              </span>
            }
          </div>
          }

          {parsedDesc.basicDescription &&
            <p className="a-cta-text" style={{ whiteSpace: 'pre-wrap' }}>{parsedDesc.basicDescription}</p>
          }
        </div>

        {/* Interests and Services */}
        {parsedDesc.interests && (
          <div className="a-card mb-3">
            <div className="a-card-head" style={{ marginBottom: 10 }}>
              <h2 className="a-card-title a-heading">❤️ {tr("doctorshospitals_maraq_saheleri", "Maraq sahələri")}</h2>
            </div>
            <div className="a-tag-row" style={{ marginBottom: 0 }}>
              {parsedDesc.interests.split(',').map((interest: string, i: number) => (
                <span key={i} className="a-tag" style={{ cursor: 'default' }}>
                  {interest.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {parsedDesc.servicesList && (
          <div className="a-card mb-3">
            <div className="a-card-head" style={{ marginBottom: 10 }}>
              <h2 className="a-card-title a-heading">🩺 {tr("doctorshospitals_xidmetler", "Xidmətlər")}</h2>
            </div>
            <ul className="space-y-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {parsedDesc.servicesList.split(',').map((service: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--a-peach-2)', marginTop: 6, flexShrink: 0 }} />
                  <span className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{service.trim()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact Info */}
        <div className="a-list-card mb-3">
          <div className="a-list-row" style={{ paddingBottom: 4 }}>
            <p className="a-card-title a-heading" style={{ margin: 0 }}>{tr("doctorshospitals_elaqe_melumatlari_ddd442", "Əlaqə məlumatları")}</p>
          </div>
          
          {provider.address &&
          <div className="a-list-row">
              <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                <MapPin size={17} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("doctorshospitals_unvan_b8651a", "Ünvan")}</p>
                <p className="a-list-title" style={{ whiteSpace: 'normal' }}>{provider.address}{provider.city ? `, ${provider.city}` : ''}</p>
              </div>
            </div>
          }

          {provider.phone &&
          <a href={`tel:${provider.phone}`} className="a-list-row" style={{ textDecoration: 'none' }}>
              <span className="a-list-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
                <Phone size={17} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("untranslated_telefon_vwjgg5", "Telefon")}</p>
                <p className="a-list-title" style={{ color: 'var(--a-accent-ink)' }}>{provider.phone}</p>
              </div>
            </a>
          }

          {provider.email &&
          <a href={`mailto:${provider.email}`} className="a-list-row" style={{ textDecoration: 'none' }}>
              <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
                <Mail size={17} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("doctorshospitals_e_poct_f5c193", "E-poçt")}</p>
                <p className="a-list-title" style={{ color: 'var(--a-accent-ink)' }}>{provider.email}</p>
              </div>
            </a>
          }

          {provider.website &&
          <a href={provider.website} target="_blank" rel="noopener noreferrer" className="a-list-row" style={{ textDecoration: 'none' }}>
              <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
                <Globe size={17} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-list-sub" style={{ margin: 0 }}>{tr("untranslated_vebsayt_7bupzh", "Vebsayt")}</p>
                <p className="a-list-title" style={{ color: 'var(--a-accent-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.website}</p>
              </div>
            </a>
          }
        </div>

        {/* Working Hours */}
        {provider.working_hours && typeof provider.working_hours === 'object' && Object.keys(provider.working_hours as Record<string, string>).length > 0 &&
        <div className="a-card mb-3">
            <div className="a-card-head" style={{ marginBottom: 10 }}>
              <h2 className="a-card-title a-heading">🕐 {tr("doctorshospitals_is_saatlari_cfa6fe", "İş saatları")}</h2>
            </div>
            <div className="space-y-2">
              {Object.entries(provider.working_hours as Record<string, string>).map(([day, hours]) =>
            <div key={day} className="flex justify-between">
                  <span className="a-list-sub" style={{ margin: 0 }}>{dayLabels[day] || day}</span>
                  <span className="a-list-value" style={{ color: 'var(--a-ink)' }}>{hours}</span>
                </div>
            )}
            </div>
          </div>
        }

        {/* Services */}
        {provider.services && Array.isArray(provider.services) && provider.services.length > 0 &&
        <div className="a-card mb-3">
            <div className="a-card-head" style={{ marginBottom: 6 }}>
              <h2 className="a-card-title a-heading">💰 {tr("doctorshospitals_xidmetler_ve_qiymetler_8e63a7", "Xidmətlər və qiymətlər")}</h2>
            </div>
            <div>
              {(provider.services as Service[]).map((service, index) =>
            <div key={index} className="a-rank-row" style={{ padding: '10px 0' }}>
                  <span className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal', flex: 1 }}>{service.name}</span>
                  <span className="a-rank-tag intensive">
                    {service.price} AZN
                  </span>
                </div>
            )}
            </div>
          </div>
        }

        {/* Reviews Section */}
        <ProviderReviews providerId={provider.id} providerName={provider.name} />

        {/* Reserve Button - Disabled for now */}
        {provider.accepts_reservations &&
        <button
          className="a-btn-solid w-full"
          style={{ justifyContent: 'center', padding: '13px 18px', marginTop: 12, opacity: 0.5, cursor: 'not-allowed' }}
          disabled={true}
          onClick={() => onReserve(provider)}>
          
            <Calendar size={15} strokeWidth={2.2} />
            {tr("doctorshospitals_rezervasiya_et_tezlikle_225276", "Rezervasiya et (Tezlikl\u0259)")}
          </button>
        }
      </div>
    </div>);

};

export default DoctorsHospitals;
