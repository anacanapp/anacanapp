// Ported from: src/pages/Index.tsx (profile tab: ProfileScreen / PartnerProfileScreen; screens `edit-profile`,
//              `referral`, `moderator` → web console)
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import 'partner_profile_screen.dart';
import 'profile_edit_screen.dart';
import 'profile_screen.dart';
import 'referral_screen.dart';

void registerProfileFeature(FeatureRegistry r) {
  r.registerTab(ShellTab.profile, (context, a) => const ProfileScreen());
  r.registerTab(ShellTab.profile, (context, a) => const PartnerProfileScreen(), partner: true);
  r.registerScreen(ScreenId.editProfile, (context, a) => ProfileEditScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.referral, (context, a) => ReferralScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.moderator, (context, a) => _OpenModeratorWeb(onBack: a.onBack));
}

/// `activeScreen 'moderator'` (ModeratorPanel) → the web moderator console (plan decision), then back.
class _OpenModeratorWeb extends ConsumerStatefulWidget {
  const _OpenModeratorWeb({required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<_OpenModeratorWeb> createState() => _OpenModeratorWebState();
}

class _OpenModeratorWebState extends ConsumerState<_OpenModeratorWeb> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(moderatorWebOpenerProvider)();
      widget.onBack();
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
