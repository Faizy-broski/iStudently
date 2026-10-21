import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View, type FlatListProps } from 'react-native';

import { Separator } from '@/components/ui/separator';
import type { ApiError } from '@/lib/data';
import { cn } from '@/lib/utils';

import { EmptyState, ErrorState, LoadingList } from './states';

/**
 * FlatList with loading skeleton, error/offline + retry, empty state, pull-to-refresh and paging.
 * By default the rows are grouped into one rounded card with hairline dividers (the app's list look);
 * screens that pass their own `ItemSeparatorComponent` (spaced cards) keep full control.
 */
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
  const grouped = !('ItemSeparatorComponent' in rest);
  const count = items?.length ?? 0;
  if (isLoading && !items?.length) return <LoadingList />;
  if (error && !items?.length) return <ErrorState message={error.message} offline={error.offline} onRetry={onRefresh} />;

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) =>
        grouped ? (
          <View
            className={cn(
              'bg-card border-info-soft dark:border-border mx-4 overflow-hidden border-x',
              index === 0 && 'mt-1 rounded-t-2xl border-t',
              index === count - 1 && 'mb-6 rounded-b-2xl border-b',
            )}>
            {renderItem(item, index)}
          </View>
        ) : (
          renderItem(item, index)
        )
      }
      ItemSeparatorComponent={() => (
        <View className="bg-card border-info-soft dark:border-border mx-4 border-x px-4">
          <Separator />
        </View>
      )}
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
