#!/usr/bin/env node
// Read-only structural check of app/ios/Runner.xcodeproj/project.pbxproj (no Xcode needed):
//   - parses the whole old-style plist (balanced braces/parens, terminated entries, no duplicate keys or object ids),
//   - every 24-hex object id referenced anywhere is defined in `objects`, and every object has a known `isa`,
//   - the extension targets of docs/flutter/IOS_EXTENSIONS.md exist with their bundle ids, three configurations,
//     sources, the Runner dependency and the "Embed Foundation Extensions" phase before "Thin Binary",
//   - every file reference under a `<group>` path exists on disk and every .swift file under app/ios/Runner/ is in
//     Runner's Sources phase.
//   node app/tool/ios/check_pbxproj.mjs [path/to/project.pbxproj]      exit 1 with the problems listed
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const pbxPath = process.argv[2] ?? join(root, 'app/ios/Runner.xcodeproj/project.pbxproj');
const iosDir = dirname(dirname(pbxPath));

export function parsePbxproj(text) {
  let i = 0;
  const fail = (msg) => {
    const line = text.slice(0, i).split('\n').length;
    throw new Error(`${msg} (line ${line})`);
  };
  const skip = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text.startsWith('/*', i)) {
        const end = text.indexOf('*/', i + 2);
        if (end < 0) fail('unterminated comment');
        i = end + 2;
      } else if (text.startsWith('//', i)) {
        const end = text.indexOf('\n', i);
        i = end < 0 ? text.length : end + 1;
      } else return;
    }
  };
  const value = () => {
    skip();
    const c = text[i];
    if (c === '{') {
      i++;
      const dict = {};
      for (;;) {
        skip();
        if (text[i] === '}') { i++; return dict; }
        const key = scalar();
        skip();
        if (text[i] !== '=') fail(`expected '=' after ${key}`);
        i++;
        const v = value();
        skip();
        if (text[i] !== ';') fail(`expected ';' after value of ${key}`);
        i++;
        if (Object.prototype.hasOwnProperty.call(dict, key)) fail(`duplicate key ${key}`);
        dict[key] = v;
      }
    }
    if (c === '(') {
      i++;
      const arr = [];
      for (;;) {
        skip();
        if (text[i] === ')') { i++; return arr; }
        arr.push(value());
        skip();
        if (text[i] === ',') i++;
        else if (text[i] !== ')') fail("expected ',' or ')' in array");
      }
    }
    return scalar();
  };
  const scalar = () => {
    skip();
    if (text[i] === '"') {
      let out = '';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') { out += text[i + 1]; i += 2; } else out += text[i++];
      }
      if (text[i] !== '"') fail('unterminated string');
      i++;
      return out;
    }
    const m = /^[A-Za-z0-9_$\/:.\-+<>@]+/.exec(text.slice(i, i + 4096));
    if (!m) fail(`unexpected character ${JSON.stringify(text[i])}`);
    i += m[0].length;
    return m[0];
  };
  if (!text.startsWith('// !$*UTF8*$!')) fail('missing UTF8 header');
  const doc = value();
  skip();
  if (i !== text.length) fail('trailing content after root dictionary');
  return doc;
}

const KNOWN_ISA = new Set([
  'PBXBuildFile', 'PBXContainerItemProxy', 'PBXCopyFilesBuildPhase', 'PBXFileReference', 'PBXFrameworksBuildPhase',
  'PBXGroup', 'PBXNativeTarget', 'PBXProject', 'PBXResourcesBuildPhase', 'PBXShellScriptBuildPhase',
  'PBXSourcesBuildPhase', 'PBXTargetDependency', 'PBXVariantGroup', 'XCBuildConfiguration', 'XCConfigurationList',
  'XCLocalSwiftPackageReference', 'XCRemoteSwiftPackageReference', 'XCSwiftPackageProductDependency',
]);
const ID = /^[0-9A-F]{24}$/;

