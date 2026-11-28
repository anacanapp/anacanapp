// Ported from: src/lib/game-score-sync.ts, src/lib/game-score-messages.ts
//
// `submit_game_score_v1` contract: a result is bound to the account and backend realm that produced it; the
// submission id is the idempotency key (a retry re-sends the same one); account / realm changes while waiting
// never write to or return a receipt for another account; backend error text is never shown.
library;

import 'dart:math' as math;

import '../engine/score_submission.dart';

class GameScoreInput {
  const GameScoreInput({required this.score, required this.level});
  final num score;
  final num level;
}

class GameScoreSubmission {
  const GameScoreSubmission({required this.score, required this.level, required this.userId, required this.realm, required this.gameId, required this.submissionId});
  final num score;
  final num level;
  final String? userId;
  final String realm;
  final String gameId;
  final String submissionId;

  GameScoreSubmission withUser(String? userId) =>
      GameScoreSubmission(score: score, level: level, userId: userId, realm: realm, gameId: gameId, submissionId: submissionId);
}

class GameScoreReceipt {
  const GameScoreReceipt(this.json);
  final Map<String, Object?> json;
  String get userId => json['userId'] as String;
  String get gameId => json['gameId'] as String;
  String get submissionId => json['submissionId'] as String;
  num get bestScore => json['bestScore'] as num;
  num get bestLevel => json['bestLevel'] as num;
  num get totalPlays => json['totalPlays'] as num;
  bool get duplicate => json['duplicate'] as bool;
}

/// `GameScoreSyncError(code)`: `signin` | `account_changed` | `invalid_result` | `server_update` | `failed`.
class GameScoreSyncError implements Exception {
  const GameScoreSyncError(this.code);
  final String code;
  String get message => code;
  @override
  String toString() => 'GameScoreSyncError($code)';
}

/// `{ data, error }` of an RPC call (error without backend text leaking out).
class GameRpcResult {
  const GameRpcResult({this.data, this.errorCode, this.errorMessage, this.failed = false});
  final Object? data;
  final String? errorCode;
  final String? errorMessage;

  /// `result.error` is set.
  final bool failed;
}

/// The client surface `submitGameScore` needs (`supabase.auth.getSession`, `supabase.rpc`).
abstract interface class GameScoreClient {
  /// `getSession()` → `{ data: { session: { user: { id } } | null }, error }`.
  Future<({String? userId, Object? error})> getSession();
  Future<GameRpcResult> rpc(String name, Map<String, Object?> args);
}

