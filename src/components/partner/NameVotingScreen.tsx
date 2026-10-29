import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Search, Sparkles, Users } from 'lucide-react';
import { useFavoriteNames } from '@/hooks/useFavoriteNames';
import { usePartnerFavoriteNames } from '@/hooks/usePartnerFavoriteNames';
import { useBabyNames } from '@/hooks/useDynamicContent';

interface NameVotingScreenProps {
  onBack: () => void;
}

const genderLabels: Record<string, string> = {
  boy: tr("namevotingscreen_oglan_e9715e", "O\u011Flan"),
  girl: tr("namevotingscreen_qiz_79bf6b", "Q\u0131z"),
  unisex: tr("namevotingscreen_uniseks_label", "Uniseks")
};

interface NameRowProps {
  n: any;
  fav: boolean;
  partnerFav: boolean;
  onToggle: (n: any) => void;
}

const NAME_ROWS_PAGE_SIZE = 50;

// Modul səviyyəsində + memo: hər renderdə yenidən mount olunmasın
const NameRow = memo(({ n, fav, partnerFav, onToggle }: NameRowProps) => {
    const isMatch = fav && partnerFav;
    return (
      <div
        className="flex items-center gap-3"
        style={{
          padding: 13,
          borderRadius: 16,
          background: isMatch ? 'var(--a-pink-1)' : 'var(--a-surface)',
          border: isMatch ? '1.5px solid var(--a-pink-2)' : '1.5px solid transparent',
          boxShadow: isMatch ? 'none' : 'var(--a-card-shadow)'
        }}>

        <div className="w-10 h-10 flex items-center justify-center text-lg shrink-0"
        style={{
          borderRadius: 13,
          background: n.gender === 'boy' ? 'var(--a-blue-1)' :
          n.gender === 'girl' ? (isMatch ? 'var(--a-chip-overlay)' : 'var(--a-pink-1)') :
          'var(--a-lav-1)'
        }}>
          {n.gender === 'boy' ? '👦' : n.gender === 'girl' ? '👧' : '✨'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: isMatch ? 'var(--a-alert-ink)' : 'var(--a-ink)' }}>{n.name}</h3>
            {isMatch &&
            <span className="inline-flex items-center shrink-0"
            style={{ background: 'var(--a-pink-2)', color: '#fff', borderRadius: 999, padding: '2px 7px', fontSize: 9.5, fontWeight: 800 }}>
                <Sparkles className="w-2.5 h-2.5 me-0.5" />
                Match
              </span>
            }
          </div>
          {n.meaning &&
          <p className="truncate" style={{ fontSize: 11.5, color: isMatch ? 'var(--a-berry-ink)' : 'var(--a-ink-soft)' }}>{n.meaning}</p>
          }
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ fontSize: 10, color: isMatch ? 'var(--a-berry-ink)' : 'var(--a-ink-faint)' }}>{genderLabels[n.gender] || n.gender}</span>
            {partnerFav &&
            <span className="flex items-center gap-0.5" style={{ fontSize: 10, color: 'var(--a-pink-ink)' }}>
                <Heart className="w-2.5 h-2.5 fill-current" /> {tr("namevotingscreen_partnyor_label", "Partnyor")}
              </span>
            }
          </div>
        </div>
        <motion.button
          onClick={() => onToggle(n)}
          whileTap={{ scale: 0.85 }}
          className="w-10 h-10 flex items-center justify-center shrink-0"
          style={{ borderRadius: 13, background: fav ? (isMatch ? 'var(--a-chip-overlay)' : 'var(--a-pink-1)') : 'var(--a-surface-soft)' }}
          aria-label={n.name}>

          <Heart className="w-5 h-5" style={fav ? { color: 'var(--a-pink-ink)', fill: 'var(--a-pink-ink)' } : { color: 'var(--a-ink-faint)' }} />
        </motion.button>
      </div>);

});


