// node --test app/tool/ios/check_pbxproj.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkProject, parsePbxproj } from './check_pbxproj.mjs';

const iosDir = join(dirname(fileURLToPath(import.meta.url)), '../../ios');
const original = readFileSync(join(iosDir, 'Runner.xcodeproj/project.pbxproj'), 'utf8');
const problemsOf = (text) => checkProject(parsePbxproj(text), iosDir);
const replaceOnce = (text, from, to) => {
  assert.ok(text.includes(from), `fixture lacks ${from}`);
  return text.replace(from, to);
};

test('committed project passes', () => {
  assert.deepEqual(problemsOf(original), []);
});

test('unbalanced braces are a parse error', () => {
  const broken = replaceOnce(original, 'remoteInfo = AnacanNotificationService;\n\t\t};', 'remoteInfo = AnacanNotificationService;\n');
  assert.throws(() => parsePbxproj(broken));
});

test('missing terminator is a parse error', () => {
  assert.throws(() => parsePbxproj(replaceOnce(original, 'dstSubfolderSpec = 13;', 'dstSubfolderSpec = 13')));
});

test('duplicate keys are a parse error', () => {
  assert.throws(() => parsePbxproj(replaceOnce(original, 'dstSubfolderSpec = 13;', 'dstSubfolderSpec = 13; dstSubfolderSpec = 13;')));
});

test('a referenced but undefined object is reported', () => {
  const text = original.replace(/\t\tC89021A12FCDA008FC05B64E \/\* PBXContainerItemProxy \*\/ = \{[\s\S]*?\n\t\t\};\n/, '');
  assert.notEqual(text, original);
  assert.ok(problemsOf(text).some((p) => p.includes('undefined object C89021A12FCDA008FC05B64E')));
});

test('embed phase after Thin Binary is reported', () => {
  const text = replaceOnce(original,
    '\t\t\t\tF5A96B132597AAC23A49986B /* Embed Foundation Extensions */,\n\t\t\t\t3B06AD1E1E4923F5004D2608 /* Thin Binary */,',
    '\t\t\t\t3B06AD1E1E4923F5004D2608 /* Thin Binary */,\n\t\t\t\tF5A96B132597AAC23A49986B /* Embed Foundation Extensions */,');
  assert.ok(problemsOf(text).some((p) => p.includes('before "Thin Binary"')));
});

test('a missing extension target is reported', () => {
  const text = replaceOnce(original, '\t\t\t\tD161F015DAFE58A04D7CAD09 /* AnacanNotificationService */,\n\t\t\t);\n\t\t};', '\t\t\t);\n\t\t};');
  assert.ok(problemsOf(text).includes('target AnacanNotificationService missing'));
});

test('a wrong bundle id is reported', () => {
  const text = replaceOnce(original, 'PRODUCT_BUNDLE_IDENTIFIER = com.atlasoon.anacan.AnacanTimerWidgetExt;', 'PRODUCT_BUNDLE_IDENTIFIER = com.atlasoon.anacan.Widget;');
  assert.ok(problemsOf(text).some((p) => p.startsWith('AnacanTimerWidgetExtExtension/Debug: PRODUCT_BUNDLE_IDENTIFIER')));
});

test('a Runner Swift file outside the Sources phase is reported', () => {
  const text = replaceOnce(original, '\t\t\t\t74858FAF1ED2DC5600515810 /* AppDelegate.swift in Sources */,\n', '');
  assert.ok(problemsOf(text).some((p) => p.includes('Runner/AppDelegate.swift not in Sources')));
});
