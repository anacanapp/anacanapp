// Ported from: src/components/tools/WhiteNoise.tsx
//
// Sleep sounds (`whitenoise`, host of the noise-meter section): DB sounds grouped by noise colour, the shared
// player (state/white_noise_store.dart), volume, sleep timer and the free-tier usage tracking. Listening is
// Premium-only (2026-11-09): free users browse the sounds and a tap opens the paywall.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/white_noise_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../data/data.dart' show whiteNoiseSoundsQuery;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/media_ports.dart';
import '../media_common/tw_gradient.dart';
import 'user_preferences.dart';

/// A DB sound in the component shape.
class WhiteNoiseItem {
  const WhiteNoiseItem({
    required this.id,
    required this.name,
    required this.emoji,
    required this.color,
    required this.noiseType,
    required this.description,
    this.audioUrl,
  });
  final String id;
  final String name;
  final String emoji;
  final String color;
  final String noiseType;
  final String description;
  final String? audioUrl;

  factory WhiteNoiseItem.fromRow(Map<String, dynamic> s) {
    String str(String k, String fallback) => s[k] is String && (s[k] as String).isNotEmpty ? s[k] as String : fallback;
    return WhiteNoiseItem(
      id: '${s['id']}',
      name: str('name', ''),
      emoji: str('emoji', ''),
      color: str('color_gradient', 'from-blue-400 to-cyan-500'),
      noiseType: str('noise_type', 'white'),
      description: str('description', ''),
      audioUrl: s['audio_url'] is String && (s['audio_url'] as String).isNotEmpty ? s['audio_url'] as String : null,
    );
  }

  WhiteNoiseSound get sound => WhiteNoiseSound(id: id, name: name, emoji: emoji, color: color, noiseType: noiseType, audioUrl: audioUrl);
}

/// Sounds by noise type (`white` / `pink` / `brown`); unknown types join `white`.
Map<String, List<WhiteNoiseItem>> groupWhiteNoiseSounds(List<WhiteNoiseItem> sounds) {
  final groups = <String, List<WhiteNoiseItem>>{'white': [], 'pink': [], 'brown': []};
  for (final s in sounds) {
    (groups[s.noiseType] ?? groups['white']!).add(s);
  }
  return groups;
}

/// `formatTime(seconds)` → `m:ss`.
String formatWhiteNoiseTime(int seconds) => '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

/// `WAVE_BARS`: deterministic heights / durations / delays.
final List<({double height, double duration, double delay})> kWaveBars = [
  for (var i = 0; i < 24; i++) (height: 22.0 + (i * 7) % 5 * 5, duration: 0.4 + (i * 37) % 10 / 25, delay: i * 0.03),
];

/// The clock of the timer (tests).
final whiteNoiseClockProvider = Provider<int Function()>(
  (ref) =>
      () => DateTime.now().millisecondsSinceEpoch,
);

