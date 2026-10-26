import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, HelpCircle, Mail, Phone,
  ChevronRight, Send, CheckCircle, Clock, AlertCircle, Plus, Loader2 } from
'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { useSupportTicketReplies } from '@/hooks/useSupportTicketReplies';
import { useFaqs, useSupportCategories } from '@/hooks/useDynamicTools';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

interface HelpScreenProps {
  onBack: () => void;
}

const inputStyle: React.CSSProperties = { background: 'var(--a-surface)', borderColor: 'var(--a-line-strong)', color: 'var(--a-ink)' };

const HelpScreen = ({ onBack }: HelpScreenProps) => {
  useScrollToTop();
  const isRtl = useIsRtl();

  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', category: 'general' });
  const [replyMessage, setReplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { tickets, loading, createTicket, refetch } = useSupportTickets();
  const { replies, loading: repliesLoading, addReply } = useSupportTicketReplies(selectedTicket?.id || null);
  const { data: faqs, isLoading: faqsLoading } = useFaqs();
  const { data: supportCategories, isLoading: categoriesLoading } = useSupportCategories();
  const { toast } = useToast();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [replies]);

  const ticketCategories = supportCategories?.map((cat) => ({
    id: cat.category_key,
    label: cat.name,
    emoji: cat.emoji
  })) || [
  { id: 'general', label: tr("helpscreen_umumi_sual_e1c5ee", 'Ümumi sual'), emoji: '❓' }];


  const getStatusIcon = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':return <AlertCircle className="w-4 h-4" style={{ color: 'var(--a-yellow-ink)' }} />;
      case 'in_progress':return <Clock className="w-4 h-4" style={{ color: 'var(--a-blue-ink)' }} />;
      case 'resolved':return <CheckCircle className="w-4 h-4" style={{ color: 'var(--a-green-ink)' }} />;
      case 'closed':return <CheckCircle className="w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />;
    }
  };

  const getStatusText = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':return tr("helpscreen_aciq_306cc4", "A\xE7\u0131q");
      case 'in_progress':return tr("helpscreen_i_slenir_65a15d", "\u0130\u015Fl\u0259nir");
      case 'resolved':return tr("helpscreen_hell_edildi_beceb9", "H\u0259ll edildi");
      case 'closed':return tr("helpscreen_bagli_713069", "Ba\u011Fl\u0131");
    }
  };

  const handleSubmitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast({
        title: tr("helpscreen_xeta_3cdbb6", 'Xəta'),
        description: tr("helpscreen_movzu_ve_mesaj_daxil_edin_b27c43", 'Mövzu və mesaj daxil edin'),
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    const result = await createTicket({
      subject: newTicket.subject,
      message: newTicket.message,
      category: newTicket.category
    });

    setSubmitting(false);

    if (result.error) {
      toast({
        title: tr("helpscreen_xeta_3cdbb6", 'Xəta'),
        description: tr("helpscreen_muraciet_gonderile_bilmedi_2fc6c2", 'Müraciət göndərilə bilmədi'),
        variant: 'destructive'
      });
    } else {
      toast({
        title: tr("helpscreen_ugurlu_5c0191", 'Uğurlu!'),
        description: tr("helpscreen_muracietiniz_gonderildi_2337db", 'Müraciətiniz göndərildi')
      });
      setNewTicket({ subject: '', message: '', category: 'general' });
      setShowNewTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    setSubmitting(true);
    const result = await addReply(replyMessage.trim(), false);
    setSubmitting(false);

    if (!result.error) {
      setReplyMessage('');
    } else {
      toast({
        title: tr("helpscreen_xeta_3cdbb6", 'Xəta'),
        description: tr("helpscreen_mesaj_gonderile_bilmedi_0cd095", 'Mesaj göndərilə bilmədi'),
        variant: 'destructive'
      });
    }
  };

  // Ticket Chat View
  if (selectedTicket) {
    const canReply = selectedTicket.status !== 'closed';

    return (
      <div className="a-scope min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        {/* Header */}
        <div className="shrink-0 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--a-line)' }}>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => {
                setSelectedTicket(null);
                refetch();
              }}
              className="a-icon-btn shrink-0"
              whileTap={{ scale: 0.95 }}
              aria-label={tr("common_geri", "Geri")}>

              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="line-clamp-1" style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-ink)' }}>{selectedTicket.subject}</h1>
              <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>
                {getStatusIcon(selectedTicket.status)}
                <span>{getStatusText(selectedTicket.status)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Initial message */}
          <div className="flex justify-end">
            <div className="a-chat-bubble user max-w-[80%]">
              <p style={{ margin: 0 }}>{selectedTicket.message}</p>
              <p className="text-end" style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                {format(new Date(selectedTicket.created_at), 'd MMM, HH:mm', { locale: getCurrentDateLocale() })}
              </p>
            </div>
          </div>

          {/* Admin response (legacy) */}
          {selectedTicket.admin_response &&
          <div className="flex justify-start">
              <div className="a-chat-bubble ai max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-peach-1)' }}>
                    <span style={{ fontSize: 10 }}>👩‍⚕️</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--a-accent-ink)' }}>{tr("helpscreen_destek_73b142", "Dəstək")}</span>
                </div>
                <p style={{ margin: 0 }}>{selectedTicket.admin_response}</p>
                {selectedTicket.responded_at &&
              <p style={{ fontSize: 10, color: 'var(--a-ink-faint)', marginTop: 4 }}>
                    {format(new Date(selectedTicket.responded_at), 'd MMM, HH:mm', { locale: getCurrentDateLocale() })}
                  </p>
              }
              </div>
            </div>
          }

          {/* Chat replies */}
          {repliesLoading ?
          <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--a-peach-2)' }} />
            </div> :

          replies.map((reply) =>
          <div key={reply.id} className={`flex ${reply.is_admin ? 'justify-start' : 'justify-end'}`}>
                <div className={`a-chat-bubble ${reply.is_admin ? 'ai' : 'user'} max-w-[80%]`}>
                  {reply.is_admin &&
              <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-peach-1)' }}>
                        <span style={{ fontSize: 10 }}>👩‍⚕️</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--a-accent-ink)' }}>{tr("helpscreen_destek_73b142", "Dəstək")}</span>
                    </div>
              }
                  <p style={{ margin: 0 }}>{reply.message}</p>
                  <p className={reply.is_admin ? '' : 'text-end'} style={{ fontSize: 10, opacity: reply.is_admin ? 1 : 0.6, color: reply.is_admin ? 'var(--a-ink-faint)' : undefined, marginTop: 4 }}>
                    {format(new Date(reply.created_at), 'd MMMM, HH:mm', { locale: getCurrentDateLocale() })}
                  </p>
                </div>
              </div>
          )
          }

          <div ref={messagesEndRef} />
        </div>

        {/* Reply Input */}
        {canReply ?
        <div className="p-4 safe-bottom" style={{ borderTop: '1px solid var(--a-line)' }}>
            <div className="flex gap-2 items-end">
              <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder={tr("helpscreen_mesajinizi_yazin_21d48f", "Mesajınızı yazın...")}
              rows={1}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-2xl"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }} />

              <motion.button
              onClick={handleSendReply}
              disabled={submitting || !replyMessage.trim()}
              className="a-chat-send"
              style={{ width: 44, height: 44 }}
              whileTap={{ scale: 0.92 }}
              aria-label={tr("helpscreen_gonder_3f11bd", "G\xF6nd\u0259r")}>

                {submitting ?
              <Loader2 className="w-4 h-4 animate-spin" /> :

              <Send size={16} />
              }
              </motion.button>
            </div>
          </div> :

        <div className="p-4 safe-bottom" style={{ borderTop: '1px solid var(--a-line)', background: 'var(--a-disclaimer-bg)' }}>
            <p className="text-center" style={{ fontSize: 12.5, color: 'var(--a-disclaimer-ink)' }}>
              {tr("helpscreen_bu_muraciet_baglanib_yeni_mura_a27374", "Bu m\xFCraci\u0259t ba\u011Flan\u0131b. Yeni m\xFCraci\u0259t g\xF6nd\u0259r\u0259 bil\u0259rsiniz.")}
            </p>
          </div>
        }
      </div>);

  }

  return (
    <div className="a-scope min-h-screen pb-28 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr("helpscreen_suallariniza_cavab_tapin_764218", "Suallarınıza cavab tapın")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("helpscreen_yardim_merkezi_0987ed", "Yardım Mərkəzi")}</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="a-tabs" style={{ marginBottom: 14 }}>
          {[
          { id: 'faq', label: 'SSS' },
          { id: 'contact', label: tr("helpscreen_elaqe_07e6a8", 'Əlaqə') },
          { id: 'tickets', label: tr("helpscreen_muracietler_215f40", 'Müraciətlər') }].
          map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`a-tab ${activeTab === tab.id ? 'active' : ''}`}>

              {tab.label}
            </button>
          )}
        </div>

        <div className="space-y-3.5">
          <AnimatePresence mode="wait">
            {/* FAQ Tab */}
            {activeTab === 'faq' &&
            <motion.div
              key="faq"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}>

                <div className="a-card">
                  <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 12 }}>
                    <HelpCircle size={16} style={{ color: 'var(--a-accent-ink)' }} />
                    {tr("helpscreen_tez_tez_sorusulan_suallar_cf692e", "Tez-tez Soru\u015Fulan Suallar")}
                  </h3>

                  {faqsLoading ?
                <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--a-peach-2)' }} />
                    </div> :

                <Accordion type="single" collapsible className="space-y-2">
                      {(faqs || []).map((faq, index) =>
                  <AccordionItem key={faq.id} value={`item-${index}`} className="border-none">
                          <AccordionTrigger className="text-start text-sm font-medium hover:no-underline py-3 px-3 rounded-xl data-[state=open]:bg-[var(--a-peach-1)] data-[state=open]:text-[var(--a-accent-ink)]"
                    style={{ color: 'var(--a-ink)' }}>
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm px-3 pb-3 pt-2" style={{ color: 'var(--a-ink-soft)' }}>
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                  )}
                    </Accordion>
                  }
                </div>
              </motion.div>
            }

            {/* Contact Tab */}
            {activeTab === 'contact' &&
            <motion.div
              key="contact"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}
              className="space-y-3.5">

                <div className="a-card">
                  <h3 className="a-card-title" style={{ marginBottom: 14 }}>{tr("helpscreen_bizimle_elaqe_ebc559", "Bizimlə Əlaqə")}</h3>

                  <motion.a
                  href="mailto:info@anacan.az"
                  className="flex items-center gap-4 mb-2.5 transition-colors"
                  style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}
                  whileTap={{ scale: 0.98 }}>

                    <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-peach-1)' }}>
                      <Mail size={19} style={{ color: 'var(--a-accent-ink)' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("helpscreen_e_poct_f5c193", "E-poçt")}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--a-accent-ink)', fontWeight: 600 }}>info@anacan.az</p>
                    </div>
                    <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
                  </motion.a>

                  <motion.a
                  href="tel:+994103216507"
                  className="flex items-center gap-4 transition-colors"
                  style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}
                  whileTap={{ scale: 0.98 }}>

                    <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-green-1)' }}>
                      <Phone size={19} style={{ color: 'var(--a-green-ink)' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("untranslated_telefon_vwjgg5", "Telefon")}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--a-green-ink)', fontWeight: 600 }}>+994 10 321 65 07</p>
                    </div>
                    <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
                  </motion.a>
                </div>

                <div className="a-card">
                  <h3 className="a-card-title" style={{ marginBottom: 6 }}>{tr("helpscreen_is_saatlari_cfa6fe", "İş saatları")}</h3>
                  <p style={{ fontSize: 13, color: 'var(--a-ink-soft)', marginBottom: 14 }}>
                    {tr("helpscreen_bazar_ertesi_cume_09_00_18_00_bb0b17", "Bazar ert\u0259si - C\xFCm\u0259: 09:00 - 18:00")}
                  </p>
                  <div style={{ padding: 12, borderRadius: 14, background: 'var(--a-peach-1)' }}>
                    <p style={{ fontSize: 12.5, color: 'var(--a-accent-ink)' }}>
                      {tr("helpscreen_suretli_cavab_ucun_muracietler_630f46", "\uD83D\uDCA1 S\xFCr\u0259tli cavab \xFC\xE7\xFCn \"M\xFCraci\u0259tl\u0259r\" b\xF6lm\u0259sind\u0259n bilet g\xF6nd\u0259rin")}
                    </p>
                  </div>
                </div>
              </motion.div>
            }

            {/* Tickets Tab */}
            {activeTab === 'tickets' &&
            <motion.div
              key="tickets"
              initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(20, isRtl) }}
              className="space-y-3.5">

                {/* New Ticket Button/Form */}
                {!showNewTicket ?
              <motion.button
                onClick={() => setShowNewTicket(true)}
                className="w-full flex items-center justify-center gap-2 text-white"
                style={{ background: 'var(--a-peach-2)', borderRadius: 999, padding: '15px 16px', fontSize: 14, fontWeight: 700, boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)' }}
                whileTap={{ scale: 0.98 }}>

                    <Plus className="w-5 h-5" />
                    {tr("helpscreen_yeni_muraciet_gonder_45ce1f", "Yeni m\xFCraci\u0259t g\xF6nd\u0259r")}
                  </motion.button> :

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="a-card">

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="a-card-title">{tr("helpscreen_yeni_muraciet_f62908", "Yeni Müraciət")}</h3>
                      <button
                    onClick={() => setShowNewTicket(false)}
                    style={{ fontSize: 13, color: 'var(--a-ink-soft)', fontWeight: 600 }}>
                        {tr("helpscreen_legv_et_b5e49c", "L\u0259\u011Fv et")}

                  </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block mb-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("untranslated_kateqoriya_d7bf4y", "Kateqoriya")}</label>
                        <div className="flex flex-wrap gap-2">
                          {ticketCategories.map((cat) =>
                      <button
                        key={cat.id}
                        onClick={() => setNewTicket({ ...newTicket, category: cat.id })}
                        className="transition-all"
                        style={{
                          padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                          background: newTicket.category === cat.id ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
                          color: newTicket.category === cat.id ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)',
                          border: newTicket.category === cat.id ? '1.5px solid var(--a-peach-2)' : '1.5px solid transparent'
                        }}>

                              {cat.label}
                            </button>
                      )}
                        </div>
                      </div>

                      <div>
                        <label className="block mb-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("helpscreen_movzu_5ac952", "Mövzu")}</label>
                        <Input
                      className="h-11 rounded-xl"
                      style={inputStyle}
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      placeholder={tr("helpscreen_muracietinizin_movzusu_d111c4", "Müraciətinizin mövzusu")} />

                      </div>

                      <div>
                        <label className="block mb-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("untranslated_mesaj_3c09op", "Mesaj")}</label>
                        <Textarea
                      className="rounded-xl"
                      style={inputStyle}
                      value={newTicket.message}
                      onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                      placeholder={tr("helpscreen_probleminizi_etrafli_tesvir_edin_2c4a86", "Probleminizi ətraflı təsvir edin...")}
                      rows={4} />

                      </div>

                      <motion.button
                    onClick={handleSubmitTicket}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 text-white disabled:opacity-50"
                    style={{ background: 'var(--a-peach-2)', borderRadius: 999, padding: '13px 16px', fontSize: 13.5, fontWeight: 700 }}
                    whileTap={{ scale: 0.98 }}>

                        {submitting ?
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

                    <>
                            <Send className="w-4 h-4" />
                            {tr("helpscreen_gonder_3f11bd", "G\xF6nd\u0259r")}
                          </>
                    }
                      </motion.button>
                    </div>
                  </motion.div>
              }

                {/* Existing Tickets */}
                <div className="a-card">
                  <h3 className="a-card-title" style={{ marginBottom: 12 }}>{tr("helpscreen_muracietleriniz_45af5e", "Müraciətləriniz")}</h3>

                  {loading ?
                <div className="flex justify-center py-8">
                      <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
                    </div> :
                tickets.length === 0 ?
                <div className="text-center py-8">
                      <div className="text-4xl mb-2">📩</div>
                      <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{tr("helpscreen_hele_muraciet_yoxdur_6f37de", "Hələ müraciət yoxdur")}</p>
                    </div> :

                <div className="space-y-2.5">
                      {tickets.map((ticket) =>
                  <motion.button
                    key={ticket.id}
                    className="w-full text-start transition-colors"
                    style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}
                    onClick={() => setSelectedTicket(ticket)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileTap={{ scale: 0.98 }}>

                          <div className="flex items-start justify-between mb-1.5">
                            <h4 className="flex-1 line-clamp-1" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{ticket.subject}</h4>
                            <div className="flex items-center gap-1 ms-2" style={{ fontSize: 11 }}>
                              {getStatusIcon(ticket.status)}
                              <span style={{ color: 'var(--a-ink-soft)' }}>{getStatusText(ticket.status)}</span>
                            </div>
                          </div>
                          <p className="line-clamp-1 mb-2" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>{ticket.message}</p>
                          <div className="flex items-center justify-between">
                            <p style={{ fontSize: 11, color: 'var(--a-ink-faint)' }}>
                              {format(new Date(ticket.created_at), 'd MMM yyyy', { locale: getCurrentDateLocale() })}
                            </p>
                            <ChevronRight className="rtl:rotate-180" size={15} style={{ color: 'var(--a-ink-faint)' }} />
                          </div>
                        </motion.button>
                  )}
                    </div>
                }
                </div>
              </motion.div>
            }
          </AnimatePresence>

          {/* App Version */}
          <div className="text-center pt-4">
            <p style={{ fontSize: 11, color: 'var(--a-ink-faint)', marginTop: 4 }}>{tr("helpscreen_2025_anacan_butun_huquqlar_qorunur_c35c11", "© 2025 Anacan. Bütün hüquqlar qorunur.")}</p>
          </div>
        </div>
      </div>
    </div>);

};

export default HelpScreen;
