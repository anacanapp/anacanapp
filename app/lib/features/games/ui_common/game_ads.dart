// Ported from: src/hooks/useGameAds.ts
//
// `useGameAds(gameId, phase, restore)`: the terminal-transition interstitial (`games_break_interstitial`, only
// when leaving a won/lost round) and the rewarded revive (`game_revive_rewarded`, only while `lost`, at most
// `max_revives` per round, Premium skips the video). Ads arrive in phase 9: [gameAdsPlatformProvider] defaults to
// [NoGameAdsPlatform] — no configuration, so no revive is offered and every transition runs at once, exactly what
// the React hook does without an ads configuration.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/ads/ads_config.dart' show AdPlacementConfig, AdsConfiguration;
import '../../../domain/ads/ads_policy.dart' show AdDecision, adReasonLabels;

class GameReviveBenefits {
  const GameReviveBenefits({required this.lives, required this.moves, required this.seconds});
  final int lives;
  final int moves;
  final int seconds;

  @override
  bool operator ==(Object other) => other is GameReviveBenefits && other.lives == lives && other.moves == moves && other.seconds == seconds;
  @override
  int get hashCode => Object.hash(lives, moves, seconds);
  @override
  String toString() => 'GameReviveBenefits(lives: $lives, moves: $moves, seconds: $seconds)';
}

/// The slice of `useAdExperience()` + `useSubscription()` the games use.
abstract interface class GameAdsPlatform {
  AdsConfiguration? get configuration;
  bool get busy;

  /// `ads.preview.enabled ? ads.preview.premium : subscription.isPremium`.
  bool get premium;
  VoidCallback registerSurface(String placement);
  bool opportunity(String placement, String key);
  Future<bool> showInterstitial(String placement);
  Future<bool> showRewarded(String placement);
  AdDecision decisionFor(String placement);
}

/// No ads configuration (React without the ads provider / before phase 9).
class NoGameAdsPlatform implements GameAdsPlatform {
  const NoGameAdsPlatform({this.premium = false});
  @override
  final bool premium;
  @override
  AdsConfiguration? get configuration => null;
  @override
  bool get busy => false;
  @override
  VoidCallback registerSurface(String placement) => () {};
  @override
  bool opportunity(String placement, String key) => false;
  @override
  Future<bool> showInterstitial(String placement) async => false;
  @override
  Future<bool> showRewarded(String placement) async => false;
  @override
  AdDecision decisionFor(String placement) =>
      const AdDecision(allowed: false, reason: 'configuration', waitSeconds: 0, mode: 'demo', adUnitId: null);
}

final gameAdsPlatformProvider = Provider<GameAdsPlatform>((ref) => const NoGameAdsPlatform());

const String gamesBreakInterstitial = 'games_break_interstitial';
const String gameReviveRewarded = 'game_revive_rewarded';

/// React literal (useGameAds.ts, not localised there either).
const String gameReviveFailedMessage = 'Video tamamlanmadı və ya reklam hazır deyil. Can / gediş dəyişmədi.';

int _roundSeq = 0;
String _newRound() => 'round-${DateTime.now().microsecondsSinceEpoch}-${++_roundSeq}';

/// One hook instance. Create it in `initState`, call [update] on every build (phase and restore change like hook
/// arguments) and [dispose] it with the State. Listeners fire when `waiting` / `message` / `used` change.
class GameAdsController extends ChangeNotifier {
  GameAdsController({required this.gameId, required GameAdsPlatform platform, required String phase, required void Function(GameReviveBenefits) restore})
      : _platform = platform,
        _phase = phase, // ignore: prefer_initializing_formals
        _restore = restore { // ignore: prefer_initializing_formals
    _clearBreak = platform.registerSurface(gamesBreakInterstitial);
    _clearReward = platform.registerSurface(gameReviveRewarded);
  }

  final String gameId;
  GameAdsPlatform _platform;
  String _phase;
  void Function(GameReviveBenefits) _restore;
  late VoidCallback _clearBreak;
  late VoidCallback _clearReward;

