import { tr } from "@/lib/tr";import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { useAuth } from './useAuth';

export interface BlogComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  likes_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_avatar?: string;
  user_badge?: string;
  is_liked?: boolean;
  replies?: BlogComment[];
}

export const useBlogInteractions = (postId?: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch like/save status and comments
  const fetchInteractions = useCallback(async () => {
    if (!postId) return;

    try {
      // Fetch post stats
      const { data: post } = await supabase.
      from('blog_posts').
      select('likes_count, saves_count, comments_count').
      eq('id', postId).
      single();

      if (post) {
        setLikesCount(post.likes_count || 0);
        setCommentsCount(post.comments_count || 0);
      }

      // Check if user liked/saved
      if (user) {
        const [likeResult, saveResult] = await Promise.all([
        supabase.
        from('blog_post_likes').
        select('id').
        eq('post_id', postId).
        eq('user_id', user.id).
        maybeSingle(),
        supabase.
        from('blog_post_saves').
        select('id').
        eq('post_id', postId).
        eq('user_id', user.id).
        maybeSingle()]
        );

        setIsLiked(!!likeResult.data);
        setIsSaved(!!saveResult.data);
      }
    } catch (error) {
      console.error('Error fetching interactions:', error);
    } finally {
      setLoading(false);
    }
  }, [postId, user]);

  const fetchComments = useCallback(async () => {
    if (!postId) return;

    try {
      const commentsData = await fetchAllRows((from, to) =>
        supabase.
        from('blog_comments').
        select('*').
        eq('post_id', postId).
        eq('is_active', true).
        order('created_at', { ascending: true }).
        range(from, to)
      );

      // Fetch user profiles for comments
      const userIds = [...new Set((commentsData || []).map((c) => c.user_id))];

      const profiles = userIds.length > 0 ?
      await fetchAllRows((from, to) =>
      supabase.
      from('public_profile_cards').
      select('user_id, name, avatar_url, badge_type').
      in('user_id', userIds).
      range(from, to)
      ) :
      [];

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      // Check which comments user liked
      let likedCommentIds: string[] = [];
      const commentIds = (commentsData || []).map((c) => c.id);
      if (user && commentIds.length > 0) {
        const likes = await fetchAllRows((from, to) =>
        supabase.
        from('blog_comment_likes').
        select('comment_id').
        eq('user_id', user.id).
        in('comment_id', commentIds).
        range(from, to)
        );

        likedCommentIds = (likes || []).map((l) => l.comment_id);
      }

      // Map and organize comments
      const enrichedComments = (commentsData || []).map((c) => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          user_name: profile?.name || tr("usebloginteractions_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
          user_avatar: profile?.avatar_url || null,
          user_badge: profile?.badge_type || null,
          is_liked: likedCommentIds.includes(c.id),
          replies: [] as BlogComment[]
        };
      });

      // Organize into parent-reply structure
      const parentComments = enrichedComments.filter((c) => !c.parent_comment_id);
      const replies = enrichedComments.filter((c) => c.parent_comment_id);

      replies.forEach((reply) => {
        const parent = parentComments.find((p) => p.id === reply.parent_comment_id);
        if (parent) {
          parent.replies.push(reply);
        }
      });

      setComments(parentComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [postId, user]);

  // Like/unlike post
  const toggleLike = async () => {
    if (!user || !postId) return;

    try {
      if (isLiked) {
        await supabase.
        from('blog_post_likes').
        delete().
        eq('post_id', postId).
        eq('user_id', user.id);
        setIsLiked(false);
        setLikesCount((prev) => prev - 1);
      } else {
        await supabase.
        from('blog_post_likes').
        insert({ post_id: postId, user_id: user.id });
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Save/unsave post
  const toggleSave = async () => {
    if (!user || !postId) return;

    try {
      if (isSaved) {
        await supabase.
        from('blog_post_saves').
        delete().
        eq('post_id', postId).
        eq('user_id', user.id);
        setIsSaved(false);
      } else {
        await supabase.
        from('blog_post_saves').
        insert({ post_id: postId, user_id: user.id });
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  // Add comment
  const addComment = async (content: string, parentCommentId?: string) => {
    if (!user || !postId || !content.trim()) return { error: 'Invalid input' };

    try {
      const { data, error } = await supabase.
      from('blog_comments').
      insert({
        post_id: postId,
        user_id: user.id,
        content: content.trim(),
        parent_comment_id: parentCommentId || null
      }).
      select().
      single();

      if (error) throw error;

      await fetchComments();
      setCommentsCount((prev) => prev + 1);
      return { data, error: null };
    } catch (error) {
      console.error('Error adding comment:', error);
      return { data: null, error };
    }
  };

  // Like/unlike comment
  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;

    try {
      const comment = comments.find((c) => c.id === commentId) ||
      comments.flatMap((c) => c.replies || []).find((r) => r.id === commentId);

      if (!comment) return;

      if (comment.is_liked) {
        await supabase.
        from('blog_comment_likes').
        delete().
        eq('comment_id', commentId).
        eq('user_id', user.id);
      } else {
        await supabase.
        from('blog_comment_likes').
        insert({ comment_id: commentId, user_id: user.id });
      }

      await fetchComments();
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      await supabase.
      from('blog_comments').
      update({ is_active: false }).
      eq('id', commentId).
      eq('user_id', user.id);

      await fetchComments();
      setCommentsCount((prev) => prev - 1);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  useEffect(() => {
    fetchInteractions();
    fetchComments();
  }, [fetchInteractions, fetchComments]);

  return {
    isLiked,
    isSaved,
    likesCount,
    comments,
    commentsCount,
    loading,
    toggleLike,
    toggleSave,
    addComment,
    toggleCommentLike,
    deleteComment,
    refetch: () => {
      fetchInteractions();
      fetchComments();
    }
  };
};

// Hook for saved posts
export const useSavedPosts = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedPosts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchAllRows((from, to) =>
      supabase.
      from('blog_post_saves').
      select('post_id').
      eq('user_id', user.id).
      range(from, to)
      );
      setSavedPosts((data || []).map((d) => d.post_id));
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  return { savedPosts, loading, refetch: fetchSavedPosts };
};