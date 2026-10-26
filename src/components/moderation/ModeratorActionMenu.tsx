import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { moderatorText } from '@/lib/moderator-i18n';
import type { ModeratorAction, ModeratorTarget } from '@/lib/moderator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ModeratorActionDialog from './ModeratorActionDialog';

export default function ModeratorActionMenu({ target, onDone, onOpenChange }: { target: ModeratorTarget; onDone?: () => void; onOpenChange?: (open: boolean) => void }) {
  const { isModerator, isAdmin } = useAuth(), language = useUserStore(state => state.language);
  const [action, setAction] = useState<ModeratorAction | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { onOpenChange?.(menuOpen || !!action); }, [menuOpen, action, onOpenChange]);
  if (!isModerator && !isAdmin) return null;
  const actions: ModeratorAction[] = target.kind === 'user' ? [] : target.removed ? ['restore'] : [
    ...(target.kind !== 'story' ? ['edit', target.isPinned ? 'unpin' : 'pin'] as ModeratorAction[] : []),
    ...(target.kind === 'post' ? [target.commentsLocked ? 'unlock_comments' : 'lock_comments'] as ModeratorAction[] : []), 'remove',
  ];
  return <>
    <DropdownMenu onOpenChange={setMenuOpen}><DropdownMenuTrigger asChild><button type="button" aria-label={moderatorText('moderate', language)} className="inline-flex min-w-11 min-h-11 items-center justify-center rounded-full text-primary hover:bg-primary/10"><ShieldCheck size={17} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[330] max-w-[calc(100vw_-_24px)]">
        {actions.map(value => <DropdownMenuItem className="min-h-11 whitespace-normal" key={value} onSelect={() => setAction(value)}>{moderatorText(value, language)}</DropdownMenuItem>)}
        {!!actions.length && <DropdownMenuSeparator />}
        {(['warn', 'restrict'] as const).map(value => <DropdownMenuItem key={value} className="min-h-11 whitespace-normal" onSelect={() => setAction(value)}>{moderatorText(value, language)}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {action && <ModeratorActionDialog target={target} action={action} onClose={() => setAction(null)} onDone={onDone} />}
  </>;
}
