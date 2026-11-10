import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { WEBSITE_LANGUAGES, type WebsiteLanguageCode } from '../lib/app-languages';
import type { WebsiteBoot, WebsiteCatalog, WebsiteCopy, WebsiteCopyKey } from './model';
import { APP_STORE_URL, DETAIL_PAGES, GOOGLE_PLAY_URL, isCalcPage, routePath, sitePath, CALC_PAGES, WEBSITE_ORIGIN, type StaticPage } from './routes';
import { calcContent } from './calc-content';
// Server-side renderers (SSR runtime, prerender and LLM twins) need every language's tool texts.
import './calc-content/all';
import { llmFullPath, llmIndexPath, localeSitemapPath, markdownPath } from './discovery';
import { websiteMeta } from './seo';
import Website from './Website';
import llmCopy from './llm-copy.json' with {type:'json'};

/** Public, read-only LLM projection of the website: `/llms.txt`, per-locale
 * indexes/corpora, the JSON manifest and one clean Markdown twin per page.
 * Only public catalog/copy content is rendered; no session or private data. */
export type LlmCopy = typeof llmCopy.az;
export const LLM_COPY = llmCopy as Record<WebsiteLanguageCode, LlmCopy>;
export type LlmPageKind = 'home' | StaticPage;
export const LLM_PAGE_KINDS: LlmPageKind[] = ['home','features','download',...DETAIL_PAGES,'tools','ovulation','dueDate',...CALC_PAGES,'symptoms','simulator','faq','contact','privacy','terms','journal'];
export const LLM_FORMAT_VERSION = 'anacan-public-knowledge-v1';
type DetailCopy = WebsiteBoot['details'];

