// Ported from: src/components/tools/PreemieHubScreen.tsx
//
// Guide for babies born before 37 weeks: corrected age, NICU, kangaroo care, feeding, infection protection and
// danger signs (one open accordion item at a time), with a personal status card for a premature selected child.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_children.dart';
import '../kit/kit.dart';

class _Item {
  const _Item(this.id, this.emoji, this.title, this.body);
  final String id;
  final String emoji;
  final String title;
  final String body;
}

class _Section {
  const _Section(this.id, this.icon, this.iconBg, this.title, this.intro, this.items);
  final String id;
  final AIconData icon;
  final BoxDecoration Function(ATokens a) iconBg;
  final String title;
  final String? intro;
  final List<_Item> items;
}

List<_Section> _sections() => [
      _Section('corrected', AIcons.calendarClock, (a) => BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_corrected', 'Korreksiya olunmuş yaş nədir?'),
          tr('preemie_sec_corrected_intro', 'Vaxtından əvvəl doğulan körpənin inkişafı gözlənilən doğum tarixindən (EDD) hesablanan yaşla qiymətləndirilir.'), [
        _Item('c1', '🧮', tr('preemie_c1_t', 'Necə hesablanır?'),
            tr('preemie_c1_b', 'Korreksiya olunmuş yaş = real (xronoloji) yaş − erkənlik müddəti. Məsələn, körpə 2 ay əvvəl doğulubsa və indi 5 aylıqdırsa, korreksiya olunmuş yaşı 3 aydır. Praktikada bu, gözlənilən doğum tarixindən (EDD) bu günə qədər keçən müddətə bərabərdir.')),
        _Item('c2', '📈', tr('preemie_c2_t', 'Harada istifadə olunur?'),
            tr('preemie_c2_b', 'İnkişaf mərhələləri (dönmə, oturma, yerimə), böyümə əyriləri (çəki/boy percentilləri), oyun və məşğuliyyət seçimi — hamısı korreksiya olunmuş yaşla qiymətləndirilməlidir. Anacan bunu avtomatik tətbiq edir: böyümə qrafiki, günlük inkişaf məzmunu və oyun tövsiyələri artıq korreksiya olunmuş yaşla işləyir.')),
        _Item('c3', '💉', tr('preemie_c3_t', 'Harada istifadə OLUNMUR?'),
            tr('preemie_c3_b', 'Peyvəndlər korreksiya olunmuş yaşa görə DEYİL, real doğum tarixinə görə vurulur (beynəlxalq standart — WHO/AAP). Peyvənd təqvimini gecikdirməyin: vaxtından əvvəl doğulan körpələr infeksiyalara daha həssasdır və qorunmaya daha tez ehtiyac duyur.')),
        _Item('c4', '⏳', tr('preemie_c4_t', 'Nə vaxta qədər?'),
            tr('preemie_c4_b', 'Adətən 24 ay (2 yaş) korreksiya olunmuş yaşa qədər. Bu yaşdan sonra əksər körpələr yaşıdlarına çatır və korreksiyaya ehtiyac qalmır. Bəzi hallarda (çox erkən doğulanlar üçün) həkim 3 yaşa qədər davam etməyi məsləhət görə bilər.')),
      ]),
      _Section('nicu', AIcons.stethoscope, (a) => BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_nicu', 'NICU (intensiv qayğı) bələdçisi'),
          tr('preemie_sec_nicu_intro', 'Yenidoğulmuşların intensiv qayğı şöbəsi qorxuducu görünə bilər — amma orada nə baş verdiyini bilmək narahatlığı azaldır.'), [
        _Item('n1', '🖥️', tr('preemie_n1_t', 'Avadanlıq sizi qorxutmasın'),
            tr('preemie_n1_b', 'Monitorlar ürək ritmi, tənəffüs və oksigeni izləyir; qidalanma zondu körpə əmməyi öyrənənə qədər süd verir; CPAP tənəffüsə dəstəkdir; inkubator istiliyi qoruyur. Siqnal səsləri çox vaxt kiçik dəyişikliklərdir — hər siqnal təhlükə demək deyil.')),
        _Item('n2', '🤱', tr('preemie_n2_t', 'Valideyn kimi rolunuz böyükdür'),
            tr('preemie_n2_b', 'Səsiniz, toxunuşunuz və ana südü — heç bir avadanlığın verə bilmədiyi şeylərdir. Körpənizlə danışın, mahnı oxuyun, mümkün olanda dəri-dəriyə təmas edin. Tibb heyətindən körpənin qayğısında iştirak etməyi istəyin (bez dəyişmə, temperatur ölçmə).')),
        _Item('n3', '❓', tr('preemie_n3_t', 'Sual verməkdən çəkinməyin'),
            tr('preemie_n3_b', 'Hər gün soruşa biləcəkləriniz: bu gün çəkisi nə qədərdir? Qidalanma necə gedir? Bu günün planı nədir? Evə yazılmaq üçün hansı mərhələlər qalıb? Suallarınızı telefonda qeyd edin — görüşdə unutmayasınız.')),
        _Item('n4', '🏠', tr('preemie_n4_t', 'Evə yazılma meyarları'),
            tr('preemie_n4_b', 'Adətən körpə evə hazırdır: öz temperaturunu saxlaya bildikdə, zondsuz (sinə və ya butulka ilə) qidalana bildikdə, sabit çəki artımı olduqda və tənəffüs pauzaları (apnoe) keçdikdə. Bu adətən orijinal doğum tarixinə (EDD-yə) yaxın vaxta düşür.')),
        _Item('n5', '💛', tr('preemie_n5_t', 'Özünüzə də qulluq edin'),
            tr('preemie_n5_b', 'NICU səyahəti marafondur, sprint deyil. Yemək yeyin, yatın, növbələşin. Ağlamaq normaldır. Anacan-ın Mental Sağlamlıq alətindən istifadə edin və Community-dəki digər preemie valideynləri ilə əlaqə saxlayın — bu yolu keçən tək siz deyilsiniz.')),
      ]),
      _Section('kangaroo', AIcons.heartHandshake, (a) => BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_kangaroo', 'Kenquru qayğısı (dəri-dəriyə)'),
          tr('preemie_sec_kangaroo_intro', 'Dəri-dəriyə təmas preemie körpələr üçün elmi sübutlu ən güclü "müalicələrdən" biridir.'), [
        _Item('k1', '🔬', tr('preemie_k1_t', 'Faydaları (elmi sübutlu)'),
            tr('preemie_k1_b', 'Körpənin istiliyini, ürək ritmini və tənəffüsünü sabitləşdirir, çəki artımını sürətləndirir, yuxusunu dərinləşdirir, ananın süd ifrazını artırır və valideyn-körpə bağlılığını gücləndirir. ÜST (WHO) kenquru qayğısını bütün preemie körpələr üçün tövsiyə edir.')),
        _Item('k2', '📋', tr('preemie_k2_t', 'Necə edilir?'),
            tr('preemie_k2_b', 'Körpə yalnız bezlə sinənizə şaquli qoyulur, başı yana çevrilir (tənəffüs yolu açıq), üstündən yumşaq örtüklə örtülür. Rahat oturun və dincəlin. NICU-dadırsınızsa, vaxtı və qaydanı tibb heyəti ilə razılaşdırın.')),
        _Item('k3', '⏱️', tr('preemie_k3_t', 'Nə qədər?'),
            tr('preemie_k3_b', 'Mümkün qədər çox — hər seans ideal olaraq ən azı 60 dəqiqə (qısa seanslar körpəni yormaya bilər, amma köçürmə prosesi stress yaradır). Gündəlik rutinə çevirin.')),
        _Item('k4', '👨', tr('preemie_k4_t', 'Ata da edə bilər'),
            tr('preemie_k4_b', 'Kenquru qayğısı yalnız ana üçün deyil — ata ilə dəri-dəriyə təmas eyni dərəcədə faydalıdır və ataya körpə ilə erkən bağlılıq qurmağa kömək edir. Növbələşin.')),
      ]),
      _Section('feeding', AIcons.milk, (a) => BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_feeding', 'Qidalanma və əmizdirmə'),
          tr('preemie_sec_feeding_intro', 'Ana südü preemie körpə üçün qida yox, dərmandır — infeksiyalardan qoruyur və bağırsağı yetişdirir.'), [
        _Item('f1', '🍼', tr('preemie_f1_t', 'İlk günlər: sağma rejimi'),
            tr('preemie_f1_b', 'Körpə hələ əmə bilmirsə belə, doğuşdan sonra ilk 6 saat ərzində sağmağa başlayın və gündə 8-10 dəfə (gecə daxil) davam edin — bu, süd ifrazını qoruyur. İlk damla kolostrum belə qiymətlidir; NICU-ya çatdırın.')),
        _Item('f2', '🔄', tr('preemie_f2_t', 'Zonddan sinəyə keçid mərhələlidir'),
            tr('preemie_f2_b', 'Əmmə-udma-nəfəs koordinasiyası adətən 32-34 həftəlikdə formalaşır. Keçid tədricən olur: əvvəl zondla qidalanma zamanı sinəyə "tanışlıq" (qeyri-qidalandırıcı əmmə), sonra qısa əmizdirmələr, sonra tam keçid. Səbirli olun — bu bacarıq məşq tələb edir.')),
        _Item('f3', '💪', tr('preemie_f3_t', 'Gücləndirici (fortifier) nədir?'),
            tr('preemie_f3_b', 'Bəzi preemie körpələrə ana südünə əlavə kalori, zülal və mineral verən gücləndirici təyin olunur — bu, ana südünün "kifayət etməməsi" demək deyil, sadəcə preemie körpənin tələbatı daha yüksəkdir. Yalnız həkim təyini ilə istifadə olunur.')),
        _Item('f4', '⚖️', tr('preemie_f4_t', 'Çəki izləməsi'),
            tr('preemie_f4_b', 'Çəki artımı preemie körpənin ən vacib göstəricilərindən biridir. Anacan-ın Böyümə İzləyicisində ölçüləri qeyd edin — qrafik avtomatik korreksiya olunmuş yaşla qurulur, yəni körpəniz yaşıdları ilə düzgün müqayisə olunur.')),
      ]),
      _Section('infection', AIcons.shieldCheck, (a) => BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_infection', 'İnfeksiyadan qorunma (RSV daxil)'),
          tr('preemie_sec_infection_intro', 'Preemie körpənin immun sistemi hələ yetişməyib — ilk aylar sadə qaydalar böyük fərq yaradır.'), [
        _Item('i1', '🧼', tr('preemie_i1_t', 'Qızıl qayda: əl yumaq'),
            tr('preemie_i1_b', 'Körpəyə toxunmazdan əvvəl hər kəs əlini sabunla yumalı və ya dezinfeksiya etməlidir — istisnasız. Bu, ən sadə və ən effektiv qorunmadır.')),
        _Item('i2', '🚷', tr('preemie_i2_t', 'Ziyarətçi qaydaları'),
            tr('preemie_i2_b', 'Soyuqdəymə, öskürək və ya qızdırması olan heç kəs körpəyə yaxınlaşmamalıdır. Körpənin üzündən və əllərindən öpməyə icazə verməyin. İlk aylarda ziyarətçi sayını minimum saxlayın.')),
        _Item('i3', '🚭', tr('preemie_i3_t', 'Siqaret dumanı — qəti qadağa'),
            tr('preemie_i3_b', 'Siqaret dumanı (paltar üzərindəki qalıq daxil) preemie körpədə tənəffüs problemləri və ani körpə ölümü sindromu (SIDS) riskini kəskin artırır. Evdə və körpənin yanında siqaretə tam qadağa qoyun.')),
        _Item('i4', '🦠', tr('preemie_i4_t', 'RSV mövsümündə (payız-qış) diqqət'),
            tr('preemie_i4_b', 'RSV (respirator sinsitial virus) preemie körpələr üçün ən təhlükəli mövsümi virusdur. Payız-qış aylarında izdihamlı qapalı yerlərdən (ticarət mərkəzi, toy) uzaq durun. Körpənizin RSV-dən qorunma immunizasiyasına uyğun olub-olmadığını pediatrınızla müzakirə edin.')),
        _Item('i5', '💉', tr('preemie_i5_t', 'Peyvəndləri gecikdirməyin'),
            tr('preemie_i5_b', 'Preemie körpələr peyvəndləri real (xronoloji) yaşa görə, adi təqvimlə alır — korreksiya olunmuş yaş gözlənilmir. Ailə üzvlərinin qrip və göyöskürək peyvəndləri də körpəni dolayı qoruyur ("kokon strategiyası").')),
      ]),
      _Section('danger', AIcons.baby, (a) => BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(12)), tr('preemie_sec_danger', 'Nə vaxt dərhal həkimə?'),
          tr('preemie_sec_danger_intro', 'Preemie körpələrdə vəziyyət sürətlə dəyişə bilər — bu əlamətlərdə gözləməyin, dərhal tibbi yardım alın.'), [
        _Item('d1', '😮‍💨', tr('preemie_d1_t', 'Tənəffüs problemləri'),
            tr('preemie_d1_b', '15-20 saniyədən uzun nəfəs pauzaları (apnoe), inilti ilə nəfəs, burun pərlərinin gərilməsi, qabırğaarası batıqlar, dodaqların/üzün göyərməsi — dərhal təcili yardım çağırın.')),
        _Item('d2', '🌡️', tr('preemie_d2_t', 'Temperatur'),
            tr('preemie_d2_b', 'Qoltuqaltı temperatur 36.4°C-dən aşağı və ya 38°C-dən yuxarıdırsa — preemie körpədə hər ikisi ciddi qəbul edilməli və dərhal həkimə bildirilməlidir. Qızdırmanı evdə "salmağa" çalışıb gözləməyin.')),
        _Item('d3', '🍼', tr('preemie_d3_t', 'Qidalanma və aktivlik'),
            tr('preemie_d3_b', 'Ardıcıl 2-3 qidalanmadan imtina, adətkərdə olmayan süstlük/oyanmama, davamlı qusma (xüsusən yaşıl rəngli) — təcili qiymətləndirmə tələb edir.')),
        _Item('d4', '💧', tr('preemie_d4_t', 'Susuzlaşma əlamətləri'),
            tr('preemie_d4_b', '24 saatda 4-dən az islanmış bez, batıq əmgək, ağlayanda göz yaşının olmaması — susuzlaşma əlamətləridir. Anacan-dakı "Təhlükə Əlamətləri" alətində tam siyahı var.')),
      ]),
    ];

