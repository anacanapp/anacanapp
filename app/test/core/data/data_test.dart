// Ported from: (row access + realtime filter conventions used by src/hooks)

import 'dart:convert';

import 'package:anacan/core/data/data.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  test('Row getters are null-safe and coerce PostgREST shapes', () {
    final Row row = {
      'name': 'Leyla', 'count': '3', 'weight': 61.5, 'premium': true, 'due_date': '2026-03-01',
      'created_at': '2026-11-27T10:00:00.000Z', 'answers': '{"a":[1]}', 'tags': ['x', 1], 'child': {'id': 'c'},
    };
    expect(row.str('name'), 'Leyla');
    expect(row.str('count'), '3');
    expect(row.integer('count'), 3);
    expect(row.integer('weight'), 61);
    expect(row.number('weight'), 61.5);
    expect(row.boolean('premium'), isTrue);
    expect(row.boolean('name'), isNull);
    expect(row.date('due_date'), DateTime.utc(2026, 3, 1));
    expect(row.date('created_at'), DateTime.utc(2026, 11, 27, 10));
    expect(row.json('answers'), {'a': [1]});
    expect(row.strings('tags'), ['x']);
    expect(row.row('child'), {'id': 'c'});
    expect(row.str('missing'), isNull);
    expect(asRows([{'a': 1}, 'x']), [{'a': 1}]);
  });

  test('parsePostgresFilter mirrors supabase-js filter strings', () {
    final eq = parsePostgresFilter('user_id=eq.u1')!;
    expect((eq.column, eq.type, eq.value), ('user_id', PostgresChangeFilterType.eq, 'u1'));
    final inFilter = parsePostgresFilter('id=in.(a,b)')!;
    expect(inFilter.type, PostgresChangeFilterType.inFilter);
    expect(inFilter.value, ['a', 'b']);
    expect(parsePostgresFilter(null), isNull);
    expect(postgresEvent('INSERT'), PostgresChangeEvent.insert);
    expect(postgresEvent('*'), PostgresChangeEvent.all);
  });

  test('Db.query / rpcResult / invoke return {data, error} like supabase-js', () async {
    final client = SupabaseClient('https://backend.test', 'anon',
        httpClient: MockClient((request) async {
          final path = request.url.path;
          http.Response json(Object body, int status) => http.Response.bytes(utf8.encode(jsonEncode(body)), status,
              headers: {'content-type': 'application/json'}, request: request);
          if (path == '/rest/v1/notifications') return json([{'id': 'n1'}], 200);
          if (path == '/rest/v1/rpc/broken') return json({'code': '42501', 'message': 'denied'}, 403);
          if (path == '/functions/v1/email-verification') return json({'error': 'wrong_code'}, 400);
          return json({}, 404);
        }),
        authOptions: const AuthClientOptions(autoRefreshToken: false));
    final db = Db(client);
    final rows = await db.query(() => db.from('notifications').select().eq('user_id', 'u'));
    expect(asRows(rows.data), [{'id': 'n1'}]);
    final rpc = await db.rpcResult('broken');
    expect((rpc.error as PostgrestException).code, '42501');
    final fn = await db.invoke('email-verification', body: {'action': 'confirm'});
    expect(fn.status, 400);
    expect((fn.error as FunctionException).details, {'error': 'wrong_code'});
  });
}
