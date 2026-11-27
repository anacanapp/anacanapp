// Ported from: src/lib/epdsScoring.test.ts
import 'package:anacan/features/tools/mental_health/epds_scoring.dart';
import 'package:flutter_test/flutter_test.dart';

Map<Object, Object?> answers(List<int> values) => {for (var i = 0; i < values.length; i++) '${i + 1}': values[i]};

void main() {
  group('scoreEPDS', () {
    test('total 9 with Q10 = 3 is high risk with the self-harm flag (was "normal")', () {
      final r = scoreEpds(answers([1, 1, 1, 1, 1, 1, 0, 0, 0, 3]));
      expect(r.totalScore, 9);
      expect(r.selfHarm, isTrue);
      expect(r.riskLevel, 'high');
    });

    test('any Q10 answer above 0 sets the flag, even with an otherwise zero total', () {
      final r = scoreEpds(answers([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]));
      expect(r.totalScore, 1);
      expect(r.selfHarm, isTrue);
      expect(r.riskLevel, 'high');
    });

    test('keeps the existing bands when Q10 is 0', () {
      expect(scoreEpds(answers([1, 1, 1, 1, 1, 1, 1, 1, 0, 0])), const EpdsScore(totalScore: 8, riskLevel: 'low', selfHarm: false));
      expect(scoreEpds(answers([2, 2, 2, 2, 2, 0, 0, 0, 0, 0])), const EpdsScore(totalScore: 10, riskLevel: 'moderate', selfHarm: false));
      expect(scoreEpds(answers([2, 2, 2, 2, 2, 3, 0, 0, 0, 0])), const EpdsScore(totalScore: 13, riskLevel: 'high', selfHarm: false));
    });

    test('accepts numeric keys and tolerates missing / bad input', () {
      expect(hasEpdsSelfHarm({10: 2}), isTrue);
      expect(epdsSelfHarmScore(null), 0);
      expect(scoreEpds(null), const EpdsScore(totalScore: 0, riskLevel: 'low', selfHarm: false));
      expect(hasEpdsSelfHarm({'10': 0}), isFalse);
    });
  });
}
