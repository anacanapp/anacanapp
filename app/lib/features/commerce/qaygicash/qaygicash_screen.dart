// Ported from: src/components/qaygicash/QaygiCashScreen.tsx, src/components/qaygicash/qaygicash.css (.qc-card,
//              .qc-pill, .qc-stats, .qc-note, .qc-rates, .qc-tx, .qc-faq)
//
// QayğıCash wallet: balance, how you earn, history and the rules.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../shell/shell.dart' show PushNavIntent, shellProvider;
import '../common/commerce_ui.dart';
import 'qaygicash.dart';
import 'qaygicash_copy.dart';
import 'qaygicash_hooks.dart';
import 'qaygicash_premium.dart';
import 'qc_parts.dart';

const List<String> _rateOrder = ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop'];
const List<(String, String)> _faq = [
  ('qc_faq_what_q', 'qc_faq_what_a'), ('qc_faq_earn_q', 'qc_faq_earn_a'), ('qc_faq_when_q', 'qc_faq_when_a'), //
  ('qc_faq_where_q', 'qc_faq_where_a'), ('qc_faq_expiry_q', 'qc_faq_expiry_a'), ('qc_faq_cash_q', 'qc_faq_cash_a'),
  ('qc_faq_refund_q', 'qc_faq_refund_a'), ('qc_faq_delete_q', 'qc_faq_delete_a'),
];

class QaygiCashScreen extends ConsumerStatefulWidget {
  const QaygiCashScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<QaygiCashScreen> createState() => _QaygiCashScreenState();
}

class _QaygiCashScreenState extends ConsumerState<QaygiCashScreen> {
  final GlobalKey _rulesKey = GlobalKey();
  bool _viewed = false;

  void _scrollToRules() {
    final ctx = _rulesKey.currentContext;
    if (ctx != null) unawaited(Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: ACurves.cssEase));
  }

  Widget _shell(BuildContext context, bool enabled, List<Widget> children) {
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              A3TopBar(
                title: qcBrand,
                onBack: widget.onBack,
                actions: [if (enabled) A3IconButton(icon: AIcons.circleHelp, solid: true, label: qt('qc_rules'), onTap: _scrollToRules)],
              ),
              ...children,
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(qcWalletProvider);
    final wallet = view.wallet;
    final history = ref.watch(qcHistoryQuery);
    final language = qcLanguage(ref);
    final a = context.a;
    final qc = QcColors.of(context);

    if (view.enabled && !_viewed && wallet != null) {
      _viewed = true;
      qcTrack(ref, 'qc_wallet_view', {'status': wallet.status, 'available_minor': wallet.availableMinor, 'pending_minor': wallet.pendingMinor});
    }

    if (view.isLoading) {
      return _shell(context, false, [Opacity(opacity: 0.55, child: Container(height: 190, decoration: _cardDecoration(qc)))]);
    }
    if (wallet == null) {
      return _shell(context, false, [
        if (view.isError)
          _QcNote(
            info: true,
            child: Column(
              children: [
                Text(qt('qc_load_error')),
                const SizedBox(height: 10),
                APillButton(label: qt('qc_retry'), onTap: view.refetch, minHeight: 40),
              ],
            ),
          ),
      ]);
    }

    final live = wallet.status == 'live';
    final canSpend = live && wallet.redeemChannels.contains('aptek') && wallet.availableMinor >= wallet.minRedeemMinor;
    final platform = ref.watch(commercePlatformProvider);
    final premiumPlans = [
      for (final plan in const ['yearly', 'monthly'])
        if (premiumRedeemOption(wallet, plan, platform) != null) plan,
    ];
    final items = history.data ?? const <QcHistoryItem>[];
    final historyLoading = history.isLoading && view.enabled;

    return _shell(context, true, [
      _WalletCard(
        wallet: wallet,
        language: language,
        canSpend: canSpend,
        onSpend: () => ref.read(shellProvider.notifier).dispatchPushEvent(const PushNavIntent(screen: 'aptek')),
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Expanded(
            child: _Stat(value: formatQc(wallet.availableMinor, language), label: qt('qc_stat_available'), color: a.ink),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _Stat(value: formatQc(wallet.pendingMinor, language), label: qt('qc_stat_pending'), color: qc.amberInk),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _Stat(value: formatQc(wallet.expiring30dMinor, language), label: qt('qc_stat_expiring'), color: a.coralText),
          ),
        ],
      ),
      if (wallet.nextExpiryAt != null)
        Padding(
          padding: const EdgeInsets.only(top: 8, left: 4, right: 4),
          child: Text(qf('qc_next_expiry', {'date': formatQcDate(wallet.nextExpiryAt!, language)}), style: context.aText.a3Meta),
        ),
      if (!live)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: _QcNote(key: const ValueKey('qc-paused'), child: Text(qt('qc_paused_note'))),
        ),
      if (wallet.debtMinor > 0)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: _QcNote(key: const ValueKey('qc-debt'), info: true, child: Text(qf('qc_debt_note', {'amount': formatQc(wallet.debtMinor, language)}))),
        ),
      _Rates(wallet: wallet, language: language, onRules: _scrollToRules),
      if (premiumPlans.isNotEmpty)
        ASection(
          title: qt('qc_prem_title'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [for (final plan in premiumPlans) QaygiCashPremiumOption(plan: plan)],
          ),
        ),
      ASection(
        title: qt('qc_history_title'),
        child: A3Card(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: historyLoading
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 2),
                  child: Text('…', style: context.aText.a3Meta),
                )
              : items.isNotEmpty
              ? A3Divided(
                  children: [for (final item in items) _HistoryRow(item: item, language: language)],
                )
              : Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 2),
                  child: Text(qt('qc_history_empty'), style: context.aText.a3Meta),
                ),
        ),
      ),
      ASection(
        key: _rulesKey,
        title: qt('qc_rules'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            A3Card(
              key: const ValueKey('qc-faq'),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              child: A3Divided(
                children: [
                  for (var i = 0; i < _faq.length; i++)
                    _FaqItem(question: qt(_faq[i].$1), answer: _faqAnswer(_faq[i].$2, wallet, language), initiallyOpen: i < 2),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(qf('qc_terms_version', {'n': wallet.termsVersion}), textAlign: TextAlign.center, style: context.aText.a3Meta),
          ],
        ),
      ),
    ]);
  }
}