class PreemieHubScreen extends ConsumerStatefulWidget {
  const PreemieHubScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<PreemieHubScreen> createState() => _PreemieHubScreenState();
}

class _PreemieHubScreenState extends ConsumerState<PreemieHubScreen> {
  String? _openId;

  Future<void> _toggle(String id) async {
    await ref.read(babyCareServicesProvider).hapticLight();
    if (mounted) setState(() => _openId = _openId == id ? null : id);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final selected = ref.watch(childrenProvider).selectedChild;
    final age = selected == null ? null : getChildAge(selected);
    final isPremature = age?.isPremature ?? false;
    final a = context.a;
    final x = context.aText;
    final sections = _sections();

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(title: tr('preemie_hub_title', 'Preemie Bələdçisi'), eyebrow: tr('preemie_hub_eyebrow', 'Vaxtından əvvəl doğulanlar'), onBack: widget.onBack),
        if (isPremature && age != null)
          ACard(
            key: const ValueKey('preemie-status'),
            padding: const EdgeInsets.all(14),
            color: a.peach1,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                '${selected!.name}'
                '${age.gestationalWeeksAtBirth != null ? ' · ${age.gestationalWeeksAtBirth}${(age.gestationalExtraDays ?? 0) != 0 ? '+${age.gestationalExtraDays}' : ''} ${tr('preemie_weeks_born', 'həftəlik doğulub')}' : ''}',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: a.accentInk, height: 1.5),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Opacity(
                  opacity: 0.9,
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '${tr('preemie_hub_status_corrected', 'Korreksiya olunmuş yaş')}: '),
                      TextSpan(text: age.correctedDisplayText, style: const TextStyle(fontWeight: FontWeight.w700)),
                      TextSpan(text: ' · ${tr('preemie_hub_status_chrono', 'Real yaş')}: ${age.displayText}'),
                    ]),
                    style: TextStyle(fontSize: 12, color: a.accentInk, height: 1.5),
                  ),
                ),
              ),
              if (age.correctionApplied)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Opacity(
                    opacity: 0.75,
                    child: Text(tr('preemie_hub_status_note', 'Böyümə qrafiki, inkişaf məzmunu və oyun tövsiyələri avtomatik korreksiya olunmuş yaşla işləyir.'),
                        style: TextStyle(fontSize: 11, color: a.accentInk, height: 1.5)),
                  ),
                ),
            ]),
          )
        else
          ACard(
            padding: const EdgeInsets.all(14),
            child: Text(
              tr('preemie_hub_generic_intro', 'Dünyada hər 10 körpədən ~1-i vaxtından əvvəl (37 həftədən tez) doğulur. Bu bələdçi NICU günlərindən evdəki ilk aylara qədər yol göstərir.'),
              style: TextStyle(fontSize: 12.5, color: a.bodyText, height: 1.55),
            ),
          ),
        // `space-y-3.5` (14px) collapses with the header's 18px top margin: 18px between blocks.
        for (final section in sections) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 18, 2, 10),
            child: Row(children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: section.iconBg(a),
                child: AIcon(section.icon, size: 17, strokeWidth: 2.2, color: a.ink),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(section.title, style: x.aSectionTitle),
                  if (section.intro != null)
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(section.intro!, style: TextStyle(fontSize: 11.5, color: a.inkSoft, height: 1.45))),
                ]),
              ),
            ]),
          ),
          for (var i = 0; i < section.items.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            _Accordion(item: section.items[i], open: _openId == section.items[i].id, onToggle: () => unawaited(_toggle(section.items[i].id))),
          ],
        ],
        SafetyStrip(signs: tr('safety_preemie_signs', 'Zəng edin: nəfəs çətinliyi, rəng dəyişməsi (göy/solğun), pis əmmə, hərarət və ya soyuqluq')),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: ACard(
            padding: const EdgeInsets.all(12),
            color: a.surfaceSoft,
            child: Text(
              '⚕️ ${tr('preemie_hub_disclaimer', 'Bu məlumatlar maarifləndirici xarakter daşıyır və həkim müayinəsini/məsləhətini əvəz etmir. Körpənizlə bağlı bütün qərarları pediatrınızla birlikdə verin.')}',
              style: TextStyle(fontSize: 10.5, color: a.inkSoft, height: 1.5),
            ),
          ),
        ),
      ]),
    );
  }
}

class _Accordion extends StatelessWidget {
  const _Accordion({required this.item, required this.open, required this.onToggle});
  final _Item item;
  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final reduce = animationsDisabled(context);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: a.cardShadow,
        border: Border.all(color: open ? a.peach2 : const Color(0x00000000), width: 1.5),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Semantics(
          button: true,
          expanded: open,
          child: GestureDetector(
            key: ValueKey('preemie-item-${item.id}'),
            behavior: HitTestBehavior.opaque,
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                  child: Text(item.emoji, style: const TextStyle(fontSize: 24, height: 1.33)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(item.title, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: a.ink, height: 1.5))),
                const SizedBox(width: 12),
                AnimatedRotation(
                  turns: open ? 0.5 : 0,
                  duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                  child: AIcon(AIcons.chevronDown, size: 16, color: a.inkFaint),
                ),
              ]),
            ),
          ),
        ),
        () {
          final body = open
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  child: Text(item.body, style: TextStyle(fontSize: 12.5, color: a.bodyText, height: 1.625)),
                )
              : const SizedBox(width: double.infinity);
          return reduce ? body : AnimatedSize(duration: const Duration(milliseconds: 220), alignment: Alignment.topCenter, child: body);
        }(),
      ]),
    );
  }
}
