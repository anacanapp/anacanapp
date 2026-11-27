// Ported from: src/lib/session-persistence.ts, src/integrations/supabase/auth-storage-key.ts
// (JavaScript `encodeURIComponent`, used to build storage keys).

import 'dart:convert';

/// Byte-exact port of JavaScript `encodeURIComponent`: keeps
/// `A-Z a-z 0-9 - _ . ! ~ * ' ( )` and percent-encodes everything else as
/// upper-case UTF-8 escapes. Dart's [Uri.encodeComponent] also escapes
/// `! * ' ( )`, so it would produce different storage keys.
String encodeUriComponent(String value) {
  const unreserved = "-_.!~*'()";
  final out = StringBuffer();
  for (final byte in utf8.encode(value)) {
    final isAlnum = (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5A) ||
        (byte >= 0x61 && byte <= 0x7A);
    if (isAlnum || (byte < 0x80 && unreserved.contains(String.fromCharCode(byte)))) {
      out.writeCharCode(byte);
    } else {
      out.write('%${byte.toRadixString(16).toUpperCase().padLeft(2, '0')}');
    }
  }
  return out.toString();
}
