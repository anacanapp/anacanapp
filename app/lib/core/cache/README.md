# Query cache: React Query → Dart guide

`app/lib/core/cache/` is a small TanStack Query v5 equivalent on Riverpod, configured like `src/App.tsx`.
Import `package:anacan/core/cache/cache.dart`.

## Defaults (same as the React app)

| Option | Value |
|---|---|
| `staleTime` | 30 s (`QueryDefaults.staleTime`) |
| `gcTime` | 7 days (= persist `maxAge`) |
| `retry` | 3, delay `min(1000·2^n, 30 000)` ms, paused while offline / app in background |
| `refetchOnMount` / `refetchOnWindowFocus` / `refetchOnReconnect` | when stale (`RefetchOn.ifStale`) |
| "window focus" | app resumed (`AppLifecycleListener`), wired by `bindQueryClientLifecycle` |
| `networkMode` | `online`: fetches/mutations wait while connectivity_plus reports offline |
| mutations | `retry: 0` |
| persistence | file `<app support>/query_cache/anacan-rq-cache.json`, buster `anacan-rq-v1` (`…:azure:<handoff>`), written on background or every 2 min, only queries allowed by `persist_policy.dart` |
| logout | `AuthController` calls `queryClient.clear()` + `OfflineCache.clearAllCaches()` (→ `clearPersistedQueryCache`) exactly where `AuthContext.tsx` does |

## Translation table

| React | Dart |
|---|---|
| `useQuery({queryKey, queryFn, enabled, staleTime, refetchInterval})` | `final q = queryProvider<T>((ref) => QueryOptions(queryKey: […], queryFn: (ctx) async => …, enabled: …, staleTime: …, refetchInterval: …));` then `ref.watch(q)` → `QueryResult<T>` |
| hook with arguments (`useIllnessEntries(episodeId)`) | `queryProviderFamily<T, A>((ref, arg) => QueryOptions(...))`, `ref.watch(q(arg))` |
| `const { user } = useAuth()` inside the hook | `ref.watch(authUserProvider)` inside the options builder (a change rebuilds the options like a re-render) |
| `data`, `isLoading`, `isFetching`, `error`, `isError` | same names on `QueryResult` |
| `refetch()` | `ref.read(q.notifier).refetch()` |
| `refetchInterval: (query) => …` | `refetchIntervalFor: (query) => Duration?` |
| `refetchOnWindowFocus: false` / `'always'` | `RefetchOn.never` / `RefetchOn.always` |
| `retry: false` / `retry: 1` | `retry: noRetry` / `retry: retryTimes(1)` |
| `placeholderData: keepPreviousData` | `placeholderData: (previous) => previous` |
| `meta: { persist: false }` | `meta: {'persist': false}` |
| `useQueryClient()` | `ref.read(queryClientProvider)` |
| `queryClient.invalidateQueries({ queryKey: ['x'] })` | `client.invalidateQueries(queryKey: ['x'])` (prefix match, refetches active) |
| `invalidateQueries({ predicate })` | `client.invalidateQueries(predicate: (q) => …)` |
| `queryClient.setQueryData(key, old => …)` | `client.setQueryData<T>(key, (old) => …)` (returning `null` = no-op, like `undefined`) |
| `setQueryData(key, value)` | `client.setQueryDataValue(key, value)` |
| `getQueryData(key)` | `client.getQueryData<T>(key)` |
| `setQueriesData(filters, fn)` | `client.setQueriesData(QueryFilters(...), (old) => …)` |
| `cancelQueries` + `getQueryData` + `setQueryData` in `onMutate`, restore in `onError` | `final snap = await client.optimisticUpdate<T>(key, (old) => …);` … `snap.rollback()` |
| `fetchQuery` / `prefetchQuery` / `ensureQueryData` | same names |
| `removeQueries` / `resetQueries` / `refetchQueries` / `isFetching` | same names |
| `useMutation({ mutationFn, onMutate, onSuccess, onError, onSettled })` | `mutationProvider<TData, TVars, TCtx>((ref) => MutationOptions(...))`, `ref.read(m.notifier).mutate(vars)` / `mutateAsync(vars)`; state via `ref.watch(m)` (`isPending`, `error`, `data`) |
| `useInfiniteQuery({ initialPageParam, getNextPageParam })` | `infiniteQueryProvider<TPage, TParam>((ref) => infiniteQueryOptions(...))`; `ref.read(q.notifier).fetchNextPage()`, `.hasNextPage`; data is `InfiniteData{pages, pageParams}` |
| persisted results typed after restart | add `codec:` (`QueryCodecs.rows`, `.row`, `.maybeRow`, `.model(toJson, fromJson)`, `.models(...)`); without a codec, restored JSON is used only if it already `is T` |

Never call `supabase.removeChannel` yourself for realtime: use `subscribePostgresChanges(ref, client, …)` from
`core/data/realtime.dart` inside the query/provider; it is removed when the provider is disposed.

## Example 1 — `src/hooks/useForceUpdate.ts` (query + polling)

```ts
const { data, isLoading } = useQuery({
  queryKey: ['force-update-config'],
  queryFn: async () => { /* rpc get_public_app_setting('force_update') */ },
  enabled: native, staleTime: 60_000, refetchInterval: 5 * 60_000,
});
```

