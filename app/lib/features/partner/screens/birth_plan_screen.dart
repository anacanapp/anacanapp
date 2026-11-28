// Ported from: src/components/partner/v2/BirthPlanScreen.tsx
//
// Doğuş planı: the mother's wishes for the birth, shared with (and editable by) her linked partner. Saved with
// optimistic concurrency: if the other one saved meanwhile, the edit is dropped and the newer plan shows.
import 'package:flutter/services.dart' show LengthLimitingTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show AInput, ALoader, toasts;
import '../data/partner_family.dart';
import '../ui/partner_ui.dart';
import 'screens_copy.dart';
import 'screens_format.dart';
import 'screens_ui.dart';

/// The list fields with their title key and options (`LISTS`).
const List<({String field, String title, List<(String, String)> options})> kBirthPlanLists = [
  (field: 'companions', title: 'bp_companions', options: [('partner', 'bp_c_partner'), ('mother', 'bp_c_mother'), ('doula', 'bp_c_doula'), ('none', 'bp_c_none')]),
  (
    field: 'environment',
    title: 'bp_env',
    options: [('dim', 'bp_e_dim'), ('music', 'bp_e_music'), ('own_clothes', 'bp_e_own_clothes'), ('quiet', 'bp_e_quiet'), ('photos', 'bp_e_photos'), ('move', 'bp_e_move')],
  ),
  (
    field: 'after',
    title: 'bp_after',
    options: [('skin', 'bp_a_skin'), ('cord', 'bp_a_cord'), ('partner_cord', 'bp_a_partner_cord'), ('breastfeed', 'bp_a_breastfeed'), ('rooming', 'bp_a_rooming')],
  ),
  (field: 'cesarean', title: 'bp_cesarean', options: [('partner', 'bp_cs_partner'), ('skin', 'bp_cs_skin'), ('explain', 'bp_cs_explain')]),
];

/// `PAIN`.
const List<(String, String)> kBirthPlanPain = [('natural', 'bp_p_natural'), ('epidural', 'bp_p_epidural'), ('open', 'bp_p_open')];

List<String> _list(Object? v) => [for (final s in (v is List ? v : const [])) '$s'];

/// `toggle(field, value)`: adds / removes [value]; for companions "none" excludes every other choice.
Map<String, dynamic> toggleBirthPlanList(Map<String, dynamic> plan, String field, String value) {
  final current = _list(plan[field]);
  var next = current.contains(value) ? current.where((v) => v != value).toList() : [...current, value];
  if (field == 'companions') {
    next = value == 'none' ? (current.contains('none') ? <String>[] : ['none']) : next.where((v) => v != 'none').toList();
  }
  return {...plan, field: next};
}

class BirthPlanScreen extends ConsumerStatefulWidget {
  const BirthPlanScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BirthPlanScreen> createState() => _BirthPlanScreenState();
}

class _BirthPlanScreenState extends ConsumerState<BirthPlanScreen> {
  Map<String, dynamic> _plan = const {};
  bool _dirty = false;
  BirthPlanState? _loaded;
  final TextEditingController _place = TextEditingController();
  final TextEditingController _doctor = TextEditingController();
  final TextEditingController _notes = TextEditingController();

