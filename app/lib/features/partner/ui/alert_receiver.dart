// Ported from: src/components/partner/v2/AlertReceiver.tsx, src/pages/Index.tsx (mounted for both linked roles:
//              `profile?.linked_partner_id && <AlertReceiver isPartner={role === 'partner'} onHospitalRun />`)
//
// Universal SOS / birth alert receiver: a full-screen alert over everything (React z-200) for the unacknowledged
// alert addressed to the user. birth → birth screen (+ "Hospital mode" for the partner), emergency → SOS screen.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/shell_inputs.dart' show shellPlatformProvider;
import '../../baby/locale_format.dart' show localeTimeHm;
import '../data/partner_backend.dart';
import '../data/sos_alert.dart';
import '../partner_ports.dart';
import 'partner_ui.dart';

/// `window.open(url, '_blank')` for the alert's map link.
final alertMapsOpenerProvider = Provider<Future<void> Function(Uri url)>((ref) => (url) async {
      await ref.read(shellPlatformProvider).openExternalUrl(url);
    });

const Color _white = Color(0xFFFFFFFF);

class AlertReceiver extends ConsumerWidget {
  const AlertReceiver({super.key, required this.isPartner, this.onHospitalRun});
  final bool isPartner;
  final VoidCallback? onHospitalRun;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(sosAlertProvider.select((s) => s.pendingAlert));
    if (pending == null) return const SizedBox.shrink();
    final a = context.a;
    final controller = ref.read(sosAlertProvider.notifier);
    final isBirth = pending.alertType == 'birth';
    final hasLocation = pending.latitude != null && pending.longitude != null;
    final created = DateTime.tryParse(pending.createdAt);
    final timeStr = created == null ? 'Invalid Date' : localeTimeHm(created.toLocal());
    final padding = MediaQuery.paddingOf(context);

    Future<void> sendOnMyWay() async {
      await quietly(ref.read(partnerHapticsProvider).medium);
      final userId = ref.read(authUserProvider)?.id;
      if (userId == null) return;
      try {
        await ref.read(partnerBackendProvider).insert('partner_messages', {
          'sender_id': userId,
          'receiver_id': pending.senderId,
          'message_type': 'text',
          'content': tr('partnerv2_yoldayam_msg', 'Yoldayam! 🚗 Tezliklə çatıram!'),
        });
      } catch (error) {
        debugPrint('$error');
      }
    }

