import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import ts from 'typescript';
import MagicString from 'magic-string';
import { decodeHTMLStrict } from 'entities';

const labelAttributes = new Set(['title', 'subtitle', 'label', 'description', 'placeholder', 'alt', 'aria-label', 'emptyText', 'emptyMessage', 'buttonText',
  'note', 'hint', 'helperText', 'emptyTitle', 'searchPlaceholder', 'loadingText', 'errorMessage', 'confirmText', 'cancelText', 'heading']);
const invariant = /^(?:Anacan|Premium|RevenueCat|Google|Apple|App Store|Google Play|iOS|Android|API|CSV|JSON|URL|ID|UUID|UTC|ISO|FCM|SQL|HTTP|HTTPS|GET|POST|PATCH|PUT|DELETE|cm|mm|kg|g|mg|ml|mL|kcal|bpm|mmHg|dB|Hz|MB|KB|GB|BMI|AZN|USD|EUR|AZ|EN|RU|TR|KK|UZ|KA|DE|AR|ZH|FR|ES|PT|V|A)$/;
const translatable = text => /\p{L}/u.test(text) && !invariant.test(text)
  && !/^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+$/.test(text)
  && !/^(?:https?:\/\/|[\w.+-]+@|(?:[a-z0-9-]+\.)+(?:az|com|org|net|io|app)(?:\/|$))/i.test(text);
