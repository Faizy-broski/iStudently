import { CATEGORY_LABELS_AR, PHYSICS_CATALOG } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => labs.mutate()} />}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('searchPlaceholder')} />
        {labs.isLoading ? (
          <LoadingList rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState icon={FlaskConical} title={all.length === 0 ? k('noLabsAssigned') : k('noLabsSearch')} />
        ) : (
          <Panel>
            {shown.map((l, i) => {
              const s = sim(l.sim_key);
              return (
                <RowItem
                  key={l.id}
                  leading={<IconTile icon={FlaskConical} size={40} />}
                  title={s?.title || l.sim_key}
                  meta={l.custom_note}
                  onPress={() => router.push({ pathname: '/student/resources/physics-labs/[id]', params: { id: l.id } })}
                  last={i === shown.length - 1}>
                  {s ? <StatusChip label={i18n.language === 'ar' ? CATEGORY_LABELS_AR[s.category] : s.category} tone="info" className="ms-[52px] self-start px-2 py-0.5" /> : null}
                </RowItem>
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
