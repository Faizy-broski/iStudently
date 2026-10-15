import { CATEGORY_LABELS_AR, PHYSICS_CATALOG } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { ChevronRight, FlaskConical } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';

const sim = (key: string) => PHYSICS_CATALOG.find((s) => s.key === key);

/** Physics labs assigned to the student; tap one to run it (web: /student/resources/physics-labs). */
export default function StudentPhysicsLabs() {
  const { t, i18n } = useTranslation();
  const k = (key: string) => t(`physicsLabs.student.${key}`);
  const labs = useApi(['student', 'physics-labs'], () => portal.physicsLabs());
  const [search, setSearch] = useState('');
  const all = labs.data ?? [];
  const q = search.toLowerCase();
  const shown = all.filter((l) => !q || (sim(l.sim_key)?.title || l.sim_key).toLowerCase().includes(q));

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => labs.mutate()} />}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('searchPlaceholder')} />
        {labs.isLoading ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{t('physicsLabs.loading')}</Text>
        ) : shown.length === 0 ? (
          <View className="items-center py-10">
            <Icon as={FlaskConical} className="text-muted-foreground mb-2 size-10" />
            <Text className="text-muted-foreground text-center text-sm">{all.length === 0 ? k('noLabsAssigned') : k('noLabsSearch')}</Text>
          </View>
        ) : (
          shown.map((l) => {
            const s = sim(l.sim_key);
            return (
              <Pressable
                key={l.id}
                onPress={() => router.push({ pathname: '/student/resources/physics-labs/[id]', params: { id: l.id } })}
                accessibilityRole="button"
                className="border-border bg-card flex-row items-start gap-2 rounded-lg border p-3">
                <Icon as={FlaskConical} className="mt-0.5 size-4 text-[#022172] dark:text-blue-400" />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{s?.title || l.sim_key}</Text>
                  {s ? (
                    <View className="bg-muted mt-1 self-start rounded-full px-1.5 py-0.5">
                      <Text className="text-xs">{i18n.language === 'ar' ? CATEGORY_LABELS_AR[s.category] : s.category}</Text>
                    </View>
                  ) : null}
                  {l.custom_note ? (
                    <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                      {l.custom_note}
                    </Text>
                  ) : null}
                </View>
                <Icon as={ChevronRight} className="text-muted-foreground mt-0.5 size-4 rtl:rotate-180" />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
