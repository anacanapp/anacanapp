// Ported from: src/components/tools/parenting/ParentingScreens.tsx, src/styles/anacan-design.css (.a-par*)
//
// The screens of the Tərbiyə tool: home (search, daily tip, partner shares, band chips, overview, SOS, topics,
// programmes, quizzes), band overview, topics library, article, SOS list / card, programmes, programme (days,
// reminder card, summary), quizzes (style, milestones) and bookmarks.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart' show TextInputAction, TextInputType;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show TextField, InputDecoration, InputBorder, Material, MaterialType;

import '../../../design/design.dart';
import '../../../domain/health/emergency.dart' show fillEmergencyNumber;
import '../../../domain/js_compat.dart';
import '../../../domain/parenting/parenting.dart' hide defaultReminderTime;
import '../../premium/premium_gates.dart' show PremiumBlurGate;
import '../kit/kit.dart' show safetyCallLauncherProvider;
import 'parenting_content.dart';
import 'parenting_copy.dart';
import 'parenting_reminders.dart' show canRemindDay;
import 'parenting_search.dart';
import 'parenting_share.dart';
import 'parenting_store.dart';
import 'programme_ports.dart';
import 'programme_ui.dart';

/// `Route`: s = 'home' | 'band' | 'topics' | 'article' | 'sosList' | 'sos' | 'programmes' | 'programme' | 'quiz' |
/// 'saved'.
class ParRoute {
  const ParRoute(this.s, {this.id, this.focus, this.area});
  final String s;
  final String? id;

  /// 'sources': scroll to the band's sources (the daily tip's "Mənbələr" link).
  final String? focus;
  final String? area;
}

class ParentingCtx {
  const ParentingCtx({
    required this.content,
    required this.band,
    required this.childBand,
    required this.childName,
    required this.childAgeLabel,
    required this.ageMonths,
    required this.isPremium,
    required this.emergency,
    required this.today,
    required this.locale,
    required this.local,
    required this.slot,
    required this.updateSlot,
    required this.update,
    required this.updateLocal,
    required this.go,
    required this.track,
    required this.query,
    required this.setQuery,
    required this.reminderAllowed,
    this.milestoneMonths,
    this.milestoneKnown = false,
    this.milestoneCorrected = false,
    this.partner = false,
    this.userId,
    this.shareActor,
    this.sources = const {},
  });
  final ParentingContent content;
  final String band;
  final String? childBand;
  final String childName;
  final String? childAgeLabel;
  final int? ageMonths;
  final bool isPremium;
  final String emergency;
  final String today;

  /// App language (dates in the programme summary).
  final String locale;
  final ParentingLocal local;

  /// The selected child's band choice, programme progress and quiz results.
  final ChildSlot slot;
  final void Function(ChildSlot Function(ChildSlot slot) fn) updateSlot;
  final void Function(ParentingLocal Function(ParentingLocal s) fn) update;
  final void Function(ParentingLocal Function(ParentingLocal s) fn) updateLocal;
  final void Function(ParRoute r) go;
  final void Function(String action, [String? itemId]) track;

  /// Home search text (kept while the parent opens a result and comes back).
  final String query;
  final void Function(String q) setQuery;

  /// The tool switch is on: reminders can be turned on (free users for the free programme days).
  final bool reminderAllowed;

  /// Age for the milestone check (corrected for a preterm baby); [milestoneKnown] false = use [ageMonths].
  final int? milestoneMonths;
  final bool milestoneKnown;
  final bool milestoneCorrected;

  /// The partner (father) app: no Tools tab, items come from the mother.
  final bool partner;
  final String? userId;

  /// The mother with a linked partner: "Send to partner" is offered.
  final ({String userId, String partnerProfileId})? shareActor;

  /// The shared SOS source list (`S`).
  final Map<String, PSource> sources;
}

const Map<String, String> _areaTint = {
  'emotions': 'peach',
  'limits': 'mint',
  'connection': 'sky',
  'routines': 'lav',
  'growth': 'amber',
  'play': 'mint',
  'behaviour': 'peach',
  'parent': 'lav',
  'school': 'sky',
};

/// Typical age for the milestone check when the child's birth date is unknown.
const Map<String, int> _bandMonths = {'0-1': 9, '1-3': 18, '3-6': 48, '6-12': 72};

String bandLabel(String b) => pt(bandKey(b));
bool _hasEmergency(List<String?> texts) => texts.any((t) => t != null && t.contains('{emergency}'));
int articleMinutes(Article a) => readingMinutes([a.summary, ...a.science, ...a.tryToday, ...a.mistakes, ...?a.byAge?.values, ...a.specialist]);
bool canRead(bool free, bool isPremium) => free || isPremium;

Color _tint(ATokens a, String t) => switch (t) {
      'peach' => a.peach1,
      'mint' => a.green1,
      'sky' => a.blue1,
      'lav' => a.lav1,
      _ => a.yellow1,
    };

// ── Small pieces ─────────────────────────────────────────────────────────────────────────────

/// `.a-par` column (gap 12).
class _Par extends StatelessWidget {
  const _Par({required this.children, super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Gap(gap: 12, children: children);
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, this.free = false, this.crown = false});
  final String text;
  final bool free;
  final bool crown;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = free ? a.greenInk : a.warnInk;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: free ? a.green1 : a.yellow1, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (crown) ...[AIcon(AIcons.crown, size: 10, strokeWidth: 2.6, color: fg), const SizedBox(width: 3)],
        Text(text, style: css(10.5, weight: FontWeight.w800, em: 0.02, color: fg)),
      ]),
    );
  }
}

Widget _premiumBadge() => _Badge(text: pt('par_premium'), crown: true);
Widget _freeBadge() => _Badge(text: pt('par_free'), free: true);

class _Sec extends StatelessWidget {
  const _Sec({required this.title, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 6, 2, 0),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Flexible(child: Text(title, style: css(16, weight: FontWeight.w800, em: -0.01, color: a.onBg))),
        if (action != null && onAction != null)
          Tap(
            onTap: onAction,
            child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(action!, style: css(12.5, weight: FontWeight.w700, color: a.coralText))),
          ),
      ]),
    );
  }
}

/// `.a-par-box.is-<tone>`.
class _Box extends StatelessWidget {
  const _Box({required this.tone, required this.label, required this.children});
  final String tone;
  final String label;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Color? bg, Gradient? g, Color fg) = switch (tone) {
      'brain' => (a.lav1, null, a.lavInk),
      'try' => (a.green1, null, a.greenInk),
      'warn' => (a.yellow1, null, a.warnInk),
      _ => (null, a.alertBg, a.alertInk),
    };
    return Semantics(
      liveRegion: tone == 'red',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(color: bg, gradient: g, borderRadius: BorderRadius.circular(18)),
        child: DefaultTextStyle.merge(
          style: css(13.5, height: 1.55, color: fg),
          child: Gap(gap: 6, children: [
            Text(label.toUpperCase(), style: css(12, weight: FontWeight.w800, em: 0.04, color: fg)),
            ...children,
          ]),
        ),
      ),
    );
  }
}

/// `.a-par-bullets` with `{emergency}` filled.
class _Bullets extends StatelessWidget {
  const _Bullets({required this.items, required this.emergency, this.color});
  final List<String> items;
  final String emergency;
  final Color? color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(start: 4),
        child: Gap(gap: 6, children: [
          for (final t in items)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('•  ', style: css(13.5, color: color)),
              Expanded(child: Text(fillEmergencyNumber(t, emergency), style: css(13.5, color: color))),
            ]),
        ]),
      );
}

/// `.a-par-call` (`<a href="tel:…">`).
class _CallButton extends ConsumerWidget {
  const _CallButton({required this.emergency, this.compact = false});
  final String emergency;
  final bool compact;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final label = pf('par_call', {'emergency': emergency});
    return Semantics(
      link: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => unawaited(ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency))),
        child: Container(
          constraints: BoxConstraints(minHeight: compact ? 38 : 44),
          padding: EdgeInsets.symmetric(horizontal: compact ? 14 : 0),
          decoration: BoxDecoration(color: a.coralStrong, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max, mainAxisAlignment: MainAxisAlignment.center, children: [
            const AIcon(AIcons.phone, size: 15, color: Color(0xFFFFFFFF)),
            const SizedBox(width: 6),
            Text(label, style: css(13, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
          ]),
        ),
      ),
    );
  }
}

