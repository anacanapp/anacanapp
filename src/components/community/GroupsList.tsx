import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Users, ChevronRight, UserPlus, UserMinus, Check } from 'lucide-react';
import { CommunityGroup, useJoinGroup, useLeaveGroup } from '@/hooks/useCommunity';
import { Skeleton } from '@/components/ui/skeleton';

interface GroupsListProps {
  groups: CommunityGroup[];
  memberGroupIds: Set<string>;
  onSelectGroup: (groupId: string) => void;
  searchQuery: string;
  isLoading: boolean;
}

const GROUP_TYPE_LABELS: Record<string, string> = {
  birth_month: tr("groupslist_dogum_ayi_638e88", "\uD83C\uDF7C Do\u011Fum Ay\u0131"),
  pregnancy_month: tr("groupslist_hamilelik_ayi_bdb0a4", "\uD83E\uDD30 Hamil\u0259lik Ay\u0131"),
  baby_gender: tr("groupslist_usaq_cinsi_df0c40", "\uD83D\uDC76 U\u015Faq Cinsi"),
  multiples: tr("groupslist_ekizler_ucuzler_371a92", "\uD83D\uDC76\uD83D\uDC76 \u018Fkizl\u0259r/\xDC\xE7\xFCzl\u0259r"),
  general: tr("groupslist_umumi_92b103", "\uD83D\uDCAC \xDCmumi")
};

const GroupsList = ({ groups, memberGroupIds, onSelectGroup, searchQuery, isLoading }: GroupsListProps) => {
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((i) =>
        <Skeleton key={i} className="h-[72px] rounded-2xl" />
        )}
      </div>);

  }

  const filteredGroups = groups.filter((g) =>
  g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedByType = filteredGroups.reduce((acc, group) => {
    const type = group.group_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(group);
    return acc;
  }, {} as Record<string, CommunityGroup[]>);

  return (
    <div className="space-y-5">
      {Object.entries(groupedByType).map(([type, typeGroups]) =>
      <div key={type}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div className="w-1 h-4 rounded-full bg-primary/40" />
            <h3 className="text-[11px] font-extrabold text-muted-foreground/50 uppercase tracking-[0.08em]">
              {GROUP_TYPE_LABELS[type] || type}
            </h3>
          </div>
          <div className="space-y-2">
            {typeGroups.map((group, index) => {
            const isMember = memberGroupIds.has(group.id);
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => isMember ? onSelectGroup(group.id) : undefined}
                className={`bg-card rounded-2xl border border-border/8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-200 ${
                isMember ? 'cursor-pointer active:scale-[0.99]' : ''}`
                }>
                
                
                  <div className="p-3.5 flex items-center gap-3.5">
                    <div className="w-12 h-12 min-w-12 rounded-2xl bg-gradient-to-br from-primary/8 to-accent/5 flex items-center justify-center">
                      <span className="text-xl leading-none">{group.icon_emoji || '👥'}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-[14px] leading-tight line-clamp-1">{tr(`group_name_${group.name.replace(/\s+/g, '_').toLowerCase()}`, group.name)}</h4>
                      {group.description &&
                    <p className="text-[11px] text-muted-foreground/45 mt-0.5 line-clamp-1 font-medium">{tr(`group_desc_${group.name.replace(/\s+/g, '_').toLowerCase()}`, group.description)}</p>
                    }
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex -space-x-1.5">
                          {[0, 1, 2].map((i) =>
                        <div key={i} className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/15 border border-card" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/35 font-semibold">{group.member_count} {tr("groupslist_uzv_3f0dbc", "\xFCzv")}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isMember ?
                    <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/8 text-primary text-[10px] font-bold">
                            <Check className="w-3 h-3" /> {tr("groupslist_uzv_6aa4f8", "\xDCzv")}
                          </span>
                          <ChevronRight className="rtl:rotate-180 w-4 h-4 text-muted-foreground/20" />
                        </div> :

                    <motion.button
                      onClick={(e) => {e.stopPropagation();joinGroup.mutate(group.id);}}
                      disabled={joinGroup.isPending}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-[11px] font-bold shadow-sm shadow-primary/20"
                      whileTap={{ scale: 0.92 }}>
                      
                          <UserPlus className="w-3 h-3" /> {tr("groupslist_qosul_ed89ce", "Qo\u015Ful")}
                        </motion.button>
                    }
                    </div>
                  </div>

                  {isMember &&
                <div className="flex justify-end px-3.5 pb-2.5">
                      <button
                    onClick={(e) => {e.stopPropagation();leaveGroup.mutate(group.id);}}
                    disabled={leaveGroup.isPending}
                    className="text-[9px] text-muted-foreground/25 hover:text-destructive transition-colors flex items-center gap-0.5 font-semibold">
                    
                        <UserMinus className="w-2.5 h-2.5" /> {tr("groupslist_ayril_c052d1", "Ayr\u0131l")}
                      </button>
                    </div>
                }
                </motion.div>);

          })}
          </div>
        </div>
      )}

      {filteredGroups.length === 0 &&
      <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted/15 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-muted-foreground/20" />
          </div>
          <p className="text-muted-foreground/35 text-[13px] font-bold">{tr("groupslist_qrup_tapilmadi_78fc7d", "Qrup tapılmadı")}</p>
        </div>
      }
    </div>);

};

export default GroupsList;