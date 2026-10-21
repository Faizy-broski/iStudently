import { router, Stack } from 'expo-router';
import { CircleDot, Trash2, Upload, Video, Image as ImageIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { LoadingList, EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { GatedImage, useFn } from '@/features/admin/fina';
import { useFinaUpload } from '@/features/admin/fina-media';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useRoleBase } from '@/features/portal/role-base';

/** Upload queue (needs tagging) and ready photos; post as story, delete (web: /admin/fina/media). */
export default function FinaMediaLibrary() {
  const role = useRoleBase();
  const { f } = useFn('media');
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  // The web polls every 8s while variants are generated.
  const pending = useApi(['admin', 'fina-media-pending', campusId ?? 'school'], () => fina.pendingTagging(campusId), { refreshInterval: 8000 });
  const ready = useApi(['admin', 'fina-media-ready', campusId ?? 'school'], () => fina.myReadyMedia(campusId), { refreshInterval: 8000 });
  const reload = () => (pending.mutate(), ready.mutate());
  const { upload, uploading } = useFinaUpload(reload);

  async function remove(id: string) {
    if (!(await confirm({ title: f('delete_confirm'), destructive: true, confirmLabel: f('delete_button') }))) return;
    const r = await fina.deleteMedia(id, campusId);
    if (!r.success) return toast.error(r.error || '');
    toast.success(f('delete_success'));
    reload();
  }
  async function story(id: string) {
    const r = await fina.createStory(id, campusId);
    if (!r.success) toast.error(r.error || '');
    else toast.success(f('story_posted'));
  }

  const Del = ({ id }: { id: string }) => (
    <Pressable onPress={() => remove(id)} className="absolute end-1 top-1 rounded-full bg-black/60 p-1.5" hitSlop={4} accessibilityLabel={f('delete_button')}>
      <Icon as={Trash2} className="size-3.5 text-white" />
    </Pressable>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('page_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Button onPress={upload} disabled={uploading}>
          <Icon as={Upload} className="text-primary-foreground size-4" />
          <Text>{uploading ? f('uploading') : f('upload_button')}</Text>
        </Button>
        <Text className="font-semibold">{f('pending_queue_title')}</Text>
        {pending.isLoading ? (
          <LoadingList rows={2} />
        ) : !(pending.data ?? []).length ? (
          <EmptyState icon={ImageIcon} title={f('pending_queue_empty')} />
        ) : (
          <View className="flex-row flex-wrap gap-1.5">
            {(pending.data ?? []).map((m) => (
              <Pressable key={m.id} onPress={() => router.push(role.href('/fina/media/[id]', { id: m.id }))} className="aspect-square w-[31.5%] overflow-hidden rounded-md">
                {m.kind === 'image' ? (
                  <GatedImage mediaId={m.id} raw thumb className="size-full" />
                ) : (
                  <View className="bg-muted size-full items-center justify-center">
                    <Icon as={Video} className="text-muted-foreground size-6" />
                  </View>
                )}
                <Del id={m.id} />
              </Pressable>
            ))}
          </View>
        )}
        <Text className="font-semibold">{f('ready_section_title')}</Text>
        {ready.isLoading ? (
          <LoadingList rows={2} />
        ) : !(ready.data ?? []).length ? (
          <Text className="text-muted-foreground text-sm">{f('ready_section_empty')}</Text>
        ) : (
          <View className="flex-row flex-wrap gap-1.5">
            {(ready.data ?? []).map((m) => (
              <View key={m.id} className="aspect-square w-[31.5%] overflow-hidden rounded-md">
                {m.kind === 'image' ? (
                  <GatedImage mediaId={m.id} variant="thumb" className="size-full" />
                ) : (
                  <View className="bg-muted size-full items-center justify-center">
                    <Icon as={Video} className="text-muted-foreground size-6" />
                  </View>
                )}
                {m.kind === 'image' ? (
                  <Pressable onPress={() => story(m.id)} className="absolute start-1 top-1 rounded-full bg-black/60 p-1.5" hitSlop={4} accessibilityLabel={f('post_as_story')}>
                    <Icon as={CircleDot} className="size-3.5 text-white" />
                  </Pressable>
                ) : null}
                <Del id={m.id} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
