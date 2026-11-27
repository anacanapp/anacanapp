// Ported from: src/components/onboarding/OnboardingJourney.tsx, src/components/onboarding/PremiumOnboarding.tsx,
// src/components/funnel/ReverseTrialFunnel.tsx, src/components/OnboardingScreen.tsx
//
// The first-run journey: welcome → stage → name → data → branch questions → privacy → value → (native)
// notifications → analysis (confirmed save) → results → features → paywall / one-time offer → free / success.
// Drafts persist per account+backend (`anacan-onboarding-v3:*`) so a restart resumes at the same step; the
// server journey record decides what can be shown again. `nameOnly` repairs a missing name of an established
// profile without enrolling a funnel.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases.dart';
import '../../shell/feature_registry.dart';
import '../../shell/nav/back_button.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart' show backDispatcherProvider;
import '../../state/shell_bindings.dart' show backendUrlProvider;
import 'onboarding_companion.dart';
import 'onboarding_fields.dart';
import 'onboarding_frame.dart';
import 'onboarding_i18n.dart';
import 'onboarding_model.dart';
import 'onboarding_paywall.dart';
import 'onboarding_persistence.dart';
import 'onboarding_ports.dart';

/// Who is onboarding (`useAuth().user.id`, `profile`, `getBackendConfig().url`).
class OnboardingSession {
  const OnboardingSession({required this.actor, required this.backend, this.profile});
  final String actor;
  final String backend;

  /// The `profiles` row (null while unknown).
  final Map<String, Object?>? profile;
}

final onboardingSessionProvider = Provider<OnboardingSession>((ref) => OnboardingSession(
      actor: ref.watch(authUserProvider)?.id ?? '',
      backend: ref.watch(backendUrlProvider),
      profile: ref.watch(authProfileProvider)?.row.cast<String, Object?>(),
    ));

/// `isNativePlatform()` (the notifications step and the store paywall exist only natively).
final onboardingNativeProvider = Provider<bool>((ref) => ref.watch(revenueCatEnvironmentProvider).isNative);

/// `initialDraft(actor, backend, profile)`.
OnboardingDraft initialOnboardingDraft(String actor, String backend, Map<String, Object?>? profile, DraftStorage storage, bool hasSeenIntro) {
  final stored = readOnboardingDraft(actor, backend, storage);
  var draft = stored ?? newOnboardingDraft(actor, backend, profile?['name'] as String?);
  if (stored == null && hasSeenIntro) draft = draft.copyWith(step: 'stage');
  final record = journeyRecord(profile?['onboarding_answers']);
  if (record == null) return draft.copyWith(setupComplete: false);
  final localMatches = record.id == draft.id;
  final stage = profile?['life_stage'];
  final lastPeriod = profile?['last_period_date'] as String?;
  final profileName = profile?['name'] as String?;
  final answers = profile?['onboarding_answers'];
  return draft.copyWith(
    id: record.id,
    stage: isOnboardingStage(stage) ? stage as String : draft.stage,
    name: (profileName != null && profileName.isNotEmpty) ? profileName : draft.name,
    setupComplete: true,
    saveStarted: true,
    offerSeen: record.offerSeenAt != null && record.offerSeenAt!.isNotEmpty,
    plan: record.plan,
    answers: localMatches
        ? draft.answers
        : {
            if (answers is Map)
              for (final e in answers.entries)
                if (e.value is String || e.value is List) '${e.key}': e.value is List ? List<Object?>.of(e.value as List) : e.value as Object,
          },
    babyCount: (profile?['baby_count'] as num?)?.toInt() ?? draft.babyCount,
    lastPeriodDate: (lastPeriod != null && lastPeriod.isNotEmpty) ? lastPeriod : draft.lastPeriodDate,
    pregnancyDate: (lastPeriod != null && lastPeriod.isNotEmpty) ? lastPeriod : draft.pregnancyDate,
    dateMode: 'lmp',
    step: draft.purchasePending && localMatches
        ? 'paywall'
        : (record.offerSeenAt != null && record.offerSeenAt!.isNotEmpty && draft.step == 'offer')
            ? 'free'
            : (localMatches && const ['results', 'features', 'paywall', 'free', 'success'].contains(draft.step))
                ? draft.step
                : 'results',
  );
}

