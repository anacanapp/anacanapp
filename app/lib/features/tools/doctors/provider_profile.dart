// Ported from: src/components/tools/doctors/providerProfile.ts
//
// Doctor profile text → structured fields, in any app language. Descriptions start with "Header: value" lines and the
// translated copies keep that shape with translated headers; the leading run of such lines is read generically,
// recognised headers (any language) get the richer layout, others are shown as label / value pairs.
import 'package:flutter/foundation.dart';

import '../../../core/i18n/lang_detect.dart' show composeNfc;

/// 'experience' | 'languages' | 'education' | 'master' | 'interests' | 'services'
typedef ProfileField = String;

const Map<ProfileField, List<String>> _aliases = {
  'experience': ['Təcrübə', 'Experience', 'Work experience', 'Years of experience', 'Опыт', 'Опыт работы', 'Стаж', 'Deneyim',
    'Tecrübe', 'Тәжірибе', 'Тәжірибесі', 'Tajriba', 'გამოცდილება', 'Erfahrung', 'Berufserfahrung', 'الخبرة', 'Experiencia',
    'Kogemus', 'Töökogemus', 'Expérience', 'अनुभव', 'Pengalaman', '経験', '경력', 'Тажрыйба', 'Тажрыйбасы', 'Ervaring',
    'Doświadczenie', 'Doświadczenie (w latach)', 'Liczba lat doświadczenia', 'Experiência', 'Erfarenhet', 'Kinh nghiệm',
    '从业经验', '经验'],
  'languages': ['Dillər', 'Languages', 'Языки', 'Diller', 'Тілдер', 'Тілдері', 'Tillar', 'ენები', 'Sprachen', 'اللغات', 'Idiomas',
    'Keeled', 'Langues', 'भाषाएँ', 'भाषाएं', 'Bahasa', '対応言語', '言語', '언어', 'Тилдер', 'Тилдери', 'Talen', 'Języki',
    'Språk', 'Ngôn ngữ', '语言'],
  'education': ['Təhsil', 'Education', 'Образование', 'Eğitim', 'Білімі', 'Білім', "Ta'lim", 'განათლება', 'Ausbildung', 'التعليم',
    'Formación', 'Haridus', 'Formation', 'शिक्षा', 'Pendidikan', '学歴', '학력', 'Билими', 'Билим', 'Opleiding', 'Wykształcenie',
    'Formação', 'Utbildning', 'Học vấn', 'Đào tạo', '教育背景'],
  'master': ['Magistr', 'Master', "Master's", "Master's degree", 'Магистратура', 'Магистр', 'Yüksek lisans', 'მაგისტრატურა',
    'Masterstudium', 'الماجستير', 'Máster', 'Magistrantuur', 'Magistrikraad', 'स्नातकोत्तर', 'Magister', '修士課程', '석사',
    'Masteropleiding', 'Studia magisterskie', 'Mestrado', 'Magisterexamen', 'Magisterutbildning', 'Thạc sĩ', '硕士'],
  'interests': ['Maraq sahələri', 'Areas of interest', 'Interests', 'Special interests', 'Области интересов', 'Сфера интересов',
    'İlgi alanları', 'Қызығушылық салалары', 'Qiziqish sohalari', 'ინტერესის სფეროები', 'Schwerpunkte', 'Interessengebiete',
    'مجالات الاهتمام', 'Áreas de interés', 'Huvivaldkonnad', 'Domaine d’intérêt', 'Domaines d’intérêt', "Domaines d'intérêt",
    'रुचि के क्षेत्र', 'विशेष रुचि के क्षेत्र', 'विशेष रुचियाँ', 'Bidang minat', '専門分野', '関心分野', '관심 분야', '전문 분야',
    'Кызыккан багыттары', 'Кызыккан тармактары', 'Aandachtsgebieden', 'Obszary zainteresowań', 'Áreas de interesse',
    'Intresseområden', 'Specialområden', 'Lĩnh vực chuyên môn', 'Lĩnh vực quan tâm', '专业领域', '关注领域', '擅长领域'],
  'services': ['Xidmətlər', 'Services', 'Услуги', 'Hizmetler', 'Қызметтер', 'Xizmatlar', 'სერვისები', 'Leistungen', 'الخدمات',
    'Servicios', 'Teenused', 'सेवाएँ', 'सेवाएं', 'Layanan', '診療内容', '서비스', '시술 및 수술', '진료 및 수술', '진료 분야', '진료 서비스',
    'Кызматтар', 'Diensten', 'Usługi', 'Serviços', 'Tjänster', 'Dịch vụ', '服务', '服务项目'],
};

