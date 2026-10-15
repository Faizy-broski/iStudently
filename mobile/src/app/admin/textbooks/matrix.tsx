import type { DeliveryMatrix } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { BarcodeScanDialog } from '@/components/app/barcode-scan';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { GradeSectionPicker } from '@/features/admin/textbooks';
import { useCampus } from '@/features/campus/campus';
import { adminTextbooks } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Tick each textbook as it's handed to a student; every change saves at once. Students with overdue
 * fees are blocked unless an admin overrides (web: /admin/textbooks/matrix).
 */
export default function TextbookMatrix() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`textbooks.matrix.${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const role = me.status === 'ready' ? me.me.profile.role : null;
  const canOverride = role === 'admin' || role === 'super_admin';
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const res = useApi(section ? ['admin', 'textbook-matrix', campusId ?? 'school', section] : null, ([, , , sid]) => adminTextbooks.matrix({ section_id: sid as string, campus_id: campusId }));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [manual, setManual] = useState('');
  const matrix = res.data;

  const key = (s: string, b: string) => `${s}:${b}`;
  const mark = (keys: string[], on: boolean) =>
    setPending((p) => {
      const n = new Set(p);
      for (const k of keys) (on ? n.add(k) : n.delete(k));
      return n;
    });

  // Optimistic local update of the SWR matrix.
  const patch = (items: { studentId: string; bookId: string }[], delivered: boolean) =>
    res.mutate(
      (cur?: DeliveryMatrix) =>
        cur && {
          ...cur,
          students: cur.students.map((s) => {
            const mine = items.filter((i) => i.studentId === s.id);
            if (!mine.length) return s;
            const deliveries = { ...s.deliveries };
            for (const i of mine) deliveries[i.bookId] = { ...(deliveries[i.bookId] ?? { id: '', student_id: s.id, book_id: i.bookId, delivered_at: null, return_status: 'pending', condition: null }), is_delivered: delivered };
            return { ...s, deliveries };
          }),
        },
      { revalidate: false },
    );

  async function toggleCell(studentId: string, bookId: string, next: boolean, override?: boolean) {
    const k = key(studentId, bookId);
    mark([k], true);
    try {
      const r = await adminTextbooks.sync({ student_id: studentId, book_id: bookId, is_delivered: next, override });
      if (!r.success) {
        toast.error(r.error || m('updateFailed'));
        return;
      }
      await patch([{ studentId, bookId }], next);
      res.mutate();
    } finally {
      mark([k], false);
    }
  }

  async function toggleAll(items: { studentId: string; bookId: string }[], next: boolean, blockedMsg: 'bulkBlockedBooks' | 'bulkBlockedStudents') {
    const keys = items.map((i) => key(i.studentId, i.bookId));
    mark(keys, true);
    try {
      const r = await adminTextbooks.bulkSync(items.map((i) => ({ student_id: i.studentId, book_id: i.bookId, is_delivered: next })));
      if (!r.success || !r.data) return toast.error(r.error || m('bulkUpdateFailed'));
      if (r.data.blocked.length) toast.error(m(blockedMsg, { count: r.data.blocked.length }));
      res.mutate();
      return r.data.blocked.length;
    } finally {
      mark(keys, false);
    }
  }

  async function onScan(code: string) {
    if (!matrix) return;
    const s = matrix.students.find((x) => x.student_number === code);
    if (!s) return toast.error(m('scanNotFound', { code }));
    await toggleAll(
      matrix.books.map((b) => ({ studentId: s.id, bookId: b.id })),
      true,
      'bulkBlockedBooks',
    );
    toast.success(m('scanSuccess', { name: s.name }));
  }

  const tri = (flags: boolean[]) => (flags.length > 0 && flags.every(Boolean) ? true : false);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: m('pageTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{m('pageSubtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/textbooks')}>
            <Text>{m('catalogLink')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/textbooks/return-mode')}>
            <Text>{m('returnModeLink')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/textbooks/dashboard')}>
            <Text>{m('missingBooksLink')}</Text>
          </Button>
        </View>
        <GradeSectionPicker ns="matrix" grade={grade} section={section} onGrade={setGrade} onSection={setSection} />

        {!section ? (
          <Text className="text-muted-foreground text-sm">{m('selectPrompt')}</Text>
        ) : res.isLoading ? (
          <LoadingList />
        ) : res.error ? (
          <Text className="text-destructive">{res.error.message}</Text>
        ) : matrix && !matrix.books.length ? (
          <Pressable onPress={() => router.push('/admin/textbooks')}>
            <Text className="text-muted-foreground text-sm">
              {m('noBooksPart1')} <Text className="text-primary text-sm underline">{m('noBooksLink')}</Text>.
            </Text>
          </Pressable>
        ) : matrix ? (
          <>
            <View className="flex-row items-center gap-2">
              <Input className="flex-1" value={manual} onChangeText={setManual} placeholder={t('app.tb_student_number')} autoCapitalize="none" onSubmitEditing={() => { if (manual.trim()) onScan(manual.trim()); setManual(''); }} />
              <Button variant="outline" onPress={() => setScanOpen(true)} accessibilityLabel={t('app.scan_title')}>
                <Icon as={ScanLine} className="text-foreground size-4" />
                <Text>{t('app.scan_short')}</Text>
              </Button>
            </View>

            <Card>
              <CardContent className="gap-2 pt-4">
                <Text className="font-semibold">{t('app.tb_books')}</Text>
                {matrix.books.map((b, i) => {
                  const flags = matrix.students.map((s) => s.deliveries[b.id]?.is_delivered ?? false);
                  return (
                    <View key={b.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="flex-row items-center gap-3 py-2">
                        <View className="flex-1">
                          <Text className="text-sm font-medium">{b.title}</Text>
                          <Text className="text-muted-foreground text-xs">{m('stockLabel', { count: b.stock_quantity })}</Text>
                        </View>
                        <Text className="text-muted-foreground text-xs">{m('allCol')}</Text>
                        <Checkbox
                          checked={tri(flags)}
                          accessibilityLabel={m('colCheckAllTitle', { title: b.title })}
                          onCheckedChange={(v) => toggleAll(matrix.students.map((s) => ({ studentId: s.id, bookId: b.id })), v, 'bulkBlockedStudents')}
                        />
                      </View>
                    </View>
                  );
                })}
              </CardContent>
            </Card>

            {matrix.students.map((s) => {
              const flags = matrix.books.map((b) => s.deliveries[b.id]?.is_delivered ?? false);
              return (
                <Card key={s.id} className={s.has_overdue_payments ? 'border-red-200 dark:border-red-900' : ''}>
                  <CardContent className="gap-2 pt-4">
                    <View className="flex-row items-center gap-2">
                      <View className="flex-1">
                        <Text className="font-medium">{s.name}</Text>
                        <Text className="text-muted-foreground text-xs">{s.student_number}</Text>
                      </View>
                      {s.has_overdue_payments ? (
                        <View className="bg-destructive rounded-full px-2 py-0.5">
                          <Text className="text-xs text-white">{m('overdueBadge')}</Text>
                        </View>
                      ) : null}
                      <Text className="text-muted-foreground text-xs">{m('allCol')}</Text>
                      <Checkbox
                        checked={tri(flags)}
                        disabled={s.has_overdue_payments && !canOverride}
                        accessibilityLabel={m('rowCheckAllTitle', { name: s.name })}
                        onCheckedChange={(v) => toggleAll(matrix.books.map((b) => ({ studentId: s.id, bookId: b.id })), v, 'bulkBlockedBooks')}
                      />
                    </View>
                    <Separator />
                    {matrix.books.map((b) => {
                      const d = s.deliveries[b.id];
                      const delivered = !!d?.is_delivered;
                      const blocked = s.has_overdue_payments && !delivered;
                      const busy = pending.has(key(s.id, b.id));
                      return (
                        <View key={b.id} className="flex-row items-center gap-3 py-1">
                          <Text className="flex-1 text-sm">{b.title}</Text>
                          {busy ? (
                            <ActivityIndicator size="small" />
                          ) : (
                            <>
                              {blocked && canOverride ? (
                                <Button size="sm" variant="ghost" onPress={() => toggleCell(s.id, b.id, true, true)}>
                                  <Text className="text-xs text-amber-700">{m('override')}</Text>
                                </Button>
                              ) : null}
                              <Checkbox checked={delivered} disabled={blocked && !canOverride} onCheckedChange={(v) => toggleCell(s.id, b.id, v)} accessibilityLabel={`${s.name} ${b.title}`} />
                            </>
                          )}
                        </View>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>
      <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onScan={onScan} />
    </View>
  );
}
