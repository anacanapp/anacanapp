import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NameVote {
  id: string;
  user_id: string;
  partner_user_id: string | null;
  name: string;
  gender: string;
  meaning: string | null;
  origin: string | null;
  vote: 'like' | 'dislike' | 'superlike';
  created_at: string;
}

export interface MatchedName {
  name: string;
  gender: string;
  meaning: string | null;
  origin: string | null;
  myVote: 'like' | 'superlike';
  partnerVote: 'like' | 'superlike';
  isSuperMatch: boolean;
}

export const useNameVoting = () => {
  const { user, profile } = useAuth();
  const [myVotes, setMyVotes] = useState<NameVote[]>([]);
  const [partnerVotes, setPartnerVotes] = useState<NameVote[]>([]);
  const [loading, setLoading] = useState(true);

  const getPartnerUserId = useCallback(async (): Promise<string | null> => {
    if (!profile?.linked_partner_id) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profile.linked_partner_id)
        .single();

      if (error || !data) return null;
      return data.user_id;
    } catch {
      return null;
    }
  }, [profile?.linked_partner_id]);

  const fetchVotes = async () => {
    if (!user) return;

    try {
      // Fetch my votes
      const { data: myData, error: myError } = await supabase
        .from('name_votes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (myError) throw myError;
      setMyVotes((myData || []) as NameVote[]);

      // Fetch partner votes if linked
      const partnerUserId = await getPartnerUserId();
      if (partnerUserId) {
        const { data: partnerData, error: partnerError } = await supabase
          .from('name_votes')
          .select('*')
          .eq('user_id', partnerUserId)
          .order('created_at', { ascending: false });

        if (!partnerError) {
          setPartnerVotes((partnerData || []) as NameVote[]);
        }
      }
    } catch (error) {
      console.error('Error fetching name votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (
    name: string,
    gender: string,
    voteType: 'like' | 'dislike' | 'superlike',
    meaning?: string,
    origin?: string
  ) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const partnerUserId = await getPartnerUserId();

      const { data, error } = await supabase
        .from('name_votes')
        .upsert({
          user_id: user.id,
          partner_user_id: partnerUserId,
          name,
          gender,
          meaning: meaning || null,
          origin: origin || null,
          vote: voteType,
        }, {
          onConflict: 'user_id,name'
        })
        .select()
        .single();

      if (error) throw error;

      await fetchVotes();
      return { data, error: null };
    } catch (error) {
      console.error('Error voting on name:', error);
      return { data: null, error };
    }
  };

  const removeVote = async (name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('name_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('name', name);

      if (error) throw error;
      await fetchVotes();
    } catch (error) {
      console.error('Error removing vote:', error);
    }
  };

  const getMatchedNames = (): MatchedName[] => {
    const matches: MatchedName[] = [];

    myVotes.forEach(myVote => {
      if (myVote.vote === 'dislike') return;

      const partnerVote = partnerVotes.find(
        pv => pv.name === myVote.name && pv.vote !== 'dislike'
      );

      if (partnerVote) {
        matches.push({
          name: myVote.name,
          gender: myVote.gender,
          meaning: myVote.meaning,
          origin: myVote.origin,
          myVote: myVote.vote as 'like' | 'superlike',
          partnerVote: partnerVote.vote as 'like' | 'superlike',
          isSuperMatch: myVote.vote === 'superlike' && partnerVote.vote === 'superlike',
        });
      }
    });

    // Sort: super matches first
    return matches.sort((a, b) => (b.isSuperMatch ? 1 : 0) - (a.isSuperMatch ? 1 : 0));
  };

  const hasVoted = (name: string) => {
    return myVotes.some(v => v.name === name);
  };

  const getMyVote = (name: string) => {
    return myVotes.find(v => v.name === name)?.vote || null;
  };

  // Set up realtime subscription — yalnız mənim öz səslərim + (linkli olsa)
  // partnyorumun səslərinə filtrlənir, cədvəldəki bütün istifadəçilərə yox.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await fetchVotes();
      const partnerUserId = await getPartnerUserId();
      if (cancelled) return;

      let ch = supabase
        .channel(`name_votes_changes:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'name_votes', filter: `user_id=eq.${user.id}` },
          () => {
            fetchVotes();
          }
        );
      if (partnerUserId) {
        ch = ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'name_votes', filter: `user_id=eq.${partnerUserId}` },
          () => {
            fetchVotes();
          }
        );
      }
      channel = ch.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, profile?.linked_partner_id, getPartnerUserId]);

  return {
    myVotes,
    partnerVotes,
    loading,
    vote,
    removeVote,
    getMatchedNames,
    hasVoted,
    getMyVote,
    likedNames: myVotes.filter(v => v.vote !== 'dislike'),
    matchCount: getMatchedNames().length,
    refetch: fetchVotes,
  };
};
