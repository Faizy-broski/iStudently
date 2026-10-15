import type { AdminActivity } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { longDate, useAc } from '@/features/admin/activities';
import { useCampus } from '@/features/campus/campus';
import { adminActivities } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The activities a student is in; add or remove one (web: /admin/activities, StudentDetailView). */
export default function StudentActivities() {
  const a = useAc();
  const { i18n } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const { id, name, number } = useLocalSearchParams<{ id: string; name?: string; number?: string }>();
  const studentId = id ?? null;
  // All activities, then each one's roster to find the student's (as the web does).
  const res = useApi(studentId ? ['admin', 'student-activities', campusId ?? 'school', studentId] : null, async ([, , , sid]) => {
    const all = await adminActivities.activities(campusId);
    if (!all.success) return { ...all, data: undefined };
    const list = all.data ?? [];
    const rosters = await Promise.all(list.map((act) => adminActivities.activityStudents(act.id)));
    const enrolled = list.filter((_, i) => (rosters[i].data ?? []).some((r) => r.student_id === sid));
    return { success: true as const, data: { all: list, enrolled } };
  });
  const [addId, setAddId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function add() {
    if (!addId || !studentId) return;
    setAdding(true);
    try {
      const r = await adminActivities.enrollStudents(addId, [studentId], campusId);
      if (!r.success) return toast.error(r.error || a('failedToAddActivityToStudent'));
      toast.success(a('studentAddedToActivity'));
      setAddId('');
      res.mutate();
    } finally {
      setAdding(false);
    }
  }
  async function remove(act: AdminActivity) {
    if (!studentId) return;
    setRemovingId(act.id);
    try {
      const r = await adminActivities.unenrollStudent(act.id, studentId);
      if (!r.success) return toast.error(r.error || a('failedToRemoveActivity'));
      toast.success(a('removedFromActivity'));
      res.mutate();
    } finally {
      setRemovingId(null);
    }
  }

  const enrolled = res.data?.enrolled ?? [];
  const enrolledIds = new Set(enrolled.map((e) => e.id));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('studentScreen') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-lg font-semibold">
          {name || '—'}
          {number ? <Text className="text-muted-foreground text-sm font-normal"> #{number}</Text> : null}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={res.error.message || a('failedToLoadStudentActivities')} onRetry={() => res.mutate()} />
        ) : (
          <Card>
            <CardContent className="py-2">
              <Text className="text-muted-foreground pb-2 text-sm">{a('activitiesFound', { count: enrolled.length })}</Text>
              {enrolled.map((act) => (
                <View key={act.id}>
                  <Separator />
                  <View className="flex-row items-center gap-3 py-2.5">
                    <Button size="icon" variant="outline" className="border-destructive size-8" onPress={() => remove(act)} disabled={removingId === act.id} accessibilityLabel={a('failedToRemoveActivity')}>
                      <Icon as={Minus} className="text-destructive size-4" />
                    </Button>
                    <View className="flex-1">
                      <Text className="font-medium">{act.title}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {a('starts')}: {longDate(act.start_date, i18n.language)} · {a('ends')}: {longDate(act.end_date, i18n.language)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <Separator />
              <View className="flex-row items-center gap-2 py-2.5">
                <Picker
                  className="flex-1"
                  value={addId || '__none__'}
                  onChange={(v) => setAddId(v === '__none__' ? '' : v)}
                  placeholder={a('selectActivityPlaceholder')}
                  options={[
                    { value: '__none__', label: a('notApplicable') },
                    ...(res.data?.all ?? []).map((x) => (enrolledIds.has(x.id) ? { value: x.id, label: a('activityOptionEnrolled', { title: x.title }), disabled: true } : { value: x.id, label: x.title })),
                  ]}
                />
                <Button size="sm" onPress={add} disabled={!addId || adding}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{a('addShort')}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
