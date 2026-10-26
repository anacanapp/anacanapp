import { useState, useEffect } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { tr, mapRowTranslation } from '@/lib/tr';
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import { ArrowLeft, FileText, Shield, Scale, AlertTriangle, CreditCard, Database, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserStore } from '@/store/userStore';
import { useLegalDocuments, LegalDocument } from '@/hooks/useLegalDocuments';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import MarkdownContent from '@/components/MarkdownContent';
import HtmlContent from '@/components/ui/HtmlContent';

interface LegalScreenProps {
  onBack: () => void;
  initialDocument?: string;
}

const documentIcons: Record<string, any> = {
  terms_of_service: FileText,
  privacy_policy: Shield,
  gdpr_ccpa: Scale,
  disclaimer: AlertTriangle,
  refund_policy: CreditCard,
  data_usage: Database
};

// Palitra tint-ləri sənəd növünə görə
const documentTints: Record<string, {bg: string;ink: string;}> = {
  terms_of_service: { bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)' },
  privacy_policy: { bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  gdpr_ccpa: { bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  disclaimer: { bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' },
  refund_policy: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  data_usage: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const documentOrder = [
'terms_of_service',
'privacy_policy',
'gdpr_ccpa',
'disclaimer',
'refund_policy',
'data_usage'];


const LegalScreen = ({ onBack, initialDocument }: LegalScreenProps) => {
  useScrollToTop();

  const { data: documents = [], isLoading } = useLegalDocuments();
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const language = useUserStore((state) => state.language);
  const isEn = language === 'en';

  // 6 dil: az→az, en→en/base, ru→ru||en, tr→tr||en, kk→kk||ru||en, de→de||en (fallback az)
  const pickTitle = (d: any): string => {
    if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return mapRowTranslation(d, language, ['title'])?.title || '';
    if (language === 'az') return d.title_az || d.title;
    if (language === 'ru') return d.title_ru || d.title_en || d.title || d.title_az;
    if (language === 'tr') return d.title_tr || d.title_en || d.title || d.title_az;
    if (language === 'kk') return d.title_kk || d.title_ru || d.title_en || d.title || d.title_az;
    if (language === 'uz') return d.title_uz || d.title_ru || d.title_en || d.title || d.title_az;
    if (language === 'ka') return d.title_ka || d.title_ru || d.title_en || d.title || d.title_az;
    if (language === 'de') return d.title_de || d.title_en || d.title || d.title_az;
    if (language === 'ar') return d.title_ar || d.title_en || d.title || d.title_az;
    return d.title_en || d.title || d.title_az;
  };
  const pickContent = (d: any): string => {
    if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return mapRowTranslation(d, language, ['content'])?.content || '';
    if (language === 'az') return d.content_az || d.content;
    if (language === 'ru') return d.content_ru || d.content_en || d.content || d.content_az;
    if (language === 'tr') return d.content_tr || d.content_en || d.content || d.content_az;
    if (language === 'kk') return d.content_kk || d.content_ru || d.content_en || d.content || d.content_az;
    if (language === 'uz') return d.content_uz || d.content_ru || d.content_en || d.content || d.content_az;
    if (language === 'ka') return d.content_ka || d.content_ru || d.content_en || d.content || d.content_az;
    if (language === 'de') return d.content_de || d.content_en || d.content || d.content_az;
    if (language === 'ar') return d.content_ar || d.content_en || d.content || d.content_az;
    return d.content_en || d.content || d.content_az;
  };

  useEffect(() => {
    if (initialDocument && documents.length > 0 && !selectedDoc) {
      const doc = documents.find((d) => d.document_type === initialDocument);
      if (doc) setSelectedDoc(doc);
    }
  }, [initialDocument, documents]);

  const sortedDocuments = [...documents].sort((a, b) => {
    const indexA = documentOrder.indexOf(a.document_type);
    const indexB = documentOrder.indexOf(b.document_type);
    return indexA - indexB;
  });

  if (selectedDoc) {
    return (
    <div className="a-scope flex flex-col h-full overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <div className="flex items-center gap-3 p-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
          <motion.button onClick={() => setSelectedDoc(null)} className="a-icon-btn shrink-0" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <h1 className="truncate" style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-ink)' }}>{pickTitle(selectedDoc)}</h1>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-4" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
              Versiya: {selectedDoc.version} {tr("legalscreen_son_yenilenme_8a61f0", "| Son yenil\u0259nm\u0259:")} {new Date(selectedDoc.updated_at).toLocaleDateString(getLocaleTag())}
            </div>
            <div className="a-card prose prose-xs dark:prose-invert max-w-none text-sm [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm" style={{ color: 'var(--a-body-text)' }}>
              {(() => {
                const c = pickContent(selectedDoc);
                const isHtml = c.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(c);
                return isHtml ? <HtmlContent content={c} /> : <MarkdownContent content={c} />;
              })()}
            </div>
          </div>
        </ScrollArea>
      </div>);

  }

  return (
    <div className="a-scope flex flex-col h-full overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="flex items-center gap-3 p-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
        <motion.button onClick={onBack} className="a-icon-btn shrink-0" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </motion.button>
        <h1 style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-ink)' }}>{tr("legalscreen_huquqi_senedler_ca8c60", "Hüquqi Sənədlər")}</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2.5">
          {isLoading ?
          <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
            </div> :

          sortedDocuments.map((doc) => {
            const Icon = documentIcons[doc.document_type] || FileText;
            const tint = documentTints[doc.document_type] || documentTints.terms_of_service;
            return (
              <motion.button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="w-full flex items-center gap-4 text-start transition-colors"
                style={{ padding: 14, borderRadius: 'var(--a-radius-md)', background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)' }}
                whileTap={{ scale: 0.98 }}>

                  <div className="flex items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 14, background: tint.bg }}>
                    <Icon size={18} style={{ color: tint.ink }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{pickTitle(doc)}</h3>
                    <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>
                      Versiya {doc.version}
                    </p>
                  </div>
                  <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
                </motion.button>);

          })
          }
        </div>
      </ScrollArea>
    </div>);

};

export default LegalScreen;
