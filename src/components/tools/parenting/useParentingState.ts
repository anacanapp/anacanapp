import { useCallback, useEffect, useRef, useState } from 'react';
import { readParenting, writeParenting, type ParentingLocal } from '@/lib/parenting';

/** Device-only Tərbiyə state (programme progress, quiz results, bookmarks, chosen age band) per account. */
export function useParentingState(uid: string | null) {
  const [state, setState] = useState<ParentingLocal>(() => readParenting(uid));
  const ref = useRef(state);

  useEffect(() => { const s = readParenting(uid); ref.current = s; setState(s); }, [uid]);

  const update = useCallback((fn: (s: ParentingLocal) => ParentingLocal) => {
    const next = fn(ref.current);
    ref.current = next;
    writeParenting(uid, next);
    setState(next);
  }, [uid]);

  return { state, update };
}
