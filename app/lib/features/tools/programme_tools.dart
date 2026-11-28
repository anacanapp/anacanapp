// Ported from: src/components/ToolsHub.tsx (renderToolById: sleep-training, weaning, parenting),
//              src/components/Dashboard.tsx (WeaningHomeCard, WeaningFeedingLink, ParentingHomeCard),
//              src/components/AIChatScreen.tsx (WeaningAiCard / ParentingAiCard under an answer)
//
// Programme tools of phase 4 and the values their seams take in `featureWiringOverrides()`:
//   mommyHomeSlotsProvider.slots  ← [programmeMommySlots]   (MommySlot.weaningHome / weaningFeedingLink / parentingHome)
//   aiAnswerCardProvider          ← [programmeAiAnswerCard]
import 'package:flutter/widgets.dart';

import '../../shell/shell.dart';
import '../ai_chat/ai_chat_inputs.dart' show AiAnswerCardBuilder;
import '../ai_chat/ai_chat_logic.dart' show AiPartnerContext;
import '../home_mommy/mommy_home_slots.dart';
import 'parenting/parenting_entry.dart';
import 'parenting/parenting_home_card.dart';
import 'parenting/parenting_tool.dart';
import 'sleep_training/sleep_training.dart';
import 'weaning/weaning_entry.dart' show isWeaningQuestion;
import 'weaning/weaning_entry_cards.dart';
import 'weaning/weaning_tool.dart';

void registerProgrammeTools(FeatureRegistry r) {
  r.registerTool(ToolId.sleepTraining, (context, a) => SleepTraining(onBack: a.onBack));
  r.registerTool(ToolId.weaning, (context, a) => WeaningTool(onBack: a.onBack));
  r.registerTool(ToolId.parenting, (context, a) => ParentingTool(onBack: a.onBack));
}

/// The Ana home blocks of the programme tools (merge into `MommyHomeSlots.slots`).
Map<MommySlot, MommySlotBuilder> programmeMommySlots() => {
      MommySlot.weaningHome: (context, args) => const WeaningHomeCard(),
      MommySlot.weaningFeedingLink: (context, args) => const WeaningFeedingLink(),
      MommySlot.parentingHome: (context, args) => ParentingHomeCard(onOpen: () => args.onNavigateToTool('parenting')),
    };

/// The tool card under an Anacan.AI answer: the weaning card for a weaning question (mother persona only), else the
/// best Tərbiyə SOS card / article (mother, or the partner of an Ana-module mother).
Widget? programmeAiAnswerCard(BuildContext context, {required String question, required AiPartnerContext? partner}) {
  if (partner == null && isWeaningQuestion(question)) return const WeaningAiCard();
  return ParentingAiCard(
    question: question,
    partner: partner == null ? null : ParentingPartnerContext(lifeStage: partner.lifeStage, babyBirthDate: partner.babyBirthDate),
  );
}

/// [programmeAiAnswerCard] as the provider value type.
const AiAnswerCardBuilder programmeAiAnswerCardBuilder = programmeAiAnswerCard;
