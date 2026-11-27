// Ported from: src/components/LegalScreen.tsx, src/hooks/useLegalDocuments.ts, src/lib/legalProse.ts,
//              src/pages/LegalPage.tsx
//
// Legal documents list → document (markdown or HTML) in the LEGAL_PROSE card. Titles/contents pick the language
// column with the React fallback chains; pack languages go through mapRowTranslation.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/cache/cache.dart';
import '../../core/data/data.dart' hide Row;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/state.dart' show userStoreProvider;
import '../settings/ui/settings_ui.dart';
import 'content/content_typography.dart';
import 'content/html_content.dart';
import 'content/markdown_content.dart';

abstract interface class LegalDocumentsRepository {
  Future<List<Map<String, dynamic>>> active();
}

class SupabaseLegalDocumentsRepository implements LegalDocumentsRepository {
  SupabaseLegalDocumentsRepository(this._db);
  final Db _db;
  @override
  Future<List<Map<String, dynamic>>> active() async {
    try {
      return asRows(await _db.from('legal_documents').select().eq('is_active', true).order('document_type'));
    } catch (_) {
      return const <Map<String, dynamic>>[];
    }
  }
}

final legalDocumentsRepositoryProvider = Provider<LegalDocumentsRepository>((ref) => SupabaseLegalDocumentsRepository(ref.watch(dbProvider)));

/// `useLegalDocuments()` (30 min stale).
final legalDocumentsQuery = queryProvider<List<Map<String, dynamic>>>((ref) => QueryOptions<List<Map<String, dynamic>>>(
      queryKey: const ['legal-documents'],
      staleTime: const Duration(minutes: 30),
      queryFn: (_) => ref.read(legalDocumentsRepositoryProvider).active(),
    ));

const List<String> kLegalDocumentOrder = ['terms_of_service', 'privacy_policy', 'gdpr_ccpa', 'disclaimer', 'refund_policy', 'data_usage'];

String? _s(Map<String, dynamic> d, String k) {
  final v = d[k];
  return v is String && v.isNotEmpty ? v : null;
}

/// `pickTitle` / `pickContent` (field = 'title' | 'content').
String pickLegalField(Map<String, dynamic> d, String field, String language) {
  if (isPackLanguage(language)) return (mapRowTranslation(d, language, [field])?[field] as String?) ?? '';
  String? f(String suffix) => _s(d, suffix.isEmpty ? field : '${field}_$suffix');
  final chain = switch (language) {
    'az' => [f('az'), f('')],
    'ru' => [f('ru'), f('en'), f(''), f('az')],
    'tr' => [f('tr'), f('en'), f(''), f('az')],
    'kk' => [f('kk'), f('ru'), f('en'), f(''), f('az')],
    'uz' => [f('uz'), f('ru'), f('en'), f(''), f('az')],
    'ka' => [f('ka'), f('ru'), f('en'), f(''), f('az')],
    'de' => [f('de'), f('en'), f(''), f('az')],
    'ar' => [f('ar'), f('en'), f(''), f('az')],
    _ => [f('en'), f(''), f('az')],
  };
  return chain.whereType<String>().firstOrNull ?? '';
}

/// Sorted by [kLegalDocumentOrder] (unknown types first, like `indexOf` = -1).
List<Map<String, dynamic>> sortLegalDocuments(List<Map<String, dynamic>> docs) {
  final out = List<Map<String, dynamic>>.of(docs);
  final indexed = {for (var i = 0; i < out.length; i++) out[i]: i};
  out.sort((a, b) {
    final c = kLegalDocumentOrder.indexOf('${a['document_type']}').compareTo(kLegalDocumentOrder.indexOf('${b['document_type']}'));
    return c != 0 ? c : indexed[a]!.compareTo(indexed[b]!);
  });
  return out;
}

