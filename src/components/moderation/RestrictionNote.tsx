import { ShieldAlert } from 'lucide-react';
import { useMyModerationStatus } from '@/hooks/useModerator';
import { useUserStore } from '@/store/userStore';
import { moderatorText } from '@/lib/moderator-i18n';
import type { ModeratorScope } from '@/lib/moderator';
export default function RestrictionNote({ scope }: { scope: ModeratorScope }) {
  const { data } = useMyModerationStatus(), language = useUserStore(state => state.language);
  if (!data?.[scope]) return null;
  const key = scope === 'full' ? 'full_restricted' : scope === 'community' ? 'community_restricted' : `${scope}_restricted` as const;
  return <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm leading-relaxed"><ShieldAlert size={18} className="shrink-0 mt-0.5" /><span>{moderatorText(key, language)}</span></div>;
}