class OnboardingJourney extends ConsumerStatefulWidget {
  const OnboardingJourney({super.key, this.onComplete, this.legacyPending = false, this.offerEnabled = true});
  final VoidCallback? onComplete;

  /// Pre-v3 locally pending funnel (`ReverseTrialFunnel`).
  final bool legacyPending;

  /// `app_settings.premium_onboarding_enabled !== false`.
  final bool offerEnabled;

  @override
  ConsumerState<OnboardingJourney> createState() => _OnboardingJourneyState();
}

class _OnboardingJourneyState extends ConsumerState<OnboardingJourney> {
  late OnboardingSession _session = ref.read(onboardingSessionProvider);
  late DraftStorage _storage = ref.read(onboardingDraftStorageProvider);
  late OnboardingDraft _draft;
  bool _busy = false, _lock = false, _alive = true, _initialized = false;
  String? _error;
  int _progress = 0;
  String? _legal;
  Timer? _advancing;
  VoidCallback? _releaseBack;

  String get _actor => _session.actor;
  String get _backend => _session.backend;
  String get _language => ref.read(appLanguageProvider);
  OnboardingDataPort get _port => ref.read(onboardingDataPortProvider);
  OnboardingEffects get _effects => ref.read(onboardingEffectsProvider);

  String t(String key, [Map<String, Object?> values = const {}]) => onboardingText(ref.watch(appLanguageProvider), key, values);

  bool get _nameOnly {
    final profile = _session.profile;
    final stage = profile?['life_stage'];
    if (stage == null || (stage is String && stage.isEmpty) || widget.legacyPending) return false;
    final record = journeyRecord(profile?['onboarding_answers']);
    if (!(record == null || (record.completedAt != null && record.completedAt!.isNotEmpty))) return false;
    final name = profile?['name'] as String?;
    return name == null || name.trim().isEmpty || name == 'İstifadəçi';
  }

  @override
  void initState() {
    super.initState();
    _draft = initialOnboardingDraft(_actor, _backend, _session.profile, _storage, _effects.hasSeenIntro());
    _releaseBack = ref.read(backDispatcherProvider).push(() {
      _back();
      return true;
    }, BackLayer.screen);
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  @override
  void dispose() {
    _alive = false;
    _cancelAdvance();
    _releaseBack?.call();
    super.dispose();
  }

  void _cancelAdvance() {
    _advancing?.cancel();
    _advancing = null;
  }

  bool _commit(OnboardingDraft next) {
    if (!_alive || next.actor != _actor || next.backend != _backend) return false;
    if (_nameOnly) {
      setState(() => _draft = next);
      return true;
    }
    try {
      writeOnboardingDraft(next, _storage);
      _error = null;
    } catch (_) {
      setState(() {
        _error = 'storage_failed';
        _draft = next.copyWith(step: _draft.step);
      });
      return false;
    }
    setState(() => _draft = next);
    return true;
  }

  void _move(String step) {
    _cancelAdvance();
    _commit(_draft.copyWith(step: step));
  }

  Future<void> _syncUi(Map<String, Object?> saved) async {
    if (!_alive || saved['user_id'] != _actor) return;
    _effects.syncSavedProfile(saved);
    await _effects.refreshProfile();
    if (_alive && _draft.stage == 'mommy') {
      _effects.selectChild(_draft.children.isEmpty ? null : _draft.children.first.id);
      _effects.childrenUpdated();
    }
  }

  void _reportError(Object failure) {
    if (!_alive) return;
    setState(() => _error = failure is OnboardingPersistenceError && failure.message == 'ONBOARDING_ACCOUNT_CHANGED' ? 'account_changed' : 'save_failed');
  }

  void _setBusy(bool value) {
    if (_alive) setState(() => _busy = value);
  }

  Future<void> _saveSetup() async {
    if (_lock) return;
    final candidate = _draft;
    final invalid = onboardingDataError(candidate);
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
    if (!_commit(candidate.copyWith(saveStarted: true, step: 'analysis'))) return;
    _lock = true;
    setState(() {
      _busy = true;
      _progress = 0;
    });
    try {
      final saved = await saveOnboardingSetup(_draft, _language, _port, onProgress: (amount) {
        if (_alive) setState(() => _progress = amount);
      });
      if (!_alive) return;
      _commit(_draft.copyWith(setupComplete: true, plan: recommendedOnboardingPlan(candidate.answers), step: 'results'));
      _effects.setFunnelCompleted(false);
      await _syncUi(saved);
    } catch (failure) {
      _reportError(failure);
    } finally {
      _lock = false;
      _setBusy(false);
    }
  }

  void _initialize() {
    if (_initialized || _actor.isEmpty || !_alive) return;
    _initialized = true;
    if (widget.legacyPending && journeyRecord(_session.profile?['onboarding_answers']) == null) {
      _lock = true;
      _setBusy(true);
      adoptLegacyOnboarding(_actor, _backend, _port).then((saved) async {
        if (!_alive) return;
        _commit(initialOnboardingDraft(_actor, _backend, saved, _storage, _effects.hasSeenIntro()));
        await _syncUi(saved);
      }).catchError(_reportError).whenComplete(() {
        _lock = false;
        _setBusy(false);
      });
    } else if (!_nameOnly) {
      // Recover a suspended save by rerunning the idempotent confirmation path.
      if (_draft.step == 'analysis' && !_draft.setupComplete) {
        unawaited(_saveSetup());
      } else {
        _commit(_draft);
      }
    }
  }

  Future<void> _saveName() async {
    final name = _draft.name.trim();
    if (_lock || name.isEmpty || name.length > 80) return;
    _lock = true;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await _effects.updateName(name);
      if (result.error != null || result.data?['user_id'] != _actor || result.data?['name'] != name) {
        throw const OnboardingPersistenceError('ONBOARDING_NAME_SAVE_FAILED');
      }
      if (_alive) {
        _effects.syncSavedProfile({'user_id': _actor, 'name': result.data!['name']});
        widget.onComplete?.call();
      }
    } catch (failure) {
      _reportError(failure);
    } finally {
      _lock = false;
      _setBusy(false);
    }
  }