  String _round = _newRound();
  bool _alive = true;
  bool _acting = false;
  int _uses = 0;

  int _used = 0;
  bool _waiting = false;
  String _message = '';

  /// The latest hook arguments (`state.current = {...}`).
  void update({required String phase, required void Function(GameReviveBenefits) restore, GameAdsPlatform? platform}) {
    _phase = phase;
    _restore = restore;
    if (platform != null && !identical(platform, _platform)) {
      _clearBreak();
      _clearReward();
      _platform = platform;
      _clearBreak = platform.registerSurface(gamesBreakInterstitial);
      _clearReward = platform.registerSurface(gameReviveRewarded);
    }
  }

  void _set(VoidCallback change) {
    change();
    if (_alive) notifyListeners();
  }

  void resetRound() {
    _round = _newRound();
    _uses = 0;
    _set(() {
      _used = 0;
      _message = '';
    });
  }

  /// Runs [action] after the break interstitial when the round ended (won / lost) and the cadence allows it.
  Future<void> transition(VoidCallback action) async {
    if (_acting) return;
    _acting = true;
    _set(() => _waiting = true);
    final token = _round;
    try {
      if ((_phase == 'won' || _phase == 'lost') && _platform.opportunity(gamesBreakInterstitial, '$gameId:$token')) {
        await _platform.showInterstitial(gamesBreakInterstitial);
      }
      if (_alive && _round == token) action();
    } finally {
      _acting = false;
      if (_alive) _set(() => _waiting = false);
    }
  }

  AdPlacementConfig? get _config {
    for (final item in _platform.configuration?.placements ?? const <AdPlacementConfig>[]) {
      if (item.id == gameReviveRewarded) return item;
    }
    return null;
  }

  /// Rewarded revive: restores only after an earned reward (Premium: at once), once per allowed use.
  Future<void> revive() async {
    final config = _config;
    if (_acting || _phase != 'lost' || config == null || !config.enabled || _uses >= config.maxRevives) return;
    _acting = true;
    _set(() {
      _waiting = true;
      _message = '';
    });
    final token = _round;
    try {
      final earned = _platform.premium || await _platform.showRewarded(gameReviveRewarded);
      if (!_alive || token != _round || _phase != 'lost') return;
      if (earned) {
        _uses++;
        _used = _uses;
        _phase = 'playing';
        _restore(GameReviveBenefits(lives: config.reviveLives, moves: config.reviveMoves, seconds: config.reviveSeconds));
        _set(() {});
      } else {
        _set(() => _message = gameReviveFailedMessage);
      }
    } finally {
      _acting = false;
      if (_alive) _set(() => _waiting = false);
    }
  }

  bool get waiting => _waiting || _platform.busy;
  String get message => _message;
  bool get premium => _platform.premium;
  int get used => _used;
  GameReviveBenefits get benefits {
    final config = _config;
    return GameReviveBenefits(lives: config?.reviveLives ?? 3, moves: config?.reviveMoves ?? 5, seconds: config?.reviveSeconds ?? 15);
  }

  bool get canOffer {
    final config = _config;
    return _phase == 'lost' && config != null && config.enabled && _used < config.maxRevives;
  }

  bool get canRequest {
    final decision = _platform.decisionFor(gameReviveRewarded);
    return premium || decision.allowed || decision.reason == 'consent';
  }

  String get reason {
    final decision = _platform.decisionFor(gameReviveRewarded);
    return adReasonLabels[decision.reason] ?? decision.reason;
  }

  /// `data-ad-allow` of the game root.
  String get allowedPlacements => _phase == 'lost'
      ? '$gamesBreakInterstitial $gameReviveRewarded'
      : (_phase == 'intro' || _phase == 'won')
          ? gamesBreakInterstitial
          : '';

  @override
  void dispose() {
    _alive = false;
    _clearBreak();
    _clearReward();
    super.dispose();
  }
}
