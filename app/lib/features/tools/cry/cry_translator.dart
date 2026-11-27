// Ported from: src/components/tools/CryTranslator.tsx (+ src/lib/audioRecording.ts through media_common)
//
// Cry analysis (`cry-translator`): 3–10 s microphone recording (WebM only — the deployed analyze-cry endpoint
// accepts nothing else), live level ring, daily free limit, `analyze-cry`, result cards and the last 10 analyses.
// Every exit path (back, unmount, app in background, recorder error, too short) releases the recorder, the
// microphone, the level timer and the audio context, and drops a late grant or a late answer.
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../legal/medical_disclaimer.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, FadeRise, px;
import '../health_common/health_db.dart' show HQuery, eqF;
import '../health_common/health_ui.dart';
import '../kit/kit.dart';
import '../media_common/audio_recording.dart';
import '../media_common/media_ports.dart';

/// 'idle' | 'recording' | 'processing' | 'analyzing' | 'complete' | 'no_cry' | 'false_positive' | 'error'.
enum CryStage { idle, recording, processing, analyzing, complete, noCry, falsePositive, error }

/// `CryAnalysis`.
class CryAnalysis {
  const CryAnalysis({
    required this.cryType,
    required this.explanation,
    required this.recommendations,
    required this.urgency,
    this.confidence,
    this.isCryDetected,
  });
  final String cryType;
  final num? confidence;
  final String explanation;
  final List<String> recommendations;

  /// 'low' | 'medium' | 'high'.
  final String urgency;
  final bool? isCryDetected;

  factory CryAnalysis.fromJson(Map<String, dynamic> j) => CryAnalysis(
    cryType: '${j['cryType'] ?? ''}',
    confidence: j['confidence'] is num ? j['confidence'] as num : null,
    explanation: '${j['explanation'] ?? ''}',
    recommendations: [for (final r in (j['recommendations'] is List ? j['recommendations'] as List : const [])) '$r'],
    urgency: '${j['urgency'] ?? 'low'}',
    isCryDetected: j['isCryDetected'] is bool ? j['isCryDetected'] as bool : null,
  );
}

/// `cryTypeLabels` entry.
class CryTypeInfo {
  const CryTypeInfo(this.label, this.emoji, this.grad, this.ink);
  final String label;
  final String emoji;
  final Gradient grad;
  final Color ink;
}

Map<String, CryTypeInfo> cryTypeLabels(ATokens a) {
  final soft = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.surfaceSoft, a.lineStrong]);
  return {
    'hungry': CryTypeInfo(tr('crytranslator_ac_baba8d', 'Ac'), '🍼', a.gradPeach, a.accentInk),
    'tired': CryTypeInfo(tr('crytranslator_yuxulu_90ba1f', 'Yuxulu'), '😴', a.gradLav, a.lavInk),
    'pain': CryTypeInfo(tr('crytranslator_agri_76d612', 'Ağrı'), '😢', a.gradPink, a.alertInk),
    'discomfort': CryTypeInfo(tr('crytranslator_narahatliq_33f05c', 'Narahatlıq'), '😣', a.gradYellow, a.warnInk),
    'colic': CryTypeInfo(tr('crytranslator_kolik_29d81f', 'Kolik'), '😫', a.gradLav, a.lavInk),
    'attention': CryTypeInfo(tr('crytranslator_diqqet_isteyir_d50473', 'Diqqət istəyir'), '🤗', a.gradBlue, a.blueInk),
    'overstimulated': CryTypeInfo(tr('crytranslator_hedden_artiq_yorulub_7849bb', 'Həddən artıq yorulub'), '🥱', soft, a.inkSoft),
    'sick': CryTypeInfo(tr('crytranslator_xestelik_7c06be', 'Xəstəlik'), '🤒', a.gradPink, a.alertInk),
    'no_cry_detected': CryTypeInfo(tr('crytranslator_aglama_askarlanmadi_15a23e', 'Ağlama aşkarlanmadı'), '🔇', soft, a.inkSoft),
    'false_positive': CryTypeInfo(tr('crytranslator_saxta_ses_3db067', 'Saxta səs'), '📺', a.gradYellow, a.warnInk),
  };
}

