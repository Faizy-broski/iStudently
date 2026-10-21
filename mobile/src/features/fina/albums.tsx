import { router, Stack, type Href } from 'expo-router';
import { FolderOpen, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { ListRow } from '@/components/app/list-row';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Activity albums: create and open (web: /admin/fina/albums). */
export function FinaAlbumsScreen({ canCreate, detail }: { canCreate: boolean; detail: (id: string) => Href }) {
  const { f, a } = useFn('media');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-albums', campusId ?? 'school'], () => fina.albums(campusId));
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fina.createAlbum({ title: title.trim() }, campusId);
      if (!r.success) return toast.error(r.error || '');
      setTitle('');
      res.mutate();
    } finally {
      setBusy(false);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('fn_albums') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {canCreate ? (
          <View className="flex-row gap-2">
            <Input className="flex-1" value={title} onChangeText={setTitle} placeholder={a('fn_album_title')} />
            <Button size="icon" onPress={create} disabled={busy || !title.trim()} accessibilityLabel={a('fn_new_album')}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
            </Button>
          </View>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState title={f('pending_queue_empty')} />
        ) : (
          <Card>
            <CardContent className="py-1">
              {list.map((al) => (
                <ListRow
                  key={al.id}
                  title={al.title}
                  subtitle={al.activity_date}
                  leading={<Icon as={FolderOpen} className="size-5 text-warning" />}
                  onPress={() => router.push(detail(al.id))}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
