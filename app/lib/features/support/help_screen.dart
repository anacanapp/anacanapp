// Ported from: src/components/HelpScreen.tsx, src/components/ui/accordion.tsx (FAQ), anacan-design.css
//              (.a-chat-bubble, .a-chat-send, .a-tabs/.a-tab)
//
// Help centre: FAQ accordion, contact cards (mailto / tel), support tickets (create, list, chat with realtime
// admin replies).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/data/data.dart' show RowFields;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart';
import 'data/support_tickets.dart';

/// Opens `mailto:` / `tel:` links (overridable in tests).
final externalLinkOpenerProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    });

String _fmt(String? iso, String pattern) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  try {
    return formatDatePattern(d.toLocal(), pattern);
  } catch (_) {
    return formatDatePattern(d.toLocal(), pattern, language: 'en');
  }
}

class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  String _tab = 'faq';
  bool _showNew = false;
  Map<String, dynamic>? _selected;
  String _category = 'general';
  final TextEditingController _subject = TextEditingController();
  final TextEditingController _message = TextEditingController();
  bool _submitting = false;
  int? _openFaq;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  (AIconData, Color) _statusIcon(String status) {
    final a = context.a;
    return switch (status) {
      'in_progress' => (AIcons.clock, a.blueInk),
      'resolved' => (AIcons.circleCheck, a.greenInk),
      'closed' => (AIcons.circleCheck, a.inkFaint),
      _ => (AIcons.circleAlert, a.yellowInk),
    };
  }

  String _statusText(String status) => switch (status) {
        'in_progress' => tr('helpscreen_i_slenir_65a15d', 'İşlənir'),
        'resolved' => tr('helpscreen_hell_edildi_beceb9', 'Həll edildi'),
        'closed' => tr('helpscreen_bagli_713069', 'Bağlı'),
        _ => tr('helpscreen_aciq_306cc4', 'Açıq'),
      };

  Future<void> _submit() async {
    final toast = toasts(context);
    if (_subject.text.trim().isEmpty || _message.text.trim().isEmpty) {
      toast.show(title: tr('helpscreen_xeta_3cdbb6', 'Xəta'), description: tr('helpscreen_movzu_ve_mesaj_daxil_edin_b27c43', 'Mövzu və mesaj daxil edin'), destructive: true);
      return;
    }
    setState(() => _submitting = true);
    final error = await ref.read(supportActionsProvider).createTicket(subject: _subject.text, message: _message.text, category: _category);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error != null) {
      toast.show(title: tr('helpscreen_xeta_3cdbb6', 'Xəta'), description: tr('helpscreen_muraciet_gonderile_bilmedi_2fc6c2', 'Müraciət göndərilə bilmədi'), destructive: true);
    } else {
      toast.show(title: tr('helpscreen_ugurlu_5c0191', 'Uğurlu!'), description: tr('helpscreen_muracietiniz_gonderildi_2337db', 'Müraciətiniz göndərildi'));
      _subject.clear();
      _message.clear();
      setState(() {
        _category = 'general';
        _showNew = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_selected != null) {
      return _TicketChat(
        ticket: _selected!,
        statusIcon: _statusIcon,
        statusText: _statusText,
        onBack: () {
          setState(() => _selected = null);
          unawaited(ref.read(supportActionsProvider).refetchTickets());
        },
      );
    }
    final a = context.a;
    final tabs = [('faq', 'SSS'), ('contact', tr('helpscreen_elaqe_07e6a8', 'Əlaqə')), ('tickets', tr('helpscreen_muracietler_215f40', 'Müraciətlər'))];
    Widget body = switch (_tab) {
      'contact' => _contact(context),
      'tickets' => _tickets(context),
      _ => _faq(context),
    };
    body = FadeRise(key: ValueKey<String>(_tab), dy: 0, dx: -20, child: body);
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ATopbar(onBack: widget.onBack, eyebrow: tr('helpscreen_suallariniza_cavab_tapin_764218', 'Suallarınıza cavab tapın'), title: tr('helpscreen_yardim_merkezi_0987ed', 'Yardım Mərkəzi')),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                    for (var i = 0; i < tabs.length; i++) ...<Widget>[
                      if (i > 0) const SizedBox(width: 2),
                      GestureDetector(
                        key: ValueKey<String>('help-tab-${tabs[i].$1}'),
                        onTap: () => setState(() => _tab = tabs[i].$1),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                          decoration: BoxDecoration(color: _tab == tabs[i].$1 ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                          child: Text(tabs[i].$2, style: px(11.5, weight: FontWeight.w700, color: _tab == tabs[i].$1 ? a.accentInk : a.inkSoft)),
                        ),
                      ),
                    ],
                  ]),
                ),
              ),
            ),
            body,
            Padding(
              padding: const EdgeInsets.only(top: 16 + 14),
              child: Text(tr('helpscreen_2025_anacan_butun_huquqlar_qorunur_c35c11', '© 2025 Anacan. Bütün hüquqlar qorunur.'), textAlign: TextAlign.center, style: px(11, color: a.inkFaint)),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _cardTitle(String text, {AIconData? icon, double bottom = 12}) {
    final a = context.a;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Row(children: <Widget>[
        if (icon != null) ...<Widget>[AIcon(icon, size: 16, color: a.accentInk), const SizedBox(width: 8)],
        Expanded(child: Text(text, style: context.aText.aCardTitle)),
      ]),
    );
  }

  Widget _faq(BuildContext context) {
    final a = context.a;
    final q = ref.watch(faqsQuery);
    final faqs = q.data ?? const <Map<String, dynamic>>[];
    return ACard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        _cardTitle(tr('helpscreen_tez_tez_sorusulan_suallar_cf692e', 'Tez-tez Soruşulan Suallar'), icon: AIcons.circleHelp),
        if (q.isLoading)
          Padding(padding: const EdgeInsets.symmetric(vertical: 32), child: Center(child: ALoader(size: 24, color: a.peach2)))
        else
          VGap(gap: 8, children: <Widget>[
            for (var i = 0; i < faqs.length; i++)
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                GestureDetector(
                  key: ValueKey<String>('faq-$i'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _openFaq = _openFaq == i ? null : i),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(color: _openFaq == i ? a.peach1 : null, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: <Widget>[
                      Expanded(child: Text(faqs[i].str('question') ?? '', style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: _openFaq == i ? a.accentInk : a.ink))),
                      const SizedBox(width: 8),
                      AnimatedRotation(turns: _openFaq == i ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: AIcon(AIcons.chevronDown, size: 16, color: _openFaq == i ? a.accentInk : a.ink)),
                    ]),
                  ),
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  child: _openFaq == i
                      ? Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 12), child: Text(faqs[i].str('answer') ?? '', style: Tw.sm.copyWith(color: a.inkSoft)))
                      : const SizedBox(width: double.infinity),
                ),
              ]),
          ]),
      ]),
    );
  }

  Widget _contact(BuildContext context) {
    final a = context.a;
    final open = ref.read(externalLinkOpenerProvider);
    Widget link(String key, AIconData icon, Color bg, Color ink, String title, String value, Uri uri) => PressScale(
          key: ValueKey<String>(key),
          scale: 0.98,
          onTap: () => unawaited(open(uri)),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Row(children: <Widget>[
              Container(width: 44, height: 44, alignment: Alignment.center, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)), child: AIcon(icon, size: 19, color: ink)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Text(title, style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                  Text(value, style: px(12.5, weight: FontWeight.w600, color: ink)),
                ]),
              ),
              AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
            ]),
          ),
        );
    return VGap(gap: 14, children: <Widget>[
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          _cardTitle(tr('helpscreen_bizimle_elaqe_ebc559', 'Bizimlə Əlaqə'), bottom: 14),
          link('help-mail', AIcons.mail, a.peach1, a.accentInk, tr('helpscreen_e_poct_f5c193', 'E-poçt'), 'info@anacan.az', Uri.parse('mailto:info@anacan.az')),
          const SizedBox(height: 10),
          link('help-phone', AIcons.phone, a.green1, a.greenInk, tr('untranslated_telefon_vwjgg5', 'Telefon'), '+994 10 321 65 07', Uri.parse('tel:+994103216507')),
        ]),
      ),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          _cardTitle(tr('helpscreen_is_saatlari_cfa6fe', 'İş saatları'), bottom: 6),
          Padding(padding: const EdgeInsets.only(bottom: 14), child: Text(tr('helpscreen_bazar_ertesi_cume_09_00_18_00_bb0b17', 'Bazar ertəsi - Cümə: 09:00 - 18:00'), style: px(13, color: a.inkSoft))),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
            child: Text(tr('helpscreen_suretli_cavab_ucun_muracietler_630f46', '💡 Sürətli cavab üçün "Müraciətlər" bölməsindən bilet göndərin'), style: px(12.5, color: a.accentInk)),
          ),
        ]),
      ),
    ]);
  }

  Widget _tickets(BuildContext context) {
    final a = context.a;
    final cats = ref.watch(supportCategoriesQuery).data;
    final categories = cats == null || cats.isEmpty && ref.watch(supportCategoriesQuery).isLoading
        ? [('general', tr('helpscreen_umumi_sual_e1c5ee', 'Ümumi sual'))]
        : [for (final c in cats) (c.str('category_key') ?? '', c.str('name') ?? '')];
    final q = ref.watch(supportTicketsQuery);
    final tickets = q.data ?? const <Map<String, dynamic>>[];
    final label = px(12.5, weight: FontWeight.w600, color: a.inkSoft);
    final peachShadow = const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)];
    return VGap(gap: 14, children: <Widget>[
      if (!_showNew)
        PressScale(
          key: const ValueKey<String>('help-new-ticket'),
          scale: 0.98,
          onTap: () => setState(() => _showNew = true),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999), boxShadow: peachShadow),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
              const AIcon(AIcons.plus, size: 20, color: Color(0xFFFFFFFF)),
              const SizedBox(width: 8),
              Text(tr('helpscreen_yeni_muraciet_gonder_45ce1f', 'Yeni müraciət göndər'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
            ]),
          ),
        )
      else
        FadeRise(
          dy: -10,
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(children: <Widget>[
                  Expanded(child: Text(tr('helpscreen_yeni_muraciet_f62908', 'Yeni Müraciət'), style: context.aText.aCardTitle)),
                  GestureDetector(onTap: () => setState(() => _showNew = false), child: Text(tr('helpscreen_legv_et_b5e49c', 'Ləğv et'), style: px(13, weight: FontWeight.w600, color: a.inkSoft))),
                ]),
              ),
              VGap(gap: 16, children: <Widget>[
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('untranslated_kateqoriya_d7bf4y', 'Kateqoriya'), style: label)),
                  Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
                    for (final c in categories)
                      GestureDetector(
                        key: ValueKey<String>('help-cat-${c.$1}'),
                        onTap: () => setState(() => _category = c.$1),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
                          decoration: BoxDecoration(
                            color: _category == c.$1 ? a.peach1 : a.surfaceSoft,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: _category == c.$1 ? a.peach2 : const Color(0x00000000), width: 1.5),
                          ),
                          child: Text(c.$2, style: px(12.5, weight: FontWeight.w600, color: _category == c.$1 ? a.accentInk : a.inkSoft)),
                        ),
                      ),
                  ]),
                ]),
                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                  Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('helpscreen_movzu_5ac952', 'Mövzu'), style: label)),
                  ShadInput(fieldKey: const ValueKey<String>('help-subject'), controller: _subject, height: 44, radius: 12, background: a.surface, borderColor: a.lineStrong, textColor: a.ink, placeholder: tr('helpscreen_muracietinizin_movzusu_d111c4', 'Müraciətinizin mövzusu')),
                ]),
                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                  Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('untranslated_mesaj_3c09op', 'Mesaj'), style: label)),
                  ShadInput(fieldKey: const ValueKey<String>('help-message'), controller: _message, maxLines: null, radius: 12, background: a.surface, borderColor: a.lineStrong, textColor: a.ink, placeholder: tr('helpscreen_probleminizi_etrafli_tesvir_edin_2c4a86', 'Probleminizi ətraflı təsvir edin...')),
                ]),
                Opacity(
                  opacity: _submitting ? 0.5 : 1,
                  child: PressScale(
                    key: const ValueKey<String>('help-submit'),
                    scale: 0.98,
                    onTap: _submitting ? null : _submit,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                      decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                        if (_submitting)
                          const ARingSpinner(size: 20, width: 2, color: Color(0xFFFFFFFF))
                        else ...<Widget>[
                          const AIcon(AIcons.send, size: 16, color: Color(0xFFFFFFFF)),
                          const SizedBox(width: 8),
                          Text(tr('helpscreen_gonder_3f11bd', 'Göndər'), style: px(13.5, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                        ],
                      ]),
                    ),
                  ),
                ),
              ]),
            ]),
          ),
        ),
      ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          _cardTitle(tr('helpscreen_muracietleriniz_45af5e', 'Müraciətləriniz')),
          if (q.isLoading)
            Padding(padding: const EdgeInsets.symmetric(vertical: 32), child: Center(child: ARingSpinner(size: 24, width: 2, color: a.peach2)))
          else if (tickets.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Column(children: <Widget>[
                const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('📩', style: TextStyle(fontSize: 36))),
                Text(tr('helpscreen_hele_muraciet_yoxdur_6f37de', 'Hələ müraciət yoxdur'), style: px(13, color: a.inkSoft)),
              ]),
            )
          else
            VGap(gap: 10, children: <Widget>[
              for (final t in tickets)
                PressScale(
                  key: ValueKey<String>('ticket-${t['id']}'),
                  scale: 0.98,
                  onTap: () => setState(() => _selected = t),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Expanded(child: Text(t.str('subject') ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(13.5, weight: FontWeight.w700, color: a.ink))),
                          const SizedBox(width: 8),
                          AIcon(_statusIcon(t.str('status') ?? 'open').$1, size: 16, color: _statusIcon(t.str('status') ?? 'open').$2),
                          const SizedBox(width: 4),
                          Text(_statusText(t.str('status') ?? 'open'), style: px(11, color: a.inkSoft)),
                        ]),
                      ),
                      Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t.str('message') ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(12.5, color: a.inkSoft))),
                      Row(children: <Widget>[
                        Expanded(child: Text(_fmt(t.str('created_at'), 'd MMM yyyy'), style: px(11, color: a.inkFaint))),
                        AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
                      ]),
                    ]),
                  ),
                ),
            ]),
        ]),
      ),
    ]);
  }
}

