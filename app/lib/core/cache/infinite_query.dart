// Ported from: node_modules/@tanstack/query-core v5 infiniteQueryBehavior.ts / infiniteQueryObserver.ts
// (`useInfiniteQuery` in src/hooks/useChatMessages.ts, useCommunitySocial.ts).
//
// Data is `InfiniteData { pages, pageParams }`. A refetch re-fetches every loaded page in order
// (first page from the stored first param, later params from getNextPageParam), like TanStack v5.

import 'query_client.dart';
import 'query_key.dart';
import 'query_observer.dart';

class InfiniteData<TPage, TParam> {
  const InfiniteData({required this.pages, required this.pageParams});
  final List<TPage> pages;
  final List<TParam> pageParams;

  Map<String, Object?> toJson(Object? Function(TPage page) pageToJson, Object? Function(TParam param) paramToJson) =>
      {'pages': pages.map(pageToJson).toList(), 'pageParams': pageParams.map(paramToJson).toList()};

  static InfiniteData<TPage, TParam> fromJson<TPage, TParam>(
    Object? json,
    TPage Function(Object? page) pageFromJson,
    TParam Function(Object? param) paramFromJson,
  ) {
    final map = json as Map;
    return InfiniteData(
      pages: (map['pages'] as List).map(pageFromJson).toList(),
      pageParams: (map['pageParams'] as List).map(paramFromJson).toList(),
    );
  }
}

typedef PageParamFn<TPage, TParam> = TParam? Function(
    TPage lastPage, List<TPage> allPages, TParam lastPageParam, List<TParam> allPageParams);

typedef PageFn<TPage, TParam> = Future<TPage> Function(QueryFunctionContext context, TParam pageParam);

/// `useInfiniteQuery` options.
QueryOptions<InfiniteData<TPage, TParam>> infiniteQueryOptions<TPage, TParam>({
  required QueryKey queryKey,
  required PageFn<TPage, TParam> queryFn,
  required TParam initialPageParam,
  required PageParamFn<TPage, TParam> getNextPageParam,
  PageParamFn<TPage, TParam>? getPreviousPageParam,
  int? maxPages,
  bool enabled = true,
  Duration? staleTime,
  Duration? gcTime,
  RetryPolicy? retry,
  RefetchOn? refetchOnMount,
  RefetchOn? refetchOnWindowFocus,
  RefetchOn? refetchOnReconnect,
  Duration? refetchInterval,
  Map<String, Object?>? meta,
  QueryDataCodec<InfiniteData<TPage, TParam>>? codec,
}) {
  Future<InfiniteData<TPage, TParam>> run(QueryFunctionContext context) async {
    final old = context.currentData is InfiniteData<TPage, TParam> ? context.currentData as InfiniteData<TPage, TParam> : null;
    List<TPage> pages = [...?old?.pages];
    List<TParam> params = [...?old?.pageParams];

    List<T> cap<T>(List<T> list, bool previous) {
      if (maxPages == null || list.length <= maxPages) return list;
      return previous ? list.sublist(0, maxPages) : list.sublist(list.length - maxPages);
    }

    switch (context.direction) {
      case FetchDirection.forward when old != null && pages.isNotEmpty:
        final param = getNextPageParam(pages.last, pages, params.last, params);
        if (param == null) return old;
        final page = await queryFn(context, param);
        return InfiniteData(pages: cap([...pages, page], false), pageParams: cap([...params, param], false));
      case FetchDirection.backward when old != null && pages.isNotEmpty && getPreviousPageParam != null:
        final param = getPreviousPageParam(pages.first, pages, params.first, params);
        if (param == null) return old;
        final page = await queryFn(context, param);
        return InfiniteData(pages: cap([page, ...pages], true), pageParams: cap([param, ...params], true));
      default:
        // Initial load or refetch of every loaded page.
        final count = pages.isEmpty ? 1 : pages.length;
        final nextPages = <TPage>[];
        final nextParams = <TParam>[];
        var param = params.isEmpty ? initialPageParam : params.first;
        for (var i = 0; i < count; i++) {
          final page = await queryFn(context, param);
          nextPages.add(page);
          nextParams.add(param);
          if (i + 1 >= count) break;
          final next = getNextPageParam(page, nextPages, param, nextParams);
          if (next == null) break;
          param = next;
        }
        return InfiniteData(pages: nextPages, pageParams: nextParams);
    }
  }

  return QueryOptions<InfiniteData<TPage, TParam>>(
    queryKey: queryKey,
    queryFn: run,
    enabled: enabled,
    staleTime: staleTime,
    gcTime: gcTime,
    retry: retry,
    refetchOnMount: refetchOnMount,
    refetchOnWindowFocus: refetchOnWindowFocus,
    refetchOnReconnect: refetchOnReconnect,
    refetchInterval: refetchInterval,
    meta: {...?meta, '__infinite_next': getNextPageParam, '__infinite_prev': getPreviousPageParam},
    codec: codec,
  );
}

/// `useInfiniteQuery` observer: a [QueryObserver] plus page fetching.
class InfiniteQueryObserver<TPage, TParam> extends QueryObserver<InfiniteData<TPage, TParam>> {
  InfiniteQueryObserver(super.client, super.options);

  PageParamFn<TPage, TParam>? get _next => options.meta?['__infinite_next'] as PageParamFn<TPage, TParam>?;
  PageParamFn<TPage, TParam>? get _prev => options.meta?['__infinite_prev'] as PageParamFn<TPage, TParam>?;

  bool get hasNextPage {
    final data = current.data;
    if (data == null || data.pages.isEmpty || _next == null) return false;
    return _next!(data.pages.last, data.pages, data.pageParams.last, data.pageParams) != null;
  }

  bool get hasPreviousPage {
    final data = current.data;
    if (data == null || data.pages.isEmpty || _prev == null) return false;
    return _prev!(data.pages.first, data.pages, data.pageParams.first, data.pageParams) != null;
  }

  /// `fetchNextPage()`; shares a running page fetch.
  Future<void> fetchNextPage() =>
      query.fetch(options: options, direction: FetchDirection.forward).then((_) {}, onError: (Object _) {});

  Future<void> fetchPreviousPage() =>
      query.fetch(options: options, direction: FetchDirection.backward).then((_) {}, onError: (Object _) {});
}