class _Sources extends StatelessWidget {
  const _Sources({required this.sources, super.key});
  final List<PSource> sources;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(pt('par_h_sources'), style: css(11.5, weight: FontWeight.w700, color: a.ink))),
        for (final (i, s) in sources.indexed)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Text.rich(
              TextSpan(style: css(11, color: a.inkSoft), children: [
                TextSpan(text: '${i + 1}. ${s.who}${s.year != null ? ' (${s.year})' : ''}. '),
                TextSpan(text: s.title, style: const TextStyle(fontStyle: FontStyle.italic)),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// SOS source ids → the shared reference list (unknown ids are skipped).
List<PSource> sourcesFor(List<String>? ids, Map<String, PSource> list) => [for (final id in ids ?? const <String>[]) ?list[id]];

/// Small support card under safety content: the app's mood / support tool (not in the partner app) + emergency call.
class _SupportCard extends ConsumerWidget {
  const _SupportCard({required this.kind, required this.ctx});
  final String? kind;
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (kind != 'mental-health' && kind != 'child-safety') return const SizedBox.shrink();
    final a = context.a;
    final mh = kind == 'mental-health';
    return Container(
      key: ValueKey('par-support-$kind'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(18)),
      child: Gap(gap: 8, children: [
        Row(children: [
          AIcon(AIcons.heartHandshake, size: 15, color: a.lavInk),
          const SizedBox(width: 6),
          Flexible(child: Text(pt(mh ? 'par_support_mh_title' : 'par_support_cs_title').toUpperCase(), style: css(12, weight: FontWeight.w800, em: 0.04, color: a.lavInk))),
        ]),
        Text(pf(mh ? 'par_support_mh_text' : 'par_support_cs_text', {'emergency': ctx.emergency}), style: css(13.5, height: 1.55, color: a.lavInk)),
        WrapRow(gap: 8, children: [
          if (!ctx.partner)
            ParBtn(
              key: const ValueKey('par-support-open'),
              label: pt('par_support_open'),
              ghost: true,
              small: true,
              onTap: () {
                ctx.track('support_open_$kind');
                ref.read(programmeNavProvider).openTool('mental-health');
              },
            ),
          _CallButton(emergency: ctx.emergency, compact: true),
        ]),
      ]),
    );
  }
}

/// `.a-par-btn` (`ghost`, `small`).
class ParBtn extends StatelessWidget {
  const ParBtn({super.key, required this.label, required this.onTap, this.ghost = false, this.small = false, this.disabled = false, this.icon, this.pressed});
  final String label;
  final VoidCallback onTap;
  final bool ghost;
  final bool small;
  final bool disabled;
  final AIconData? icon;
  final bool? pressed;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = ghost ? a.ink : a.onCoral;
    final body = Container(
      constraints: BoxConstraints(minHeight: small ? 38 : 48),
      padding: EdgeInsets.symmetric(horizontal: small ? 14 : 16, vertical: small ? 8 : 12),
      decoration: BoxDecoration(
        color: ghost ? a.surface : a.coral,
        borderRadius: BorderRadius.circular(999),
        border: ghost ? Border.all(color: a.line) : null,
        boxShadow: ghost ? a.cardShadow : a.coralShadow,
      ),
      child: Row(mainAxisSize: small ? MainAxisSize.min : MainAxisSize.max, mainAxisAlignment: MainAxisAlignment.center, children: [
        if (icon != null) ...[AIcon(icon!, size: 14, color: fg, mirrorInRtl: icon == AIcons.chevronLeft), const SizedBox(width: 6)],
        Flexible(child: Text(label, textAlign: TextAlign.center, style: css(small ? 12.5 : 15, weight: ghost ? FontWeight.w700 : FontWeight.w800, color: fg))),
      ]),
    );
    return Tap(label: label, enabled: !disabled, pressed: pressed, onTap: onTap, excludeSemantics: true, child: Opacity(opacity: disabled ? 0.45 : 1, child: body));
  }
}

/// "Send to partner" (the mother with a linked partner) and the phone's share sheet.
class _ShareRow extends ConsumerStatefulWidget {
  const _ShareRow({required this.ctx, required this.item});
  final ParentingCtx ctx;
  final ShareItem item;
  @override
  ConsumerState<_ShareRow> createState() => _ShareRowState();
}

class _ShareRowState extends ConsumerState<_ShareRow> {
  String _status = 'idle';

  Future<void> _send() async {
    final actor = widget.ctx.shareActor;
    if (actor == null || _status == 'sending') return;
    setState(() => _status = 'sending');
    try {
      final ok = await sendParentingToPartner(ref.read(parentingShareRemoteProvider), actor, partnerShareText(widget.item, pt('par_share_hint')));
      if (!mounted) return;
      setState(() => _status = ok ? 'sent' : 'failed');
      if (ok) widget.ctx.track('share_partner_${widget.item.kind}', widget.item.id);
    } catch (_) {
      if (mounted) setState(() => _status = 'failed');
    }
  }

  void _share() {
    widget.ctx.track('share_${widget.item.kind}', widget.item.id);
    unawaited(ref.read(programmeShareProvider)(title: widget.item.title, text: plainShareText(widget.item, pt('par_share_footer'))));
  }

  @override
  Widget build(BuildContext context) {
    final actor = widget.ctx.shareActor;
    return KeyedSubtree(
      key: const ValueKey('par-share'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        WrapRow(gap: 8, children: [
          if (actor != null)
            ParBtn(
              key: const ValueKey('par-share-partner'),
              label: pt('par_share_partner'),
              small: true,
              icon: AIcons.send,
              disabled: _status == 'sending' || _status == 'sent',
              onTap: () => unawaited(_send()),
            ),
          ParBtn(key: const ValueKey('par-share-sheet'), label: pt('par_share'), ghost: true, small: true, icon: AIcons.share2, onTap: _share),
        ]),
        if (_status == 'sent' || _status == 'failed')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Semantics(liveRegion: true, child: _small(context, pt(_status == 'sent' ? 'par_share_sent' : 'par_share_failed'))),
          ),
      ]),
    );
  }
}

Widget _small(BuildContext context, String text, {Key? key}) => Text(text, key: key, style: css(11.5, height: 1.45, color: context.a.inkSoft));
Widget _lead(BuildContext context, String text) => Text(text, style: css(14.5, weight: FontWeight.w600, height: 1.55, color: context.a.ink));
Widget _meta(BuildContext context, String text) => Text(text, style: css(12, color: context.a.inkSoft));
Widget _title(BuildContext context, String text) => Text(text, style: css(22, weight: FontWeight.w800, height: 1.25, em: -0.02, color: context.a.ink));
Widget _para(BuildContext context, String text) => Text(text, style: css(14, height: 1.6, color: context.a.bodyText));

/// `.a-par-card`.
class _ParCard extends StatelessWidget {
  const _ParCard({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: DefaultTextStyle.merge(style: css(13.5, height: 1.55, color: a.bodyText), child: Gap(gap: 8, children: children)),
    );
  }
}

Widget _cardH3(BuildContext context, String text) => Text(text, style: css(15, weight: FontWeight.w800, height: 1.35, color: context.a.ink));

/// Partner app: the items the mother sent him (newest first); tapping opens the item.
class _PartnerShares extends ConsumerStatefulWidget {
  const _PartnerShares({required this.ctx});
  final ParentingCtx ctx;
  @override
  ConsumerState<_PartnerShares> createState() => _PartnerSharesState();
}

class _PartnerSharesState extends ConsumerState<_PartnerShares> {
  List<PartnerShare> _shares = const [];
  String? _for;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final uid = ctx.partner ? ctx.userId : null;
    if (uid != _for) {
      _for = uid;
      if (uid != null) {
        unawaited(readPartnerShares(ref.read(parentingShareRemoteProvider), uid).then((list) {
          if (mounted && _for == uid) setState(() => _shares = list);
        }));
      }
    }
    final rows = <({PartnerShare s, String emoji, String title, String sub})>[];
    for (final s in _shares) {
      if (s.kind == 'sos') {
        for (final c in ctx.content.sos) {
          if (c.id == s.id) rows.add((s: s, emoji: c.emoji, title: c.title, sub: c.moment));
        }
      } else {
        for (final x in ctx.content.articles) {
          if (x.id == s.id) rows.add((s: s, emoji: x.emoji, title: x.title, sub: x.summary));
        }
      }
    }
    if (uid == null || rows.isEmpty) return const SizedBox.shrink();
    return KeyedSubtree(
      key: const ValueKey('par-partner-shares'),
      child: Gap(gap: 8, children: [
        _Sec(title: pt('par_shared_title')),
        for (final r in rows)
          _Row(
            key: ValueKey('par-shared-${r.s.kind}-${r.s.id}'),
            emoji: r.emoji,
            title: r.title,
            sub: r.sub,
            isNew: !r.s.read,
            onTap: () {
              if (!r.s.read) unawaited(markPartnerShareRead(ref.read(parentingShareRemoteProvider), uid, r.s.messageId));
              ctx.track('partner_share_open', r.s.id);
              ctx.go(ParRoute(r.s.kind, id: r.s.id));
            },
          ),
      ]),
    );
  }
}

/// `.a-par-row`.
class _Row extends StatelessWidget {
  const _Row({required this.emoji, required this.title, required this.sub, required this.onTap, this.meta, this.trailing, this.isNew = false, super.key});
  final String emoji;
  final String title;
  final String sub;
  final String? meta;
  final Widget? trailing;
  final VoidCallback onTap;
  final bool isNew;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Tap(
      label: title,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: a.cardShadow,
          border: isNew ? BorderDirectional(start: BorderSide(color: a.coral, width: 3)) : null,
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
            child: Text(emoji, style: css(19, height: 1.2)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Gap(gap: 3, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: css(14, weight: FontWeight.w700, height: 1.3, color: a.ink)),
              Text(sub, style: css(12, height: 1.4, color: a.inkSoft)),
              if (meta != null) Text(meta!, style: css(11, color: a.inkFaint)),
            ]),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ]),
      ),
    );
  }
}

