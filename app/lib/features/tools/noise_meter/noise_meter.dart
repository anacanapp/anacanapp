// Ported from: src/components/tools/NoiseMeter.tsx, src/hooks/useMentalHealthData.ts (useNoiseThresholdsDB)
//
// Noise meter (`noise-meter`, a section of white noise): live dB from the microphone (RMS of the time-domain
// samples, +94 dB calibration, 0…120), average / max of the last 100 frames, the result kept below the button after
// stopping and saved to `noise_measurements`, a white-noise prompt above the "warning" threshold.
import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../health_common/health_db.dart' show HQuery, eqF;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/audio_recording.dart';
import '../media_common/media_ports.dart';

/// `useNoiseThresholdsDB()` → `['noise-thresholds', language]` (30 min).
final noiseThresholdsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['noise-thresholds', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('noise_thresholds', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['label', 'description'],
    ),
  );
}, name: 'noiseThresholdsQuery');

typedef NoiseThresholds = ({num ideal, num acceptable, num warning, num danger});

const NoiseThresholds kFallbackNoiseThresholds = (ideal: 40, acceptable: 50, warning: 60, danger: 70);

/// Thresholds from the DB rows (quiet / moderate / loud / very_loud `min_db`) or the fallback.
NoiseThresholds noiseThresholdsFrom(List<Map<String, dynamic>> rows) {
  if (rows.isEmpty) return kFallbackNoiseThresholds;
  num value(String key, num fallback) {
    final t = rows.where((n) => n['threshold_key'] == key).firstOrNull;
    return t == null ? fallback : (t['min_db'] as num? ?? 0);
  }

  return (ideal: value('quiet', 40), acceptable: value('moderate', 50), warning: value('loud', 60), danger: value('very_loud', 70));
}

/// `20 * log10(rms) + 94`, clamped to 0…120 (silence → 0).
double decibelsFromSamples(Float32List data) {
  var sum = 0.0;
  for (final v in data) {
    sum += v * v;
  }
  final rms = data.isEmpty ? 0.0 : math.sqrt(sum / data.length);
  final db = 20 * (math.log(rms) / math.ln10) + 94;
  if (db.isNaN) return 0;
  return db.clamp(0, 120).toDouble();
}

/// `Math.round` (half up).
int jsRound(num v) => (v + 0.5).floor();

