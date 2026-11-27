// Ported from: src/pages/Index.tsx (showSplash / showIntro / countryJustSet state, the 1 500 ms intro timer,
//              the language-bypass effect, setFunnelCompleted when the funnel is skipped, gate rendering),
//              src/components/SplashScreen.tsx (needsBrandSplash once per process, 350 ms)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../feature_registry.dart';
import '../shell_inputs.dart';
import '../widgets/shell_scaffold.dart';
import 'gate_sequence.dart';

/// Renders the gate [decideGate] picks (registered gate widget or a placeholder) or the [ShellScaffold].
class GateHost extends ConsumerStatefulWidget {
  const GateHost({super.key});

  /// `needsBrandSplash()`: the brand splash shows once per process.
  static bool brandSplashShown = false;

  @override
  ConsumerState<GateHost> createState() => _GateHostState();
}

class _GateHostState extends ConsumerState<GateHost> {
  late bool _showSplash = !GateHost.brandSplashShown;
  bool _showIntro = false;
  bool _countryJustSet = false;
  Timer? _splash;
  Timer? _intro;

  @override
  void initState() {
    super.initState();
    if (_showSplash) {
      _splash = Timer(kBrandSplashDuration, () {
        GateHost.brandSplashShown = true;
        if (mounted) setState(() => _showSplash = false);
      });
    }
    _intro = Timer(kIntroTimer, () {
      if (!mounted) return;
      final seen = ref.read(gateInputsProvider).hasSeenIntro;
      setState(() {
        _showSplash = false;
        if (!seen) _showIntro = true;
      });
    });
  }

  @override
  void dispose() {
    _splash?.cancel();
    _intro?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(gateInputsProvider);
    final decision = decideGate(inputs, showSplash: _showSplash, showIntro: _showIntro, countryJustSet: _countryJustSet);
    if (decision.markLanguageSelected || decision.markFunnelCompleted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final actions = ref.read(gateActionsProvider);
        if (decision.markLanguageSelected) actions.setHasSelectedLanguage(true);
        if (decision.markFunnelCompleted) actions.setFunnelCompleted(true);
      });
    }
    if (decision.gate == GateId.shell) return const ShellScaffold();
    final builder = ref.watch(featureRegistryProvider).gate(decision.gate);
    final args = GateArgs(
      decision: decision,
      inputs: inputs,
      onIntroComplete: () {
        setState(() => _showIntro = false);
        ref.read(gateActionsProvider).setHasSeenIntro(true);
      },
      onCountryDone: () => setState(() => _countryJustSet = true),
    );
    final key = ValueKey('gate:${decision.gate.name}');
    return KeyedSubtree(
      key: key,
      child: builder != null
          ? builder(context, args)
          : ShellPlaceholder(kind: 'gate', id: '${decision.gate.name}${decision.reason == null ? '' : ':${decision.reason!.name}'}'),
    );
  }
}
