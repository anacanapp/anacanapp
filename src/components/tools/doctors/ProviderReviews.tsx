import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, Trash2, User, MessageSquare } from 'lucide-react';
import { useProviderReviews } from '@/hooks/useProviderReviews';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";

interface ProviderReviewsProps {
  providerId: string;
  providerName: string;
}

const ProviderReviews = ({ providerId, providerName }: ProviderReviewsProps) => {
  const { reviews, userReview, isLoading, submitReview, deleteReview, isAuthenticated } = useProviderReviews(providerId);
  const [rating, setRating] = useState(userReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(userReview?.comment || '');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) return;
    submitReview.mutate({ rating, comment });
    setIsExpanded(false);
  };

  const handleDelete = () => {
    deleteReview.mutate();
    setRating(0);
    setComment('');
  };

  // Update local state when userReview changes
  if (userReview && rating === 0 && !isExpanded) {
    setRating(userReview.rating);
    setComment(userReview.comment || '');
  }

  return (
    <div className="a-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
          <h2 className="a-card-title a-heading" style={{ margin: 0 }}>{tr("providerreviews_reyler_8be233", "R\u0259yl\u0259r (")}{reviews.length})</h2>
        </div>
        {isAuthenticated && !isExpanded &&
        <button
          onClick={() => setIsExpanded(true)}
          className="a-btn-soft"
          style={{ height: 32, padding: '0 12px', fontSize: 11 }}>
          
            {userReview ? tr("providerreviews_reyi_redakte_et_12797e", "R\u0259yi redakt\u0259 et") : tr("providerreviews_rey_yaz_7b3aab", "R\u0259y yaz")}
          </button>
        }
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {isExpanded && isAuthenticated &&
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 pb-4"
          style={{ borderBottom: '1px solid var(--a-line)' }}>
          
            <p className="a-list-sub mb-3" style={{ margin: '0 0 12px', whiteSpace: 'normal' }}>
              {providerName} {tr("providerreviews_haqqinda_reyinizi_yazin_049e5e", "haqq\u0131nda r\u0259yinizi yaz\u0131n")}
            </p>
            
            {/* Star Rating */}
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) =>
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              
                  <Star
                className={`w-7 h-7 transition-colors ${star <= (hoverRating || rating) ? 'fill-current' : ''}`}
                style={{ color: star <= (hoverRating || rating) ? 'var(--a-yellow-2)' : 'var(--a-line-strong)' }} />
              
                </button>
            )}
              <span className="ms-2 text-sm" style={{ color: 'var(--a-ink-soft)' }}>
                {rating > 0 ? `${rating}/5` : tr("providerreviews_qiymetlendirin_df8e66", "Qiym\u0259tl\u0259ndirin")}
              </span>
            </div>

            {/* Comment */}
            <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={tr("providerreviews_tecrubenizi_bolusun_isteye_bagli_3f9da1", "Təcrübənizi bölüşün (istəyə bağlı)...")}
            className="a-input w-full resize-none"
            style={{ height: 96, fontFamily: 'inherit' }} />
          

            {/* Actions */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <button
                className="a-btn-soft"
                style={{ height: 34, padding: '0 12px', fontSize: 11 }}
                onClick={() => {
                  setIsExpanded(false);
                  setRating(userReview?.rating || 0);
                  setComment(userReview?.comment || '');
                }}>
                  {tr("providerreviews_legv_et_b5e49c", "L\u0259\u011Fv et")}
                
              </button>
                {userReview &&
              <button
                onClick={handleDelete}
                className="a-btn-soft"
                style={{ height: 34, padding: '0 12px', fontSize: 11, background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                
                    <Trash2 size={13} strokeWidth={2.2} />{tr("untranslated_sil_zwa7lz", "Sil")}</button>
              }
              </div>
              <button
              className="a-cta-btn"
              style={{ height: 36, padding: '0 16px', fontSize: 11.5, opacity: rating === 0 || submitReview.isPending ? 0.5 : 1 }}
              onClick={handleSubmit}
              disabled={rating === 0 || submitReview.isPending}>
              
                <Send size={13} strokeWidth={2.2} />
                {userReview ? tr("providerreviews_yenile_570ce2", "Yenil\u0259") : tr("providerreviews_gonder_3f11bd", "G\xF6nd\u0259r")}
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Not authenticated message */}
      {!isAuthenticated &&
      <div className="text-center py-4 mb-4 rounded-2xl" style={{ background: 'var(--a-surface-soft)' }}>
          <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
            {tr("providerreviews_rey_yazmaq_ucun_hesabiniza_dax_d75d40", "R\u0259y yazmaq \xFC\xE7\xFCn hesab\u0131n\u0131za daxil olun")}
          </p>
        </div>
      }

      {/* Reviews List */}
      {isLoading ?
      <div className="space-y-3">
          {[1, 2].map((i) =>
        <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full" style={{ background: 'var(--a-surface-soft)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded" style={{ background: 'var(--a-surface-soft)' }} />
                  <div className="h-3 w-full rounded" style={{ background: 'var(--a-surface-soft)' }} />
                </div>
              </div>
            </div>
        )}
        </div> :
      reviews.length === 0 ?
      <div className="text-center py-6">
          <Star className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
          <p className="a-list-sub" style={{ margin: 0 }}>{tr("providerreviews_hele_hec_bir_rey_yoxdur_410969", "Hələ heç bir rəy yoxdur")}</p>
          <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink-faint)' }}>{tr("providerreviews_ilk_reyi_siz_yazin_cc6119", "İlk rəyi siz yazın!")}</p>
        </div> :

      <div className="space-y-4">
          {reviews.map((review, index) =>
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.05, 0.3) }}
          className="flex gap-3">
          
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'var(--a-peach-1)' }}>
                {review.user_avatar ?
            <img loading="lazy" decoding="async" src={review.user_avatar} alt="" className="w-full h-full object-cover" /> :

            <User className="w-5 h-5" style={{ color: 'var(--a-accent-ink)' }} />
            }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="a-list-title" style={{ margin: 0 }}>{review.user_name}</span>
                  <span className="a-list-time" style={{ margin: 0 }}>
                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: getCurrentDateLocale() })}
                  </span>
                </div>
                
                {/* Stars */}
                <div className="flex items-center gap-0.5 my-1">
                  {[1, 2, 3, 4, 5].map((star) =>
              <Star
                key={star}
                className={`w-3 h-3 ${star <= review.rating ? 'fill-current' : ''}`}
                style={{ color: star <= review.rating ? 'var(--a-yellow-2)' : 'var(--a-line-strong)' }} />

              )}
                </div>

                {review.comment &&
            <p className="text-sm mt-1" style={{ margin: '4px 0 0', color: 'var(--a-body-text)' }}>{review.comment}</p>
            }
              </div>
            </motion.div>
        )}
        </div>
      }
    </div>);

};

export default ProviderReviews;