/// `.a-par-ring`: a conic progress disc with the label on an inner surface disc.
class _ParRing extends StatelessWidget {
  const _ParRing({required this.percent, required this.label, this.size = 52});
  final num percent;
  final String label;
  final double size;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _ConicPainter(percent / 100, a.coral, a.lineStrong),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surface, shape: BoxShape.circle),
            child: Text(label, style: css(11.5, weight: FontWeight.w800, height: 1.2, color: a.ink)),
          ),
        ),
      ),
    );
  }
}

class _ConicPainter extends CustomPainter {
  _ConicPainter(this.fraction, this.fill, this.rest);
  final double fraction;
  final Color fill;
  final Color rest;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2;
    canvas.drawCircle(c, r, Paint()..color = rest);
    final f = fraction.clamp(0.0, 1.0);
    if (f > 0) canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2, 2 * math.pi * f, true, Paint()..color = fill);
  }

  @override
  bool shouldRepaint(_ConicPainter old) => old.fraction != fraction || old.fill != fill || old.rest != rest;
}

/// `.a-par-chips` (scrolling pills) or `.a-par-seg` (segmented).
class _BandChips extends StatelessWidget {
  const _BandChips({required this.value, required this.bands, required this.onChange, this.segmented = false});
  final String value;
  final List<String> bands;
  final ValueChanged<String> onChange;
  final bool segmented;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    if (segmented) {
      return Semantics(
        label: pt('par_band_pick'),
        container: true,
        child: Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), boxShadow: a.cardShadow),
          child: Row(children: [
            for (final b in bands)
              Expanded(
                child: Tap(
                  key: ValueKey('par-seg-$b'),
                  label: bandLabel(b),
                  pressed: b == value,
                  excludeSemantics: true,
                  onTap: () => onChange(b),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: b == value ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                    child: Text(bandLabel(b), maxLines: 1, style: css(12.5, weight: FontWeight.w700, color: b == value ? a.accentInk : a.inkSoft)),
                  ),
                ),
              ),
          ]),
        ),
      );
    }
    return Semantics(
      label: pt('par_band_pick'),
      container: true,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(1, 2, 1, 4),
        child: Row(children: [
          for (final (i, b) in bands.indexed) ...[if (i > 0) const SizedBox(width: 8), _chip(context, b == value, bandLabel(b), () => onChange(b), ValueKey('par-band-$b'))],
        ]),
      ),
    );
  }
}

Widget _chip(BuildContext context, bool on, String label, VoidCallback onTap, Key key) {
  final a = context.a;
  return Tap(
    key: key,
    label: label,
    pressed: on,
    excludeSemantics: true,
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
      decoration: BoxDecoration(color: on ? a.ink : a.surface, borderRadius: BorderRadius.circular(999), boxShadow: a.cardShadow),
      child: Text(label, maxLines: 1, style: css(13, weight: FontWeight.w700, color: on ? a.bg : a.inkSoft)),
    ),
  );
}

class _EmergencyCard extends StatelessWidget {
  const _EmergencyCard({required this.emergency});
  final String emergency;
  @override
  Widget build(BuildContext context) => _Box(tone: 'red', label: pt('par_emergency_title'), children: [
        Text(pf('par_emergency_text', {'emergency': emergency})),
        _CallButton(emergency: emergency),
      ]);
}

class _ArticleRow extends StatelessWidget {
  const _ArticleRow({required this.article, required this.ctx});
  final Article article;
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context) {
    final locked = !canRead(article.free, ctx.isPremium);
    return _Row(
      key: ValueKey('par-article-${article.id}'),
      emoji: article.emoji,
      title: article.title,
      sub: article.summary,
      meta: pf('par_read_time', {'n': articleMinutes(article)}),
      onTap: () => ctx.go(ParRoute('article', id: article.id)),
      trailing: locked
          ? Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.lock, key: const ValueKey('par-lock'), size: 14, color: context.a.warnInk, semanticLabel: pt('par_premium')))
          : article.free && !ctx.isPremium
              ? _freeBadge()
              : null,
    );
  }
}

class _SosTile extends StatelessWidget {
  const _SosTile({required this.card, required this.ctx, this.width});
  final SosCard card;
  final ParentingCtx ctx;
  final double? width;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Tap(
      key: ValueKey('par-sos-${card.id}'),
      label: card.title,
      onTap: () => ctx.go(ParRoute('sos', id: card.id)),
      child: Container(
        width: width,
        constraints: const BoxConstraints(minHeight: 110),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(card.emoji, style: css(22, height: 1.2)),
          const SizedBox(height: 4),
          Text(card.title, style: css(13, weight: FontWeight.w700, height: 1.3, color: a.ink)),
          const SizedBox(height: 4),
          Text(pt(card.free ? 'par_sos_meta_free' : 'par_sos_meta_premium'), style: css(11, color: a.inkSoft)),
        ]),
      ),
    );
  }
}

/// `.a-par-feature` (button or static row).
class _Feature extends StatelessWidget {
  const _Feature({required this.leading, required this.title, required this.sub, this.onTap, this.trailing, this.plain = false, super.key});
  final Widget leading;
  final String title;
  final String sub;
  final VoidCallback? onTap;
  final Widget? trailing;

  /// Inside `.a-par-card`: no shadow, no padding.
  final bool plain;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final body = Container(
      padding: plain ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: plain ? null : BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Row(children: [
        leading,
        const SizedBox(width: 12),
        Expanded(
          child: Gap(gap: 3, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: css(14, weight: FontWeight.w700, height: 1.3, color: a.ink)),
            Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: css(12, height: 1.4, color: a.inkSoft)),
          ]),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ]),
    );
    return onTap == null ? body : Tap(label: title, onTap: onTap, child: body);
  }
}

Widget _emojiSquare(BuildContext context, String emoji) => Container(
      width: 48,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: context.a.lav1, borderRadius: BorderRadius.circular(16)),
      child: Text(emoji, style: css(22, height: 1.2)),
    );

// ── Home ─────────────────────────────────────────────────────────────────────────────────────
class ParHomeScreen extends StatelessWidget {
  const ParHomeScreen({super.key, required this.ctx, required this.tipIndex});
  final ParentingCtx ctx;
  final int tipIndex;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final content = ctx.content;
    final band = ctx.band;
    final tips = content.tips[band] ?? const <Tip>[];
    final tip = tips.isEmpty ? null : tips[tipIndex % tips.length];
    final overview = content.bands.firstWhere((b) => b.id == band);
    final sos = content.sos.where((c) => c.bands.contains(band)).toList();
    final articles = content.articles.where((x) => x.bands.contains(band)).toList();
    final areas = content.areas.where((ar) => articles.any((x) => x.area == ar.id)).toList();
    void setBand(String b) => ctx.updateSlot((slot) => setSlotBand(slot, b, ctx.childBand));
    final overviewMin = readingMinutes([overview.lead, ...overview.brain, ...overview.needs, ...overview.normal, ...overview.tryThis]);
    final searching = ctx.query.trim().length >= 2;

