// Ported from: src/App.tsx (`<Toaster />` + `<Sonner />` mounted once; module-level `toast(...)` callable anywhere)
//
// The one toast controller App.tsx's toasters use, so code without a BuildContext (e.g. the ad experience's
// privacy-options failure) can raise a toast like sonner's global `toast.error(...)`.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/widgets/a_toast.dart' show AToastController;

final appToastControllerProvider = Provider<AToastController>((ref) {
  final controller = AToastController();
  ref.onDispose(controller.dispose);
  return controller;
});
