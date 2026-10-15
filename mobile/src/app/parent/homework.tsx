import type { HomeworkAssignment } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, Calendar, CheckCircle, ClipboardList, Clock, Filter, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
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
        <Text variant="muted">{k('subtitle', { name: `${child.first_name} ${child.last_name}` })}</Text>
        <View className="flex-row gap-2">
          <Stat icon={Clock} box="bg-yellow-100 dark:bg-yellow-900/30" iconTone="text-yellow-600" value={groups.pending.length} label={k('pending')} />
          <Stat icon={CheckCircle} box="bg-green-100 dark:bg-green-900/30" iconTone="text-green-600" value={groups.submitted.length} label={k('submitted')} valueTone="text-green-600" />
          <Stat icon={AlertCircle} box="bg-red-100 dark:bg-red-900/30" iconTone="text-red-600" value={groups.overdue.length} label={k('overdue')} valueTone="text-red-600" />
        </View>
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>{k('assignments')}</CardTitle>
            <View className="flex-row items-center gap-2">
              <Icon as={Filter} className="text-muted-foreground size-4" />
              <View className="flex-1">
                <Picker
                  value={String(month)}
                  onChange={(v) => setMonth(Number(v))}
                  options={[{ value: '0', label: k('all_months') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${monthName(i + 1)} ${year}` }))]}
                />
              </View>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <FilterChips<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'pending', label: `${k('pending')} (${groups.pending.length})` },
                { value: 'submitted', label: `${k('submitted')} (${groups.submitted.length})` },
                { value: 'overdue', label: `${k('overdue')} (${groups.overdue.length})` },
              ]}
            />
            {groups[tab].length === 0 ? (
              <View className="items-center py-10">
                <Icon as={empty[0]} className={cn('mb-3 size-14', empty[3] ? 'text-green-500' : 'text-muted-foreground/40')} />
                <Text className={cn('text-lg', empty[3] ? 'text-green-600' : 'text-muted-foreground')}>{empty[1]}</Text>
                <Text className="text-muted-foreground text-sm">{empty[2]}</Text>
              </View>
            ) : (
              groups[tab].map((h) => {
                const late = h.status === 'pending' && new Date(h.due_date).getTime() < now;
                return (
                  <View key={h.id} className="border-border flex-row items-start gap-3 rounded-lg border p-3">
                    <View className="bg-primary/10 rounded-lg p-2">
                      <Icon as={BookOpen} className="text-primary size-5" />
                    </View>
                    <View className="flex-1 gap-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-semibold">{h.title}</Text>
                        <Badge variant="outline">
                          <Text className="text-xs">{h.subject}</Text>
                        </Badge>
                        {tab !== 'pending' ? (
                          <Badge variant={h.status === 'graded' ? 'default' : h.status === 'submitted' ? 'secondary' : late || h.status === 'overdue' ? 'destructive' : 'outline'}>
                            <Text className="text-xs">{late ? k('overdue') : k(`status_${h.status}`)}</Text>
                          </Badge>
                        ) : null}
                      </View>
                      {h.description ? (
                        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                          {h.description}
                        </Text>
                      ) : null}
                      <View className="flex-row flex-wrap items-center gap-3">
                        <View className="flex-row items-center gap-1">
                          <Icon as={Calendar} className="text-muted-foreground size-3" />
                          <Text className="text-muted-foreground text-xs">{k('due', { date: formatDate(h.due_date) })}</Text>
                        </View>
                        {h.teacher_name ? <Text className="text-muted-foreground text-xs">{k('by', { name: h.teacher_name })}</Text> : null}
                      </View>
                    </View>
                    {h.marks_obtained !== undefined && h.marks_obtained !== null ? (
                      <Badge className="bg-green-500">
                        <Text className="text-white">{`${h.marks_obtained}/${h.total_marks || 100}`}</Text>
                      </Badge>
                    ) : null}
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Stat({ icon, box, iconTone, value, label, valueTone }: { icon: LucideIcon; box: string; iconTone: string; value: number; label: string; valueTone?: string }) {
  return (
    <Card className="flex-1">
      <CardContent className="items-center gap-1.5 p-3">
        <View className={cn('rounded-full p-2', box)}>
          <Icon as={icon} className={cn('size-5', iconTone)} />
        </View>
        <Text className={cn('text-2xl font-bold', valueTone)}>{String(value)}</Text>
        <Text className="text-muted-foreground text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
