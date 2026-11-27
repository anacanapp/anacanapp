// Ported from: src/pages/Index.tsx (`moderation-history` screen), src/components/AuthScreen.tsx
//              (`isModeratorSignupError(error) ? moderatorError(error, language)`)
import '../../core/auth/auth_error_messages.dart' show moderatorSignupMessage;
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import 'moderator.dart';
import 'my_moderation_decisions.dart';

void registerModerationFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.moderationHistory, (context, a) => MyModerationDecisions(onBack: a.onBack));
  // Sign-up refused by the moderator network rules shows the moderator copy in the current language.
  moderatorSignupMessage = (error) => moderatorError(error);
}
