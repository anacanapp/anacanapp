import { describe, expect, it } from 'vitest';
import { isAuthCancellation } from './crashReporter';

describe('auth cancellation filter', () => {
  it.each([
    'İşlem tamamlanamadı. (com.apple.AuthenticationServices.AuthorizationError hatası 1001.)',
    'Не удалось завершить операцию. (com.apple.AuthenticationServices.AuthorizationError, ошибка 1001)',
    'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)',
    'تعذر إكمال العملية. (خطأ 1001 في com.apple.AuthenticationServices.AuthorizationError.)',
    'Der Vorgang konnte nicht abgeschlossen werden. (com.apple.AuthenticationServices.AuthorizationError-Fehler 1001.)',
    'The user canceled the sign-in flow.', 'User cancelled the selector', '[16] Cancelled by user.',
    'activity is cancelled by the user.', 'No credentials available', 'No credentials available.',
    'During begin sign in, failure response from one tap: 16: [28439] User disabled the feature.',
  ])('drops %s', (m) => expect(isAuthCancellation(m)).toBe(true));
  it.each([
    'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)',
    "Your device doesn't support credential manager", 'Сетевое соединение потеряно.', 'ID Token expired',
    'Unacceptable audience in id_token: [x]', 'Bad ID token', 'Database error saving new user',
  ])('keeps %s', (m) => expect(isAuthCancellation(m)).toBe(false));
});