```dart
final forceUpdateQuery = queryProvider<Map<String, dynamic>?>((ref) => QueryOptions(
      queryKey: const ['force-update-config'],
      enabled: true, // native
      staleTime: const Duration(seconds: 60),
      refetchInterval: const Duration(minutes: 5),
      codec: QueryCodecs.maybeRow,
      queryFn: (_) async {
        final data = await ref.read(dbProvider).rpc<Object?>('get_public_app_setting', params: {'p_key': 'force_update'});
        final config = data is String ? jsonDecode(data) : data;
        return config is Map ? Map<String, dynamic>.from(config) : null;
      },
    ));
// widget: final q = ref.watch(forceUpdateQuery); q.isLoading, q.data
```
(5-minute polling is > 60 s, so `shouldPersistQuery` still persists it — same as React.)

## Example 2 — `src/hooks/useIllness.ts` (keyed queries + mutations + prefix invalidation)

```ts
useQuery({ queryKey: ['illness-entries', user?.id, episodeId], queryFn: () => listEntries(episodeId!),
  enabled: !!user?.id && !!episodeId, staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 60_000 });
const refresh = () => { qc.invalidateQueries({ queryKey: ['illness-episodes'] }); qc.invalidateQueries({ queryKey: ['illness-entries'] }); };
add: useMutation({ mutationFn: (v) => addEntry(v.episodeId, v.entry), onSuccess: refresh })
```

```dart
final illnessEntriesQuery = queryProviderFamily<List<Row>, String?>((ref, episodeId) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions(
    queryKey: ['illness-entries', userId, episodeId],
    enabled: userId != null && episodeId != null,
    staleTime: const Duration(seconds: 15),
    refetchOnWindowFocus: RefetchOn.ifStale,
    refetchInterval: const Duration(seconds: 60),
    queryFn: (_) => listEntries(ref, episodeId!), // never persisted: 'illness-entries' is a sensitive key
  );
});

final addIllnessEntry = mutationProvider<void, ({String episodeId, Row entry}), void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) => addEntry(ref, v.episodeId, v.entry),
    onSuccess: (_, __, ___) {
      unawaited(qc.invalidateQueries(queryKey: const ['illness-episodes']));
      unawaited(qc.invalidateQueries(queryKey: const ['illness-entries']));
    },
  );
});
// ref.read(addIllnessEntry.notifier).mutate((episodeId: id, entry: row));
```

## Example 3 — `src/hooks/useStoryReplies.ts` (optimistic update + rollback)

```ts
onMutate: async ({ storyId, content }) => {
  await queryClient.cancelQueries({ queryKey: ['story-replies', storyId] });
  const prev = queryClient.getQueryData<StoryReply[]>(['story-replies', storyId]);
  queryClient.setQueryData<StoryReply[]>(['story-replies', storyId], (old) => [...(old || []), optimisticReply]);
  return { prev };
},
onError: (err, vars, ctx) => { if (ctx?.prev !== undefined) queryClient.setQueryData(['story-replies', vars.storyId], ctx.prev); toast(...) },
onSuccess: (_d, v) => { queryClient.invalidateQueries({ queryKey: ['story-replies', v.storyId] }); queryClient.invalidateQueries({ queryKey: ['stories'] }); },
```

```dart
final sendStoryReply = mutationProvider<Row, ({String storyId, String content}), QuerySnapshot>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) => insertReply(ref, v.storyId, v.content),
    onMutate: (v) => qc.optimisticUpdate<List<Row>>(['story-replies', v.storyId], (old) => [
          ...?old,
          {'id': 'optimistic-${DateTime.now().millisecondsSinceEpoch}', 'story_id': v.storyId, 'user_id': 'optimistic',
           'content': v.content, 'created_at': DateTime.now().toUtc().toIso8601String(),
           'author': {'name': tr('usestoryreplies_siz_5c7f89', 'Siz'), 'avatar_url': null}},
        ]),
    onError: (error, v, snapshot) => snapshot?.rollback(), // + toast
    onSuccess: (_, v, __) {
      unawaited(qc.invalidateQueries(queryKey: ['story-replies', v.storyId]));
      unawaited(qc.invalidateQueries(queryKey: const ['stories']));
    },
  );
});
```

## Model convention (`core/data/row.dart`)

Keep rows as `Row` (`Map<String, dynamic>`) at the edges, read with `row.str('x')`, `row.integer('x')`,
`row.date('x')`… A feature that needs a model writes `class Foo { factory Foo.fromRow(Row r); Row toRow(); }` in
`features/<feature>/models/`, keeps snake_case keys, and passes `QueryCodecs.models(Foo.toRow, Foo.fromRow)` as the
query codec so the persisted cache restores typed data. Use `mapRowTranslation` (re-exported by `core/data/data.dart`)
before mapping content rows, as the hooks do.

## Not reproduced exactly

- `structuralSharing` (deep-equal data keeps the old reference) is not implemented: a refetch with equal data
  produces a new object; equality-sensitive widgets should `select` scalar fields.
- `select` option: map in the provider / with `ref.watch(q.select(...))`.
- `useIsRestoring`/hydration boundary: restore happens in the startup sequence before the first frame instead.
- `setQueriesData` only calls the updater for queries that have data.
- Retries pause while the app is in the background (TanStack: while the document is hidden) — same effect.
