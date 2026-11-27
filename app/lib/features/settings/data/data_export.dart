// Ported from: src/components/SettingsScreen.tsx (handleDataExport), src/components/PrivacyScreen.tsx /
//              PartnerPrivacyScreen.tsx (handleExportData)
//
// The web builds a JSON Blob and clicks a download link. Natively the file is handed to the share sheet.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/data/data.dart';

/// Hands a JSON export to the user.
abstract interface class DataExportSink {
  Future<void> save(String fileName, Object? data);
}

class ShareDataExportSink implements DataExportSink {
  const ShareDataExportSink();
  @override
  Future<void> save(String fileName, Object? data) async {
    final bytes = Uint8List.fromList(utf8.encode(const JsonEncoder.withIndent('  ').convert(data)));
    await SharePlus.instance.share(ShareParams(files: <XFile>[XFile.fromData(bytes, name: fileName, mimeType: 'application/json')], fileNameOverrides: <String>[fileName]));
  }
}

final dataExportSinkProvider = Provider<DataExportSink>((ref) => const ShareDataExportSink());

/// Table reads of the exports (`select('*')` filtered by the user).
abstract interface class ExportSource {
  Future<List<Map<String, dynamic>>> rows(String table, String userId);
  Future<Map<String, dynamic>?> profile(String userId);

  /// `partner_messages` where the user is sender or receiver.
  Future<List<Map<String, dynamic>>> partnerMessages(String userId);
}

class SupabaseExportSource implements ExportSource {
  SupabaseExportSource(this._db);
  final Db _db;
  @override
  Future<List<Map<String, dynamic>>> rows(String table, String userId) async => asRows(await _db.from(table).select().eq('user_id', userId));
  @override
  Future<Map<String, dynamic>?> profile(String userId) async => asRow(await _db.from('profiles').select().eq('user_id', userId).maybeSingle());
  @override
  Future<List<Map<String, dynamic>>> partnerMessages(String userId) async =>
      asRows(await _db.from('partner_messages').select().or('sender_id.eq.$userId,receiver_id.eq.$userId'));
}

final exportSourceProvider = Provider<ExportSource>((ref) => SupabaseExportSource(ref.watch(dbProvider)));
