import test from 'node:test';
import assert from 'node:assert/strict';
import { entryDecision, entryPlatform, entryLanguage, appLaunchLinks, appLaunchDestination, safeAdminNext, legalDocumentType } from './policy.mjs';

for (const host of ['app.anacan.az','gcp.anacan.az','api.anacan.az']) {
  test(`${host} consumer URLs launch the app and arbitrary queries cannot enable web access`, () => {
    for (const path of ['/', '/?blog_module=sleep&blog_language=az', '/blog/en/article/', '/tools?web=true', '/?admin=1', '/?web=admin&web=admin']) {
      assert.equal(entryDecision(`https://${host}${path}`), 'launch');
    }
    assert.equal(entryDecision(`https://${host}/?web=admin`), 'admin');
    assert.equal(entryDecision(`https://${host}/admin/login`), 'admin');
    assert.equal(entryDecision(`https://${host}/?web=admin`, { native:true }), 'native');
  });
  test(`${host} keeps legal/provider/media endpoints usable`, () => {
    for (const path of ['/legal/terms_of_service','/legal/privacy_policy','/terms-and-conditions','/az/istifade-sertleri/','/site/ja/利用規約/']) assert.equal(entryDecision(`https://${host}${path}`),'legal');
    for (const path of ['/storage/v1/object/public/images/a.webp','/rest/v1/blog_posts','/.well-known/anacan-backend.json','/sitemap-blog.xml']) assert.equal(entryDecision(`https://${host}${path}`),'resource');
    assert.equal(entryDecision(`https://${host}/auth/v1/token`),'system');
    assert.equal(entryDecision(`https://${host}/reset-password`),'system');
    assert.equal(entryDecision(`https://${host}/brands`),'brand');
  });
}
test('recognizes iPad desktop mode and selects the verified store destinations', () => {
  assert.equal(entryPlatform({ userAgent:'Mozilla/5.0 (Macintosh)', platform:'MacIntel', maxTouchPoints:5 }),'ios');
  assert.equal(entryPlatform({ userAgent:'Android 15' }),'android');
  const links = appLaunchLinks('https://gcp.anacan.az/?blog_module=sleep&blog_language=az');
  assert.equal(links.scheme,'anacan:///?language=az&blog_module=sleep&blog_language=az');
  assert.ok(links.androidIntent.includes('package=com.atlasoon.anacan;'));
  assert.equal(links.appStore,'https://apps.apple.com/app/id6758301924');
  assert.ok(links.androidIntent.includes(encodeURIComponent(links.googlePlay)));
});
test('keeps the requested legal and preview language after the site prefix', () => {
  for (const language of ['az','en','tr','ru','de','ar','ka','kk','uz','zh','id','fr','es','pt','vi','hi','ja','ko','pl','nl','sv']) {
    assert.equal(entryLanguage(`https://gcp.anacan.az/site/${language}/privacy-policy/`), language);
    assert.equal(entryLanguage(`https://api.anacan.az/site/${language}/terms-of-use/`), language);
  }
  assert.equal(entryLanguage('https://gcp.anacan.az/site/ar/privacy-policy/?language=ja'), 'ja');
});
test('preserves intended module/article identity without copying arbitrary queries or credentials', () => {
  assert.deepEqual(appLaunchDestination('https://api.anacan.az/blog/ar/real-article/?web=admin&access_token=private'),{path:'/blog/real-article',language:'ar'});
  assert.equal(appLaunchDestination('https://app.anacan.az/?blog_module=hospitalBag').path,'/tool/hospital');
  assert.equal(appLaunchDestination('https://evil.invalid/?blog_module=sleep').path,'/');
  assert.equal(appLaunchDestination('https://app.anacan.az/blog/%2Fadmin').path,'/');
  assert.ok(!appLaunchLinks('https://api.anacan.az/?next=https://evil.invalid&access_token=private').scheme.includes('private'));
});
test('admin return targets are same-origin and re-enter through the server-verified gate', () => {
  for (const target of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/admin/login','/?code=private']) assert.equal(safeAdminNext(target,'https://app.anacan.az'),'/admin?web=admin');
  assert.equal(safeAdminNext('/?blog_module=sleep','https://app.anacan.az'),'/?blog_module=sleep&web=admin');
  assert.equal(legalDocumentType('/ru/политика-конфиденциальности/'),'privacy_policy');
});
