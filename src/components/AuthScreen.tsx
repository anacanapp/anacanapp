import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Users, Eye, EyeOff, Sparkles, ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isAzureBackend } from '@/integrations/supabase/backend-config';
import logoImage from '@/assets/brand-mark.png';
import { useAppBranding, getBrandingUrl } from '@/hooks/useAppBranding';
import { useAppSetting } from '@/hooks/useAppSettings';
import { tr } from "@/lib/tr";
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import CountrySelect from '@/components/CountrySelect';
import { getPartnerLinkErrorMessage, isAzurePartnerPairingEnabled, linkPartnerByCode, normalizeSecurePartnerCode, PartnerLinkError } from '@/lib/partner-link';
import { APPLE_WEB_ORIGIN, appleWebErrorMessage, cancelAppleWebSignIn, isAppleWebCancelled, prepareAppleWebSignIn, usesAzureAppleWebFlow } from '@/lib/apple-web-auth';
import { isModeratorSignupError, moderatorError } from '@/lib/moderator';

type AuthMode = 'login' | 'register' | 'forgot-password';
type PartnerAuthMode = 'login' | 'register';
type MainView = 'main' | 'partner';

// Dizayn sistemi input stili — yumşaq səth + fokus vurğusu
const fieldCls = "ps-11 h-12 rounded-xl border-2 border-transparent text-base transition-all bg-[var(--a-surface-soft)] text-[var(--a-ink)] focus:border-[var(--a-peach-2)] focus-visible:ring-0";
const fieldClsBlue = "ps-11 h-12 rounded-xl border-2 border-transparent text-base transition-all bg-[var(--a-surface-soft)] text-[var(--a-ink)] focus:border-[#63acdf] focus-visible:ring-0";

function getSignupErrorMessage(error: any): string {
  if (isModeratorSignupError(error)) return moderatorError(error, useUserStore.getState().language);
  const code = error?.code || '';
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('fetch') || msg.includes('network request failed') || msg.includes('networkerror')) {
    return tr('auth_connection_unavailable', 'Serverə qoşulmaq mümkün olmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
  }
  if (code === 'weak_password' || msg.includes('weak') || msg.includes('pwned')) {
    return tr("authscreen_sifre_cox_zeifdir_ve_ya_sizdir_e88929", "\u015Eifr\u0259 \xE7ox z\u0259ifdir v\u0259 ya s\u0131zd\u0131r\u0131lm\u0131\u015F \u015Fifr\u0259l\u0259r siyah\u0131s\u0131ndad\u0131r. Daha g\xFCcl\xFC, unikal bir \u015Fifr\u0259 se\xE7in (\u0259n az\u0131 8 simvol, b\xF6y\xFCk/ki\xE7ik h\u0259rf, r\u0259q\u0259m v\u0259 simvol).");
  }
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
    return tr("authscreen_bu_e_mail_artiq_qeydiyyatdan_k_9e529d", "Bu e-mail art\u0131q qeydiyyatdan ke\xE7ib. Giri\u015F edin v\u0259 ya \u015Fifr\u0259ni unutmusunuzsa b\u0259rpa edin.");
  }
  if (code === 'invalid_email' || msg.includes('invalid email') || msg.includes('email address')) {
    return tr("authscreen_e_mail_unvani_duzgun_deyil_ae6d26", "E-mail \xFCnvan\u0131 d\xFCzg\xFCn deyil.");
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    return tr("authscreen_cox_sayda_cehd_edildi_bir_az_s_782c25", "\xC7ox sayda c\u0259hd edildi. Bir az sonra yenid\u0259n c\u0259hd edin.");
  }
  if (msg.includes('password') && msg.includes('characters')) {
    return tr("authscreen_sifre_en_azi_6_simvoldan_ibare_8dd3e4", "\u015Eifr\u0259 \u0259n az\u0131 6 simvoldan ibar\u0259t olmal\u0131d\u0131r.");
  }
  return error?.message || tr("authscreen_qeydiyyat_zamani_xeta_bas_verd_100ebf", "Qeydiyyat zaman\u0131 x\u0259ta ba\u015F verdi. Yenid\u0259n c\u0259hd edin.");
}

