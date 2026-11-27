// Ported from: src/components/partner/v2/PartnerNotificationsScreen.tsx
//
// Partner push choices (both roles). The push service skips a disabled type through
// claim_communication_notification_v2; SOS and birth alerts cannot be turned off.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ATopbar, ShadSwitch, toasts;
import '../data/partner_backend.dart';
import '../partner_copy.dart';
import 'partner_ui.dart';

/// `PrefKey`s in display order with their copy keys and tints.
const List<(String, String, String)> kPartnerPushRows = [
  ('push_messages', 'pn_messages', 'pn_messages_sub'),
  ('push_partner_thanks', 'pn_thanks', 'pn_thanks_sub'),
  ('push_partner_shopping', 'pn_shopping', 'pn_shopping_sub'),
  ('push_partner_contractions', 'pn_contractions', 'pn_contractions_sub'),
];

const Map<String, bool> kPartnerPushDefaults = {
  'push_messages': true,
  'push_partner_thanks': true,
  'push_partner_shopping': true,
  'push_partner_contractions': true,
};

class PartnerNotificationsScreen extends ConsumerStatefulWidget {
  const PartnerNotificationsScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnerNotificationsScreen> createState() => _PartnerNotificationsScreenState();
}

class _PartnerNotificationsScreenState extends ConsumerState<PartnerNotificationsScreen> {
  Map<String, bool> _prefs = Map.of(kPartnerPushDefaults);
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final userId = ref.read(authUserProvider)?.id;
    if (userId == null) return;
    Map<String, dynamic>? data;
    try {
      data = await ref.read(partnerBackendProvider).maybeSingle('user_preferences', kPartnerPushDefaults.keys.join(', '), 'user_id', userId);
    } catch (_) {
      data = null;
    }
    if (!mounted) return;
    setState(() {
      if (data != null) {
        for (final row in kPartnerPushRows) {
          if (data[row.$1] is bool) _prefs[row.$1] = data[row.$1] as bool;
        }
      }
      _loading = false;
    });
  }

  Future<void> _save(String key, bool value) async {
    final userId = ref.read(authUserProvider)?.id;
    if (userId == null) return;
    final toast = toasts(context);
    setState(() => _prefs = {..._prefs, key: value});
    try {
      await ref.read(partnerBackendProvider).upsert('user_preferences', {'user_id': userId, key: value}, onConflict: 'user_id');
    } catch (_) {
      if (!mounted) return;
      setState(() => _prefs = {..._prefs, key: !value});
      toast.show(title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), description: tr('partnerv2_sh_xeta_sub', 'Yenidən cəhd edin.'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final tints = <String, (AIconData, Color, Color)>{
      'push_messages': (AIcons.messageCircle, a.blue1, a.blueInk),
      'push_partner_thanks': (AIcons.handHeart, a.pink1, a.pinkInk),
      'push_partner_shopping': (AIcons.shoppingCart, a.green1, a.greenInk),
      'push_partner_contractions': (AIcons.timer, a.lav1, a.lavInk),
    };

    Widget row({required Key key, required AIconData icon, Color? bg, Gradient? gradient, required Color ink, required String title, required String sub, required Widget control, required bool first}) =>
        Container(
          key: key,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
          child: Row(children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: bg, gradient: gradient, borderRadius: BorderRadius.circular(12)),
              child: AIcon(icon, size: 16, color: ink),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: pText(13.5, weight: FontWeight.w700, color: a.ink)),
                Text(sub, style: pText(11, color: a.inkSoft)),
              ]),
            ),
            const SizedBox(width: 12),
            control,
          ]),
        );

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ATopbar(onBack: widget.onBack, eyebrow: feature37Text('pp_settings'), title: feature37Text('pn_title')),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
              child: Text(feature37Text('pn_sub'), style: pText(12.5, color: a.inkSoft)),
            ),
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
              child: Column(children: [
                for (var i = 0; i < kPartnerPushRows.length; i++)
                  () {
                    final r = kPartnerPushRows[i];
                    final t = tints[r.$1]!;
                    return row(
                      key: ValueKey('pn-${r.$1}'),
                      icon: t.$1,
                      bg: t.$2,
                      ink: t.$3,
                      title: feature37Text(r.$2),
                      sub: feature37Text(r.$3),
                      first: i == 0,
                      control: ShadSwitch(
                        checked: _prefs[r.$1] ?? true,
                        disabled: _loading,
                        checkedColor: a.peach2,
                        semanticLabel: feature37Text(r.$2),
                        onChanged: (v) => unawaited(_save(r.$1, v)),
                      ),
                    );
                  }(),
                row(
                  key: const ValueKey('pn-sos'),
                  icon: AIcons.siren,
                  gradient: a.alertBg,
                  ink: a.alertInk,
                  title: feature37Text('pn_sos'),
                  sub: feature37Text('pn_sos_sub'),
                  first: false,
                  control: ShadSwitch(checked: true, disabled: true, checkedColor: a.peach2, semanticLabel: feature37Text('pn_sos'), onChanged: null),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 13, color: a.inkSoft)),
                const SizedBox(width: 8),
                Expanded(child: Text(feature37Text('pn_inbox_note'), style: pText(11.5, color: a.inkSoft))),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
