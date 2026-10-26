import { mkdir, readFile, writeFile, stat, open, unlink } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const engine = join(root, 'artifacts/engine/Godot.app/Contents/MacOS/Godot');
const mode = process.argv[2] ?? 'ios';
const version = (await readFile(join(root, 'godot/project.godot'), 'utf8')).match(/config\/version="([\d.]+)"/)[1];
const build = (await readFile(join(root, 'godot/export_presets.cfg'), 'utf8')).match(/application\/version="(\d+)"/)[1];
const directory = join(root, mode === 'web' ? 'artifacts/native-world-web' : `artifacts/native-world-ios-build${build}-source`);
await mkdir(directory, { recursive: true });
const args = ['--headless', '--path', join(root, 'godot'), '--export-debug', mode === 'web' ? 'Web Preview' : 'iOS', join(directory, mode === 'web' ? 'index.html' : 'Mommy3D.zip')];
if (mode === 'web') args.splice(1, 0, '--rendering-method', 'gl_compatibility');
const lockPath = join(root, 'artifacts/engine/export.lock');
const lock = await open(lockPath, 'wx');
let result;
try {
  result = spawnSync(engine, args, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024 });
} finally { await lock.close(); await unlink(lockPath); }
await writeFile(join(directory, 'export.log'), (result.stdout ?? '') + (result.stderr ?? ''));
if (result.status !== 0) throw new Error(`Native world export failed: ${result.stderr ?? result.error}`);
if (mode === 'web') { console.log('Native world browser preview exported.'); process.exit(0); }
const project = join(directory, 'Mommy3D.xcodeproj');
try { await stat(project); } catch { execFileSync('ditto', ['-x', '-k', join(directory, 'Mommy3D.zip'), directory], { stdio: 'pipe' }); }
const pbx = join(project, 'project.pbxproj');
let source = await readFile(pbx, 'utf8');
const id = 'A04B66CABE00000000000004';
if (!source.includes('SaveContinuity.mm')) {
  source = source.replace('/* Begin PBXBuildFile section */', `/* Begin PBXBuildFile section */\n\t\t${id} /* SaveContinuity.mm in Sources */ = {isa = PBXBuildFile; fileRef = A04B66CABE00000000000005; };`);
  source = source.replace('/* Begin PBXFileReference section */', '/* Begin PBXFileReference section */\n\t\tA04B66CABE00000000000005 /* SaveContinuity.mm */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.objcpp; path = "Mommy3D/SaveContinuity.mm"; sourceTree = SOURCE_ROOT; };');
  source = source.replace(/(children = \(\s*)([^]*?Mommy3D-Info\.plist)/, '$1A04B66CABE00000000000005 /* SaveContinuity.mm */,\n$2');
  source = source.replace(/(isa = PBXSourcesBuildPhase;[^]*?files = \(\s*)/, `$1${id} /* SaveContinuity.mm in Sources */,\n`);
  await writeFile(pbx, source);
}
const folder = join(directory, 'Mommy3D'); await mkdir(folder, { recursive: true });
const infoPath = join(folder, 'Mommy3D-Info.plist');
let info = await readFile(infoPath, 'utf8');
info = info.replace(/\t<key>ITSAppUsesNonExemptEncryption<\/key><false\/>\n/g, '');
info = info.replace(/\t<key>NS(?:Microphone|Camera|PhotoLibrary)UsageDescription<\/key>\s*<string><\/string>\n/g, '');
info = info.replace(/(<key>UISupportedInterfaceOrientations(?:~ipad)?<\/key>\s*<array>)[^]*?(<\/array>)/g,
  '$1\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t$2');
await writeFile(infoPath, info);
await writeFile(join(folder, 'SaveContinuity.mm'), `#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// Transfer only this game's own Capacitor Preferences on a native engine upgrade.
// Original Preferences and the previous backup remain intact.
@interface MommySaveContinuity : NSObject
@end
@implementation MommySaveContinuity
+ (void)load {
    @autoreleasepool {
        [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidBecomeActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *notification) {
            UIApplication.sharedApplication.idleTimerDisabled = YES;
        }];
        NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
        NSString *key = @"CapacitorStorage.mommy-simulator-save-v1";
        NSString *saved = [defaults stringForKey:key];
        if ([defaults boolForKey:@"mommy-ui-test-isolation-v1"]) {
            saved = [defaults stringForKey:@"mommy-ui-test-user-save"];
        }
        if (!saved) return;
        id object = [NSJSONSerialization JSONObjectWithData:[saved dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        if (![object isKindOfClass:NSDictionary.class] || ![@[@2, @3] containsObject:object[@"schema"]]) return;
        NSURL *directory = [[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask].firstObject;
        NSURL *destination = [directory URLByAppendingPathComponent:@"capacitor-save-v3.json"];
        if ([[NSFileManager defaultManager] fileExistsAtPath:destination.path]) return;
        [saved writeToURL:destination atomically:YES encoding:NSUTF8StringEncoding error:nil];
    }
}
@end
`);
await writeFile(join(directory, 'candidate.json'), JSON.stringify({ version, build, source: `artifacts/native-world-ios-build${build}-source`, app: `artifacts/native-world-ios-build${build}/Build/Products/Debug-iphoneos/Mommy3D.app` }, null, 2) + '\n');
console.log(`Native Metal iOS ${version}/build${build}: artifacts/native-world-ios-build${build}-source/Mommy3D.xcodeproj`);
