import { tr } from "@/lib/tr";import { useEffect, useRef, useState, ReactNode } from 'react';
import { usePostSeenFlag, usePostUnreadFlag, markPostSeenDirect } from '@/hooks/useUnreadCommunityPosts';
import { useAuth } from '@/hooks/useAuth';

// PERF: feed-dəki bütün postlar üçün TƏK paylaşılan IntersectionObserver
// (əvvəllər hər post öz observer-ini yaradırdı). Element → callback WeakMap.
type SeenCallback = (entry: IntersectionObserverEntry) => void;
const seenCallbacks = new WeakMap<Element, SeenCallback>();
let sharedSeenObserver: IntersectionObserver | null = null;

function observeSeen(element: Element, callback: SeenCallback): () => void {
  if (!sharedSeenObserver) {
    sharedSeenObserver = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => seenCallbacks.get(entry.target)?.(entry)); },
      { threshold: [0, 0.5, 1] }
    );
  }
  const observer = sharedSeenObserver;
  seenCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    if (seenCallbacks.get(element) === callback) seenCallbacks.delete(element);
    observer.unobserve(element);
  };
}

interface PostSeenObserverProps {
  postId: string;
  createdAt: string;
  postUserId?: string;
  children: ReactNode;
}

/**
 * Wraps a community post and marks it as "seen" when at least 50% of it
 * has been visible in the viewport for ~600ms. Also renders a small red
 * unread-dot in the top-right corner if the post is newer than the user's
 * last-seen timestamp; the dot disappears synchronously when marked seen.
 *
 * PERF: yalnız ÖZ postunun seen/unread bayraqlarına abunədir (boolean
 * selektorlar) — əvvəllər bütün seenPostIds xəritəsinə abunə olduğundan hər
 * işarələnən post feed-dəki bütün observer-ləri re-render edirdi.
 */
const PostSeenObserver = ({ postId, createdAt, postUserId, children }: PostSeenObserverProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const seenInStore = usePostSeenFlag(postId);
  const unreadInStore = usePostUnreadFlag(user?.id, postId, createdAt, postUserId);
  const [marked, setMarked] = useState(false);

  const isOwnPost = !!postUserId && postUserId === user?.id;
  const effectivelyMarked = marked || seenInStore;
  const isUnread = !isOwnPost && !effectivelyMarked && unreadInStore;

  const userId = user?.id;

  useEffect(() => {
    if (!ref.current || effectivelyMarked || !userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = observeSeen(ref.current, (entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (timer) return;
        timer = setTimeout(() => {
          setMarked(true);
          markPostSeenDirect(userId, postId, createdAt, postUserId);
          stop();
        }, 600);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [postId, createdAt, postUserId, userId, effectivelyMarked]);

  return (
    <div ref={ref} className="relative">
      {isUnread &&
      <span
        aria-label={tr("postseenobserver_oxunmamis_post_42ef5b", "Oxunmam\u0131\u015F post")}
        className="absolute top-3 end-3 z-20 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-background shadow-sm animate-pulse" />

      }
      {children}
    </div>);

};

export default PostSeenObserver;
