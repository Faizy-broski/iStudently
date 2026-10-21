import type { FeedbackStatus } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { FEEDBACK_TONE } from '@/features/superadmin/feedback';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useSWRConfig } from 'swr';

export default function FeedbackDetail() {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The API has no single-item endpoint; read from the full list (cached by the Inbox tab).
  const list = useApi(['platform', 'feedback', 'all'], () => platform.listFeedback());
  const f = list.data?.find((x) => x.id === id);
  const setStatus = useAction(platform.setFeedbackStatus, {
    success: t('app.ib_status_updated'),
    onSuccess: () => mutate((key) => Array.isArray(key) && key[1] === 'feedback'),
  });

  if (list.isLoading && !list.data) return <LoadingList rows={3} />;
  if (list.error && !list.data) return <ErrorState message={list.error.message} offline={list.error.offline} onRetry={() => list.mutate()} />;
  if (!f) return <ErrorState message={t('app.ib_no_feedback')} />;

  return (
    <>
      <Stack.Screen options={{ title: t(`app.ib_cat_${f.category}`) }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Panel className="gap-2 p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusChip label={t(`app.ib_status_${f.status}`)} tone={FEEDBACK_TONE[f.status]} />
            <StatusChip label={t(`app.ib_cat_${f.category}`)} tone="muted" />
          </View>
          <Text className="text-lg font-semibold">{f.title}</Text>
          <Text className="text-sm" selectable>
            {f.description}
          </Text>
          <Text variant="muted" className="text-xs">
            {[f.submitter_name, f.submitter_role, f.submitter_email, formatDate(f.created_at)].filter(Boolean).join(' · ')}
          </Text>
        </Panel>
        <Text className="text-sm font-semibold">{t('app.ib_change_status')}</Text>
        <FilterChips<FeedbackStatus>
          value={f.status}
          onChange={(s) => s !== f.status && setStatus.run(f.id, s)}
          options={[
            { value: 'open', label: t('app.ib_status_open') },
            { value: 'in_progress', label: t('app.ib_status_in_progress') },
            { value: 'resolved', label: t('app.ib_status_resolved') },
          ]}
        />
      </ScrollView>
    </>
  );
}
