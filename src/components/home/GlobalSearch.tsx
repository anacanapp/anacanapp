import { useDeferredValue, useMemo, useState } from 'react';
import { BookOpen, Search, Sparkles, ChevronRight } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { rd } from '@/lib/redesign-i18n';
import { useToolConfigs } from '@/hooks/useDynamicTools';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useBlog } from '@/hooks/useBlog';
import { OPEN_BLOG_EVENT } from '@/lib/blog-links';
import { setAiDraft } from '@/lib/ai-draft';
import { toolIcon, toolTone } from '@/lib/tool-icons';
import { useUserStore } from '@/store/userStore';

const fold = (v: string) => v.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** App-wide search: tools for the current stage, published articles and a hand-off to Anacan.AI. */
type SearchProps = {
  open: boolean;
  onClose: () => void;
  onOpenTool: (toolId: string) => void;
  onAskAI: () => void;
  /** Extra result groups (e.g. Aptek products) rendered for the current query. */
  extra?: (query: string, close: () => void) => React.ReactNode;
};

export function GlobalSearch(props: SearchProps) {
  // Body mounts only while open, so tool/blog queries don't run in the background.
  return (
    <Sheet open={props.open} onClose={props.onClose} title={rd('search')}>
      <SearchBody {...props} />
    </Sheet>);
}

function SearchBody({ onClose, onOpenTool, onAskAI, extra }: SearchProps) {
  const lifeStage = useUserStore((s) => s.lifeStage);
  const [query, setQuery] = useState('');
  const q = fold(useDeferredValue(query).trim());
  const { data: configs = [] } = useToolConfigs(lifeStage || undefined);
  const { isToolDisabled } = useDisabledTools();
  const { posts } = useBlog();

  const tools = useMemo(() => configs
    .filter((c) => !isToolDisabled(c.tool_id) && (!q || fold(`${c.name} ${c.description || ''}`).includes(q)))
    .slice(0, q ? 8 : 6), [configs, isToolDisabled, q]);
  const articles = useMemo(() => (q ? posts.filter((p) => fold(`${p.title} ${p.excerpt || ''}`).includes(q)) : posts).slice(0, 5), [posts, q]);

  const close = () => { setQuery(''); onClose(); };
  const ask = () => { if (query.trim()) setAiDraft(query.trim()); close(); onAskAI(); };

  return (
    <>
      <form className="a3-search" role="search" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <Search size={18} aria-hidden="true" />
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={rd('search_placeholder')}
          aria-label={rd('search')} enterKeyHint="search" autoFocus />
      </form>

      {query.trim() &&
      <button type="button" className="a3-card a3-pad a3-li" onClick={ask} style={{ border: 0, flexDirection: 'row', width: '100%' }}>
          <span className="a3-ico-sq c-coral"><Sparkles size={18} /></span>
          <span className="grow" style={{ textAlign: 'start' }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{rd('search_ask_ai')}</span>
            <span className="a3-meta">“{query.trim()}”</span>
          </span>
          <ChevronRight size={18} className="rtl:rotate-180" />
        </button>
      }

      {tools.length > 0 &&
      <section className="a3-sec">
          <h3 className="a3-eyebrow">{rd('tools_title')}</h3>
          <div className="a3-card" style={{ paddingBlock: 4 }}>
            <div className="a3-list">
              {tools.map((t) => {
              const Icon = toolIcon(t.icon);
              return (
                <button key={t.tool_id} type="button" className="a3-li" onClick={() => { close(); onOpenTool(t.tool_id); }}>
                    <span className={`a3-ico-sq sm ${toolTone(t.tool_id)}`}><Icon size={16} /></span>
                    <span className="grow" style={{ textAlign: 'start', fontWeight: 600 }}>{t.name}</span>
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </button>);
            })}
            </div>
          </div>
        </section>
      }

      {extra?.(q, close)}

      {articles.length > 0 &&
      <section className="a3-sec">
          <h3 className="a3-eyebrow">{rd('articles_title')}</h3>
          <div className="a3-card" style={{ paddingBlock: 4 }}>
            <div className="a3-list">
              {articles.map((p) =>
            <button key={p.id} type="button" className="a3-li" onClick={() => { close(); window.dispatchEvent(new CustomEvent(OPEN_BLOG_EVENT, { detail: { slug: p.slug } })); }}>
                  <span className="a3-ico-sq sm c-lav"><BookOpen size={16} /></span>
                  <span className="grow" style={{ textAlign: 'start', minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                    <span className="a3-meta">{rd('read_min', { n: p.reading_time || 5 })}</span>
                  </span>
                </button>
            )}
            </div>
          </div>
        </section>
      }

      {q && !tools.length && !articles.length && <p className="a3-empty">{rd('search_empty')}</p>}
    </>);
}