    return _Par(children: [
      _SearchBox(ctx: ctx),
      if (searching)
        _SearchResults(ctx: ctx)
      else ...[
        Semantics(
          label: pt('par_tip_title'),
          container: true,
          child: Container(
            key: const ValueKey('par-tip'),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: const Alignment(-0.77, -0.64), end: const Alignment(0.77, 0.64), colors: [a.coralStrong, a.coral]),
              borderRadius: BorderRadius.circular(24),
              boxShadow: a.coralShadow,
            ),
            child: DefaultTextStyle.merge(
              style: TextStyle(color: a.onCoral),
              child: Gap(gap: 6, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Flexible(child: Opacity(opacity: 0.92, child: Text(pt('par_tip_title').toUpperCase(), style: css(11.5, weight: FontWeight.w800, em: 0.05, color: a.onCoral)))),
                  if (ctx.childAgeLabel != null)
                    ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.5),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0x29000000), borderRadius: BorderRadius.circular(999)),
                        child: Text('${ctx.childName} · ${ctx.childAgeLabel}', maxLines: 1, overflow: TextOverflow.ellipsis, style: css(11, weight: FontWeight.w800, color: a.onCoral)),
                      ),
                    ),
                ]),
                if (tip != null) ...[
                  Text(tip.title, style: css(19, weight: FontWeight.w800, height: 1.3, em: -0.01, color: a.onCoral)),
                  Opacity(opacity: 0.96, child: Text(tip.text, style: css(13.5, color: a.onCoral))),
                ],
                Tap(
                  key: const ValueKey('par-tip-sources'),
                  label: pt('par_tip_sources'),
                  onTap: () => ctx.go(ParRoute('band', id: band, focus: 'sources')),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Opacity(
                      opacity: 0.92,
                      child: Text(pt('par_tip_sources'), style: css(12, weight: FontWeight.w700, color: a.onCoral, decoration: TextDecoration.underline)),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ),
        _PartnerShares(ctx: ctx),
        _BandChips(value: band, bands: ageBandIds, onChange: setBand),
        if (ctx.childBand != null && band == ctx.childBand) _small(context, pf('par_band_from_child', {'name': ctx.childName})),
        _Sec(title: pt('par_band_open'), action: pt('par_see_all'), onAction: () => ctx.go(ParRoute('band', id: band))),
        _Feature(
          key: const ValueKey('par-overview'),
          leading: const _ParRing(percent: 100, label: '🧠'),
          title: overview.title,
          sub: '${overview.lead} · ${pf('par_minutes', {'n': overviewMin})}',
          onTap: () => ctx.go(ParRoute('band', id: band)),
        ),
        _Sec(title: pt('par_sec_sos'), action: pf('par_count_cards', {'n': sos.length}), onAction: () => ctx.go(const ParRoute('sosList'))),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(2, 2, 2, 8),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (i, c) in sos.indexed) ...[if (i > 0) const SizedBox(width: 10), _SosTile(card: c, ctx: ctx, width: 150)],
            ]),
          ),
        ),
        _Sec(title: pt('par_sec_topics'), action: pf('par_count_articles', {'n': articles.length}), onAction: () => ctx.go(const ParRoute('topics'))),
        Grid(columns: 2, gap: 10, children: [
          for (final ar in areas) _AreaTile(area: ar, articles: articles.where((x) => x.area == ar.id).toList(), ctx: ctx),
        ]),
        _Sec(title: pt('par_sec_programmes'), action: pt('par_see_all'), onAction: () => ctx.go(const ParRoute('programmes'))),
        for (final p in content.programmes.where((p) => p.bands.contains(band))) _ProgrammeRow(p: p, ctx: ctx),
        _Sec(title: pt('par_sec_quizzes')),
        _QuizRows(ctx: ctx),
        _EmergencyCard(emergency: ctx.emergency),
        _small(context, pt('par_disclaimer')),
      ],
    ]);
  }
}

// ── Search ───────────────────────────────────────────────────────────────────────────────────
class _SearchBox extends StatefulWidget {
  const _SearchBox({required this.ctx});
  final ParentingCtx ctx;
  @override
  State<_SearchBox> createState() => _SearchBoxState();
}

class _SearchBoxState extends State<_SearchBox> {
  late final TextEditingController _c = TextEditingController(text: widget.ctx.query);

  @override
  void didUpdateWidget(_SearchBox old) {
    super.didUpdateWidget(old);
    if (widget.ctx.query != _c.text) _c.text = widget.ctx.query;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      constraints: const BoxConstraints(minHeight: 46),
      padding: const EdgeInsetsDirectional.only(start: 14, end: 6),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), boxShadow: a.cardShadow),
      child: Row(children: [
        AIcon(AIcons.search, size: 16, color: a.inkSoft),
        const SizedBox(width: 8),
        Expanded(
          child: Semantics(
            label: pt('par_search_label'),
            textField: true,
            child: Material(
              type: MaterialType.transparency,
              child: TextField(
                key: const ValueKey('par-search'),
                controller: _c,
                maxLength: 80,
                onChanged: widget.ctx.setQuery,
                textInputAction: TextInputAction.search,
                style: css(14.5, color: a.ink),
                decoration: InputDecoration(
                  border: InputBorder.none,
                  isDense: true,
                  counterText: '',
                  hintText: pt('par_search_placeholder'),
                  hintStyle: css(14.5, color: a.inkFaint),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
        ),
        if (widget.ctx.query.isNotEmpty)
          Tap(
            key: const ValueKey('par-search-clear'),
            label: pt('par_search_clear'),
            excludeSemantics: true,
            onTap: () => widget.ctx.setQuery(''),
            child: Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
              child: AIcon(AIcons.x, size: 15, color: a.inkSoft),
            ),
          ),
      ]),
    );
  }
}

class _SearchResults extends StatefulWidget {
  const _SearchResults({required this.ctx});
  final ParentingCtx ctx;
  @override
  State<_SearchResults> createState() => _SearchResultsState();
}

class _SearchResultsState extends State<_SearchResults> {
  String? _tracked;
  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final res = searchParenting(ctx.content, ctx.query);
    if (res.total > 0 && _tracked != ctx.query) {
      _tracked = ctx.query;
      ctx.track('search'); // once per distinct query
    }
    if (res.total == 0) return Semantics(liveRegion: true, child: _small(context, pt('par_search_empty')));
    final a = context.a;
    Widget head(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(2, 6, 2, 0),
          child: Text(t.toUpperCase(), style: css(12, weight: FontWeight.w800, em: 0.05, color: a.inkSoft)),
        );
    return Gap(gap: 10, children: [
      Semantics(liveRegion: true, child: _small(context, pf('par_search_results', {'n': res.total}))),
      if (res.sos.isNotEmpty)
        Gap(gap: 8, children: [
          head(pt('par_search_sos')),
          for (final h in res.sos)
            _Row(
              key: ValueKey('par-result-sos-${h.item.id}'),
              emoji: h.item.emoji,
              title: h.item.title,
              sub: h.item.moment,
              onTap: () => ctx.go(ParRoute('sos', id: h.item.id)),
              trailing: !canRead(h.item.free, ctx.isPremium)
                  ? Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.lock, key: const ValueKey('par-lock'), size: 14, color: a.warnInk, semanticLabel: pt('par_premium')))
                  : h.item.free && !ctx.isPremium
                      ? _freeBadge()
                      : null,
            ),
        ]),
      if (res.articles.isNotEmpty) Gap(gap: 8, children: [head(pt('par_search_articles')), for (final h in res.articles) _ArticleRow(article: h.item, ctx: ctx)]),
      if (res.programmes.isNotEmpty) Gap(gap: 8, children: [head(pt('par_search_programmes')), for (final h in res.programmes) _ProgrammeRow(p: h.item, ctx: ctx)]),
    ]);
  }
}

class _AreaTile extends StatelessWidget {
  const _AreaTile({required this.area, required this.articles, required this.ctx});
  final PArea area;
  final List<Article> articles;
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final allLocked = !ctx.isPremium && !articles.any((x) => x.free);
    return Tap(
      key: ValueKey('par-area-${area.id}'),
      label: area.title,
      onTap: () => ctx.go(ParRoute('topics', area: area.id)),
      child: Container(
        constraints: const BoxConstraints(minHeight: 108),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
        child: Stack(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.only(bottom: 4),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: _tint(a, _areaTint[area.id] ?? 'amber'), borderRadius: BorderRadius.circular(12)),
              child: Text(area.emoji, style: css(18, height: 1.2)),
            ),
            Text(area.title, style: css(13.5, weight: FontWeight.w700, height: 1.25, color: a.ink)),
            const SizedBox(height: 4),
            Text(pf('par_count_articles', {'n': articles.length}), style: css(11.5, color: a.inkSoft)),
          ]),
          if (allLocked) PositionedDirectional(top: -3, end: -3, child: _premiumBadge()),
        ]),
      ),
    );
  }
}

class _ProgrammeRow extends StatelessWidget {
  const _ProgrammeRow({required this.p, required this.ctx, this.plain = false});
  final Programme p;
  final ParentingCtx ctx;
  final bool plain;
  @override
  Widget build(BuildContext context) {
    final prog = ctx.slot.programmes[p.id];
    final done = prog?.done.length ?? 0;
    return _Feature(
      key: ValueKey('par-programme-${p.id}'),
      plain: plain,
      leading: _ParRing(percent: progressPercent(prog, p.days.length), label: prog != null ? '$done/${p.days.length}' : p.emoji),
      title: p.title,
      sub: prog != null ? pf('par_prog_progress', {'done': done, 'total': p.days.length}) : '${pf('par_prog_days', {'n': p.days.length})} · ${pt('par_prog_daily')}',
      onTap: () => ctx.go(ParRoute('programme', id: p.id)),
      // Free users can follow the first days of every programme: say so instead of a bare "Premium".
      trailing: ctx.isPremium ? null : _Badge(text: pf('par_prog_free_days', {'n': freeProgrammeDays}), free: true),
    );
  }
}

/// The milestone check's age: corrected for a preterm baby (until 24 corrected months), else the calendar age.
int? _milestoneMonthsOf(ParentingCtx ctx) => ctx.milestoneKnown ? ctx.milestoneMonths : ctx.ageMonths;

