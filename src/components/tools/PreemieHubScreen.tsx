import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Baby, HeartHandshake, Milk, ShieldCheck, Stethoscope, CalendarClock } from 'lucide-react';
import { ToolPage, ToolHeader } from '@/components/tools/anacan/ToolKit';
import { useChildren } from '@/hooks/useChildren';
import { hapticFeedback } from '@/lib/native';
import { tr } from '@/lib/tr';

/**
 * Preemie Hub — vaxtından əvvəl doğulmuş körpələr üçün bələdçi.
 * Bölmələr: korreksiya olunmuş yaş, NICU, kenquru qayğısı, qidalanma,
 * infeksiyadan qorunma (RSV), təhlükə əlamətləri.
 * Məzmun maarifləndirici xarakter daşıyır — həkim məsləhətini əvəz etmir.
 */

interface Props {
  onBack: () => void;
}

interface HubItem {
  id: string;
  emoji: string;
  title: string;
  body: string;
}

interface HubSection {
  id: string;
  icon: typeof Baby;
  iconBg: string;
  title: string;
  intro?: string;
  items: HubItem[];
}

const PreemieHubScreen = ({ onBack }: Props) => {
  const { selectedChild, getChildAge } = useChildren();
  const childAge = selectedChild ? getChildAge(selectedChild) : null;
  const isPremature = !!childAge?.isPremature;
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = async (id: string) => {
    await hapticFeedback.light();
    setOpenId((prev) => (prev === id ? null : id));
  };

  const sections: HubSection[] = [
  {
    id: 'corrected',
    icon: CalendarClock,
    iconBg: 'var(--a-peach-1)',
    title: tr('preemie_sec_corrected', 'Korreksiya olunmuş yaş nədir?'),
    intro: tr('preemie_sec_corrected_intro', 'Vaxtından əvvəl doğulan körpənin inkişafı gözlənilən doğum tarixindən (EDD) hesablanan yaşla qiymətləndirilir.'),
    items: [
    { id: 'c1', emoji: '🧮', title: tr('preemie_c1_t', 'Necə hesablanır?'), body: tr('preemie_c1_b', 'Korreksiya olunmuş yaş = real (xronoloji) yaş − erkənlik müddəti. Məsələn, körpə 2 ay əvvəl doğulubsa və indi 5 aylıqdırsa, korreksiya olunmuş yaşı 3 aydır. Praktikada bu, gözlənilən doğum tarixindən (EDD) bu günə qədər keçən müddətə bərabərdir.') },
    { id: 'c2', emoji: '📈', title: tr('preemie_c2_t', 'Harada istifadə olunur?'), body: tr('preemie_c2_b', 'İnkişaf mərhələləri (dönmə, oturma, yerimə), böyümə əyriləri (çəki/boy percentilləri), oyun və məşğuliyyət seçimi — hamısı korreksiya olunmuş yaşla qiymətləndirilməlidir. Anacan bunu avtomatik tətbiq edir: böyümə qrafiki, günlük inkişaf məzmunu və oyun tövsiyələri artıq korreksiya olunmuş yaşla işləyir.') },
    { id: 'c3', emoji: '💉', title: tr('preemie_c3_t', 'Harada istifadə OLUNMUR?'), body: tr('preemie_c3_b', 'Peyvəndlər korreksiya olunmuş yaşa görə DEYİL, real doğum tarixinə görə vurulur (beynəlxalq standart — WHO/AAP). Peyvənd təqvimini gecikdirməyin: vaxtından əvvəl doğulan körpələr infeksiyalara daha həssasdır və qorunmaya daha tez ehtiyac duyur.') },
    { id: 'c4', emoji: '⏳', title: tr('preemie_c4_t', 'Nə vaxta qədər?'), body: tr('preemie_c4_b', 'Adətən 24 ay (2 yaş) korreksiya olunmuş yaşa qədər. Bu yaşdan sonra əksər körpələr yaşıdlarına çatır və korreksiyaya ehtiyac qalmır. Bəzi hallarda (çox erkən doğulanlar üçün) həkim 3 yaşa qədər davam etməyi məsləhət görə bilər.') }]
  },
  {
    id: 'nicu',
    icon: Stethoscope,
    iconBg: 'var(--a-blue-1)',
    title: tr('preemie_sec_nicu', 'NICU (intensiv qayğı) bələdçisi'),
    intro: tr('preemie_sec_nicu_intro', 'Yenidoğulmuşların intensiv qayğı şöbəsi qorxuducu görünə bilər — amma orada nə baş verdiyini bilmək narahatlığı azaldır.'),
    items: [
    { id: 'n1', emoji: '🖥️', title: tr('preemie_n1_t', 'Avadanlıq sizi qorxutmasın'), body: tr('preemie_n1_b', 'Monitorlar ürək ritmi, tənəffüs və oksigeni izləyir; qidalanma zondu körpə əmməyi öyrənənə qədər süd verir; CPAP tənəffüsə dəstəkdir; inkubator istiliyi qoruyur. Siqnal səsləri çox vaxt kiçik dəyişikliklərdir — hər siqnal təhlükə demək deyil.') },
    { id: 'n2', emoji: '🤱', title: tr('preemie_n2_t', 'Valideyn kimi rolunuz böyükdür'), body: tr('preemie_n2_b', 'Səsiniz, toxunuşunuz və ana südü — heç bir avadanlığın verə bilmədiyi şeylərdir. Körpənizlə danışın, mahnı oxuyun, mümkün olanda dəri-dəriyə təmas edin. Tibb heyətindən körpənin qayğısında iştirak etməyi istəyin (bez dəyişmə, temperatur ölçmə).') },
    { id: 'n3', emoji: '❓', title: tr('preemie_n3_t', 'Sual verməkdən çəkinməyin'), body: tr('preemie_n3_b', 'Hər gün soruşa biləcəkləriniz: bu gün çəkisi nə qədərdir? Qidalanma necə gedir? Bu günün planı nədir? Evə yazılmaq üçün hansı mərhələlər qalıb? Suallarınızı telefonda qeyd edin — görüşdə unutmayasınız.') },
    { id: 'n4', emoji: '🏠', title: tr('preemie_n4_t', 'Evə yazılma meyarları'), body: tr('preemie_n4_b', 'Adətən körpə evə hazırdır: öz temperaturunu saxlaya bildikdə, zondsuz (döş və ya butulka ilə) qidalana bildikdə, sabit çəki artımı olduqda və tənəffüs pauzaları (apnoe) keçdikdə. Bu adətən orijinal doğum tarixinə (EDD-yə) yaxın vaxta düşür.') },
    { id: 'n5', emoji: '💛', title: tr('preemie_n5_t', 'Özünüzə də qulluq edin'), body: tr('preemie_n5_b', 'NICU səyahəti marafondur, sprint deyil. Yemək yeyin, yatın, növbələşin. Ağlamaq normaldır. Anacan-ın Mental Sağlamlıq alətindən istifadə edin və Community-dəki digər preemie valideynləri ilə əlaqə saxlayın — bu yolu keçən tək siz deyilsiniz.') }]
  },
  {
    id: 'kangaroo',
    icon: HeartHandshake,
    iconBg: 'var(--a-pink-1)',
    title: tr('preemie_sec_kangaroo', 'Kenquru qayğısı (dəri-dəriyə)'),
    intro: tr('preemie_sec_kangaroo_intro', 'Dəri-dəriyə təmas preemie körpələr üçün elmi sübutlu ən güclü "müalicələrdən" biridir.'),
    items: [
    { id: 'k1', emoji: '🔬', title: tr('preemie_k1_t', 'Faydaları (elmi sübutlu)'), body: tr('preemie_k1_b', 'Körpənin istiliyini, ürək ritmini və tənəffüsünü sabitləşdirir, çəki artımını sürətləndirir, yuxusunu dərinləşdirir, ananın süd ifrazını artırır və valideyn-körpə bağlılığını gücləndirir. ÜST (WHO) kenquru qayğısını bütün preemie körpələr üçün tövsiyə edir.') },
    { id: 'k2', emoji: '📋', title: tr('preemie_k2_t', 'Necə edilir?'), body: tr('preemie_k2_b', 'Körpə yalnız bezlə sinənizə şaquli qoyulur, başı yana çevrilir (tənəffüs yolu açıq), üstündən yumşaq örtüklə örtülür. Rahat oturun və dincəlin. NICU-dadırsınızsa, vaxtı və qaydanı tibb heyəti ilə razılaşdırın.') },
    { id: 'k3', emoji: '⏱️', title: tr('preemie_k3_t', 'Nə qədər?'), body: tr('preemie_k3_b', 'Mümkün qədər çox — hər seans ideal olaraq ən azı 60 dəqiqə (qısa seanslar körpəni yormaya bilər, amma köçürmə prosesi stress yaradır). Gündəlik rutinə çevirin.') },
    { id: 'k4', emoji: '👨', title: tr('preemie_k4_t', 'Ata da edə bilər'), body: tr('preemie_k4_b', 'Kenquru qayğısı yalnız ana üçün deyil — ata ilə dəri-dəriyə təmas eyni dərəcədə faydalıdır və ataya körpə ilə erkən bağlılıq qurmağa kömək edir. Növbələşin.') }]
  },
  {
    id: 'feeding',
    icon: Milk,
    iconBg: 'var(--a-yellow-1)',
    title: tr('preemie_sec_feeding', 'Qidalanma və əmizdirmə'),
    intro: tr('preemie_sec_feeding_intro', 'Ana südü preemie körpə üçün qida yox, dərmandır — infeksiyalardan qoruyur və bağırsağı yetişdirir.'),
    items: [
    { id: 'f1', emoji: '🍼', title: tr('preemie_f1_t', 'İlk günlər: sağma rejimi'), body: tr('preemie_f1_b', 'Körpə hələ əmə bilmirsə belə, doğuşdan sonra ilk 6 saat ərzində sağmağa başlayın və gündə 8-10 dəfə (gecə daxil) davam edin — bu, süd ifrazını qoruyur. İlk damla kolostrum belə qiymətlidir; NICU-ya çatdırın.') },
    { id: 'f2', emoji: '🔄', title: tr('preemie_f2_t', 'Zonddan döşə keçid mərhələlidir'), body: tr('preemie_f2_b', 'Əmmə-udma-nəfəs koordinasiyası adətən 32-34 həftəlikdə formalaşır. Keçid tədricən olur: əvvəl zondla qidalanma zamanı döşə "tanışlıq" (qeyri-qidalandırıcı əmmə), sonra qısa əmizdirmələr, sonra tam keçid. Səbirli olun — bu bacarıq məşq tələb edir.') },
    { id: 'f3', emoji: '💪', title: tr('preemie_f3_t', 'Gücləndirici (fortifier) nədir?'), body: tr('preemie_f3_b', 'Bəzi preemie körpələrə ana südünə əlavə kalori, zülal və mineral verən gücləndirici təyin olunur — bu, ana südünün "kifayət etməməsi" demək deyil, sadəcə preemie körpənin tələbatı daha yüksəkdir. Yalnız həkim təyini ilə istifadə olunur.') },
    { id: 'f4', emoji: '⚖️', title: tr('preemie_f4_t', 'Çəki izləməsi'), body: tr('preemie_f4_b', 'Çəki artımı preemie körpənin ən vacib göstəricilərindən biridir. Anacan-ın Böyümə İzləyicisində ölçüləri qeyd edin — qrafik avtomatik korreksiya olunmuş yaşla qurulur, yəni körpəniz yaşıdları ilə düzgün müqayisə olunur.') }]
  },
  {
    id: 'infection',
    icon: ShieldCheck,
    iconBg: 'var(--a-green-1)',
    title: tr('preemie_sec_infection', 'İnfeksiyadan qorunma (RSV daxil)'),
    intro: tr('preemie_sec_infection_intro', 'Preemie körpənin immun sistemi hələ yetişməyib — ilk aylar sadə qaydalar böyük fərq yaradır.'),
    items: [
    { id: 'i1', emoji: '🧼', title: tr('preemie_i1_t', 'Qızıl qayda: əl yumaq'), body: tr('preemie_i1_b', 'Körpəyə toxunmazdan əvvəl hər kəs əlini sabunla yumalı və ya dezinfeksiya etməlidir — istisnasız. Bu, ən sadə və ən effektiv qorunmadır.') },
    { id: 'i2', emoji: '🚷', title: tr('preemie_i2_t', 'Ziyarətçi qaydaları'), body: tr('preemie_i2_b', 'Soyuqdəymə, öskürək və ya qızdırması olan heç kəs körpəyə yaxınlaşmamalıdır. Körpənin üzündən və əllərindən öpməyə icazə verməyin. İlk aylarda ziyarətçi sayını minimum saxlayın.') },
    { id: 'i3', emoji: '🚭', title: tr('preemie_i3_t', 'Siqaret dumanı — qəti qadağa'), body: tr('preemie_i3_b', 'Siqaret dumanı (paltar üzərindəki qalıq daxil) preemie körpədə tənəffüs problemləri və ani körpə ölümü sindromu (SIDS) riskini kəskin artırır. Evdə və körpənin yanında siqaretə tam qadağa qoyun.') },
    { id: 'i4', emoji: '🦠', title: tr('preemie_i4_t', 'RSV mövsümündə (payız-qış) diqqət'), body: tr('preemie_i4_b', 'RSV (respirator sinsitial virus) preemie körpələr üçün ən təhlükəli mövsümi virusdur. Payız-qış aylarında izdihamlı qapalı yerlərdən (ticarət mərkəzi, toy) uzaq durun. Körpənizin RSV-dən qorunma immunizasiyasına uyğun olub-olmadığını pediatrınızla müzakirə edin.') },
    { id: 'i5', emoji: '💉', title: tr('preemie_i5_t', 'Peyvəndləri gecikdirməyin'), body: tr('preemie_i5_b', 'Preemie körpələr peyvəndləri real (xronoloji) yaşa görə, adi təqvimlə alır — korreksiya olunmuş yaş gözlənilmir. Ailə üzvlərinin qrip və göyöskürək peyvəndləri də körpəni dolayı qoruyur ("kokon strategiyası").') }]
  },
  {
    id: 'danger',
    icon: Baby,
    iconBg: 'var(--a-alert-bg)',
    title: tr('preemie_sec_danger', 'Nə vaxt dərhal həkimə?'),
    intro: tr('preemie_sec_danger_intro', 'Preemie körpələrdə vəziyyət sürətlə dəyişə bilər — bu əlamətlərdə gözləməyin, dərhal tibbi yardım alın.'),
    items: [
    { id: 'd1', emoji: '😮‍💨', title: tr('preemie_d1_t', 'Tənəffüs problemləri'), body: tr('preemie_d1_b', '15-20 saniyədən uzun nəfəs pauzaları (apnoe), inilti ilə nəfəs, burun pərlərinin gərilməsi, qabırğaarası batıqlar, dodaqların/üzün göyərməsi — dərhal təcili yardım çağırın.') },
    { id: 'd2', emoji: '🌡️', title: tr('preemie_d2_t', 'Temperatur'), body: tr('preemie_d2_b', 'Qoltuqaltı temperatur 36.4°C-dən aşağı və ya 38°C-dən yuxarıdırsa — preemie körpədə hər ikisi ciddi qəbul edilməli və dərhal həkimə bildirilməlidir. Qızdırmanı evdə "salmağa" çalışıb gözləməyin.') },
    { id: 'd3', emoji: '🍼', title: tr('preemie_d3_t', 'Qidalanma və aktivlik'), body: tr('preemie_d3_b', 'Ardıcıl 2-3 qidalanmadan imtina, adətkərdə olmayan süstlük/oyanmama, davamlı qusma (xüsusən yaşıl rəngli) — təcili qiymətləndirmə tələb edir.') },
    { id: 'd4', emoji: '💧', title: tr('preemie_d4_t', 'Susuzlaşma əlamətləri'), body: tr('preemie_d4_b', '24 saatda 4-dən az islanmış bez, batıq əmgək, ağlayanda göz yaşının olmaması — susuzlaşma əlamətləridir. Anacan-dakı "Təhlükə Əlamətləri" alətində tam siyahı var.') }]
  }];


  return (
    <ToolPage>
      <ToolHeader
        title={tr('preemie_hub_title', 'Preemie Bələdçisi')}
        eyebrow={tr('preemie_hub_eyebrow', 'Vaxtından əvvəl doğulanlar')}
        onBack={onBack} />

      <div className="space-y-3.5">
        {/* Personallaşdırılmış status kartı */}
        {isPremature && childAge ?
        <div className="a-card a-fade-in" style={{ padding: 14, background: 'var(--a-peach-1)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-accent-ink)' }}>
              {selectedChild!.name}
              {childAge.gestationalWeeksAtBirth !== null &&
            <> · {childAge.gestationalWeeksAtBirth}{childAge.gestationalExtraDays ? `+${childAge.gestationalExtraDays}` : ''} {tr('preemie_weeks_born', 'həftəlik doğulub')}</>
            }
            </p>
            <p style={{ fontSize: 12, color: 'var(--a-accent-ink)', marginTop: 4, opacity: 0.9 }}>
              {tr('preemie_hub_status_corrected', 'Korreksiya olunmuş yaş')}: <strong>{childAge.correctedDisplayText}</strong>
              {' '}· {tr('preemie_hub_status_chrono', 'Real yaş')}: {childAge.displayText}
            </p>
            {childAge.correctionApplied &&
          <p style={{ fontSize: 11, color: 'var(--a-accent-ink)', marginTop: 4, opacity: 0.75 }}>
                {tr('preemie_hub_status_note', 'Böyümə qrafiki, inkişaf məzmunu və oyun tövsiyələri avtomatik korreksiya olunmuş yaşla işləyir.')}
              </p>
          }
          </div> :

        <div className="a-card a-fade-in" style={{ padding: 14 }}>
            <p style={{ fontSize: 12.5, color: 'var(--a-body-text)', lineHeight: 1.55 }}>
              {tr('preemie_hub_generic_intro', 'Dünyada hər 10 körpədən ~1-i vaxtından əvvəl (37 həftədən tez) doğulur. Bu bələdçi NICU günlərindən evdəki ilk aylara qədər yol göstərir.')}
            </p>
          </div>
        }

        {/* Bölmələr */}
        {sections.map((section) => {
          const SIcon = section.icon;
          return (
            <div key={section.id}>
              <div className="flex items-center gap-2.5" style={{ margin: '18px 2px 10px' }}>
                <span className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: section.iconBg }}>
                  <SIcon size={17} strokeWidth={2.2} style={{ color: 'var(--a-ink)' }} />
                </span>
                <div>
                  <h3 className="a-section-title a-heading" style={{ margin: 0 }}>{section.title}</h3>
                  {section.intro &&
                  <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 2, lineHeight: 1.45 }}>{section.intro}</p>
                  }
                </div>
              </div>

              <div className="space-y-2.5">
                {section.items.map((item) => {
                  const isOpen = openId === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      className="overflow-hidden"
                      style={{
                        background: 'var(--a-surface)',
                        borderRadius: 18,
                        boxShadow: 'var(--a-card-shadow)',
                        border: isOpen ? '1.5px solid var(--a-peach-2)' : '1.5px solid transparent'
                      }}>

                      <button onClick={() => toggle(item.id)} className="w-full flex items-center gap-3 text-start" style={{ padding: 14 }}>
                        <div className="w-11 h-11 flex items-center justify-center text-2xl shrink-0" style={{ borderRadius: 14, background: 'var(--a-surface-soft)' }}>
                          {item.emoji}
                        </div>
                        <p className="flex-1 min-w-0" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>
                          {item.title}
                        </p>
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
                          <ChevronDown size={16} style={{ color: 'var(--a-ink-faint)' }} />
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen &&
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}>
                            <div style={{ padding: '0 14px 14px' }}>
                              <p className="leading-relaxed" style={{ fontSize: 12.5, color: 'var(--a-body-text)' }}>
                                {item.body}
                              </p>
                            </div>
                          </motion.div>
                        }
                      </AnimatePresence>
                    </motion.div>);

                })}
              </div>
            </div>);

        })}

        {/* Disclaimer */}
        <div className="a-card" style={{ padding: 12, background: 'var(--a-surface-soft)', marginTop: 16 }}>
          <p style={{ fontSize: 10.5, color: 'var(--a-ink-soft)', lineHeight: 1.5 }}>
            ⚕️ {tr('preemie_hub_disclaimer', 'Bu məlumatlar maarifləndirici xarakter daşıyır və həkim müayinəsini/məsləhətini əvəz etmir. Körpənizlə bağlı bütün qərarları pediatrınızla birlikdə verin.')}
          </p>
        </div>
      </div>
    </ToolPage>);

};

export default PreemieHubScreen;
