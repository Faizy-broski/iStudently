import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { TaggingPanel } from '@/features/admin/fina-media';

/** Tag the students in an uploaded photo before it can be posted (web: /admin/fina/media/[id]/tag). */
export default function FinaTagMedia() {
  const { f } = useFn('media');
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaId = id ?? '';
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('tag_screen_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{f('tag_screen_subtitle')}</Text>
        {mediaId ? <TaggingPanel mediaId={mediaId} onConfirmed={() => router.back()} /> : null}
      </ScrollView>
    </View>
  );
}