class WhiteNoise extends ConsumerStatefulWidget {
  const WhiteNoise({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<WhiteNoise> createState() => _WhiteNoiseState();
}

class _WhiteNoiseState extends ConsumerState<WhiteNoise> {
  int? _timer;
  int? _endAt;
  int _lastTrackTime = 0;
  Timer? _trackingInterval;
  Timer? _timeout;

  Object? _prefsSeen;
  bool? _premiumSeen;
  int? _soundsSeen;
  (String?, int?, bool, int?)? _timeoutDeps;
  (String?, bool)? _trackingDeps;

  int _now() => ref.read(whiteNoiseClockProvider)();

  @override
  void initState() {
    super.initState();
    _lastTrackTime = _now();
  }

  @override
  void dispose() {
    _timeout?.cancel();
    _stopTracking();
    super.dispose();
  }

  MediaUsage get _usage => ref.read(mediaUsageProvider);
  WhiteNoiseStore get _store => ref.read(whiteNoiseStoreProvider.notifier);
  UserPreferences get _prefs => ref.read(userPreferencesProvider.notifier);

  void _setTimeRemaining(num? seconds) {
    final value = seconds != null && seconds.isFinite && seconds > 0 ? _now() + (seconds * 1000).round() : null;
    if (mounted) setState(() => _endAt = value);
  }

  void _openPremium() => ref.read(mediaPremiumModalProvider)(context, tr('whitenoise_limitsiz_yuxu_sesleri_b0b439', 'Limitsiz yuxu səsləri'));

  // ── effects ──

  void _syncEffects(List<WhiteNoiseItem> sounds) {
    final prefs = ref.read(userPreferencesProvider).preferences;
    final isPremium = _usage.isPremium;
    // Initialize from preferences ([preferences, isPremium, sounds.length]).
    if (!identical(prefs, _prefsSeen) || isPremium != _premiumSeen || sounds.length != _soundsSeen) {
      _prefsSeen = prefs;
      _premiumSeen = isPremium;
      _soundsSeen = sounds.length;
      if (prefs != null) _initFromPreferences(prefs, isPremium, sounds);
    }
    final active = ref.read(whiteNoiseStoreProvider).activeSoundId;
    // Timer countdown ([activeSound, endAt, isPremium, timer]).
    final timeoutDeps = (active, _endAt, isPremium, _timer);
    if (timeoutDeps != _timeoutDeps) {
      _timeoutDeps = timeoutDeps;
      _timeout?.cancel();
      _timeout = null;
      final endAt = _endAt;
      if (active != null && endAt != null) {
        final timer = _timer;
        _timeout = Timer(Duration(milliseconds: math.max(0, endAt - _now())), () {
          if (!mounted) return;
          setState(() => _endAt = null);
          _store.stop();
          unawaited(_prefs.updateLastWhiteNoiseSound(null));
          if (!isPremium && timer == null) _openPremium();
        });
      }
    }
    // Usage tracking for free users ([activeSound, isPremium]).
    final trackingDeps = (active, isPremium);
    if (trackingDeps != _trackingDeps) {
      _trackingDeps = trackingDeps;
      _stopTracking();
      if (active != null && !isPremium) {
        _trackingInterval = Timer.periodic(const Duration(seconds: 10), (_) {
          final now = _now();
          final elapsed = (now - _lastTrackTime) ~/ 1000;
          if (elapsed >= 10) {
            unawaited(_usage.trackWhiteNoiseUsage(10));
            _lastTrackTime = now;
          }
        });
      }
    }
  }

  void _stopTracking() {
    final interval = _trackingInterval;
    if (interval == null) return;
    interval.cancel();
    _trackingInterval = null;
    final elapsed = (_now() - _lastTrackTime) ~/ 1000;
    if (elapsed > 0) unawaited(_usage.trackWhiteNoiseUsage(elapsed));
  }

  void _initFromPreferences(Map<String, dynamic> prefs, bool isPremium, List<WhiteNoiseItem> sounds) {
    final volume = prefs['white_noise_volume'];
    _store.setVolume(volume is num && volume != 0 ? volume : 70);
    final timer = prefs['white_noise_timer'];
    setState(() => _timer = timer is num ? timer.toInt() : null);
    final last = prefs['last_white_noise_sound'];
    if (last is String && last.isNotEmpty && !ref.read(whiteNoiseStoreProvider).isPlaying && isPremium) {
      final sound = sounds.where((s) => s.id == last).firstOrNull;
      if (sound != null) {
        _store.play(sound.sound);
        if (timer is num && timer != 0) _setTimeRemaining(timer * 60);
      }
    }
  }

  // ── actions ──

  Future<void> _handleSoundToggle(String soundId, List<WhiteNoiseItem> sounds) async {
    final isPremium = _usage.isPremium;
    if (ref.read(whiteNoiseStoreProvider).activeSoundId == soundId) {
      final now = _now();
      final elapsed = (now - _lastTrackTime) ~/ 1000;
      if (elapsed > 0 && !isPremium) await _usage.trackWhiteNoiseUsage(elapsed);
      _store.stop();
      _setTimeRemaining(null);
      await _prefs.updateLastWhiteNoiseSound(null);
    } else {
      if (!isPremium) {
        _openPremium();
        return;
      }
      final remaining = _usage.canUseWhiteNoise().remainingSeconds;
      _lastTrackTime = _now();
      final sound = sounds.where((s) => s.id == soundId).firstOrNull;
      if (sound == null) return;
      _store.play(sound.sound);
      await _prefs.updateLastWhiteNoiseSound(soundId);
      if (_usage.isPremium) {
        _setTimeRemaining(_timer != null ? _timer! * 60 : null);
        return;
      }
      final requested = _timer != null ? _timer! * 60 : remaining;
      _setTimeRemaining(math.min(requested, remaining));
    }
  }

  Future<void> _handleVolumeChange(int volume) async {
    _store.setVolume(volume);
    _store.setMuted(false);
    await _prefs.updateWhiteNoiseVolume(volume);
  }

  Future<void> _handleTimerChange(int? newTimer) async {
    final isPremium = _usage.isPremium;
    if (!isPremium && newTimer == null) {
      _openPremium();
      return;
    }
    setState(() => _timer = newTimer);
    await _prefs.updateWhiteNoiseTimer(newTimer);
    if (ref.read(whiteNoiseStoreProvider).activeSoundId == null) {
      _setTimeRemaining(newTimer != null ? newTimer * 60 : null);
      return;
    }
    if (isPremium) {
      _setTimeRemaining(newTimer != null ? newTimer * 60 : null);
      return;
    }
    final info = _usage.canUseWhiteNoise();
    if (!info.allowed) {
      _store.stop();
      await _prefs.updateLastWhiteNoiseSound(null);
      if (mounted) _openPremium();
      _setTimeRemaining(null);
      return;
    }
    if (newTimer != null) _setTimeRemaining(math.min(newTimer * 60, info.remainingSeconds));
  }

  // ── build ──

  @override
  Widget build(BuildContext context) {
    final prefsState = ref.watch(userPreferencesProvider);
    final soundsQuery = ref.watch(whiteNoiseSoundsQuery);
    final usage = ref.watch(mediaUsageProvider);
    final player = ref.watch(whiteNoiseStoreProvider);
    final sounds = [for (final r in soundsQuery.data ?? const <Map<String, dynamic>>[]) WhiteNoiseItem.fromRow(r)];
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncEffects(sounds);
    });

    if (prefsState.loading || soundsQuery.isLoading) return const ToolLoading();

    final isPremium = usage.isPremium;
    final usageInfo = usage.canUseWhiteNoise();
    final grouped = groupWhiteNoiseSounds(sounds);
    final active = player.activeSoundId;
    final activeSound = sounds.where((s) => s.id == active).firstOrNull;
    final a = context.a;

    final timerOptions = isPremium ? <(int?, String)>[(null, '∞'), (15, '15'), (30, '30'), (60, '60')] : <(int?, String)>[(10, '10'), (15, '15'), (20, '20')];

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: widget.onBack,
            eyebrow: tr('whitenoise_kuy_rengleri_ile_derin_yuxu_c4a0f7', 'Küy rəngləri ilə dərin yuxu'),
            title: tr('whitenoise_yuxu_sesleri_4b518b', 'Yuxu Səsləri'),
          ),
          if (!isPremium)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: FadeRise(dy: -10, child: _freeBanner(context, usageInfo.remainingSeconds)),
            ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: active != null && activeSound != null ? _nowPlaying(context, activeSound, player, sounds) : _idleCard(context),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: FadeRise(delay: const Duration(milliseconds: 100), child: _volumeCard(context, player)),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: FadeRise(
              delay: const Duration(milliseconds: 150),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.timer, size: 16, color: a.onBgSoft),
                        const SizedBox(width: 8),
                        Text(
                          tr('untranslated_taymer_uen6sv', 'Taymer'),
                          style: px(14, weight: FontWeight.w700, color: a.onBg),
                        ),
                      ],
                    ),
                  ),
                  AGridCols(columns: 4, gap: 8, children: [for (final o in timerOptions) _timerOption(context, o.$1, o.$2)]),
                  if (!isPremium)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          AIcon(AIcons.lock, size: 12, color: a.onBgSoft),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(tr('whitenoise_limitsiz_taymer_premium_info', 'Limitsiz taymer Premium-a aiddir'), style: px(10, color: a.onBgSoft)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          for (final nt in _noiseTypes(a))
            if ((grouped[nt.id] ?? const []).isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: FadeRise(child: _noiseGroup(context, nt, grouped[nt.id]!, active, sounds)),
              ),
        ],
      ),
    );
  }

  List<_NoiseType> _noiseTypes(ATokens a) => [
    _NoiseType(
      'white',
      tr('whitenoise_beyaz_kuy_3acf2d', 'Bəyaz Küy'),
      tr('whitenoise_sakitlesdirici_d99d9d', 'Sakitləşdirici'),
      tr('whitenoise_ana_betnindeki_sese_benzer_monoton_fon_8d1144', 'Ana bətnindəki səsə bənzər monoton fon'),
      '⚪',
      a.surface,
      a.ink,
      a.inkSoft,
      a.surfaceSoft,
      a.inkSoft,
    ),
    _NoiseType(
      'pink',
      tr('whitenoise_cehrayi_kuy_68573d', 'Çəhrayı Küy'),
      tr('whitenoise_tebiet_effekti_45e038', 'Təbiət effekti'),
      tr('whitenoise_yungul_yagis_ve_yarpaq_xisiltisi_kimi_d5aea8', 'Yüngül yağış və yarpaq xışıltısı kimi'),
      '🌸',
      a.pink1,
      a.berryInk,
      a.berryInk,
      a.chipOverlay,
      a.pinkInk,
    ),
    _NoiseType(
      'brown',
      tr('whitenoise_qehveyi_kuy_f8e3c6', 'Qəhvəyi Küy'),
      tr('whitenoise_derin_yuxu_b4d583', 'Dərin yuxu'),
      tr('whitenoise_derin_ve_boguq_sesler_selale_goy_gurultu_47382e', 'Dərin və boğuq səslər — şəlalə, göy gurultusu'),
      '🟤',
      a.peach1,
      a.accentInk,
      a.accentInk,
      a.chipOverlay,
      a.accentInk,
    ),
  ];

  Widget _freeBanner(BuildContext context, double remainingSeconds) {
    final a = context.a;
    return ACard(
      color: a.surface,
      child: Row(
        children: [
          AListIconBox(
            gradient: remainingSeconds < 300 ? a.gradPink : a.gradPeach,
            child: AIcon(AIcons.lock, size: 17, strokeWidth: 2.2, color: a.accentInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr('premiumgate_default_title', 'Bu bölmə Premium-dadır'), style: AStyles.listTitle(context)),
                Text(tr('pgate_default_desc_v2', 'Premium ilə açılır'), style: AStyles.listSub(context)),
              ],
            ),
          ),
          APillButton(
            buttonKey: const ValueKey('wn-upgrade'),
            label: tr('whitenoise_kec_19bd66', 'Keç'),
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            fontSize: 11.5,
            tapScale: 0.95,
            onTap: _openPremium,
          ),
        ],
      ),
    );
  }

  Widget _idleCard(BuildContext context) {
    final a = context.a;
    return ACard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 26),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            margin: const EdgeInsets.only(bottom: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(20)),
            child: AIcon(AIcons.music2, size: 32, color: a.onBgSoft),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              tr('whitenoise_hansi_ses_korpenize_daha_xos_gelir_488ff5', 'Hansı səs körpənizə daha xoş gəlir?'),
              textAlign: TextAlign.center,
              style: AStyles.listTitle(context),
            ),
          ),
          Text(
            tr('whitenoise_asagidaki_kuy_novlerinden_birini_secerek_ece91d', 'Aşağıdakı küy növlərindən birini seçərək başlayın'),
            textAlign: TextAlign.center,
            style: AStyles.listSub(context),
          ),
        ],
      ),
    );
  }

  Widget _nowPlaying(BuildContext context, WhiteNoiseItem sound, WhiteNoiseState player, List<WhiteNoiseItem> sounds) {
    final a = context.a;
    const white = Color(0xFFFFFFFF);
    return Container(
      key: const ValueKey('wn-now-playing'),
      padding: const EdgeInsets.all(24),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: twGradientToBr(sound.color) ?? twGradientToBr('from-blue-400 to-cyan-500'),
        borderRadius: BorderRadius.circular(26),
        boxShadow: a.cardShadow,
      ),
      child: Column(
        children: [
          Text(sound.emoji, style: const TextStyle(fontSize: 60, height: 1)),
          const SizedBox(height: 12),
          Text(
            sound.name,
            textAlign: TextAlign.center,
            style: context.aText.heading(px(24, weight: FontWeight.w900, color: white, height: 32 / 24)),
          ),
          if (sound.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                sound.description,
                textAlign: TextAlign.center,
                style: px(12, color: const Color(0xB3FFFFFF)),
              ),
            ),
          if (_endAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(999)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const AIcon(AIcons.timer, size: 16, color: Color(0xCCFFFFFF)),
                    const SizedBox(width: 8),
                    _CountdownText(endAt: _endAt!, now: _now),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          _WaveBars(playing: player.isPlaying),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ATap(
                scale: 0.9,
                semanticLabel: player.isMuted ? 'unmute' : 'mute',
                onTap: _store.toggleMute,
                child: Container(
                  key: const ValueKey('wn-mute'),
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(12)),
                  child: AIcon(player.isMuted ? AIcons.volumeX : AIcons.volume2, size: 20, color: white),
                ),
              ),
              const SizedBox(width: 16),
              ATap(
                scale: 0.9,
                onTap: () => _handleSoundToggle(sound.id, sounds),
                child: Container(
                  key: const ValueKey('wn-pause'),
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5)],
                  ),
                  child: const AIcon(AIcons.pause, size: 32, color: Color(0xFF333333)), // inline #333
                ),
              ),
              const SizedBox(width: 16),
              const SizedBox(width: 48, height: 48),
            ],
          ),
        ],
      ),
    );
  }

  Widget _volumeCard(BuildContext context, WhiteNoiseState player) {
    final a = context.a;
    final shown = player.isMuted ? 0 : player.volume.round();
    return ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                AIcon(AIcons.volume2, size: 16, color: a.peach2),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tr('whitenoise_ses_seviyyesi_7296d5', 'Səs səviyyəsi'),
                    style: px(14, weight: FontWeight.w700, color: a.ink),
                  ),
                ),
                Text(
                  '$shown%',
                  style: px(14, weight: FontWeight.w700, color: a.accentInk),
                ),
              ],
            ),
          ),
          _VolumeSlider(value: shown, onChanged: (v) => unawaited(_handleVolumeChange(v))),
        ],
      ),
    );
  }

  Widget _timerOption(BuildContext context, int? value, String icon) {
    final a = context.a;
    final on = _timer == value;
    return ATap(
      scale: 0.95,
      onTap: () => _handleTimerChange(value),
      child: Container(
        key: ValueKey('wn-timer-${value ?? 'unlimited'}'),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: on ? a.gradCta : null,
          color: on ? null : a.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: on ? a.btnBorder : a.line),
          boxShadow: on ? a.cardShadow : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              icon,
              style: px(18, weight: FontWeight.w700, color: on ? a.accentInk : a.inkSoft, height: 28 / 18),
            ),
            Opacity(
              opacity: 0.8,
              child: Text(
                value == null ? tr('common_limitsiz', 'Limitsiz') : tr('whitenoise_deqiqe_94641a', 'dəqiqə'),
                style: px(10, weight: FontWeight.w600, color: on ? a.accentInk : a.inkSoft),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _noiseGroup(BuildContext context, _NoiseType nt, List<WhiteNoiseItem> list, String? active, List<WhiteNoiseItem> sounds) {
    final a = context.a;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: nt.bg, borderRadius: BorderRadius.circular(16), boxShadow: a.cardShadow),
          child: Row(
            children: [
              Text(nt.emoji, style: const TextStyle(fontSize: 24, height: 32 / 24)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      children: [
                        Text(
                          nt.label,
                          style: context.aText.heading(px(14, weight: FontWeight.w700, color: nt.ink)),
                        ),
                        APill(
                          nt.subtitle,
                          background: nt.badgeBg,
                          color: nt.badgeInk,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          weight: FontWeight.w700,
                        ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Opacity(
                        opacity: 0.8,
                        child: Text(nt.description, style: px(12, color: nt.sub)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        AGridCols(columns: 3, gap: 12, children: [for (final s in list) _soundTile(context, s, s.id == active, sounds)]),
      ],
    );
  }

  Widget _soundTile(BuildContext context, WhiteNoiseItem sound, bool isActive, List<WhiteNoiseItem> sounds) {
    final a = context.a;
    return ATap(
      scale: 0.97,
      semanticLabel: sound.name,
      selected: isActive,
      onTap: () => _handleSoundToggle(sound.id, sounds),
      child: Container(
        key: ValueKey('wn-sound-${sound.id}'),
        padding: const EdgeInsets.all(12),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: isActive ? twGradientToBr(sound.color) : null,
          color: isActive ? null : a.surface,
          borderRadius: BorderRadius.circular(16),
          border: isActive ? null : Border.all(color: a.line),
          boxShadow: a.cardShadow,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(sound.emoji, style: const TextStyle(fontSize: 30, height: 36 / 30)),
                ),
                Text(
                  sound.name,
                  textAlign: TextAlign.center,
                  style: px(11, weight: FontWeight.w700, color: isActive ? const Color(0xFFFFFFFF) : a.ink, height: 1.25),
                ),
                if (sound.description.isNotEmpty && !isActive)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      sound.description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: px(9, color: a.inkSoft, height: 1.25),
                    ),
                  ),
                if (isActive) const SizedBox(height: 14),
              ],
            ),
            if (isActive)
              PositionedDirectional(
                top: -4,
                end: -4,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(color: Color(0xFFFFFFFF), shape: BoxShape.circle),
                ),
              ),
            if (isActive) const Positioned(left: 0, right: 0, bottom: 0, child: Center(child: _MiniBars())),
          ],
        ),
      ),
    );
  }
}

