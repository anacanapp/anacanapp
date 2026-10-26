import { useState, useMemo } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Star, Filter, Plus, Check, Heart,
  Utensils, Building2, TreePine, Train, Pill, PlayCircle, X, Phone,
  Sparkles, ChevronRight, Search } from
'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMomFriendlyPlaces, useAddPlace, useAddReview, usePlaceReviews, MomFriendlyPlace } from '@/hooks/useMomFriendlyPlaces';
import { usePlaceCategories, usePlaceAmenities, FALLBACK_CATEGORIES, FALLBACK_AMENITIES } from '@/hooks/usePlacesConfig';
import { toast } from 'sonner';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface MomFriendlyMapProps {
  onBack: () => void;
}

// Icon mapping for dynamic categories
const ICON_MAP: Record<string, any> = {
  MapPin, Utensils, Building2, TreePine, Heart, Train, Pill, PlayCircle
};

const MomFriendlyMap = ({ onBack }: MomFriendlyMapProps) => {
  useScrollToTop();
  useScreenAnalytics('MomFriendlyMap', 'Tools');

  // Fetch dynamic categories and amenities
  const { data: dbCategories = [] } = usePlaceCategories();
  const { data: dbAmenities = [] } = usePlaceAmenities();

  // Map to component format
  const CATEGORIES = useMemo(() => {
    if (dbCategories.length > 0) {
      return dbCategories.map((c) => ({
        value: c.category_key,
        label: c.label,
        icon: ICON_MAP[c.icon_name] || MapPin,
        color: c.color_gradient
      }));
    }
    return FALLBACK_CATEGORIES.map((c) => ({
      value: c.category_key,
      label: c.label,
      icon: ICON_MAP[c.icon_name] || MapPin,
      color: c.color_gradient
    }));
  }, [dbCategories]);

  const AMENITIES = useMemo(() => {
    if (dbAmenities.length > 0) {
      return dbAmenities.map((a) => ({
        key: a.amenity_key,
        label: a.label,
        icon: a.emoji
      }));
    }
    return FALLBACK_AMENITIES.map((a) => ({
      key: a.amenity_key,
      label: a.label,
      icon: a.emoji
    }));
  }, [dbAmenities]);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MomFriendlyPlace | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: places = [], isLoading } = useMomFriendlyPlaces({
    category: selectedCategory,
    amenities: selectedAmenities
  });

  const { data: placeReviews = [] } = usePlaceReviews(selectedPlace?.id || '');

  const addPlaceMutation = useAddPlace();
  const addReviewMutation = useAddReview();

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const [newPlace, setNewPlace] = useState({
    name: '',
    name_az: '',
    address_az: '',
    category: 'cafe' as const,
    latitude: 40.4093,
    longitude: 49.8671,
    has_breastfeeding_room: false,
    has_changing_table: false,
    has_elevator: false,
    has_ramp: false,
    has_stroller_access: false,
    has_kids_menu: false,
    has_play_area: false,
    has_high_chair: false,
    has_parking: false
  });

  const handleAddPlace = async () => {
    if (!newPlace.name) {
      toast.error(tr("momfriendlymap_mekan_adi_teleb_olunur_989a8a", "M\u0259kan ad\u0131 t\u0259l\u0259b olunur"));
      return;
    }

    await addPlaceMutation.mutateAsync(newPlace);
    setShowAddPlace(false);
    setNewPlace({
      name: '',
      name_az: '',
      address_az: '',
      category: 'cafe',
      latitude: 40.4093,
      longitude: 49.8671,
      has_breastfeeding_room: false,
      has_changing_table: false,
      has_elevator: false,
      has_ramp: false,
      has_stroller_access: false,
      has_kids_menu: false,
      has_play_area: false,
      has_high_chair: false,
      has_parking: false
    });
  };

  const toggleAmenity = (key: string) => {
    setSelectedAmenities((prev) =>
    prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find((c) => c.value === category) || CATEGORIES[0];
  };

  const getPlaceAmenities = (place: MomFriendlyPlace) => {
    return AMENITIES.filter((a) => (place as any)[a.key]);
  };

  const filteredPlaces = places.filter((place) =>
  place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  (place.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const verifiedCount = places.filter((p) => p.is_verified).length;
  const avgRating = places.length > 0 ?
  (places.reduce((sum, p) => sum + (p.avg_rating || 0), 0) / places.length).toFixed(1) :
  '0';

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("momfriendlymap_korpenizle_rahat_yerler_4e48e6", "Körpənizlə rahat yerlər")}
        title={tr("momfriendlymap_ana_dostu_mekanlar_4153ec", "Ana Dostu Məkanlar")}
        actions={
        <>
            <button
            className="a-icon-btn"
            style={showFilters || selectedAmenities.length > 0 ? { background: 'var(--a-pink-2)', color: '#fff', borderColor: 'transparent' } : undefined}
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filter">
              <Filter size={16} strokeWidth={2} />
            </button>
            <button className="a-icon-btn" onClick={() => setShowAddPlace(true)} aria-label="Add">
              <Plus size={16} strokeWidth={2} />
            </button>
          </>
        } />

      {/* Search */}
      <div className="a-search mb-3">
        <Search size={16} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tr("momfriendlymap_mekan_axtar_8b889d", "Məkan axtar...")} />
        
      </div>

      {/* Mini Stats */}
      <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: 'var(--a-on-bg-soft)' }}>
        <span className="flex items-center gap-1 font-semibold">
          <MapPin className="w-3 h-3" />
          <strong style={{ color: 'var(--a-on-bg)' }}>{places.length}</strong> {tr("momfriendlymap_mekan_ea55b2", "m\u0259kan")}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <Check className="w-3 h-3" style={{ color: 'var(--a-green-2)' }} />
          <strong style={{ color: 'var(--a-on-bg)' }}>{verifiedCount}</strong> {tr("momfriendlymap_tesdiqlenmis_b28f33", "t\u0259sdiql\u0259nmi\u015F")}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          <Star className="w-3 h-3 fill-current" style={{ color: 'var(--a-yellow-2)' }} />
          <strong style={{ color: 'var(--a-on-bg)' }}>{avgRating}</strong> {tr("momfriendlymap_orta_reytinq_3c7a2d", "orta reytinq")}
        </span>
      </div>

      <div className="space-y-3">
        {/* Category Pills */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}>
          
          {CATEGORIES.map((cat) =>
          <motion.button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full font-bold transition-all"
            style={selectedCategory === cat.value ?
            { background: 'var(--a-pink-2)', color: '#fff', border: '1px solid transparent', boxShadow: '0 8px 18px -8px rgba(255, 138, 164, 0.8)', cursor: 'pointer' } :
            { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}
            whileTap={{ scale: 0.95 }}>
            
              <cat.icon className="w-4 h-4" />
              <span className="text-sm">{cat.label}</span>
            </motion.button>
          )}
        </motion.div>

        {/* Amenity Filters */}
        <AnimatePresence>
          {showFilters &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}>
            
              <div className="a-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="a-card-title a-heading flex items-center gap-2" style={{ margin: 0 }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--a-pink-2)' }} />
                    {tr("momfriendlymap_i_mkanlara_gore_suz_f2f5d6", "\u0130mkanlara g\xF6r\u0259 s\xFCz")}
                  </h3>
                  {selectedAmenities.length > 0 &&
                <button
                  onClick={() => setSelectedAmenities([])}
                  className="text-xs font-bold"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-pink-ink)' }}>
                      {tr("momfriendlymap_temizle_1c3651", "T\u0259mizl\u0259")}
                    
                </button>
                }
                </div>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES.map((amenity) =>
                <motion.button
                  key={amenity.key}
                  onClick={() => toggleAmenity(amenity.key)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all"
                  style={selectedAmenities.includes(amenity.key) ?
                  { background: 'var(--a-pink-2)', color: '#fff', border: 'none', cursor: 'pointer' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink)', border: 'none', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                      <span>{amenity.icon}</span>
                      <span>{amenity.label}</span>
                    </motion.button>
                )}
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* Places List */}
        {isLoading ?
        <div className="space-y-3">
            {[1, 2, 3].map((i) =>
          <div key={i} className="a-card animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl" style={{ background: 'var(--a-surface-soft)' }} />
                  <div className="flex-1">
                    <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--a-surface-soft)' }} />
                    <div className="h-3 rounded w-1/2" style={{ background: 'var(--a-surface-soft)' }} />
                  </div>
                </div>
              </div>
          )}
          </div> :
        filteredPlaces.length === 0 ?
        <div className="rounded-[26px] p-8 text-center" style={{ background: 'var(--a-surface)', border: '2px dashed var(--a-line-strong)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-grad-pink)' }}>
              <MapPin className="w-8 h-8" style={{ color: 'var(--a-alert-ink)' }} />
            </div>
            <h3 className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("momfriendlymap_mekan_tapilmadi_ffea6b", "Məkan tapılmadı")}</h3>
            <p className="a-list-sub mb-4" style={{ margin: '0 0 16px', whiteSpace: 'normal' }}>
              {tr("momfriendlymap_bu_filtrlere_uygun_mekan_yoxdu_d1f970", "Bu filtrl\u0259r\u0259 uy\u011Fun m\u0259kan yoxdur")}
            </p>
            <button onClick={() => setShowAddPlace(true)} className="a-cta-btn mx-auto" style={{ background: 'var(--a-pink-2)', color: '#fff' }}>
              <Plus size={15} strokeWidth={2.2} />
              {tr("momfriendlymap_i_lk_mekani_elave_et_47627a", "\u0130lk m\u0259kan\u0131 \u0259lav\u0259 et")}
            </button>
          </div> :

        <div className="a-list-card">
            {filteredPlaces.map((place, index) => {
            const catInfo = getCategoryInfo(place.category);
            const amenities = getPlaceAmenities(place);

            return (
              <motion.button
                key={place.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                className="a-list-row w-full text-start"
                style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', alignItems: 'flex-start' }}
                onClick={() => setSelectedPlace(place)}>
                
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)' }}>
                    <catInfo.icon size={18} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} />
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="a-list-title truncate">{place.name}</p>
                      {place.is_verified &&
                    <span className="a-rank-tag shrink-0" style={{ margin: 0, background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
                          <Check className="w-3 h-3" /> {tr("momfriendlymap_tesdiqlenib_96c431", "T\u0259sdiql\u0259nib")}
                        </span>
                    }
                    </div>
                    
                    <p className="a-list-sub truncate">
                      {place.address || tr("momfriendlymap_unvan_gosterilmeyib_06305d", "\xDCnvan g\xF6st\u0259rilm\u0259yib")}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--a-yellow-2)' }} />
                        <span className="font-bold text-xs" style={{ color: 'var(--a-ink)' }}>{place.avg_rating?.toFixed(1) || '–'}</span>
                        <span className="text-[10px]" style={{ color: 'var(--a-ink-soft)' }}>({place.review_count})</span>
                      </span>
                      <span className="flex gap-1">
                        {amenities.slice(0, 5).map((a) =>
                      <span
                        key={a.key}
                        className="text-xs px-1 py-0.5 rounded"
                        style={{ background: 'var(--a-surface-soft)' }}
                        title={a.label}>
                        
                            {a.icon}
                          </span>
                      )}
                        {amenities.length > 5 &&
                      <span className="text-[10px] px-1" style={{ color: 'var(--a-ink-soft)' }}>
                            +{amenities.length - 5}
                          </span>
                      }
                      </span>
                    </div>
                  </div>
                  
                  <ChevronRight size={16} className="rtl:rotate-180 a-list-chevron self-center" />
                </motion.button>);

          })}
          </div>
        }
      </div>

      {/* Add Place Modal */}
      <Dialog open={showAddPlace} onOpenChange={setShowAddPlace}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--a-grad-pink)' }}>
                <Plus className="w-4 h-4" style={{ color: 'var(--a-alert-ink)' }} />
              </span>
              {tr("momfriendlymap_yeni_mekan_elave_et_53fb45", "Yeni M\u0259kan \u018Flav\u0259 Et")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("momfriendlymap_mekan_adi_ec57ac", "Məkan adı *")}</label>
              <input
                className="a-input w-full mt-1.5"
                value={newPlace.name}
                onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value, name_az: e.target.value })}
                placeholder={tr("momfriendlymap_meselen_port_baku_mall_760801", "Məsələn: Port Baku Mall")} />
              
            </div>
            <div>
              <label className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("momfriendlymap_unvan_b8651a", "Ünvan")}</label>
              <input
                className="a-input w-full mt-1.5"
                value={newPlace.address_az || ''}
                onChange={(e) => setNewPlace({ ...newPlace, address_az: e.target.value })}
                placeholder={tr("momfriendlymap_baki_neftciler_prospekti_a5d7c0", "Bakı, Neftçilər prospekti")} />
              
            </div>
            <div>
              <label className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("untranslated_kateqoriya_d7bf4y", "Kateqoriya")}</label>
              <Select
                value={newPlace.category}
                onValueChange={(v) => setNewPlace({ ...newPlace, category: v as any })}>
                
                <SelectTrigger className="mt-1.5" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)', borderRadius: 12 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== 'all').map((cat) =>
                  <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold mb-3 block" style={{ color: 'var(--a-ink)' }}>{tr("momfriendlymap_imkanlar_60eb86", "İmkanlar")}</label>
              <div className="grid grid-cols-1 gap-2">
                {AMENITIES.map((amenity) =>
                <div
                  key={amenity.key}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--a-surface-soft)' }}>
                  
                    <span className="text-sm flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                      <span className="text-lg">{amenity.icon}</span>
                      {amenity.label}
                    </span>
                    <Switch
                    checked={(newPlace as any)[amenity.key]}
                    onCheckedChange={(checked) => setNewPlace({ ...newPlace, [amenity.key]: checked })} />
                  
                  </div>
                )}
              </div>
            </div>
            <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 46, background: 'var(--a-pink-2)', color: '#fff', opacity: addPlaceMutation.isPending ? 0.6 : 1 }}
              onClick={handleAddPlace}
              disabled={addPlaceMutation.isPending}>
              
              {addPlaceMutation.isPending ? tr("momfriendlymap_elave_edilir_3c28b4", "\u018Flav\u0259 edilir...") : tr("momfriendlymap_mekan_elave_et_dd9c6e", "M\u0259kan \u018Flav\u0259 Et")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Place Detail Modal */}
      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto p-0 rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          {selectedPlace &&
          <>
              {/* Hero */}
              <div className="relative h-32" style={{ background: 'var(--a-grad-pink)' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  {(() => {
                  const CatIcon = getCategoryInfo(selectedPlace.category).icon;
                  return <CatIcon className="w-16 h-16" style={{ color: 'rgba(122, 31, 52, 0.3)' }} />;
                })()}
                </div>
                <motion.button
                onClick={() => setSelectedPlace(null)}
                className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer' }}
                whileTap={{ scale: 0.95 }}>
                
                  <X className="w-4 h-4" style={{ color: 'var(--a-alert-ink)' }} />
                </motion.button>
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold a-heading" style={{ margin: 0, color: 'var(--a-ink)' }}>{selectedPlace.name}</h2>
                    {selectedPlace.is_verified &&
                  <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
                    <Check className="w-3 h-3" /> {tr("momfriendlymap_tesdiqlenib_96c431", "Təsdiqlənib")}
                  </span>
                  }
                  </div>
                  <p style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{selectedPlace.address}</p>
                </div>

                {/* Rating Card */}
                <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: 'var(--a-yellow-1)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--a-grad-yellow)' }}>
                      <Star className="w-6 h-6 fill-current" style={{ color: 'var(--a-warn-ink)' }} />
                    </div>
                    <div>
                      <p className="a-heading" style={{ margin: 0, fontSize: 24, color: 'var(--a-warn-ink)' }}>{selectedPlace.avg_rating?.toFixed(1) || '–'}</p>
                      <p className="text-sm" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.8 }}>{selectedPlace.review_count} {tr("momfriendlymap_rey_bd4873", "rəy")}</p>
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--a-pink-2)' }} />
                    {tr("momfriendlymap_imkanlar_60eb86", "İmkanlar")}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {getPlaceAmenities(selectedPlace).map((a) =>
                      <div key={a.key} className="flex items-center gap-2 text-sm p-2.5 rounded-xl" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink)' }}>
                        <span className="text-lg">{a.icon}</span>
                        <span>{a.label}</span>
                      </div>
                    )}
                  </div>
                  {getPlaceAmenities(selectedPlace).length === 0 &&
                <p className="a-list-sub text-center py-4" style={{ margin: 0 }}>{tr("momfriendlymap_imkan_gosterilmeyib_1f22f8", "İmkan göstərilməyib")}</p>
                }
                </div>

                {/* Contact */}
                {selectedPlace.phone &&
                <a
                  href={`tel:${selectedPlace.phone}`}
                  className="a-btn-soft w-full"
                  style={{ justifyContent: 'center', height: 44, textDecoration: 'none' }}>
                    <Phone size={14} strokeWidth={2.2} />
                    {selectedPlace.phone}
                  </a>
                }

                {/* Reviews Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                      <Star className="w-4 h-4" style={{ color: 'var(--a-yellow-2)' }} />
                      {tr("momfriendlymap_reyler_8be233", "R\u0259yl\u0259r (")}{placeReviews.length})
                    </h4>
                    <button
                    className={showReviewForm ? 'a-btn-soft' : 'a-cta-btn'}
                    style={{ height: 34, padding: '0 14px', fontSize: 11, ...(showReviewForm ? {} : { background: 'var(--a-pink-2)', color: '#fff' }) }}
                    onClick={() => setShowReviewForm(!showReviewForm)}>
                    
                      {showReviewForm ? tr("momfriendlymap_legv_et_b5e49c", "L\u0259\u011Fv et") : tr("momfriendlymap_rey_yaz_7b3aab", "R\u0259y yaz")}
                    </button>
                  </div>

                  {/* Review Form */}
                  {showReviewForm &&
                <div className="mb-3 rounded-2xl p-4 space-y-3" style={{ background: 'var(--a-pink-1)' }}>
                      <div>
                        <p className="text-sm font-bold mb-2" style={{ margin: '0 0 8px', color: 'var(--a-berry-ink)' }}>{tr("momfriendlymap_qiymetlendirme_1fde6b", "Qiymətləndirmə")}</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) =>
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        
                              <Star
                          className={`w-7 h-7 transition-colors ${star <= reviewRating ? 'fill-current' : ''}`}
                          style={{ color: star <= reviewRating ? 'var(--a-yellow-2)' : 'var(--a-ink-faint)' }} />
                            </button>
                      )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold mb-2" style={{ margin: '0 0 8px', color: 'var(--a-berry-ink)' }}>{tr("momfriendlymap_serh_isteye_bagli_0acfd0", "Şərh (istəyə bağlı)")}</p>
                        <textarea
                      className="a-input w-full resize-none"
                      style={{ height: 'auto', minHeight: 72, fontFamily: 'inherit' }}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={tr("momfriendlymap_tecrubenizi_paylasin_aeca62", "Təcrübənizi paylaşın...")}
                      rows={3} />
                    
                      </div>
                      <button
                    className="a-cta-btn w-full"
                    style={{ justifyContent: 'center', height: 44, background: 'var(--a-pink-2)', color: '#fff', opacity: reviewRating === 0 || addReviewMutation.isPending ? 0.5 : 1 }}
                    disabled={reviewRating === 0 || addReviewMutation.isPending}
                    onClick={async () => {
                      if (!selectedPlace) return;
                      await addReviewMutation.mutateAsync({
                        place_id: selectedPlace.id,
                        rating: reviewRating,
                        comment: reviewComment || undefined
                      });
                      setReviewRating(0);
                      setReviewComment('');
                      setShowReviewForm(false);
                    }}>
                    
                        {addReviewMutation.isPending ? tr("momfriendlymap_gonderilir_1d548c", "G\xF6nd\u0259rilir...") : tr("momfriendlymap_rey_gonder_027e80", "R\u0259y g\xF6nd\u0259r")}
                      </button>
                    </div>
                }

                  {/* Reviews List */}
                  {placeReviews.length === 0 ?
                <p className="a-list-sub text-center py-4" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("momfriendlymap_hele_rey_yoxdur_ilk_reyi_siz_yazin_156bd8", "Hələ rəy yoxdur. İlk rəyi siz yazın!")}</p> :

                <div className="space-y-2">
                      {placeReviews.map((review) =>
                  <div key={review.id} className="rounded-xl p-3" style={{ background: 'var(--a-surface-soft)' }}>
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((s) =>
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= review.rating ? 'fill-current' : ''}`}
                        style={{ color: s <= review.rating ? 'var(--a-yellow-2)' : 'var(--a-ink-faint)' }} />
                      )}
                            <span className="text-xs ms-2" style={{ color: 'var(--a-ink-soft)' }}>
                              {new Date(review.created_at).toLocaleDateString(getLocaleTag())}
                            </span>
                          </div>
                          {review.comment && <p className="text-sm" style={{ margin: 0, color: 'var(--a-ink)' }}>{review.comment}</p>}
                        </div>
                  )}
                    </div>
                }
                </div>
              </div>
            </>
          }
        </DialogContent>
      </Dialog>
    </ToolPage>);

};

export default MomFriendlyMap;
