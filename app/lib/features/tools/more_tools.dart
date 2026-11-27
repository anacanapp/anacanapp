// Ported from: src/components/ToolsHub.tsx (the lazy tool imports of SecondHandMarket, MomFriendlyMap, SmartPlayBox,
//              PlayTogetherTool, KidExercisesTool and AffiliateProducts)
import '../../shell/shell.dart';
import 'affiliate/affiliate_products.dart';
import 'kid_exercises/kid_exercises_tool.dart';
import 'market/second_hand_market.dart';
import 'mom_map/mom_friendly_map.dart';
import 'play_together/play_together_tool.dart';
import 'smart_play/smart_play_box.dart';

/// Registers the remaining phase 4 tools (market, mom-friendly places, smart play box, play together, kid exercises,
/// affiliate products).
void registerMoreTools(FeatureRegistry r) {
  r.registerTool(ToolId.secondhandMarket, (context, a) => SecondHandMarket(onBack: a.onBack));
  r.registerTool(ToolId.momFriendlyMap, (context, a) => MomFriendlyMap(onBack: a.onBack));
  r.registerTool(ToolId.smartPlayBox, (context, a) => SmartPlayBox(onBack: a.onBack));
  r.registerTool(ToolId.playTogether, (context, a) => PlayTogetherTool(onBack: a.onBack));
  r.registerTool(ToolId.kidExercises, (context, a) => KidExercisesTool(onBack: a.onBack));
  r.registerTool(ToolId.affiliate, (context, a) => AffiliateProducts(onBack: a.onBack));
}
