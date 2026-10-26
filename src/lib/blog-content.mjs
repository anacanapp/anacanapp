import { marked, Renderer } from 'marked';

/** Session-free public article formatting, shared by SSR, web and app readers. */
function articleSource(value) {
  let source = typeof value === 'string' ? value.trim() : '';
  const fenced = /^```(html|markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(source);
  if (fenced && !/^\s*```/mu.test(fenced[2]) && (fenced[1] || /^\s*<(?:p|h[1-6]|div|section|table|figure|ul|ol|blockquote)\b/iu.test(fenced[2]))) source = fenced[2].trim();
  return source;
}
export function blogMarkup(value) { return marked.parse(articleSource(value), { async: false, gfm: true, breaks: true }); }
const blockMarkdown = /(?:^|\n)\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|```|\|.+\|\s*\n\s*\|?\s*:?-{2,})/u;
const inlineMarkdown = /\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^\s]+\)|`[^`\n]+`|(?:^|\s)\*[^*\n]+\*(?:\s|$)/u;
const forbidden = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'option', 'object', 'embed'],
  FORBID_ATTR: ['style'], ALLOW_DATA_ATTR: false,
};

export function prepareBlogContent(value, { document, sanitize, nativeCompatibility = false }) {
  let source = articleSource(value);
  if (/^\s*&lt;(?:p|h[1-6]|div|section|table|figure|ul|ol|blockquote)(?:\s|&gt;)/iu.test(source)) {
    const decoder = document.createElement('textarea'); decoder.innerHTML = source; source = decoder.value;
  }
  const root = document.createElement('div'); root.innerHTML = sanitize(source, forbidden);
  const only = root.children.length === 1 && [...root.childNodes].every(node => node.nodeType === 1 || !node.textContent?.trim()) ? root.firstElementChild : null;
  const prepared = only?.classList.contains('blog-content-body') || only?.classList.contains('blog-native-content');
  if (prepared) root.innerHTML = only.innerHTML;
  else {
    // Reparse text only inside raw HTML tokens. Reparsing an already rendered
    // Markdown document would turn escaped literal syntax into formatting.
    const rawHtml = text => {
      const fragment = document.createElement('div'); fragment.innerHTML = sanitize(text, forbidden);
      // Older rich-text imports exported each GFM table row as a separate <p>.
      // Parse consecutive rows together so the header separator remains visible
      // to the Markdown parser; keep inline HTML already present in each cell.
      for (const node of [...fragment.querySelectorAll('p')]) {
        if (!fragment.contains(node) || !/^\s*\|.*\|\s*$/u.test(node.textContent || '')) continue;
        const group = [node]; let next = node.nextSibling;
        while (next) {
          if (next.nodeType === 3 && !next.textContent?.trim()) { next = next.nextSibling; continue; }
          if (next.nodeName !== 'P' || !/^\s*\|.*\|\s*$/u.test(next.textContent || '')) break;
          group.push(next); next = next.nextSibling;
        }
        if (group.length < 2) continue;
        const markup = marked.parse(group.map(row => row.innerHTML).join('\n'), { async: false, gfm: true, breaks: true });
        if (!markup.includes('<table>')) continue;
        const replacement = document.createElement('template'); replacement.innerHTML = sanitize(markup, forbidden);
        node.replaceWith(replacement.content); group.slice(1).forEach(row => row.remove());
      }
      for (const node of [...fragment.querySelectorAll('p,div,section,article,blockquote')]) {
        if (!node.isConnected && !fragment.contains(node) || node.closest('pre,code') || node.querySelector('p,div,section,article,blockquote,table,pre,ul,ol,figure')) continue;
        const plain = node.innerHTML.replace(/<br\s*\/?\s*>/giu, '\n');
        if (!blockMarkdown.test(node.textContent || '') && !blockMarkdown.test(plain)) continue;
        const replacement = document.createElement('template');
        replacement.innerHTML = sanitize(marked.parse(plain, { async: false, gfm: true, breaks: true }), forbidden);
        node.replaceWith(replacement.content);
      }
      for (const node of [...fragment.querySelectorAll('p')]) if (!node.children.length && /^\s*(?:>|#{1,6})\s*$/u.test(node.textContent || '')) node.remove();
      const walker = document.createTreeWalker(fragment, 4), textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        if (node.parentElement?.closest('pre,code,a') || !inlineMarkdown.test(node.textContent || '')) continue;
        const replacement = document.createElement('template');
        replacement.innerHTML = sanitize(marked.parseInline(node.textContent || '', { async: false, gfm: true, breaks: true }), forbidden);
        node.replaceWith(replacement.content);
      }
      return fragment.innerHTML;
    };
    const renderer = new Renderer();
    renderer.html = token => token.block ? rawHtml(token.text) : token.text;
    renderer.checkbox = token => token.checked ? '☑ ' : '☐ ';
    root.innerHTML = sanitize(marked.parse(source, { async: false, gfm: true, breaks: true, renderer }), forbidden);
    // Some legacy translations place punctuation at both emphasis boundaries,
    // e.g. **标题：**正文. CommonMark leaves those delimiters literal. Repair only
    // exact unescaped source phrases, outside links/code, after the first parse.
    const candidates = new Set([...source.matchAll(/(?<!\\)(\*\*|__|~~)(?=\S)([^\n]+?\S)\1/gu)].map(match => match[0]));
    const walker = document.createTreeWalker(root, 4), textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (node.parentElement?.closest('pre,code,a')) continue;
      let start = 0; const replacement = document.createDocumentFragment();
      for (const match of (node.textContent || '').matchAll(/(?<!\\)(\*\*|__|~~)(?=\S)([^\n]+?\S)\1/gu)) {
        if (!candidates.has(match[0])) continue;
        replacement.append(document.createTextNode(node.textContent.slice(start, match.index)));
        const emphasis = document.createElement(match[1] === '~~' ? 'del' : 'strong');
        emphasis.innerHTML = sanitize(marked.parseInline(match[2], { async: false, gfm: true, breaks: true }), forbidden); replacement.append(emphasis);
        start = match.index + match[0].length;
      }
      if (start) { replacement.append(document.createTextNode(node.textContent.slice(start))); node.replaceWith(replacement); }
    }
    for (const node of root.querySelectorAll('p')) {
      const first = node.firstChild;
      if (first?.nodeType === 3 && /^\*\*\S/u.test(first.textContent || '') && node.querySelector('strong') && ((node.textContent || '').match(/\*\*/gu) || []).length === 1) first.textContent = first.textContent.slice(2);
    }
  }
  root.innerHTML = sanitize(root.innerHTML, forbidden);
  for (const node of root.querySelectorAll('[class]')) {
    const keep = [...node.classList].filter(name => name === 'blog-table-scroll' || node.tagName === 'CODE' && /^language-[\w-]+$/u.test(name));
    if (keep.length) node.className = keep.join(' '); else node.removeAttribute('class');
  }
  for (const node of [...root.querySelectorAll('h1')]) {
    const heading = document.createElement('h2'); heading.innerHTML = node.innerHTML;
    if (node.id) heading.id = node.id;
    node.replaceWith(heading);
  }
  const anchors = new Map();
  [...root.querySelectorAll('h2')].forEach((node, index) => { const id = `section-${index + 1}`; if (node.id) anchors.set(node.id, id); node.id = id; });
  const headings = [...root.querySelectorAll('h2')].map(node => ({ id: node.id, title: node.textContent || '' }));
  for (const image of root.querySelectorAll('img')) {
    if (/^(?:data|blob):/iu.test(image.getAttribute('src') || '')) image.removeAttribute('src');
    image.setAttribute('loading', 'lazy'); image.setAttribute('decoding', 'async');
    if (!image.hasAttribute('alt')) image.setAttribute('alt', '');
  }
  for (const link of root.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#') && anchors.has(href.slice(1))) link.setAttribute('href', '#' + anchors.get(href.slice(1)));
    if (/^(?:https?:)?\/\//iu.test(href)) { link.setAttribute('rel', 'noopener noreferrer'); link.setAttribute('target', '_blank'); }
  }
  for (const table of root.querySelectorAll('table')) {
    for (const element of [table, ...table.querySelectorAll('th,td,col,colgroup')]) { element.removeAttribute('width'); element.removeAttribute('height'); }
    let wrapper = table.parentElement;
    if (!wrapper?.classList.contains('blog-table-scroll')) {
      wrapper = document.createElement('div'); wrapper.className = 'blog-table-scroll'; table.before(wrapper); wrapper.append(table);
    }
    wrapper.setAttribute('tabindex', '0');
    let label;
    for (const heading of root.querySelectorAll('h2')) if (heading.compareDocumentPosition(table) & 4) label = heading.id;
    if (label) { wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-labelledby', label); }
  }
  if (nativeCompatibility) {
    // Old delivered native readers retain style attributes but have fixed CSS.
    // These finite app-owned rules are materialized only after stripping input
    // styles. Web readers strip them and use the shared responsive stylesheet.
    for (const node of root.querySelectorAll('.blog-table-scroll')) node.setAttribute('style', 'display:block;max-width:100%;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch');
    for (const node of root.querySelectorAll('table')) node.setAttribute('style', 'width:100%;min-width:28rem;border-collapse:collapse');
    for (const node of root.querySelectorAll('img')) node.setAttribute('style', 'display:block;max-width:100%;height:auto');
    for (const node of root.querySelectorAll('figure')) node.setAttribute('style', 'max-width:100%;min-width:0;margin:1rem 0');
    for (const node of root.querySelectorAll('pre')) node.setAttribute('style', 'max-width:100%;overflow-x:auto;white-space:pre');
    return { content: `<div class="blog-native-content" style="min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal">${root.innerHTML}</div>`, headings };
  }
  return { content: `<div class="blog-content-body">${root.innerHTML}</div>`, headings };
}
