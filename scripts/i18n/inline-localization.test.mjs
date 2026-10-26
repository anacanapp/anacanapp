import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { analyzeInlineCopy, transformInlineCopy } from './inline-localization.mjs';

const require = createRequire(import.meta.url);
const file = 'src/components/Example.tsx';
function render(source, translations = {}, transformed = true, locale = 'az-AZ') {
  const result = transformed ? transformInlineCopy(source, file) : null;
  const code = ts.transpileModule(result?.code || source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const translated = (_key, fallback) => translations[fallback] ?? fallback;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => id === '@/lib/tr' ? {
    tr: translated,
    formatTr: (key, fallback, values) => translated(key, fallback).replace(/\{(inline_\d+)\}/g, (token, name) => String(values[name])),
  } : id === '@/lib/i18n' ? { getLocaleTag: () => locale } : require(id) });
  return renderToStaticMarkup(exports.default());
}

test('preserves React whitespace, entities, nested tags and literal attributes', () => {
  const sources = [
    'export default () => <p> Before <b>strong &amp; safe</b> after&nbsp;next &#x1F476; </p>;',
    'export default () => <p>\n  First line\n  second line\n  <b>Next</b>\n  Last line\n</p>;',
    'export default () => <input placeholder="Name &amp; surname" aria-label="Your name" title="Line one\nline two" />;',
    'export default () => <p>{true ? "Yes" : "No"} {false || "Empty"} {1 && "Record"}</p>;',
  ];
  for (const source of sources) assert.equal(render(source), render(source, {}, false));
});

test('translates static labels without changing user text, values, links or event data', () => {
  const source = `const userText = 'Continue'; export default () => <div data-code="Continue" className={true ? 'Continue' : 'Other'}>
    <button title="Continue" onClick={() => ({ status: 'Continue' })}>Continue</button>
    <input value="Continue" readOnly name="Continue" placeholder="Continue" />
    <a href="https://anacan.az/Continue">Anacan</a><p>{userText}</p></div>;`;
  const html = render(source, { Continue: 'Continuer' });
  assert.match(html, /title="Continuer"/); assert.match(html, />Continuer<\/button>/);
  assert.match(html, /placeholder="Continuer"/); assert.match(html, /value="Continue"/);
  assert.match(html, /data-code="Continue"/); assert.match(html, /class="Continue"/);
  assert.match(html, /<p>Continue<\/p>/); assert.match(html, /href="https:\/\/anacan.az\/Continue"/);
  assert.match(transformInlineCopy(source, file).code, /status: 'Continue'/);
});

test('preserves template values and lets the translation reorder placeholders', () => {
  const source = 'const count=2,name="<Ada>"; export default () => <p>{`${name} has ${count} records`}</p>;';
  const html = render(source, { '{inline_0} has {inline_1} records': '{inline_1} enregistrements pour {inline_0}' });
  assert.equal(html, '<p>2 enregistrements pour &lt;Ada&gt;</p>');
  assert.equal(render(source), render(source, {}, false));
});

test('extracts display props and notifications, never pre-admission or test modules', () => {
  const source = 'toast.error("Try again"); export default () => <button aria-label="Save">Save</button>;';
  const messages = Object.values(analyzeInlineCopy(source, file).messages);
  assert.deepEqual(messages.sort(), ['Save', 'Try again']);
  for (const path of ['src/main.tsx', 'src/bootstrap-app.tsx', 'src/components/InitialLanguageScreen.tsx', 'src/components/Example.test.tsx']) {
    assert.equal(transformInlineCopy(source, path), null);
  }
});
test('independent brand portal copy never imports the consumer translation/auth runtime', () => {
  const source = 'export default () => <label aria-label="Language">CTR<button>Continue</button></label>;';
  for (const file of ['src/brand-portal/Portal.tsx', 'src/brand-portal/Report.tsx', 'src/brand-portal/Admin.tsx']) {
    assert.equal(transformInlineCopy(source, file), null);
    assert.deepEqual(analyzeInlineCopy(source, file).messages, {});
  }
});

test('identical extraction/compiler keys and useful source maps survive code movement', () => {
  const source = 'export default () => <p>Retry &amp; continue</p>;';
  const result = transformInlineCopy(source, file);
  assert.deepEqual(result.messages, analyzeInlineCopy(source, file).messages);
  assert.deepEqual(result.messages, analyzeInlineCopy('\n\n' + source, file).messages);
  for (const key of Object.keys(result.messages)) assert.ok(result.code.includes(JSON.stringify(key)));
  assert.ok(result.map.sourcesContent.includes(source));
});

test('localizes display dates including templates while leaving event serialization and input values intact', () => {
  const source = `const date=new Date('2026-09-23T12:00:00Z'); export default () => <button
    onClick={() => date.toLocaleDateString('az-AZ')} value={date.toLocaleDateString('az-AZ')}
    title={date.toLocaleDateString('az-AZ', { timeZone: 'UTC', month: 'long' })}>
    {\`Date: \${date.toLocaleDateString('az-AZ', { timeZone: 'UTC', month: 'long' })}\`}</button>;`;
  const result = render(source, {}, true, 'fr-FR');
  assert.match(result, /title="septembre"/); assert.match(result, /Date: septembre/);
  const code = transformInlineCopy(source, file).code;
  assert.match(code, /onClick=\{\(\) => date\.toLocaleDateString\('az-AZ'\)\}/);
  assert.match(code, /value=\{date\.toLocaleDateString\('az-AZ'\)\}/);
});
