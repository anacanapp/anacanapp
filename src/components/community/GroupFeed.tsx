import { tr } from "@/lib/tr";import { useState, useEffect, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { CommunityGroup } from '@/hooks/useCommunity';
import { useGroupPresence } from '@/hooks/useGroupPresence';
import CommunityPostFeed from './CommunityPostFeed';
import GroupPresenceBar from './GroupPresenceBar';
import StoriesBar from './StoriesBar';
import PostSearchFilter, { type FeedTab } from './PostSearchFilter';
import { Button } from '@/components/ui/button';

interface GroupFeedProps {
  group: CommunityGroup | null;
  onBack: () => void;
  onCreatePost: () => void;
  isEmbedded?: boolean;
  onUserClick?: (userId: string) => void;
  externalSearchQuery?: string;
  view?: FeedTab;
  onViewChange?: (view: FeedTab) => void;
}

const GroupFeed = forwardRef<HTMLDivElement, GroupFeedProps>(({ group, onBack, onCreatePost, isEmbedded = false, onUserClick, externalSearchQuery, view, onViewChange }, ref) => {
  const { onlineCount, onlineUsers, typingUsers } = useGroupPresence(group?.id || null);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const setSearchQuery = setLocalSearchQuery;
  const [localSort, setLocalSort] = useState<FeedTab>('recent');
  const sortBy = view ?? localSort;
  const setSortBy = (next: FeedTab) => { setLocalSort(next); onViewChange?.(next); };
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const feed = <CommunityPostFeed view={sortBy} groupId={group?.id || null} search={debouncedSearch}
    onUserClick={onUserClick} onCreatePost={onCreatePost} onExplore={() => setSortBy('recent')} />;


  if (isEmbedded) {
    return (
      <div ref={ref} className="space-y-3">
        <PostSearchFilter searchQuery={searchQuery} onSearchChange={setSearchQuery} sortBy={sortBy} onSortChange={setSortBy} />
        {feed}
      </div>);

  }

  return (
    <div ref={ref} className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="px-5 py-3">
          <div className="flex items-center gap-3">
            <motion.button onClick={onBack} className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180 w-4 h-4 text-foreground" />
            </motion.button>
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-accent/8 flex items-center justify-center shrink-0">
                <span className="text-lg">{group?.icon_emoji || '👥'}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-[16px] font-black text-foreground truncate leading-tight">{group?.name ? tr(`group_name_${group.name.replace(/\s+/g, '_').toLowerCase()}`, group.name) : tr("groupfeed_umumi_1b5521", "\xDCmumi")}</h1>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-medium">
                  <Users className="w-3 h-3" />
                  <span>{group?.member_count || 0} {tr("groupfeed_uzv_3f0dbc", "\xFCzv")}</span>
                </div>
              </div>
            </div>
            <Button onClick={onCreatePost} className="w-9 h-9 rounded-full gradient-primary p-0 shadow-sm shadow-primary/20">
              <Plus className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        </div>

        {group && <GroupPresenceBar onlineCount={onlineCount} onlineUsers={onlineUsers} typingUsers={typingUsers} />}
        
        {group &&
        <div className="px-5 pb-2.5">
            <StoriesBar groupId={group.id} />
          </div>
        }
      </div>

      <div className="px-4 pt-3 pb-1">
        <PostSearchFilter searchQuery={searchQuery} onSearchChange={setSearchQuery} sortBy={sortBy} onSortChange={setSortBy} />
      </div>

      <div className="pt-1">
        {feed}
      </div>
    </div>);

});

GroupFeed.displayName = 'GroupFeed';

export default GroupFeed;
