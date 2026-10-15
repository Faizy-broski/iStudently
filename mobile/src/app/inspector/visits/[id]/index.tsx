import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Building2, Calendar, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, FileText, GraduationCap, LogIn, Plus, User, Users, X, XCircle, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { VISIT_STATUS_TONE } from '@/features/inspector/ui';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const NONE = '__none__';

/** One visit: check in, complete, observe, coaching, report, reschedule, cancel, and the teachers to observe (web: /inspector/visits/[id]). */
export default function InspectionVisitDetail() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['inspector', 'visit', id] : null, ([, , v]) => inspector.visit(v as string));
  const v = res.data;
  const schoolId = v?.school_id ?? null;
  const teachers = useApi(schoolId ? ['inspector', 'school-teachers', schoolId] : null, ([, , s]) => inspector.teachersForSchool(s as string));
  const subjects = useApi(schoolId ? ['inspector', 'school-subjects', schoolId] : null, ([, , s]) => inspector.subjectsForSchool(s as string));
  const [acting, setActing] = useState(false);
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | 'teacher' | null>(null);
  const [reason, setReason] = useState('');
  const [rs, setRs] = useState({ date: '', start: '', end: '' });
  const [pick, setPick] = useState({ teacher: '', subject: '' });

  const refresh = () => {
    res.mutate();
    mutate(['inspector', 'visits']);
  };
  async function run(p: Promise<{ success: boolean; error?: string | null }>, ok: string) {
    setActing(true);
    const r = await p;
    setActing(false);
    if (!r.success) {
      toast.error(r.error || t('common.error'));
      return false;
    }
    toast.success(k(ok));
    refresh();
    return true;
  }

  if (res.isLoading) return <LoadingList rows={4} />;
  if (!v || !id) return <Text className="text-muted-foreground p-6 text-center">{k('visit_not_found')}</Text>;
  const canEdit = v.status === 'scheduled' || v.status === 'confirmed';
  const open = !['cancelled', 'rescheduled'].includes(v.status);
  const tone = VISIT_STATUS_TONE[v.status];
  const current = v.teachers.map((vt) => ({ teacher_profile_id: vt.teacher_profile_id, subject_id: vt.subject_id }));
  const go = (path: Href) => router.push(path);

  async function reschedule() {
    if (!rs.date || !id) return;
    setActing(true);
    const r = await inspector.reschedule(id, { scheduled_date: rs.date, scheduled_start_time: rs.start || undefined, scheduled_end_time: rs.end || undefined });
    setActing(false);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_rescheduled'));
    setDialog(null);
    mutate(['inspector', 'visits']);
    router.replace({ pathname: '/inspector/visits/[id]', params: { id: r.data.id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: v.school?.name || k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <Card>
          <CardHeader className="gap-2">
            <View className="flex-row items-start gap-2">
              <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Building2} className="size-5 text-[#022172] dark:text-blue-300" />
                  <CardTitle className="flex-1">{v.school?.name || v.school_id}</CardTitle>
                </View>
                <View className="flex-row items-center gap-1">
                  <Icon as={Calendar} className="text-muted-foreground size-3.5" />
                  <Text className="text-muted-foreground text-sm">
                    {`${v.scheduled_date}${v.scheduled_start_time ? ` · ${v.scheduled_start_time}${v.scheduled_end_time ? ` - ${v.scheduled_end_time}` : ''}` : ''}`}
                  </Text>
                </View>
              </View>
              <View className="items-end gap-1">
                <View className={cn('rounded-full px-2 py-0.5', tone.split(' ')[0])}>
                  <Text className={cn('text-xs', tone.split(' ')[1])}>{k(`status_${v.status}`)}</Text>
                </View>
                <Badge variant="secondary">
                  <Text className="text-[10px]">{k(`visit_type_${v.visit_type}`)}</Text>
                </Badge>
              </View>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            {v.purpose ? (
              <View>
                <Text className="text-muted-foreground text-xs">{k('field_purpose')}</Text>
                <Text className="text-sm">{v.purpose}</Text>
              </View>
            ) : null}
            {v.status === 'cancelled' && v.cancellation_reason ? (
              <Text className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30">{`${k('cancellation_reason_label')}: ${v.cancellation_reason}`}</Text>
            ) : null}
            {v.status === 'rescheduled' ? <Text className="bg-muted text-muted-foreground rounded-md p-3 text-sm">{k('rescheduled_notice')}</Text> : null}
            <View className="flex-row flex-wrap gap-2">
              {canEdit ? <Action icon={LogIn} label={k('btn_check_in')} primary disabled={acting} onPress={() => run(inspector.checkIn(id), 'msg_checked_in')} /> : null}
              {v.status === 'in_progress' ? <Action icon={CheckCircle2} label={k('btn_complete')} primary disabled={acting} onPress={() => run(inspector.complete(id), 'msg_completed')} /> : null}
              {['scheduled', 'confirmed', 'in_progress'].includes(v.status) ? (
                <Action icon={ClipboardCheck} label={k('btn_observe')} onPress={() => go({ pathname: '/inspector/visits/[id]/observe', params: { id } })} />
              ) : null}
              {open ? <Action icon={GraduationCap} label={k('btn_coaching')} onPress={() => go({ pathname: '/inspector/visits/[id]/coaching', params: { id } })} /> : null}
              {open ? <Action icon={FileText} label={k('btn_report')} onPress={() => go({ pathname: '/inspector/visits/[id]/report', params: { id } })} /> : null}
              {canEdit ? (
                <Action
                  icon={CalendarClock}
                  label={k('btn_reschedule')}
                  onPress={() => {
                    setRs({ date: '', start: '', end: '' });
                    setDialog('reschedule');
                  }}
                />
              ) : null}
              {canEdit ? (
                <Action
                  icon={XCircle}
                  label={k('btn_cancel_visit')}
                  destructive
                  onPress={() => {
                    setReason('');
                    setDialog('cancel');
                  }}
                />
              ) : null}
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Icon as={Users} className="size-5 text-[#022172] dark:text-blue-300" />
              <CardTitle className="text-base">{k('teachers_title')}</CardTitle>
            </View>
            {canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setPick({ teacher: '', subject: '' });
                  setDialog('teacher');
                }}>
                <Icon as={Plus} className="size-4" />
                <Text>{k('btn_add_teacher')}</Text>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="gap-2">
            {!v.teachers.length ? (
              <Text className="text-muted-foreground py-2 text-sm">{k('no_teachers')}</Text>
            ) : (
              v.teachers.map((vt) => (
                <View key={vt.id} className="border-border flex-row items-center gap-2 rounded-md border p-2.5">
                  <Pressable
                    className="flex-1 flex-row items-center gap-2"
                    onPress={() => go({ pathname: '/inspector/teachers/[teacherId]', params: { teacherId: vt.teacher_profile_id } })}
                    accessibilityRole="link">
                    <Icon as={User} className="text-muted-foreground size-4" />
                    <Text className="text-sm">{vt.teacher ? `${vt.teacher.first_name} ${vt.teacher.last_name}` : vt.teacher_profile_id}</Text>
                    {vt.subject ? (
                      <Badge variant="outline">
                        <Text className="text-[10px]">{vt.subject.name}</Text>
                      </Badge>
                    ) : null}
                    <Icon as={ChevronRight} className="text-muted-foreground size-3.5 rtl:rotate-180" />
                  </Pressable>
                  {canEdit ? (
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel={t('common.delete')}
                      onPress={() =>
                        run(
                          inspector.setTeachers(
                            id,
                            current.filter((x) => !(x.teacher_profile_id === vt.teacher_profile_id && x.subject_id === vt.subject_id)),
                          ),
                          'msg_teacher_removed',
                        )
                      }>
                      <Icon as={X} className="text-destructive size-4" />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          {dialog === 'cancel' ? (
            <>
              <DialogHeader>
                <DialogTitle>{k('dialog_cancel_title')}</DialogTitle>
                <DialogDescription>{k('dialog_cancel_desc')}</DialogDescription>
              </DialogHeader>
              <View className="gap-1.5">
                <Label>{k('field_cancellation_reason')}</Label>
                <Textarea value={reason} onChangeText={setReason} numberOfLines={3} />
              </View>
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={acting}
                  onPress={async () => {
                    if (await run(inspector.cancel(id, reason.trim() || undefined), 'msg_cancelled')) setDialog(null);
                  }}>
                  <Icon as={XCircle} className="size-4 text-white" />
                  <Text className="text-white">{k('btn_confirm_cancel')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : dialog === 'reschedule' ? (
            <>
              <DialogHeader>
                <DialogTitle>{k('dialog_reschedule_title')}</DialogTitle>
                <DialogDescription>{k('dialog_reschedule_desc')}</DialogDescription>
              </DialogHeader>
              <View className="gap-3">
                <DateField label={k('field_date')} value={rs.date || null} onChange={(d) => setRs({ ...rs, date: d })} />
                <View className="flex-row gap-2">
                  <TimeField className="flex-1" label={k('field_start_time')} value={rs.start} onChange={(x) => setRs({ ...rs, start: x })} />
                  <TimeField className="flex-1" label={k('field_end_time')} value={rs.end} onChange={(x) => setRs({ ...rs, end: x })} />
                </View>
              </View>
              <DialogFooter>
                <Button onPress={reschedule} disabled={acting || !rs.date}>
                  <Icon as={CalendarClock} className="text-primary-foreground size-4" />
                  <Text>{k('btn_confirm_reschedule')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : dialog === 'teacher' ? (
            <>
              <DialogHeader>
                <DialogTitle>{k('dialog_add_teacher_title')}</DialogTitle>
              </DialogHeader>
              <View className="gap-3">
                <View className="gap-1.5">
                  <Label>{k('field_teacher')}</Label>
                  <Picker
                    value={pick.teacher || null}
                    onChange={(x) => setPick({ ...pick, teacher: x })}
                    placeholder={k('field_teacher_placeholder')}
                    options={(teachers.data ?? []).map((tc) => ({ value: tc.id, label: `${tc.first_name} ${tc.last_name}` }))}
                  />
                </View>
                <View className="gap-1.5">
                  <Label>{k('field_subject_optional')}</Label>
                  <Picker
                    value={pick.subject || NONE}
                    onChange={(x) => setPick({ ...pick, subject: x === NONE ? '' : x })}
                    placeholder={k('field_subject_placeholder')}
                    options={[{ value: NONE, label: '—' }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                  />
                </View>
              </View>
              <DialogFooter>
                <Button
                  disabled={acting || !pick.teacher}
                  onPress={async () => {
                    if (await run(inspector.setTeachers(id, [...current, { teacher_profile_id: pick.teacher, subject_id: pick.subject || null }]), 'msg_teacher_added')) setDialog(null);
                  }}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{k('btn_add')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Action({ icon, label, onPress, primary, destructive, disabled }: { icon: LucideIcon; label: string; onPress: () => void; primary?: boolean; destructive?: boolean; disabled?: boolean }) {
  return (
    <Button size="sm" variant={primary ? 'default' : 'outline'} onPress={onPress} disabled={disabled}>
      <Icon as={icon} className={cn('size-4', primary && 'text-primary-foreground', destructive && 'text-destructive')} />
      <Text className={cn(destructive && 'text-destructive')}>{label}</Text>
    </Button>
  );
}
