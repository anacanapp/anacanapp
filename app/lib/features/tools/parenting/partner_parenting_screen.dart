// Ported from: src/components/tools/parenting/PartnerParentingScreen.tsx
//
// Tərbiyə for the partner (father): the same tool, content and Premium rules; the child is the woman's active child
// he can see (partner_children_v1, else her profile's baby) and he can switch between her children. His progress,
// bookmarks and reminders are his own. Her data comes from the partner feature (`usePartnerData`) through
// [partnerParentingDataProvider] (phase 6; default: nothing known). The screen (ScreenId.partnerParenting) is
// registered by the partner phase.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/parenting/parenting.dart' show partnerParentingChild;
import 'parenting_tool.dart';
import 'programme_ports.dart';

/// A `partner_children_v1` row as the screen reads it.
class PartnerChildRow {
  const PartnerChildRow({required this.id, required this.name, this.birthDate, this.isCurrent = false, this.dueDate});
  final String id;
  final String name;
  final String? birthDate;
  final bool isCurrent;
  final String? dueDate;
}

/// `usePartnerData()`: her profile baby and her children he can see.
class PartnerParentingData {
  const PartnerParentingData({this.babyName, this.babyBirthDate, this.hasProfile = false, this.children = const []});
  final String? babyName;
  final String? babyBirthDate;
  final bool hasProfile;
  final List<PartnerChildRow> children;
}

final partnerParentingDataProvider = Provider<PartnerParentingData>((ref) => const PartnerParentingData(), name: 'partnerParentingDataProvider');

/// The child the view starts on (her current child he can see, with its id and due date; else her profile baby).
ProgrammeChild? partnerParentingStartChild(PartnerParentingData data) {
  final kids = data.children;
  PartnerChildRow? current;
  for (final c in kids) {
    if (c.isCurrent) {
      current = c;
      break;
    }
  }
  current ??= kids.isEmpty ? null : kids.first;
  final picked = partnerParentingChild(
    [for (final c in kids) (name: c.name, birthDate: c.birthDate, isCurrent: c.isCurrent)],
    data.hasProfile ? (babyName: data.babyName, babyBirthDate: data.babyBirthDate) : null,
  );
  if (picked == null) return null;
  if (current == null) return ProgrammeChild(name: picked.name, birthDate: picked.birthDate);
  return ProgrammeChild(id: current.id, name: picked.name, birthDate: picked.birthDate, dueDate: current.dueDate);
}

class PartnerParentingScreen extends ConsumerWidget {
  const PartnerParentingScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(partnerParentingDataProvider);
    return ParentingToolView(
      onBack: onBack,
      child: partnerParentingStartChild(data),
      kids: [for (final c in data.children) ProgrammeChild(id: c.id, name: c.name, birthDate: c.birthDate, dueDate: c.dueDate)],
      partner: true,
    );
  }
}
