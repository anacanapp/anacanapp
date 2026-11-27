// Ported from: src/pages/Index.tsx (`case 'ai'` for both roles, h-full) — registration of the AI tab
import 'package:anacan/features/ai_chat/register.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the woman and partner AI tabs, both filling the viewport', () {
    final r = FeatureRegistry()..registerAll([registerAiChatFeature]);
    expect(r.registeredIds, {'tab:ai', 'tab:ai:partner'});
    expect(r.tab(ShellTab.ai, partner: false)!.fillsViewport, isTrue);
    expect(r.tab(ShellTab.ai, partner: true)!.fillsViewport, isTrue);
  });
}