class _TicketChat extends ConsumerStatefulWidget {
  const _TicketChat({required this.ticket, required this.statusIcon, required this.statusText, required this.onBack});
  final Map<String, dynamic> ticket;
  final (AIconData, Color) Function(String) statusIcon;
  final String Function(String) statusText;
  final VoidCallback onBack;
  @override
  ConsumerState<_TicketChat> createState() => _TicketChatState();
}

class _TicketChatState extends ConsumerState<_TicketChat> {
  final TextEditingController _reply = TextEditingController();
  final ScrollController _scroll = ScrollController();
  bool _submitting = false;

  @override
  void dispose() {
    _reply.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _reply.text.trim();
    if (text.isEmpty) return;
    final toast = toasts(context);
    setState(() => _submitting = true);
    final error = await ref.read(supportActionsProvider).addReply('${widget.ticket['id']}', text);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error == null) {
      _reply.clear();
    } else {
      toast.show(title: tr('helpscreen_xeta_3cdbb6', 'Xəta'), description: tr('helpscreen_mesaj_gonderile_bilmedi_0cd095', 'Mesaj göndərilə bilmədi'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.ticket;
    final status = t.str('status') ?? 'open';
    final q = ref.watch(ticketRepliesQuery('${t['id']}'));
    ref.listen(ticketRepliesQuery('${t['id']}'), (_, _) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) unawaited(_scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut));
      });
    });
    final replies = q.data ?? const <Map<String, dynamic>>[];
    final canReply = status != 'closed';
    final (icon, iconColor) = widget.statusIcon(status);
    Widget supportBadge() => Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
            Container(width: 20, height: 20, alignment: Alignment.center, decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle), child: const Text('👩‍⚕️', style: TextStyle(fontSize: 10))),
            const SizedBox(width: 6),
            Text(tr('helpscreen_destek_73b142', 'Dəstək'), style: px(10, weight: FontWeight.w700, color: a.accentInk)),
          ]),
        );
    Widget bubble({required bool admin, required String text, required String time, bool badge = true}) => Align(
          alignment: admin ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
          child: FractionallySizedBox(
            widthFactor: 0.8,
            alignment: admin ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
            child: Align(
              alignment: admin ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: admin ? a.surface : a.ink,
                  border: admin ? Border.all(color: a.line) : null,
                  boxShadow: admin ? a.cardShadow : null,
                  borderRadius: admin
                      ? const BorderRadius.only(topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomRight: Radius.circular(18), bottomLeft: Radius.circular(4))
                      : const BorderRadius.only(topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(4)),
                ),
                child: Column(crossAxisAlignment: admin ? CrossAxisAlignment.start : CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: <Widget>[
                  if (admin && badge) supportBadge(),
                  Text(text, style: px(13, color: admin ? a.ink : a.bg, height: 1.55)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Opacity(opacity: admin ? 1 : 0.6, child: Text(time, style: px(10, color: admin ? a.inkFaint : a.bg))),
                  ),
                ]),
              ),
            ),
          ),
        );
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Column(children: <Widget>[
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
            child: Row(children: <Widget>[
              AIconBtn(key: const ValueKey<String>('ticket-back'), tapScale: 0.95, semanticLabel: tr('common_geri', 'Geri'), onTap: widget.onBack, icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Text(t.str('subject') ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(15, weight: FontWeight.w800, color: a.ink)),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(children: <Widget>[
                      AIcon(icon, size: 16, color: iconColor),
                      const SizedBox(width: 6),
                      Text(widget.statusText(status), style: px(12, color: a.inkSoft)),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                bubble(admin: false, text: t.str('message') ?? '', time: _fmt(t.str('created_at'), 'd MMM, HH:mm')),
                if ((t.str('admin_response') ?? '').isNotEmpty) ...<Widget>[
                  const SizedBox(height: 12),
                  bubble(admin: true, text: t.str('admin_response')!, time: _fmt(t.str('responded_at'), 'd MMM, HH:mm')),
                ],
                if (q.isLoading)
                  Padding(padding: const EdgeInsets.symmetric(vertical: 16), child: Center(child: ALoader(size: 20, color: a.peach2)))
                else
                  for (final r in replies) ...<Widget>[
                    const SizedBox(height: 12),
                    bubble(admin: r['is_admin'] == true, text: r.str('message') ?? '', time: _fmt(r.str('created_at'), 'd MMMM, HH:mm')),
                  ],
              ],
            ),
          ),
          if (canReply)
            Container(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: <Widget>[
                Expanded(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44, maxHeight: 120),
                    child: CallbackShortcuts(
                      bindings: <ShortcutActivator, VoidCallback>{const SingleActivator(LogicalKeyboardKey.enter): () => unawaited(_send())},
                      child: ShadInput(
                        fieldKey: const ValueKey<String>('ticket-reply'),
                        controller: _reply,
                        maxLines: null,
                        radius: 16,
                        background: a.surface,
                        borderColor: a.lineStrong,
                        textColor: a.ink,
                        placeholder: tr('helpscreen_mesajinizi_yazin_21d48f', 'Mesajınızı yazın...'),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Opacity(
                  opacity: _submitting || _reply.text.trim().isEmpty ? 0.5 : 1,
                  child: PressScale(
                    key: const ValueKey<String>('ticket-send'),
                    scale: 0.92,
                    onTap: _submitting || _reply.text.trim().isEmpty ? null : _send,
                    child: Semantics(
                      button: true,
                      label: tr('helpscreen_gonder_3f11bd', 'Göndər'),
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle),
                        child: _submitting ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.send, size: 16, color: Color(0xFFFFFFFF)),
                      ),
                    ),
                  ),
                ),
              ]),
            )
          else
            Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
              decoration: BoxDecoration(color: a.disclaimerBg, border: Border(top: BorderSide(color: a.line))),
              child: Text(tr('helpscreen_bu_muraciet_baglanib_yeni_mura_a27374', 'Bu müraciət bağlanıb. Yeni müraciət göndərə bilərsiniz.'), textAlign: TextAlign.center, style: px(12.5, color: a.disclaimerInk)),
            ),
        ]),
      ),
    );
  }
}