String _faqAnswer(String key, QcWallet wallet, String language) {
  switch (key) {
    case 'qc_faq_when_a':
      return qf(key, {'physical': wallet.holdDaysPhysical, 'digital': wallet.holdDaysDigital});
    case 'qc_faq_where_a':
      return qf(key, {'pct': formatRate(wallet.maxRedeemPct * 100, language), 'min': formatQc(wallet.minRedeemMinor, language)});
    case 'qc_faq_expiry_a':
      return qf(key, {'months': wallet.expiryMonths});
    default:
      return qt(key);
  }
}

/// `.qc-card` background: radial c3 at the top end over a c1 → c2 diagonal.
BoxDecoration _cardDecoration(QcColors qc, {double radius = 26}) => BoxDecoration(
  borderRadius: BorderRadius.circular(radius),
  boxShadow: qc.cardShadow,
  gradient: LinearGradient(begin: const Alignment(-0.8, -1), end: const Alignment(0.8, 1), colors: [qc.c1, qc.c2]),
);

/// The balance card (wallet screen) — also the compact profile entry.
class QcBalanceCard extends StatelessWidget {
  const QcBalanceCard({super.key, required this.wallet, required this.language, required this.children, this.compact = false});
  final QcWallet wallet;
  final String language;
  final List<Widget> children;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final qc = QcColors.of(context);
    const white = Color(0xFFFFFFFF);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: _cardDecoration(qc, radius: compact ? 22 : 26),
      child: Stack(
        children: [
          // radial-gradient(120% 140% at 100% 0%, var(--qc-3) 0%, transparent 55%)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: AlignmentDirectional.topEnd.resolve(Directionality.of(context)),
                  radius: 1.1,
                  colors: [qc.c3, qc.c3.withValues(alpha: 0)],
                  stops: const [0, 0.55],
                ),
              ),
            ),
          ),
          // ::after rings: 180px circle at end -38 / bottom -52.
          PositionedDirectional(
            end: -38,
            bottom: -52,
            child: CustomPaint(size: const Size(180, 180), painter: _RingsPainter()),
          ),
          PositionedDirectional(
            top: compact ? 13 : 16,
            end: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: const Color(0x24000000), borderRadius: BorderRadius.circular(999)),
              child: Text(
                '${wallet.country} · ${wallet.currency}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: white),
              ),
            ),
          ),
          Padding(
            padding: compact ? const EdgeInsets.fromLTRB(16, 14, 16, 13) : const EdgeInsets.fromLTRB(18, 18, 18, 16),
            child: DefaultTextStyle.merge(
              style: const TextStyle(color: white),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      QcCoin(),
                      SizedBox(width: 8),
                      Text(qcBrand, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                    ],
                  ),
                  SizedBox(height: compact ? 10 : 14),
                  Text(
                    formatQc(wallet.availableMinor, language),
                    key: compact ? null : const ValueKey('qc-available'),
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: compact ? 32 : 44,
                      letterSpacing: -0.03 * (compact ? 32 : 44),
                      height: 1,
                      fontFeatures: tabularFigures,
                    ),
                  ),
                  SizedBox(height: compact ? 2 : 4),
                  Opacity(
                    opacity: 0.92,
                    child: Text(qt('qc_balance_ready'), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                  ...children,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RingsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color.fromRGBO(255, 255, 255, 0.16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final c = size.center(Offset.zero);
    for (var r = 1.0; r < size.width / 2 * math.sqrt2; r += 14) {
      canvas.save();
      canvas.clipRect(Offset.zero & size);
      canvas.drawCircle(c, r, paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) => false;
}

class _WalletCard extends StatelessWidget {
  const _WalletCard({required this.wallet, required this.language, required this.canSpend, required this.onSpend});
  final QcWallet wallet;
  final String language;
  final bool canSpend;
  final VoidCallback onSpend;

  @override
  Widget build(BuildContext context) {
    Widget pill(String text, {AIconData? icon}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[AIcon(icon, size: 13, color: const Color(0xFFFFFFFF)), const SizedBox(width: 6)],
          Text(
            text,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF), fontFeatures: tabularFigures),
          ),
        ],
      ),
    );
    final pills = <Widget>[
      if (wallet.pendingMinor > 0) pill(qf('qc_pending_pill', {'amount': formatQc(wallet.pendingMinor, language)}), icon: AIcons.hourglass),
      if (wallet.expiring30dMinor > 0) pill(qf('qc_expiring_pill', {'amount': formatQc(wallet.expiring30dMinor, language)})),
      if (canSpend)
        PressScale.css(
          onTap: onSpend,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: const Color(0xFFFFFFFF), borderRadius: BorderRadius.circular(999)),
            // .qc-pill.solid { color: #d93a40 } (qaygicash.css literal)
            child: Text(
              qt('qc_spend'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFD93A40)),
            ),
          ),
        ),
    ];
    return KeyedSubtree(
      key: const ValueKey('qc-wallet-card'),
      child: QcBalanceCard(
        wallet: wallet,
        language: language,
        children: [
          if (pills.isNotEmpty) ...[const SizedBox(height: 14), Wrap(spacing: 8, runSpacing: 8, children: pills)],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.color});
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color, fontFeatures: tabularFigures),
          ),
          Text(
            label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft),
          ),
        ],
      ),
    );
  }
}