class LegalScreen extends ConsumerStatefulWidget {
  const LegalScreen({super.key, required this.onBack, this.initialDocument});
  final VoidCallback onBack;
  final String? initialDocument;
  @override
  ConsumerState<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends ConsumerState<LegalScreen> {
  Map<String, dynamic>? _selected;
  bool _initialApplied = false;

  (AIconData, Color, Color) _tint(String type) {
    final a = context.a;
    return switch (type) {
      'privacy_policy' => (AIcons.shield, a.blue1, a.blueInk),
      'gdpr_ccpa' => (AIcons.scale, a.lav1, a.lavInk),
      'disclaimer' => (AIcons.triangleAlert, a.yellow1, a.yellowInk),
      'refund_policy' => (AIcons.creditCard, a.green1, a.greenInk),
      'data_usage' => (AIcons.database, a.pink1, a.pinkInk),
      _ => (AIcons.fileText, a.peach1, a.accentInk),
    };
  }

  Widget _header(String title, VoidCallback onBack) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
      child: Row(children: <Widget>[
        AIconBtn(key: const ValueKey<String>('legal-back'), tapScale: 0.95, semanticLabel: tr('common_geri', 'Geri'), onTap: onBack, icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
        const SizedBox(width: 12),
        Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(15, weight: FontWeight.w800, color: a.ink))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final q = ref.watch(legalDocumentsQuery);
    final docs = q.data ?? const <Map<String, dynamic>>[];
    if (!_initialApplied && widget.initialDocument != null && docs.isNotEmpty && _selected == null) {
      _initialApplied = true;
      _selected = docs.where((d) => d['document_type'] == widget.initialDocument).firstOrNull;
    }
    final selected = _selected;
    if (selected != null) {
      final content = pickLegalField(selected, 'content', language);
      final updated = DateTime.tryParse('${selected['updated_at']}');
      String updatedText = '';
      if (updated != null) {
        try {
          updatedText = formatDatePattern(updated.toLocal(), 'd.M.yyyy');
        } catch (_) {
          updatedText = '${updated.day}.${updated.month}.${updated.year}';
        }
      }
      final typo = looksLikeHtml(content) ? ContentTypography.legal(ContentTypography.html) : ContentTypography.legal(ContentTypography.markdown);
      return AScope(
        child: ColoredBox(
          color: a.bg,
          child: Column(children: <Widget>[
            _header(pickLegalField(selected, 'title', language), () => setState(() => _selected = null)),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 768),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text('Versiya: ${selected['version'] ?? ''} ${tr('legalscreen_son_yenilenme_8a61f0', '| Son yenilənmə:')} $updatedText', style: px(12.5, color: a.inkSoft)),
                      ),
                      ACard(
                        child: DefaultTextStyle.merge(
                          style: Tw.sm.copyWith(color: a.bodyText),
                          child: looksLikeHtml(content)
                              ? HtmlContent(content: wrapLegalTables(content), typography: typo)
                              : MarkdownContent(content: content, typography: typo),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ]),
        ),
      );
    }
    final sorted = sortLegalDocuments(docs);
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Column(children: <Widget>[
          _header(tr('legalscreen_huquqi_senedler_ca8c60', 'Hüquqi Sənədlər'), widget.onBack),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: q.isLoading
                  ? Padding(padding: const EdgeInsets.symmetric(vertical: 32), child: Center(child: ARingSpinner(size: 32, color: a.peach2)))
                  : VGap(gap: 10, children: <Widget>[
                      for (final d in sorted)
                        () {
                          final (icon, bg, ink) = _tint('${d['document_type']}');
                          return PressScale(
                            key: ValueKey<String>('legal-doc-${d['document_type']}'),
                            scale: 0.98,
                            onTap: () => setState(() => _selected = d),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
                              child: Row(children: <Widget>[
                                Container(width: 42, height: 42, alignment: Alignment.center, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)), child: AIcon(icon, size: 18, color: ink)),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                    Text(pickLegalField(d, 'title', language), style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                                    Padding(padding: const EdgeInsets.only(top: 1), child: Text('Versiya ${d['version'] ?? ''}', style: px(11.5, color: a.inkSoft))),
                                  ]),
                                ),
                                AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
                              ]),
                            ),
                          );
                        }(),
                    ]),
            ),
          ),
        ]),
      ),
    );
  }
}
