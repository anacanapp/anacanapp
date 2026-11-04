import { useState, useRef } from 'react';
import { ArrowLeft, Minus, Plus, ShoppingBag, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type Cake } from '@/hooks/useCakes';
import { useCakeCart } from '@/hooks/useCakeCart';
import { trackEvent } from '@/hooks/useScreenAnalytics';
import { tr } from '@/lib/tr';
import { useIsRtl } from '@/lib/rtl';
import { FLAVORS, FLAVOR_FIELD, PHOTO_BOX, cakeSpecs, cakeStory, categoryLabel, categoryOf, isBento, money } from './cakeUi';
import './cakes.css';

interface CakeDetailScreenProps {
  cake: Cake;
  onBack: () => void;
  onOpenCart: () => void;
}

const CakeDetailScreen = ({ cake, onBack, onOpenCart }: CakeDetailScreenProps) => {
  const { toast } = useToast();
  const isRtl = useIsRtl();
  const { addToCart, totalItems } = useCakeCart();
  const [quantity, setQuantity] = useState(1);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [flavor, setFlavor] = useState(FLAVORS[0]);
  const [photoBox, setPhotoBox] = useState(false);
  const [image, setImage] = useState(0);
  const touchStartX = useRef(0);

  const images = [
  ...(cake.image_url ? [cake.image_url] : []),
  ...(Array.isArray(cake.images) ? cake.images.filter((img) => img && img !== cake.image_url) : [])];

  const fieldLabels: string[] = Array.isArray(cake.custom_field_labels) ? cake.custom_field_labels as string[] : [];
  const showCustomFields = cake.has_custom_fields && fieldLabels.length > 0;
  const specs = cakeSpecs(cake.description);
  const story = cakeStory(cake.description);
  const offerBox = isBento(cake);
  const extra = offerBox && photoBox ? PHOTO_BOX.extra : 0;
  const unit = Number(cake.price) + extra;

  const handleAdd = () => {
    const fields: Record<string, string> = { [FLAVOR_FIELD]: flavor, ...(showCustomFields ? customFields : {}) };
    if (extra) fields[PHOTO_BOX.field] = PHOTO_BOX.value;
    addToCart(cake, quantity, fields, extra);
    trackEvent('cake_added_to_cart', { cake_id: cake.id, category: cake.category, source: 'detail', value: unit * quantity, photo_box: !!extra, flavor });
    toast({ title: tr('cakedetailscreen_sebete_elave_edildi_e0f576', 'Səbətə əlavə edildi! 🎂'), description: `${cake.name} x${quantity}` });
    onBack();
  };

  const onTouchEnd = (x: number) => {
    const diff = touchStartX.current - x;
    if (Math.abs(diff) < 50 || images.length < 2) return;
    const forward = isRtl ? diff < 0 : diff > 0;
    setImage((i) => forward ? (i + 1) % images.length : (i - 1 + images.length) % images.length);
  };

  return (
    <div className="a-scope ck overflow-y-auto">
      <div className="ck-gallery" onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }} onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}>
        {images.length > 0 && <img src={photoBox && offerBox ? PHOTO_BOX.image : images[image]} alt={cake.name} />}
        <div className="ck-gallery-top">
          <button type="button" className="ck-iconbtn glass" onClick={onBack} aria-label={tr('common_back', 'Geri')}><ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2.2} /></button>
          <button type="button" className="ck-iconbtn glass" onClick={onOpenCart} aria-label={tr('cakesscreen_cart', 'Səbət')}>
            <ShoppingBag size={18} strokeWidth={2.1} />
            {totalItems > 0 && <span className="ck-badge">{totalItems}</span>}
          </button>
        </div>
        {images.length > 1 && !photoBox &&
        <div className="ck-dots">
            {images.map((_, i) => <button key={i} type="button" className={`ck-dot${i === image ? ' on' : ''}`} onClick={() => setImage(i)} aria-label={`${i + 1}`} />)}
          </div>
        }
      </div>

      <div className="ck-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <span className="ck-kicker">{categoryLabel(categoryOf(cake))}{cake.category !== 'month' && cake.milestone_label ? ` · ${cake.milestone_label}` : ''}</span>
            <h1 className="ck-name">{cake.name}</h1>
          </div>
          <span className="ck-bigprice">{money(Number(cake.price))}</span>
        </div>

        {(specs.size || specs.weight || specs.people) &&
        <div className="ck-specs">
            {specs.size && <span className="ck-spec"><b>{specs.size}</b>{tr('cakedetail_size', 'ölçü')}</span>}
            {specs.weight && <span className="ck-spec"><b>{specs.weight}</b>{tr('cakedetail_weight', 'çəki')}</span>}
            {specs.people && <span className="ck-spec"><b>{specs.people}</b>{tr('cakedetail_people', 'nəfərlik')}</span>}
          </div>
        }
        {story && <p className="ck-desc">{story}</p>}

        <div>
          <span className="ck-label">{tr('cakedetail_flavor', 'Dad')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FLAVORS.map((f) => <button key={f} type="button" className={`ck-chip${flavor === f ? ' on' : ''}`} onClick={() => setFlavor(f)}>{f}</button>)}
          </div>
        </div>

        {showCustomFields && fieldLabels.map((label, i) =>
        <div key={label}>
            <label className="ck-label" htmlFor={`ck-field-${i}`}>{label}</label>
            <input id={`ck-field-${i}`} className="ck-input" value={customFields[label] || ''} onChange={(e) => setCustomFields((prev) => ({ ...prev, [label]: e.target.value }))}
          type={/gizli|secret/i.test(label) ? 'password' : 'text'} autoComplete="off" />
          </div>
        )}

        {offerBox &&
        <button type="button" className={`ck-upsell${photoBox ? ' on' : ''}`} onClick={() => setPhotoBox((v) => !v)} aria-pressed={photoBox}>
            <img src={PHOTO_BOX.image} alt="" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 14 }}>{tr('cakedetail_photo_box', 'Foto qutusuna çevir')}</b>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--a-ink-soft)' }}>{tr('cakedetail_photo_box_sub', 'Bento + 6 kapkeyk bir pəncərəli qutuda')}</span>
            </span>
            <b style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>+{money(PHOTO_BOX.extra)}</b>
            <span className="ck-check" aria-hidden>{photoBox && <Check size={14} strokeWidth={3} />}</span>
          </button>
        }
      </div>

      <div className="ck-bar">
        <div className="ck-stepper">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="−"><Minus size={16} strokeWidth={2.4} /></button>
          <span>{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(10, q + 1))} aria-label="+"><Plus size={16} strokeWidth={2.4} /></button>
        </div>
        <button type="button" className="ck-cta" onClick={handleAdd}>
          {tr('cakedetail_add', 'Səbətə əlavə et')} · {money(unit * quantity)}
        </button>
      </div>
    </div>);
};

export default CakeDetailScreen;