class _QuizRows extends StatelessWidget {
  const _QuizRows({required this.ctx});
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context) {
    final sq = ctx.content.styleQuiz!, mq = ctx.content.milestoneQuiz!;
    final rows = <Widget>[];
    Widget row(String id, String emoji, String title, String? lastTitle) => _Feature(
          key: ValueKey('par-quiz-$id'),
          leading: _emojiSquare(context, emoji),
          title: title,
          sub: lastTitle != null ? pf('par_quiz_last', {'result': lastTitle}) : pt('par_quiz_start'),
          onTap: () => ctx.go(ParRoute('quiz', id: id)),
        );
    final lastStyle = ctx.slot.quizzes['style'];
    rows.add(row('style', sq.emoji, sq.title, lastStyle == null ? null : sq.results[lastStyle.result]?.title));
    if (milestoneCheckOffered(mq.checkpoints, _milestoneMonthsOf(ctx), ctx.band)) {
      final last = ctx.slot.quizzes['milestones'];
      rows.add(row('milestones', mq.emoji, mq.title, last == null ? null : mq.results[last.result]?.title));
    }
    return Gap(gap: 12, children: rows);
  }
}

// ── Age band overview ────────────────────────────────────────────────────────────────────────
class BandScreen extends StatefulWidget {
  const BandScreen({super.key, required this.ctx, required this.id, this.focus});
  final ParentingCtx ctx;
  final String id;
  final String? focus;
  @override
  State<BandScreen> createState() => _BandScreenState();
}

class _BandScreenState extends State<BandScreen> {
  final GlobalKey _sources = GlobalKey();

  @override
  void initState() {
    super.initState();
    if (widget.focus == 'sources') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final c = _sources.currentContext;
        if (c != null && c.mounted) unawaited(Scrollable.ensureVisible(c));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final b = ctx.content.bands.firstWhere((x) => x.id == widget.id);
    return _Par(children: [
      _meta(context, bandLabel(b.id)),
      _title(context, '${b.emoji} ${b.title}'),
      _lead(context, b.lead),
      _Box(tone: 'brain', label: '🧠 ${pt('par_h_brain')}', children: [for (final t in b.brain) Text(t)]),
      _ParCard(children: [_cardH3(context, pt('par_h_needs')), _Bullets(items: b.needs, emergency: ctx.emergency, color: context.a.bodyText)]),
      _ParCard(children: [_cardH3(context, pt('par_h_normal')), _Bullets(items: b.normal, emergency: ctx.emergency, color: context.a.bodyText)]),
      _Box(tone: 'try', label: '✅ ${pt('par_h_try_age')}', children: [_Bullets(items: b.tryThis, emergency: ctx.emergency)]),
      _Box(tone: 'warn', label: '⚠️ ${pt('par_h_specialist')}', children: [
        _Bullets(items: b.specialist, emergency: ctx.emergency),
        if (_hasEmergency(b.specialist)) _CallButton(emergency: ctx.emergency),
      ]),
      _SupportCard(kind: b.support, ctx: ctx),
      _Sources(key: _sources, sources: b.sources),
    ]);
  }
}

// ── Topics library ───────────────────────────────────────────────────────────────────────────
class TopicsScreen extends StatefulWidget {
  const TopicsScreen({super.key, required this.ctx, this.area});
  final ParentingCtx ctx;
  final String? area;
  @override
  State<TopicsScreen> createState() => _TopicsScreenState();
}

class _TopicsScreenState extends State<TopicsScreen> {
  late String _current = widget.area ?? 'all';
  bool _onlyBand = true;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final list = ctx.content.articles.where((x) => (_current == 'all' || x.area == _current) && (!_onlyBand || x.bands.contains(ctx.band))).toList();
    return _Par(children: [
      WrapRow(gap: 8, children: [
        _chip(context, _onlyBand, '${pt('par_filter_band')} · ${bandLabel(ctx.band)}', () => setState(() => _onlyBand = true), const ValueKey('par-filter-band')),
        _chip(context, !_onlyBand, pt('par_filter_all'), () => setState(() => _onlyBand = false), const ValueKey('par-filter-all-bands')),
      ]),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(1, 2, 1, 4),
        child: Row(children: [
          _chip(context, _current == 'all', pt('par_filter_all'), () => setState(() => _current = 'all'), const ValueKey('par-area-filter-all')),
          for (final ar in ctx.content.areas) ...[
            const SizedBox(width: 8),
            _chip(context, _current == ar.id, '${ar.emoji} ${ar.title}', () => setState(() => _current = ar.id), ValueKey('par-area-filter-${ar.id}')),
          ],
        ]),
      ),
      if (list.isNotEmpty) ...[for (final x in list) _ArticleRow(article: x, ctx: ctx)] else _small(context, pt('par_empty')),
    ]);
  }
}

PremiumBlurGate _lock(String feature, Widget child, {String? title, String? subtitle, String? cta}) => PremiumBlurGate(
      feature: feature,
      title: title ?? pt('par_lock_title'),
      subtitle: subtitle ?? pt('par_lock_text'),
      cta: cta ?? pt('par_lock_cta'),
      forceLock: true,
      child: child,
    );

// ── Article ──────────────────────────────────────────────────────────────────────────────────
class ArticleScreen extends StatelessWidget {
  const ArticleScreen({super.key, required this.ctx, required this.id});
  final ParentingCtx ctx;
  final String id;
  @override
  Widget build(BuildContext context) {
    Article? x;
    for (final a in ctx.content.articles) {
      if (a.id == id) x = a;
    }
    if (x == null) return const SizedBox.shrink();
    final art = x;
    final a = context.a;
    PArea? area;
    for (final ar in ctx.content.areas) {
      if (ar.id == art.area) area = ar;
    }
    final open = canRead(art.free, ctx.isPremium);
    final bands = art.bands.length == 4 ? '0–12' : art.bands.map(bandLabel).join(', ');
    final rest = Gap(gap: 12, children: [
      _Box(tone: 'try', label: '✅ ${pt('par_h_try')}', children: [_Bullets(items: art.tryToday, emergency: ctx.emergency)]),
      _ParCard(children: [_cardH3(context, pt('par_h_mistakes')), _Bullets(items: art.mistakes, emergency: ctx.emergency, color: a.bodyText)]),
      if (art.byAge != null)
        _ParCard(children: [
          _cardH3(context, pt('par_h_by_age')),
          for (final b in ageBandIds)
            if (art.byAge![b] != null && art.byAge![b]!.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: b == ctx.band ? a.peach1 : null, borderRadius: BorderRadius.circular(12)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(bandLabel(b), style: css(12, weight: FontWeight.w700, color: a.ink))),
                  Text(art.byAge![b]!),
                ]),
              ),
        ]),
    ]);
    return KeyedSubtree(
      key: ValueKey('par-article-screen-${art.id}'),
      child: _Par(children: [
        _meta(context, [?area?.title, bands, pf('par_read_time', {'n': articleMinutes(art)})].join(' · ')),
        _title(context, art.title),
        _lead(context, art.summary),
        _Box(tone: 'brain', label: '🧠 ${pt('par_h_science')}', children: [if (art.science.isNotEmpty) Text(art.science.first)]),
        for (final t in art.science.skip(1)) _para(context, t),
        open ? rest : _lock('parenting_article', rest),
        _Box(tone: 'warn', label: '⚠️ ${pt('par_h_specialist')}', children: [
          _Bullets(items: art.specialist, emergency: ctx.emergency),
          if (_hasEmergency(art.specialist)) _CallButton(emergency: ctx.emergency),
        ]),
        _SupportCard(kind: art.support, ctx: ctx),
        _ShareRow(ctx: ctx, item: ShareItem(kind: 'article', id: art.id, emoji: art.emoji, title: art.title, summary: art.summary)),
        _Sources(sources: art.sources),
      ]),
    );
  }
}

// ── SOS ──────────────────────────────────────────────────────────────────────────────────────
class SosListScreen extends StatefulWidget {
  const SosListScreen({super.key, required this.ctx});
  final ParentingCtx ctx;
  @override
  State<SosListScreen> createState() => _SosListScreenState();
}

class _SosListScreenState extends State<SosListScreen> {
  late String _band = widget.ctx.band;
  @override
  Widget build(BuildContext context) {
    final list = widget.ctx.content.sos.where((c) => c.bands.contains(_band)).toList();
    return _Par(children: [
      _BandChips(value: _band, bands: ageBandIds, onChange: (b) => setState(() => _band = b), segmented: true),
      Grid(columns: 2, gap: 10, children: [for (final c in list) _SosTile(card: c, ctx: widget.ctx)]),
      if (list.isEmpty) _small(context, pt('par_empty')),
    ]);
  }
}

