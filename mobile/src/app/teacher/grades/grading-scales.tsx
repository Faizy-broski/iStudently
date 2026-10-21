import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** School-wide grading scales, read-only; tap one for its grades (web: /teacher/grades/grading-scales). */
export default function TeacherGradingScales() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.gradingScales.${key}`);
  const { campusId } = useCampus();
  const scales = useApi(['teacher', 'grading-scales', campusId ?? 'school'], () => adminGrades.scales(campusId));
  const [open, setOpen] = useState<string | null>(null);
  const list = (scales.data ?? []).filter((s) => s.is_active !== false);
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => scales.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('pageSubtitle')}</Text>
        <Section title={k('activeScales')}>
          {scales.isLoading ? (
            <LoadingList rows={3} />
          ) : scales.error ? (
            <ErrorState message={scales.error.message} onRetry={() => scales.mutate()} />
          ) : !list.length ? (
            <EmptyState icon={Scale} title={k('noScalesConfigured')} />
          ) : (
            list.map((s) => <ScaleRow key={s.id} id={s.id} title={s.title} isDefault={s.is_default} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />)
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function ScaleRow({ id, title, isDefault, open, onToggle }: { id: string; title: string; isDefault: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.gradingScales.${key}`);
  const grades = useApi(open ? ['teacher', 'scale-grades', id] : null, ([, , s]) => adminGrades.scaleGrades(s as string));
  const rows = [...(grades.data ?? [])].sort((a, b) => (b.break_off ?? 0) - (a.break_off ?? 0));
  return (
    <Panel className="overflow-hidden">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
        <IconTile icon={Scale} size={40} />
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold">{title}</Text>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {isDefault ? <StatusChip label={k('default')} tone="info" /> : null}
            <Text className="text-muted-foreground text-xs">{k('viewGrades')}</Text>
          </View>
        </View>
        <Icon flipRtl as={open ? ChevronDown : ChevronRight} className="text-muted-foreground size-4" />
      </Pressable>
      {open ? (
        <View className="border-info-soft dark:border-border bg-muted/30 border-t px-4 py-3">
          {grades.isLoading ? (
            <LoadingList rows={2} />
          ) : !rows.length ? (
            <EmptyState title={k('noGradeEntriesDefined')} />
          ) : (
            <>
              <View className="border-info-soft dark:border-border flex-row border-b pb-1.5">
                <Text className="text-muted-foreground flex-1 text-[11px] font-semibold">{k('letter')}</Text>
                <Text className="text-muted-foreground w-16 text-end text-[11px] font-semibold">{k('minPercent')}</Text>
                <Text className="text-muted-foreground w-14 text-end text-[11px] font-semibold">{k('gpa')}</Text>
              </View>
              {rows.map((g, i) => (
                <View key={g.id} className={cn('flex-row items-center py-2', i < rows.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <View className="flex-1">
                    <Text className="font-semibold text-brand dark:text-brand-secondary">{g.title}</Text>
                    {g.comment ? <Text className="text-muted-foreground text-xs">{g.comment}</Text> : null}
                  </View>
                  <Text className="w-16 text-end text-sm">{`${g.break_off}%`}</Text>
                  <Text className="w-14 text-end text-sm">{g.gpa_value != null ? Number(g.gpa_value).toFixed(2) : '—'}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      ) : null}
    </Panel>
  );
}
