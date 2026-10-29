import { useState, useMemo, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Heart, Shuffle, Star, X, Sparkles, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFavoriteNames } from '@/hooks/useFavoriteNames';
import { useBabyNames } from '@/hooks/useDynamicContent';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { tr, mapRowTranslation } from "@/lib/tr";
import { NEW_LANGUAGE_CODES, localizedCountryName } from '@/lib/app-languages';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { regionalCountry } from '@/lib/vaccine-schedule';
import { followupText } from '@/lib/followup-i18n';
import { nameCollectionLanguage } from '@/lib/name-collections';
import { AdInlineAnchor, AdSurface } from '@/components/ads/AdExperienceProvider';

interface BabyNamesProps {
  onBack: () => void;
}

const NAMES_PAGE_SIZE = 60;

const BabyNames = forwardRef<HTMLDivElement, BabyNamesProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('BabyNames', 'Tools');

  const language = useUserStore((state) => state.language);
  const storedCountry = useUserStore(state => state.countryCode);
  const { profile } = useAuth();
  const country = regionalCountry(language, profile?.country_code, storedCountry);
  const international = (NEW_LANGUAGE_CODES as readonly string[]).includes(language);
  const curatedCollection = (NEW_LANGUAGE_CODES as readonly string[]).includes(nameCollectionLanguage(country, language));
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'boy' | 'girl'>('all');
  const [selectedName, setSelectedName] = useState<any | null>(null);
  const { favorites, loading: favsLoading, toggleFavorite, isFavorite } = useFavoriteNames();
  const { data: names = [], isLoading } = useBabyNames(country);
  const queryClient = useQueryClient();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'notfound' | 'error'>('idle');

  // Bazada tapılmayan adı AI ilə axtar → mənası istifadəçi dilində göstərilir
  // və baza zənginləşir (safety alətindəki pattern)
  const handleAiSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2 || aiLoading) return;
    setAiLoading(true);
    setAiStatus('idle');
    try {
      trackEvent('baby_names_ai_lookup', { name: q });
      const { data, error } = await supabase.functions.invoke('name-ai-lookup', {
        body: { name: q, language }
      });
      if (error || !data?.success) throw error || new Error('lookup failed');
      if (!data.found) {
        setAiStatus('notfound');
        return;
      }
      // Siyahını yenilə (ad artıq bazadadır) və detal modalını aç
      queryClient.invalidateQueries({ queryKey: ['baby_names'] });
      const localized = international && data.item ? mapRowTranslation(data.item, language, ['meaning', 'origin']) : null;
      setSelectedName({
        id: data.item?.id || `ai-${Date.now()}`,
        name: data.display.name,
        gender: data.display.gender,
        meaning: localized?.meaning || data.display.meaning,
        origin: localized?.origin || data.display.origin,
        popularity: data.display.popularity
      });
    } catch (e) {
      console.error('AI name lookup failed:', e);
      setAiStatus('error');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredNames = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return names.filter((name) => {
      const matchesSearch = name.name.toLowerCase().includes(q) ||
        (name.meaning || '').toLowerCase().includes(q);
      const matchesGender = genderFilter === 'all' || name.gender === genderFilter || name.gender === 'unisex';
      return matchesSearch && matchesGender;
    }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [names, searchQuery, genderFilter]);

  // Böyük siyahıları hissə-hissə render et (zəif cihazlarda donmanın qarşısı)
  const [visibleCount, setVisibleCount] = useState(NAMES_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(NAMES_PAGE_SIZE);
  }, [searchQuery, genderFilter, country]);
  const visibleNames = useMemo(() => filteredNames.slice(0, visibleCount), [filteredNames, visibleCount]);

  const handleToggleFavorite = (name: any) => {
    toggleFavorite(name.name, name.gender, name.meaning, name.origin);
  };

  const getRandomName = () => {
    const filtered = genderFilter === 'all' ? names : names.filter((n) => n.gender === genderFilter || n.gender === 'unisex');
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    if (random) setSelectedName(random);
  };

  if (isLoading || favsLoading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--a-bg)' }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
      </div>);

  }

  return (
    <div ref={ref} className="a-scope pb-24" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <AdSurface id="baby_names_banner" enabled={!selectedName && !aiLoading} />
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow" data-name-country>{followupText('names_country', language, { country: localizedCountryName(country, language) })} · {names.length}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("babynames_korpe_adlari_357880", "Körpə Adları")}</p>
            </div>
          </div>
          <div className="a-topbar-actions">
            <motion.button
              onClick={getRandomName}
              className="a-icon-btn"
              style={{ background: 'var(--a-peach-2)', color: '#fff', border: 'none' }}
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}>

              <Shuffle size={15} strokeWidth={2.2} />
            </motion.button>
          </div>
        </header>

        {/* Search */}
        <div className="a-search">
          <Search size={15} strokeWidth={2} color="var(--a-ink-faint)" />
          <input
            type="text"
            placeholder={tr("babynames_ad_ve_ya_mena_axtarin_30a88e", "Ad və ya məna axtarın...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />

        </div>

        {/* Gender Filter Pills */}
        <AdInlineAnchor id="baby_names_banner" />
        <div className="a-tabs" style={{ display: 'flex', width: '100%', marginTop: 12 }}>
          {[
            { id: 'all', label: `✨ ${tr("babynames_hamisi_c73c4d", 'Hamısı')}` },
            { id: 'boy', label: `👦 ${tr("babynames_oglan_e9715e", 'Oğlan')}` },
            { id: 'girl', label: `👧 ${tr("babynames_qiz_79bf6b", 'Qız')}` }].
            map((filter) =>
              <button
                key={filter.id}
                onClick={() => setGenderFilter(filter.id as any)}
                className={`a-tab${genderFilter === filter.id ? ' active' : ''}`}
                style={{ flex: 1 }}>

                {filter.label}
              </button>
            )}
        </div>

        {/* Favorites Section - Horizontal Scroll */}
        {favorites.length > 0 &&
          <section className="a-section" style={{ marginTop: 16 }}>
            <div className="a-section-head" style={{ marginBottom: 8 }}>
              <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>
                💗 {tr("babynames_secilmisler_cc04b8", "Se\xE7ilmi\u015Fl\u0259r")}
              </h3>
              <span className="a-section-link">{favorites.length}</span>
            </div>
            <div className="a-tag-row hide-scrollbar" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 0, paddingBottom: 4 }}>
              {favorites.map((fav) =>
                <span
                  key={fav.id}
                  className="a-tag"
                  style={{ cursor: 'default', flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--a-pink-1)', color: 'var(--a-berry-ink)', fontWeight: 700 }}>

                  {fav.name}
                </span>
              )}
            </div>
          </section>
        }

        {/* Results */}
        <section className="a-section" style={{ marginTop: favorites.length > 0 ? 16 : 20 }}>
          <div className="a-section-head">
            <h3 className="a-section-title a-heading" style={{ fontSize: 15 }}>
              {tr("babynames_neticeler_15e2bd", "N\u0259tic\u0259l\u0259r")}
            </h3>
            <span className="a-section-link">
              {filteredNames.length} {tr("babynames_ad_count_3c7a2d", "ad")}
            </span>
          </div>

          {/* Names List */}
          {curatedCollection && <p className="a-list-sub mb-3">{followupText('names_catalog_source', language)}: <a href="https://github.com/faker-js/faker/tree/v9.9.0/src/locales" target="_blank" rel="noopener noreferrer">Faker v9.9.0 · MIT</a></p>}
          {filteredNames.length > 0 &&
          <div className="a-list-card">
            {visibleNames.map((name) =>
              <div
                key={name.id}
                onClick={() => setSelectedName(name)}
                className="a-list-row"
                style={{ cursor: 'pointer' }}>

                {/* Gender Indicator */}
                <span
                  className="a-list-icon"
                  style={{ fontSize: 17, background: name.gender === 'boy' ? 'var(--a-blue-1)' : name.gender === 'girl' ? 'var(--a-pink-1)' : 'var(--a-lav-1)' }}>
                  {name.gender === 'boy' ? '👦' : name.gender === 'girl' ? '👧' : '✨'}
                </span>

                {/* Name & Meaning */}
                <div className="flex-1 min-w-0">
                  <p className="a-list-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {name.name}
                    {(name.popularity || 0) >= 80 &&
                      <Star size={12} style={{ color: 'var(--a-yellow-2)', fill: 'var(--a-yellow-2)' }} />
                    }
                  </p>
                  <p className="a-list-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.meaning || followupText('names_no_meaning', language)}</p>
                </div>

                {/* Popularity mini bar */}
                <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!!name.popularity && <span style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--a-line-strong)', overflow: 'hidden', display: 'block' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        borderRadius: 999,
                        width: `${name.popularity || 0}%`,
                        background: name.gender === 'boy' ? 'var(--a-grad-blue)' : name.gender === 'girl' ? 'var(--a-grad-pink)' : 'var(--a-grad-lav)'
                      }} />
                  </span>}

                  {/* Favorite Button */}
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(name);
                    }}
                    className="a-icon-btn"
                    style={{ width: 30, height: 30, ...(isFavorite(name.name) ? { background: 'var(--a-pink-1)', border: 'none' } : {}) }}
                    whileTap={{ scale: 0.85 }}>

                    <Heart size={13} style={isFavorite(name.name) ? { color: '#e05575', fill: '#e05575' } : { color: 'var(--a-ink-soft)' }} />
                  </motion.button>
                </span>
              </div>
            )}
          </div>
          }
          {filteredNames.length > visibleCount &&
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + NAMES_PAGE_SIZE)}
              className="a-tab"
              style={{ display: 'block', width: '100%', marginTop: 12 }}>
              {tr('community_load_more', 'Daha çox göstər')}
            </button>
          }

          {filteredNames.length === 0 &&
            <motion.div
              className="a-card text-center"
              style={{ padding: '36px 18px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}>

              <Search size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 10px' }} />
              <p className="a-list-title" style={{ marginBottom: 3 }}>{tr("babynames_ad_tapilmadi_cf4c7a", "Ad tapılmadı")}</p>
              <p className="a-list-sub" style={{ margin: 0 }}>
                {aiStatus === 'notfound' ?
                tr("babynames_ai_notfound", "AI bu adı tanımadı — yazılışı yoxlayın") :
                aiStatus === 'error' ?
                tr("babynames_ai_error", "AI axtarışı alınmadı — yenidən cəhd edin") :
                tr("babynames_axtaris_sorgusunu_deyisin_992b5e", "Axtarış sorğusunu dəyişin")}
              </p>

              {/* AI axtarış — ad bazada yoxdursa mənasını AI tapıb bazaya yazır */}
              {searchQuery.trim().length >= 2 &&
              <motion.button
                onClick={handleAiSearch}
                disabled={aiLoading}
                className="a-btn-solid"
                style={{ marginTop: 14, justifyContent: 'center', opacity: aiLoading ? 0.6 : 1 }}
                whileTap={{ scale: aiLoading ? 1 : 0.97 }}>
                  {aiLoading ?
                <><Loader2 size={15} className="animate-spin" /> {tr("babynames_ai_searching", "AI axtarır...")}</> :
                <><Sparkles size={15} strokeWidth={2.2} /> {tr("babynames_ai_search", "AI ilə axtar: {name}").replace('{name}', searchQuery.trim())}</>}
                </motion.button>
              }
            </motion.div>
          }
        </section>
      </div>

      {/* Name Detail Modal */}
      <AnimatePresence>
        {selectedName &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedName(null)}>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="a-scope w-full max-w-sm overflow-hidden"
              style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-lg)', boxShadow: 'var(--a-card-shadow)' }}>

              {/* Modal Header */}
              <div
                className="p-6 text-center relative"
                style={{ background: selectedName.gender === 'boy' ? 'var(--a-grad-blue)' : selectedName.gender === 'girl' ? 'var(--a-grad-pink)' : 'var(--a-grad-lav)' }}>
                {(() => {
                  const ink = selectedName.gender === 'boy' ? 'var(--a-blue-ink)' : selectedName.gender === 'girl' ? 'var(--a-alert-ink)' : 'var(--a-lav-ink)';
                  return (
                    <>
                      <button
                        onClick={() => setSelectedName(null)}
                        className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }}>

                        <X size={15} style={{ color: ink }} />
                      </button>

                      <motion.div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3"
                        style={{ background: 'var(--a-chip-overlay)' }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}>

                        {selectedName.gender === 'boy' ? '👦' : selectedName.gender === 'girl' ? '👧' : '✨'}
                      </motion.div>

                      <h2 className="a-heading" style={{ margin: '0 0 6px', fontSize: 24, color: ink }}>{selectedName.name}</h2>
                      <div className="flex items-center justify-center gap-2">
                        <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: ink, padding: '4px 10px', fontSize: 10 }}>
                          {selectedName.gender === 'boy' ? tr("babynames_oglan_e9715e", "O\u011Flan") : selectedName.gender === 'girl' ? tr("babynames_qiz_79bf6b", "Q\u0131z") : 'Unisex'}
                        </span>
                        <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: ink, padding: '4px 10px', fontSize: 10 }}>
                          {selectedName.origin || tr('baby_name_origin_unspecified', 'Mənşə qeyd edilməyib')}
                        </span>
                      </div>
                    </>);
                })()}
              </div>

              <div className="p-5">
                {/* Meaning */}
                <div className="mb-4">
                  <p className="a-today-info-eyebrow" style={{ marginBottom: 3 }}>{tr("babynames_menasi_83a157", "Mənası")}</p>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--a-ink)', lineHeight: 1.5 }}>{selectedName.meaning || followupText('names_no_meaning', language)}</p>
                </div>

                {/* Popularity */}
                {!!selectedName.popularity && <div className="a-stat-tile mb-5" style={{ justifyContent: 'space-between' }}>
                  <span className="a-stat-tile-label" style={{ fontSize: 11.5 }}>{tr("babynames_populyarliq_1501b1", "Populyarlıq")}</span>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 80, height: 6, borderRadius: 999, background: 'var(--a-line-strong)', overflow: 'hidden' }}>
                      <motion.div
                        style={{ height: '100%', borderRadius: 999, background: selectedName.gender === 'boy' ? 'var(--a-grad-blue)' : selectedName.gender === 'girl' ? 'var(--a-grad-pink)' : 'var(--a-grad-lav)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedName.popularity || 0}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }} />

                    </div>
                    <span className="a-stat-tile-value" style={{ fontSize: 13 }}>{selectedName.popularity || 0}%</span>
                  </div>
                </div>}

                {/* Add to Favorites Button */}
                <motion.button
                  onClick={() => {
                    handleToggleFavorite(selectedName);
                    setSelectedName(null);
                  }}
                  className={isFavorite(selectedName.name) ? 'a-btn-soft w-full' : 'a-btn-solid w-full'}
                  style={{ justifyContent: 'center', padding: '13px 18px', ...(isFavorite(selectedName.name) ? {} : { background: 'var(--a-pink-2)' }) }}
                  whileTap={{ scale: 0.98 }}>

                  <Heart size={15} strokeWidth={2.2} fill={isFavorite(selectedName.name) ? 'none' : 'currentColor'} />
                  {isFavorite(selectedName.name) ? tr("babynames_secilmislerden_cixar_69b878", "Se\xE7ilmi\u015Fl\u0259rd\u0259n \xE7\u0131xar") : tr("babynames_secilmislere_elave_et_d53f1e", "Se\xE7ilmi\u015Fl\u0259r\u0259 \u0259lav\u0259 et")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

});

BabyNames.displayName = 'BabyNames';

export default BabyNames;
