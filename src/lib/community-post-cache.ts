import type { QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query';
import type { CommunityPost } from '@/hooks/useCommunity';

export function communityPostFilter(userId: string | null, includeLegacyProfiles = false): QueryFilters {
  return { predicate: ({ queryKey }) => {
    const root = queryKey[0];
    if (root === 'community-feed') return queryKey[1] === userId;
    if (root === 'group-posts' || root === 'single-post') return queryKey[2] === userId;
    // Compatibility with the previous profile feed while cached versions expire.
    return includeLegacyProfiles && root === 'user-posts';
  } };
}

export function mapCommunityPostCache(data: any, postId: string, update: (post: CommunityPost) => CommunityPost): any {
  const map = (posts: CommunityPost[]) => posts.map((post) => post.id === postId ? update(post) : post);
  if (Array.isArray(data)) return map(data);
  if (Array.isArray(data?.pages)) return { ...data, pages: data.pages.map((page: any) => ({ ...page, posts: map(page.posts) })) };
  if (data?.id === postId) return update(data);
  return data;
}

export function patchCommunityPost(client: QueryClient, userId: string | null, postId: string, update: (post: CommunityPost) => CommunityPost, includeLegacyProfiles = false) {
  client.setQueriesData(communityPostFilter(userId, includeLegacyProfiles), (data) => mapCommunityPostCache(data, postId, update));
}

export async function invalidateCommunityPosts(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ predicate: ({ queryKey }) => ['community-feed', 'group-posts', 'user-posts', 'single-post'].includes(String(queryKey[0])) }),
    client.invalidateQueries({ queryKey: ['community-profile-stats'] }),
    client.invalidateQueries({ queryKey: ['community-ad-mine'] }),
  ]);
}

export function restoreCommunityPostFields(
  client: QueryClient, snapshots: [QueryKey, unknown][], postId: string, fields: (keyof CommunityPost)[],
) {
  for (const [key, previous] of snapshots) {
    let before: CommunityPost | undefined;
    mapCommunityPostCache(previous, postId, (post) => { before = post; return post; });
    if (!before) continue;
    const restored = Object.fromEntries(fields.map((field) => [field, before![field]]));
    client.setQueryData(key, (current) => mapCommunityPostCache(current, postId, (post) => ({ ...post, ...restored })));
  }
}