const messageKey = (file, text) => `inline_${file.split('/').pop().replace(/\.tsx?$/, '').toLowerCase()}_${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;

/** Match React's JSX whitespace semantics before replacing a text node with an
 * expression. Decoding happens at build time, never against user content. */
export function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) last = i;
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, ' ');
    if (i !== 0) line = line.replace(/^ +/, '');
    if (i !== lines.length - 1) line = line.replace(/ +$/, '');
    if (line) result += line + (i !== last ? ' ' : '');
  }
  return decodeHTMLStrict(result);
}

/** Only literal UI copy is eligible: JSX text, explicitly named display props,
 * rendered conditional/template leaves, and toast/confirmation messages.
 * Identifiers, links, values, event logic, persisted data and user text are not
 * rewritten. Extraction and compilation use this SAME function. */
export function analyzeInlineCopy(code, file) {
  const messages = {}, replacements = [];
  if (!/^src\/.*\.tsx?$/.test(file) || /(?:\.test\.|\.spec\.|^src\/test\/)/.test(file)
    || file === 'src/components/InitialLanguageScreen.tsx' || file === 'src/main.tsx' || file === 'src/bootstrap-app.tsx'
    // The business portal owns its 21-language copy and separate auth realm.
    // Injecting consumer tr/i18n here would initialize the consumer SDK/session.
    || file.startsWith('src/brand-portal/') || file.startsWith('src/public-blog/') || file.startsWith('src/website/') || file.startsWith('src/web-entry/')) return { messages, replacements };
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const displayContext = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxExpression(parent)) return !ts.isJsxAttribute(parent.parent) || labelAttributes.has(parent.parent.name.getText(tree));
    }
    return false;
  };
  const localeArgument = node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && /^(?:toLocaleString|toLocaleDateString|toLocaleTimeString)$/.test(node.expression.name.text)
    && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && ['az', 'az-AZ'].includes(node.arguments[0].text)
    && displayContext(node) ? node.arguments[0] : null;
  const renderedExpression = expression => {
    let value = expression.getText(tree); const start = expression.getStart(tree), edits = [];
    const collect = node => { const argument = localeArgument(node); if (argument) edits.push(argument); ts.forEachChild(node, collect); };
    collect(expression);
    for (const argument of edits.sort((a, b) => b.pos - a.pos)) value = value.slice(0, argument.getStart(tree) - start) + '__anacanLocaleTag()' + value.slice(argument.end - start);
    return value;
  };
  const add = (node, raw, jsx = false) => {
    const leading = /^\s*/.exec(raw)[0], trailing = /\s*$/.exec(raw)[0], text = raw.trim();
    if (!translatable(text)) return;
    const key = messageKey(file, text); messages[key] = text;
    const call = `${leading ? JSON.stringify(leading) + ' + ' : ''}__anacanInlineTr(${JSON.stringify(key)}, ${JSON.stringify(text)})${trailing ? ' + ' + JSON.stringify(trailing) : ''}`;
    replacements.push({ start: ts.isJsxText(node) ? node.pos : node.getStart(tree), end: node.end, value: jsx ? `{${call}}` : call });
  };
  const rendered = node => {
    if (!node) return;
    if (ts.isStringLiteralLike(node)) add(node, node.text);
    else if (ts.isParenthesizedExpression(node)) rendered(node.expression);
    else if (ts.isConditionalExpression(node)) { rendered(node.whenTrue); rendered(node.whenFalse); }
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) rendered(node.right);
    else if (ts.isTemplateExpression(node)) {
      let text = node.head.text;
      node.templateSpans.forEach((span, index) => { text += `{inline_${index}}${span.literal.text}`; });
      if (!translatable(text.replace(/\{inline_\d+\}/g, ''))) return;
      const key = messageKey(file, text); messages[key] = text;
      const values = node.templateSpans.map((span, index) => `inline_${index}: (${renderedExpression(span.expression)})`).join(', ');
      replacements.push({ start: node.getStart(tree), end: node.end, value: `__anacanInlineFormat(${JSON.stringify(key)}, ${JSON.stringify(text)}, {${values}})` });
    }
  };
  const visit = node => {
    if (ts.isJsxElement(node) && /^(?:code|pre|style|script)$/.test(node.openingElement.tagName.getText(tree))) return;
    if (ts.isJsxText(node)) { add(node, jsxTextValue(node.text), true); return; }
    if (ts.isJsxAttribute(node)) {
      if (labelAttributes.has(node.name.getText(tree))) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer, decodeHTMLStrict(node.initializer.text), true);
        else if (node.initializer && ts.isJsxExpression(node.initializer)) {
          rendered(node.initializer.expression);
          if (node.initializer.expression) visit(node.initializer.expression);
        }
      }
      return;
    }
    if (ts.isJsxExpression(node)) {
      rendered(node.expression);
      // JSX nested inside an expression still needs its own literal copy, but
      // do not rewrite text inside arbitrary callbacks or function arguments.
    }
    const argument = localeArgument(node);
    if (argument) replacements.push({ start: argument.getStart(tree), end: argument.end, value: '__anacanLocaleTag()' });
    if (ts.isCallExpression(node) && /^(?:toast(?:\.(?:success|error|info|warning|message|loading))?|(?:window\.)?(?:alert|confirm))$/.test(node.expression.getText(tree))) {
      rendered(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  // Parent template replacements subsume their nested expression edits.
  const ordered = replacements.sort((a, b) => a.start - b.start || b.end - a.end);
  const disjoint = [];
  for (const edit of ordered) if (!disjoint.length || edit.start >= disjoint[disjoint.length - 1].end) disjoint.push(edit);
  return { messages, replacements: disjoint };
}

export function transformInlineCopy(code, file) {
  const { messages, replacements } = analyzeInlineCopy(code, file);
  if (!replacements.length) return null;
  if (/\b(?:__anacanInline(?:Tr|Format)|__anacanLocaleTag)\b/.test(code)) throw new Error('INLINE_LOCALIZATION_IDENTIFIER_COLLISION');
  const output = new MagicString(code);
  for (const replacement of replacements) output.overwrite(replacement.start, replacement.end, replacement.value);
  output.prepend('import { tr as __anacanInlineTr, formatTr as __anacanInlineFormat } from "@/lib/tr";\n');
  if (replacements.some(replacement => replacement.value.includes('__anacanLocaleTag'))) output.prepend('import { getLocaleTag as __anacanLocaleTag } from "@/lib/i18n";\n');
  return { code: output.toString(), map: output.generateMap({ source: file, includeContent: true, hires: true }), messages };
}

export function inlineLocalizationPlugin() {
  let root = process.cwd();
  return {
    name: 'anacan-inline-localization', enforce: 'pre',
    configResolved(config) { root = config.root; },
    transform(code, id) {
      const file = relative(root, id.split('?')[0]).replace(/\\/g, '/');
      const result = transformInlineCopy(code, file);
      return result ? { code: result.code, map: result.map } : null;
    },
  };
}
