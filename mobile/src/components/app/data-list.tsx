import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View, type FlatListProps } from 'react-native';

import { Separator } from '@/components/ui/separator';
import type { ApiError } from '@/lib/data';

import { EmptyState, ErrorState, LoadingList } from './states';

/** FlatList with loading skeleton, error/offline + retry, empty state, pull-to-refresh and paging. */
export function DataList<T>({
  items,
  error,
  isLoading,
  isRefreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  emptyTitle,
  emptyBody,
  renderItem,
  keyExtractor,
  header,
  ...rest
}: {
  items: T[] | undefined;
  error?: ApiError;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  emptyTitle: string;
  emptyBody?: string;
  renderItem: (item: T, index: number) => ReactElement | null;
  keyExtractor: (item: T) => string;
  header?: ReactElement;
} & Omit<FlatListProps<T>, 'data' | 'renderItem' | 'keyExtractor' | 'onEndReached'>) {
  if (isLoading && !items?.length) return <LoadingList />;
  if (error && !items?.length) return <ErrorState message={error.message} offline={error.offline} onRetry={onRefresh} />;

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderItem(item, index)}
      ItemSeparatorComponent={() => <Separator />}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState title={emptyTitle} body={emptyBody} />}
      ListFooterComponent={loadingMore ? <View className="py-4"><ActivityIndicator /></View> : null}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} /> : undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      contentContainerClassName="flex-grow"
      {...rest}
    />
  );
}
