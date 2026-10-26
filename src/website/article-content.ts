import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Element, Root, RootContent } from 'hast';

export interface ArticleContentOptions {
  footnotesLabel?: string;
}
export interface RenderedArticleContent {
  content: string;
  headings: Array<{ id: string; title: string }>;
  contentFormat: 'anacan-article-html-v1';
}

const schema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'figure', 'figcaption', 'abbr', 'mark', 'caption'],
  attributes: {
    ...defaultSchema.attributes,
    '*': ['id', 'title', 'lang', 'dir'],
    a: [...defaultSchema.attributes.a, 'title'],
    img: [...defaultSchema.attributes.img, 'alt', 'title', 'width', 'height', ['loading', 'lazy', 'eager'], ['decoding', 'async', 'sync', 'auto']],
    ol: [...defaultSchema.attributes.ol, 'start'],
    h2: [['className', 'sr-only', 'site-content-sr']],
    input: [...defaultSchema.attributes.input, 'checked'],
    td: ['align', 'colSpan', 'rowSpan'],
    th: ['align', 'colSpan', 'rowSpan', 'scope'],
    div: [['className', 'site-prose-table', 'blog-table-scroll'], 'role', 'tabIndex', 'ariaLabel', 'ariaLabelledBy'],
    abbr: ['title'],
  },
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto', 'tel'] },
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'textarea', 'select', 'button'],
};
const serializer = unified().use(rehypeStringify);
function createParser(label: string) {
  return unified().use(remarkParse).use(remarkGfm).use(remarkRehype, {
    allowDangerousHtml: true,
    footnoteLabel: label,
    footnoteBackLabel: label,
  }).use(rehypeRaw).use(rehypeSanitize, schema);
}
const processors = new Map<string, ReturnType<typeof createParser>>();
const inlineMarkdown = /(?:\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|(?:^|\s)_[^_\n]+_|~~[^~]+~~|`[^`\n]+`|!?\[[^\]]+\](?:\([^)]*\)|\[[^\]]*\])|\[\^[^\]]+\])/u;
const blockMarkdown = /(?:^|\n)[ \t]{0,3}(?:#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+|>[ \t]*\S|`{3,}|~{3,}|(?:[-*_][ \t]*){3,}$|\|.*\|)/u;

function parser(label: string) {
  let processor = processors.get(label);
  if (!processor) {
    processor = createParser(label);
    processors.set(label, processor);
    if (processors.size > 24) processors.delete(processors.keys().next().value);
  }
  return processor;
}
function parse(source: string, label: string): Root {
  const processor = parser(label);
  return processor.runSync(processor.parse(source)) as Root;
}
function inlineHtml(source: string, label: string): Element['children'] {
  const parsed = parse(source, label).children;
  const paragraph = parsed.find(isParagraph);
  return paragraph ? paragraph.children : [];
}
/** Some translated imports put punctuation at both emphasis boundaries (for
 * example **标题：**正文). CommonMark intentionally leaves that delimiter literal.
 * Preserve the intended editorial emphasis without touching escaped/code text. */