class SosScreen extends StatefulWidget {
  const SosScreen({super.key, required this.ctx, required this.id});
  final ParentingCtx ctx;
  final String id;
  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  String? _band;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    SosCard? x;
    for (final c in ctx.content.sos) {
      if (c.id == widget.id) x = c;
    }
    if (x == null) return const SizedBox.shrink();
    final c = x;
    final a = context.a;
    final active = _band ?? (c.bands.contains(ctx.band) ? ctx.band : c.bands.first);
    final open = canRead(c.free, ctx.isPremium);
    final sources = sourcesFor(c.sources, ctx.sources);
    Widget step(int i) => Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.coral, shape: BoxShape.circle),
              child: Text('${i + 1}', style: css(14, weight: FontWeight.w800, height: 1.2, color: a.onCoral)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(c.steps[i].title, style: css(14, weight: FontWeight.w700, color: a.ink))),
                Text(c.steps[i].text, style: css(13, color: a.bodyText)),
              ]),
            ),
          ]),
        );
    final body = Gap(gap: 12, children: [
      step(0),
      step(1),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        decoration: BoxDecoration(color: a.deep, borderRadius: BorderRadius.circular(18)),
        child: DefaultTextStyle.merge(
          style: css(14, color: a.onDeep),
          child: Gap(gap: 6, children: [
            Opacity(opacity: 0.75, child: Text(pt('par_sos_say').toUpperCase(), style: css(11, weight: FontWeight.w800, em: 0.05, color: a.onDeep))),
            for (final t in c.say) Text(t),
          ]),
        ),
      ),
      step(2),
      if (c.byAge?[active] != null && c.byAge![active]!.isNotEmpty) _Box(tone: 'try', label: bandLabel(active), children: [Text(c.byAge![active]!)]),
      _Box(tone: 'warn', label: pt('par_sos_avoid'), children: [_Bullets(items: c.avoid, emergency: ctx.emergency)]),
    ]);
    return KeyedSubtree(
      key: ValueKey('par-sos-screen-${c.id}'),
      child: _Par(children: [
        if (c.bands.length > 1) _BandChips(value: active, bands: c.bands, onChange: (b) => setState(() => _band = b), segmented: true),
        _lead(context, c.moment),
        open ? body : _lock('parenting_sos', body),
        if (c.redFlag != null && c.redFlag!.isNotEmpty)
          _Box(tone: 'red', label: pt('par_sos_red'), children: [
            Text(fillEmergencyNumber(c.redFlag!, ctx.emergency)),
            if (_hasEmergency([c.redFlag])) _CallButton(emergency: ctx.emergency),
          ]),
        _SupportCard(kind: c.support, ctx: ctx),
        _ShareRow(ctx: ctx, item: ShareItem(kind: 'sos', id: c.id, emoji: c.emoji, title: c.title, summary: c.moment)),
        if (sources.isNotEmpty) _Sources(key: const ValueKey('par-sources'), sources: sources),
      ]),
    );
  }
}

// ── Programmes ───────────────────────────────────────────────────────────────────────────────
class ProgrammesScreen extends StatelessWidget {
  const ProgrammesScreen({super.key, required this.ctx});
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context) => _Par(children: [
        for (final p in ctx.content.programmes) _ParCard(children: [_ProgrammeRow(p: p, ctx: ctx, plain: true), Text(p.summary)]),
      ]);
}

/// A local calendar day ('YYYY-MM-DD') in the app language; the key itself when it cannot be formatted.
String formatParentingDay(String day, String locale) {
  final parts = day.split('-');
  final y = parts.isNotEmpty ? int.tryParse(parts[0]) : null;
  final m = parts.length > 1 ? int.tryParse(parts[1]) : null;
  final d = parts.length > 2 ? int.tryParse(parts[2]) : null;
  if (y == null || y == 0 || m == null || m == 0 || d == null || d == 0) return day;
  return localeDayMonthYear(DateTime(y, m, d), locale);
}

class ProgrammeScreen extends StatefulWidget {
  const ProgrammeScreen({super.key, required this.ctx, required this.id});
  final ParentingCtx ctx;
  final String id;
  @override
  State<ProgrammeScreen> createState() => _ProgrammeScreenState();
}

class _ProgrammeScreenState extends State<ProgrammeScreen> {
  int? _picked;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final a = context.a;
    Programme? x;
    for (final p in ctx.content.programmes) {
      if (p.id == widget.id) x = p;
    }
    if (x == null) return const SizedBox.shrink();
    final p = x;
    final prog = ctx.slot.programmes[p.id];
    final next = nextDayIndex(prog);
    final total = p.days.length;
    final finished = isFinished(prog, total);
    final sel = math.min(_picked ?? math.min(next, total - 1), total - 1);
    final day = p.days[sel];
    final locked = isDayLocked(sel, ctx.isPremium);
    void save(ProgrammeProgress? Function(ProgrammeProgress cur) fn) => ctx.updateSlot((slot) {
          final cur = slot.programmes[p.id] ?? startProgramme(ctx.today);
          final res = fn(cur);
          return identical(res, cur) ? slot : setProgrammeState(slot, p.id, res);
        });

    if (prog == null) {
      return _Par(children: [
        _lead(context, p.summary),
        for (final t in p.intro) _para(context, t),
        if (!ctx.isPremium) _small(context, pf('par_prog_free_days', {'n': freeProgrammeDays})),
        ParBtn(
          key: const ValueKey('par-prog-start'),
          label: pt('par_prog_start'),
          onTap: () {
            save((_) => startProgramme(ctx.today));
            ctx.track('programme_start_${p.id}');
          },
        ),
        _Sources(sources: p.sources),
      ]);
    }

    final doneToday = prog.done.isNotEmpty && prog.done.last == ctx.today;
    final canDo = sel == next && canCompleteToday(prog, total, ctx.today) && !locked && prog.paused != true;
    final task = Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Gap(gap: 6, children: [
        Text(pf('par_prog_day', {'n': sel + 1}).toUpperCase(), style: css(11.5, weight: FontWeight.w800, em: 0.05, color: a.coralText)),
        Text(day.title, style: css(17, weight: FontWeight.w800, height: 1.3, color: a.ink)),
        Text(day.task, style: css(13.5, height: 1.55, color: a.bodyText)),
        Text.rich(TextSpan(style: css(12.5, height: 1.55, color: a.inkSoft), children: [
          TextSpan(text: '${pt('par_prog_why')}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(text: day.why),
        ])),
        if (canDo)
          ParBtn(
            key: const ValueKey('par-prog-done'),
            label: pt('par_prog_done_today'),
            onTap: () {
              save((cur) => completeDay(cur, total, ctx.today));
              ctx.track('programme_day_${p.id}');
              setState(() => _picked = null);
            },
          ),
        if (sel == next && doneToday && !finished) _small(context, pt('par_prog_come_back')),
      ]),
    );

    return _Par(children: [
      if (prog.paused == true && !finished) Semantics(liveRegion: true, child: _small(context, pt('par_prog_paused'))),
      _Feature(
        leading: _ParRing(percent: progressPercent(prog, total), label: '${prog.done.length}/$total', size: 56),
        title: finished ? pt('par_prog_finished') : prog.done.isNotEmpty ? pt('par_prog_great') : p.title,
        sub: prog.done.isNotEmpty ? pf('par_prog_steps_done', {'n': prog.done.length}) : pt('par_prog_daily'),
      ),
      if (finished) _ProgrammeDone(ctx: ctx, p: p, prog: prog),
      Semantics(
        label: pt('par_prog_all_days'),
        container: true,
        child: Grid(columns: 7, gap: 6, children: [
          for (var i = 0; i < total; i++) _dayButton(context, i, prog, next, finished, sel),
        ]),
      ),
      locked
          ? _lock('parenting_programme', task, title: pt('par_prog_locked_title'), subtitle: ctx.content.programmes.map((x) => x.title).join(' · '), cta: pt('par_prog_unlock'))
          : task,
      if (!finished) _ReminderCard(ctx: ctx, paused: prog.paused == true, nextDay: next),
      WrapRow(gap: 8, children: [
        if (prog.done.isNotEmpty)
          ParBtn(key: const ValueKey('par-prog-undo'), label: pt('par_prog_undo'), ghost: true, small: true, onTap: () => save((cur) => undoLastDay(cur, ctx.today))),
        if (!finished)
          ParBtn(
            key: const ValueKey('par-prog-pause'),
            label: pt(prog.paused == true ? 'par_prog_resume' : 'par_prog_pause'),
            ghost: true,
            small: true,
            pressed: prog.paused == true,
            onTap: () {
              save((cur) => ProgrammeProgress(startedAt: cur.startedAt, done: cur.done, updatedAt: cur.updatedAt, paused: cur.paused == true ? null : true));
              ctx.track(prog.paused == true ? 'programme_resume' : 'programme_pause');
            },
          ),
        ParBtn(
          key: const ValueKey('par-prog-restart'),
          label: pt('par_prog_restart'),
          ghost: true,
          small: true,
          onTap: () {
            save((_) => null);
            setState(() => _picked = null);
          },
        ),
      ]),
      _Sources(sources: p.sources),
    ]);
  }

  Widget _dayButton(BuildContext context, int i, ProgrammeProgress prog, int next, bool finished, int sel) {
    final a = context.a;
    final ctx = widget.ctx;
    final done = i < prog.done.length;
    final now = i == next && !finished;
    final locked = isDayLocked(i, ctx.isPremium);
    final selected = i == sel;
    return Tap(
      key: ValueKey('par-day-$i'),
      label: pf('par_prog_day', {'n': i + 1}),
      pressed: selected,
      excludeSemantics: true,
      onTap: () => setState(() => _picked = i),
      child: Opacity(
        opacity: locked && !done ? 0.5 : 1,
        child: Transform.translate(
          offset: Offset(0, selected ? -2 : 0),
          child: Container(
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: done ? a.coral : a.surface,
              borderRadius: BorderRadius.circular(12),
              border: now ? Border.all(color: a.coral, width: 2) : null,
              boxShadow: selected ? a.liftShadow : a.cardShadow,
            ),
            child: Text('${i + 1}', style: css(12.5, weight: FontWeight.w800, color: done ? a.onCoral : now ? a.coralText : a.inkSoft)),
          ),
        ),
      ),
    );
  }
}

