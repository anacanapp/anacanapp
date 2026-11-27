// Ported from: src/components/CountrySelect.tsx
//
// Searchable country picker: a trigger button and a bottom-aligned modal list (flags from countries.json,
// English names, search on name or ISO code).
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../data/countries.g.dart';
import '../widgets/entry_widgets.dart';

/// `filtered`: name or ISO-2 contains the trimmed, lower-cased query.
List<(String, String)> filterCountrySelect(String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return kCountryRows;
  return [for (final c in kCountryRows) if (c.$2.toLowerCase().contains(q) || c.$1.toLowerCase().contains(q)) c];
}

String? countryName(String? iso) {
  if (iso == null) return null;
  for (final c in kCountryRows) {
    if (c.$1 == iso) return c.$2;
  }
  return null;
}

/// Trigger look: `a-input w-full flex items-center gap-2` (default) or the AuthScreen field classes.
enum CountryTriggerStyle { aInput, authField }

class CountrySelect extends StatelessWidget {
  const CountrySelect({
    super.key,
    required this.value,
    required this.onChanged,
    this.placeholder,
    this.triggerStyle = CountryTriggerStyle.aInput,
  });

  final String? value;
  final ValueChanged<String> onChanged;
  final String? placeholder;
  final CountryTriggerStyle triggerStyle;

  String get _placeholder => placeholder ?? tr('countryselect_olke_secin', 'Ölkə seçin');

  Future<void> _open(BuildContext context) async {
    final picked = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: _placeholder,
      barrierColor: const Color(0x80000000), // bg-black/50
      transitionDuration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 300),
      transitionBuilder: (context, animation, _, child) => FadeTransition(opacity: animation, child: child),
      pageBuilder: (dialogContext, _, _) => Theme(
        data: Theme.of(context),
        child: Directionality(
          textDirection: Directionality.of(context),
          child: _CountryPickerSheet(value: value, title: _placeholder),
        ),
      ),
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final name = countryName(value);
    final auth = triggerStyle == CountryTriggerStyle.authField;
    final textStyle = auth ? css(16, FontWeight.w400, height: 1.25) : css(13, FontWeight.w400);
    final content = Row(children: [
      Expanded(
        child: name != null
            ? Row(children: [
                Container(
                  width: 24,
                  height: 16,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(3), border: Border.all(color: a.line)),
                  child: Image.asset(flagAsset(value!), fit: BoxFit.cover),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: textStyle.copyWith(color: a.ink)),
                ),
              ])
            : Text(_placeholder, style: textStyle.copyWith(color: a.inkFaint)),
      ),
      const SizedBox(width: 8),
      AIcon(AIcons.chevronDown, size: 15, color: a.inkFaint),
    ]);
    return GestureDetector(
      key: const ValueKey('country-select-trigger'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(context),
      child: Semantics(
        button: true,
        label: name ?? _placeholder,
        child: auth
            ? Container(
                height: 48,
                padding: const EdgeInsetsDirectional.only(start: 42, end: 10),
                decoration: BoxDecoration(
                  color: a.surfaceSoft,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x00000000), width: 2),
                ),
                child: content,
              )
            : Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: a.lineStrong),
                ),
                child: content,
              ),
      ),
    );
  }
}

class _CountryPickerSheet extends StatefulWidget {
  const _CountryPickerSheet({required this.value, required this.title});
  final String? value;
  final String title;

  @override
  State<_CountryPickerSheet> createState() => _CountryPickerSheetState();
}

class _CountryPickerSheetState extends State<_CountryPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final list = filterCountrySelect(_query);
    final mq = MediaQuery.of(context);
    return AScope(
      child: Padding(
        padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: MotionIn(
              offset: const Offset(0, 40),
              spring: ASprings.spring(damping: 26),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 384, maxHeight: mq.size.height * 0.7),
                child: Material(
                  type: MaterialType.transparency,
                  child: Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(22)),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
                        child: Column(children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(children: [
                              Expanded(child: Text(widget.title, style: css(14.5, FontWeight.w800, color: a.ink))),
                              EntryIconButton(
                                size: 30,
                                onTap: () => Navigator.of(context).pop(),
                                child: const AIcon(AIcons.x, size: 14),
                              ),
                            ]),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                            child: Row(children: [
                              AIcon(AIcons.search, size: 14, color: a.inkFaint),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  key: const ValueKey('country-select-search'),
                                  autofocus: true,
                                  onChanged: (v) => setState(() => _query = v),
                                  style: css(14, FontWeight.w400, color: a.ink, height: 1.25),
                                  cursorColor: a.ink,
                                  decoration: InputDecoration(
                                    isCollapsed: true,
                                    border: InputBorder.none,
                                    hintText: tr('countryselect_axtar', 'Axtar...'),
                                    hintStyle: css(14, FontWeight.w400, color: context.tokens.shadcn.mutedForeground, height: 1.25),
                                  ),
                                ),
                              ),
                            ]),
                          ),
                        ]),
                      ),
                      Flexible(
                        child: list.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(20),
                                child: Text(tr('countryselect_tapilmadi', 'Ölkə tapılmadı'),
                                    textAlign: TextAlign.center, style: css(12.5, FontWeight.w400, color: a.inkFaint)),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                padding: const EdgeInsets.all(8),
                                itemCount: list.length,
                                itemBuilder: (context, i) {
                                  final (iso, name) = list[i];
                                  final selected = widget.value == iso;
                                  return GestureDetector(
                                    key: ValueKey('country-option-$iso'),
                                    behavior: HitTestBehavior.opaque,
                                    onTap: () => Navigator.of(context).pop(iso),
                                    child: Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: selected ? a.peach1 : null,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Row(children: [
                                        Container(
                                          width: 26,
                                          height: 18,
                                          clipBehavior: Clip.antiAlias,
                                          decoration: BoxDecoration(
                                              borderRadius: BorderRadius.circular(3), border: Border.all(color: a.line)),
                                          child: Image.asset(flagAsset(iso), fit: BoxFit.cover),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Text(name,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: css(13.5, FontWeight.w600, color: a.ink)),
                                        ),
                                        if (selected) ...[
                                          const SizedBox(width: 12),
                                          AIcon(AIcons.check, size: 15, color: a.peach2),
                                        ],
                                      ]),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