class _NoiseType {
  const _NoiseType(this.id, this.label, this.subtitle, this.description, this.emoji, this.bg, this.ink, this.sub, this.badgeBg, this.badgeInk);
  final String id;
  final String label;
  final String subtitle;
  final String description;
  final String emoji;
  final Color bg;
  final Color ink;
  final Color sub;
  final Color badgeBg;
  final Color badgeInk;
}

/// `CountdownText`: only this badge re-renders every second.
class _CountdownText extends StatefulWidget {
  const _CountdownText({required this.endAt, required this.now});
  final int endAt;
  final int Function() now;
  @override
  State<_CountdownText> createState() => _CountdownTextState();
}

class _CountdownTextState extends State<_CountdownText> {
  Timer? _interval;
  late int _seconds = _calc();

  int _calc() => math.max(0, ((widget.endAt - widget.now()) / 1000).ceil());

  @override
  void initState() {
    super.initState();
    _interval = Timer.periodic(const Duration(seconds: 1), (_) => setState(() => _seconds = _calc()));
  }

  @override
  void didUpdateWidget(_CountdownText old) {
    super.didUpdateWidget(old);
    if (old.endAt != widget.endAt) _seconds = _calc();
  }

  @override
  void dispose() {
    _interval?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Text(
    formatWhiteNoiseTime(_seconds),
    style: const TextStyle(fontFamily: 'monospace', fontFamilyFallback: ['Courier'], fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF), fontSize: 16),
  );
}