    Widget button({required Key key, required VoidCallback onTap, required Widget child, required Color background, double height = 50, Color color = _white, List<BoxShadow>? shadow, double fontSize = 14}) =>
        GestureDetector(
          key: key,
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            height: height,
            decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999), boxShadow: shadow),
            alignment: Alignment.center,
            child: DefaultTextStyle.merge(
              style: pText(fontSize, weight: FontWeight.w700, color: color),
              child: IconTheme.merge(data: IconThemeData(color: color), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [child])),
            ),
          ),
        );

    return AScope(
      child: Container(
        key: const ValueKey('alert-receiver'),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            // 165deg; #f2764f / #e0526e are one-off literals of AlertReceiver.tsx
            begin: const Alignment(-0.26, -1),
            end: const Alignment(0.26, 1),
            colors: isBirth ? [const Color(0xFFF2764F), const Color(0xFFE0526E), a.pinkInk] : [const Color(0xFFE0526E), a.pinkInk, a.alertInk],
            stops: const [0, 0.6, 1],
          ),
        ),
        padding: EdgeInsets.fromLTRB(24, 24 + padding.top, 24, padding.bottom + 24),
        alignment: Alignment.center,
        child: SingleChildScrollView(
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: _white),
            textAlign: TextAlign.center,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _Pulse(
                child: Container(
                  width: 112,
                  height: 112,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _white.withValues(alpha: 0.22),
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: _white.withValues(alpha: 0.08), spreadRadius: 18)],
                  ),
                  child: AIcon(isBirth ? AIcons.baby : AIcons.siren, size: 56, color: _white),
                ),
              ),
              const SizedBox(height: 24),
              Text(isBirth ? tr('partnerv2_dogus_basladi_receiver', 'DOĞUŞ BAŞLADI!') : tr('partnerv2_sos_receiver', 'TƏCİLİ XƏBƏRDARLIQ!'),
                  style: pText(30, weight: FontWeight.w900, color: _white, ls: -0.02)),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Text(pending.message ?? '', style: pText(15.5, color: _white.withValues(alpha: 0.92), height: 1.45)),
              ),
              const SizedBox(height: 8),
              Text(timeStr, style: pText(12, color: _white.withValues(alpha: 0.7))),
              const SizedBox(height: 32),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 384),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  // Partner: hospital mode at birth.
                  if (isBirth && isPartner && onHospitalRun != null) ...[
                    button(
                      key: const ValueKey('alert-hospital-run'),
                      onTap: () {
                        unawaited(controller.acknowledgeAlert(pending.id));
                        onHospitalRun!();
                      },
                      height: 56,
                      background: _white,
                      // #b1275b on the fixed alert background, independent of the theme
                      color: const Color(0xFFB1275B),
                      fontSize: 15.5,
                      shadow: const [BoxShadow(color: Color(0x66000000), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -12)],
                      child: Flexible(
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const AIcon(AIcons.car, size: 20, color: Color(0xFFB1275B)),
                          const SizedBox(width: 8),
                          Flexible(child: Text(tr('partnerv2_xestexana_rejimi_btn', 'Xəstəxana rejimi — YOLA DÜŞ!'))),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (hasLocation) ...[
                    button(
                      key: const ValueKey('alert-maps'),
                      onTap: () => unawaited(ref.read(alertMapsOpenerProvider)(Uri.parse('https://maps.google.com/?q=${pending.latitude},${pending.longitude}'))),
                      background: _white.withValues(alpha: 0.22),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.mapPin, size: 18, color: _white),
                        const SizedBox(width: 8),
                        Text(tr('partnerv2_lokasiyaya_get', 'Lokasiyaya get')),
                      ]),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (isPartner) ...[
                    button(
                      key: const ValueKey('alert-on-my-way'),
                      onTap: () => unawaited(sendOnMyWay()),
                      background: _white.withValues(alpha: 0.16),
                      child: Flexible(child: Text('🚗 ${tr('partnerv2_yoldayam_btn', 'Yoldayam — xəbər ver')}')),
                    ),
                    const SizedBox(height: 12),
                  ],
                  button(
                    key: const ValueKey('alert-ack'),
                    onTap: () => unawaited(controller.acknowledgeAlert(pending.id)),
                    background: const Color(0x2E000000),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AIcon(AIcons.check, size: 18, color: _white),
                      const SizedBox(width: 8),
                      Text(tr('partnerv2_gordum_btn', 'Gördüm')),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// framer `animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.1, repeat: 4 }}`.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  int _runs = 0;

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed && _runs < 4) {
        _runs++;
        _c.forward(from: 0);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && _runs == 0 && !_c.isAnimating) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) => Transform.scale(scale: 1 + 0.08 * (1 - (2 * _c.value - 1).abs()), child: child),
        child: widget.child,
      );
}

/// Index: `{profile?.linked_partner_id && <AlertReceiver isPartner={role === 'partner'} onHospitalRun />}` as a frame
/// overlay drawn in the navigator's overlay (above the bottom nav).
class AlertReceiverHost extends ConsumerStatefulWidget {
  const AlertReceiverHost({super.key, required this.isPartner, required this.onHospitalRun});
  final bool Function(WidgetRef ref) isPartner;
  final void Function(WidgetRef ref) onHospitalRun;

  @override
  ConsumerState<AlertReceiverHost> createState() => _AlertReceiverHostState();
}

class _AlertReceiverHostState extends ConsumerState<AlertReceiverHost> {
  final OverlayPortalController _portal = OverlayPortalController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _portal.show();
    });
  }

  @override
  Widget build(BuildContext context) {
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => Consumer(builder: (context, ref, _) {
        final linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
        if (linked == null || linked.isEmpty) return const SizedBox.shrink();
        final pending = ref.watch(sosAlertProvider.select((s) => s.pendingAlert));
        if (pending == null) return const SizedBox.shrink();
        return Positioned.fill(child: AlertReceiver(isPartner: widget.isPartner(ref), onHospitalRun: () => widget.onHospitalRun(ref)));
      }),
      child: const SizedBox.shrink(),
    );
  }
}
