import { tr } from "@/lib/tr";import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Sparkles, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface StatusData {
  status: string;
  expires_at?: string;
  verified_at?: string;
  venue_name?: string;
  venue_logo_url?: string;
  discount_label?: string;
  user_name?: string;
  is_premium?: boolean;
}

export default function PartnerVerifyPage() {
  const { token } = useParams<{token: string;}>();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<StatusData | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('partner-redemption-status', { body: { token } });
        if (error) throw error;
        setStatus(data as StatusData);
        if ((data as StatusData)?.status === 'verified') setVerified(data as StatusData);
      } catch (e: any) {
        setError(e?.message || tr("partnerverifypage_xeta_3cdbb6", "X\u0259ta"));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('partner-verify-redemption', { body: { token, pin } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setVerified(data as StatusData);
    } catch (e: any) {
      let msg = e?.message || tr("partnerverifypage_xeta_3cdbb6", "X\u0259ta");

      if (e instanceof FunctionsHttpError) {
        try {
          const errorBody = await e.context.json();
          msg = errorBody?.error || errorBody?.details || msg;
        } catch {
          msg = e.message || msg;
        }
      }

      const map: Record<string, string> = {
        invalid_pin: tr("partnerverifypage_pin_sehvdir_010e18", "PIN s\u0259hvdir"),
        invalid_token: tr("partnerverifypage_qr_yanlisdir_ed65eb", "QR yanl\u0131\u015Fd\u0131r"),
        expired: tr("partnerverifypage_qr_in_muddeti_bitib_fc3d41", "QR-\u0131n m\xFCdd\u0259ti bitib"),
        already_verified: tr("partnerverifypage_bu_qr_artiq_istifade_olunub_3bcb61", "Bu QR art\u0131q istifad\u0259 olunub"),
        pin_not_configured: tr("partnerverifypage_mekan_ucun_pin_hele_qurulmayib_f9d65d", "M\u0259kan \xFC\xE7\xFCn PIN h\u0259l\u0259 qurulmay\u0131b")
      };
      setError(map[msg] || msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--a-peach-2)' }} />
      </div>);

  }

  if (verified) {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #63bd8b 0%, #4aa876 100%)', color: '#ffffff' }}>
        <CheckCircle2 className="w-24 h-24 mb-4" strokeWidth={2.5} />
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>{tr("partnerverifypage_tesdi_qlendi_7e7c87", "T\u018FSD\u0130QL\u018FND\u0130")}</h1>
        <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{verified.discount_label}</p>
        <p style={{ fontSize: 17, opacity: 0.9, marginBottom: 24 }}>{verified.venue_name}</p>
        <div className="backdrop-blur rounded-3xl px-6 py-4 mb-3" style={{ background: 'rgba(255,255,255,0.22)' }}>
          <p style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 4 }}>{tr("partnerverifypage_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</p>
          <p style={{ fontSize: 19, fontWeight: 800 }}>{verified.user_name}</p>
          {verified.is_premium &&
          <div className="inline-flex items-center gap-1 mt-2"
          style={{ background: '#ffc94d', color: '#5a3d00', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
              <Sparkles className="w-3 h-3" /> PREMIUM
            </div>
          }
        </div>
        <p style={{ fontSize: 10.5, opacity: 0.75, marginTop: 16 }}>{tr("untranslated_anacan_partnyor_sistemi_xadwvm", "Anacan Partnyor Sistemi")}</p>
      </div>);

  }

  if (status?.status === 'expired' || error === tr("partnerverifypage_qr_in_muddeti_bitib_fc3d41", "QR-\u0131n m\xFCdd\u0259ti bitib")) {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #e0526e 0%, var(--a-pink-ink) 100%)', color: '#ffffff' }}>
        <XCircle className="w-20 h-20 mb-4" />
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{tr("partnerverifypage_muddeti_bitib_68fc0e", "M\xFCdd\u0259ti bitib")}</h1>
        <p style={{ opacity: 0.9, marginTop: 8 }}>{tr("partnerverifypage_musteri_tetbiqinde_yeni_qr_yar_32bfe8", "M\xFC\u015Ft\u0259ri t\u0259tbiqind\u0259 yeni QR yaratmal\u0131d\u0131r.")}</p>
      </div>);

  }

  if (status?.status === 'cancelled') {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <XCircle className="w-20 h-20 mb-4" style={{ color: 'var(--a-ink-faint)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--a-ink)' }}>{tr("partnerverifypage_legv_edilib_24db12", "L\u0259\u011Fv edilib")}</h1>
      </div>);

  }

  return (
    <div className="a-scope min-h-screen flex flex-col items-center justify-center p-6 relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
      </div>

      <div className="a-card w-full max-w-md relative z-10" style={{ padding: 24 }}>
        <div className="flex flex-col items-center text-center mb-6">
          {status?.venue_logo_url ?
          <img src={status.venue_logo_url} alt="" className="w-20 h-20 object-cover" style={{ borderRadius: 20, border: '2px solid var(--a-line-strong)' }} /> :

          <div className="w-20 h-20 flex items-center justify-center" style={{ borderRadius: 20, background: 'var(--a-peach-1)' }}>
              <Sparkles size={36} style={{ color: 'var(--a-accent-ink)' }} />
            </div>
          }
          <h1 className="mt-3" style={{ fontSize: 19, fontWeight: 800, color: 'var(--a-ink)' }}>{status?.venue_name}</h1>
          <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{status?.discount_label}</p>
          <div className="mt-3" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '8px 16px', fontSize: 13, color: 'var(--a-ink)' }}>
            {tr("partnerverifypage_musteri_f512e9", "M\xFC\u015Ft\u0259ri:")} <strong>{status?.user_name}</strong>
            {status?.is_premium && <span className="ms-2" style={{ color: 'var(--a-yellow-ink)' }}>★ Premium</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>
            <Shield className="w-4 h-4" /> {tr("partnerverifypage_mekan_pin_kodu_138eb6", "M\u0259kan PIN kodu")}
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full h-14 text-center text-2xl tracking-widest font-bold focus:outline-none"
            style={{ borderRadius: 16, border: '2px solid var(--a-line-strong)', background: 'var(--a-surface)', color: 'var(--a-ink)' }}
            maxLength={12} />

          {error && <p className="text-center" style={{ fontSize: 13, color: 'var(--a-alert-ink)' }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting || !pin}
            className="w-full h-12 text-white font-bold rounded-full disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
            style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}>

            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {tr("partnerverifypage_tesdiqle_4ffd4c", "T\u0259sdiql\u0259")}
          </button>
        </form>

        <p className="text-center mt-4" style={{ fontSize: 10, color: 'var(--a-ink-faint)' }}>{tr("untranslated_anacan_partnyor_endirim_sistem_qfwnst", "Anacan Partnyor Endirim Sistemi")}</p>
      </div>
    </div>);

}
