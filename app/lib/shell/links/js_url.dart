// Ported from: (WHATWG `new URL()` / `URLSearchParams` / `encodeURIComponent` semantics that
//              src/lib/deeplink.ts, src/lib/pushNav.ts, src/lib/blog-links.ts and
//              src/web-entry/policy.mjs rely on)
import 'dart:convert';

/// Schemes the URL standard treats as "special" (backslash = slash, host lowercased, default port elided).
const Set<String> _special = {'http', 'https', 'ws', 'wss', 'ftp', 'file'};

final RegExp _schemeRe = RegExp(r'^([A-Za-z][A-Za-z0-9+.\-]*):');

/// The subset of the browser `URL` object the ported modules read.
///
/// [JsUrl.parse] returns null where `new URL()` would throw. Differences from Dart's [Uri] that
/// matter for parity are handled explicitly: leading/trailing C0/space are trimmed and tab/newline
/// removed (`' \tjava\nscript:'` → `javascript:`), backslashes count as slashes for special
/// schemes, and the host of a non-special scheme (`anacan://Tools`) keeps its case.
class JsUrl {
  JsUrl._({
    required this.protocol,
    required this.username,
    required this.password,
    required this.hostname,
    required this.port,
    required this.pathname,
    required this.search,
    required this.hash,
    required this.hasAuthority,
  });

  /// `url.protocol`, lower-case with the trailing colon (`https:`).
  final String protocol;
  final String username;
  final String password;

  /// `url.hostname` (lower-cased for special schemes only).
  final String hostname;

  /// `url.port`: empty for the scheme's default port.
  final String port;

  /// `url.pathname` (percent-encoded; `/` for an empty special path).
  final String pathname;

  /// `url.search`: `''` or `'?…'`.
  final String search;
  final String hash;

  /// True when the serialisation contains `//` after the scheme (`anacan://x` yes, `anacan:x` no).
  final bool hasAuthority;

  bool get isSpecial => _special.contains(protocol.substring(0, protocol.length - 1));

  /// `url.origin`: `scheme://host[:port]` for http(s)/ws(s)/ftp, else `'null'`.
  String get origin {
    final scheme = protocol.substring(0, protocol.length - 1);
    if (!const {'http', 'https', 'ws', 'wss', 'ftp'}.contains(scheme)) return 'null';
    return '$protocol//$hostname${port.isEmpty ? '' : ':$port'}';
  }

  /// `url.href`.
  String get href {
    final auth = hasAuthority
        ? '//${username.isNotEmpty || password.isNotEmpty ? '$username${password.isNotEmpty ? ':$password' : ''}@' : ''}$hostname${port.isEmpty ? '' : ':$port'}'
        : '';
    return '$protocol$auth$pathname$search$hash';
  }

  /// `url.searchParams`.
  JsSearchParams get searchParams => JsSearchParams(search);

  @override
  String toString() => href;

  /// `new URL(input, base)`; null where the browser throws.
  static JsUrl? parse(String input, {String? base}) {
    var s = _prep(input);
    final m = _schemeRe.firstMatch(s);
    try {
      if (m == null) {
        if (base == null) return null;
        final b = parse(base);
        if (b == null) return null;
        if (b.isSpecial) s = _slashes(s);
        final baseUri = Uri.parse(b.href);
        final resolved = baseUri.resolve(s);
        return _fromUri(resolved, resolved.toString(), b.isSpecial);
      }
      final scheme = m.group(1)!.toLowerCase();
      final special = _special.contains(scheme);
      if (special) s = _slashes(s);
      if (special) {
        // `https:foo` / `https:/foo` are tolerated by the browser as `https://foo`.
        final rest = s.substring(m.end);
        if (!rest.startsWith('//')) {
          final trimmed = rest.replaceFirst(RegExp(r'^/*'), '');
          s = '$scheme://$trimmed';
        }
      }
      final uri = Uri.parse(s);
      if (special && uri.host.isEmpty && scheme != 'file') return null;
      return _fromUri(uri, s, special);
    } on FormatException {
      return null;
    } on ArgumentError {
      return null;
    }
  }

