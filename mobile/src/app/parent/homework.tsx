import type { HomeworkAssignment } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, CheckCircle, ClipboardList, Clock, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import i18n from '@/i18n';

type Tab = 'pending' | 'submitted' | 'overdue';

/** The selected child's homework of the last 90 days: pending / submitted / overdue with a month filter (web: /parent/homework, from the dashboard). */
export default function ParentHomework() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_hw_${key}`, o);
  const { child, childId } = useChild();
  const hw = useApi(childId ? ['parent', 'homework', childId, 90] : null, ([, , id]) => parent.getHomework(id as string, 90));
  const [month, setMonth] = useState(0);
  const [year] = useState(() => new Date().getFullYear());
  const [tab, setTab] = useState<Tab>('pending');
  const [now] = useState(() => Date.now());

  if (!child) return <NoChild />;
  if (hw.isLoading) return <LoadingList rows={6} />;
  if (hw.error) return <PortalError title={k('error')} message={hw.error.message} />;

  const all = hw.data ?? [];
  const filtered = month > 0 ? all.filter((h) => new Date(h.due_date).getMonth() + 1 === month && new Date(h.due_date).getFullYear() === year) : all;
  const time = (d?: string) => new Date(d ?? 0).getTime();
  const groups: Record<Tab, HomeworkAssignment[]> = {
    pending: filtered.filter((h) => h.status === 'pending').sort((a, b) => time(a.due_date) - time(b.due_date)),
    submitted: filtered.filter((h) => h.status === 'submitted' || h.status === 'graded').sort((a, b) => time(b.submission_date || b.due_date) - time(a.submission_date || a.due_date)),
    overdue: filtered.filter((h) => h.status === 'overdue').sort((a, b) => time(b.due_date) - time(a.due_date)),
  };
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(loc, { month: 'long' });
  const empty = {
    pending: [CheckCircle, k('empty_pending'), k('empty_pending_body'), false],
    submitted: [ClipboardList, k('empty_submitted'), k('empty_submitted_body'), false],
    overdue: [CheckCircle, k('empty_overdue'), k('empty_overdue_body'), true],
  }[tab] as [LucideIcon, string, string, boolean];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => hw.mutate()} />}>
        <Text variant="muted" className="text-sm">{k('subtitle', { name: `${child.first_name} ${child.last_name}` })}</Text>
        <StatTiles>
          <StatTile icon={Clock} tone="warning" label={k('pending')} value={String(groups.pending.length)} />
          <StatTile icon={CheckCircle} tone="success" label={k('submitted')} value={String(groups.submitted.length)} />
          <StatTile icon={AlertCircle} tone="destructive" label={k('overdue')} value={String(groups.overdue.length)} />
        </StatTiles>
        <Section title={k('assignments')}>
          <View className="gap-3">
            <FilterChips
              value={String(month)}
              onChange={(v) => setMonth(Number(v))}
              options={[{ value: '0', label: k('all_months') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${monthName(i + 1)} ${year}` }))]}
            />
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'pending', label: `${k('pending')} (${groups.pending.length})` },
                { value: 'submitted', label: `${k('submitted')} (${groups.submitted.length})` },
                { value: 'overdue', label: `${k('overdue')} (${groups.overdue.length})` },
              ]}
            />
            {groups[tab].length === 0 ? (
              <EmptyState icon={empty[0]} title={empty[1]} body={empty[2]} />
            ) : (
              <Panel>
                {groups[tab].map((h, i, arr) => {
                  const late = h.status === 'pending' && new Date(h.due_date).getTime() < now;
                  const tone: ChipTone = h.status === 'graded' ? 'success' : h.status === 'submitted' ? 'info' : late || h.status === 'overdue' ? 'destructive' : 'muted';
                  return (
                    <RowItem
                      key={h.id}
                      leading={<IconTile icon={BookOpen} size={40} />}
                      title={h.title}
                      meta={[k('due', { date: formatDate(h.due_date) }), h.teacher_name ? k('by', { name: h.teacher_name }) : null].filter(Boolean).join(' · ')}
                      trailing={h.marks_obtained !== undefined && h.marks_obtained !== null ? <StatusChip label={`${h.marks_obtained}/${h.total_marks || 100}`} tone="success" /> : undefined}
                      last={i === arr.length - 1}>
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <StatusChip label={h.subject} tone="info" />
                        {tab !== 'pending' ? <StatusChip label={late ? k('overdue') : k(`status_${h.status}`)} tone={tone} /> : null}
                      </View>
                      {h.description ? (
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {h.description}
                        </Text>
                      ) : null}
                    </RowItem>
                  );
                })}
              </Panel>
            )}
          </View>
        </Section>
      </ScrollView>
    </>
  );
}
