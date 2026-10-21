import { Stack, useLocalSearchParams } from 'expo-router';
import { LogOut, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { CheckMark, Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { CirclePicker, enrollmentName, NoCircles, useHifziCircles, useHifziRoster, useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi, adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

type Hit = { id: string; name: string; detail: string };

/** The library student search (name or student number); rows come flat or with a joined profile. */
function useStudentSearch(q: string) {
  const { campusId } = useCampus();
  const term = useDebounced(q.trim(), 300);
  const res = useApi(term.length >= 2 ? ['admin', 'hifzi-student-search', term, campusId ?? 'school'] : null, ([, , s]) => adminLibrary.searchStudents(s as string, campusId));
  const hits: Hit[] = ((res.data ?? []) as Record<string, any>[]).map((r) => ({
    id: r.id,
    name: `${r.profile?.first_name ?? r.first_name ?? ''} ${r.profile?.last_name ?? r.last_name ?? ''}`.trim() || r.student_number || r.admission_number,
    detail: [r.student_number ?? r.admission_number, r.grade_level ?? r.class_name ?? 'N/A'].filter(Boolean).join(' · '),
  }));
  return { hits, loading: res.isLoading, ready: term.length >= 2 };
}

function EnrollOne({ circleId, onClose, onEnrolled }: { circleId: string; onClose: () => void; onEnrolled: () => void }) {
  const { h, a } = useHz('students');
  const toast = useToast();
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const { hits, loading, ready } = useStudentSearch(q);

  async function enroll(id: string) {
    setBusy(id);
    try {
      const res = await adminHifzi.enroll(circleId, id, campusId);
      if (!res.success) return toast.error(res.error || a('hz_enroll_failed'));
      toast.success(h('enroll'));
      setDone((d) => [...d, id]);
      setQ('');
      onEnrolled();
    } finally {
      setBusy(null);
    }
  }

  const shown = hits.filter((s) => !done.includes(s.id));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          <DialogHeader>
            <DialogTitle>{h('enroll')}</DialogTitle>
            <DialogDescription>{h('title')}</DialogDescription>
          </DialogHeader>
          <SearchBar value={q} onChangeText={setQ} placeholder={a('hz_search_student')} />
          {ready ? (
            loading && !shown.length ? (
              <Text className="text-muted-foreground text-sm">{a('hz_searching')}</Text>
            ) : !shown.length ? (
              <Text className="text-muted-foreground text-sm">{a('hz_no_students')}</Text>
            ) : (
              shown.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={() => enroll(s.id)} disabled={busy === s.id} className="flex-row items-center gap-2 px-1 py-2.5">
                    <View className="flex-1">
                      <Text>{s.name}</Text>
                      <Text className="text-muted-foreground text-xs">{s.detail}</Text>
                    </View>
                    <Icon as={UserPlus} className="text-primary size-4" />
                  </Pressable>
                </View>
              ))
            )
          ) : null}
          <Button variant="outline" onPress={onClose}>
            <Text>{a('hz_close')}</Text>
          </Button>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

function EnrollBulk({ circleId, onClose, onEnrolled }: { circleId: string; onClose: () => void; onEnrolled: () => void }) {
  const { h, a } = useHz('students');
  const toast = useToast();
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const { hits, loading, ready } = useStudentSearch(q);

  const toggle = (s: Hit) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.set(s.id, s.name);
      return next;
    });

  async function submit() {
    if (!selected.size) return;
    setSaving(true);
    try {
      const res = await adminHifzi.enrollBulk(circleId, [...selected.keys()], campusId);
      if (!res.success || !res.data) return toast.error(res.error || a('hz_enroll_failed'));
      if (res.data.success_count > 0) toast.success(a('hz_enrolled_n', { count: res.data.success_count }));
      if (res.data.error_count > 0) toast.error(a('hz_enroll_errors_n', { count: res.data.error_count }));
      onEnrolled();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          <DialogHeader>
            <DialogTitle>{a('hz_bulk_enroll')}</DialogTitle>
            <DialogDescription>{h('title')}</DialogDescription>
          </DialogHeader>
          <SearchBar value={q} onChangeText={setQ} placeholder={a('hz_search_student')} />
          {!ready ? (
            <Text className="text-muted-foreground text-sm">{a('hz_type_two')}</Text>
          ) : !hits.length && !loading ? (
            <Text className="text-muted-foreground text-sm">{a('hz_no_students')}</Text>
          ) : (
            hits.map((s, i) => {
              const on = selected.has(s.id);
              return (
                <View key={s.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={() => toggle(s)} className="flex-row items-center gap-3 px-1 py-2.5" accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <CheckMark on={on} />
                    <Text className="flex-1">{s.name}</Text>
                  </Pressable>
                </View>
              );
            })
          )}
          {selected.size ? <Text className="text-muted-foreground text-xs">{a('hz_selected_n', { count: selected.size })}</Text> : null}
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
              <Text>{a('hz_cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={submit} disabled={!selected.size || saving}>
              <Text>{a('hz_enroll_n', { count: selected.size })}</Text>
            </Button>
          </View>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

/** Circle rosters: enroll one, bulk enroll, withdraw (web: /admin/hifzi/students). */
export default function HifziStudents() {
  const { h, a } = useHz('students');
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const params = useLocalSearchParams<{ circle_id?: string }>();
  const circles = useHifziCircles();
  const list = circles.data ?? [];
  const [picked, setPicked] = useState(params.circle_id ?? '');
  const circleId = list.some((c) => c.id === picked) ? picked : (list[0]?.id ?? '');
  const roster = useHifziRoster(circleId || null);
  const [dialog, setDialog] = useState<'one' | 'bulk' | null>(null);

  async function withdraw(enrollmentId: string, name: string) {
    if (!(await confirm({ title: `${h('withdraw')}: ${name}`, destructive: true, confirmLabel: h('withdraw') }))) return;
    const res = await adminHifzi.withdraw(enrollmentId, campusId);
    if (!res.success) return toast.error(res.error || a('hz_failed'));
    toast.success(h('withdraw'));
    roster.mutate();
  }

  const rows = roster.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => roster.mutate()} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : circles.error ? (
          <ErrorState message={circles.error.message} onRetry={() => circles.mutate()} />
        ) : !list.length ? (
          <NoCircles />
        ) : (
          <>
            <CirclePicker circles={list} value={circleId} onChange={setPicked} />
            <View className="flex-row gap-2">
              <Button className="flex-1" onPress={() => setDialog('one')} disabled={!circleId}>
                <Icon as={UserPlus} className="text-primary-foreground size-4" />
                <Text>{h('enroll')}</Text>
              </Button>
              <Button variant="outline" className="flex-1" onPress={() => setDialog('bulk')} disabled={!circleId}>
                <Icon as={Users} className="text-foreground size-4" />
                <Text>{a('hz_bulk_enroll')}</Text>
              </Button>
            </View>
            {roster.isLoading ? (
              <LoadingList rows={4} />
            ) : roster.error ? (
              <ErrorState message={roster.error.message} onRetry={() => roster.mutate()} />
            ) : !rows.length ? (
              <EmptyState title={h('noStudents')} />
            ) : (
              <Card>
                <CardContent className="py-1">
                  {rows.map((e, i) => (
                    <View key={e.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="flex-row items-center gap-3 py-2.5">
                        <Initials name={enrollmentName(e) || '?'} />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold">{enrollmentName(e)}</Text>
                          <Text className="text-muted-foreground text-xs">{e.students?.student_number}</Text>
                        </View>
                        <Button size="sm" variant="outline" onPress={() => withdraw(e.id, enrollmentName(e))}>
                          <Icon as={LogOut} className="text-foreground size-3.5" />
                          <Text>{h('withdraw')}</Text>
                        </Button>
                      </View>
                    </View>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
      {dialog === 'one' && circleId ? <EnrollOne circleId={circleId} onClose={() => setDialog(null)} onEnrolled={() => roster.mutate()} /> : null}
      {dialog === 'bulk' && circleId ? <EnrollBulk circleId={circleId} onClose={() => setDialog(null)} onEnrolled={() => roster.mutate()} /> : null}
    </View>
  );
}