export function checkProject(doc, iosRoot) {
  const problems = [];
  const objects = doc.objects ?? {};
  const get = (id) => objects[id];
  for (const [id, obj] of Object.entries(objects)) {
    if (!ID.test(id)) problems.push(`object id is not 24 hex chars: ${id}`);
    if (!KNOWN_ISA.has(obj.isa)) problems.push(`${id}: unknown isa ${obj.isa}`);
  }
  // Every id-shaped string anywhere (except remoteGlobalIDString/containerPortal checked below) must be defined.
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (ID.test(v) && !objects[v]) problems.push(`${path}: undefined object ${v}`);
    } else if (Array.isArray(v)) v.forEach((x, n) => walk(x, `${path}[${n}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  for (const [id, obj] of Object.entries(objects)) walk(obj, id);
  walk(doc.rootObject, 'rootObject');
  const project = get(doc.rootObject);
  if (project?.isa !== 'PBXProject') return [...problems, 'rootObject is not a PBXProject'];

  // Each object referenced at most once from a group/phase list (Xcode rejects shared children).
  const owners = new Map();
  for (const [id, obj] of Object.entries(objects)) {
    for (const key of ['children', 'files']) {
      for (const child of obj[key] ?? []) {
        if (owners.has(child)) problems.push(`${child} listed in both ${owners.get(child)} and ${id}`);
        owners.set(child, id);
      }
    }
  }

  // Paths of file references in the group tree.
  const paths = new Map();
  const visit = (groupId, base) => {
    const g = get(groupId);
    const dir = g.sourceTree === '<group>' && g.path ? join(base, g.path) : base;
    for (const childId of g.children ?? []) {
      const c = get(childId);
      if (!c) continue;
      if (c.isa === 'PBXGroup' || c.isa === 'PBXVariantGroup') visit(childId, dir);
      else if (c.isa === 'PBXFileReference' && c.sourceTree === '<group>') paths.set(childId, join(dir, c.path));
    }
  };
  visit(project.mainGroup, iosRoot);
  const ephemeral = join(iosRoot, 'Flutter');
  for (const [id, p] of paths) {
    // Flutter-generated files (Generated.xcconfig, ephemeral packages) only exist after `flutter pub get`.
    if (p.startsWith(join(ephemeral, 'ephemeral')) || p.endsWith('Generated.xcconfig')) continue;
    if (!existsSync(p)) problems.push(`${id}: file missing on disk: ${relative(iosRoot, p)}`);
  }

  const targets = project.targets.map((id) => ({ id, ...get(id) }));
  const byName = (n) => targets.find((t) => t.name === n);
  const phase = (t, isa) => t.buildPhases.map(get).find((p) => p.isa === isa);
  const phaseFiles = (p) => (p?.files ?? []).map((bf) => get(bf)?.fileRef).filter(Boolean);
  const runner = byName('Runner');
  if (!runner) return [...problems, 'Runner target missing'];
  const configNames = get(project.buildConfigurationList).buildConfigurations.map((c) => get(c).name).sort();

  const exts = [
    { name: 'AnacanTimerWidgetExtExtension', bundle: 'com.atlasoon.anacan.AnacanTimerWidgetExt',
      sources: ['AnacanTimerWidgetExt/AnacanTimerWidgetBundle.swift', 'AnacanTimerWidgetExt/AnacanHomeWidgets.swift',
        'AnacanTimerWidgetExt/AnacanTimerWidgetLiveActivity.swift', 'AnacanTimerWidgetExt/AnacanTimerStopIntent.swift',
        'Runner/AnacanTimerAttributes.swift'],
      entitlements: 'AnacanTimerWidgetExt/AnacanTimerWidgetExtExtension.entitlements' },
    { name: 'AnacanNotificationService', bundle: 'com.atlasoon.anacan.AnacanNotificationService',
      sources: ['AnacanNotificationService/NotificationService.swift'] },
  ];
  const embed = runner.buildPhases.map((id) => ({ id, ...get(id) }))
    .find((p) => p.isa === 'PBXCopyFilesBuildPhase' && String(p.dstSubfolderSpec) === '13');
  if (!embed) problems.push('Runner: no "Embed Foundation Extensions" (dstSubfolderSpec 13) phase');
  const thinIndex = runner.buildPhases.findIndex((id) => get(id).name === 'Thin Binary');
  if (embed && thinIndex >= 0 && runner.buildPhases.indexOf(embed.id) > thinIndex) {
    problems.push('Runner: "Embed Foundation Extensions" must come before "Thin Binary"');
  }
  const rel = (fileRefId) => (paths.has(fileRefId) ? relative(iosRoot, paths.get(fileRefId)).replace(/\\/g, '/') : null);
  for (const e of exts) {
    const t = byName(e.name);
    if (!t) { problems.push(`target ${e.name} missing`); continue; }
    if (t.productType !== 'com.apple.product-type.app-extension') problems.push(`${e.name}: not an app extension`);
    const cfgs = get(t.buildConfigurationList).buildConfigurations.map(get);
    if (cfgs.map((c) => c.name).sort().join() !== configNames.join()) problems.push(`${e.name}: configurations ≠ project's`);
    for (const c of cfgs) {
      const s = c.buildSettings;
      const want = { PRODUCT_BUNDLE_IDENTIFIER: e.bundle, DEVELOPMENT_TEAM: '8B6976J8H7', IPHONEOS_DEPLOYMENT_TARGET: '16.6',
        SWIFT_VERSION: '5.0', MARKETING_VERSION: '$(FLUTTER_BUILD_NAME)', CURRENT_PROJECT_VERSION: '$(FLUTTER_BUILD_NUMBER)',
        INFOPLIST_FILE: `${e.sources[0].split('/')[0]}/Info.plist`, SKIP_INSTALL: 'YES' };
      if (e.entitlements) want.CODE_SIGN_ENTITLEMENTS = e.entitlements;
      for (const [k, v] of Object.entries(want)) if (s[k] !== v) problems.push(`${e.name}/${c.name}: ${k} = ${s[k]} (want ${v})`);
      if (!existsSync(join(iosRoot, s.INFOPLIST_FILE ?? ''))) problems.push(`${e.name}/${c.name}: Info.plist missing on disk`);
      if (s.CODE_SIGN_ENTITLEMENTS && !existsSync(join(iosRoot, s.CODE_SIGN_ENTITLEMENTS))) problems.push(`${e.name}/${c.name}: entitlements missing on disk`);
      if (rel(c.baseConfigurationReference) !== 'Flutter/Generated.xcconfig') problems.push(`${e.name}/${c.name}: base configuration is not Flutter/Generated.xcconfig`);
    }
    const srcs = phaseFiles(phase(t, 'PBXSourcesBuildPhase')).map(rel);
    for (const s of e.sources) if (!srcs.includes(s)) problems.push(`${e.name}: ${s} not in Sources`);
    const dep = runner.dependencies.map(get).find((d) => d.target === t.id);
    if (!dep) problems.push(`Runner: no dependency on ${e.name}`);
    else {
      const proxy = get(dep.targetProxy);
      if (proxy?.remoteGlobalIDString !== t.id || proxy?.containerPortal !== doc.rootObject) problems.push(`Runner → ${e.name}: bad container proxy`);
    }
    if (embed && !phaseFiles(embed).includes(t.productReference)) problems.push(`Runner: ${e.name} product not embedded`);
  }
  const widget = byName('AnacanTimerWidgetExtExtension');
  if (widget) {
    const res = phase(widget, 'PBXResourcesBuildPhase');
    const resRefs = phaseFiles(res).map(get);
    if (!resRefs.some((r) => r.path === 'Assets.xcassets')) problems.push('widget: Assets.xcassets not in Resources');
    const loc = resRefs.find((r) => r.isa === 'PBXVariantGroup' && r.name === 'Localizable.strings');
    const widgetDir = join(iosRoot, 'AnacanTimerWidgetExt');
    const langs = readdirSync(widgetDir).filter((d) => d.endsWith('.lproj')).map((d) => d.replace(/\.lproj$/, '')).sort();
    const have = (loc?.children ?? []).map((c) => get(c).name).sort();
    if (have.join() !== langs.join()) problems.push(`widget: Localizable.strings variants ${have.length} ≠ ${langs.length} .lproj folders`);
    const known = new Set(project.knownRegions);
    for (const l of langs) if (!known.has(l)) problems.push(`knownRegions lacks ${l}`);
  }
  // Every Swift file under Runner/ compiles into Runner; the stop intent too (Capacitor had it in both targets).
  const runnerSrcs = new Set(phaseFiles(phase(runner, 'PBXSourcesBuildPhase')).map(rel));
  const swiftFiles = [];
  const scan = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) scan(p);
      else if (n.endsWith('.swift')) swiftFiles.push(relative(iosRoot, p).replace(/\\/g, '/'));
    }
  };
  scan(join(iosRoot, 'Runner'));
  for (const f of [...swiftFiles, 'AnacanTimerWidgetExt/AnacanTimerStopIntent.swift']) {
    if (!runnerSrcs.has(f)) problems.push(`Runner: ${f} not in Sources (run: ruby app/tool/ios/add_extensions.rb)`);
  }
  return problems;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  let problems;
  try {
    problems = checkProject(parsePbxproj(readFileSync(pbxPath, 'utf8')), iosDir);
  } catch (e) {
    problems = [`parse error: ${e.message}`];
  }
  if (problems.length) {
    console.error(`${relative(root, pbxPath)}: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`${relative(root, pbxPath)}: OK (structure, ids, extension targets, Runner sources)`);
}