class NoiseMeter extends ConsumerStatefulWidget {
  const NoiseMeter({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<NoiseMeter> createState() => _NoiseMeterState();
}

class _NoiseLevel {
  const _NoiseLevel(this.label, this.color, this.dot, this.soft);
  final String label;
  final Color color;
  final Color dot;
  final Color soft;
}

class _NoiseMeterState extends ConsumerState<NoiseMeter> with WidgetsBindingObserver {
  bool _isListening = false;
  bool _hasMeasurement = false;
  int _currentDb = 0;
  int _avgDb = 0;
  int _maxDb = 0;
  bool _showWhiteNoisePrompt = false;
  final List<({int db, DateTime time})> _history = [];

  AudioContextLike? _audioContext;
  AudioAnalyser? _analyser;
  MicStream? _stream;
  _Abort? _controller;
  bool _mounted = true;
  int? _animation;
  List<double> _dbHistory = [];
  late AudioPlatform _platform;
  late NoiseThresholds _thresholds;

  @override
  void initState() {
    super.initState();
    _platform = ref.read(audioPlatformProvider);
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden || state == AppLifecycleState.paused) {
      _cleanup();
      if (mounted) setState(() => _isListening = false);
    }
  }

  @override
  void dispose() {
    _mounted = false;
    WidgetsBinding.instance.removeObserver(this);
    _cleanup();
    super.dispose();
  }

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _saveToDatabase(int db) async {
    final userId = ref.read(mediaUserIdProvider);
    if (userId == null) return;
    await ref.read(mediaDbProvider).insert('noise_measurements', {'user_id': userId, 'decibel_level': db, 'is_too_loud': db > _thresholds.acceptable});
  }

  Future<void> _startListening() async {
    if (_controller != null || !_mounted) return;
    final controller = _controller = _Abort();
    MicStream? stream;
    try {
      final factory = _platform.audioContext;
      if (factory == null) throw const AudioException('NotSupportedError', 'Audio analysis is unavailable');
      stream = await openMicrophone(_platform);
      if (controller.aborted) {
        releaseAudioRecording(null, stream);
        return;
      }
      _stream = stream;
      final audioContext = _audioContext = factory();
      final source = audioContext.createMediaStreamSource(stream);
      final analyser = audioContext.createAnalyser()
        ..fftSize = 2048
        ..smoothingTimeConstant = 0.8;
      source.connect(analyser);
      _analyser = analyser;

      setState(() {
        _isListening = true;
        _hasMeasurement = false;
        _currentDb = 0;
        _avgDb = 0;
        _maxDb = 0;
      });
      _dbHistory = [];

      void updateLevel() {
        final an = _analyser;
        if (controller.aborted || an == null) return;
        final data = Float32List(an.frequencyBinCount);
        an.getFloatTimeDomainData(data);
        final db = decibelsFromSamples(data);
        _dbHistory.add(db);
        if (_dbHistory.length > 100) _dbHistory.removeAt(0);
        final avg = _dbHistory.reduce((x, y) => x + y) / _dbHistory.length;
        setState(() {
          _currentDb = jsRound(db);
          _hasMeasurement = true;
          _avgDb = jsRound(avg);
          _maxDb = math.max(_maxDb, jsRound(db));
          if (db > _thresholds.warning && !_showWhiteNoisePrompt) _showWhiteNoisePrompt = true;
        });
        _animation = _platform.frames.request(updateLevel);
      }

      updateLevel();
    } catch (error) {
      if (controller.aborted) return;
      _cleanup();
      if (mounted) setState(() => _isListening = false);
      _toast(getAudioErrorToast(error, stream != null ? 'audio' : 'microphone'));
    }
  }

  void _cleanup() {
    _controller?.abort();
    _controller = null;
    if (_animation != null) {
      _platform.frames.cancel(_animation!);
      _animation = null;
    }
    _analyser = null;
    releaseAudioRecording(null, _stream);
    _stream = null;
    final ctx = _audioContext;
    if (ctx != null) {
      ctx.close().catchError((Object _) {});
      _audioContext = null;
    }
  }

  Future<void> _stopListening() async {
    final wasListening = _stream != null;
    _cleanup();
    if (mounted) setState(() => _isListening = false);
    // Keep the result locally even when the database is slow or unavailable; a measured 0 dB is a result too.
    if (wasListening && _dbHistory.isNotEmpty && _mounted) {
      final avg = _avgDb;
      setState(() {
        _currentDb = avg;
        if (_history.length > 9) _history.removeRange(0, _history.length - 9);
        _history.add((db: avg, time: DateTime.now()));
      });
      try {
        await _saveToDatabase(avg);
      } catch (_) {}
    }
  }

  _NoiseLevel _level(BuildContext context, num db) {
    final a = context.a;
    final t = _thresholds;
    if (db < t.ideal) return _NoiseLevel(tr('noisemeter_mukemmel_ae2244', 'Mükəmməl'), a.greenInk, a.green2, a.green1);
    if (db < t.acceptable) return _NoiseLevel(tr('noisemeter_yaxsi_9d8595', 'Yaxşı'), a.greenInk, a.green2, a.green1);
    if (db < t.warning) return _NoiseLevel(tr('noisemeter_qebulolunandir_0cab62', 'Qəbulolunandır'), a.warnInk, a.yellow2, a.yellow1);
    if (db < t.danger) return _NoiseLevel(tr('noisemeter_yuksek_492584', 'Yüksək'), a.accentInk, a.peach2, a.peach1);
    return _NoiseLevel(tr('noisemeter_cox_yuksek_86dadc', 'Çox yüksək!'), a.pinkInk, a.pink2, a.pink1);
  }

  void _navigateToWhiteNoise() {
    unawaited(_stopListening());
    widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    _thresholds = noiseThresholdsFrom(ref.watch(noiseThresholdsQuery).data ?? const []);
    final a = context.a;
    final level = _level(context, _currentDb);
    final gauge = math.min(100, _currentDb / 100 * 100) / 100;
    final startLabel = tr('noisemeter_baslamaq_ucun_toxunun_ee2514', 'Başlamaq üçün toxunun');
    final stopLabel = tr('noisemeter_dayandirmaq_ucun_toxunun_d02de1', 'Dayandırmaq üçün toxunun');

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: () {
              _cleanup();
              widget.onBack();
            },
            eyebrow: tr('noisemeter_korpe_yuxusu_ucun_ideal_muhit_4a6c06', 'Körpə yuxusu üçün ideal mühit'),
            title: tr('noisemeter_ses_kuy_olcer_68f0b6', 'Səs-Küy Ölçər'),
          ),
          vgap(12, [
            ACard(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  SizedBox(
                    width: 192,
                    height: 192,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned.fill(
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(end: gauge),
                            duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 300),
                            builder: (context, v, _) => CustomPaint(painter: _GaugePainter(v, a.lineStrong, level.dot)),
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$_currentDb',
                              style: context.aText.heading(px(48, weight: FontWeight.w700, color: level.color, height: 1)),
                            ),
                            Text(
                              'dB',
                              style: px(18, color: a.inkSoft, height: 28 / 18),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: _hasMeasurement ? level.soft : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      _hasMeasurement ? level.label : tr('noisemeter_olcum_basladilmayib_46107a', 'Ölçüm başladılmayıb'),
                      style: px(16, weight: FontWeight.w700, color: _hasMeasurement ? level.color : a.inkSoft),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ATap(
                    scale: 0.95,
                    semanticLabel: _isListening ? stopLabel : startLabel,
                    onTap: _isListening ? () => unawaited(_stopListening()) : () => unawaited(_startListening()),
                    child: Container(
                      key: const ValueKey('noise-control'),
                      width: 128,
                      height: 128,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isListening ? a.pink2 : null,
                        gradient: _isListening ? null : a.gradCta,
                        border: _isListening ? null : Border.all(color: a.btnBorder),
                        // 0 14px 30px -12px rgba(255, 138, 164, 0.7) (NoiseMeter.tsx literal)
                        boxShadow: _isListening
                            ? [BoxShadow(color: const Color(0xB3FF8AA4), offset: const Offset(0, 14), blurRadius: cssBlur(30), spreadRadius: -12)]
                            : a.cardShadow,
                      ),
                      child: AIcon(_isListening ? AIcons.micOff : AIcons.mic, size: 48, color: _isListening ? const Color(0xFFFFFFFF) : a.accentInk),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _isListening ? stopLabel : startLabel,
                      style: px(14, weight: FontWeight.w600, color: a.inkSoft),
                    ),
                  ),
                  if (_hasMeasurement)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 320),
                        child: Semantics(
                          container: true,
                          liveRegion: !_isListening,
                          child: Column(
                            key: _isListening ? null : const ValueKey('noise-result'),
                            children: [
                              if (!_isListening)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    tr('noisemeter_last_result', 'Son ölçmənin nəticəsi'),
                                    textAlign: TextAlign.center,
                                    style: AStyles.listTitle(context),
                                  ),
                                ),
                              AGridCols(
                                columns: 2,
                                gap: 16,
                                children: [
                                  _stat(context, tr('untranslated_orta_yslkg0', 'Orta'), '$_avgDb dB'),
                                  _stat(context, tr('untranslated_maks_6z8ju8', 'Maks'), '$_maxDb dB'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (_showWhiteNoisePrompt && _isListening)
              FadeRise(
                child: ACard(
                  color: a.peach1,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AIcon(AIcons.triangleAlert, size: 24, color: a.accentInk),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tr('noisemeter_ses_seviyyesi_yuksekdir_f91956', 'Səs səviyyəsi yüksəkdir'),
                              style: px(16, weight: FontWeight.w700, color: a.accentInk),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Opacity(
                                opacity: 0.85,
                                child: Text(
                                  tr('noisemeter_bu_seviyye_derin_yuxu_ucun_cox_b27a60', 'Bu səviyyə dərin yuxu üçün çox yüksəkdir. Ağ səs açım?'),
                                  style: px(14, color: a.accentInk),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                APillButton(
                                  label: tr('noisemeter_ag_ses_ac_06be65', 'Ağ səs aç'),
                                  icon: const AIcon(AIcons.volume2, size: 13, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                                  height: 38,
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  fontSize: 11.5,
                                  onTap: _navigateToWhiteNoise,
                                ),
                                APillButton(
                                  kind: APillKind.soft,
                                  label: tr('untranslated_sonra_1f3m9s', 'Sonra'),
                                  height: 38,
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  fontSize: 11.5,
                                  onTap: () => setState(() => _showWhiteNoisePrompt = false),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ACard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        AIcon(AIcons.moon, size: 16, color: a.lav2),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            tr('noisemeter_korpe_yuxusu_ucun_ses_seviyyel_d8f4f9', 'Körpə yuxusu üçün səs səviyyələri'),
                            style: AStyles.cardTitle(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                  vgap(8, [
                    for (final row in [
                      (a.green2, '0-40 dB', tr('noisemeter_mukemmel_ae2244', 'Mükəmməl')),
                      (const Color(0xFF8FD19E), '40-50 dB', tr('noisemeter_yaxsi_9d8595', 'Yaxşı')), // NoiseMeter.tsx literal
                      (a.yellow2, '50-60 dB', tr('noisemeter_qebulolunandir_0cab62', 'Qəbulolunandır')),
                      (a.peach2, '60-70 dB', tr('noisemeter_yuksek_492584', 'Yüksək')),
                      (a.pink2, '70+ dB', tr('noisemeter_cox_yuksek_c4d475', 'Çox yüksək')),
                    ])
                      Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(color: row.$1, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              row.$2,
                              style: px(14, weight: FontWeight.w600, color: a.ink),
                            ),
                          ),
                          Text(row.$3, style: px(12, color: a.inkSoft)),
                        ],
                      ),
                  ]),
                ],
              ),
            ),
            if (_history.isNotEmpty)
              ACard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          AIcon(AIcons.history, size: 16, color: a.peach2),
                          const SizedBox(width: 8),
                          Expanded(child: Text(tr('noisemeter_son_olcmeler_b024cf', 'Son ölçmələr'), style: AStyles.cardTitle(context))),
                        ],
                      ),
                    ),
                    vgap(8, [
                      for (final item in _history.reversed)
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                          child: Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(color: _level(context, item.db).dot, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 12),
                              Text('${item.db} dB', style: AStyles.listTitle(context)),
                              const Spacer(),
                              Text(localeTimeString(item.time), style: AStyles.listTime(context)),
                            ],
                          ),
                        ),
                    ]),
                  ],
                ),
              ),
          ]),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String label, String value) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: context.a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
    child: Column(
      children: [
        Text(label, style: AStyles.listSub(context)),
        Text(value, style: AStyles.heading(context, 20)),
      ],
    ),
  );
}

class _Abort {
  bool aborted = false;
  void abort() => aborted = true;
}

/// The two SVG circles (r 42 of a 100 viewBox, stroke 8, rotated -90°, round progress cap).
class _GaugePainter extends CustomPainter {
  _GaugePainter(this.fraction, this.track, this.color);
  final double fraction;
  final Color track;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide / 100;
    final center = size.center(Offset.zero);
    final rect = Rect.fromCircle(center: center, radius: 42 * s);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8 * s
      ..color = track;
    canvas.drawCircle(center, 42 * s, base);
    if (fraction <= 0) return;
    final progress = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8 * s
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * fraction.clamp(0, 1), false, progress);
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.fraction != fraction || old.color != color || old.track != track;
}