/// Finished programme: days done, the dates, and another programme for the band to try next.
class _ProgrammeDone extends StatelessWidget {
  const _ProgrammeDone({required this.ctx, required this.p, required this.prog});
  final ParentingCtx ctx;
  final Programme p;
  final ProgrammeProgress prog;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sum = programmeSummary(prog, p.days.length);
    final next = suggestNextProgramme<Programme>(ctx.content.programmes, ctx.slot.programmes, ctx.band, p.id,
        idOf: (x) => x.id, bandsOf: (x) => x.bands, daysOf: (x) => x.days.length);
    if (sum == null) return const SizedBox.shrink();
    final from = formatParentingDay(sum.from, ctx.locale);
    final to = formatParentingDay(sum.to, ctx.locale);
    return Container(
      key: const ValueKey('par-programme-summary'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(18)),
      child: Gap(gap: 4, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(pf('par_prog_summary_days', {'n': sum.days}), style: css(15, weight: FontWeight.w700, color: a.greenInk)),
        Text(from == to ? from : '$from – $to', style: css(12.5, weight: FontWeight.w700, color: a.greenInk)),
        if (next != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Gap(gap: 6, children: [
              Text(pt('par_prog_next_title').toUpperCase(), style: css(11, weight: FontWeight.w800, em: 0.04, color: a.greenInk)),
              _Feature(
                key: const ValueKey('par-programme-next'),
                leading: _emojiSquare(context, next.emoji),
                title: next.title,
                sub: '${pf('par_prog_days', {'n': next.days.length})} · ${pt('par_prog_next_open')}',
                onTap: () {
                  ctx.track('programme_next', next.id);
                  ctx.go(ParRoute('programme', id: next.id));
                },
              ),
            ]),
          ),
      ]),
    );
  }
}

/// Daily programme reminder on this phone: on/off and the time (free users for the free days, Premium for all).
class _ReminderCard extends StatefulWidget {
  const _ReminderCard({required this.ctx, required this.paused, required this.nextDay});
  final ParentingCtx ctx;
  final bool paused;
  final int nextDay;
  @override
  State<_ReminderCard> createState() => _ReminderCardState();
}

class _ReminderCardState extends State<_ReminderCard> {
  TextEditingController? _time;

  @override
  void dispose() {
    _time?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final a = context.a;
    final pref = ctx.local.reminder ?? const ReminderPref(on: false, time: defaultReminderTime);
    final allowed = ctx.reminderAllowed && canRemindDay(widget.nextDay, ctx.isPremium);
    final freeOnly = allowed && !ctx.isPremium;
    final on = allowed && pref.on;
    void set({bool? enabled, String? time}) =>
        ctx.updateLocal((s) => s.copyState(reminder: ReminderPref(on: enabled ?? pref.on, time: time ?? pref.time)));
    if (on) {
      _time ??= TextEditingController(text: pref.time);
    }
    return Container(
      key: const ValueKey('parenting-reminder'),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
      child: Gap(gap: 10, children: [
        Row(children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(12)),
            child: AIcon(AIcons.bell, size: 16, color: a.blueInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Gap(gap: 2, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(pt('par_reminder_title'), style: css(14, weight: FontWeight.w700, color: a.ink)),
              Text(allowed ? (widget.paused && on ? pt('par_reminder_paused') : pt('par_reminder_text')) : pt('par_reminder_premium'),
                  style: css(12, height: 1.4, color: a.inkSoft)),
              if (freeOnly) Text(pf('par_reminder_free', {'n': freeProgrammeDays}), style: css(12, height: 1.4, color: a.inkSoft)),
            ]),
          ),
          const SizedBox(width: 12),
          if (allowed)
            Semantics(
              toggled: on,
              label: pt('par_reminder_title'),
              button: true,
              excludeSemantics: true,
              child: GestureDetector(
                key: const ValueKey('par-reminder-switch'),
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  set(enabled: !pref.on);
                  ctx.track(pref.on ? 'reminder_off' : 'reminder_on');
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 46,
                  height: 28,
                  padding: const EdgeInsets.all(3),
                  alignment: on ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                  decoration: BoxDecoration(color: on ? a.coral : a.lineStrong, borderRadius: BorderRadius.circular(999)),
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFFFFF),
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: Color(0x40000000), offset: Offset(0, 1), blurRadius: 3)],
                    ),
                  ),
                ),
              ),
            )
          else
            _premiumBadge(),
        ]),
        if (on)
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 10, 8),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(pt('par_reminder_time'), style: css(13, weight: FontWeight.w700, color: a.inkSoft)),
              Container(
                width: 84,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(10)),
                child: Material(
                  type: MaterialType.transparency,
                  child: TextField(
                    key: const ValueKey('par-reminder-time'),
                    controller: _time,
                    keyboardType: TextInputType.datetime,
                    style: css(15, weight: FontWeight.w800, color: a.ink),
                    decoration: const InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 6)),
                    onChanged: (v) {
                      if (RegExp(r'^\d{2}:\d{2}$').hasMatch(v)) set(time: v);
                    },
                  ),
                ),
              ),
            ]),
          ),
      ]),
    );
  }
}

// ── Quizzes ──────────────────────────────────────────────────────────────────────────────────
class QuizScreen extends StatelessWidget {
  const QuizScreen({super.key, required this.ctx, required this.id});
  final ParentingCtx ctx;
  final String id;
  @override
  Widget build(BuildContext context) => id == 'style' ? _StyleQuizScreen(ctx: ctx) : _MilestoneQuizScreen(ctx: ctx);
}

class _QuizProgress extends StatelessWidget {
  const _QuizProgress({required this.n, required this.total});
  final int n;
  final int total;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Gap(gap: 6, children: [
      Text(pf('par_quiz_question', {'n': n, 'total': total}), style: css(12, weight: FontWeight.w700, color: a.inkSoft)),
      ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: Container(
          height: 6,
          color: a.line,
          alignment: AlignmentDirectional.centerStart,
          child: FractionallySizedBox(widthFactor: jsRound((n - 1) / total * 100) / 100, child: Container(color: a.coral)),
        ),
      ),
    ]);
  }
}

Widget _quizBack(VoidCallback onBack) => Align(
      alignment: AlignmentDirectional.centerStart,
      child: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: ParBtn(key: const ValueKey('par-quiz-back'), label: pt('par_quiz_prev'), ghost: true, small: true, icon: AIcons.chevronLeft, onTap: onBack),
      ),
    );

Widget _answers(BuildContext context, List<(String label, bool pressed, VoidCallback onTap)> items) {
  final a = context.a;
  return Gap(gap: 8, children: [
    for (final (i, it) in items.indexed)
      Tap(
        key: ValueKey('par-answer-$i'),
        label: it.$1,
        pressed: it.$2,
        excludeSemantics: true,
        onTap: it.$3,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          alignment: AlignmentDirectional.centerStart,
          decoration: BoxDecoration(
            color: it.$2 ? a.peach1 : a.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: it.$2 ? a.coral : a.lineStrong, width: 1.5),
          ),
          child: Text(it.$1, style: css(14, weight: FontWeight.w700, color: a.ink)),
        ),
      ),
  ]);
}

/// `.a-par-hero.is-soft` (+ `.is-warn`).
Widget _softHero(BuildContext context, String small, String title, String text, {bool warn = false}) {
  final a = context.a;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    decoration: BoxDecoration(color: warn ? a.yellow1 : a.peach1, borderRadius: BorderRadius.circular(24)),
    child: Gap(gap: 6, children: [
      Text(small.toUpperCase(), style: css(11.5, weight: FontWeight.w800, em: 0.05, color: warn ? a.warnInk : a.accentInk)),
      Text(title, style: css(19, weight: FontWeight.w800, height: 1.3, em: -0.01, color: a.ink)),
      Text(text, style: css(13.5, color: a.bodyText)),
    ]),
  );
}

class _StyleQuizScreen extends StatefulWidget {
  const _StyleQuizScreen({required this.ctx});
  final ParentingCtx ctx;
  @override
  State<_StyleQuizScreen> createState() => _StyleQuizScreenState();
}

