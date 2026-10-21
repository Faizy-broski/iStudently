import type { TextbookCondition } from '@studently/api-client';
import { BookOpen } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { GradeSectionPicker } from '@/features/admin/textbooks';
import { useCampus } from '@/features/campus/campus';
import { adminTextbooks } from '@/lib/api';
import { useApi } from '@/lib/data';

/** End-of-year returns: status and condition of each delivered textbook (web: /admin/textbooks/return-mode). */
export default function TextbookReturnMode() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`textbooks.returnMode.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const res = useApi(section ? ['admin', 'textbook-matrix', campusId ?? 'school', section] : null, ([, , , sid]) => adminTextbooks.matrix({ section_id: sid as string, campus_id: campusId }));
  const [saving, setSaving] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const matrix = res.data;

  const statuses = [
    { value: 'pending', label: r('statusPending') },
    { value: 'returned', label: r('statusReturned') },
    { value: 'lost', label: r('statusLost') },
  ];
  const conditions = [
    { value: 'new', label: r('conditionNew') },
    { value: 'good', label: r('conditionGood') },
    { value: 'damaged', label: r('conditionDamaged') },
  ];

  async function update(id: string, status: string, condition?: string) {
    setSaving(id);
    try {
      const x = await adminTextbooks.returnDelivery(id, { return_status: status as 'returned' | 'lost', condition: (condition || undefined) as TextbookCondition | undefined });
      if (!x.success) return toast.error(x.error || r('updateFailed'));
      res.mutate();
    } finally {
      setSaving(null);
    }
  }

  async function markAll() {
    if (!matrix) return;
    const ids = matrix.students.flatMap((s) => matrix.books.map((b) => s.deliveries[b.id])).filter((d) => d && d.is_delivered && d.return_status === 'pending').map((d) => d!.id);
    if (!ids.length) return toast.error(r('nothingPending'));
    setBulk(true);
    try {
      const x = await adminTextbooks.bulkReturn(ids.map((id) => ({ id, return_status: 'returned' as const })));
      if (!x.success) return toast.error(x.error || r('bulkUpdateFailed'));
      toast.success(r('markedReturned', { count: ids.length }));
      res.mutate();
    } finally {
      setBulk(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: r('pageTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{r('pageSubtitle')}</Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => router.push('/admin/textbooks/matrix')}>
          <Text>{r('backLink')}</Text>
        </Button>
        <GradeSectionPicker ns="returnMode" grade={grade} section={section} onGrade={setGrade} onSection={setSection} />
        {matrix ? (
          <Button variant="outline" onPress={markAll} disabled={bulk}>
            <Text>{r('markAllReturned')}</Text>
          </Button>
        ) : null}
        {!section ? (
          <EmptyState icon={BookOpen} title={r('selectPrompt')} />
        ) : res.isLoading ? (
          <LoadingList />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : matrix ? (
          matrix.students.map((s) => (
            <Card key={s.id}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-center gap-3">
                  <Initials name={s.name || '?'} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{s.name}</Text>
                    <Text className="text-muted-foreground text-xs">{s.student_number}</Text>
                  </View>
                </View>
                {matrix.books.map((b, i) => {
                  const d = s.deliveries[b.id];
                  return (
                    <View key={b.id} className="gap-1.5">
                      {i > 0 ? <Separator /> : null}
                      <Text className="text-sm font-semibold">{b.title}</Text>
                      {!d || !d.is_delivered ? (
                        <Text className="text-muted-foreground text-xs">{r('notDelivered')}</Text>
                      ) : (
                        <View className="flex-row gap-2" pointerEvents={saving === d.id ? 'none' : 'auto'} style={{ opacity: saving === d.id ? 0.5 : 1 }}>
                          <View className="flex-1">
                            <Picker value={d.return_status} onChange={(v) => update(d.id, v, d.condition || undefined)} options={statuses} />
                          </View>
                          <View className="flex-1">
                            <Picker value={d.condition || ''} onChange={(v) => update(d.id, d.return_status, v)} placeholder={r('conditionPlaceholder')} options={conditions} />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </CardContent>
            </Card>
          ))
        ) : null}
      </ScrollView>
    </View>
  );
}