/// `crypto.randomUUID()` (v4).
String randomUuidV4([math.Random? random]) {
  final r = random ?? math.Random.secure();
  final bytes = List<int>.generate(16, (_) => r.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

GameScoreSubmission createGameScoreSubmission(GameScoreInput input, String? userId, String realm, String gameId, {String Function()? uuid}) =>
    GameScoreSubmission(score: input.score, level: input.level, userId: userId, realm: realm, gameId: gameId, submissionId: (uuid ?? randomUuidV4)());

Future<GameScoreReceipt> submitGameScore(GameScoreClient client, GameScoreSubmission submission, bool Function() stillCurrent) async {
  final userId = submission.userId;
  if (userId == null || userId.isEmpty) throw const GameScoreSyncError('signin');
  if (!stillCurrent()) throw const GameScoreSyncError('account_changed');
  if (validateGameScoreSubmission(userId: userId, gameId: submission.gameId, score: submission.score, level: submission.level) != null) {
    throw const GameScoreSyncError('invalid_result');
  }
  final session = await client.getSession();
  if (!stillCurrent() || session.userId != userId) throw const GameScoreSyncError('account_changed');
  if (session.error != null) throw const GameScoreSyncError('failed');
  final result = await client.rpc('submit_game_score_v1', {
    'p_expected_user_id': userId,
    'p_game_id': submission.gameId,
    'p_submission_id': submission.submissionId,
    'p_score': submission.score,
    'p_level': submission.level,
  });
  if (!stillCurrent()) throw const GameScoreSyncError('account_changed');
  if (result.failed) {
    throw GameScoreSyncError(result.errorCode == 'PGRST202'
        ? 'server_update'
        : result.errorCode == '42501' || result.errorMessage == 'game_score_account_changed'
            ? 'account_changed'
            : 'failed');
  }
  final data = result.data;
  final receipt = data is Map ? data.cast<String, Object?>() : null;
  if (!validGameScoreReceipt(receipt,
      userId: userId, gameId: submission.gameId, submissionId: submission.submissionId, score: submission.score, level: submission.level)) {
    throw const GameScoreSyncError('failed');
  }
  return GameScoreReceipt(receipt!);
}

// ── game-score-messages.ts ──

const Map<String, Map<String, String>> _scoreCopies = {
  'az': {
    'loginTitle': 'Reytinqə qoşul', 'loginDescription': 'Oyunçu adlarını görmək və xalını reytinqə yazmaq üçün hesabına daxil ol.',
    'login': 'Hesaba daxil ol', 'loadingError': 'Reytinq yüklənmədi', 'loadingDescription': 'Şəbəkəni və giriş sessiyanı yoxlayıb yenidən cəhd et.',
    'retry': 'Yenidən yoxla', 'localOnly': 'Xal bu cihazda saxlanıldı. Reytinq üçün hesabına daxil ol.',
    'failed': 'Xal cihazda saxlanıldı, amma reytinqə göndərilmədi.', 'accountChanged': 'Hesab dəyişib. Bu nəticə başqa hesaba göndərilmədi.',
    'saved': 'Xal reytinqə yazıldı', 'serverUpdate': 'Reytinq xidməti yenilənməlidir. Xal cihazda saxlanılıb.',
  },
  'en': {
    'loginTitle': 'Join the leaderboard', 'loginDescription': 'Sign in to see player names and add your score to the leaderboard.', 'login': 'Sign in',
    'loadingError': 'Leaderboard could not load', 'loadingDescription': 'Check your connection and sign-in session, then try again.', 'retry': 'Try again',
    'localOnly': 'Your score is saved on this device. Sign in to join the leaderboard.',
    'failed': 'Your score is saved locally, but was not sent to the leaderboard.',
    'accountChanged': 'The account changed. This result was not sent to another account.', 'saved': 'Score added to the leaderboard',
    'serverUpdate': 'The leaderboard service needs an update. Your score is saved locally.',
  },
  'tr': {
    'loginTitle': 'Sıralamaya katıl', 'loginDescription': 'Oyuncu adlarını görmek ve puanını sıralamaya eklemek için hesabına giriş yap.', 'login': 'Giriş yap',
    'loadingError': 'Sıralama yüklenemedi', 'loadingDescription': 'Bağlantını ve giriş oturumunu kontrol edip tekrar dene.', 'retry': 'Tekrar dene',
    'localOnly': 'Puanın bu cihazda kaydedildi. Sıralama için giriş yap.', 'failed': 'Puanın cihazda kaydedildi ancak sıralamaya gönderilemedi.',
    'accountChanged': 'Hesap değişti. Bu sonuç başka hesaba gönderilmedi.', 'saved': 'Puan sıralamaya eklendi',
    'serverUpdate': 'Sıralama hizmeti güncellenmeli. Puanın cihazda kayıtlı.',
  },
  'ru': {
    'loginTitle': 'Присоединиться к рейтингу', 'loginDescription': 'Войдите в аккаунт, чтобы видеть имена игроков и добавлять свои очки в рейтинг.',
    'login': 'Войти', 'loadingError': 'Рейтинг не загрузился', 'loadingDescription': 'Проверьте подключение и вход в аккаунт, затем повторите попытку.',
    'retry': 'Повторить', 'localOnly': 'Очки сохранены на устройстве. Войдите, чтобы добавить их в рейтинг.',
    'failed': 'Очки сохранены на устройстве, но не отправлены в рейтинг.', 'accountChanged': 'Аккаунт изменился. Результат не отправлен в другой аккаунт.',
    'saved': 'Очки добавлены в рейтинг', 'serverUpdate': 'Сервис рейтинга требует обновления. Очки сохранены на устройстве.',
  },
  'de': {
    'loginTitle': 'An der Rangliste teilnehmen', 'loginDescription': 'Melde dich an, um Spielernamen zu sehen und deine Punkte in die Rangliste einzutragen.',
    'login': 'Anmelden', 'loadingError': 'Rangliste nicht geladen', 'loadingDescription': 'Prüfe deine Verbindung und Anmeldung und versuche es erneut.',
    'retry': 'Erneut versuchen', 'localOnly': 'Deine Punkte sind auf diesem Gerät gespeichert. Melde dich für die Rangliste an.',
    'failed': 'Deine Punkte sind lokal gespeichert, wurden aber nicht an die Rangliste gesendet.',
    'accountChanged': 'Das Konto hat sich geändert. Dieses Ergebnis wurde nicht an ein anderes Konto gesendet.', 'saved': 'Punkte zur Rangliste hinzugefügt',
    'serverUpdate': 'Der Ranglistendienst muss aktualisiert werden. Deine Punkte sind lokal gespeichert.',
  },
  'ar': {
    'loginTitle': 'انضم إلى لوحة الترتيب', 'loginDescription': 'سجّل الدخول لرؤية أسماء اللاعبين وإضافة نقاطك إلى لوحة الترتيب.', 'login': 'تسجيل الدخول',
    'loadingError': 'تعذّر تحميل الترتيب', 'loadingDescription': 'تحقق من الاتصال وجلسة تسجيل الدخول ثم حاول مرة أخرى.', 'retry': 'حاول مرة أخرى',
    'localOnly': 'حُفظت نقاطك على هذا الجهاز. سجّل الدخول للانضمام إلى الترتيب.', 'failed': 'حُفظت النقاط على الجهاز، لكن لم تُرسل إلى الترتيب.',
    'accountChanged': 'تغيّر الحساب. لم تُرسل هذه النتيجة إلى حساب آخر.', 'saved': 'أُضيفت النقاط إلى الترتيب',
    'serverUpdate': 'تحتاج خدمة الترتيب إلى تحديث. نقاطك محفوظة على الجهاز.',
  },
  'kk': {
    'loginTitle': 'Рейтингке қосылу', 'loginDescription': 'Ойыншылардың аттарын көру және ұпайыңызды рейтингке қосу үшін аккаунтыңызға кіріңіз.',
    'login': 'Кіру', 'loadingError': 'Рейтинг жүктелмеді', 'loadingDescription': 'Байланыс пен аккаунтқа кіру күйін тексеріп, қайталап көріңіз.',
    'retry': 'Қайталау', 'localOnly': 'Ұпайыңыз осы құрылғыда сақталды. Рейтингке қосылу үшін кіріңіз.',
    'failed': 'Ұпай құрылғыда сақталды, бірақ рейтингке жіберілмеді.', 'accountChanged': 'Аккаунт өзгерді. Бұл нәтиже басқа аккаунтқа жіберілмеді.',
    'saved': 'Ұпай рейтингке қосылды', 'serverUpdate': 'Рейтинг қызметін жаңарту қажет. Ұпайыңыз құрылғыда сақталған.',
  },
  'uz': {
    'loginTitle': 'Reytingga qo‘shilish', 'loginDescription': 'O‘yinchilar ismlarini ko‘rish va ballingizni reytingga qo‘shish uchun hisobingizga kiring.',
    'login': 'Hisobga kirish', 'loadingError': 'Reyting yuklanmadi', 'loadingDescription': 'Ulanish va kirish seansini tekshirib, yana urinib ko‘ring.',
    'retry': 'Qayta urinish', 'localOnly': 'Ballingiz shu qurilmada saqlandi. Reyting uchun hisobga kiring.',
    'failed': 'Ball qurilmada saqlandi, ammo reytingga yuborilmadi.', 'accountChanged': 'Hisob o‘zgardi. Bu natija boshqa hisobga yuborilmadi.',
    'saved': 'Ball reytingga qo‘shildi', 'serverUpdate': 'Reyting xizmati yangilanishi kerak. Ballingiz qurilmada saqlangan.',
  },
  'ka': {
    'loginTitle': 'შეუერთდი რეიტინგს', 'loginDescription': 'მოთამაშეთა სახელების სანახავად და ქულის რეიტინგში დასამატებლად შედი ანგარიშში.',
    'login': 'ანგარიშში შესვლა', 'loadingError': 'რეიტინგი ვერ ჩაიტვირთა', 'loadingDescription': 'შეამოწმე კავშირი და ანგარიშში შესვლა, შემდეგ სცადე ხელახლა.',
    'retry': 'ხელახლა ცდა', 'localOnly': 'ქულა ამ მოწყობილობაზე შეინახა. რეიტინგისთვის შედი ანგარიშში.',
    'failed': 'ქულა მოწყობილობაზე შეინახა, მაგრამ რეიტინგში ვერ გაიგზავნა.', 'accountChanged': 'ანგარიში შეიცვალა. შედეგი სხვა ანგარიშზე არ გაგზავნილა.',
    'saved': 'ქულა რეიტინგს დაემატა', 'serverUpdate': 'რეიტინგის სერვისს განახლება სჭირდება. ქულა მოწყობილობაზე შენახულია.',
  },
};

/// `gameScoreMessage(key)` for the persisted app language (`copies[lang] ?? copies.az`).
String gameScoreMessage(String language, String key) => (_scoreCopies[language] ?? _scoreCopies['az']!)[key]!;