class _StyleQuizScreenState extends State<_StyleQuizScreen> {
  QuizNav<int> _nav = startQuiz<int>();
  bool _started = false;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final q = ctx.content.styleQuiz!;
    final total = q.items.length;
    final done = quizDone(_nav, total);
    final dims = [for (final it in q.items) it.dim];
    final resultId = done ? styleResult(styleScores(dims, _nav.answers)) : null;

    void answer(int v) {
      final next = quizAnswer(_nav, v, total);
      setState(() => _nav = next);
      if (quizDone(next, total)) {
        final r = styleResult(styleScores(dims, next.answers));
        ctx.updateSlot((slot) => slot.copyWith(quizzes: {...slot.quizzes, 'style': (at: ctx.today, result: r)}));
        ctx.track('quiz_style_done');
      }
    }

    if (!_started) {
      return _Par(children: [
        _title(context, '${q.emoji} ${q.title}'),
        _lead(context, q.intro),
        ParBtn(key: const ValueKey('par-quiz-start'), label: pt('par_quiz_start'), onTap: () => setState(() => _started = true)),
        _small(context, q.note),
      ]);
    }
    if (!done || resultId == null) {
      final i = _nav.pos;
      return _Par(children: [
        _QuizProgress(n: i + 1, total: total),
        _ParCard(children: [_cardH3(context, q.items[i].text)]),
        _answers(context, [
          for (final (v, label) in q.scale.indexed) (label, i < _nav.answers.length && _nav.answers[i] == v, () => answer(v)),
        ]),
        if (i > 0) _quizBack(() => setState(() => _nav = quizBack(_nav))),
      ]);
    }
    final r = q.results[resultId]!;
    final detail = _ParCard(children: [
      _cardH3(context, pt('par_quiz_detail')),
      for (final t in r.detail) Text(t),
      _Bullets(items: r.next, emergency: ctx.emergency, color: context.a.bodyText),
    ]);
    return _Par(children: [
      _softHero(context, pt('par_quiz_result'), r.title, r.short),
      ctx.isPremium ? detail : _lock('parenting_quiz', detail),
      ParBtn(
        key: const ValueKey('par-quiz-retake'),
        label: pt('par_quiz_retake'),
        ghost: true,
        onTap: () => setState(() {
          _nav = startQuiz<int>();
          _started = true;
        }),
      ),
      _small(context, q.note),
      _Sources(sources: q.sources),
    ]);
  }
}

class _MilestoneQuizScreen extends StatefulWidget {
  const _MilestoneQuizScreen({required this.ctx});
  final ParentingCtx ctx;
  @override
  State<_MilestoneQuizScreen> createState() => _MilestoneQuizScreenState();
}

class _MilestoneQuizScreenState extends State<_MilestoneQuizScreen> {
  QuizNav<String> _nav = startQuiz<String>();
  bool _started = false;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final a = context.a;
    final q = ctx.content.milestoneQuiz!;
    final months = _milestoneMonthsOf(ctx);
    final cp = checkpointFor(q.checkpoints, months ?? _bandMonths[ctx.band])!;
    final total = cp.items.length + 1;
    final earlyFrom = tooEarlyForMilestones(q.checkpoints, months);
    final corrected = ctx.milestoneCorrected && months != null
        ? _small(context, pf('par_milestone_corrected', {'n': months}), key: const ValueKey('par-milestone-corrected'))
        : null;

    if (!milestoneCheckOffered(q.checkpoints, months, ctx.band)) {
      // No checkpoint after 6 years: older children (or the 6–12 band without a birth date) get a short note.
      return _Par(key: const ValueKey('par-milestone-late'), children: [
        _title(context, '${q.emoji} ${q.title}'),
        _lead(context, pf('par_milestone_late', {'n': jsRoundInt((milestoneCheckEnd(q.checkpoints) ?? 84) / 12)})),
        _small(context, q.note),
      ]);
    }
    if (earlyFrom != null) {
      // Newborns: a "not yet" on a 4-month red flag is normal, so the check is not offered before the first checkpoint.
      return _Par(key: const ValueKey('par-milestone-early'), children: [
        _title(context, '${q.emoji} ${q.title}'),
        _lead(context, pf('par_milestone_early', {'n': earlyFrom})),
        ?corrected,
        _small(context, q.note),
      ]);
    }

    List<String?> itemAnswers(QuizNav<String> nav) => [for (var i = 0; i < cp.items.length; i++) i < nav.answers.length ? nav.answers[i] : null];
    String? regression(QuizNav<String> nav) => cp.items.length < nav.answers.length ? nav.answers[cp.items.length] : null;

    void answer(String v) {
      final next = quizAnswer(_nav, v, total);
      setState(() => _nav = next);
      if (quizDone(next, total)) {
        final r = milestoneResult(cp, itemAnswers(next), regression(next));
        ctx.updateSlot((slot) => slot.copyWith(quizzes: {...slot.quizzes, 'milestones': (at: ctx.today, result: r.id)}));
        ctx.track('quiz_milestones_done');
      }
    }

    if (!_started) {
      return _Par(children: [
        _title(context, '${q.emoji} ${q.title}'),
        _meta(context, cp.title),
        ?corrected,
        _lead(context, q.intro),
        ParBtn(key: const ValueKey('par-quiz-start'), label: pt('par_quiz_start'), onTap: () => setState(() => _started = true)),
        _small(context, q.note),
      ]);
    }
    if (_nav.pos < cp.items.length) {
      final i = _nav.pos;
      final cur = i < _nav.answers.length ? _nav.answers[i] : null;
      return _Par(children: [
        _QuizProgress(n: i + 1, total: total),
        _meta(context, cp.title),
        _ParCard(children: [_cardH3(context, cp.items[i].text)]),
        _answers(context, [for (final k in const ['yes', 'no', 'unsure']) (q.answers[k] ?? k, cur == k, () => answer(k))]),
        if (i > 0) _quizBack(() => setState(() => _nav = quizBack(_nav))),
      ]);
    }
    if (!quizDone(_nav, total)) {
      final reg = regression(_nav);
      return _Par(children: [
        _QuizProgress(n: total, total: total),
        _ParCard(children: [_cardH3(context, q.regression)]),
        _answers(context, [(q.answers['yes'] ?? 'yes', reg == 'yes', () => answer('yes')), (q.answers['no'] ?? 'no', reg == 'no', () => answer('no'))]),
        _quizBack(() => setState(() => _nav = quizBack(_nav))),
      ]);
    }
    final res = milestoneResult(cp, itemAnswers(_nav), regression(_nav));
    final r = q.results[res.id]!;
    final support = _ParCard(children: [
      _cardH3(context, pt('par_quiz_support')),
      Gap(gap: 6, children: [
        for (final i in res.notYet)
          Text.rich(TextSpan(style: css(13.5, color: a.bodyText), children: [
            const TextSpan(text: '•  '),
            TextSpan(text: cp.items[i].text, style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: ' ${cp.items[i].support}'),
          ])),
      ]),
    ]);
    return _Par(children: [
      _softHero(context, '${pt('par_quiz_result')} · ${cp.title}', r.title, r.short, warn: res.id == 'talk'),
      // Safety first: the "talk to a doctor" result and the flagged items are free for everyone.
      if (res.id == 'talk' || res.id == 'watch')
        _Box(tone: 'warn', label: '⚠️ ${pt('par_h_specialist')}', children: [
          for (final t in r.detail) Text(t),
          if (res.flagged.isNotEmpty) _Bullets(items: [for (final i in res.flagged) cp.items[i].text], emergency: ctx.emergency),
        ]),
      if (res.id == 'ontrack') _ParCard(children: [for (final t in r.detail) Text(t)]),
      if (res.notYet.isNotEmpty) ctx.isPremium ? support : _lock('parenting_quiz', support),
      ParBtn(key: const ValueKey('par-quiz-retake'), label: pt('par_quiz_retake'), ghost: true, onTap: () => setState(() => _nav = startQuiz<String>())),
      _small(context, q.note),
      _Sources(sources: q.sources),
    ]);
  }
}

// ── Saved ────────────────────────────────────────────────────────────────────────────────────
class SavedScreen extends StatelessWidget {
  const SavedScreen({super.key, required this.ctx});
  final ParentingCtx ctx;
  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (final ref in ctx.local.saved) {
      final i = ref.indexOf(':');
      final kind = ref.substring(0, i), id = ref.substring(i + 1);
      if (kind == 'a') {
        for (final x in ctx.content.articles) {
          if (x.id == id) items.add(_ArticleRow(article: x, ctx: ctx));
        }
        continue;
      }
      for (final c in ctx.content.sos) {
        if (c.id == id) items.add(_Row(key: ValueKey('par-saved-sos-$id'), emoji: c.emoji, title: c.title, sub: c.moment, onTap: () => ctx.go(ParRoute('sos', id: c.id))));
      }
    }
    return _Par(children: items.isNotEmpty ? items : [_small(context, pt('par_saved_empty'))]);
  }
}

/// The bookmark ref of a route (`a:id` / `s:id`).
String? savedRef(ParRoute route) => route.s == 'article' ? 'a:${route.id}' : route.s == 'sos' ? 's:${route.id}' : null;
