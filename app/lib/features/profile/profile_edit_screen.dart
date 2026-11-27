// Ported from: src/components/ProfileEditScreen.tsx
//
// Edit profile: avatar (square crop → `community-media/avatars/<uid>-<ms>.<ext>`), name/country/bio, life stage
// with pregnancy (LMP ↔ due date), multiples + chorionicity, flow cycle and mommy baby fields. Dates are written only
// when the user changed them or the stage changed (see the React comments); mommy baby fields go to the selected
// `user_children` row.
import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/data/data.dart' show dbProvider, asRow, RowFields;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/dates/local_date.dart';
import '../../domain/pregnancy/pregnancy_utils.dart' as pu;
import '../../state/state.dart' show userStoreProvider;
import '../settings/copy/countries.g.dart';
import '../settings/ui/settings_ui.dart';
import 'data/children.dart';
import 'profile_interfaces.dart';
import 'profile_screen.dart' show profileAvatarBuilderProvider;

/// A picked image file.
class PickedImage {
  const PickedImage({required this.bytes, required this.name, this.mimeType});
  final Uint8List bytes;
  final String name;
  final String? mimeType;
}

/// `<input type="file" accept="image/*">` (image_picker gallery).
abstract interface class AvatarPicker {
  Future<PickedImage?> pick();
}

class ImagePickerAvatarPicker implements AvatarPicker {
  const ImagePickerAvatarPicker();
  @override
  Future<PickedImage?> pick() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return null;
    return PickedImage(bytes: await file.readAsBytes(), name: file.name, mimeType: file.mimeType);
  }
}

final avatarPickerProvider = Provider<AvatarPicker>((ref) => const ImagePickerAvatarPicker());

/// Data access of the screen.
abstract interface class ProfileEditRepository {
  Future<String?> loadBio(String userId);

  /// `profiles.update(updateData).eq('user_id', uid)`; throws on error.
  Future<void> updateProfileRow(String userId, Map<String, dynamic> data);

  /// Uploads to `community-media` and returns the public URL; throws on error.
  Future<String> uploadAvatar(String path, Uint8List bytes, String contentType);
}

class SupabaseProfileEditRepository implements ProfileEditRepository {
  SupabaseProfileEditRepository(this._ref);
  final Ref _ref;
  @override
  Future<String?> loadBio(String userId) async {
    final row = asRow(await _ref.read(dbProvider).from('profiles').select('bio').eq('user_id', userId).single());
    return row?.str('bio');
  }

  @override
  Future<void> updateProfileRow(String userId, Map<String, dynamic> data) async {
    await _ref.read(dbProvider).from('profiles').update(data).eq('user_id', userId);
  }

  @override
  Future<String> uploadAvatar(String path, Uint8List bytes, String contentType) async {
    final db = _ref.read(dbProvider);
    final res = await db.upload('community-media', path, bytes, contentType: contentType);
    if (!res.ok) throw res.error ?? StateError('upload failed');
    return db.publicUrl('community-media', path);
  }
}

final profileEditRepositoryProvider = Provider<ProfileEditRepository>((ref) => SupabaseProfileEditRepository(ref));

/// `squareCropAvatar(file, 512)`: centre square, at most 512px. The web encodes JPEG 0.88; dart:ui can only
/// encode PNG, so the cropped avatar is uploaded as PNG (see README "Deviations").
Future<Uint8List> squareCropAvatar(Uint8List bytes, {int size = 512}) async {
  final codec = await ui.instantiateImageCodec(bytes);
  final frame = await codec.getNextFrame();
  final img = frame.image;
  final side = img.width < img.height ? img.width : img.height;
  final sx = (img.width - side) / 2;
  final sy = (img.height - side) / 2;
  final target = side < size ? side : size;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawImageRect(img, Rect.fromLTWH(sx, sy, side.toDouble(), side.toDouble()), Rect.fromLTWH(0, 0, target.toDouble(), target.toDouble()),
      Paint()..filterQuality = FilterQuality.high);
  final out = await recorder.endRecording().toImage(target, target);
  final data = await out.toByteData(format: ui.ImageByteFormat.png);
  if (data == null) throw StateError('encode failed');
  return data.buffer.asUint8List();
}