/// `toLocaleLowerCase()` of the JS engine (default locale): Turkish dotted İ becomes `i̇`.
String _lower(String s) => s.replaceAll('İ', 'i̇').toLowerCase();

String _norm(String s) => _lower(composeNfc(s).replaceAll(RegExp('[’`]'), "'").replaceAll(RegExp(r'\s+'), ' ').trim());

final Map<String, ProfileField> _lookup = () {
  final m = <String, ProfileField>{};
  for (final e in _aliases.entries) {
    for (final name in e.value) {
      m.putIfAbsent(_norm(name), () => e.key);
    }
  }
  return m;
}();

ProfileField? profileFieldOf(String label) => _lookup[_norm(label)];

// "Label: value" / "Label：value" / "Label : value". The label is short and has no sentence punctuation or digits
// (so "Dr. X: ..." prose, times like 09:00 and URLs are never read as headers).
final RegExp _header = RegExp(r'^([^:：\n.!?0-9/]{1,40}?)\s*[:：]\s*(\S.*)$', unicode: true);

@immutable
class ProfileEntry {
  const ProfileEntry({required this.label, required this.value, required this.field});
  final String label;
  final String value;
  final ProfileField? field;

  @override
  bool operator ==(Object other) => other is ProfileEntry && other.label == label && other.value == value && other.field == field;
  @override
  int get hashCode => Object.hash(label, value, field);
  @override
  String toString() => 'ProfileEntry($label, $value, $field)';
}

@immutable
class ParsedProfile {
  const ParsedProfile({required this.entries, required this.fields, required this.basicDescription});
  final List<ProfileEntry> entries;
  final Map<ProfileField, String> fields;
  final String basicDescription;
}

/// JS `String.prototype.trim()` whitespace.
String _trim(String s) => s.trim();

ParsedProfile parseProviderProfile(String? text) {
  final source = (text ?? '').replaceAll(RegExp(r'\r\n?'), '\n');
  final lines = source.split('\n');
  final entries = <ProfileEntry>[];
  var i = 0;
  for (; i < lines.length; i++) {
    final line = _trim(lines[i]);
    if (line.isEmpty) {
      if (entries.isNotEmpty) {
        i++;
        break;
      }
      continue;
    }
    final m = _header.firstMatch(line);
    if (m == null || _trim(m[1]!).split(RegExp(r'\s+')).length > 5 || m[2]!.startsWith('//')) break;
    final label = _trim(m[1]!);
    entries.add(ProfileEntry(label: label, value: _trim(m[2]!), field: profileFieldOf(label)));
  }
  if (entries.isEmpty) return ParsedProfile(entries: const [], fields: const {}, basicDescription: _trim(source));
  final fields = <ProfileField, String>{};
  for (final e in entries) {
    if (e.field != null && !fields.containsKey(e.field)) fields[e.field!] = e.value;
  }
  return ParsedProfile(entries: entries, fields: fields, basicDescription: _trim(lines.sublist(i > lines.length ? lines.length : i).join('\n')));
}

/// "a , b、c，d; e" → ["a", "b", "c", "d", "e"].
List<String> splitProfileList(String value) => value.split(RegExp(r'\s*[,、，;；]\s*', unicode: true)).map(_trim).where((s) => s.isNotEmpty).toList();

/// A Google Maps directions link (coordinates when known, else the address); opens the maps app on phones.
String? directionsUrl({String? address, String? city, num? latitude, num? longitude}) {
  final hasCoords = latitude != null && longitude != null && latitude.isFinite && longitude.isFinite && !(latitude == 0 && longitude == 0);
  String n(num v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';
  final destination = hasCoords
      ? '${n(latitude)},${n(longitude)}'
      : [address, city].map((s) => (s ?? '').trim()).where((s) => s.isNotEmpty).join(', ');
  return (address != null && address.isNotEmpty) || hasCoords ? 'https://www.google.com/maps/dir/?api=1&destination=${Uri.encodeComponent(destination)}' : null;
}