const NameVotingScreen: React.FC<NameVotingScreenProps> = ({ onBack }) => {
  const { favorites, toggleFavorite, isFavorite } = useFavoriteNames();
  const { partnerFavorites } = usePartnerFavoriteNames();
  const { data: names = [] } = useBabyNames();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'boy' | 'girl'>('all');
  const [activeTab, setActiveTab] = useState<'browse' | 'mine' | 'matches'>('browse');

  const partnerFavSet = useMemo(
    () => new Set(partnerFavorites.map((f) => f.name)),
    [partnerFavorites]
  );

  const matches = useMemo(
    () => favorites.filter((f) => partnerFavSet.has(f.name)),
    [favorites, partnerFavSet]
  );

  // Combined pool: all baby names + partner favorites that are not in main list
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const arr: any[] = [];
    for (const n of names) {
      if (seen.has(n.name)) continue;
      seen.add(n.name);
      arr.push({
        name: n.name,
        gender: n.gender,
        meaning: n.meaning,
        origin: n.origin
      });
    }
    for (const f of partnerFavorites) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      arr.push(f);
    }
    return arr;
  }, [names, partnerFavorites]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pool.filter((n) => {
      const matchSearch = !q || n.name.toLowerCase().includes(q) || (n.meaning || '').toLowerCase().includes(q);
      const matchGender = genderFilter === 'all' || n.gender === genderFilter || n.gender === 'unisex';
      return matchSearch && matchGender;
    });
  }, [pool, search, genderFilter]);

  const handleToggle = useCallback(
    (n: any) => toggleFavorite(n.name, n.gender, n.meaning, n.origin),
    [toggleFavorite]
  );

  const renderRow = (n: any) =>
    <NameRow
      key={n.name}
      n={n}
      fav={isFavorite(n.name)}
      partnerFav={partnerFavSet.has(n.name)}
      onToggle={handleToggle} />;

  const [visibleCount, setVisibleCount] = useState(NAME_ROWS_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(NAME_ROWS_PAGE_SIZE);
  }, [search, genderFilter, activeTab]);

  return (
    <div className="a-scope min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              <p className="a-eyebrow">{tr("namevotingscreen_her_ikiniz_beyendikde_match_olur_28c3f5", "Hər ikiniz bəyəndikdə match olur")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("namevotingscreen_ad_secimi_465d2a", "Ad Seçimi")}</p>
            </div>
          </div>
          {matches.length > 0 &&
          <div className="a-topbar-actions">
              <span className="inline-flex items-center gap-1"
            style={{ background: 'var(--a-pink-2)', color: '#fff', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800 }}>
                <Sparkles className="w-3 h-3" />
                {matches.length}
              </span>
            </div>
          }
        </header>

        {/* Tabs */}
        <div className="a-tabs" style={{ marginBottom: 14 }}>
          <button onClick={() => setActiveTab('browse')} className={`a-tab ${activeTab === 'browse' ? 'active' : ''}`}>
            {tr("namevotingscreen_adlari_beyen_67dae3", "Adları Bəyən")}
          </button>
          <button onClick={() => setActiveTab('mine')} className={`a-tab ${activeTab === 'mine' ? 'active' : ''}`}>
            {tr("namevotingscreen_sevimlilerim_c5c6a9", "Sevimlil\u0259rim (")}{favorites.length})
          </button>
          <button onClick={() => setActiveTab('matches')} className={`a-tab ${activeTab === 'matches' ? 'active' : ''}`}>
            Match
            {matches.length > 0 &&
            <span className="ms-1 px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, background: 'var(--a-pink-2)', color: '#fff', fontWeight: 800 }}>
                {matches.length}
              </span>
            }
          </button>
        </div>

        {activeTab === 'browse' &&
        <div className="space-y-3">
            {/* Search + filter */}
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr("namevotingscreen_ad_ve_ya_mena_axtarin_30a88e", "Ad və ya məna axtarın...")}
                className="w-full h-11 ps-11 pe-4 outline-none"
                style={{ borderRadius: 999, background: 'var(--a-surface)', border: '1px solid var(--a-line)', fontSize: 13, color: 'var(--a-ink)', boxShadow: 'var(--a-card-shadow)' }} />

            </div>
            <div className="a-tabs">
              {(['all', 'boy', 'girl'] as const).map((g) =>
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`a-tab ${genderFilter === g ? 'active' : ''}`}>

                  {g === 'all' ? tr("namevotingscreen_hamisi_c73c4d", "Ham\u0131s\u0131") : g === 'boy' ? tr("namevotingscreen_oglan_e9715e", "O\u011Flan") : tr("namevotingscreen_qiz_79bf6b", "Q\u0131z")}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {filtered.slice(0, visibleCount).map(renderRow)}
              {filtered.length > visibleCount &&
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + NAME_ROWS_PAGE_SIZE)}
                className="a-tab"
                style={{ display: 'block', width: '100%' }}>
                  {tr('community_load_more', 'Daha çox göstər')}
                </button>
              }
              {filtered.length === 0 &&
              <div className="text-center py-12" style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{tr("namevotingscreen_ad_tapilmadi_cf4c7a", "Ad tapılmadı")}</div>
              }
            </div>
          </div>
        }

        {activeTab === 'mine' &&
        <div className="space-y-2">
            {favorites.length === 0 ?
          <div className="a-card flex flex-col items-center text-center" style={{ padding: '34px 18px' }}>
                <Heart size={40} className="mb-3" style={{ color: 'var(--a-ink-faint)' }} />
                <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{tr("namevotingscreen_hele_ad_secmemisiniz_7c1388", "Hələ ad seçməmisiniz")}</p>
              </div> :

          favorites.map(renderRow)
          }
          </div>
        }

        {activeTab === 'matches' &&
        <div className="space-y-2">
            {matches.length === 0 ?
          <div className="a-card flex flex-col items-center text-center" style={{ padding: '34px 18px' }}>
                <Users size={40} className="mb-3" style={{ color: 'var(--a-ink-faint)' }} />
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("namevotingscreen_hele_match_yoxdur_ad5fb8", "Hələ match yoxdur")}</p>
                <p className="mt-1 max-w-xs" style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>
                  {tr("namevotingscreen_her_ikiniz_eyni_adi_beyendikde_f8a0e8", "H\u0259r ikiniz eyni ad\u0131 b\u0259y\u0259ndikd\u0259 burada g\xF6r\xFCn\u0259c\u0259k")}
                </p>
              </div> :

          matches.map(renderRow)
          }
          </div>
        }
      </div>
    </div>);

};

export default NameVotingScreen;