class _QcNote extends StatelessWidget {
  const _QcNote({super.key, required this.child, this.info = false});
  final Widget child;
  final bool info;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final qc = QcColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: info ? a.surface : qc.amber, borderRadius: BorderRadius.circular(16), boxShadow: info ? a.cardShadow : null),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, height: 1.45, color: info ? a.inkSoft : qc.amberInk),
        child: child,
      ),
    );
  }
}

class _Rates extends StatelessWidget {
  const _Rates({required this.wallet, required this.language, required this.onRules});
  final QcWallet wallet;
  final String language;
  final VoidCallback onRules;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final qc = QcColors.of(context);
    final rows = [
      for (final c in _rateOrder)
        if ((wallet.rates[c] ?? 0) > 0) c,
    ];
    Widget row(String label, double? fill, String value, {bool none = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            flex: 125,
            child: Text(
              label,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 100,
            child: Container(
              height: 8,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(99)),
              alignment: AlignmentDirectional.centerStart,
              child: fill == null
                  ? null
                  : FractionallySizedBox(
                      widthFactor: fill,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(99),
                          gradient: LinearGradient(colors: [qc.c1, qc.c2]),
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 40),
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: none
                  ? TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.inkSoft)
                  : TextStyle(fontWeight: FontWeight.w900, color: a.ink, fontFeatures: tabularFigures),
            ),
          ),
        ],
      ),
    );
    return ASection(
      title: qt('qc_how_title'),
      linkLabel: qt('qc_rules'),
      onLink: onRules,
      child: A3Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Column(
              key: const ValueKey('qc-rates'),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final c in rows) row(qt('qc_rate_$c'), math.min(100, wallet.rates[c]! / 5) / 100, formatRate(wallet.rates[c]!, language)),
                row(qt('qc_rate_partner'), null, qt('qc_no_bonus'), none: true),
              ],
            ),
            Text(qt('qc_rates_note'), style: context.aText.a3Meta.copyWith(fontSize: 11.5)),
          ],
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item, required this.language});
  final QcHistoryItem item;
  final String language;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final qc = QcColors.of(context);
    final tone = historyTone(type: item.type, status: item.status);
    final earn = item.type == 'earn';
    final status = qk(historyStatusKey(type: item.type, status: item.status), {
      'date': item.availableAt != null ? formatQcDate(item.availableAt!, language) : '',
    });
    final meta = [
      formatQcDate(item.at, language),
      if (earn && item.rateBp != null && item.rateBp != 0) formatRate(item.rateBp!, language),
      if (earn && tone == 'available' && item.remainingMinor != null && item.remainingMinor! < item.amountMinor)
        qf('qc_left', {'amount': formatQc(item.remainingMinor!, language)}),
    ].where((s) => s.isNotEmpty).join(' · ');
    final (Color icBg, Color icFg, Color valFg) = switch (tone) {
      'available' => (qc.mint, qc.mintInk, qc.mintInk),
      'pending' => (qc.amber, qc.amberInk, qc.amberInk),
      'used' => (qc.sky, qc.skyInk, qc.skyInk),
      _ => (a.surfaceSoft, a.inkSoft, a.inkFaint),
    };
    return Semantics(
      key: ValueKey('qc-tx-${item.id}'),
      value: tone,
      child: KeyedSubtree(
        key: ValueKey('qc-tx:$tone'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: icBg, borderRadius: BorderRadius.circular(13)),
                child: Text(
                  earn ? '+' : '−',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: icFg),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      qk(historyTitleKey(type: item.type, channel: item.channel, sourceType: item.sourceType)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: a.ink),
                    ),
                    Text(
                      meta,
                      style: TextStyle(fontSize: 11.5, color: a.inkSoft, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatQcSigned(earn ? item.amountMinor : -item.amountMinor, language),
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: valFg,
                      fontFeatures: tabularFigures,
                      decoration: tone == 'gone' ? TextDecoration.lineThrough : null,
                      decorationColor: valFg,
                    ),
                  ),
                  Text(
                    status,
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: valFg),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `<details><summary>q</summary><p>a</p></details>`.
class _FaqItem extends StatefulWidget {
  const _FaqItem({required this.question, required this.answer, required this.initiallyOpen});
  final String question;
  final String answer;
  final bool initiallyOpen;

  @override
  State<_FaqItem> createState() => _FaqItemState();
}

class _FaqItemState extends State<_FaqItem> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: _open,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _open = !_open),
              child: Text(
                '${_open ? '▾' : '▸'} ${widget.question}',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: a.ink),
              ),
            ),
          ),
          // A closed <details> keeps its text in the document; Offstage keeps it in the tree.
          Offstage(
            offstage: !_open,
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(widget.answer, style: TextStyle(fontSize: 13, height: 1.5, color: a.inkSoft)),
            ),
          ),
        ],
      ),
    );
  }
}
