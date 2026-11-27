// Ported from: src/lib/partner-link.test.ts (code validation, server-answer and message cases; the RPC transport
// and the VITE_AZURE_PARTNER_PAIRING switch belong to the backend client port)

import 'package:anacan/domain/partner/partner_link.dart';
import 'package:flutter_test/flutter_test.dart';

Matcher throwsCode(String code) => throwsA(isA<PartnerLinkError>().having((e) => e.code, 'code', code));

void main() {
  group('Azure pairing opt-in', () {
    test('normalizes current 6/8 character codes and sends only the code', () {
      expect(normalizeSecurePartnerCode('  anacan-abcd23  '), 'ANACAN-ABCD23');
      expect(normalizeSecurePartnerCode('  anacan-abcd2345  '), 'ANACAN-ABCD2345');
    });
    test('accepts idempotent success without any client-side link updates', () {
      expect(() => checkLinkPartnerResult({'ok': true}), returnsNormally);
    });
    test('rejects weak invitations before any signup preflight or RPC', () {
      expect(() => normalizeSecurePartnerCode(' anacan-a01f '), throwsCode('PARTNER_CODE_EXPIRED'));
      expect(getPartnerLinkErrorMessage(const PartnerLinkError('PARTNER_CODE_EXPIRED')), contains('share a new code'));
    });
    for (final code in ['', 'ANACAN-ABCDE', 'ANACAN-ABCDEF2', 'ANACAN-ABCD01', 'ANACAN-ABCDEFGI', 'ANACAN-ABCD23456', 'X' * 65, null]) {
      test('rejects malformed or oversized input $code', () => expect(() => normalizeSecurePartnerCode(code), throwsCode('INVALID_PARTNER_CODE')));
    }
    for (final error in ['PAIRING_SELF_LINK', 'PAIRING_CONFLICT', 'PAIRING_RATE_LIMITED', 'PROFILE_NOT_READY', 'PAIRING_RETRY']) {
      test('propagates the server rejection $error without falling back', () {
        expect(() => checkLinkPartnerResult({'ok': false, 'error': error}), throwsCode(error));
      });
    }
    for (final data in <Object?>[null, false, true, <Object?>[], <String, Object?>{}, {'ok': false}, {'ok': 'true'}]) {
      test('does not mistake $data for success', () => expect(() => checkLinkPartnerResult(data), throwsCode('PAIRING_FAILED')));
    }
  });

  group('secure invitation sharing', () {
    for (final code in ['ANACAN-ABCD23', 'ANACAN-ABCD2345']) {
      test('uses the owner-authenticated RPC value $code', () => expect(checkSharedPartnerCode(code), code));
    }
    for (final data in <Object?>[null, 'ANACAN-A01F', false]) {
      test('does not share a stale code when the server returns $data', () => expect(() => checkSharedPartnerCode(data), throwsCode('PAIRING_UNAVAILABLE')));
    }
    test('propagates rotation errors and hides unrecognized server details in UI messages', () {
      final error = {'code': 'PGRST202', 'message': 'private-server-detail'};
      expect(getPartnerLinkErrorMessage(error), isNot(contains('private-server-detail')));
      expect(getPartnerLinkErrorMessage({'code': 'P0001', 'message': 'PROFILE_NOT_READY'}), contains('do not register again'));
    });
  });
}