String cryStageMessage(CryStage stage) => switch (stage) {
  CryStage.idle => tr('crytranslator_yazmaga_baslayin_55a5eb', 'Yazmağa başlayın'),
  CryStage.recording => tr('crytranslator_ses_yazilir_c555e8', 'Səs yazılır...'),
  CryStage.processing => tr('crytranslator_ses_emal_edilir_918818', 'Səs emal edilir...'),
  CryStage.analyzing => tr('crytranslator_ai_analiz_edir_daba4c', 'AI analiz edir...'),
  CryStage.complete => tr('crytranslator_analiz_tamamlandi_7dd77f', 'Analiz tamamlandı'),
  CryStage.noCry => tr('crytranslator_aglama_askarlanmadi_15a23e', 'Ağlama aşkarlanmadı'),
  CryStage.falsePositive => tr('crytranslator_saxta_ses_askarlandi_d6f6bf', 'Saxta səs aşkarlandı'),
  CryStage.error => tr('crytranslator_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
};

/// `FileReader.readAsDataURL(blob)` → the base64 part (asynchronous, like the reader).
final cryBase64ReaderProvider = Provider<Future<String> Function(Uint8List bytes, String mimeType)>(
  (ref) =>
      (bytes, mimeType) async => base64Encode(bytes),
);

class _Abort {
  bool aborted = false;
  void abort() => aborted = true;
}

class CryTranslator extends ConsumerStatefulWidget {
  const CryTranslator({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<CryTranslator> createState() => CryTranslatorState();
}

class CryTranslatorState extends ConsumerState<CryTranslator> with WidgetsBindingObserver {
  CryStage _stage = CryStage.idle;
  int _recordingTime = 0;
  CryAnalysis? _analysis;
  double _audioLevel = 0;
  bool _showHistory = false;
  List<Map<String, dynamic>> _history = const [];

  MediaRecorderLike? _recorder;
  MicStream? _stream;
  _Abort? _controller;
  bool _mounted = true;
  int _recordingTimeRef = 0;
  List<Uint8List> _chunks = [];
  Timer? _timer;
  AudioAnalyser? _analyser;
  int? _animation;
  AudioContextLike? _audioContext;
  late final AudioPlatform _platform = ref.read(audioPlatformProvider);

  CryStage get stage => _stage;
  CryAnalysis? get analysis => _analysis;

  /// The recording timer is running (`vi.getTimerCount()` of the React tests).
  @visibleForTesting
  bool get hasRecordingTimer => _timer?.isActive ?? false;

  bool get _isRecording => _stage == CryStage.recording;
  bool get _isProcessing => _stage == CryStage.processing || _stage == CryStage.analyzing;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_loadHistory());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if ((state == AppLifecycleState.hidden || state == AppLifecycleState.paused) && (_recorder?.state == 'recording' || _stream != null)) {
      _controller?.abort();
      _controller = null;
      _cleanup();
      if (mounted && _stage == CryStage.recording) setState(() => _stage = CryStage.idle);
    }
  }

  @override
  void dispose() {
    _mounted = false;
    WidgetsBinding.instance.removeObserver(this);
    _controller?.abort();
    _controller = null;
    _cleanup();
    super.dispose();
  }

  void _set(VoidCallback f) {
    if (mounted) setState(f);
  }

  void _toast(MediaToastData t) {
    if (mounted) ref.read(mediaToastProvider)(context, t);
  }

  Future<void> _loadHistory() async {
    final userId = ref.read(mediaUserIdProvider);
    if (userId == null) return;
    try {
      final rows = await ref
          .read(mediaDbProvider)
          .select(HQuery('cry_analyses', filters: [eqF('user_id', userId)], order: const [(column: 'created_at', ascending: false)], limit: 10));
      if (_mounted) _set(() => _history = rows);
    } catch (_) {}
  }

  void _cleanup() {
    _timer?.cancel();
    if (_animation != null) _platform.frames.cancel(_animation!);
    _timer = null;
    _animation = null;
    _analyser = null;
    releaseAudioRecording(_recorder, _stream);
    _recorder = null;
    _stream = null;
    _chunks = [];
    final ctx = _audioContext;
    if (ctx != null) {
      ctx.close().catchError((Object _) {});
      _audioContext = null;
    }
  }

  void _cancelRecording() {
    _controller?.abort();
    _controller = null;
    _cleanup();
  }

  Future<void> _startRecording() async {
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
      final analyser = audioContext.createAnalyser()..fftSize = 256;
      source.connect(analyser);
      _analyser = analyser;

      void updateLevel() {
        final an = _analyser;
        if (controller.aborted || an == null) return;
        final data = Uint8List(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        final avg = data.isEmpty ? 0 : data.reduce((x, y) => x + y) / data.length;
        _set(() => _audioLevel = avg / 255);
        _animation = _platform.frames.request(updateLevel);
      }

      updateLevel();

      // The deployed analyze-cry endpoint accepts WebM only.
      final recorder = createAudioRecorder(_platform, stream, const ['audio/webm']);
      _recorder = recorder;
      _chunks = [];
      recorder.ondataavailable = (data) {
        if (!controller.aborted && data.isNotEmpty) _chunks.add(data);
      };
      recorder.onerror = (error) {
        if (controller.aborted) return;
        _cancelRecording();
        _set(() => _stage = CryStage.error);
        _toast(getAudioErrorToast(error, 'audio'));
      };
      recorder.start(100);
      _recordingTimeRef = 0;
      _set(() {
        _stage = CryStage.recording;
        _recordingTime = 0;
        _analysis = null;
      });
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        _recordingTimeRef += 1;
        _set(() => _recordingTime = _recordingTimeRef);
        if (_recordingTimeRef >= 10) _stopRecording();
      });
    } catch (error) {
      if (controller.aborted) return;
      debugPrint('Recording error: $error');
      _cancelRecording();
      _set(() => _stage = CryStage.error);
      _toast(getAudioErrorToast(error, stream != null ? 'audio' : 'microphone'));
    }
  }

  void _stopRecording() {
    final recorder = _recorder;
    final controller = _controller;
    if (recorder == null || recorder.state != 'recording' || controller == null) return;
    _timer?.cancel();
    _timer = null;

    final duration = _recordingTimeRef;
    if (duration < 3) {
      _toast(
        MediaToastData(
          title: tr('crytranslator_cox_qisa_12bf93', 'Çox qısa'),
          description: tr('crytranslator_minimum_3_saniye_ses_yazin_1b5970', 'Minimum 3 saniyə səs yazın'),
          destructive: true,
        ),
      );
      _cancelRecording();
      _set(() => _stage = CryStage.idle);
      return;
    }

    _set(() => _stage = CryStage.processing);
    recorder.onstop = () {
      if (controller.aborted) return;
      final builder = BytesBuilder(copy: false);
      for (final c in _chunks) {
        builder.add(c);
      }
      final bytes = builder.takeBytes();
      final type = recorder.mimeType;
      _cleanup();
      unawaited(_analyzeAudio(bytes, type, duration, controller));
    };
    try {
      recorder.stop();
    } catch (error) {
      _cancelRecording();
      _set(() => _stage = CryStage.error);
      _toast(getAudioErrorToast(error, 'audio'));
    }
  }

  Future<void> _analyzeAudio(Uint8List blob, String type, int duration, _Abort signal) async {
    try {
      if (signal.aborted) return;
      if (blob.isEmpty || type.isEmpty) throw StateError('No recorded audio or MIME type');
      final decision = await ref.read(mediaUsageProvider).checkAndConsume('cry_translator');
      if (signal.aborted) return;
      if (!decision.allowed) {
        _set(() => _stage = CryStage.idle);
        if (mounted) unawaited(ref.read(mediaPremiumModalProvider)(context, 'cry_translator'));
        return;
      }
      _set(() => _stage = CryStage.analyzing);
      final base64Audio = await ref.read(cryBase64ReaderProvider)(blob, type);
      if (signal.aborted) return;
      final babyContext = babyAnalysisContext(ref.read(authProfileProvider));
      if (signal.aborted) return;
      final res = await ref
          .read(mediaDbProvider)
          .invoke(
            'analyze-cry',
            body: {'audioBase64': base64Audio, 'audioDuration': duration, 'userContext': babyContext, 'language': ref.read(mediaLanguageProvider)()},
          );
      if (signal.aborted) return;
      if (res.error != null) throw res.error!;
      final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : const <String, dynamic>{};
      if (data['success'] == true && data['analysis'] is Map) {
        final result = CryAnalysis.fromJson(Map<String, dynamic>.from(data['analysis'] as Map));
        _set(() {
          _analysis = result;
          _stage = switch (result.cryType) {
            'no_cry_detected' => CryStage.noCry,
            'false_positive' => CryStage.falsePositive,
            _ => CryStage.complete,
          };
        });
        unawaited(_loadHistory());
      } else {
        throw StateError('${data['error'] ?? 'Analysis failed'}');
      }
    } catch (error) {
      if (signal.aborted) return;
      debugPrint('Analysis error: $error');
      _set(() => _stage = CryStage.error);
      _toast(
        MediaToastData(
          title: tr('crytranslator_analiz_xetasi_daba4a', 'Analiz xətası'),
          description: tr('crytranslator_yeniden_cehd_edin_0040c9', 'Yenidən cəhd edin'),
          destructive: true,
        ),
      );
    } finally {
      if (identical(_controller, signal)) _controller = null;
    }
  }

  void _resetAnalysis() {
    _cancelRecording();
    _set(() {
      _stage = CryStage.idle;
      _analysis = null;
      _recordingTime = 0;
      _audioLevel = 0;
    });
  }

  Color _urgencyColor(ATokens a, String urgency) => switch (urgency) {
    'high' => a.pink2,
    'medium' => a.yellow2,
    _ => a.green2,
  };

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final emergency = ref.watch(emergencyNumberProvider);
    final labels = cryTypeLabels(a);
    final analysis = _analysis;
    final cryInfo = analysis == null ? null : (labels[analysis.cryType] ?? labels['attention']!);

    return ToolPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ToolHeader(
            onBack: () {
              _cancelRecording();
              widget.onBack();
            },
            eyebrow: tr('crytranslator_ai_ile_korpe_aglamasini_analiz_edin_e2e23c', 'AI ilə körpə ağlamasını analiz edin'),
            title: tr('adminanalytics_aglama_analizi_0713b3', 'Ağlama Analizi'),
            actions: [
              Semantics(
                selected: _showHistory,
                child: ToolIconButton(
                  key: const ValueKey('cry-history'),
                  semanticLabel: tr('a11y_history', 'Tarixçə'),
                  icon: const AIcon(AIcons.history, size: 16),
                  onTap: () => setState(() => _showHistory = !_showHistory),
                ),
              ),
            ],
          ),
          vgap(12, [
            const MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan),
            Semantics(
              container: true,
              child: ACard(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                color: a.pink1,
                child: Row(
                  children: [
                    AIcon(AIcons.circleAlert, size: 16, color: a.alertInk),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tr(
                          'clinical_cry_red_flags',
                          '3 aydan kiçik körpədə hərarət (38 °C və yuxarı), cingiltili və ya saatlarla dayanmayan ağlama, nəfəs çətinliyi, əmməmə: dərhal həkimə müraciət edin.',
                        ),
                        style: px(12, color: a.alertInk, height: 1.35),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Semantics(
                      link: true,
                      label: 'tel:$emergency',
                      child: GestureDetector(
                        key: const ValueKey('cry-call'),
                        onTap: () => ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                          decoration: BoxDecoration(color: a.alertInk, borderRadius: BorderRadius.circular(999)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const AIcon(AIcons.phone, size: 12, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
                              const SizedBox(width: 4),
                              Text(
                                emergency,
                                style: px(12.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ACard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: AIcon(AIcons.info, size: 16, color: a.peach2),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tr(
                        'crytranslator_korpeniz_aglayanda_3_10_saniye_1b26e1',
                        'Körpəniz ağlayanda 3-10 saniyə səs yazın. AI ağlamanın səbəbini analiz edəcək.',
                      ),
                      style: AStyles.ctaText(context),
                    ),
                  ),
                ],
              ),
            ),
            _recordingCard(context),
            if (_stage == CryStage.noCry && analysis != null)
              FadeRise(
                child: _notCryCard(
                  context,
                  labels['no_cry_detected']!,
                  tr('crytranslator_aglama_askarlanmadi_15a23e', 'Ağlama aşkarlanmadı'),
                  tr('crytranslator_ortamda_korpe_aglamasi_esidilm_6b36d5', 'Ortamda körpə ağlaması eşidilmədi'),
                  analysis.explanation,
                  AIcons.triangleAlert,
                  tr(
                    'crytranslator_korpeniz_agladigi_zaman_yenide_e6c4db',
                    'Körpəniz ağladığı zaman yenidən cəhd edin. Mümkün qədər yaxından və aydın səs yazın.',
                  ),
                ),
              ),
            if (_stage == CryStage.falsePositive && analysis != null)
              FadeRise(
                child: _notCryCard(
                  context,
                  labels['false_positive']!,
                  tr('crytranslator_saxta_ses_askarlandi_d6f6bf', 'Saxta səs aşkarlandı'),
                  tr('crytranslator_bu_ses_heqiqi_korpe_aglamasi_d_ea2e8c', 'Bu səs həqiqi körpə ağlaması deyil'),
                  analysis.explanation,
                  AIcons.circleX,
                  tr(
                    'crytranslator_tv_telefon_ve_ya_imitasiya_ses_1867b6',
                    'TV, telefon və ya imitasiya səsləri aşkarlandı. Həqiqi körpə ağlaması ilə yenidən cəhd edin.',
                  ),
                ),
              ),
            if (_stage == CryStage.complete && analysis != null && cryInfo != null && analysis.isCryDetected != false)
              FadeRise(child: _resultCard(context, analysis, cryInfo)),
            if (_showHistory && _history.isNotEmpty) _historyCard(context, labels),
          ]),
        ],
      ),
    );
  }

  Widget _recordingCard(BuildContext context) {
    final a = context.a;
    final BoxDecoration decoration;
    if (_isRecording) {
      // 0 14px 30px -12px rgba(255, 138, 164, 0.7) (CryTranslator.tsx literal)
      decoration = BoxDecoration(
        shape: BoxShape.circle,
        color: a.pink2,
        boxShadow: [BoxShadow(color: const Color(0xB3FF8AA4), offset: const Offset(0, 14), blurRadius: cssBlur(30), spreadRadius: -12)],
      );
    } else if (_isProcessing) {
      decoration = BoxDecoration(shape: BoxShape.circle, color: a.peach2);
    } else {
      decoration = BoxDecoration(
        shape: BoxShape.circle,
        gradient: a.gradCta,
        border: Border.all(color: a.btnBorder),
        boxShadow: a.cardShadow,
      );
    }
    final Widget content = switch (_stage) {
      CryStage.processing || CryStage.analyzing => const ALoader(size: 48, color: Color(0xFFFFFFFF)),
      CryStage.recording => const AIcon(AIcons.square, size: 40, color: Color(0xFFFFFFFF)),
      _ => AIcon(AIcons.mic, size: 48, color: a.accentInk),
    };
    Widget button = Container(
      key: const ValueKey('cry-mic'),
      width: 128,
      height: 128,
      alignment: Alignment.center,
      decoration: decoration,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (_isRecording)
            Positioned.fill(
              child: Transform.scale(
                scale: 1 + _audioLevel * 0.3,
                child: Opacity(
                  opacity: (0.5 + _audioLevel * 0.5).clamp(0, 1),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0x59FFFFFF), width: 4),
                    ),
                  ),
                ),
              ),
            ),
          content,
        ],
      ),
    );
    if (_isProcessing) button = Opacity(opacity: 0.75, child: button);
    final minutes = (_recordingTime ~/ 60).toString().padLeft(2, '0');
    final seconds = (_recordingTime % 60).toString().padLeft(2, '0');
    return ACard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Semantics(
            button: true,
            enabled: !_isProcessing,
            child: PressScale(
              scale: 0.95,
              enabled: !_isProcessing,
              onTap: _isRecording ? _stopRecording : (_isProcessing ? null : () => unawaited(_startRecording())),
              child: button,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AIcon(AIcons.clock, size: 16, color: a.inkSoft),
              const SizedBox(width: 8),
              Text(
                '$minutes:$seconds',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontFamilyFallback: const ['Courier'],
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: a.ink,
                  height: 32 / 24,
                ),
              ),
              const SizedBox(width: 8),
              Text('/10s', style: px(12, color: a.inkSoft)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_isProcessing) ...[ALoader(size: 16, color: a.peach2), const SizedBox(width: 8)],
              Flexible(
                child: Text(
                  cryStageMessage(_stage),
                  style: px(14, weight: FontWeight.w600, color: a.inkSoft),
                ),
              ),
            ],
          ),
          if (_isRecording)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Container(
                height: 8,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: (_recordingTime / 10).clamp(0, 1)),
                    duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 500),
                    builder: (context, v, _) => FractionallySizedBox(
                      widthFactor: v,
                      heightFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: a.pink2, borderRadius: BorderRadius.circular(999)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (_isProcessing)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _dot(a.peach2, pulse: _stage == CryStage.processing),
                  const SizedBox(width: 8),
                  _dot(_stage == CryStage.analyzing ? a.peach2 : a.lineStrong, pulse: _stage == CryStage.analyzing),
                  const SizedBox(width: 8),
                  _dot(a.lineStrong),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _dot(Color color, {bool pulse = false}) {
    final dot = Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
    return pulse ? APulse(child: dot) : dot;
  }

  Widget _notCryCard(BuildContext context, CryTypeInfo info, String title, String sub, String explanation, AIconData warnIcon, String warning) {
    final a = context.a;
    return ACard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 8, decoration: BoxDecoration(gradient: info.grad)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: vgap(16, [
              Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: info.grad, borderRadius: BorderRadius.circular(16)),
                    child: Text(info.emoji, style: const TextStyle(fontSize: 30)),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AStyles.heading(context, 19)),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(sub, style: AStyles.listSub(context)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              _softBox(context, Text(explanation, style: AStyles.ctaText(context))),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AIcon(warnIcon, size: 20, color: a.warnInk),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(warning, style: px(14, color: a.warnInk)),
                    ),
                  ],
                ),
              ),
              APillButton(
                label: tr('crytranslator_yeniden_cehd_et_d273ac', 'Yenidən cəhd et'),
                icon: const AIcon(AIcons.mic, size: 15, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                height: 44,
                expand: true,
                onTap: _resetAnalysis,
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _softBox(BuildContext context, Widget child) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: context.a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
    child: child,
  );

  Widget _resultCard(BuildContext context, CryAnalysis analysis, CryTypeInfo info) {
    final a = context.a;
    return ACard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 8, decoration: BoxDecoration(gradient: info.grad)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: vgap(16, [
              Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: info.grad, borderRadius: BorderRadius.circular(16)),
                    child: Text(info.emoji, style: const TextStyle(fontSize: 30)),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(info.label, style: AStyles.heading(context, 19, color: info.ink)),
                        const SizedBox(height: 4),
                        // The model's confidence is not calibrated, so no percentage is shown.
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(color: _urgencyColor(a, analysis.urgency), shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 8),
                            Flexible(child: Text(tr('clinical_cry_possible_reason', 'Ehtimal olunan səbəb'), style: AStyles.listSub(context))),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              _softBox(context, Text(analysis.explanation, style: AStyles.ctaText(context))),
              vgap(8, [
                Row(
                  children: [
                    AIcon(AIcons.circleCheck, size: 16, color: a.green2),
                    const SizedBox(width: 8),
                    Text(
                      tr('crytranslator_tovsiyeler_17a8f7', 'Tövsiyələr'),
                      style: px(14, weight: FontWeight.w700, color: a.ink),
                    ),
                  ],
                ),
                for (var i = 0; i < analysis.recommendations.length; i++) _numbered(context, i + 1, analysis.recommendations[i]),
              ]),
              if (analysis.urgency == 'high')
                AAlertCard(
                  child: Row(
                    children: [
                      AIcon(AIcons.circleAlert, size: 20, color: a.alertInk),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          tr('crytranslator_diqqet_bu_simptomlar_ciddi_ola_805dc6', 'Diqqət! Bu simptomlar ciddi ola bilər. Həkimə müraciət etməyi düşünün.'),
                          style: px(14, color: a.alertInk),
                        ),
                      ),
                    ],
                  ),
                ),
              APillButton(
                kind: APillKind.soft,
                label: tr('crytranslator_yeni_analiz_3c7a2d', 'Yeni analiz'),
                icon: AIcon(AIcons.mic, size: 15, strokeWidth: 2.2, color: a.accentInk),
                height: 44,
                expand: true,
                onTap: _resetAnalysis,
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _numbered(BuildContext context, int n, String text) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle),
            child: Text(
              '$n',
              style: px(12, weight: FontWeight.w700, color: a.accentInk, height: 1),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: AStyles.ctaText(context))),
        ],
      ),
    );
  }

  Widget _historyCard(BuildContext context, Map<String, CryTypeInfo> labels) {
    final a = context.a;
    return ACard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                AIcon(AIcons.history, size: 16, color: a.peach2),
                const SizedBox(width: 8),
                Text(tr('crytranslator_son_analizler_76b144', 'Son analizlər'), style: AStyles.cardTitle(context)),
              ],
            ),
          ),
          vgap(8, [
            for (final item in _history)
              () {
                final info = labels['${item['cry_type']}'] ?? labels['attention']!;
                final created = DateTime.tryParse('${item['created_at']}')?.toLocal();
                return Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      AListIconBox(
                        size: 36,
                        radius: 12,
                        gradient: info.grad,
                        child: Text(info.emoji, style: const TextStyle(fontSize: 16)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(info.label, style: AStyles.listTitle(context)),
                            if (created != null) Text(localeDateString(created), style: AStyles.listSub(context)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }(),
          ]),
        ],
      ),
    );
  }
}