  static JsUrl _fromUri(Uri uri, String raw, bool special) {
    final scheme = uri.scheme.toLowerCase();
    var host = uri.host;
    if (!special && uri.hasAuthority) {
      // Keep the host's case for non-special schemes (the browser does not lower-case an opaque host).
      final hm = RegExp(r'^[A-Za-z][A-Za-z0-9+.\-]*://([^/?#]*)').firstMatch(raw);
      if (hm != null) {
        var authority = hm.group(1)!;
        final at = authority.lastIndexOf('@');
        if (at != -1) authority = authority.substring(at + 1);
        final colon = authority.lastIndexOf(':');
        if (colon != -1 && !authority.endsWith(']')) authority = authority.substring(0, colon);
        if (authority.toLowerCase() == host) host = authority;
      }
    }
    final info = uri.userInfo;
    final colon = info.indexOf(':');
    final user = colon == -1 ? info : info.substring(0, colon);
    final pass = colon == -1 ? '' : info.substring(colon + 1);
    var path = uri.path;
    if (special && path.isEmpty) path = '/';
    final query = uri.hasQuery && uri.query.isNotEmpty ? '?${uri.query}' : '';
    final frag = uri.hasFragment && uri.fragment.isNotEmpty ? '#${uri.fragment}' : '';
    return JsUrl._(
      protocol: '$scheme:',
      username: user,
      password: pass,
      hostname: host,
      port: uri.hasPort ? '${uri.port}' : '',
      pathname: path,
      search: query,
      hash: frag,
      hasAuthority: uri.hasAuthority,
    );
  }

  static String _prep(String input) {
    var s = input.replaceAll(RegExp(r'^[\u0000- ]+|[\u0000- ]+$'), '');
    return s.replaceAll(RegExp(r'[\t\n\r]'), '');
  }

  /// Backslash → slash before the query (special schemes only).
  static String _slashes(String s) {
    final q = s.indexOf(RegExp(r'[?#]'));
    if (q == -1) return s.replaceAll(r'\', '/');
    return s.substring(0, q).replaceAll(r'\', '/') + s.substring(q);
  }
}

/// `URLSearchParams` over a query string (application/x-www-form-urlencoded, lenient decoding).
class JsSearchParams {
  JsSearchParams(String query) {
    var q = query.startsWith('?') ? query.substring(1) : query;
    for (final part in q.split('&')) {
      if (part.isEmpty) continue;
      final eq = part.indexOf('=');
      final k = eq == -1 ? part : part.substring(0, eq);
      final v = eq == -1 ? '' : part.substring(eq + 1);
      _entries.add(MapEntry(formDecode(k), formDecode(v)));
    }
  }

  final List<MapEntry<String, String>> _entries = [];

  /// First value for [name] or null (`params.get(name)`).
  String? get(String name) {
    for (final e in _entries) {
      if (e.key == name) return e.value;
    }
    return null;
  }

  /// Every value for [name] (`params.getAll(name)`).
  List<String> getAll(String name) => [for (final e in _entries) if (e.key == name) e.value];

  /// `+` → space, then percent-decoding that leaves malformed sequences as they are.
  static String formDecode(String s) => percentDecodeLenient(s.replaceAll('+', ' '));
}

/// The URL standard's percent-decode: valid `%XX` bytes are decoded, everything else is kept.
String percentDecodeLenient(String s) {
  if (!s.contains('%')) return s;
  final bytes = <int>[];
  final src = utf8.encode(s);
  for (var i = 0; i < src.length; i++) {
    final c = src[i];
    if (c == 0x25 && i + 2 < src.length && _isHex(src[i + 1]) && _isHex(src[i + 2])) {
      bytes.add(int.parse(String.fromCharCodes([src[i + 1], src[i + 2]]), radix: 16));
      i += 2;
    } else {
      bytes.add(c);
    }
  }
  return utf8.decode(bytes, allowMalformed: true);
}

bool _isHex(int c) => (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);

/// `decodeURIComponent`: throws [FormatException] on a malformed sequence (like the browser's URIError).
String decodeUriComponent(String s) {
  if (!s.contains('%')) return s;
  final bytes = <int>[];
  final src = utf8.encode(s);
  for (var i = 0; i < src.length; i++) {
    final c = src[i];
    if (c == 0x25) {
      if (i + 2 >= src.length || !_isHex(src[i + 1]) || !_isHex(src[i + 2])) {
        throw const FormatException('URI malformed');
      }
      bytes.add(int.parse(String.fromCharCodes([src[i + 1], src[i + 2]]), radix: 16));
      i += 2;
    } else {
      bytes.add(c);
    }
  }
  try {
    return utf8.decode(bytes);
  } on FormatException {
    throw const FormatException('URI malformed');
  }
}

/// `encodeURIComponent` (Dart's [Uri.encodeComponent] keeps the same unreserved set).
String encodeUriComponent(String s) => Uri.encodeComponent(s);
