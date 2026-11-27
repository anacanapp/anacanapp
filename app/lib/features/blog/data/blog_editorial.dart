// Ported from: src/lib/blog-editorial.ts
//
// Editorial metadata (`anacan-blog-editorial-v1`) of a blog post: life-stage targeting, app modules, related slugs
// and per-language SEO / FAQ / references. Posts stay JSON rows (`Map<String, dynamic>`), as in the React hooks.
import '../../../core/i18n/app_languages.dart';
import '../../../shell/links/js_url.dart' show encodeUriComponent;

/// `BLOG_MODULES`.
const List<String> kBlogModuleIds = ['feeding', 'sleep', 'diaper', 'babyGrowth', 'hospitalBag', 'calendar'];

/// `BlogFaq`.
class BlogFaq {
  const BlogFaq(this.question, this.answer);
  final String question;
  final String answer;
}

/// `BlogReference`.
class BlogReference {
  const BlogReference(this.title, this.url);
  final String title;
  final String url;
}

/// `BlogEditorialLocale`.
class BlogEditorialLocale {
  const BlogEditorialLocale({required this.seoTitle, required this.seoDescription, required this.coverAlt, required this.tags, required this.faq, this.references});
  final String seoTitle;
  final String seoDescription;
  final String coverAlt;
  final List<String> tags;
  final List<BlogFaq> faq;
  final List<BlogReference>? references;
}

/// `BlogEditorialMetadata` (the fields the app reads).
class BlogEditorialMetadata {
  const BlogEditorialMetadata({required this.lifeStages, required this.modules, required this.relatedSlugs, required this.locales});
  final List<String> lifeStages;
  final List<String> modules;
  final List<String> relatedSlugs;
  final Map<String, Object?> locales;
}

List<String> _strings(Object? v) => v is List ? [for (final x in v) '$x'] : const [];

/// `blogEditorial(value)`: the metadata when it has the v1 schema and its arrays, else null.
BlogEditorialMetadata? blogEditorial(Object? value) {
  if (value is! Map) return null;
  final locales = value['locales'];
  if (value['schema'] != 'anacan-blog-editorial-v1' || locales is! Map || value['lifeStages'] is! List || value['modules'] is! List || value['relatedSlugs'] is! List) {
    return null;
  }
  return BlogEditorialMetadata(
    lifeStages: _strings(value['lifeStages']),
    modules: _strings(value['modules']),
    relatedSlugs: _strings(value['relatedSlugs']),
    locales: locales.cast<String, Object?>(),
  );
}

/// `blogLocale(value, language)`: the editorial locale of the language only when complete (no fallback).
BlogEditorialLocale? blogLocale(Object? value, String language) {
  final locale = blogEditorial(value)?.locales[normalizeAppLanguage(language)];
  if (locale is! Map) return null;
  final seoTitle = locale['seoTitle'], seoDescription = locale['seoDescription'], coverAlt = locale['coverAlt'];
  final tags = locale['tags'], faq = locale['faq'], references = locale['references'];
  if (seoTitle is! String || seoDescription is! String || coverAlt is! String || tags is! List || faq is! List) return null;
  return BlogEditorialLocale(
    seoTitle: seoTitle,
    seoDescription: seoDescription,
    coverAlt: coverAlt,
    tags: _strings(tags),
    faq: [
      for (final item in faq)
        if (item is Map) BlogFaq('${item['question'] ?? ''}', '${item['answer'] ?? ''}'),
    ],
    references: references is List
        ? [
            for (final item in references)
              if (item is Map) BlogReference('${item['title'] ?? ''}', '${item['url'] ?? ''}'),
          ]
        : null,
  );
}

/// `blogMatchesStage(post, stage)`: editorial stages when set, else `life_stage` (or `all`).
bool blogMatchesStage(Map<String, dynamic> post, String stage) {
  final stages = blogEditorial(post['editorial_metadata'])?.lifeStages;
  return stages != null && stages.isNotEmpty ? stages.contains(stage) : post['life_stage'] == stage || post['life_stage'] == 'all';
}

/// `blogPath(slug, language)`: the crawlable website path.
String blogPath([String? slug, String language = 'az']) {
  final code = normalizeAppLanguage(language);
  return '/blog${code == 'az' ? '' : '/$code'}${slug != null && slug.isNotEmpty ? '/${encodeUriComponent(slug)}' : ''}/';
}

/// `BLOG_CANONICAL_ORIGIN`.
const String kBlogCanonicalOrigin = 'https://app.anacan.az';

/// `blogCoverUrl(value)`: native builds keep the real remote URL (the web-only same-origin rewrite never applies).
String? blogCoverUrl(Object? value) => value is String && value.isNotEmpty ? value : null;

/// `blogAvailableLanguages(post)`: languages with both a title and a body.
List<String> blogAvailableLanguages(Map<String, dynamic> post) => kAppLanguageCodes.where((language) {
      final title = language == 'az' ? _truthy(post['title_az']) ?? post['title'] : post['title_$language'];
      final content = language == 'az' ? _truthy(post['content_az']) ?? post['content'] : post['content_$language'];
      return title is String && title.trim().isNotEmpty && content is String && content.trim().isNotEmpty;
    }).toList();

Object? _truthy(Object? v) => v == null || v == '' || v == false || v == 0 ? null : v;
