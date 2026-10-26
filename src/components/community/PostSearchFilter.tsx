import { motion } from 'framer-motion';
import { tr } from "@/lib/tr";
import type { CommunityFeedView } from '@/hooks/useCommunitySocial';

export type FeedTab = Exclude<CommunityFeedView, 'profile'>;

interface PostSearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: FeedTab;
  onSortChange: (sort: FeedTab) => void;
}

const PostSearchFilter = ({ sortBy, onSortChange }: PostSearchFilterProps) => {
  return (
    <div className="community-feed-tabs hide-scrollbar" role="tablist" aria-label={tr('community_feed_filters', 'Paylaşım bölmələri')}>
      {[
        { id: 'recent' as const, label: tr("postsearchfilter_en_son_473654", 'Ən son') },
        { id: 'popular' as const, label: tr("postsearchfilter_populyar", 'Populyar') },
        { id: 'mine' as const, label: tr('community_my_posts', 'Mənim postlarım') },
        { id: 'following' as const, label: tr('community_following', 'İzlədiklərim') },
        { id: 'saved' as const, label: tr('community_saved', 'Saxlanmışlar') },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={sortBy === option.id}
          onClick={() => onSortChange(option.id)}
          className={`a-tab${sortBy === option.id ? ' active' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default PostSearchFilter;