  List<String> get _steps => onboardingSteps(_draft.stage, ref.read(onboardingNativeProvider));

  void _next() {
    if (_lock) return;
    _cancelAdvance();
    if (_nameOnly) {
      unawaited(_saveName());
      return;
    }
    final active = _draft;
    if (active.step == 'name' && active.name.trim().isEmpty) {
      setState(() => _error = 'name_required');
      return;
    }
    if (active.step == 'data') {
      final invalid = onboardingDataError(active);
      if (invalid != null) {
        setState(() => _error = invalid);
        return;
      }
    }
    final steps = _steps;
    final index = steps.indexOf(active.step);
    final target = index + 1 < steps.length && index >= -1 ? steps[index + 1] : null;
    if (target == 'analysis') {
      unawaited(_saveSetup());
      return;
    }
    if (target == 'paywall' && !widget.offerEnabled) {
      _move('free');
      return;
    }
    if (target != null) _move(target);
  }

  void _back() {
    if (_lock) return;
    _cancelAdvance();
    if (_legal != null) {
      setState(() => _legal = null);
      return;
    }
    final active = _draft;
    if (active.setupComplete && const ['results', 'features', 'paywall', 'offer', 'free', 'success'].contains(active.step)) {
      if (active.step == 'features' || active.step == 'paywall') _move('results');
      return;
    }
    final steps = _steps;
    final index = steps.indexOf(active.step);
    final previous = index > 0 ? steps[index - 1] : null;
    if (active.saveStarted && previous != null && steps.indexOf(previous) < steps.indexOf('data')) return;
    if (previous != null) _move(previous);
  }