enum DateInputMode { lmp, dueDate }

/// Pure part of `handleSave`: the `profiles` update payload.
Map<String, dynamic> buildProfileUpdate({
  required Map<String, dynamic> form,
  required DateInputMode mode,
  required Map<String, dynamic>? profileRow,
}) {
  String? effectiveLMP;
  String? effectiveDue;
  final stage = form['life_stage'] as String;
  final lmpIn = form['last_period_date'] as String;
  final dueIn = form['due_date'] as String;
  if (stage == 'bump') {
    if (mode == DateInputMode.lmp && lmpIn.isNotEmpty) {
      effectiveLMP = lmpIn;
      final d = pu.calculateDueDate(lmpIn);
      effectiveDue = d == null ? null : localDateKey(d);
    } else if (mode == DateInputMode.dueDate && dueIn.isNotEmpty) {
      effectiveDue = dueIn;
      final l = pu.calculateLMPFromDueDate(dueIn);
      effectiveLMP = l == null ? null : localDateKey(l);
    }
  }
  final baby = form['baby_name'] as String;
  final country = form['country_code'] as String;
  final update = <String, dynamic>{
    'name': form['name'],
    'avatar_url': form['avatar_url'],
    'bio': form['bio'],
    'life_stage': stage,
    'baby_name': baby.isEmpty ? null : baby,
    'cycle_length': form['cycle_length'],
    'country_code': country.isEmpty ? null : country,
  };
  final row = profileRow ?? const <String, dynamic>{};
  if (row['loss_recovery_active'] == true && stage != 'flow') update['loss_recovery_active'] = false;
  final dbLMP = _nonEmpty(row['last_period_date']);
  final dbDue = _nonEmpty(row['due_date']);
  final stageChanged = row['life_stage'] != stage;
  if (stage == 'bump') {
    final datesChanged = effectiveLMP != dbLMP || effectiveDue != dbDue;
    if (stageChanged || datesChanged) {
      final touched = mode == DateInputMode.lmp ? lmpIn != (dbLMP ?? '') : dueIn != (dbDue ?? '');
      if (stageChanged || touched) {
        update['due_date'] = effectiveDue;
        update['last_period_date'] = effectiveLMP;
      }
    }
    final multiples = form['multiples_type'] as String;
    update['multiples_type'] = multiples;
    update['baby_count'] = switch (multiples) { 'twins' => 2, 'triplets' => 3, 'quadruplets' => 4, _ => 1 };
    final chorion = form['chorionicity'] as String;
    update['chorionicity'] = multiples == 'single' ? null : (chorion.isEmpty ? null : chorion);
  } else if (stage == 'flow') {
    final flowLMP = lmpIn.isEmpty ? null : lmpIn;
    if (stageChanged || flowLMP != dbLMP) {
      update['last_period_date'] = flowLMP;
      update['due_date'] = null;
    }
  } else if (stageChanged) {
    update['last_period_date'] = null;
    update['due_date'] = null;
  }
  if (stage == 'mommy') {
    final bd = form['baby_birth_date'] as String;
    final g = form['baby_gender'] as String;
    update['baby_birth_date'] = bd.isEmpty ? null : bd;
    update['baby_gender'] = g.isEmpty ? null : g;
  }
  return update;
}

String? _nonEmpty(Object? v) => v is String && v.isNotEmpty ? v : null;

/// `date.toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long', year: 'numeric' })`.
String formatLongDate(DateTime? date) {
  if (date == null) return '';
  final lang = currentLanguage();
  try {
    return DateFormat.yMMMMd(appLanguage(lang).intlLocale).format(date);
  } catch (_) {
    return DateFormat.yMMMMd('en_US').format(date);
  }
}