function getLoginErrorMessage(error: any): string {
  const code = error?.code || '';
  const msg = (error?.message || '').toLowerCase();

  if (msg.includes('fetch') || msg.includes('network request failed') || msg.includes('networkerror')) {
    return tr('auth_connection_unavailable', 'Serverə qoşulmaq mümkün olmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return tr("authscreen_e_mail_ve_ya_sifre_yanlisdir_1ef792", "E-mail v\u0259 ya \u015Fifr\u0259 yanl\u0131\u015Fd\u0131r.");
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return tr("authscreen_e_mail_tesdiqlenmeyib_50f146", "E-mail t\u0259sdiql\u0259nm\u0259yib.");
  }
  if (msg.includes('rate limit') || code === 'over_request_rate_limit') {
    return tr("authscreen_cox_sayda_cehd_edildi_bir_az_s_ff5fd3", "\xC7ox sayda c\u0259hd edildi. Bir az sonra yenid\u0259n yoxlay\u0131n.");
  }

  return error?.message || tr("authscreen_giris_zamani_xeta_bas_verdi_ye_1c654e", "Giri\u015F zaman\u0131 x\u0259ta ba\u015F verdi. Yenid\u0259n c\u0259hd edin.");
}

// The toast owns this form even if signup navigates away from AuthScreen.
function PartnerPairingRetry({ initialCode, initialError, onRetry }: {
  initialCode: string;
  initialError: unknown;
  onRetry: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  return (
    <form className="space-y-3 mt-2" onSubmit={async (event) => {
      event.preventDefault();
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await onRetry(code);
      } catch (nextError) {
        setError(nextError);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }}>
      <p role="alert">{getPartnerLinkErrorMessage(error)}</p>
      <Input
        aria-label={tr('partner_pairing_invite_label', 'Partner invitation code')}
        autoComplete="off"
        maxLength={64}
        value={code}
        disabled={busy}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      <Button type="submit" disabled={busy}>
        {busy ? tr('partner_pairing_connecting', 'Connecting...') : tr('partner_pairing_retry', 'Retry pairing')}
      </Button>
    </form>
  );
}

const AuthScreen = () => {
  const [mainView, setMainView] = useState<MainView>('main');
  const [mode, setMode] = useState<AuthMode>('login');
  const [partnerMode, setPartnerMode] = useState<PartnerAuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pendingPartnerRegistration = useRef<{ email: string; userId: string } | null>(null);

  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const { toast } = useToast();
  const { data: branding = [] } = useAppBranding();
  const socialLoginEnabled = useAppSetting('social_login_enabled');
  const isSocialLoginEnabled = socialLoginEnabled === true || socialLoginEnabled === 'true';
  // Explicit provider UI enablement for Azure preview / release builds.
  // Server configuration and full-user cutover acceptance remain separate checks.
  const googleLoginReady = !isAzureBackend() || import.meta.env.VITE_AZURE_GOOGLE_OAUTH_ENABLED === 'true';
  const appleConfigured = !isAzureBackend() || import.meta.env.VITE_AZURE_APPLE_OAUTH_ENABLED === 'true';
  const appleUsesJs = usesAzureAppleWebFlow() && appleConfigured;
  const [applePreparation, setApplePreparation] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [applePreparationError, setApplePreparationError] = useState<unknown>(null);
  const [appleRetry, setAppleRetry] = useState(0);
  const appleLoginReady = appleConfigured && (!appleUsesJs || applePreparation === 'ready');
  useEffect(() => {
    if (!appleUsesJs) return;
    let disposed = false;
    setApplePreparation('loading');
    prepareAppleWebSignIn().then(() => {
      if (!disposed) { setApplePreparation('ready'); setApplePreparationError(null); }
    }).catch(error => {
      if (!disposed) { setApplePreparation('failed'); setApplePreparationError(error); }
    });
    return () => { disposed = true; cancelAppleWebSignIn(); };
  }, [appleUsesJs, appleRetry]);
  const { countryCode, setCountryCode } = useUserStore(
    useShallow((s) => ({ countryCode: s.countryCode, setCountryCode: s.setCountryCode }))
  );

  // Get custom login logo from database
  const customLoginLogo = getBrandingUrl(branding, 'login_logo');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setPartnerCode('');
    setShowPassword(false);
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email || !password) {
        toast({
          title: tr("authscreen_melumat_teleb_olunur_a6d6a7", 'Məlumat tələb olunur'),
          description: tr("authscreen_e_mail_ve_sifre_daxil_edin_07e5e3", 'E-mail və şifrə daxil edin.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      if (partnerMode === 'login') {
        // Partner login - just sign in, no code needed
        const { error: authError } = await signIn(email, password);
        if (authError) {
          toast({
            title: tr("authscreen_giris_alinmadi_e321fa", 'Giriş alınmadı'),
            description: tr("authscreen_e_mail_ve_ya_sifre_yanlisdir_1ef792", 'E-mail və ya şifrə yanlışdır.'),
            variant: 'destructive'
          });
        } else {
          toast({
            title: tr("authscreen_xos_geldiniz_96d761", 'Xoş gəldiniz! 👋'),
            description: tr("authscreen_partnyor_paneline_daxil_oldunuz_0fc533", 'Partnyor panelinə daxil oldunuz.')
          });
        }
        setIsLoading(false);
        return;
      }

      // ── Registration flow ──
      // Ölkə MƏCBURİDİR — "Naməlum ölkə" statistika problemi + ölkəyə bağlı
      // funksiyalar (community sıralama, tortlar, peyvənd təqvimi) üçün
      if (!countryCode) {
        toast({
          title: tr("authscreen_olke_secin_title", 'Ölkə seçin'),
          description: tr("authscreen_olke_secin_desc", 'Davam etmək üçün yaşadığınız ölkəni seçin.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // ── Validate partner code ──
      const normalizedPartnerCode = partnerCode.trim().toUpperCase();
      if (isAzurePartnerPairingEnabled()) {
        try {
          normalizeSecurePartnerCode(partnerCode);
        } catch (error) {
          toast({ title: getPartnerLinkErrorMessage(error), variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        // Do not enumerate profiles anonymously. The authenticated RPC validates the invitation.
        const registrationEmail = email.trim().toLowerCase();
        let registration = pendingPartnerRegistration.current;
        if (registration?.email !== registrationEmail) {
          const partnerName = nameInputRef.current?.value || name || 'Partner';
          const { data, error } = await signUp(email, password, partnerName.trim(), countryCode);
          if (error || !data?.user?.id) {
            toast({ title: getSignupErrorMessage(error), variant: 'destructive' });
            setIsLoading(false);
            return;
          }
          registration = { email: registrationEmail, userId: data.user.id };
          pendingPartnerRegistration.current = registration;
        }
        const registeredUserId = registration.userId;

        const finishPairing = async (code: string, retry = false) => {
          normalizeSecurePartnerCode(code);
          let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!sessionData.session && retry) {
            // Email confirmation can finish after signup. A retry signs in, never signs up again.
            const { error } = await signIn(email, password);
            if (error) throw error;
            const result = await supabase.auth.getSession();
            sessionData = result.data;
            sessionError = result.error;
            if (sessionError) throw sessionError;
          }
          if (!sessionData.session) throw new PartnerLinkError('NOT_AUTHENTICATED');
          if (sessionData.session.user.id !== registeredUserId) throw new PartnerLinkError('PAIRING_ACCOUNT_CHANGED');
          await linkPartnerByCode(code);
          pendingPartnerRegistration.current = null;
          toast({ title: tr('partner_pairing_connected', 'Partner linked successfully.') });
          window.location.reload();
        };

        try {
          await finishPairing(normalizedPartnerCode);
        } catch (error) {
          toast({
            title: tr('partner_pairing_account_created', 'Account created, but partner linking is not complete. Do not register again.'),
            duration: Infinity,
            description: <PartnerPairingRetry initialCode={normalizedPartnerCode} initialError={error} onRetry={(code) => finishPairing(code, true)} />
          });
        }
        setIsLoading(false);
        return;
      }
      if (!normalizedPartnerCode.startsWith('ANACAN-') || normalizedPartnerCode.length < 10) {
        toast({
          title: tr("authscreen_kod_yanlisdir_64b48f", 'Kod yanlışdır'),
          description: tr("authscreen_zehmet_olmasa_duzgun_partnyor_kodu_daxil_cface0", 'Zəhmət olmasa düzgün partnyor kodu daxil edin.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Verify the partner code exists BEFORE registering
      const { data: partnerProfiles, error: findError } = await supabase.
      rpc('find_partner_by_code', { p_partner_code: normalizedPartnerCode });

      const partnerProfile = partnerProfiles?.[0];

      if (findError || !partnerProfile) {
        toast({
          title: tr("authscreen_partnyor_tapilmadi_1239a8", 'Partnyor tapılmadı'),
          description: tr("authscreen_bu_kodla_partnyor_tapilmadi_kodu_yoxlayi_a94376", 'Bu kodla partnyor tapılmadı. Kodu yoxlayın.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }


      // Register new partner
      const partnerName = nameInputRef.current?.value || name || 'Partner';
      const { error: registerError } = await signUp(email, password, partnerName.trim(), countryCode);
      if (registerError) {
        toast({
          title: tr("authscreen_qeydiyyat_alinmadi_982f04", "Qeydiyyat alınmadı"),
          description: getSignupErrorMessage(registerError),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Wait for profile to be created (trigger may take a moment)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get current user session
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;

      if (!currentUserId) {
        toast({
          title: tr("authscreen_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
          description: tr("authscreen_sessiya_tapilmadi_yeniden_cehd_edin_651207", 'Sessiya tapılmadı. Yenidən cəhd edin.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Get my profile
      const { data: myProfile, error: profileError } = await supabase.
      from('profiles').
      select('id').
      eq('user_id', currentUserId).
      maybeSingle();

      if (profileError || !myProfile) {
        toast({
          title: tr("authscreen_profil_xetasi_4b403e", 'Profil xətası'),
          description: tr("authscreen_profiliniz_yaradilarken_xeta_bas_verdi_y_2bdc7b", 'Profiliniz yaradılarkən xəta baş verdi. Yenidən cəhd edin.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Update my profile to link to partner and set life_stage to partner
      const { error: updateMyError } = await supabase.
      from('profiles').
      update({
        linked_partner_id: partnerProfile.id,
        life_stage: 'partner'
      }).
      eq('user_id', currentUserId);

      if (updateMyError) {
        console.error('Error updating my profile:', updateMyError);
        toast({
          title: tr("authscreen_baglanti_xetasi_e97fbc", 'Bağlantı xətası'),
          description: tr("authscreen_partnyor_ile_baglanti_qurula_bilmedi_d95403", 'Partnyor ilə bağlantı qurula bilmədi.'),
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Update partner's profile to link back to me using SECURITY DEFINER function
      await supabase.rpc('link_partners', {
        p_my_profile_id: myProfile.id,
        p_partner_profile_id: partnerProfile.id,
        p_partner_user_id: partnerProfile.user_id
      });

      toast({
        title: tr("authscreen_ugurla_baglandiniz_62b079", 'Uğurla bağlandınız! 🎉'),
        description: `${partnerProfile.name} ${tr("auth_linked_with", "ilə əlaqələndirildiniz.")}`
      });

      // Force page refresh to update auth state
      window.location.reload();
    } catch (error) {
      console.error('Partner auth error:', error);
      toast({
        title: tr("authscreen_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        description: tr("authscreen_yeniden_cehd_edin_18c03c", 'Yenidən cəhd edin.'),
        variant: 'destructive'
      });
    }

    setIsLoading(false);
  };

  const handleMainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'forgot-password') {
        if (!email) {
          toast({
            title: tr("authscreen_e_mail_teleb_olunur_29dbb5", 'E-mail tələb olunur'),
            description: tr("authscreen_zehmet_olmasa_e_mail_unvaninizi_daxil_ed_281019", 'Zəhmət olmasa e-mail ünvanınızı daxil edin.'),
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });

        if (error) {
          toast({
            title: tr("authscreen_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
            description: tr("authscreen_sifre_berpa_linki_gonderile_bilmedi_898ae3", 'Şifrə bərpa linki göndərilə bilmədi.'),
            variant: 'destructive'
          });
        } else {
          toast({
            title: tr("authscreen_link_gonderildi_9e4f3d", 'Link göndərildi! 📧'),
            description: tr("authscreen_e_mail_unvaniniza_sifre_berpa_linki_gond_f42b2e", 'E-mail ünvanınıza şifrə bərpa linki göndərildi.')
          });
          setMode('login');
          setEmail('');
        }
      } else if (mode === 'login') {
        if (!email || !password) {
          toast({
            title: tr("authscreen_melumat_teleb_olunur_a6d6a7", 'Məlumat tələb olunur'),
            description: tr("authscreen_e_mail_ve_sifre_daxil_edin_07e5e3", 'E-mail və şifrə daxil edin.'),
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: tr("authscreen_giris_alinmadi_e321fa", 'Giriş alınmadı'),
            description: getLoginErrorMessage(error),
            variant: 'destructive'
          });
        } else {
          toast({
            title: tr("authscreen_xos_geldiniz_96d761", 'Xoş gəldiniz! 👋'),
            description: tr("authscreen_anacan_a_xos_geldiniz_f08b39", 'Anacan-a xoş gəldiniz!')
          });
        }
      } else {
        // Register
        if (!email || !password) {
          toast({
            title: tr("authscreen_melumat_teleb_olunur_a6d6a7", 'Məlumat tələb olunur'),
            description: tr("authscreen_e_mail_ve_sifre_daxil_edin_07e5e3", 'E-mail və şifrə daxil edin.'),
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }

        // Ölkə MƏCBURİDİR (bax handlePartnerSubmit-dəki eyni yoxlama)
        if (!countryCode) {
          toast({
            title: tr("authscreen_olke_secin_title", 'Ölkə seçin'),
            description: tr("authscreen_olke_secin_desc", 'Davam etmək üçün yaşadığınız ölkəni seçin.'),
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }

        const finalName = nameInputRef.current?.value || name || email.split('@')[0];
        const { error } = await signUp(email, password, finalName.trim(), countryCode);
        if (error) {
          toast({
            title: tr("authscreen_qeydiyyat_alinmadi_982f04", "Qeydiyyat alınmadı"),
            description: getSignupErrorMessage(error),
            variant: 'destructive'
          });
        } else {
          toast({
            title: tr("authscreen_qeydiyyat_ugurludur_47a91b", 'Qeydiyyat uğurludur! 🎉'),
            description: tr("authscreen_anacan_a_xos_geldiniz_f08b39", 'Anacan-a xoş gəldiniz!')
          });
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: tr("authscreen_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        description: tr("authscreen_yeniden_cehd_edin_18c03c", 'Yenidən cəhd edin.'),
        variant: 'destructive'
      });
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: tr("authscreen_google_ile_giris_alinmadi_2d7d46", 'Google ilə giriş alınmadı'),
          description: isModeratorSignupError(error) ? moderatorError(error, useUserStore.getState().language) : error.message || tr("authscreen_yeniden_cehd_edin_18c03c", 'Yenidən cəhd edin.'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      toast({
        title: tr("authscreen_google_ile_giris_alinmadi_2d7d46", 'Google ilə giriş alınmadı'),
        description: error?.message || String(error),
        variant: 'destructive'
      });
    }
    setIsLoading(false);
  };

  const handleAppleLogin = async () => {
    if (!appleLoginReady || isLoading) return;
    setIsLoading(true);
    if (appleUsesJs) setApplePreparation('loading');
    try {
      const { error } = await signInWithApple();
      if (error && !(appleUsesJs && isAppleWebCancelled(error))) {
        toast({
          title: tr("authscreen_apple_ile_giris_alinmadi_6f9b3a", 'Apple ilə giriş alınmadı'),
          description: isModeratorSignupError(error) ? moderatorError(error, useUserStore.getState().language) : appleUsesJs ? appleWebErrorMessage(error) : error.message || tr("authscreen_yeniden_cehd_edin_18c03c", 'Yenidən cəhd edin.'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      if (!appleUsesJs) console.error('Apple auth error:', error);
      toast({
        title: tr("authscreen_apple_ile_giris_alinmadi_6f9b3a", 'Apple ilə giriş alınmadı'),
        description: appleUsesJs ? appleWebErrorMessage(error) : error?.message || String(error),
        variant: 'destructive'
      });
    }
    setIsLoading(false);
    if (appleUsesJs) setAppleRetry(value => value + 1);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    },
    exit: { opacity: 0, y: -20 }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
  };

  // Partner Auth View
  if (mainView === 'partner') {
    return (
      <div
        className="a-scope fixed inset-0 flex flex-col overflow-x-hidden"
        style={{
          background: 'var(--a-bg)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}>

        {/* Watercolor sky */}
        <div className="a-sky" aria-hidden>
          <span className="a-cloud c1" />
          <span className="a-cloud c2" />
          <span className="a-cloud c3" />
        </div>

        {/* Compact Partner Header */}
        <div className="relative px-5 pt-4 pb-2 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setMainView('main');
                resetForm();
              }}
              className="a-icon-btn shrink-0"
              aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ borderRadius: 14, background: 'var(--a-grad-blue)', boxShadow: '0 10px 20px -10px rgba(99, 172, 223, 0.6)' }}>
                <Users size={18} style={{ color: 'var(--a-blue-ink)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.2, color: 'var(--a-ink)' }}>
                  {tr("authscreen_partnyor_bolmesi_ed393a", "Partnyor Bölməsi")}
                </h1>
                <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>
                  {tr("authscreen_xaniminizla_birlikde_bu_seyahete_qosulun_fa14d9", "Xanımınızla birlikdə bu səyahətə qoşulun")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Auth Form - Scrollable */}
        <ScrollArea className="flex-1 relative z-10">
          <div className="px-5 pt-4 pb-8 max-w-md mx-auto">
            <motion.div
              className="a-card"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}>

              {/* Partner Mode Tabs */}
              <div className="a-tabs" style={{ marginBottom: 20 }}>
                {[
                { id: 'register', label: tr("authscreen_qeydiyyat", 'Qeydiyyat') },
                { id: 'login', label: tr("authscreen_giris_1ffbd7", 'Giriş') }].
                map((tab) =>
                <button
                  key={tab.id}
                  onClick={() => setPartnerMode(tab.id as PartnerAuthMode)}
                  className={`a-tab ${partnerMode === tab.id ? 'active' : ''}`}>

                    {tab.label}
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.form
                  key={partnerMode}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onSubmit={handlePartnerSubmit}
                  className="space-y-4">

                  {/* Partner Info */}
                  <motion.div variants={itemVariants} className="text-center mb-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--a-blue-1)' }}>
                      <Heart size={26} style={{ color: 'var(--a-blue-ink)' }} />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>
                      {partnerMode === 'register' ? tr("authscreen_xaniminizin_paylasdigi_kodu_da_6384d2", "Xan\u0131m\u0131n\u0131z\u0131n payla\u015Fd\u0131\u011F\u0131 kodu daxil ed\u0259r\u0259k qeydiyyatdan ke\xE7in") : tr("authscreen_movcud_hesabinizla_partnyor_ki_f43a87", "M\xF6vcud hesab\u0131n\u0131zla partnyor kimi daxil olun")


                      }
                    </p>
                  </motion.div>

                  {partnerMode === 'register' &&
                  <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <User className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[#63acdf]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        ref={nameInputRef}
                        type="text"
                        placeholder={tr("authscreen_adiniz_b3e84a", "Adınız")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={fieldClsBlue} />

                      </div>
                    </motion.div>
                  }

                    <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[#63acdf]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        type="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldClsBlue} />
                      </div>
                    </motion.div>

                    {partnerMode === 'register' && (
                      <motion.div variants={itemVariants}>
                        <div className="relative group">
                          <div className="absolute start-4 top-1/2 -translate-y-1/2 z-10">
                            <Globe className="w-5 h-5 transition-colors group-focus-within:text-[#63acdf]" style={{ color: 'var(--a-ink-faint)' }} />
                          </div>
                          <CountrySelect
                            value={countryCode}
                            onChange={setCountryCode}
                            placeholder={tr("authscreen_olke_secin", "Ölkə seçin")}
                            triggerClassName={`${fieldClsBlue} flex items-center gap-2`} />
                        </div>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[#63acdf]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={tr("authscreen_sifre_6771ac", "Şifrə")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${fieldClsBlue} pe-11`} />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute end-4 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: 'var(--a-ink-faint)' }}>

                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </motion.div>

                  {partnerMode === 'register' &&
                  <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Sparkles className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[#63acdf]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        type="text"
                        placeholder="ANACAN-XXXX"
                        value={partnerCode}
                        onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                        className={`${fieldClsBlue} uppercase tracking-widest font-mono`} />

                      </div>
                      <p className="mt-2 text-center" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
                        {tr("authscreen_partnyor_kodu_xaniminizin_prof_101165", "Partnyor kodu xan\u0131m\u0131n\u0131z\u0131n profilind\u0259 tap\u0131la bil\u0259r")}
                      </p>
                    </motion.div>
                  }

                  <motion.div variants={itemVariants} className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[52px] rounded-full text-white font-bold text-base border-0 transition-all duration-300 disabled:opacity-70 hover:opacity-95"
                      style={{ background: 'var(--a-blue-2)', boxShadow: '0 16px 32px -12px rgba(99, 172, 223, 0.65)' }}>

                      {isLoading ?
                      <motion.div
                        className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} /> :


                      <span className="flex items-center gap-2">
                          {partnerMode === 'register' ? tr("authscreen_qeydiyyatdan_kec_433379", "Qeydiyyatdan keç") : tr("authscreen_daxil_ol", 'Daxil ol')}
                          <ArrowRight className="rtl:rotate-180 w-5 h-5" />
                        </span>
                      }
                    </Button>
                  </motion.div>
                </motion.form>
              </AnimatePresence>
            </motion.div>

            {/* Terms */}
            <motion.p
              className="text-center mt-6 px-4"
              style={{ fontSize: 11.5, color: 'var(--a-on-bg-soft)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}>
              {tr("authscreen_davam_etmekle_7dba26", "Davam etməklə")}
              {' '}
              <button style={{ color: 'var(--a-blue-ink)', fontWeight: 600 }}>{tr("authscreen_sertler_d86d4e", "Şərtlər")}</button> {tr("authscreen_ve_4e4a26", "və")}{' '}
              <button style={{ color: 'var(--a-blue-ink)', fontWeight: 600 }}>{tr("authscreen_gizlilik_siyaseti_dc3f28", "Gizlilik Siyasəti")}</button> {tr("authscreen_ile_razilasirsiniz_547dd9", "ilə razılaşırsınız")}
            </motion.p>
          </div>
        </ScrollArea>
      </div>);

  }

  // Main Auth View
  return (
    <div
      className="a-scope fixed inset-0 flex flex-col overflow-x-hidden"
      data-app-viewport
      style={{
        background: 'var(--a-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>

      {/* Watercolor sky — brand cloudy backdrop */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
        <span className="a-cloud c4" />
        <span className="a-cloud c5" />
      </div>

      {/* Auth Form - Scrollable */}
      <ScrollArea className="flex-1 relative z-10">
        <div className="px-5 pt-10 pb-8 max-w-md mx-auto">
          {/* Compact brand */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 flex items-center justify-center mb-3 overflow-hidden rounded-full"
            style={{ boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.25)' }}>
              <img
                src={customLoginLogo || logoImage}
                alt="Anacan"
                className="w-full h-full object-contain rounded-full"
                onError={(event) => {
                  if (event.currentTarget.getAttribute('src') !== logoImage) {
                    event.currentTarget.src = logoImage;
                  }
                }}
              />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--a-ink)' }}>Anacan</h1>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-on-bg-soft)', marginTop: 2 }}>
              {tr("authscreen_bedeninle_harmoniyada_ol_ac87bc", "Bədəninlə harmoniyada ol")}
            </p>
          </motion.div>
          <motion.div
            className="a-card"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}>

            {/* Mode Tabs */}
            {mode !== 'forgot-password' &&
            <div className="a-tabs" style={{ marginBottom: 20 }}>
              {[
              { id: 'login', label: tr("authscreen_giris_1ffbd7", 'Giriş') },
              { id: 'register', label: tr("authscreen_qeydiyyat", 'Qeydiyyat') }].
              map((tab) =>
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as AuthMode)}
                className={`a-tab ${mode === tab.id ? 'active' : ''}`}>

                  {tab.label}
                </button>
              )}
            </div>
            }

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={handleMainSubmit}
                className="space-y-4">

                {mode === 'forgot-password' ?
                <>
                    <motion.div variants={itemVariants} className="text-center mb-6 relative">
                      <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="absolute start-0 top-0 p-2 transition-colors"
                      style={{ color: 'var(--a-ink-soft)' }}
                      aria-label={tr("common_geri", "Geri")}>

                        <ArrowLeft className="rtl:rotate-180 w-5 h-5" />
                      </button>
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-peach-1)' }}>
                        <Lock size={28} style={{ color: 'var(--a-accent-ink)' }} />
                      </div>
                      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>{tr("authscreen_sifreni_berpa_et_1d1ae1", "Şifrəni Bərpa Et")}</h2>
                      <p style={{ fontSize: 13, color: 'var(--a-ink-soft)', marginTop: 4 }}>
                        {tr("authscreen_e_mail_unvaniniza_berpa_linki__20b085", "E-mail ünvanınıza bərpa linki göndəriləcək")}
                      </p>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        type="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldCls} />

                      </div>
                    </motion.div>
                  </> :

                <>
                    {mode === 'register' &&
                  <motion.div variants={itemVariants}>
                        <div className="relative group">
                          <User className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                          <Input
                        ref={nameInputRef}
                        type="text"
                        placeholder={tr("authscreen_adiniz_b3e84a", "Adınız")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={fieldCls} />

                        </div>
                      </motion.div>
                  }

                    <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        type="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldCls} />

                      </div>
                    </motion.div>

                    {mode === 'register' && (
                      <motion.div variants={itemVariants}>
                        <div className="relative group">
                          <div className="absolute start-4 top-1/2 -translate-y-1/2 z-10">
                            <Globe className="w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                          </div>
                          <CountrySelect
                            value={countryCode}
                            onChange={setCountryCode}
                            placeholder={tr("authscreen_olke_secin", "Ölkə seçin")}
                            triggerClassName={`${fieldCls} flex items-center gap-2`} />
                        </div>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <div className="relative group">
                        <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--a-peach-2)]" style={{ color: 'var(--a-ink-faint)' }} />
                        <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={tr("authscreen_sifre_6771ac", "Şifrə")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${fieldCls} pe-11`} />

                        <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-4 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'var(--a-ink-faint)' }}>

                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </motion.div>

                    {mode === 'login' &&
                  <motion.div variants={itemVariants} className="text-end">
                        <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="hover:underline"
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-accent-ink)' }}>
                          {tr("authscreen_sifreni_unutdunuz_f70bc9", "Şifrəni unutdunuz?")}

                    </button>
                      </motion.div>
                  }
                  </>
                }

                <motion.div variants={itemVariants} className="pt-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-[52px] rounded-full text-white font-bold text-base border-0 transition-all duration-300 disabled:opacity-70 hover:opacity-95"
                    style={{ background: 'var(--a-peach-2)', boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}>

                    {isLoading ?
                    <motion.div
                      className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} /> :


                      <span className="flex items-center gap-2">
                        {mode === 'login' ? tr("authscreen_daxil_ol", 'Daxil ol') : mode === 'register' ? tr("authscreen_qeydiyyatdan_kec_433379", "Qeydiyyatdan keç") : tr("authscreen_link_gonder_d6b028", "Link göndər")}
                        <ArrowRight className="rtl:rotate-180 w-5 h-5" />
                      </span>
                    }
                  </Button>
                </motion.div>
              </motion.form>
            </AnimatePresence>

            {/* Social Login */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-7">

              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px" style={{ background: 'var(--a-line-strong)' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--a-ink-soft)' }}>{tr("authscreen_ve_ya_c50561", "və ya")}</span>
                <div className="flex-1 h-px" style={{ background: 'var(--a-line-strong)' }} />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || !googleLoginReady}
                  className="w-full h-12 rounded-full transition-all gap-3"
                  style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}
                  onClick={handleGoogleLogin}>

                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="font-medium">{tr("authscreen_google_ile_davam_et", "Google ilə davam et")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || !appleLoginReady}
                  className="w-full h-12 rounded-full transition-all gap-3"
                  style={{ background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' }}
                  onClick={handleAppleLogin}>

                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <span className="font-medium">{tr("authscreen_apple_ile_davam_et", "Apple ilə davam et")}</span>
                </Button>
              </div>
              {appleUsesJs && applePreparation !== 'ready' && !isLoading && (
                <div className="mt-3 text-xs text-center text-muted-foreground" role="status">
                  {applePreparation === 'loading'
                    ? tr('auth_apple_web_loading', 'Apple girişi hazırlanır...')
                    : appleWebErrorMessage(applePreparationError)}
                  {applePreparation === 'failed' && (window.location.origin !== APPLE_WEB_ORIGIN
                    ? <a className="block underline mt-1" href={APPLE_WEB_ORIGIN}>api.anacan.az</a>
                    : <button type="button" className="block underline mt-1 mx-auto" onClick={() => setAppleRetry(value => value + 1)}>
                      {tr('auth_apple_web_retry', 'Yenidən hazırla')}
                    </button>)}
                </div>
              )}
              {(!googleLoginReady || !appleConfigured) && (
                <p className="mt-3 text-xs text-center text-muted-foreground" role="status">
                  {tr('auth_social_provider_pending', 'Deaktiv giriş üsulları bu Azure önizləməsində hələ qoşulmayıb. E-mail və şifrədən istifadə edə bilərsiniz.')}
                </p>
              )}
            </motion.div>


            {/* Partner Section Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6">

              <button
                type="button"
                onClick={() => {
                  setMainView('partner');
                  resetForm();
                }}
                className="w-full flex items-center justify-between group transition-all duration-300"
                style={{ padding: '16px 18px', borderRadius: 20, background: 'var(--a-blue-1)', border: '1.5px solid rgba(99, 172, 223, 0.4)' }}>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{ borderRadius: 14, background: 'var(--a-blue-2)', boxShadow: '0 8px 16px -8px rgba(99, 172, 223, 0.6)' }}>
                    <Users size={18} className="text-white" />
                  </div>
                  <div className="text-start">
                    <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-blue-ink)' }}>{tr("authscreen_partnyor_bolmesi_ed393a", "Partnyor Bölməsi")}</p>
                    <p style={{ fontSize: 11, color: 'var(--a-blue-ink)' }}>{tr("authscreen_xaniminizla_baglanmaq_ucun_d7b234", "Xanımınızla bağlanmaq üçün")}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="rtl:rotate-180 group-hover:translate-x-1 transition-transform" style={{ color: 'var(--a-blue-ink)' }} />
              </button>
            </motion.div>
          </motion.div>

          {/* Terms */}
          <motion.p
            className="text-center mt-6 px-4"
            style={{ fontSize: 11.5, color: 'var(--a-on-bg-soft)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}>
            {tr("authscreen_davam_etmekle_7dba26", "Davam etm\u0259kl\u0259")}
            {' '}
            <button style={{ color: 'var(--a-accent-ink)', fontWeight: 600 }}>{tr("authscreen_sertler_d86d4e", "Şərtlər")}</button> {tr("authscreen_ve_4e4a26", "v\u0259")}{' '}
            <button style={{ color: 'var(--a-accent-ink)', fontWeight: 600 }}>{tr("authscreen_gizlilik_siyaseti_dc3f28", "Gizlilik Siyasəti")}</button> {tr("authscreen_ile_razilasirsiniz_547dd9", "il\u0259 raz\u0131la\u015F\u0131rs\u0131n\u0131z")}
          </motion.p>
        </div>
      </ScrollArea>
    </div>);

};

export default AuthScreen;
