// Ported from: src/lib/blog-content.mjs (`forbidden` DOMPurify options), DOMPurify 3 defaults (html profile:
//              ALLOWED_TAGS / ALLOWED_ATTR, ALLOW_ARIA_ATTR, IS_ALLOWED_URI, DATA_URI_TAGS, URI_SAFE_ATTRIBUTES,
//              FORBID_CONTENTS, KEEP_CONTENT, comment removal, SANITIZE_DOM id/name clobbering)
//
// The blog reader sanitizes with `DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: [...],
// FORBID_ATTR: ['style'], ALLOW_DATA_ATTR: false })`. This is the same allow-list over a package:html DOM.
// ignore_for_file: depend_on_referenced_packages
import 'package:html/dom.dart' as dom;

/// `forbidden.FORBID_TAGS`.
const Set<String> kBlogForbiddenTags = {'script', 'style', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'option', 'object', 'embed'};

/// DOMPurify `html` tag list.
const Set<String> _allowedTags = {
  'a', 'abbr', 'acronym', 'address', 'area', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'big', 'blink', 'blockquote',
  'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist',
  'dd', 'decorator', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'element', 'em', 'fieldset', 'figcaption',
  'figure', 'font', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i',
  'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'map', 'mark', 'marquee', 'menu', 'menuitem', 'meter',
  'nav', 'nobr', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's',
  'samp', 'search', 'section', 'select', 'shadow', 'slot', 'small', 'source', 'spacer', 'span', 'strike', 'strong',
  'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr',
  'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr',
};

/// DOMPurify `FORBID_CONTENTS` default: removed together with their content.
const Set<String> _forbidContents = {
  'annotation-xml', 'audio', 'colgroup', 'desc', 'foreignobject', 'head', 'iframe', 'math', 'mi', 'mn', 'mo', 'ms', 'mtext',
  'noembed', 'noframes', 'noscript', 'plaintext', 'script', 'style', 'svg', 'template', 'thead', 'title', 'video', 'xmp',
};

/// DOMPurify `html` attribute list (minus `style`, forbidden here).
const Set<String> _allowedAttrs = {
  'accept', 'action', 'align', 'alt', 'autocapitalize', 'autocomplete', 'autopictureinpicture', 'autoplay', 'background',
  'bgcolor', 'border', 'capture', 'cellpadding', 'cellspacing', 'checked', 'cite', 'class', 'clear', 'color', 'cols',
  'colspan', 'controls', 'controlslist', 'coords', 'crossorigin', 'datetime', 'decoding', 'default', 'dir', 'disabled',
  'disablepictureinpicture', 'disableremoteplayback', 'download', 'draggable', 'enctype', 'enterkeyhint', 'face', 'for',
  'headers', 'height', 'hidden', 'high', 'href', 'hreflang', 'id', 'inputmode', 'integrity', 'ismap', 'kind', 'label',
  'lang', 'list', 'loading', 'loop', 'low', 'max', 'maxlength', 'media', 'method', 'min', 'minlength', 'multiple', 'muted',
  'name', 'nonce', 'noshade', 'novalidate', 'nowrap', 'open', 'optimum', 'pattern', 'placeholder', 'playsinline',
  'popover', 'popovertarget', 'popovertargetaction', 'poster', 'preload', 'pubdate', 'radiogroup', 'readonly', 'rel',
  'required', 'rev', 'reversed', 'role', 'rows', 'rowspan', 'spellcheck', 'scope', 'selected', 'shape', 'size', 'sizes',
  'span', 'srclang', 'start', 'src', 'srcset', 'step', 'summary', 'tabindex', 'title', 'translate', 'type', 'usemap',
  'valign', 'value', 'width', 'wrap', 'xmlns', 'slot',
};

/// `URI_SAFE_ATTRIBUTES` (values are not URL-checked).
const Set<String> _uriSafeAttrs = {'alt', 'class', 'for', 'id', 'label', 'name', 'pattern', 'placeholder', 'role', 'summary', 'title', 'value', 'style', 'xmlns'};

/// `DATA_URI_TAGS`.
const Set<String> _dataUriTags = {'audio', 'video', 'img', 'source', 'image', 'track'};

/// `SANITIZE_DOM`: `id` / `name` values that would clobber `document` / form properties (the common ones).
const Set<String> _clobbering = {
  'location', 'cookie', 'domain', 'body', 'head', 'forms', 'images', 'links', 'scripts', 'title', 'documentElement',
  'defaultView', 'createElement', 'getElementById', 'querySelector', 'querySelectorAll', 'implementation', 'all',
  'anchors', 'embeds', 'plugins', 'activeElement', 'attributes', 'action', 'method', 'submit', 'reset', 'elements',
  'nodeName', 'nodeType', 'parentNode', 'children', 'childNodes', 'firstChild', 'lastChild', 'innerHTML', 'outerHTML',
};

final RegExp _attrWhitespace = RegExp('[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]');
final RegExp _isAllowedUri = RegExp(r'^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))', caseSensitive: false);
final RegExp _aria = RegExp(r'^aria-[\-\w]+$');

bool _validAttribute(String tag, String name, String value) {
  if (!_aria.hasMatch(name)) {
    if (!_allowedAttrs.contains(name)) return false;
  }
  if (_uriSafeAttrs.contains(name)) return true;
  final compact = value.replaceAll(_attrWhitespace, '');
  if (_isAllowedUri.hasMatch(compact)) return true;
  if ((name == 'src' || name == 'xlink:href' || name == 'href') && tag != 'script' && compact.toLowerCase().startsWith('data:') && _dataUriTags.contains(tag)) {
    return true;
  }
  // ALLOW_UNKNOWN_PROTOCOLS is off: only an empty value passes from here.
  return value.isEmpty;
}

void _sanitizeNode(dom.Node node) {
  for (final child in List<dom.Node>.of(node.nodes)) {
    if (child is dom.Comment) {
      child.remove();
      continue;
    }
    if (child is! dom.Element) continue;
    final tag = (child.localName ?? '').toLowerCase();
    if (!_allowedTags.contains(tag) || kBlogForbiddenTags.contains(tag)) {
      // KEEP_CONTENT: the children stay in place unless the tag's content is forbidden.
      if (!_forbidContents.contains(tag)) {
        _sanitizeNode(child);
        for (final grand in List<dom.Node>.of(child.nodes)) {
          grand.remove();
          node.insertBefore(grand, child);
        }
      }
      child.remove();
      continue;
    }
    final attrs = Map<Object, String>.of(child.attributes);
    for (final entry in attrs.entries) {
      final name = '${entry.key}'.toLowerCase();
      final value = entry.value.trim();
      final keep = name != 'style' &&
          !name.startsWith('on') &&
          !name.startsWith('data-') &&
          _validAttribute(tag, name, value) &&
          !((name == 'id' || name == 'name') && _clobbering.contains(value));
      if (!keep) child.attributes.remove(entry.key);
    }
    _sanitizeNode(child);
  }
}

/// Sanitizes the children of [root] in place.
void sanitizeBlogNode(dom.Node root) => _sanitizeNode(root);

/// `sanitize(html, forbidden)`: the sanitized markup.
String sanitizeBlogHtml(String html) {
  final holder = dom.Element.tag('div')..innerHtml = html;
  _sanitizeNode(holder);
  return holder.innerHtml;
}

/// Same as [sanitizeBlogHtml] but returns the parsed nodes (for `template.content` replacements).
List<dom.Node> sanitizedNodes(String html) {
  final holder = dom.Element.tag('div')..innerHtml = html;
  _sanitizeNode(holder);
  return List<dom.Node>.of(holder.nodes);
}
