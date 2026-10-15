import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { GatedImage, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Album photos; "my child" tab when the viewer has children in it (web: AlbumViewer). */
export function FinaAlbumScreen() {
  const { f } = useFn('media');
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['admin', 'fina-album', id, campusId ?? 'school'] : null, ([, , al]) => fina.album(al as string, campusId));
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const media = res.data?.media ?? [];
  const mine = media.filter((m) => m.isMyChild);
  const shown = mine.length && tab === 'mine' ? mine : media;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: res.data?.album.title ?? '' }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : (
          <>
            {mine.length ? (
              <FilterChips
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'mine', label: `${f('kind_image')} (${mine.length})` },
                  { value: 'all', label: `${f('kind_image')} (${media.length})` },
                ]}
              />
            ) : null}
            {!shown.length ? <Text className="text-muted-foreground py-8 text-center text-sm">{f('pending_queue_empty')}</Text> : null}
            <View className="flex-row flex-wrap gap-1.5">
              {shown.map((m) => (
                <GatedImage key={m.id} mediaId={m.id} variant="md" className="aspect-square w-[48.5%] rounded-md" />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