  Future<void> _finish(String outcome) async {
    if (_lock) return;
    _lock = true;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await completeOnboarding(_actor, _backend, outcome, _port, selectedPlan: _draft.plan);
      if (!_alive) return;
      await _syncUi(result.profile);
      try {
        _storage.removeItem(onboardingDraftKey(_actor, _backend));
        _storage.removeItem('anacan_pending_funnel');
      } catch (_) {
        // Server completion remains authoritative.
      }
      if (_alive) {
        _effects.setFunnelCompleted(true);
        widget.onComplete?.call();
      }
    } catch (failure) {
      _reportError(failure);
    } finally {
      _lock = false;
      _setBusy(false);
    }
  }

  Future<bool> _offer() async {
    if (_lock || _draft.offerSeen) return false;
    _lock = true;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await claimOnboardingOffer(_actor, _backend, _port);
      if (!_alive) return false;
      if (!result.changed) {
        _commit(_draft.copyWith(offerSeen: true, step: 'free'));
        return false;
      }
      _commit(_draft.copyWith(offerSeen: true, step: 'offer'));
      return true;
    } catch (failure) {
      _reportError(failure);
      rethrow;
    } finally {
      _lock = false;
      _setBusy(false);
    }
  }

  Widget _companion(String pose, [CompanionSize size = CompanionSize.compact]) {
    final stage = _draft.stage;
    return stage != null ? OnboardingCompanion(stage: stage, pose: pose, language: _language, size: size) : OnboardingFamily(language: _language);
  }

  Widget _list(List<String> keys) => OnbCheckList([for (final k in keys) t(k)]);

  Widget _legalLinks() => OnbLegalLinks(links: [
        (t('privacy'), () => setState(() => _legal = 'privacy_policy')),
        (t('terms'), () => setState(() => _legal = 'terms_of_service')),
      ]);

  Widget _option({required Key key, required bool pressed, required bool disabled, required VoidCallback onTap, Widget? leading, required String label, String? sub, bool check = false}) {
    final o = OnbStyle.of(context);
    final fg = pressed ? o.surface : o.ink;
    Widget body = Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: pressed ? o.ink : o.surface,
        border: Border.all(color: pressed ? o.ink : o.line, width: 1.5),
        borderRadius: BorderRadius.circular(17),
      ),
      child: Row(children: [
        if (leading != null) ...[leading, const SizedBox(width: 12)],
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: fg)),
            if (sub != null)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(sub, style: TextStyle(fontSize: 12, height: 1.65, fontWeight: FontWeight.w400, color: pressed ? fg : o.muted)),
              ),
          ]),
        ),
        if (check) ...[const SizedBox(width: 12), AIcon(AIcons.check, size: 19, color: fg)],
      ]),
    );
    if (disabled) body = Opacity(opacity: 0.5, child: body);
    return Semantics(
      key: key,
      button: true,
      toggled: pressed,
      enabled: !disabled,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: disabled ? null : onTap, child: body),
    );
  }

  Widget _options(List<Widget> items) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (final (i, w) in items.indexed) ...[if (i > 0) const SizedBox(height: 10), w]],
      );

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    _session = ref.watch(onboardingSessionProvider);
    _storage = ref.watch(onboardingDraftStorageProvider);
    final native = ref.watch(onboardingNativeProvider);
    final nameOnly = _nameOnly;
    final draft = _draft;
    final current = nameOnly ? 'name' : draft.step;
    final steps = onboardingSteps(draft.stage, native);
    final progressStep = draft.setupComplete && const ['offer', 'free', 'success'].contains(current)
        ? steps.length
        : math.min(steps.length, math.max(1, steps.indexOf(current) + 1));
    final featureKeys = draft.stage == 'bump'
        ? const ['development', 'birth_prep', 'nutrition']
        : draft.stage == 'mommy'
            ? const ['sleep', 'feeding', 'milestones']
            : const ['track', 'symptoms', 'health'];
    final stageTitle = draft.stage != null ? t('stage_${draft.stage}') : '';
    final o = OnbStyle.of(context);

    late Widget content;
    Widget? footer = OnboardingButton(label: t('next'), onPressed: _next, busy: _busy);

    if (isQuestion(current)) {
      final options = onboardingQuestionOptions(draft, current);
      final multi = multiQuestions.contains(current);
      final chosen = draft.answers[current];
      final branchIndex = draft.stage != null ? branchQuestions[draft.stage]!.indexOf(current) : -1;
      final pose = branchIndex >= 0 ? 'q${branchIndex + 1}' : current == 'duration' ? 'q4' : current == 'budget' ? 'q5' : 'q2';
      content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _companion(pose, CompanionSize.tiny),
        OnbTitle(t(current == 'concern' ? 'q_concern_${draft.stage}' : 'q_$current'), subtitle: t(multi ? 'multi_hint' : 'single_hint')),
        _options([
          for (final option in options)
            _option(
              key: ValueKey('answer-$option'),
              pressed: chosen is List ? chosen.contains(option) : chosen == option,
              disabled: _busy,
              label: t(option),
              check: chosen is List ? chosen.contains(option) : chosen == option,
              onTap: () {
                _cancelAdvance();
                final answers = Map<String, OnboardingAnswer>.of(_draft.answers);
                answers[current] = multi ? toggleOnboardingAnswer(chosen, option) : option;
                if (current == 'regularity' && option == 'regular' && answers['concern'] == 'irregular') answers.remove('concern');
                if (_commit(_draft.copyWith(answers: answers)) && !multi) {
                  _advancing = Timer(const Duration(milliseconds: 220), () {
                    _advancing = null;
                    if (_alive && _draft.step == current) _next();
                  });
                }
              },
            ),
        ]),
      ]);
      footer = Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (multi) OnboardingButton(label: t('next'), onPressed: _next, busy: _busy),
        OnboardingButton(
          label: t('skip'),
          secondary: true,
          busy: _busy,
          onPressed: () {
            _cancelAdvance();
            final answers = Map<String, OnboardingAnswer>.of(_draft.answers)..remove(current);
            if (_commit(_draft.copyWith(answers: answers))) _next();
          },
        ),
      ]);
    } else {
      switch (current) {
        case 'welcome':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            OnboardingFamily(language: language),
            Column(children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(t('welcome_eyebrow').toUpperCase(),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, letterSpacing: em(0.11, 10), height: 1.7, color: o.muted, fontWeight: FontWeight.w700)),
              ),
              DefaultTextStyle.merge(textAlign: TextAlign.center, child: OnbTitle(t('welcome_title'), subtitle: t('welcome_sub'))),
            ]),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Row(children: [
                for (final (i, (icon, key)) in const [(AIcons.calendarDays, 'feature_tracking'), (AIcons.layoutGrid, 'feature_tools'), (AIcons.heartHandshake, 'feature_community')].indexed) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 14),
                      decoration: BoxDecoration(color: o.bg, borderRadius: BorderRadius.circular(14)),
                      child: Column(children: [
                        AIcon(icon, size: 22, color: o.ink),
                        const SizedBox(height: 8),
                        Text(t(key), textAlign: TextAlign.center, style: const TextStyle(fontSize: 11)),
                      ]),
                    ),
                  ),
                ],
              ]),
            ),
            OnbNote(t('own_pace')),
          ]);
          footer = OnboardingButton(label: t('start'), onPressed: _next);
        case 'stage':
          final enabled = {for (final s in onboardingStages) s: ref.watch(lifeStageEnabledProvider(s))};
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            OnbTitle(t('stage_title'), subtitle: t('stage_sub')),
            _options([
              for (final stage in onboardingStages.where((s) => enabled[s]!))
                _option(
                  key: ValueKey('stage-$stage'),
                  pressed: draft.stage == stage,
                  disabled: false,
                  leading: OnboardingCompanion(stage: stage, pose: 'mode', size: CompanionSize.option, language: language),
                  label: t('stage_$stage'),
                  sub: t('stage_${stage}_sub'),
                  check: draft.stage == stage,
                  onTap: () => _commit(selectOnboardingStage(_draft, stage)),
                ),
            ]),
            if (!onboardingStages.any((s) => enabled[s]!)) Text(t('stage_unavailable')),
          ]);
          footer = null;
        case 'name':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('name'),
            OnbTitle(t('name_title'), subtitle: t('name_sub')),
            OnbTextField(
              fieldKey: const ValueKey('onb-name'),
              label: t('name_label'),
              value: draft.name,
              maxLength: 80,
              disabled: _busy,
              autofillHints: const [AutofillHints.givenName],
              onChanged: (v) => _commit(_draft.copyWith(name: v)),
              onSubmitted: () {
                if (_draft.name.trim().isNotEmpty) _next();
              },
            ),
          ]);
          footer = OnboardingButton(label: t('next'), onPressed: _next, busy: _busy, disabled: draft.name.trim().isEmpty);
        case 'data':
          final invalid = onboardingDataError(draft);
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('data'),
            OnbTitle(t('data_${draft.stage}_title'), subtitle: t('data_sub')),
            OnboardingFields(draft: draft, language: language, onChange: _commit, disabled: _busy),
            if (invalid != null) OnbNote(t(invalid)),
          ]);
          footer = OnboardingButton(label: t('next'), onPressed: _next, busy: _busy, disabled: invalid != null);
        case 'support':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('sproof', CompanionSize.hero),
            OnbTitle(t('support_title'), subtitle: t('support_sub')),
          ]);
        case 'privacy':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('privacy', CompanionSize.hero),
            OnbTitle(t('privacy_title')),
            _list(const ['privacy_save', 'privacy_draft', 'privacy_optional']),
            _legalLinks(),
          ]);
        case 'value':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('value', CompanionSize.hero),
            OnbTitle(t('value_title'), subtitle: t('value_sub')),
            _list(featureKeys),
          ]);
        case 'notifications':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('privacy', CompanionSize.hero),
            OnbTitle(t('notifications_title'), subtitle: t('notifications_sub')),
          ]);
          footer = Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            OnboardingButton(
              label: t('allow_notifications'),
              busy: _busy,
              onPressed: () {
                if (_lock) return;
                _lock = true;
                _setBusy(true);
                final port = ref.read(notificationPermissionProvider);
                () async {
                  var permission = await port.check();
                  if (permission == 'prompt' || permission == 'prompt-with-rationale') permission = await port.request();
                  return permission == 'granted';
                }()
                    .catchError((Object _) => false)
                    .then((granted) {
                  _lock = false;
                  if (!_alive) return;
                  _setBusy(false);
                  if (_commit(_draft.copyWith(notifications: granted ? 'granted' : 'denied'))) unawaited(_saveSetup());
                });
              },
            ),
            OnboardingButton(
              label: t('not_now'),
              secondary: true,
              busy: _busy,
              onPressed: () {
                if (_commit(_draft.copyWith(notifications: 'skipped'))) unawaited(_saveSetup());
              },
            ),
          ]);
        case 'analysis':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('analysis'),
            OnbTitle(t('analysis_title'), subtitle: t('analysis_sub')),
            Center(
              child: Semantics(
                label: t('analysis_title'),
                value: '$_progress',
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 20),
                  width: 106,
                  height: 106,
                  child: Stack(alignment: Alignment.center, children: [
                    CustomPaint(size: const Size(106, 106), painter: _RingPainter(_progress / 100, o.line, o.accent)),
                    Text('${onboardingNumber(language, _progress)}%',
                        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
                  ]),
                ),
              ),
            ),
            OnbCheckList(
              [for (final k in const ['saving_details', 'saving_preferences', 'saving_profile', 'saved']) t(k)],
              done: [for (final threshold in const [50, 65, 90, 100]) _progress >= threshold],
              iconSize: 18,
            ),
          ]);
          footer = _error != null ? OnboardingButton(label: t('retry'), onPressed: () => unawaited(_saveSetup()), busy: _busy) : null;
        case 'results':
          final profile = _session.profile;
          final lmp = profile?['last_period_date'] as String?;
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _summaryHeading(t('results_title', {'name': draft.name}), t('results_sub'), 'results'),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Wrap(spacing: 6, runSpacing: 6, children: [
                _chip(stageTitle),
                if (draft.stage == 'mommy') _chip(t('child_number', {'n': onboardingNumber(language, draft.babyCount)})),
                if (draft.stage != 'mommy' && lmp != null && lmp.isNotEmpty) _chip(onboardingDate(language, lmp)),
              ]),
            ),
            OnboardingBenefits(stage: draft.stage!, page: 'results', language: language),
          ]);
          footer = OnboardingButton(label: t('view_plan'), onPressed: _next, busy: _busy);
        case 'features':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _summaryHeading(t('features_title'), t('features_sub'), 'proof'),
            OnboardingBenefits(stage: draft.stage!, page: 'features', language: language),
          ]);
        case 'paywall':
        case 'offer':
          content = OnboardingPaywall(
            key: ValueKey('paywall-$current'),
            stage: draft.stage!,
            language: language,
            mode: current,
            initialPlan: draft.plan,
            onPlanChange: (plan) => _commit(_draft.copyWith(plan: plan)),
            offerSeen: draft.offerSeen || !widget.offerEnabled,
            pending: draft.purchasePending,
            onPending: () => _commit(_draft.copyWith(purchasePending: true)),
            onOffer: _offer,
            onSkip: () => _move('free'),
            onLegal: (doc) => setState(() => _legal = doc),
            onSuccess: (outcome, [selectedPlan]) => _commit(_draft.copyWith(
              plan: selectedPlan ?? _draft.plan,
              purchasePending: false,
              outcome: outcome,
              step: 'success',
            )),
          );
          footer = null;
        case 'free':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('freemode', CompanionSize.hero),
            OnbTitle(t('free_title'), subtitle: t('free_sub')),
            _list(featureKeys),
          ]);
          footer = OnboardingButton(testId: 'onb-finish', label: t('continue_free'), onPressed: () => unawaited(_finish('free')), busy: _busy);
        case 'success':
          content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _companion('success', CompanionSize.hero),
            OnbTitle(t('success_title'), subtitle: t('success_sub')),
            _list(const ['premium_ai', 'premium_noads', 'premium_household']),
          ]);
          footer = OnboardingButton(label: t('open_app'), onPressed: () => unawaited(_finish(draft.outcome ?? 'existing')), busy: _busy);
        default:
          content = const SizedBox.shrink();
      }
    }

    if (_legal != null) {
      final builder = ref.watch(featureRegistryProvider).screen(ScreenId.legal);
      final doc = _legal!;
      void close() => setState(() => _legal = null);
      return OnboardingFrame(
        language: language,
        step: 'legal-$doc',
        onBack: close,
        child: builder != null
            ? SizedBox(
                height: MediaQuery.sizeOf(context).height,
                child: builder(context, ShellScreenArgs(screen: ShellScreen(ScreenId.legal, 'legal/$doc', doc), onBack: close)),
              )
            : ShellPlaceholder(kind: 'screen', id: 'legal/$doc', onBack: close, fill: false),
      );
    }
    final canBack = !nameOnly &&
        current != 'welcome' &&
        !(draft.setupComplete && const ['results', 'offer', 'free', 'success'].contains(current)) &&
        !(draft.saveStarted && const ['data', 'stage', 'name'].contains(current));
    return OnboardingFrame(
      language: language,
      step: current,
      current: nameOnly ? 1 : progressStep,
      total: nameOnly ? 1 : steps.length,
      onBack: canBack ? _back : null,
      busy: _busy,
      footer: _error != null || footer != null
          ? Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) OnbError(t(_error!)),
              ?footer,
            ])
          : null,
      child: content,
    );
  }

  Widget _summaryHeading(String heading, String sub, String pose) => Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 14),
        child: Row(children: [
          Expanded(child: OnbTitle(heading, subtitle: sub, summary: true)),
          const SizedBox(width: 12),
          OnboardingCompanion(stage: _draft.stage!, pose: pose, language: _language, size: CompanionSize.tiny, inSummary: true),
        ]),
      );

  Widget _chip(String text) {
    final o = OnbStyle.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: o.bg, border: Border.all(color: o.line), borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: const TextStyle(fontSize: 11)),
    );
  }
}

/// `.onb-ring svg`: r 46, stroke 7, rotated −90°, round cap.
class _RingPainter extends CustomPainter {
  _RingPainter(this.fraction, this.track, this.fill);
  final double fraction;
  final Color track;
  final Color fill;
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7;
    canvas.drawCircle(center, 46, paint..color = track);
    if (fraction > 0) {
      canvas.drawArc(Rect.fromCircle(center: center, radius: 46), -math.pi / 2, 2 * math.pi * fraction.clamp(0.0, 1.0), false,
          paint
            ..color = fill
            ..strokeCap = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction || old.track != track || old.fill != fill;
}
