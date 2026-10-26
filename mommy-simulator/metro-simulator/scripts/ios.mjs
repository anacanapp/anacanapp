import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const engine = process.env.GODOT_BIN || fileURLToPath(new URL('../../artifacts/engine/Godot.app/Contents/MacOS/Godot', import.meta.url));
const output = join(root, 'artifacts/ios-v2');
await mkdir(output, { recursive: true });
const checked = spawnSync(engine, ['--headless', '--path', root, '--check-only', '--script', 'res://tests/device_acceptance.gd'], { cwd: root, encoding: 'utf8', timeout: 60000 });
const checkLog = (checked.stdout || '') + (checked.stderr || '');
if (checked.status !== 0 || /SCRIPT ERROR|^ERROR:/m.test(checkLog)) { process.stdout.write(checkLog); throw new Error('METRO native acceptance script does not compile'); }
const args = ['--headless', '--path', root, '--export-debug', 'iOS', join(output, 'MetroSimulator.zip')];
const exported = spawnSync(engine, args, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
const log = (exported.stdout || '') + (exported.stderr || '');
await writeFile(join(output, 'export.log'), log);
if (exported.status !== 0 || /SCRIPT ERROR|^ERROR:/m.test(log)) { process.stdout.write(log); throw new Error('METRO iOS export failed'); }
const appFolder = join(output, 'MetroSimulator');
const infoPath = join(appFolder, 'MetroSimulator-Info.plist');
let plist = await readFile(infoPath, 'utf8');
plist = plist.replace(/\t<key>NS(?:Microphone|Camera|PhotoLibrary)UsageDescription<\/key>\s*<string><\/string>\n/g, '');
plist = plist.replace(/(<key>UISupportedInterfaceOrientations(?:~ipad)?<\/key>\s*<array>)[^]*?(<\/array>)/g,
  '$1\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t$2');
await writeFile(infoPath, plist);

// Opaque full-resolution App Store icon, generated from the game's original mark.
const icon = await sharp(join(root, 'assets/icons/metro.svg')).resize(1024, 1024).flatten({ background: '#f4b76b' }).png().toBuffer();
const iconDirectory = join(appFolder, 'Images.xcassets/AppIcon.appiconset');
await mkdir(iconDirectory, { recursive: true });
for (const name of await readdir(iconDirectory)) {
  if (name.startsWith('Icon-') && name.endsWith('.png')) await rm(join(iconDirectory, name));
}
await writeFile(join(iconDirectory, 'MetroIcon.png'), icon);
await writeFile(join(iconDirectory, 'Contents.json'), JSON.stringify({ images: [{ filename: 'MetroIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384"><rect width="384" height="384" fill="#091215"/><rect x="116" y="70" width="152" height="152" rx="34" fill="#f4b76b"/><path d="M145 185v-71h22l25 32 25-32h22v71h-22v-38l-25 26-25-26v38z" fill="#102a38"/><path d="M143 204h98" stroke="#102a38" stroke-width="5"/><text x="192" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="35" font-weight="bold" fill="#f4eee0">METRO</text><text x="192" y="307" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" letter-spacing="4" fill="#f4b76b">SIMULATOR</text></svg>`;
const splash = await sharp(Buffer.from(splashSvg)).png().toBuffer();
const splashDir = join(appFolder, 'Images.xcassets/SplashImage.imageset');
await writeFile(join(splashDir, 'splash@2x.png'), splash);
await writeFile(join(splashDir, 'splash@3x.png'), splash);

const pbxPath = join(output, 'MetroSimulator.xcodeproj/project.pbxproj');
let pbx = await readFile(pbxPath, 'utf8');
const nativeSource = 'MetroNative.mm';
if (!pbx.includes(nativeSource)) {
  pbx = pbx.replace('/* Begin PBXBuildFile section */', '/* Begin PBXBuildFile section */\n\t\tA07B66CABE00000000000001 /* MetroNative.mm in Sources */ = {isa = PBXBuildFile; fileRef = A07B66CABE00000000000002; };');
  pbx = pbx.replace('/* Begin PBXFileReference section */', '/* Begin PBXFileReference section */\n\t\tA07B66CABE00000000000002 /* MetroNative.mm */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.cpp.objcpp; path = "MetroSimulator/MetroNative.mm"; sourceTree = SOURCE_ROOT; };');
  pbx = pbx.replace(/(isa = PBXSourcesBuildPhase;[^]*?files = \(\s*)/, '$1A07B66CABE00000000000001 /* MetroNative.mm in Sources */,\n');
}
await writeFile(pbxPath, pbx);
const header = join(appFolder, 'dummy.h');
await writeFile(header, (await readFile(header, 'utf8')).replace('#pragma once', '#ifndef METRO_DUMMY_H\n#define METRO_DUMMY_H') + '\n#endif\n');
await writeFile(join(appFolder, nativeSource), `#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <CoreHaptics/CoreHaptics.h>

static CHHapticEngine *metroHaptics;
static UIImpactFeedbackGenerator *metroFeedback;
static CFTimeInterval metroLastHaptic = 0;
static CFTimeInterval metroSettingCheck = 0;
static BOOL metroHapticsEnabled = YES;

static void MetroTapHaptic(void) {
    if (CACurrentMediaTime() - metroSettingCheck > 1.0) {
        metroSettingCheck = CACurrentMediaTime();
        NSURL *documents = [NSFileManager.defaultManager URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask].firstObject;
        NSData *data = [NSData dataWithContentsOfURL:[documents URLByAppendingPathComponent:@"metro-progress-v1.json"]];
        if (data.length > 0 && data.length < 1048576) {
            NSDictionary *envelope = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            NSString *payload = [envelope isKindOfClass:NSDictionary.class] ? envelope[@"payload"] : nil;
            if ([payload isKindOfClass:NSString.class]) {
                NSDictionary *profile = [NSJSONSerialization JSONObjectWithData:[payload dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
                if ([profile isKindOfClass:NSDictionary.class] && [profile[@"settings"] isKindOfClass:NSDictionary.class]) metroHapticsEnabled = [profile[@"settings"][@"haptics"] boolValue];
            }
        }
    }
    if (!metroHapticsEnabled) return;
    if (CACurrentMediaTime() - metroLastHaptic < 0.065) return;
    metroLastHaptic = CACurrentMediaTime();
    [metroFeedback impactOccurredWithIntensity:0.38];
    [metroFeedback prepare];
}

@interface MetroTouchRecognizer : UIGestureRecognizer
@end
@implementation MetroTouchRecognizer
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    for (UITouch *touch in touches) {
        CGPoint p = [touch locationInView:self.view];
        CGSize size = self.view.bounds.size;
        if (p.y > size.height * 0.64 && p.x > size.width * 0.30 && p.x < size.width * 0.70) MetroTapHaptic();
    }
    self.state = UIGestureRecognizerStateFailed;
}
@end

@interface MetroNative : NSObject
@end
@implementation MetroNative
+ (void)load {
    [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidBecomeActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *notification) {
        UIApplication.sharedApplication.idleTimerDisabled = YES;
        if (@available(iOS 13.0, *)) {
            if (metroHaptics == nil && CHHapticEngine.capabilitiesForHardware.supportsHaptics) {
                NSError *error = nil;
                metroHaptics = [[CHHapticEngine alloc] initAndReturnError:&error];
                [metroHaptics startAndReturnError:&error];
                metroFeedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
                [metroFeedback prepare];
            }
        }
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (![scene isKindOfClass:UIWindowScene.class]) continue;
            for (UIWindow *window in ((UIWindowScene *)scene).windows) {
                UIView *view = window.rootViewController.view;
                BOOL installed = NO;
                for (UIGestureRecognizer *recognizer in view.gestureRecognizers) if ([recognizer isKindOfClass:MetroTouchRecognizer.class]) installed = YES;
                if (!installed) {
                    MetroTouchRecognizer *recognizer = [[MetroTouchRecognizer alloc] init];
                    recognizer.cancelsTouchesInView = NO;
                    recognizer.delaysTouchesBegan = NO;
                    recognizer.delaysTouchesEnded = NO;
                    [view addGestureRecognizer:recognizer];
                }
            }
        }
    }];
}
@end
`);
const project = join(output, 'MetroSimulator.xcodeproj');
const listed = execFileSync('xcodebuild', ['-list', '-json', '-project', project], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
const projects = JSON.parse(listed);
if (!projects.project.schemes.includes('MetroSimulator')) throw new Error('METRO iOS scheme missing');
console.log('METRO native iOS project ready: metro-simulator/artifacts/ios-v2/MetroSimulator.xcodeproj');