export function llmLanguageName(language: WebsiteLanguageCode): string {
  return WEBSITE_LANGUAGES.find(item => item.code === language)!.native_name;
}
function llmPageLabel(language: WebsiteLanguageCode, kind: LlmPageKind, copy: WebsiteCopy, details?: DetailCopy): string {
  if (kind === 'home') return copy.home;
  if ((DETAIL_PAGES as readonly string[]).includes(kind)) return details?.[`${kind}Label` as keyof NonNullable<DetailCopy>] || kind;
  if (isCalcPage(kind)) return calcContent(language)[kind].name;
  return copy[kind as WebsiteCopyKey] || kind;
}
const markdownText = (value: unknown) => String(value ?? '').replace(/([\\`*_[\]<>])/g, '\\$1').replace(/\s*\n\s*/g, ' ').trim();
const llmLink = (title: string, url: string, note?: string) => `- [${markdownText(title)}](${url})${note ? ': ' + markdownText(note) : ''}`;

/** Drops interactive chrome and private-looking controls and makes every link absolute. */
function cleanTree(root: Root, mainOnly: boolean, canonical: string) {
  const omit = new Set(['script','style','svg','nav','aside','button','select','textarea']);
  const omitClasses = new Set(['site-breadcrumb','site-toc','site-language-links','site-article-meta','site-sr','site-content-sr','site-language-strip','site-download-card']);
  function filter(node: Root | Element) {
    const children: Array<RootContent | ElementContent> = [];
    for (const child of node.children) {
      if (child.type === 'comment' || child.type === 'doctype') continue;
      if (child.type === 'element') {
        const classes = child.properties.className as string[] | undefined;
        if (omit.has(child.tagName) || child.tagName === 'input' && child.properties.type !== 'checkbox' || classes?.some(name => omitClasses.has(name)) ||
          child.properties.ariaHidden === 'true' || child.properties.role === 'status') continue;
        if (mainOnly && child.tagName === 'h1') continue;
        if (mainOnly && child.tagName === 'img' && !child.properties.alt) continue;
        if (child.tagName === 'label') child.tagName = 'p';
        if (child.tagName === 'summary') child.tagName = 'h3';
        if (child.tagName === 'a' && !child.children.length && typeof child.properties.ariaLabel === 'string') child.children = [{type:'text',value:child.properties.ariaLabel}];
        for (const key of ['href','src']) {
          if (typeof child.properties[key] !== 'string') continue;
          const value = child.properties[key] as string;
          try {
            const url = new URL(value, canonical);
            if (url.hostname === 'gcp.anacan.az' && url.pathname.startsWith('/storage/v1/')) url.hostname = 'api.anacan.az';
            if (['https:','http:','mailto:','tel:'].includes(url.protocol)) child.properties[key] = url.href;
            else delete child.properties[key];
          } catch { delete child.properties[key]; }
        }
        filter(child);
      }
      children.push(child);
    }
    node.children = children as typeof node.children;
  }
  if (mainOnly) {
    let main: Element | undefined;
    function find(node: Root | Element) {
      for (const child of node.children) if (child.type === 'element') {
        if (child.tagName === 'main') { main = child; return; }
        if (!main) find(child);
      }
    }
    find(root);
    if (!main) throw new Error('LLM_PUBLIC_MAIN_REQUIRED');
    root.children = main.children;
  }
  filter(root);
}
const converter = unified().use(rehypeParse,{fragment:true}).use(rehypeRemark).use(remarkGfm)
  .use(remarkStringify,{bullet:'-',fences:true,listItemIndent:'one',resourceLink:true,emphasis:'*',strong:'*'});
function htmlToLlmMarkdown(html: string, mainOnly = false, canonical = WEBSITE_ORIGIN): string {
  const tree = converter.parse(html);
  cleanTree(tree, mainOnly, canonical);
  return converter.stringify(converter.runSync(tree)).trim() + '\n';
}

/** One clean Markdown document for a page or article (`…/index.md`). */
export function renderLlmDocument(boot: WebsiteBoot): string {
  const language = boot.route.language, labels = LLM_COPY[language], copy = {...boot.copy, ...boot.details} as WebsiteCopy, meta = websiteMeta(boot);
  const article = boot.article, canonical = WEBSITE_ORIGIN + routePath(boot.route);
  const title = article?.title || meta.title;
  const lines = [
    `# ${markdownText(title)}`, '', `> ${markdownText(meta.description)}`, '',
    `- ${labels.languageLabel}: ${llmLanguageName(language)} (${language})`,
    llmLink(labels.canonicalLabel, canonical),
    llmLink(labels.markdownLabel, WEBSITE_ORIGIN + markdownPath(boot.route)),
  ];
  if (article) {
    lines.push(`- ${copy.published}: ${article.publishedAt.slice(0,10)}`, `- ${copy.updated}: ${article.updatedAt.slice(0,10)}`,
      `- ${article.author === 'Anacan' ? copy.author : markdownText(article.author)}`, '', htmlToLlmMarkdown(article.content || '', false, canonical));
    if (article.faq.length) {
      lines.push(`## ${copy.faq}`, '');
      for (const faq of article.faq) lines.push(`### ${markdownText(faq.question)}`, '', markdownText(faq.answer), '');
    }
    if (article.references.length) {
      lines.push(`## ${copy.references}`, '', ...article.references.map(reference => llmLink(reference.title, reference.url)), '');
    }
    if (article.modules.length) lines.push(`## ${copy.modules}`, '', ...article.modules.map(module => llmLink(copy[module as WebsiteCopyKey] || module,
      `https://app.anacan.az/?blog_module=${encodeURIComponent(module)}&blog_language=${language}`)), '');
  } else {
    const body = renderToString(createElement(Website, {boot:{...boot, articles:[]}}));
    lines.push('', htmlToLlmMarkdown(body, true, canonical).replace(/^# [^\n]+\n+/u, ''));
    if (boot.route.kind === 'simulator') {
      for (let number = 1; number <= 5; number++) {
        lines.push(`## ${markdownText(copy[`test${number}Question` as WebsiteCopyKey])}`, '',
          ...[1,2,3].map(option => `- ${markdownText(copy[`test${number}Option${option}` as WebsiteCopyKey])}`), '',
          markdownText(copy[`test${number}Explanation` as WebsiteCopyKey]), '');
      }
    }
  }
  lines.push(`## ${labels.appHeading}`, '', markdownText(copy.faq1Answer), '',
    llmLink(copy.download, WEBSITE_ORIGIN + sitePath(language, 'download')),
    llmLink('App Store — iPhone', APP_STORE_URL), llmLink('Google Play — Android', GOOGLE_PLAY_URL), '',
    markdownText(copy.faq2Answer), '', labels.sourceNote, '');
  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n';
}

/** `/<lang>/llms.txt`: the per-locale index of every page and article. */
export function renderLlmIndex(data: WebsiteCatalog, copy: WebsiteCopy, details?: DetailCopy): string {
  const language = data.language, labels = LLM_COPY[language];
  const pages = LLM_PAGE_KINDS.filter(kind => !['tools','ovulation','dueDate',...CALC_PAGES,'symptoms','simulator','contact','privacy','terms','faq','journal'].includes(kind));
  const section = (title: string, kinds: LlmPageKind[]) => [`## ${title}`, '', ...kinds.map(kind => llmLink(
    llmPageLabel(language, kind, copy, details), WEBSITE_ORIGIN + markdownPath({language, kind}),
    websiteMeta({schema:'anacan-website-boot-v1', route:{language, kind}, copy, details, articles:[], generatedAt:data.generatedAt, basePath:''}).description,
  )), ''];
  return [
    `# ${labels.indexTitle}`, '', `> ${labels.indexDescription}`, '',
    `${labels.languageLabel}: ${llmLanguageName(language)} (${language}).`, '', labels.sourceNote, '', labels.scopeNote, '',
    `## ${labels.appHeading}`, '',
    llmLink('App Store — iPhone', APP_STORE_URL, copy.appStore),
    llmLink('Google Play — Android', GOOGLE_PLAY_URL, copy.googlePlay),
    llmLink(copy.download, WEBSITE_ORIGIN + markdownPath({language, kind:'download'}), copy.downloadDescription), '',
    `## ${labels.formatsHeading}`, '',
    llmLink(labels.fullLabel, WEBSITE_ORIGIN + llmFullPath(language)),
    llmLink(labels.manifestLabel, WEBSITE_ORIGIN + '/llms-manifest.json'),
    llmLink(labels.sitemapLabel, WEBSITE_ORIGIN + localeSitemapPath(language)), '',
    ...section(labels.documentsHeading, pages),
    ...section(copy.tools, ['tools','ovulation','dueDate',...CALC_PAGES,'symptoms','simulator']),
    `## ${copy.allArticles}`, '',
    llmLink(copy.journal, WEBSITE_ORIGIN + markdownPath({language, kind:'journal'}), copy.journalDescription),
    ...data.articles.map(article => llmLink(article.title, WEBSITE_ORIGIN + markdownPath({language, kind:'article', slug:article.slug}), article.excerpt)), '',
    ...section(copy.generalSupport, ['faq','contact','privacy','terms']),
  ].join('\n') + '\n';
}

/** Root `/llms.txt`: English hub that points to every locale index. */
export function renderLlmHub(): string {
  return [
    '# Anacan', '',
    '> Anacan is a menstrual-cycle, pregnancy, and baby-care app for iPhone and Android, with a public website in 21 languages.', '',
    'Official product: Anacan: Flow, Pregnancy & Baby. App Store ID: 6758301924. Google Play package: com.atlasoon.anacan.', '',
    'Use the index for the requested language, then read its clean Markdown documents. Cite the canonical HTML page, article date, and references. Public content only; current subscription pricing and eligibility are shown in the official stores.', '',
    '## Official app and stores', '',
    llmLink('App Store — iPhone', APP_STORE_URL),
    llmLink('Google Play — Android', GOOGLE_PLAY_URL),
    llmLink('Anacan app', WEBSITE_ORIGIN + markdownPath({language:'en', kind:'features'})), '',
    '## Complete content and discovery', '',
    llmLink('Complete public content in all 21 languages', WEBSITE_ORIGIN + '/llms-full.txt'),
    llmLink('Machine-readable content manifest', WEBSITE_ORIGIN + '/llms-manifest.json'),
    llmLink('Multilingual sitemap index', WEBSITE_ORIGIN + '/sitemap.xml'), '',
    '## Language indexes', '',
    ...WEBSITE_LANGUAGES.map(({code, native_name}) => llmLink(`${native_name} (${code})`, WEBSITE_ORIGIN + llmIndexPath(code), LLM_COPY[code].indexDescription)), '',
    '## Language-specific complete content', '',
    ...WEBSITE_LANGUAGES.map(({code, native_name}) => llmLink(native_name, WEBSITE_ORIGIN + llmFullPath(code), LLM_COPY[code].fullTitle)), '',
  ].join('\n') + '\n';
}

/** Header of `/<lang>/llms-full.txt`, or of the global `/llms-full.txt` without a language. */
export function renderLlmFullHeader(language?: WebsiteLanguageCode): string {
  if (language) {
    const labels = LLM_COPY[language];
    return `# ${labels.fullTitle}\n\n> ${labels.indexDescription}\n\n${labels.languageLabel}: ${llmLanguageName(language)} (${language}).\n\n${labels.sourceNote}\n\n${labels.scopeNote}\n\n`;
  }
  return '# Anacan — complete multilingual public content\n\n> Official Anacan app and website content in all 21 languages. Each language section contains full pages and published articles, with canonical source URLs, dates, FAQs, and references.\n\nApp Store: ' + APP_STORE_URL + '\nGoogle Play: ' + GOOGLE_PLAY_URL + '\n\n';
}

/** `/llms-manifest.json`: every public document with its translations. */
export function renderLlmManifest(catalogs: WebsiteCatalog[], copies: Partial<Record<WebsiteLanguageCode, WebsiteCopy>>, detailCopies: Partial<Record<WebsiteLanguageCode, DetailCopy>>) {
  const documents: Array<Record<string, unknown>> = [];
  const translations: Record<string, Partial<Record<WebsiteLanguageCode, number>>> = {};
  const add = (key: string, language: WebsiteLanguageCode, document: Record<string, unknown>) => {
    (translations[key] ||= {})[language] = documents.length;
    documents.push({...document, translationKey:key});
  };
  for (const catalog of catalogs) {
    const language = catalog.language, copy = copies[language]!, details = detailCopies[language];
    for (const kind of LLM_PAGE_KINDS) {
      add('page:' + kind, language, {language, kind, title:llmPageLabel(language, kind, copy, details),
        url:WEBSITE_ORIGIN + sitePath(language, kind), markdownUrl:WEBSITE_ORIGIN + markdownPath({language, kind})});
    }
    for (const article of catalog.articles) {
      add('article:' + article.id, language, {language, kind:'article', title:article.title, description:article.excerpt,
        url:WEBSITE_ORIGIN + sitePath(language, 'article', article.slug), markdownUrl:WEBSITE_ORIGIN + markdownPath({language, kind:'article', slug:article.slug}),
        publishedAt:article.publishedAt, modifiedAt:article.updatedAt});
    }
  }
  return {
    schema:LLM_FORMAT_VERSION, origin:WEBSITE_ORIGIN, contentScope:'public-website-only', formats:['text/html','text/markdown'],
    app:{name:'Anacan', storeName:'Anacan: Flow, Pregnancy & Baby',
      appStore:{url:APP_STORE_URL, id:'6758301924', platform:'iOS'},
      googlePlay:{url:GOOGLE_PLAY_URL, package:'com.atlasoon.anacan', platform:'Android'}},
    indexUrl:WEBSITE_ORIGIN + '/llms.txt', fullContentUrl:WEBSITE_ORIGIN + '/llms-full.txt', sitemapUrl:WEBSITE_ORIGIN + '/sitemap.xml',
    languages:WEBSITE_LANGUAGES.map(({code, native_name, locale}) => ({code, name:native_name, locale, direction:code === 'ar' ? 'rtl' : 'ltr',
      indexUrl:WEBSITE_ORIGIN + llmIndexPath(code), fullContentUrl:WEBSITE_ORIGIN + llmFullPath(code), sitemapUrl:WEBSITE_ORIGIN + localeSitemapPath(code),
      articleCount:catalogs.find(catalog => catalog.language === code)?.articles.length || 0})),
    documentCount:documents.length, translations, documents,
  };
}

/** Markdown twin of a journal page; page 1 lists every article. */
export function renderLlmJournal(data: WebsiteCatalog, copy: WebsiteCopy, page = 1): string {
  const selected = page > 1 ? data.articles.slice((page - 1) * 12, page * 12) : data.articles;
  return `# ${markdownText(copy.journalTitle)}\n\n> ${markdownText(copy.journalDescription)}\n\n${llmLink(LLM_COPY[data.language].canonicalLabel, WEBSITE_ORIGIN + sitePath(data.language, 'journal', undefined, page))}\n\n${selected.map(article => llmLink(article.title, WEBSITE_ORIGIN + markdownPath({language:data.language, kind:'article', slug:article.slug}), article.excerpt)).join('\n')}\n`;
}