class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  bool _loading = false;
  bool _uploading = false;
  late DateInputMode _mode;
  late Map<String, dynamic> _form;
  bool _babySynced = false;
  final Map<String, TextEditingController> _text = {};

  TextEditingController _ctl(String key) => _text[key] ??= TextEditingController(text: '${_form[key] ?? ''}');

  @override
  void initState() {
    super.initState();
    final store = ref.read(userStoreProvider);
    final profile = ref.read(authProfileProvider);
    final selected = ref.read(childrenControllerProvider).selectedChild;
    _mode = store.lastPeriodDate != null ? DateInputMode.lmp : DateInputMode.dueDate;
    final p = profile?.row ?? const <String, dynamic>{};
    _form = <String, dynamic>{
      'name': profile?.name ?? '',
      'bio': '',
      'avatar_url': profile?.avatarUrl ?? '',
      'life_stage': store.lifeStage ?? 'bump',
      'baby_name': selected?.name ?? store.babyName ?? '',
      'due_date': storedDateKey(store.dueDate) ?? '',
      'last_period_date': storedDateKey(store.lastPeriodDate) ?? '',
      'cycle_length': store.cycleLength == 0 ? 28 : store.cycleLength,
      'baby_birth_date': selected?.birthDate ?? storedDateKey(store.babyBirthDate) ?? '',
      'baby_gender': selected?.gender == 'girl' ? 'girl' : selected?.gender == 'boy' ? 'boy' : (store.babyGender ?? ''),
      'country_code': (p['country_code'] as String?) ?? store.countryCode ?? '',
      'multiples_type': profile?.multiplesType ?? 'single',
      'chorionicity': (p['chorionicity'] as String?) ?? '',
    };
    if (selected != null) _babySynced = true;
    unawaited(_loadBio());
  }

  Future<void> _loadBio() async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    try {
      final bio = await ref.read(profileEditRepositoryProvider).loadBio(user.id);
      if (bio != null && bio.isNotEmpty && mounted) {
        setState(() => _form['bio'] = bio);
        _ctl('bio').text = bio;
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    for (final c in _text.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _set(String key, Object? value) => setState(() => _form[key] = value);

  Future<void> _pickAvatar() async {
    final user = ref.read(authUserProvider);
    final picked = await ref.read(avatarPickerProvider).pick();
    if (picked == null || user == null || !mounted) return;
    final toast = toasts(context);
    setState(() => _uploading = true);
    try {
      var body = picked.bytes;
      var ext = picked.name.contains('.') ? picked.name.split('.').last : 'jpg';
      var type = picked.mimeType ?? 'image/jpeg';
      try {
        body = await squareCropAvatar(picked.bytes);
        ext = 'png';
        type = 'image/png';
      } catch (_) {
        // fallback: original file
      }
      final path = 'avatars/${user.id}-${DateTime.now().millisecondsSinceEpoch}.$ext';
      final url = await ref.read(profileEditRepositoryProvider).uploadAvatar(path, body, type);
      if (mounted) _set('avatar_url', url);
      toast.show(title: tr('profileeditscreen_sekil_yuklendi_0c2f85', 'Şəkil yükləndi!'));
    } catch (error) {
      toast.show(title: tr('profileeditscreen_xeta_3cdbb6', 'Xəta'), description: '$error', destructive: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final user = ref.read(authUserProvider);
    if (user == null) return;
    final toast = toasts(context);
    setState(() => _loading = true);
    try {
      final profile = ref.read(authProfileProvider);
      final update = buildProfileUpdate(form: _form, mode: _mode, profileRow: profile?.row);
      await ref.read(profileEditRepositoryProvider).updateProfileRow(user.id, update);
      final store = ref.read(userStoreProvider.notifier);
      final storeState = ref.read(userStoreProvider);
      final stage = _form['life_stage'] as String;
      store.setLifeStage(stage);
      if (stage == 'bump') {
        final lmp = update.containsKey('last_period_date') ? update['last_period_date'] as String? : _effective(true);
        final due = update.containsKey('due_date') ? update['due_date'] as String? : _effective(false);
        if (lmp != null) store.setLastPeriodDate(parseJsDate(lmp));
        if (due != null) store.setDueDate(parseJsDate(due));
      } else if (stage == 'flow') {
        final lmp = _form['last_period_date'] as String;
        if (lmp.isNotEmpty) store.setLastPeriodDate(parseJsDate(lmp));
      }
      final cycle = _form['cycle_length'] as int;
      if (cycle != 0) store.setCycleLength(cycle);
      final babyName = _form['baby_name'] as String;
      final birth = _form['baby_birth_date'] as String;
      final gender = _form['baby_gender'] as String;
      if (stage == 'mommy' && birth.isNotEmpty && gender.isNotEmpty) {
        final display = babyName.isNotEmpty ? babyName : tr('profileeditscreen_korpe_fa2b51', 'Körpə');
        store.setBabyData(parseJsDate(birth)!, display, gender);
        final children = ref.read(childrenControllerProvider);
        final selected = children.selectedChild;
        final updates = {'name': display, 'birth_date': birth, 'gender': gender, 'avatar_emoji': gender == 'girl' ? '👧' : '👦'};
        final synced = selected != null
            ? await children.updateChild(selected.id, updates)
            : (await children.addChild(name: display, birthDate: birth, gender: gender, avatarEmoji: updates['avatar_emoji'])) != null;
        if (!synced) {
          toast.show(
            title: tr('profileeditscreen_xeta_3cdbb6', 'Xəta'),
            description: tr('profileeditscreen_korpe_melumati_yenilenmedi', 'Körpə məlumatı yenilənmədi — yenidən cəhd edin'),
            destructive: true,
          );
        }
      } else if (babyName.isNotEmpty && storeState.babyBirthDate != null && storeState.babyGender != null) {
        store.setBabyData(storeState.babyBirthDate!, babyName, storeState.babyGender!);
      }
      await ref.read(accountActionsProvider).updateProfile({'name': _form['name']});
      final country = _form['country_code'] as String;
      store.setCountryCode(country.isEmpty ? null : country);
      toast.show(title: tr('profileeditscreen_profil_yenilendi_ad61ca', 'Profil yeniləndi!'));
      widget.onBack();
    } catch (error) {
      toast.show(title: tr('profileeditscreen_xeta_3cdbb6', 'Xəta'), description: '$error', destructive: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Effective LMP (true) or due date (false) of the bump form.
  String? _effective(bool lmp) {
    final l = _form['last_period_date'] as String;
    final d = _form['due_date'] as String;
    if (_mode == DateInputMode.lmp && l.isNotEmpty) {
      if (lmp) return l;
      final due = pu.calculateDueDate(l);
      return due == null ? null : localDateKey(due);
    }
    if (_mode == DateInputMode.dueDate && d.isNotEmpty) {
      if (!lmp) return d;
      final x = pu.calculateLMPFromDueDate(d);
      return x == null ? null : localDateKey(x);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    // One-shot sync of the baby fields once useChildren() has data.
    ref.listen(childrenQuery, (_, next) {
      if (_babySynced) return;
      final selected = ref.read(childrenControllerProvider).selectedChild;
      if (selected == null) return;
      _babySynced = true;
      setState(() {
        _form['baby_name'] = selected.name;
        _form['baby_birth_date'] = selected.birthDate;
        _form['baby_gender'] = selected.gender == 'girl' ? 'girl' : 'boy';
      });
      _ctl('baby_name').text = selected.name;
    });
    final user = ref.watch(authUserProvider);
    final label = px(12.5, weight: FontWeight.w600, color: a.inkSoft);
    final stage = _form['life_stage'] as String;
    Widget field(String text, Widget input) => VGap(gap: 8, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[Text(text, style: label), input]);
    Widget input(String key, {String? placeholder, TextInputType? type, ValueChanged<String>? onChanged}) => ShadInput(
          fieldKey: ValueKey<String>('edit-$key'),
          controller: _ctl(key),
          placeholder: placeholder,
          height: 44,
          radius: 12,
          background: a.surface,
          borderColor: a.lineStrong,
          textColor: a.ink,
          keyboardType: type,
          onChanged: onChanged ?? (v) => _set(key, v),
        );
    Widget date(String key) => DateFieldBox(
          fieldKey: ValueKey<String>('edit-$key'),
          value: _form[key] as String,
          background: a.surface,
          borderColor: a.lineStrong,
          textColor: a.ink,
          onChanged: (v) => _set(key, v),
        );
    ShadSelect<String> select(String key, List<(String, String)> opts, {String? placeholder, String? value}) => ShadSelect<String>(
          fieldKey: ValueKey<String>('edit-$key-select'),
          value: value ?? ((_form[key] as String).isEmpty ? null : _form[key] as String),
          placeholder: placeholder,
          background: a.surface,
          borderColor: a.lineStrong,
          textColor: a.ink,
          options: [for (final o in opts) (o.$1, Text(o.$2))],
          onChanged: (v) => _set(key, v),
        );
    Widget cardTitle(AIconData icon, String text) => Row(children: <Widget>[
          AIcon(icon, size: 15, color: a.accentInk),
          const SizedBox(width: 8),
          Text(text, style: context.aText.aCardTitle),
        ]);

    final calc = _calculated();
    final avatarUrl = _form['avatar_url'] as String;
    final name = _form['name'] as String;
    final avatar = ref.watch(profileAvatarBuilderProvider);

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Column(children: <Widget>[
          ClipRect(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 9, sigmaY: 9),
              child: Container(
                decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(children: <Widget>[
                  AIconBtn(onTap: widget.onBack, tapScale: 0.95, semanticLabel: tr('common_geri', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(tr('profileeditscreen_profili_redakte_et_b5368c', 'Profili Redaktə Et'),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: px(16, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
                  ),
                  const SizedBox(width: 12),
                  Opacity(
                    opacity: _loading ? 0.5 : 1,
                    child: AButton(
                      key: const ValueKey<String>('edit-save'),
                      variant: AButtonVariant.pillSolid,
                      onPressed: _loading ? null : _save,
                      leading: _loading ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.save, size: 14),
                      child: Text(tr('profileeditscreen_saxla', 'Saxla')),
                    ),
                  ),
                ]),
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 448),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                    child: VGap(gap: 16, children: <Widget>[
                      Column(children: <Widget>[
                        Stack(clipBehavior: Clip.none, children: <Widget>[
                          Container(
                            width: 112,
                            height: 112,
                            clipBehavior: Clip.antiAlias,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: a.peach1, shape: BoxShape.circle, border: Border.all(color: a.peach1, width: 4)),
                            child: avatarUrl.isNotEmpty
                                ? SizedBox.expand(child: avatar(avatarUrl))
                                : Text(name.isNotEmpty ? name.characters.first : tr('common_initial_i', 'İ'), style: px(30, weight: FontWeight.w800, color: a.accentInk)),
                          ),
                          PositionedDirectional(
                            bottom: 0,
                            end: 0,
                            child: PressScale(
                              key: const ValueKey<String>('edit-avatar'),
                              scale: 0.95,
                              enabled: !_uploading,
                              onTap: _uploading ? null : _pickAvatar,
                              child: Container(
                                width: 40,
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: a.peach2,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: a.surface, width: 3),
                                  boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 10), blurRadius: 20, spreadRadius: -8)],
                                ),
                                child: _uploading ? const ALoader(size: 16, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.camera, size: 16, color: Color(0xFFFFFFFF)),
                              ),
                            ),
                          ),
                        ]),
                        const SizedBox(height: 8),
                        Text(tr('profileeditscreen_profil_seklini_deyis_7dbfc6', 'Profil şəklini dəyiş'), style: px(12.5, color: a.inkSoft)),
                      ]),
                      ACard(
                        child: VGap(gap: 16, children: <Widget>[
                          cardTitle(AIcons.user, tr('profileeditscreen_esas_melumatlar_56bfed', 'Əsas Məlumatlar')),
                          field(tr('untranslated_ad_i34vkg', 'Ad'), input('name', placeholder: tr('profileeditscreen_adiniz_b3e84a', 'Adınız'))),
                          field(
                            tr('authscreen_olke', 'Ölkə'),
                            ShadSelect<String>(
                              fieldKey: const ValueKey<String>('edit-country'),
                              value: (_form['country_code'] as String).isEmpty ? null : _form['country_code'] as String,
                              placeholder: tr('authscreen_olke_secin', 'Ölkə seçin'),
                              background: a.surface,
                              borderColor: a.lineStrong,
                              textColor: a.ink,
                              options: [
                                for (final c in kCountries)
                                  (
                                    c.$1,
                                    Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                                      Container(
                                        decoration: BoxDecoration(border: Border.all(color: a.line), borderRadius: BorderRadius.circular(2)),
                                        child: Image.asset('assets/images/profile/flags/${c.$1}.png', width: 24, height: 16, fit: BoxFit.cover),
                                      ),
                                      const SizedBox(width: 8),
                                      Flexible(child: Text(c.$2, overflow: TextOverflow.ellipsis)),
                                    ]),
                                  ),
                              ],
                              onChanged: (v) => _set('country_code', v),
                            ),
                          ),
                          field(
                            'Bio',
                            ShadInput(
                              fieldKey: const ValueKey<String>('edit-bio'),
                              controller: _ctl('bio'),
                              maxLines: null,
                              radius: 12,
                              background: a.surface,
                              borderColor: a.lineStrong,
                              textColor: a.ink,
                              placeholder: tr('profileeditscreen_ozunuz_haqqinda_qisa_melumat_1a283c', 'Özünüz haqqında qısa məlumat...'),
                              onChanged: (v) => _set('bio', v),
                            ),
                          ),
                          field(
                            'Email',
                            ShadInput(
                              controller: TextEditingController(text: user?.email ?? ''),
                              enabled: false,
                              height: 44,
                              radius: 12,
                              background: a.surfaceSoft,
                              borderColor: a.lineStrong,
                              textColor: a.ink,
                            ),
                          ),
                        ]),
                      ),
                      ACard(
                        child: VGap(gap: 16, children: <Widget>[
                          cardTitle(AIcons.calendar, tr('profileeditscreen_merhele_0e09aa', 'Mərhələ')),
                          field(
                            tr('profileeditscreen_merhele_0e09aa', 'Mərhələ'),
                            select('life_stage', [
                              ('flow', tr('profileeditscreen_menstruasiya_izleyicisi_b0d2dd', '🌸 Menstruasiya izləyicisi')),
                              ('bump', tr('profileeditscreen_hamileyem_01937d', '🤰 Hamiləyəm')),
                              ('mommy', tr('profileeditscreen_anayam_mommy', '👶 Anayam')),
                            ]),
                          ),
                          if (stage == 'bump') ...<Widget>[
                            VGap(gap: 12, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                              Text(tr('profileeditscreen_tarix_novunu_secin_ad6b20', 'Tarix növünü seçin'), style: label),
                              Row(children: <Widget>[
                                _toggle(DateInputMode.lmp, AIcons.calendarDays, tr('profileeditscreen_son_menstruasiya_tarixi_7c9f8a', '📅 Son menstruasiya tarixi:')),
                                const SizedBox(width: 8),
                                _toggle(DateInputMode.dueDate, AIcons.baby, tr('profileeditscreen_dogus_tarixi_e2caea', 'Doğuş tarixi')),
                              ]),
                            ]),
                            if (_mode == DateInputMode.lmp)
                              field(tr('profileeditscreen_son_menstruasiyan_ilk_gunu_c79f76', 'Son menstruasiyanın ilk günü'), date('last_period_date'))
                            else
                              field(tr('profileeditscreen_texmini_dogus_tarixi_a8b543', 'Təxmini doğuş tarixi'), date('due_date')),
                            if (calc.due != null || calc.lmp != null)
                              FadeRise(
                                dy: 10,
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(16)),
                                  child: VGap(gap: 8, crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                                    Row(children: <Widget>[
                                      AIcon(AIcons.sparkles, size: 16, color: a.accentInk),
                                      const SizedBox(width: 8),
                                      Text(tr('profileeditscreen_hesablanmis_melumatlar_b5a420', 'Hesablanmış məlumatlar'), style: px(13, weight: FontWeight.w700, color: a.accentInk)),
                                    ]),
                                    if (calc.due != null) _calcLine(tr('profileeditscreen_texmini_dogus_tarixi_011e51', '🎯 Təxmini doğuş tarixi:'), formatLongDate(calc.due)),
                                    if (calc.lmp != null) _calcLine(tr('profileeditscreen_son_menstruasiya_tarixi_7c9f8a', '📅 Son menstruasiya tarixi:'), formatLongDate(calc.lmp)),
                                    if (calc.week > 0)
                                      Opacity(
                                        opacity: 0.85,
                                        child: _calcLine(
                                          tr('profileeditscreen_hazirda_33b3c8', 'Hazırda:'),
                                          '${calc.week} ${tr('profileeditscreen_hefte_d4c248', 'həftə')} ${calc.day} ${tr('profileeditscreen_gun_54e78d', 'gün')}',
                                        ),
                                      ),
                                  ]),
                                ),
                              ),
                            field(tr('profileeditscreen_korpenin_adi_isteye_bagli_4e76c8', 'Körpənin adı (istəyə bağlı)'), input('baby_name', placeholder: tr('profileeditscreen_korpenin_adi_8a4e9e', 'Körpənin adı'))),
                            field(
                              tr('profile_multiples_label', 'Neçə körpə gözləyirsiniz?'),
                              ShadSelect<String>(
                                fieldKey: const ValueKey<String>('edit-multiples'),
                                value: _form['multiples_type'] as String,
                                background: a.surface,
                                borderColor: a.lineStrong,
                                textColor: a.ink,
                                options: [
                                  ('single', Text('👶 ${tr('profile_multiples_single', 'Tək körpə')}')),
                                  ('twins', Text('👶👶 ${tr('profile_multiples_twins', 'Əkiz')}')),
                                ],
                                onChanged: (v) => setState(() {
                                  _form['multiples_type'] = v;
                                  if (v == 'single') _form['chorionicity'] = '';
                                }),
                              ),
                            ),
                            if (_form['multiples_type'] != 'single')
                              field(
                                tr('chorionicity_label', 'Plasenta növü (Xorionluq)'),
                                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                                  select(
                                    'chorionicity',
                                    [
                                      ('unknown', tr('chorionicity_unknown', 'Hələ bilmirəm / USM gözləyirəm')),
                                      ('dichorionic', tr('chorionicity_dichorionic', 'Ayrı-ayrı plasentalar (Dixorionik)')),
                                      ('monochorionic_diamniotic', tr('chorionicity_mcda', 'Ortaq plasenta, ayrı kisələr (Monoxorionik-Diamniotik)')),
                                      ('monochorionic_monoamniotic', tr('chorionicity_mcma', 'Ortaq plasenta və ortaq kisə (Monoxorionik-Monoamniotik)')),
                                    ],
                                    value: (_form['chorionicity'] as String).isEmpty ? 'unknown' : _form['chorionicity'] as String,
                                    placeholder: tr('chorionicity_placeholder', 'Seçin (USM-də məlum olur)'),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(_chorionHelp(_form['chorionicity'] as String), style: Tw.xs.copyWith(color: a.inkFaint, height: 1.5)),
                                ]),
                              ),
                          ],
                          if (stage == 'flow') ...<Widget>[
                            field(tr('untranslated_son_menstruasiya_tarixi_fgz9t7', 'Son menstruasiya tarixi'), date('last_period_date')),
                            field(
                              tr('profileeditscreen_dovrun_uzunlugu_gun_4d99da', 'Dövrün uzunluğu (gün)'),
                              input('cycle_length', type: TextInputType.number, onChanged: (v) => _set('cycle_length', int.tryParse(v) ?? 28)),
                            ),
                          ],
                          if (stage == 'mommy') ...<Widget>[
                            field(tr('profileeditscreen_korpenin_adi_8a4e9e', 'Körpənin adı'), input('baby_name', placeholder: tr('profileeditscreen_korpenin_adi_8a4e9e', 'Körpənin adı'))),
                            field(tr('profileeditscreen_dogus_tarixi_e2caea', 'Doğuş tarixi'), date('baby_birth_date')),
                            field(
                              tr('untranslated_cinsi_az7fty', 'Cinsi'),
                              select('baby_gender', [('boy', tr('profileeditscreen_oglan_c41cd8', '👦 Oğlan')), ('girl', tr('profileeditscreen_qiz_cc9008', '👧 Qız'))],
                                  placeholder: tr('profileeditscreen_secin_5c0c8d', 'Seçin')),
                            ),
                          ],
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  String _chorionHelp(String c) => switch (c) {
        'dichorionic' => tr('chorionicity_help_dichorionic', 'Hər körpənin öz plasentası var — ən aşağı riskli növdür, əkiz doğuşların əksəriyyəti bu qrupdadır.'),
        'monochorionic_diamniotic' => tr('chorionicity_help_mcda',
            'Körpələr eyni plasentanı paylaşır (adətən eyniz əkizlərdə) — TTTS (əkiz-əkizə transfuziya sindromu) riskinə görə USM-lər daha tez-tez təyin olunur.'),
        'monochorionic_monoamniotic' => tr('chorionicity_help_mcma', 'Körpələr həm plasentanı, həm kisəni paylaşır — nadir haldır, ən yaxın izləmə tələb edir (göbək ciyəsi dolaşması riski də var).'),
        _ => tr('chorionicity_help_unknown',
            'Adətən 10-14-cü həftə USM-də (dating scan) müəyyən olunur — həkiminiz sizə deyəcək. Ortaq plasenta olduqda USM-lər daha tez-tez planlaşdırılır.'),
      };

  Widget _calcLine(String label, String value) => Text.rich(
        TextSpan(children: <InlineSpan>[
          TextSpan(text: '$label '),
          TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ]),
        style: px(13, color: context.a.accentInk),
      );

  ({DateTime? due, DateTime? lmp, int week, int day}) _calculated() {
    final l = _form['last_period_date'] as String;
    final d = _form['due_date'] as String;
    if (_mode == DateInputMode.lmp && l.isNotEmpty) {
      final lmp = parseJsDate(l);
      return (due: pu.calculateDueDate(lmp), lmp: null, week: pu.getPregnancyWeek(lmp).toInt(), day: pu.getDayInWeek(lmp).toInt());
    }
    if (_mode == DateInputMode.dueDate && d.isNotEmpty) {
      final lmp = pu.calculateLMPFromDueDate(parseJsDate(d));
      return (due: null, lmp: lmp, week: lmp == null ? 0 : pu.getPregnancyWeek(lmp).toInt(), day: lmp == null ? 0 : pu.getDayInWeek(lmp).toInt());
    }
    return (due: null, lmp: null, week: 0, day: 0);
  }

  Widget _toggle(DateInputMode mode, AIconData icon, String text) {
    final a = context.a;
    final on = _mode == mode;
    return Expanded(
      child: GestureDetector(
        key: ValueKey<String>('edit-mode-${mode.name}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _mode = mode),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: on ? a.peach1 : null, borderRadius: BorderRadius.circular(12), border: Border.all(color: on ? a.peach2 : a.lineStrong)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
            AIcon(icon, size: 16, color: on ? a.accentInk : a.ink),
            const SizedBox(width: 8),
            Flexible(child: Text(text, style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: on ? a.accentInk : a.ink))),
          ]),
        ),
      ),
    );
  }
}
