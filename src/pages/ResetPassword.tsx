import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const fieldCls = "ps-12 pe-12 h-14 rounded-2xl border-2 border-transparent text-base transition-all bg-[var(--a-surface-soft)] text-[var(--a-ink)] focus:border-[var(--a-peach-2)] focus-visible:ring-0";

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: tr("resetpassword_sessiya_tapilmadi_2d6594", "Sessiya tapılmadı"),
          description: tr("resetpassword_sifre_berpa_linki_artiq_etibarsizdir_2b5a53", "Şifrə bərpa linki artıq etibarsızdır."),
          variant: 'destructive'
        });
      }
    };
    checkSession();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast({
        title: tr("resetpassword_sifre_teleb_olunur_079295", "Şifrə tələb olunur"),
        description: tr("resetpassword_zehmet_olmasa_yeni_sifrenizi_daxil_edin_6e8886", "Zəhmət olmasa yeni şifrənizi daxil edin."),
        variant: 'destructive'
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: tr("resetpassword_sifre_cox_qisadir_3b9bb2", "Şifrə çox qısadır"),
        description: tr("resetpassword_sifre_minimum_6_simvol_olmalidir_5fbb99", "Şifrə minimum 6 simvol olmalıdır."),
        variant: 'destructive'
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: tr("resetpassword_sifreler_uygun_gelmir_af4b84", "Şifrələr uyğun gəlmir"),
        description: tr("resetpassword_her_iki_sifre_eyni_olmalidir_e34cfb", "Hər iki şifrə eyni olmalıdır."),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          title: tr("resetpassword_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
          description: tr("resetpassword_sifre_yenilene_bilmedi_yeniden_cehd_edin_8eb28e", "Şifrə yenilənə bilmədi. Yenidən cəhd edin."),
          variant: 'destructive'
        });
      } else {
        setIsSuccess(true);
        toast({
          title: tr("resetpassword_sifre_yenilendi_6ce208", "Şifrə yeniləndi! 🎉"),
          description: tr("resetpassword_yeni_sifrenizle_daxil_ola_bilersiniz_87d13a", "Yeni şifrənizlə daxil ola bilərsiniz.")
        });

        // Redirect to home after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: tr("resetpassword_xeta_bas_verdi_f22fba", "Xəta baş verdi"),
        description: tr("resetpassword_yeniden_cehd_edin_18c03c", "Yenidən cəhd edin."),
        variant: 'destructive'
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="a-scope min-h-screen flex flex-col safe-top safe-bottom overflow-hidden relative" style={{ background: 'var(--a-bg)' }}>
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
        <span className="a-cloud c4" />
      </div>

      {/* Header */}
      <div className="relative pt-14 pb-8 px-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative flex flex-col items-center">

          <motion.div
            className="w-20 h-20 flex items-center justify-center mb-5"
            style={{ borderRadius: 24, background: 'var(--a-grad-peach)', boxShadow: '0 20px 40px -16px rgba(217, 108, 74, 0.55)' }}>

            <Lock size={36} style={{ color: 'var(--a-accent-ink)' }} />
          </motion.div>
          <h1 style={{ fontSize: 27, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--a-ink)' }}>{tr("resetpassword_sifreni_yenile_b1ff44", "Şifrəni Yenilə")}</h1>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--a-on-bg-soft)', marginTop: 6 }}>{tr("resetpassword_yeni_sifrenizi_teyin_edin_96ef69", "Yeni şifrənizi təyin edin")}</p>
        </motion.div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 relative z-10 max-w-md mx-auto w-full">
        <motion.div
          className="a-card"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}>

          {isSuccess ?
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8">

              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-green-1)' }}>
                <Check size={38} style={{ color: 'var(--a-green-ink)' }} strokeWidth={2.5} />
              </div>
              <h2 className="mb-2" style={{ fontSize: 19, fontWeight: 800, color: 'var(--a-ink)' }}>{tr("resetpassword_sifre_yenilendi_f3ee31", "Şifrə Yeniləndi!")}</h2>
              <p style={{ fontSize: 13.5, color: 'var(--a-ink-soft)' }}>{tr("resetpassword_ana_sehifeye_yonlendirilirsiniz_8dbdb0", "Ana səhifəyə yönləndirilirsiniz...")}</p>
            </motion.div> :

          <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}>

                <label className="mb-2 block" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>
                  {tr("resetpassword_yeni_sifre_56fd00", "Yeni \u015Eifr\u0259")}
                </label>
                <div className="relative group">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                  <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tr("untranslated_minimum_6_simvol_nifi5y", "Minimum 6 simvol")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldCls} />

                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--a-ink-faint)' }}>

                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>

              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}>

                <label className="mb-2 block" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>
                  {tr("resetpassword_sifreni_tesdiqle_030254", "\u015Eifr\u0259ni T\u0259sdiql\u0259")}
                </label>
                <div className="relative group">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                  <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={tr("resetpassword_sifreni_yeniden_daxil_edin_7e89fb", "Şifrəni yenidən daxil edin")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldCls} />

                  <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--a-ink-faint)' }}>

                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>

              <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}>

                <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 rounded-full text-white font-bold text-base border-0 hover:opacity-95"
                style={{ background: 'var(--a-peach-2)', boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}>

                  {isLoading ?
                <div className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : tr("resetpassword_sifreni_yenile_b1ff44", "\u015Eifr\u0259ni Yenil\u0259")


                }
                </Button>
              </motion.div>

              <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center">

                <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center justify-center gap-2 mx-auto transition-colors hover:opacity-80"
                style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>

                  <ArrowLeft className="rtl:rotate-180 w-4 h-4" />
                  {tr("resetpassword_ana_sehifeye_qayit_723295", "Ana s\u0259hif\u0259y\u0259 qay\u0131t")}
                </button>
              </motion.div>
            </form>
          }
        </motion.div>
      </div>
    </div>);

};

export default ResetPassword;
