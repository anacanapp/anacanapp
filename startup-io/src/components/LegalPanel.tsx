import { legalCopy } from '../legal';
import type { Language } from '../i18n';

export function LegalPanel({ type, language }: { type: 'privacy' | 'terms' | 'support'; language: Language }) {
  return <div className="legal-panel">{legalCopy(language, type).map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}<a href="mailto:jamil@anacan.az">jamil@anacan.az</a></div>;
}