  @override
  void dispose() {
    _place.dispose();
    _doctor.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _update(Map<String, dynamic> next) => setState(() {
        _plan = next;
        _dirty = true;
      });

  /// `useEffect(() => { if (state && !dirty) setPlan(state.plan) }, [state, dirty])`.
  void _syncFrom(BirthPlanState? state) {
    if (state == null || _dirty || identical(state, _loaded)) return;
    _loaded = state;
    _plan = Map<String, dynamic>.of(state.plan);
    final place = '${_plan['place'] ?? ''}';
    final doctor = '${_plan['doctor'] ?? ''}';
    final notes = '${_plan['notes'] ?? ''}';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_place.text != place) _place.text = place;
      if (_doctor.text != doctor) _doctor.text = doctor;
      if (_notes.text != notes) _notes.text = notes;
    });
  }

  void _save() {
    final toast = toasts(context);
    ref.read(saveBirthPlanMutation.notifier).mutate(
      _plan,
      onSuccess: (_, _, _) {
        if (mounted) setState(() => _dirty = false);
        toast.show(title: feature37Text('bp_saved'));
      },
      onError: (e, _, _) {
        if (e is BirthPlanChangedError) {
          if (mounted) setState(() => _dirty = false);
          toast.show(title: feature37Text('bp_changed'), destructive: true);
        } else {
          toast.show(title: feature37Text('bp_error'), destructive: true);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final query = ref.watch(birthPlanQuery);
    final save = ref.watch(saveBirthPlanMutation);
    final state = query.data;
    _syncFrom(state);
    final error = query.error;
    final noFamily = error != null && (error is PostgrestException ? error.message : '$error').contains('BIRTH_PLAN_NO_FAMILY');

    BoxDecoration card() => BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow);
    TextStyle h() => pText(13.5, weight: FontWeight.w900, color: a.ink);
    final updatedAt = state?.updatedAt == null ? null : DateTime.tryParse(state!.updatedAt!)?.toLocal();

    Widget chip(bool on, String label, VoidCallback onTap, Key key) => PartnerTap(
          key: key,
          onTap: onTap,
          child: Semantics(
            toggled: on,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(color: on ? a.lavInk : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (on) ...[AIcon(AIcons.check, size: 13, color: a.surface), const SizedBox(width: 4)],
                Text(label, style: pText(12.5, weight: FontWeight.w700, color: on ? a.surface : a.ink)),
              ]),
            ),
          ),
        );

    Widget section(List<Widget> children) => Container(
          padding: const EdgeInsets.all(16),
          decoration: card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        );

    final List<Widget> body;
    if (query.isLoading) {
      body = [Padding(padding: const EdgeInsets.symmetric(vertical: 64), child: Center(child: ALoader(size: 24, color: a.inkFaint)))];
    } else if (error != null || state == null) {
      body = [
        PartnerCard(
          padding: const EdgeInsets.all(22),
          child: Text(noFamily ? feature37Text('family_no_link') : feature37Text('family_error'), textAlign: TextAlign.center, style: pText(13.5, color: a.bodyText)),
        ),
      ];
    } else {
      final sections = <Widget>[
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(16)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.clipboardList, size: 16, color: a.lavInk)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(state.isMother ? feature37Text('bp_intro_mother') : feature37Text('bp_intro_partner'), style: pText(12.5, weight: FontWeight.w600, color: a.lavInk)),
                if (updatedAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Opacity(
                      opacity: 0.8,
                      child: Text(feature37Text('bp_updated').replaceFirst('{date}', fmtDateMediumTimeShort(updatedAt)), style: pText(10.5, color: a.lavInk)),
                    ),
                  ),
              ]),
            ),
          ]),
        ),
        section([
          Padding(padding: const EdgeInsets.only(bottom: 9), child: Text(feature37Text('bp_place'), style: h())),
          AInput(
            fieldKey: const ValueKey('bp-place'),
            controller: _place,
            placeholder: feature37Text('bp_place_ph'),
            inputFormatters: [LengthLimitingTextInputFormatter(160)],
            onChanged: (v) => _update({..._plan, 'place': v}),
          ),
          Padding(padding: const EdgeInsets.only(top: 14, bottom: 9), child: Text(feature37Text('bp_doctor'), style: h())),
          AInput(
            fieldKey: const ValueKey('bp-doctor'),
            controller: _doctor,
            inputFormatters: [LengthLimitingTextInputFormatter(160)],
            onChanged: (v) => _update({..._plan, 'doctor': v}),
          ),
        ]),
        section([
          Padding(padding: const EdgeInsets.only(bottom: 9), child: Text(feature37Text('bp_pain'), style: h())),
          Semantics(
            label: feature37Text('bp_pain'),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (value, label) in kBirthPlanPain)
                chip(_plan['pain'] == value, feature37Text(label), () {
                  final next = {..._plan};
                  if (_plan['pain'] == value) {
                    next.remove('pain');
                  } else {
                    next['pain'] = value;
                  }
                  _update(next);
                }, ValueKey('bp-pain-$value')),
            ]),
          ),
        ]),
        for (final l in kBirthPlanLists)
          section([
            Padding(padding: const EdgeInsets.only(bottom: 9), child: Text(feature37Text(l.title), style: h())),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (value, label) in l.options)
                chip(_list(_plan[l.field]).contains(value), feature37Text(label), () => _update(toggleBirthPlanList(_plan, l.field, value)), ValueKey('bp-${l.field}-$value')),
            ]),
          ]),
        section([
          Padding(padding: const EdgeInsets.only(bottom: 9), child: Text(feature37Text('bp_notes'), style: h())),
          _NotesField(controller: _notes, placeholder: feature37Text('bp_notes_ph'), onChanged: (v) => _update({..._plan, 'notes': v})),
        ]),
      ];
      body = [
        for (var i = 0; i < sections.length; i++) ...[if (i > 0) const SizedBox(height: 12), sections[i]],
      ];
    }

    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: feature37Text('pm_birth_plan_sub'),
      title: feature37Text('pm_birth_plan'),
      bottom: 128,
      floating: _dirty
          ? Positioned(
              left: 16,
              right: 16,
              bottom: 24 + bottomInset,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      // 0 16px 32px -12px rgba(217, 108, 74, 0.6) (BirthPlanScreen.tsx:137)
                      boxShadow: const [BoxShadow(color: Color(0x99D96C4A), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -12)],
                    ),
                    child: PartnerPillButton(
                      key: const ValueKey('bp-save'),
                      solid: true,
                      expand: true,
                      icon: save.isPending ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.check, size: 16),
                      label: feature37Text('bp_save'),
                      onTap: save.isPending ? null : _save,
                    ),
                  ),
                ),
              ),
            )
          : null,
      children: body,
    );
  }
}

/// The `textarea.a-input` (4 rows, min-height 96, padding 12, max 2000 characters).
class _NotesField extends StatelessWidget {
  const _NotesField({required this.controller, required this.placeholder, required this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(pText(13, color: a.ink));
    return Material(
      type: MaterialType.transparency,
      child: Container(
        constraints: const BoxConstraints(minHeight: 96),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
        child: TextField(
          key: const ValueKey('bp-notes'),
          controller: controller,
          onChanged: onChanged,
          minLines: 4,
          maxLines: null,
          inputFormatters: [LengthLimitingTextInputFormatter(2000)],
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
        ),
      ),
    );
  }
}

