import type { AppealStatus, InspectionAppeal } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowUpCircle, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

export const APPEAL_STATUS_CLS: Record<AppealStatus, [string, string]> = {
  submitted: ['bg-warning-soft', 'text-warning'],
  under_review: ['bg-info-soft', 'text-brand dark:text-brand-secondary'],
  escalated: ['bg-chart-6/10', 'text-chart-6'],
  upheld: ['bg-success-soft', 'text-success'],
  denied: ['bg-destructive-soft', 'text-destructive'],
  withdrawn: ['bg-muted', 'text-muted-foreground'],
};

function Row({ a, sub, accent }: { a: InspectionAppeal; sub: string; accent?: boolean }) {
  const { t } = useTranslation();
  const [bg, fg] = APPEAL_STATUS_CLS[a.status];
  return (
    <Pressable onPress={() => router.push({ pathname: '/admin/inspections/appeal/[id]', params: { id: a.id } })} className="flex-row items-center gap-3 px-4 py-3">
      <IconTile icon={User} tone={accent ? 'warning' : 'brand'} round />
      <View className="flex-1">
        <Text className="text-sm font-semibold">{a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : ''}</Text>
        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View className={cn('rounded-full px-2 py-0.5', bg)}>
        <Text className={cn('text-xs', fg)}>{t(`inspections.appeals.status_${a.status}`)}</Text>
      </View>
    </Pressable>
  );
}

/** Appeals for the campus, plus appeals escalated to me (web: /admin/inspections/appeals). */
export default function InspectionAppeals() {
  const { t } = useTranslation();
  const p = (k: string) => t(`inspections.appeals.${k}`);
  const { scopeId } = useCampus();
  const mine = useApi(['admin', 'appeals-assigned-to-me'], () => adminInspections.appealsAssignedToMe());
  const list = useApi(scopeId ? ['admin', 'inspection-appeals', scopeId] : null, ([, , id]) => adminInspections.appealsForSchool(id as string));
  return (
    <>
      <Stack.Screen options={{ title: p('list_page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted" className="text-sm">{p('admin_list_subtitle')}</Text>
              {(mine.data ?? []).length ? (
                <View className="rounded-xl border border-chart-6/30">
                  <View className="gap-1 p-3">
                    <View className="flex-row items-center gap-2">
                      <Icon as={ArrowUpCircle} className="size-4 text-chart-6" />
                      <Text className="font-semibold">{p('escalated_to_me_title')}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">{p('escalated_to_me_desc')}</Text>
                  </View>
                  {(mine.data ?? []).map((a) => (
                    <Row key={a.id} a={a} sub={a.school?.name ?? ''} accent />
                  ))}
                </View>
              ) : null}
            </View>
          }
          items={scopeId ? list.data : []}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => {
            mine.mutate();
            list.mutate();
          }}
          emptyTitle={scopeId ? p('no_appeals') : p('select_campus_prompt')}
          keyExtractor={(a) => a.id}
          renderItem={(a) => <Row a={a} sub={a.reason} />}
        />
      </View>
    </>
  );
}
