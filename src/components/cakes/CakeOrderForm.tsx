import { useState } from 'react';
import { ArrowLeft, Cake as CakeIcon, CreditCard, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCakeCart, cakeUnitPrice } from '@/hooks/useCakeCart';
import { addDays, format, parseISO } from 'date-fns';
import { money } from './cakeUi';
import './cakes.css';
import { supabase } from '@/integrations/supabase/client';
import { tr } from "@/lib/tr";
import { QcEarnBox, QcRedeemRow, QcSummaryLine, qcTrack, useQcRedeem, type QcOrderNote } from '@/components/qaygicash/QcParts';
import { invalidateQaygiCash } from '@/hooks/useQaygiCash';
import { useQueryClient } from '@tanstack/react-query';
import { earnPreview, qcErrorKey, rateOf, toAzn, toMinor } from '@/lib/qaygicash';
import { readAppLanguage } from '@/lib/app-languages';
import { openExternal } from '@/lib/books/api';
import { qk } from '@/lib/qaygicash-copy';

interface CakeOrderFormProps {
  onBack: () => void;
  /** Called after the order is placed; carries the QayğıCash note for the success screen. */
  onSuccess: (qc?: QcOrderNote) => void;
}

const CakeOrderForm = ({ onBack, onSuccess }: CakeOrderFormProps) => {
  const { toast } = useToast();
  const { items, totalPrice, clearCart } = useCakeCart();
  const [submitting, setSubmitting] = useState(false);

  // QayğıCash: up to max % of the order, reserved by cake-checkout; the card is charged the rest and the cake earns on it.
  const queryClient = useQueryClient();
  const totalMinor = toMinor(totalPrice);
  const qc = useQcRedeem('cake', totalMinor);
  const cakeRate = rateOf(qc.wallet ?? undefined, 'cake');
  const earn = earnPreview(totalMinor - qc.amount, cakeRate);
  const netTotal = toAzn(totalMinor - qc.amount);

  // Orders need 48 hours: the first day offered is the day after tomorrow.
  const days = Array.from({ length: 12 }, (_, i) => addDays(new Date(), i + 2));
  const SLOTS = ['10:00–13:00', '14:00–18:00'];
  const WEEKDAYS = [tr('wd_sun', 'B.'), tr('wd_mon', 'B.e.'), tr('wd_tue', 'Ç.a.'), tr('wd_wed', 'Ç.'), tr('wd_thu', 'C.a.'), tr('wd_fri', 'C.'), tr('wd_sat', 'Ş.')];
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [slot, setSlot] = useState(SLOTS[0]);

  const [formData, setFormData] = useState({
    customer_name: '',
    child_name: '',
    contact_phone: '',
    delivery_date: format(days[0], 'yyyy-MM-dd'),
    delivery_address: '',
    notes: ''
  });

  const handleSubmit = async () => {
    if (!formData.customer_name.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_musteri_adi_teleb_olunur_fc1733", 'Müştəri adı tələb olunur'), variant: 'destructive' });
      return;
    }
    if (!formData.contact_phone.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_elaqe_nomresi_teleb_olunur_1c55b7", 'Əlaqə nömrəsi tələb olunur'), variant: 'destructive' });
      return;
    }
    if (mode === 'delivery' && !formData.delivery_address.trim()) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr('cakeorderform_address_required', 'Çatdırılma ünvanını yazın'), variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: tr("cakeorderform_xeta_3cdbb6", 'Xəta'), description: tr("cakeorderform_sebet_bosdur_ff5b34", 'Səbət boşdur'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Card only, through Epoint (cake-checkout prices the order on the server and returns the payment page).
      const used = qc.amount;
      const { data, error } = await supabase.functions.invoke('cake-checkout', {
        body: {
          items: items.map((item) => ({ cake_id: item.cake.id, qty: item.quantity, photo_box: (Number(item.extraPrice) || 0) > 0, fields: item.customFields })),
          customer_name: formData.customer_name.trim(), child_name: formData.child_name.trim(), contact_phone: formData.contact_phone.trim(),
          delivery_date: formData.delivery_date, slot, mode, delivery_address: formData.delivery_address.trim(), notes: formData.notes.trim(),
          language: readAppLanguage(), ...(used > 0 ? { cashback: toAzn(used) } : {}),
        },
      });
      if (error || typeof data?.checkout_url !== 'string') {
        let body: { error?: string } | null = null;
        try { body = await (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context?.json?.() ?? null; } catch { /* not json */ }
        const code = body?.error ?? '';
        if (/^QC_[A-Z_]+$/.test(code)) { void invalidateQaygiCash(queryClient); toast({ title: qk(qcErrorKey(code)), variant: 'destructive' }); }
        else if (code === 'payments_unavailable') toast({ title: tr('cake_card_unavailable', 'Kartla ödəniş müvəqqəti əlçatan deyil. Bir az sonra yenidən yoxlayın.'), variant: 'destructive' });
        else toast({ title: tr('cakeorderform_xeta_3cdbb6', 'Xəta'), description: tr('cakeorderform_sifaris_gonderile_bilmedi_52b41e', 'Sifariş göndərilə bilmədi'), variant: 'destructive' });
        return;
      }
      if (used > 0) { qcTrack('qc_redeem_commit', { channel: 'cake', amount_minor: used }); void invalidateQaygiCash(queryClient); }
      openExternal(data.checkout_url);
      clearCart();
      toast({ title: tr('cake_pay_opened', 'Ödəniş səhifəsi açıldı. Ödənişdən sonra sifarişiniz təsdiqlənəcək. 🎂') });
      onSuccess({ earnMinor: earnPreview(totalMinor - used, cakeRate), usedMinor: used, digital: false });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = (text: string, id?: string) =>
  <label className="ck-label" htmlFor={id}>{text}</label>;

  return (
    <div className="a-scope ck overflow-y-auto" style={{ paddingBottom: 120 }}>
      <header className="ck-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button type="button" className="ck-iconbtn" onClick={onBack} aria-label={tr('common_back', 'Geri')}>
            <ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2.2} />
          </button>
          <div style={{ minWidth: 0 }}>
            <p className="ck-eyebrow">{items.length} {tr('cakeorderform_cakes_n', 'tort')} · {money(totalPrice)}</p>
            <h1 className="ck-title" style={{ fontSize: 22 }}>{tr('cakeorderform_title_v3', 'Sifariş')}</h1>
          </div>
        </div>
      </header>

      <div className="ck-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) =>
          <div key={i} className="ck-row">
              {item.cake.image_url ? <img src={item.cake.image_url} alt="" /> :
            <span style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--a-coral-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CakeIcon size={22} /></span>}
              <div className="ck-row-main">
                <b>{item.cake.name}</b>
                <span>{[`x${item.quantity}`, ...Object.entries(item.customFields).filter(([, v]) => v).map(([k, v]) => /gizli|secret/i.test(k) ? '••••' : v)].join(' · ')}</span>
              </div>
              <b style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{money(cakeUnitPrice(item) * item.quantity)}</b>
            </div>
          )}
        </div>

        <div>
          {fieldLabel(tr('cakeorderform_when', 'Nə vaxt?'))}
          <div className="ck-days" role="listbox" aria-label={tr('cakeorderform_when', 'Nə vaxt?')}>
            {days.map((d) => {
              const value = format(d, 'yyyy-MM-dd');
              const on = formData.delivery_date === value;
              return (
                <button key={value} type="button" role="option" aria-selected={on} className={`ck-day${on ? ' on' : ''}`} onClick={() => setFormData({ ...formData, delivery_date: value })}>
                  <b>{format(d, 'd')}</b>{WEEKDAYS[d.getDay()]}
                </button>);
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {SLOTS.map((value) => <button key={value} type="button" className={`ck-chip${slot === value ? ' on' : ''}`} style={{ flex: 1 }} onClick={() => setSlot(value)}>{value}</button>)}
          </div>
        </div>

        <div className="ck-seg">
          <button type="button" className={mode === 'delivery' ? 'on' : ''} onClick={() => setMode('delivery')}>{tr('cakeorderform_mode_delivery', 'Çatdırılma')}</button>
          <button type="button" className={mode === 'pickup' ? 'on' : ''} onClick={() => setMode('pickup')}>{tr('cakeorderform_mode_pickup', 'Özüm götürəcəm')}</button>
        </div>
        {mode === 'delivery' &&
        <div>
            {fieldLabel(tr('cakeorderform_catdirilma_unvani_5cec99', 'Çatdırılma ünvanı'), 'ck-addr')}
            <input id="ck-addr" className="ck-input" value={formData.delivery_address} onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })} placeholder={tr('cakeorderform_unvani_daxil_edin_b8da41', 'Ünvanı daxil edin')} autoComplete="street-address" />
          </div>
        }

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            {fieldLabel(tr('cakeorderform_musteri_adi_e9554d', 'Müştəri adı *'), 'ck-cname')}
            <input id="ck-cname" className="ck-input" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder={tr('cakeorderform_adinizi_daxil_edin_bd2b57', 'Adınızı daxil edin')} autoComplete="name" />
          </div>
          <div>
            {fieldLabel(tr('cakeorderform_elaqe_nomresi_feb8b9', 'Əlaqə nömrəsi *'), 'ck-phone')}
            <input id="ck-phone" className="ck-input" type="tel" inputMode="tel" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="+994 XX XXX XX XX" autoComplete="tel" />
          </div>
          <div>
            {fieldLabel(tr('cakeorderform_usagin_adi_80632b', 'Uşağın adı'), 'ck-child')}
            <input id="ck-child" className="ck-input" value={formData.child_name} onChange={(e) => setFormData({ ...formData, child_name: e.target.value })} placeholder={tr('cakeorderform_korpenin_adi_8a4e9e', 'Körpənin adı')} />
          </div>
          <div>
            {fieldLabel(tr('cakeorderform_elave_qeydler_c98a42', 'Əlavə qeydlər'), 'ck-notes')}
            <textarea id="ck-notes" className="ck-input" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={tr('cakeorderform_xususi_istekler_allergiya_ve_s_49d429', 'Xüsusi istəklər, allergiya və s.')} />
          </div>
        </div>

        <div>
          {fieldLabel(tr('cakeorderform_odenis_usulu_b9d87a', 'Ödəniş üsulu'))}
          <div className="ck-pay">
            <button type="button" className="on" aria-pressed aria-disabled>
              <span className="ck-radio" aria-hidden />
              <span style={{ color: 'var(--a-coral-text)' }}><CreditCard className="w-6 h-6" /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{tr('cake_pay_card', 'Kartla ödəniş')}</b>
                <small style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> {tr('cake_pay_card_sub', 'Epoint ilə təhlükəsiz onlayn ödəniş')}</small>
              </span>
            </button>
          </div>
        </div>

          {qc.wallet && qc.limits.show && <QcRedeemRow state={qc} />}
          <div className="ck-box">
            {items.map((item, i) => <div key={i} className="ck-line"><span>{item.cake.name} x{item.quantity}</span><span>{money(cakeUnitPrice(item) * item.quantity)}</span></div>)}
            <div className="ck-line"><span>{mode === 'delivery' ? tr('cakeorderform_mode_delivery', 'Çatdırılma') : tr('cakeorderform_mode_pickup', 'Özüm götürəcəm')}</span><span>{format(parseISO(formData.delivery_date), 'dd.MM')} · {slot}</span></div>
            <QcSummaryLine amount={qc.amount} className="ck-line qc-sum-line" />
            <div className="ck-total"><span>{tr('cakeorderform_cemi_fbbec6', 'Cəmi:')}</span><span>{money(netTotal)}</span></div>
          </div>
          <QcEarnBox amount={earn} />
          <button type="button" className="ck-cta" style={{ flex: 'none' }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> :
            <>
                <CreditCard size={18} strokeWidth={2.2} />
                {tr('cake_pay_and_order', 'Ödə və sifariş ver')} · {money(netTotal)}
              </>
            }
          </button>
          <p className="ck-fine">{tr('cakeorderform_fine', 'Sifariş ən azı 48 saat qabaqcadan qəbul olunur. Qənnadı təsdiqləyəndə sizə zəng edəcək.')}</p>
      </div>
    </div>);

};

export default CakeOrderForm;
