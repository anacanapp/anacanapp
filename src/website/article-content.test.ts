import { describe, it, expect } from 'vitest';
import { renderArticleContent } from './article-content';

function documentFor(source: string) {
  const rendered = renderArticleContent(source, { footnotesLabel: 'Mənbələr' });
  const document = new DOMParser().parseFromString(`<div class="site-prose">${rendered.content}</div>`, 'text/html');
  return { ...rendered, document, prose: document.querySelector('.site-prose')! };
}
describe('public article Markdown and HTML', () => {
  it('renders all heading levels, inline formatting, paragraphs, breaks and rules', () => {
    const { document, headings, prose } = documentFor('# Title\n\n## Section **two**\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\n**Bold**, *italic*, _also italic_, ~~deleted~~ and `a < b`.\n\nLine one  \nLine two\n\n---');
    expect(document.querySelector('h1')).toBeNull();
    expect(headings.map(item => item.id)).toEqual(['section-1', 'section-2']);
    expect(document.querySelectorAll('h2')).toHaveLength(2);
    for (const tag of ['h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 'code', 'br', 'hr']) expect(prose.querySelector(tag)).not.toBeNull();
    expect(prose.querySelector('code')?.textContent).toBe('a < b');
    expect(prose.textContent).not.toContain('**');
  });
  it('preserves nested lists, ordered-list start values and read-only task checkboxes', () => {
    const { prose } = documentFor('- Parent\n  - Nested item\n    1. Third level\n\n3. Third\n4. Fourth\n\n- [x] Done\n- [ ] Pending');
    expect(prose.querySelector('ul ul ol')).not.toBeNull();
    expect(prose.querySelector('ol[start="3"]')).not.toBeNull();
    const checks = [...prose.querySelectorAll<HTMLInputElement>('input')];
    expect(checks).toHaveLength(2);
    expect(checks.every(item => item.type === 'checkbox' && item.disabled)).toBe(true);
    expect(checks[0].checked).toBe(true); expect(checks[1].checked).toBe(false);
  });
  it('renders aligned tables and fenced/indented code without interpreting code syntax', () => {
    const { prose } = documentFor('| Left | Center | Right |\n| :--- | :---: | ---: |\n| **text** | middle | 42 |\n\n```js\nconst word = "**not bold**";\n```\n\n    <script>not executed</script>');
    expect(prose.querySelector('.site-prose-table > table thead')).not.toBeNull();
    expect(prose.querySelector('th[align="center"]')).not.toBeNull();
    expect(prose.querySelector('td[align="right"]')?.textContent).toBe('42');
    expect(prose.querySelectorAll('pre')).toHaveLength(2);
    expect(prose.querySelector('pre code.language-js')?.textContent).toContain('**not bold**');
    expect(prose.querySelector('pre strong')).toBeNull();
    expect(prose.querySelector('script')).toBeNull();
  });
  it('supports blockquotes, reference/automatic links, images and linked footnotes', () => {
    const { prose, document, headings } = documentFor('## Məqalə\n\n> Quote\n>\n> - Nested list\n\n[Reference][guide], https://anacan.az and <reader@example.com>.\n\n[guide]: https://www.nhs.uk "Guide"\n\n![Picture](https://anacan.az/image.webp "Caption")\n\nFact[^note].\n\n[^note]: A **source**.');
    expect(prose.querySelector('blockquote ul')).not.toBeNull();
    expect(prose.querySelector('a[title="Guide"]')?.getAttribute('href')).toBe('https://www.nhs.uk');
    expect(prose.querySelector('a[href="mailto:reader@example.com"]')).not.toBeNull();
    expect(prose.querySelector('img')?.getAttribute('alt')).toBe('Picture');
    expect(prose.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(headings).toEqual([{ id: 'section-1', title: 'Məqalə' }]);
    const footnote = prose.querySelector<HTMLAnchorElement>('a[data-footnote-ref]')!;
    const target = document.getElementById(footnote.getAttribute('href')!.slice(1));
    expect(target?.textContent).toContain('A source.');
    const back = prose.querySelector<HTMLAnchorElement>('a[data-footnote-backref]')!;
    expect(document.getElementById(back.getAttribute('href')!.slice(1))).not.toBeNull();
    expect(prose.querySelector('.site-content-sr')?.textContent).toBe('Mənbələr');
  });
  it('repairs Markdown embedded in legacy HTML without losing media, captions or inline HTML', () => {
    const { prose, headings } = documentFor('<h2>Existing <em>heading</em></h2><p>- First <strong>item</strong></p><p>- Second item</p><p>&gt;</p><p>**Bold** and [link](https://anacan.az).</p><figure><img src="/photo.webp" width="1200" height="675" alt="Original"><figcaption>Photo <em>caption</em></figcaption></figure><p></p>');
    expect(headings).toEqual([{ id: 'section-1', title: 'Existing heading' }]);
    expect(prose.querySelector('h2 em')).not.toBeNull();
    expect(prose.querySelectorAll('ul > li')).toHaveLength(2);
    expect(prose.querySelector('li strong')?.textContent).toBe('item');
    expect(prose.querySelector('p strong')?.textContent).toBe('Bold');
    expect(prose.querySelector('figure figcaption em')?.textContent).toBe('caption');
    expect(prose.querySelector('figure img')?.getAttribute('width')).toBe('1200');
    expect([...prose.querySelectorAll('p')].some(node => /^\s*>?\s*$/.test(node.textContent || ''))).toBe(false);
  });
  it('sanitizes active HTML, unsafe protocols and arbitrary attributes while retaining text', () => {
    const { prose } = documentFor('<h1 id="location">**Title**</h1><p style="color:red" onclick="evil()">Text <script>evil()</script><a href="javascript:evil()">bad</a><img src="javascript:evil()" onerror="evil()"></p><iframe src="https://example.com">hidden</iframe><form><input name="secret" type="password"></form>\n\n[Unsafe](javascript:evil())');
    expect(prose.querySelector('script,iframe,form,input[type="password"],[onclick],[onerror],[style]')).toBeNull();
    expect(prose.querySelector('a[href^="javascript:"],img[src^="javascript:"]')).toBeNull();
    expect(prose.querySelector('h2')?.textContent).toBe('Title');
    expect(prose.textContent).toContain('Text'); expect(prose.textContent).not.toContain('evil()');
  });
  it('recognizes translated punctuation-adjacent emphasis without changing code examples', () => {
    const { prose } = documentFor('**标题：**正文\n\n**Ways to help:**Breastfeed\n\n```\n**leave these delimiters**\n```');
    expect([...prose.querySelectorAll('p strong')].map(node => node.textContent)).toEqual(['标题：', 'Ways to help:']);
    expect(prose.querySelector('pre code')?.textContent).toContain('**leave these delimiters**');
    const broken = documentFor('**Obs! Read in **"Database"** in Anacan.');
    expect(broken.prose.textContent).toBe('Obs! Read in "Database" in Anacan.');
    expect(broken.prose.querySelector('strong')?.textContent).toBe('"Database"');
  });
  it('keeps normalized HTML stable between Google SSR and client hydration', () => {
    const first = renderArticleContent('## Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nText[^a].\n\n[^a]: Footnote.');
    const second = renderArticleContent(first.content);
    expect(second.content).toBe(first.content);
    expect(second.headings).toEqual(first.headings);
  });
  it('keeps escaped Markdown as literal documentation', () => {
    const { prose } = documentFor('\\*\\*literal stars\\*\\* and \\_\\_literal underscores\\_\\_.\n\n\\# Not a heading\n\n<figure><figcaption>HTML caption</figcaption></figure>');
    expect(prose.querySelector('strong')).toBeNull();
    expect(prose.textContent).toContain('**literal stars**');
    expect(prose.textContent).toContain('__literal underscores__');
    expect(prose.querySelector('h2')).toBeNull();
  });
});