/// `.wn-bar` waveform (scaleY 0.2 ↔ 1, ease-in-out, per-bar duration / delay; paused when not playing).
class _WaveBars extends StatefulWidget {
  const _WaveBars({required this.playing});
  final bool playing;
  @override
  State<_WaveBars> createState() => _WaveBarsState();
}

class _WaveBarsState extends State<_WaveBars> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 60));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(_WaveBars old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    if (widget.playing && infiniteAnimationsAllowed(context)) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 48,
    child: AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value * 60;
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < kWaveBars.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Transform.scale(
                scaleY: _scale(t, kWaveBars[i].duration, kWaveBars[i].delay),
                child: Container(
                  width: 6,
                  height: kWaveBars[i].height,
                  decoration: BoxDecoration(color: const Color(0xB3FFFFFF), borderRadius: BorderRadius.circular(999)),
                ),
              ),
            ],
          ],
        );
      },
    ),
  );

  double _scale(double t, double duration, double delay) {
    if (!_c.isAnimating && _c.value == 0) return 0.2;
    final phase = ((t - delay) % duration) / duration;
    final v = Curves.easeInOut.transform(phase < 0.5 ? phase * 2 : (1 - phase) * 2);
    return 0.2 + 0.8 * v;
  }
}

/// The three small bars at the bottom of the active tile.
class _MiniBars extends StatelessWidget {
  const _MiniBars();
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < 3; i++) ...[
        if (i > 0) const SizedBox(width: 2),
        Container(
          width: 4,
          height: 8,
          decoration: BoxDecoration(color: const Color(0xCCFFFFFF), borderRadius: BorderRadius.circular(999)),
        ),
      ],
    ],
  );
}

/// The 2px track with a peach fill under an invisible `<input type="range" min=0 max=100>`.
class _VolumeSlider extends StatelessWidget {
  const _VolumeSlider({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return LayoutBuilder(
      builder: (context, c) {
        void set(double dx) => onChanged((dx / c.maxWidth * 100).clamp(0, 100).round());
        return Semantics(
          slider: true,
          value: '$value',
          child: GestureDetector(
            key: const ValueKey('wn-volume'),
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => set(d.localPosition.dx),
            onHorizontalDragUpdate: (d) => set(d.localPosition.dx),
            child: SizedBox(
              height: 20,
              child: Center(
                child: Container(
                  height: 8,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FractionallySizedBox(
                      widthFactor: value / 100,
                      heightFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(999)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