function repairTextEmphasis(parent: Root | Element, label: string, candidates: Set<string>) {
  if (parent.type === 'element' && ['pre', 'code', 'a'].includes(parent.tagName)) return;
  const children: RootContent[] = [];
  for (const child of parent.children) {
    if (child.type === 'element') repairTextEmphasis(child, label, candidates);
    if (child.type === 'text') {
      const pattern = /(?<!\\)(\*\*|__|~~)(?=\S)([^\n]+?\S)\1/gu;
      let start = 0;
      for (const match of child.value.matchAll(pattern)) {
        if (!candidates.has(match[0])) continue;
        if (match.index > start) children.push({ type: 'text', value: child.value.slice(start, match.index) });
        children.push({ type: 'element', tagName: match[1] === '~~' ? 'del' : 'strong', properties: {}, children: inlineHtml(match[2], label) });
        start = match.index + match[0].length;
      }
      if (start) {
        if (start < child.value.length) children.push({ type: 'text', value: child.value.slice(start) });
        continue;
      }
    }
    children.push(child);
  }
  // A few legacy translations have a half-open bold wrapper followed by an
  // already parsed <strong> term. Drop that orphan delimiter, keeping all text.
  const first = children[0];
  if (parent.type === 'element' && parent.tagName === 'p' && first?.type === 'text'
    && /^\*\*\S/u.test(first.value) && children.some(child => child.type === 'element' && child.tagName === 'strong')
    && (children.filter(child => child.type === 'text').map(child => (child as { value: string }).value).join('').match(/\*\*/g) || []).length === 1) {
    first.value = first.value.slice(2);
  }
  parent.children = children as Element['children'];
}
function text(node: RootContent): string {
  if (node.type === 'text') return node.value;
  return node.type === 'element' ? node.children.map(text).join('') : '';
}
function innerHtml(node: Element): string {
  return serializer.stringify({ type: 'root', children: node.children } as Root);
}
function isParagraph(node: RootContent): node is Element {
  return node.type === 'element' && node.tagName === 'p';
}
function legacyBlock(node: Element): string {
  const value = text(node).trimStart();
  if (/^(?:[-*+]|\d+[.)])[ \t]+/u.test(value)) return 'list';
  if (/^>[ \t]*\S/u.test(value)) return 'quote';
  if (/^\|.*\|/u.test(value)) return 'table';
  if (/^(?:`{3,}|~{3,})/u.test(value)) return 'fence';
  return '';
}

/** Old rich-text imports can contain Markdown inside paragraphs. Repair only
 * those blocks; pre/code, escaped code examples and existing HTML keep their
 * semantics. Consecutive list/table paragraphs must be parsed as one block. */
function repairLegacy(node: Root | Element, label: string, source: string) {
  if (node.type === 'element' && ['pre', 'code', 'a', 'script', 'style'].includes(node.tagName)) return;
  const result: RootContent[] = [];
  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index];
    const wasHtml = child.position?.start.offset !== undefined && /^\s*</u.test(source.slice(child.position.start.offset, child.position.end.offset));
    if (isParagraph(child) && wasHtml) {
      const value = text(child);
      // Empty paragraphs and lone quote/heading markers are artifacts of the
      // previous HTML conversion, not visible editorial content.
      if (!value.trim() && !child.children.some(item => item.type === 'element') || /^\s*(?:>|#{1,6})\s*$/u.test(value)) continue;
      const block = legacyBlock(child);
      if (block) {
        const lines = [innerHtml(child)];
        let end = index;
        for (let next = index + 1; next < node.children.length; next++) {
          const following = node.children[next];
          if (following.type === 'text' && !following.value.trim()) { end = next; continue; }
          if (!isParagraph(following) || legacyBlock(following) !== block) break;
          lines.push(innerHtml(following)); end = next;
        }
        result.push(...parse(lines.join('\n'), label).children);
        index = end;
        continue;
      }
      const source = innerHtml(child);
      if (inlineMarkdown.test(value) || blockMarkdown.test(value)) {
        result.push(...parse(source, label).children);
        continue;
      }
    }
    if (child.type === 'element') {
      if (wasHtml && /^(?:h[1-6]|td|th|figcaption|dt)$/u.test(child.tagName) && inlineMarkdown.test(text(child))) {
        const parsed = parse(innerHtml(child), label).children;
        if (parsed.length === 1 && isParagraph(parsed[0])) child.children = parsed[0].children;
      }
      repairLegacy(child, label, source);
    } else if (child.type === 'text' && node.type === 'element' && ['div', 'section', 'blockquote', 'li', 'dd'].includes(node.tagName)
      && (inlineMarkdown.test(child.value) || blockMarkdown.test(child.value))) {
      result.push(...parse(child.value, label).children);
      continue;
    }
    result.push(child);
  }
  node.children = result as Element['children'];
}

function normalize(tree: Root): RenderedArticleContent['headings'] {
  const headings: RenderedArticleContent['headings'] = [];
  const ids = new Map<string, string>(), used = new Set<string>();
  const elements: Element[] = [];
  function visit(node: Root | Element, footnote = false) {
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      const inFootnotes = footnote || child.properties.dataFootnotes !== undefined || (child.properties.className as string[] | undefined)?.includes('footnotes');
      elements.push(child);
      if (child.tagName === 'h1') child.tagName = 'h2';
      const old = typeof child.properties.id === 'string' ? child.properties.id : '';
      let id = '';
      if (child.tagName === 'h2' && !inFootnotes) {
        id = `section-${headings.length + 1}`;
        headings.push({ id, title: text(child) });
      } else if (old) {
        const local = old.replace(/^(?:user-content-|blog-content-)+/u, '').replace(/[^\p{L}\p{N}_.:-]/gu, '-');
        id = `blog-content-${local || 'anchor'}`;
        let suffix = 1;
        while (used.has(id)) id = `blog-content-${local}-${suffix++}`;
      }
      if (id) {
        used.add(id); child.properties.id = id;
        if (old) {
          ids.set(old, id);
          ids.set(old.replace(/^user-content-/u, ''), id);
          ids.set(old.replace(/^(?:user-content-|blog-content-)+/u, ''), id);
        }
      }
      if (child.tagName === 'input') {
        child.properties.type = 'checkbox'; child.properties.disabled = true;
      }
      if (child.tagName === 'img') {
        child.properties.loading = 'lazy'; child.properties.decoding = 'async';
      }
      visit(child, !!inFootnotes);
    }
  }
  visit(tree);
  for (const node of elements) {
    if (node.tagName === 'a' && typeof node.properties.href === 'string' && node.properties.href.startsWith('#')) {
      const value = node.properties.href.slice(1);
      const target = ids.get(value) || ids.get(`user-content-${value}`);
      if (target) node.properties.href = `#${target}`;
    }
    for (const key of ['ariaDescribedBy', 'ariaLabelledBy']) {
      if (Array.isArray(node.properties[key])) node.properties[key] = (node.properties[key] as string[]).map(value => ids.get(value) || ids.get(`user-content-${value}`) || value);
    }
    if (node.tagName === 'h2' && (node.properties.className as string[] | undefined)?.includes('sr-only')) node.properties.className = ['site-content-sr'];
  }
  function wrapTables(parent: Root | Element) {
    for (let index = 0; index < parent.children.length; index++) {
      const child = parent.children[index];
      if (child.type !== 'element') continue;
      if (child.tagName === 'table' && !(parent.type === 'element' && (parent.properties.className as string[] | undefined)?.includes('site-prose-table'))) {
        parent.children[index] = { type: 'element', tagName: 'div', properties: { className: ['site-prose-table'], tabIndex: 0 }, children: [child] };
      } else wrapTables(child);
    }
  }
  wrapTables(tree);
  function compactWhitespace(parent: Root | Element) {
    if (parent.type === 'element' && ['pre', 'code'].includes(parent.tagName)) return;
    const children: RootContent[] = [];
    for (const child of parent.children) {
      if (child.type === 'element') compactWhitespace(child);
      if (child.type === 'text' && !child.value.trim() && /\n/u.test(child.value)) {
        child.value = '\n';
        const previous = children[children.length - 1];
        if (previous?.type === 'text' && previous.value === '\n') continue;
      }
      children.push(child);
    }
    parent.children = children as Element['children'];
  }
  compactWhitespace(tree);
  return headings;
}

/** Shared CommonMark/GFM + HTML renderer for static HTML, Google SSR and browser
 * hydration. Never translate content or mutate the stored article/permalink. */
export function renderArticleContent(source: string, options: ArticleContentOptions = {}): RenderedArticleContent {
  const label = options.footnotesLabel || 'References';
  const input = String(source || '').replace(/\r\n?/g, '\n');
  const tree = parse(input, label);
  if (/<\/?(?:p|h[1-6]|ul|ol|div|section|table|blockquote|figure)(?:\s[^>]*|)>/iu.test(input)) repairLegacy(tree, label, input);
  const candidates = new Set([...input.matchAll(/(?<!\\)(\*\*|__|~~)(?=\S)([^\n]+?\S)\1/gu)].map(match => match[0]));
  repairTextEmphasis(tree, label, candidates);
  const headings = normalize(tree);
  return { content: serializer.stringify(tree), headings, contentFormat: 'anacan-article-html-v1' };
}
