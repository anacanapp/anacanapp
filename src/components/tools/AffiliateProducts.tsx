import { useState } from 'react';
import {
  Heart, Star, ShoppingBag, Search, Package } from
'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useAffiliateProducts, useSavedProducts, AffiliateProduct } from '@/hooks/useAffiliateProducts';
import AffiliateProductCard from './affiliate/AffiliateProductCard';
import AffiliateProductDetail from './affiliate/AffiliateProductDetail';
import SavedProductsList from './affiliate/SavedProductsList';
import { ToolPage, ToolHeader, ToolEmpty } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface AffiliateProductsProps {
  onBack: () => void;
}

const categoryLabels: Record<string, string> = {
  baby_gear: tr("affiliateproducts_korpe_esyalari_6e92e1", "K\xF6rp\u0259 \u0259\u015Fyalar\u0131"),
  maternity: tr("affiliateproducts_hamilelik_geyimleri_fb1c46", "Hamil\u0259lik geyiml\u0259ri"),
  health: tr("affiliateproducts_saglamliq_09460a", "Sa\u011Flaml\u0131q"),
  nutrition: tr("affiliateproducts_qidalanma_7e8b65", "Qidalanma"),
  skincare: tr("affiliateproducts_deri_qullugu_6c59a3", "D\u0259ri qullu\u011Fu"),
  general: tr("affiliateproducts_umumi_1b5521", "\xDCmumi")
};

const AffiliateProducts = ({ onBack }: AffiliateProductsProps) => {
  useScrollToTop();
  useScreenAnalytics('AffiliateProducts', 'Tools');

  const lifeStage = useUserStore((s) => s.lifeStage);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const affiliateEnabled = useAppSetting('affiliate_section_enabled');
  const isEnabled = affiliateEnabled !== false;

  const { data: products = [], isLoading } = useAffiliateProducts(lifeStage || undefined);
  const { data: savedProducts = [] } = useSavedProducts();

  // Get unique categories
  const categories = ['all', ...new Set(products.map((p) => p.category))];

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesSearch = !searchQuery ||
    (product.name_az || product.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description_az || product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredProducts = filteredProducts.filter((p) => p.is_featured);

  // Handle views
  if (selectedProduct) {
    return (
      <AffiliateProductDetail
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)} />);


  }

  if (showSaved) {
    return (
      <SavedProductsList
        onSelectProduct={setSelectedProduct}
        onBack={() => setShowSaved(false)} />);


  }

  if (!isEnabled) {
    return (
      <ToolPage>
        <ToolHeader
          onBack={onBack}
          title={tr("affiliateproducts_tovsiyye_olunan_mehsullar_db580f", "Tövsiyyə olunan məhsullar")} />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <ToolEmpty
            icon={<Package size={28} style={{ color: 'var(--a-ink-soft)' }} />}
            title={tr("affiliateproducts_tezlikle_125239", "Tezliklə")}
            text={tr("affiliateproducts_sizin_ucun_secilmis_mehsullar__85a358", "Sizin \xFC\xE7\xFCn se\xE7ilmi\u015F m\u0259hsullar tezlikl\u0259 burada olacaq")}
            className="w-full" />
        </div>
      </ToolPage>);

  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("affiliateproducts_sizin_ucun_secdiklerimiz_e5dde6", "Sizin üçün seçdiklərimiz")}
        title={tr("affiliateproducts_tovsiyye_olunan_mehsullar_db580f", "Tövsiyyə olunan məhsullar")}
        actions={
        <button
          className="a-btn-soft relative"
          style={{ height: 38, padding: '0 14px', fontSize: 11.5 }}
          onClick={() => setShowSaved(true)}>
            
            <Heart size={13} strokeWidth={2.2} />
            {tr("affiliateproducts_saxlanilmis_a1090d", "Saxlan\u0131lm\u0131\u015F")}
            {savedProducts.length > 0 &&
          <span
            className="absolute -top-2 -end-2 w-5 h-5 flex items-center justify-center text-[10px] rounded-full font-bold"
            style={{ background: 'var(--a-pink-2)', color: '#fff' }}>
                {savedProducts.length}
              </span>
          }
          </button>
        } />

      {/* Search */}
      <div className="a-search mb-3">
        <Search size={16} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={tr("affiliateproducts_mehsul_axtar_580a05", "Məhsul axtar...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />
        
      </div>

      {/* Category Tabs */}
      <div className="overflow-x-auto scrollbar-hide mb-2">
        <div className="flex gap-2 min-w-max pb-1">
          {categories.map((cat) =>
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors"
            style={activeCategory === cat ?
            { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid transparent', cursor: 'pointer' } :
            { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}>
            
              {cat === 'all' ? tr("affiliateproducts_hamisi_c73c4d", "Ham\u0131s\u0131") : categoryLabels[cat] || cat}
            </button>
          )}
        </div>
      </div>

      {/* Featured Products */}
      {featuredProducts.length > 0 && activeCategory === 'all' && !searchQuery &&
      <div className="py-2">
          <div className="a-section-head">
            <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
              {tr("affiliateproducts_en_cox_tovsiyye_olunanlar_4493f0", "\u018Fn \xE7ox t\xF6vsiyy\u0259 olunanlar")}
            </h2>
            <Star size={15} className="fill-current" style={{ color: 'var(--a-yellow-2)' }} />
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-2">
            {featuredProducts.map((product, index) =>
          <AffiliateProductCard
            key={product.id}
            product={product}
            onSelect={setSelectedProduct}
            index={index}
            variant="featured" />

          )}
          </div>
        </div>
      }

      {/* All Products */}
      <div className="py-2">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
            {searchQuery ? tr("affiliateproducts_search_results", "Axtarış nəticələri") : tr("affiliateproducts_butun_mehsullar_c7373f", "B\xFCt\xFCn m\u0259hsullar")}
          </h2>
          <span className="a-section-link">({filteredProducts.length})</span>
        </div>
        
        {isLoading ?
        <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) =>
            <div key={i} className="a-card overflow-hidden animate-pulse" style={{ padding: 0 }}>
                <div className="aspect-square w-full" style={{ background: 'var(--a-surface-soft)' }} />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ background: 'var(--a-surface-soft)' }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: 'var(--a-surface-soft)' }} />
                </div>
              </div>
          )}
          </div> :
        filteredProducts.length === 0 ?
        <div className="a-card text-center" style={{ padding: '34px 18px' }}>
            <ShoppingBag className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--a-ink-faint)' }} />
            <p className="a-list-sub" style={{ margin: 0 }}>{tr("affiliateproducts_hec_bir_mehsul_tapilmadi_7ded0c", "Heç bir məhsul tapılmadı")}</p>
          </div> :

        <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product, index) =>
          <AffiliateProductCard
            key={product.id}
            product={product}
            onSelect={setSelectedProduct}
            index={index} />

          )}
          </div>
        }
      </div>

      {/* Disclaimer */}
      <div className="mt-2 mb-4">
        <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)' }}>
          <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-disclaimer-ink)' }}>
            {tr("affiliateproducts_bu_sehifedeki_linkler_affiliat_76280f", "Bu s\u0259hif\u0259d\u0259ki linkl\u0259r affiliate linkl\u0259rdir. Al\u0131\u015F-veri\u015F etdikd\u0259 biz ki\xE7ik komissiya qazana bil\u0259rik.")}
          </p>
        </div>
      </div>
    </ToolPage>);

};

export default AffiliateProducts;
