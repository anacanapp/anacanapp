import { tr } from "@/lib/tr";import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { X, RefreshCw, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { createRedemption, RedemptionResponse } from '@/hooks/usePartnerVenues';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
}

export default function RedemptionQRSheet({ open, onClose, venueId, venueName }: Props) {
  const [data, setData] = useState<RedemptionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await createRedemption(venueId);
      setData(r);
    } catch (e: any) {
      const msg = e?.message || tr("redemptionqrsheet_xeta_3cdbb6", "X\u0259ta");
      const map: Record<string, string> = {
        premium_required: tr("redemptionqrsheet_bu_funksiya_yalniz_premium_uzv_ee315c", "Bu funksiya yaln\u0131z Premium \xFCzvl\u0259r \xFC\xE7\xFCnd\xFCr."),
        cooldown: tr("redemptionqrsheet_bu_mekanda_hele_endirim_istifa_a25eb8", "Bu m\u0259kanda h\u0259l\u0259 endirim istifad\u0259 etmisiniz. Bir az g\xF6zl\u0259yin."),
        lifetime_limit_reached: tr("redemptionqrsheet_bu_mekan_ucun_endirim_limiti_d_17dc4d", "Bu m\u0259kan \xFC\xE7\xFCn endirim limiti dolub."),
        venue_inactive: tr("redemptionqrsheet_mekan_muveqqeti_olaraq_aktiv_d_e2b19d", "M\u0259kan m\xFCv\u0259qq\u0259ti olaraq aktiv deyil."),
        venue_not_found: tr("redemptionqrsheet_mekan_tapilmadi_028fb4", "M\u0259kan tap\u0131lmad\u0131.")
      };
      setError(map[msg] || msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) generate();else
    {setData(null);setError(null);}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, venueId]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const expiresMs = data ? new Date(data.expires_at).getTime() : 0;
  const remainingSec = Math.max(0, Math.floor((expiresMs - now) / 1000));
  const expired = data && remainingSec <= 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[92vh] overflow-y-auto">
        <div className="p-5 pb-8 flex flex-col items-center text-center">
          <div className="w-12 h-1.5 bg-muted rounded-full mb-4" />
          <button onClick={onClose} className="absolute top-3 end-3 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{tr("untranslated_anacan_endirimi_eg7euj", "Anacan Endirimi")}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">{venueName}</h2>
          {data && <p className="text-sm text-muted-foreground mb-4">{data.discount_label}</p>}

          {loading &&
          <div className="py-10">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">{tr("redemptionqrsheet_qr_yaradilir_a37052", "QR yarad\u0131l\u0131r...")}</p>
            </div>
          }

          {error && !loading &&
          <div className="w-full bg-destructive/10 border border-destructive/30 rounded-2xl p-5 my-4 flex flex-col items-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive font-medium">{error}</p>
              <Button onClick={generate} variant="outline" size="sm">{tr("redemptionqrsheet_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}</Button>
            </div>
          }

          {data && !error &&
          <>
              <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-5 rounded-3xl shadow-lg border-4 border-primary/20 my-3">
              
                <QRCodeSVG value={data.verify_url} size={240} level="M" includeMargin={false} />
              </motion.div>

              <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
            expired ? 'bg-destructive/15 text-destructive' :
            remainingSec < 60 ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`
            }>
                {expired ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {expired ? tr("redemptionqrsheet_muddeti_bitdi_463a85", "M\xFCdd\u0259ti bitdi") : `Qalan vaxt: ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`}
              </div>

              <p className="text-xs text-muted-foreground max-w-xs mt-4 leading-relaxed">
                {tr("redemptionqrsheet_kassir_telefonun_kamerasi_ile__45af84", "Kassir telefonun kameras\u0131 il\u0259 bu QR-\u0131 oxuyacaq v\u0259 PIN kodunu daxil ed\u0259r\u0259k t\u0259sdiql\u0259y\u0259c\u0259k.")}
              </p>

              {expired &&
            <Button onClick={generate} className="mt-4 w-full" size="lg">
                  <RefreshCw className="w-4 h-4 me-2" /> {tr("redemptionqrsheet_yeni_qr_yarat_f123bc", "Yeni QR yarat")}
                </Button>
            }
            </>
          }
        </div>
      </SheetContent>
    </Sheet>);

}