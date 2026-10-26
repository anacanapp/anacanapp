import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { prepareBlogContent } from './blog-content.mjs';

function render(source: string, nativeCompatibility = false) {
  const rendered = prepareBlogContent(source, {
    document, sanitize: (html, options) => DOMPurify.sanitize(html, options), nativeCompatibility,
  });
  const element = document.createElement('div'); element.innerHTML = rendered.content;
  return { ...rendered, element };
}

describe('app blog Markdown/HTML content', () => {
  it('renders GFM headings, lists, inline HTML, links and locally scrollable tables', () => {
    const { element, headings } = render('# Guide\n\n## Clinical **notes**\n\n- First\n  - Nested\n\n3. Third\n4. Fourth\n\nText with <em>HTML</em> and <a href="https://www.nhs.uk">linked HTML</a>.\n\n| Unit | Value |\n| --- | --- |\n| **micrograms** | 400 |');
    expect(headings).toEqual([{ id: 'section-1', title: 'Guide' }, { id: 'section-2', title: 'Clinical notes' }]);
    expect(element.querySelector('h1')).toBeNull();
    expect(element.querySelector('ul ul li')?.textContent).toBe('Nested');
    expect(element.querySelector('ol')?.getAttribute('start')).toBe('3');
    expect(element.querySelector('em')?.textContent).toBe('HTML');
    expect(element.querySelector('a')?.textContent).toBe('linked HTML');
    expect(element.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(element.querySelector('.blog-table-scroll[tabindex="0"] > table td strong')?.textContent).toBe('micrograms');
    expect(element.querySelector('.blog-table-scroll')?.getAttribute('aria-labelledby')).toBe('section-2');
  });

  it('repairs pasted Markdown inside rich-text paragraphs while retaining HTML media and captions', () => {
    const { element, headings } = render('<h2>Existing <em>heading</em></h2><p>## Pasted heading<br><br>- One<br>- Two</p><p>**Bold** and [guide](https://www.nhs.uk).</p><figure><img src="/photo.webp" width="1200" height="675" alt="Original"><figcaption>Photo <em>caption</em></figcaption></figure>');
    expect(headings.map(heading => heading.title)).toEqual(['Existing heading', 'Pasted heading']);
    expect(element.querySelectorAll('ul li')).toHaveLength(2);
    expect(element.querySelector('p strong')?.textContent).toBe('Bold');
    expect(element.querySelector('figure img')?.getAttribute('alt')).toBe('Original');
    expect(element.querySelector('figure img')?.getAttribute('width')).toBe('1200');
    expect(element.querySelector('figure figcaption em')?.textContent).toBe('caption');
  });

  it('repairs old paragraphs containing inline HTML and CJK punctuation-bound emphasis', () => {
    const { element } = render('<p>- Until 1.5 years: <strong>44 AZN</strong> per month.</p><p>- From 1.5 to 3 years: <strong>28 AZN</strong> per month.</p>\n\n- **标题：**正文\n- **項目：**説明\n\n**How is it performed?**1. First step');
    expect(element.querySelectorAll('ul li')).toHaveLength(4);
    expect(element.querySelectorAll('li strong')).toHaveLength(4);
    expect(element.querySelector('p strong')?.textContent).toBe('How is it performed?');
    expect(element.textContent).not.toContain('**');
    expect(element.textContent).toContain('1.5 years: 44 AZN');
  });

  it('combines rich-text table rows into one table without dropping inline cell text or numbers', () => {
    const { element } = render('<h2>Dose</h2><p>| Product | Amount |</p><p>| --- | --- |</p><p>| <strong>Folic acid</strong> | <strong>400 micrograms</strong> = 0.4 mg |</p><p>| High risk | 5 mg only with a clinician |</p><p>&gt;</p>');
    expect(element.querySelectorAll('.blog-table-scroll table')).toHaveLength(1);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.querySelector('td strong')?.textContent).toBe('Folic acid');
    expect(element.textContent).toContain('400 micrograms = 0.4 mg');
    expect(element.textContent).not.toContain('| ---');
    expect([...element.querySelectorAll('p')].some(node => node.textContent?.trim() === '>')).toBe(false);
  });

  it('unwraps article export fences and escaped HTML without treating ordinary code as prose', () => {
    for (const source of ['```html\n<h2>Export</h2><p>Article</p>\n```', '```md\n## Export\n\nArticle\n```', '&lt;h2&gt;Export&lt;/h2&gt;&lt;p&gt;Article&lt;/p&gt;']) {
      const { element, headings } = render(source);
      expect(headings[0]?.title).toBe('Export');
      expect(element.querySelector('p')?.textContent).toBe('Article');
      expect(element.querySelector('pre')).toBeNull();
    }
    const { element } = render('```\n**literal**\n```');
    expect(element.querySelector('pre code')?.textContent).toContain('**literal**');
    expect(element.querySelector('strong')).toBeNull();
  });

  it('preserves escaped syntax, code examples and clinical numbers on repeated preparation', () => {
    const source = '## Dose\n\n400 micrograms = 0.4 mg; first 12 weeks. Do **not** take 5 mg without advice.\n\n\\*\\*literal\\*\\* and `**code**`.\n\n```js\nconst dose = "400 mcg";\n```';
    const first = render(source), second = render(first.content);
    expect(first.element.querySelectorAll('strong')).toHaveLength(1);
    expect(first.element.textContent).toContain('**literal**');
    expect(first.element.textContent).toContain('400 micrograms = 0.4 mg; first 12 weeks. Do not take 5 mg without advice.');
    expect(second.content).toBe(first.content);
    expect(second.headings).toEqual(first.headings);
  });

  it('strips executable markup, unsafe URLs, arbitrary layout classes and input styles', () => {
    const { element } = render('<h2 id="location" class="fixed w-screen">Title</h2><p onclick="evil()" style="width:9999px">Text<script>evil()</script><a href="javascript:evil()">Unsafe</a><img src="data:image/svg+xml,bad" onerror="evil()"></p><iframe src="https://example.com"></iframe><form><input name="password"></form><svg onload="evil()"></svg>\n\n[Unsafe](javascript:evil())');
    expect(element.querySelector('script,iframe,form,input,svg,[onclick],[onerror],[style],.fixed,.w-screen')).toBeNull();
    expect(element.querySelector('a[href^="javascript:"],img[src^="data:"]')).toBeNull();
    expect(element.textContent).toContain('Text');
    expect(element.textContent).not.toContain('evil()');
  });

  it('keeps old heading links navigable and removes table width constraints', () => {
    const { element } = render('<h1 id="intro">Intro</h1><a href="#intro">Jump</a><h2 id="table">Table</h2><table width="9000"><colgroup><col width="9000"></colgroup><tr><th width="9000">Heading</th><td height="500">Cell</td></tr></table>');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('#section-1');
    expect(element.querySelector('table[width],col[width],th[width],td[height]')).toBeNull();
    expect(element.querySelector('.blog-table-scroll')?.getAttribute('aria-labelledby')).toBe('section-2');
  });

  it('adds only finite owned native styles and keeps native/browser projections idempotent', () => {
    const source = '<h2>Table</h2><table style="position:fixed"><tr><td>400 mcg</td><td>12 weeks</td></tr></table><figure style="width:9999px"><img src="/photo.webp" style="width:9999px"><figcaption>Caption</figcaption></figure>';
    const native = render(source, true), repeated = render(native.content, true), web = render(native.content);
    expect(native.element.querySelectorAll('.blog-native-content')).toHaveLength(1);
    expect(repeated.content).toBe(native.content);
    expect(native.element.querySelector('.blog-table-scroll')?.getAttribute('style')).toContain('overflow-x:auto');
    expect(native.element.querySelector('table')?.getAttribute('style')).not.toContain('position');
    expect(web.element.querySelector('[style]')).toBeNull();
    expect(web.element.textContent).toBe(native.element.textContent);
    expect(web.headings).toEqual(native.headings);
  });
});
