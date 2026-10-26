import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { normalizeAppLanguage, APP_LANGUAGES } from '@/lib/app-languages';
import { entryLanguage, legalDocumentType } from './policy.mjs';
import { entryText } from './text';
import './entry.css';

function PublicLegal() {
  const language = normalizeAppLanguage(entryLanguage(window.location.href)), [documents, setDocuments] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<string | null>(() => legalDocumentType(location.pathname)), [error, setError] = useState(false);
  useEffect(() => {
    const config = getBackendConfig(), controller = new AbortController();
    const url = new URL('/rest/v1/legal_documents', config.url); url.searchParams.set('select', '*'); url.searchParams.set('is_active', 'eq.true'); url.searchParams.set('order', 'document_type');
    void fetch(url, { credentials: 'omit', redirect: 'error', signal: controller.signal, headers: { apikey: config.publishableKey, ...(config.publishableKey.startsWith('eyJ') ? { Authorization: `Bearer ${config.publishableKey}` } : {}) } })
      .then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); if (!Array.isArray(data)) throw new Error(); setDocuments(data); }).catch(() => setError(true));
    return () => controller.abort();
  }, []);
  const pick = (row: Record<string, any>, field: string) => row[`${field}_${language}`] || row[`${field}_en`] || row[`${field}_az`] || row[field] || '';
  const document = documents.find(row => row.document_type === selected);
  return <main className="entry-legal" data-public-legal>
    <a href="/">Anacan</a>
    {document ? <>
      <h1>{pick(document, 'title')}</h1><p>{document.version} · {new Intl.DateTimeFormat(APP_LANGUAGES.find(item => item.code === language)!.locale).format(new Date(document.updated_at))}</p>
      {/<[a-z][\s\S]*>/i.test(pick(document, 'content')) ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pick(document, 'content'), { FORBID_TAGS: ['script','style','iframe','form'] }) }} />
        : <ReactMarkdown remarkPlugins={[remarkGfm]}>{pick(document, 'content')}</ReactMarkdown>}
      <button className="entry-link" onClick={() => setSelected(null)}>{entryText('legal', language)}</button>
    </> : <><h1>{entryText('legal', language)}</h1>{error ? <p role="status">{entryText('connectionError', language)}</p>
      : documents.length ? <ul>{documents.map(row => <li key={row.id}><button className="entry-link" onClick={() => setSelected(row.document_type)}>{pick(row, 'title')}</button></li>)}</ul> : <p role="status">…</p>}</>}
  </main>;
}
export function startPublicLegal() {
  document.documentElement.classList.add('anacan-entry'); document.documentElement.lang = entryLanguage(location.href); document.documentElement.dir = entryLanguage(location.href) === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1.0, viewport-fit=cover');
  createRoot(document.getElementById('root')!).render(<PublicLegal />);
}
