import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Gift, Copy, Check, Share2, Users, CalendarPlus, Loader2, Ticket, Crown, Hourglass } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useReferral, type ReferredUser } from '@/hooks/useReferral';
import { formatDateAz } from '@/lib/date-utils';
import { tr } from '@/lib/tr';

interface Props {
  onBack: () => void;
}

/**
 * Dostunu dəvət et — referral proqramı.
 * Kod paylaş → hər iki tərəfə +7 gün Premium.
 */
/** Status çipi: qeydiyyat / trial / premium */
const StatusChip = ({ r }: {r: ReferredUser;}) => {
  if (r.status === 'converted') {
    return (
      <span className="a-rank-tag inline-flex items-center gap-1" style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
        <Crown size={10} strokeWidth={2.4} /> {tr('ref_st_premium', 'Premium')}
      </span>);
  }
  if (r.status === 'trial') {
    return (
      <span className="a-rank-tag inline-flex items-center gap-1" style={{ background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)' }}>
        <Hourglass size={10} strokeWidth={2.4} /> {tr('ref_st_trial', 'Free trial')}
      </span>);
  }
  return (
    <span className="a-rank-tag" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
      {tr('ref_st_registered', 'Qeydiyyat')}
    </span>);
};

const ReferralScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { toast } = useToast();
  const { code, codeLoading, referred, stats, redeem, redeeming } = useReferral();

  const [copied, setCopied] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {/* boş */}
  };

  const shareCode = async () => {
    if (!code) return;
    const text = tr('ref_share_text_v3', 'Anacan — hamiləlik, analıq və tsikl bələdçisi! Qeydiyyatda dəvət kodumu daxil et: {code} 💛').replace('{code}', code);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: tr('ref_copied_full', 'Dəvət mətni kopyalandı ✓') });
      }
    } catch {/* istifadəçi ləğv etdi */}
  };

  const handleRedeem = async () => {
    const c = redeemInput.trim().toUpperCase();
    if (c.length < 4) return;
    try {
      const res = await redeem(c);
      if (res.success) {
        toast({
          title: tr('ref_redeem_success', 'Təbriklər! 🎉'),
          description: tr('ref_redeem_success_desc_v2', 'Dəvət kodu tətbiq olundu — dəvət edən dostunuz sizə görə mükafat qazanacaq')
        });
        setRedeemInput('');
      } else {
        const msg = res.error === 'own_code' ?
        tr('ref_err_own', 'Öz kodunuzu istifadə edə bilməzsiniz') :
        res.error === 'already_redeemed' ?
        tr('ref_err_already', 'Artıq bir dəvət kodu istifadə etmisiniz') :
        tr('ref_err_invalid', 'Kod tapılmadı — yoxlayıb yenidən yazın');
        toast({ title: tr('ref_redeem_failed', 'Alınmadı'), description: msg, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('ref_redeem_failed', 'Alınmadı'), description: tr('ref_err_generic', 'Xəta baş verdi — yenidən cəhd edin'), variant: 'destructive' });
    }
  };

  const steps = [
  { emoji: '📤', text: tr('ref_step1', 'Kodunu dostlarına göndər') },
  { emoji: '📲', text: tr('ref_step2_v3', 'Dostun tətbiqi yükləyib kodunu daxil edir') },
  { emoji: '👑', text: tr('ref_step3_v2', 'Dostun Premium olanda (birbaşa və ya trial-dan sonra) SƏN +7 gün qazanırsan') }];


  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c4" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-5">
        {/* Header */}
        <div className="flex items-center gap-3 py-5">
          <button onClick={onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label={tr('common_geri', 'Geri')}>
            <ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2} />
          </button>
          <div>
            <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{tr('ref_eyebrow', 'Referral proqramı')}</p>
            <h1 className="a-heading" style={{ margin: 0, fontSize: 20, color: 'var(--a-ink)' }}>{tr('ref_title', 'Dostunu dəvət et')}</h1>
          </div>
        </div>

        {/* Kod kartı */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card text-center relative overflow-hidden"
          style={{ padding: '24px 18px', border: '2px solid var(--a-peach-2)' }}>

          <span className="absolute top-0 start-0" aria-hidden
          style={{ width: 110, height: 110, borderRadius: 999, background: 'var(--a-peach-1)', opacity: 0.5, transform: 'translate(-35%, -35%)' }} />

          <div className="relative">
            <div className="w-14 h-14 mx-auto mb-3 grid place-items-center" style={{ borderRadius: 18, background: 'var(--a-grad-peach)' }}>
              <Gift size={24} strokeWidth={2} style={{ color: 'var(--a-accent-ink)' }} />
            </div>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', marginBottom: 10 }}>
              {tr('ref_code_sub', 'Sənin dəvət kodun — paylaş, ikiniz də qazanın')}
            </p>

            {codeLoading ?
            <Loader2 size={22} className="animate-spin mx-auto" style={{ color: 'var(--a-peach-2)' }} /> :
            code ?
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2.5"
              style={{
                background: 'var(--a-surface-soft)', border: '2px dashed var(--a-peach-2)',
                borderRadius: 16, padding: '12px 22px', cursor: 'pointer'
              }}>
                <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.22em', color: 'var(--a-ink)' }}>{code}</span>
                {copied ?
              <Check size={18} strokeWidth={2.6} style={{ color: 'var(--a-green-ink)' }} /> :
              <Copy size={16} strokeWidth={2.2} style={{ color: 'var(--a-ink-soft)' }} />}
              </button> :

            <p className="a-list-sub">{tr('ref_code_unavailable', 'Kod hazırlanır — bir azdan yenidən baxın')}</p>
            }

            <button
              className="a-cta-btn w-full mt-4"
              style={{ justifyContent: 'center', height: 50 }}
              onClick={shareCode}
              disabled={!code}>
              <Share2 size={16} strokeWidth={2.2} />
              {tr('ref_share_btn', 'Kodu paylaş')}
            </button>
          </div>
        </motion.div>

        {/* Statistika */}
        <div className="a-trio" style={{ marginTop: 12 }}>
          <div className="a-trio-item">
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
              <Users size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>{stats.invitedCount}</p>
            <p className="a-trio-label">{tr('ref_invited', 'Dəvət edilən')}</p>
          </div>
          <div className="a-trio-item">
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
              <Crown size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>{stats.premiumCount}</p>
            <p className="a-trio-label">{tr('ref_premium_count', 'Premium olan')}</p>
          </div>
          <div className="a-trio-item">
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
              <CalendarPlus size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>{stats.earnedDays}</p>
            <p className="a-trio-label">{tr('ref_earned_days', 'Qazanılan gün')}</p>
          </div>
        </div>

        {/* Dəvət edilənlərin detallı siyahısı */}
        {referred.length > 0 &&
        <div style={{ marginTop: 12 }}>
            <div className="a-section-head">
              <h2 className="a-section-title a-heading">{tr('ref_list_title', 'Dəvətlərin')}</h2>
              <span className="a-section-link" style={{ color: 'var(--a-accent-ink)' }}>{referred.length}</span>
            </div>
            <div className="a-list-card">
              {referred.map((r) =>
            <div key={r.id} className="a-list-row">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={r.avatarUrl || undefined} />
                    <AvatarFallback style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', fontSize: 12, fontWeight: 800 }}>
                      {r.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="a-list-title" style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                    <p className="a-list-sub">
                      {formatDateAz(r.createdAt)}
                      {r.status === 'converted' && r.convertedAt &&
                  <> · {tr('ref_converted_on', 'Premium:')} {formatDateAz(r.convertedAt)}</>}
                    </p>
                  </div>
                  <span className="a-list-trail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <StatusChip r={r} />
                    {r.rewarded ?
                <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--a-green-ink)' }}>+{r.rewardDays} {tr('ref_days_short', 'gün')} ✓</span> :

                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-faint)' }}>{tr('ref_pending', 'gözlənilir')}</span>}
                  </span>
                </div>
            )}
            </div>
          </div>
        }

        {/* Necə işləyir */}
        <div className="a-list-card" style={{ marginTop: 12 }}>
          {steps.map((s, i) =>
          <div key={i} className="a-list-row">
              <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 17 }}>{s.emoji}</span>
              <div>
                <p className="a-list-title" style={{ fontSize: 13.5, whiteSpace: 'normal' }}>{s.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Kod daxil et (yalnız hələ istifadə etməyibsə) */}
        {!stats.redeemedAlready &&
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="a-card"
          style={{ marginTop: 12, padding: 16 }}>

            <label className="a-today-info-eyebrow flex items-center gap-1.5" style={{ marginBottom: 8 }}>
              <Ticket size={12} /> {tr('ref_have_code', 'Dəvət kodun var?')}
            </label>
            <div className="flex gap-2">
              <input
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="a-input flex-1"
              style={{ height: 48, fontSize: 16, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }} />
              <button
              className="a-cta-btn"
              style={{ justifyContent: 'center', height: 48, minWidth: 104, opacity: redeeming || redeemInput.trim().length < 4 ? 0.6 : 1 }}
              disabled={redeeming || redeemInput.trim().length < 4}
              onClick={handleRedeem}>
                {redeeming ? <Loader2 size={15} className="animate-spin" /> : tr('ref_redeem_btn', 'Tətbiq et')}
              </button>
            </div>
          </motion.div>
        }

        <p className="a-teaser text-center" style={{ marginTop: 14 }}>
          {tr('ref_terms_v2', 'Hər hesab yalnız 1 dəvət kodu istifadə edə bilər. Sənin +7 günün dostun real Premium olanda (trial-dan keçid daxil) avtomatik verilir və mövcud müddətin üstünə əlavə olunur.')}
        </p>
      </div>
    </div>);
};

export default ReferralScreen;
