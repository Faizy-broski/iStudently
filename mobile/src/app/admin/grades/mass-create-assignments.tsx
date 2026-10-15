import { coursePeriodTeacherName } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminCourses, adminGrades, adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const num = (v: string) => v.replace(/[^\d.]/g, '');

/** One assignment created in many course periods at once (web: /admin/grades/mass-create-assignments). */
export default function MassCreateAssignments() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.mass_create_assignments.${k}`, o);
  const tc = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.common.${k}`, o);
  const toast = useToast();
  const { campusId, campus } = useCampus();
  const types = useApi(['admin', 'assignment-types', campusId ?? 'school'], () => adminGrades.assignmentTypes(campusId));
  const cps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const cap = (settings.data as Record<string, unknown> | undefined)?.assignment_max_points;
  const maxPoints = typeof cap === 'number' ? cap : null;

  const [typeId, setTypeId] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [defaultPoints, setDefaultPoints] = useState('');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [assigned, setAssigned] = useState(todayYmd());
  const [due, setDue] = useState('');
  const [submission, setSubmission] = useState(false);
  const [busy, setBusy] = useState(false);

  const typeList = types.data ?? [];
  const activeType = typeId ?? typeList[0]?.id ?? null;
  const cpList = cps.data ?? [];
  const overCap = maxPoints != null && (parseFloat(points) || 0) > maxPoints;
  const allSel = cpList.length > 0 && selected.size === cpList.length;
  const mpName = (id?: string | null) => (id ? ((mps.data ?? []).find((x) => x.id === id)?.title ?? tc('na')) : tc('na'));

  async function addType() {
    if (!newType?.trim()) return;
    setBusy(true);
    try {
      const r = await adminGrades.createAssignmentType({ title: newType.trim(), sort_order: typeList.length + 1, campus_id: campusId });
      if (!r.success || !r.data) return toast.error(r.error || m('toast_type_create_failed'));
      toast.success(m('toast_type_created'));
      setTypeId(r.data.id);
      setNewType(null);
      types.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!title.trim()) return toast.error(m('title_required'));
    if (!points || parseFloat(points) <= 0) return toast.error(m('points_positive'));
    if (!activeType) return toast.error(m('select_type_error'));
    if (!selected.size) return toast.error(m('select_period_error'));
    setBusy(true);
    try {
      const r = await adminGrades.massCreateAssignment({
        title: title.trim(),
        assignment_type_id: activeType,
        points: parseFloat(points),
        default_points: defaultPoints ? parseFloat(defaultPoints) : null,
        weight: weight ? parseFloat(weight) : null,
        description: description.trim() || null,
        assigned_date: assigned || null,
        due_date: due || null,
        enable_submission: submission,
        course_period_ids: [...selected],
      });
      if (!r.success) return toast.error(r.error || m('toast_create_failed'));
      toast.success(m('toast_assignment_created_count', { count: r.data?.created_count || selected.size }));
      setTitle('');
      setPoints('');
      setDefaultPoints('');
      setWeight('');
      setDescription('');
      setDue('');
      setSubmission(false);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: m('title') }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">
            {m('subtitle')}
            {campus ? ` — ${campus.name}` : ''}
          </Text>
          <Card>
            <CardContent className="gap-3 pt-4">
              <View className="gap-1.5">
                <Label>{m('field_title')}</Label>
                <Input value={title} onChangeText={setTitle} placeholder={m('assignment_title_placeholder')} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{m('points')} *</Label>
                  <Input value={points} onChangeText={(v) => setPoints(num(v))} keyboardType="decimal-pad" placeholder={m('points_placeholder')} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{m('default_points')}</Label>
                  <Input value={defaultPoints} onChangeText={(v) => setDefaultPoints(num(v))} keyboardType="decimal-pad" placeholder="—" />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{m('weight')}</Label>
                  <Input value={weight} onChangeText={(v) => setWeight(num(v))} keyboardType="decimal-pad" placeholder="1.00" />
                </View>
              </View>
              {overCap ? <Text className="text-destructive text-xs">{m('points_exceed_max', { max: maxPoints })}</Text> : maxPoints != null && points ? <Text className="text-muted-foreground text-xs">{m('max_allowed', { max: maxPoints })}</Text> : null}
              <View className="gap-1.5">
                <Label>{m('description')}</Label>
                <HtmlEditorField value={description} onChange={setDescription} />
              </View>
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={m('assigned_date')} value={assigned} onChange={setAssigned} clearable />
                <DateField className="flex-1" label={m('due_date')} value={due} onChange={setDue} clearable />
              </View>
              <View className="flex-row items-center gap-3">
                <Switch checked={submission} onCheckedChange={setSubmission} />
                <Text className="flex-1 text-sm">{m('enable_submission')}</Text>
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center">
                <Text className="text-muted-foreground flex-1 text-xs">{m('types_found', { count: typeList.length })}</Text>
                <Pressable onPress={() => setNewType(newType === null ? '' : null)} hitSlop={8} className="p-1" accessibilityLabel={m('add_assignment_type')}>
                  <Icon as={Plus} className="text-primary size-4" />
                </Pressable>
              </View>
              {newType !== null ? (
                <View className="flex-row gap-2">
                  <Input className="flex-1" value={newType} onChangeText={setNewType} placeholder={m('type_name_placeholder')} onSubmitEditing={addType} />
                  <Button size="sm" onPress={addType} disabled={busy || !newType.trim()}>
                    <Text>{tc('add')}</Text>
                  </Button>
                </View>
              ) : null}
              {types.isLoading ? (
                <LoadingList rows={2} />
              ) : !typeList.length ? (
                <Text className="text-muted-foreground text-sm">{m('no_assignment_types')}</Text>
              ) : (
                <View className="flex-row flex-wrap gap-1.5">
                  {typeList.map((at) => (
                    <Pressable key={at.id} onPress={() => setTypeId(at.id)} className={cn('rounded-md border px-3 py-1.5', activeType === at.id ? 'border-[#0369a1] bg-[#0369a1]' : 'border-border')}>
                      <Text className={cn('text-sm', activeType === at.id && 'font-medium text-white')}>{at.title}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-1">
              <Text className="text-muted-foreground pt-3 text-xs">{m('periods_found', { count: cpList.length })}</Text>
              {cps.isLoading ? <LoadingList rows={4} /> : !cpList.length ? <Text className="text-muted-foreground py-4 text-sm">{m('no_course_periods')}</Text> : null}
              {cpList.length ? (
                <Pressable onPress={() => setSelected(allSel ? new Set() : new Set(cpList.map((c) => c.id)))} className="flex-row items-center gap-3 py-2.5">
                  <View className={cn('size-5 items-center justify-center rounded border', allSel ? 'border-primary bg-primary' : 'border-border')}>{allSel ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}</View>
                  <Text className="text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
                </Pressable>
              ) : null}
              {cpList.map((cp) => {
                const on = selected.has(cp.id);
                return (
                  <View key={cp.id}>
                    <Separator />
                    <Pressable onPress={() => toggle(cp.id)} className="flex-row items-center gap-3 py-2.5" accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <View className={cn('size-5 items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-border')}>{on ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}</View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium">{cp.course?.title || m('unknown_course')}</Text>
                        <Text className="text-muted-foreground text-xs">
                          {cp.room || tc('na')} - {cp.course?.short_name || tc('na')} - {coursePeriodTeacherName(cp) || tc('na')} · {mpName(cp.marking_period_id)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
              {selected.size ? <Text className="text-primary py-2 text-xs">{m('periods_selected', { count: selected.size })}</Text> : null}
            </CardContent>
          </Card>

          <Button onPress={create} disabled={busy || !title.trim() || !points || !activeType || !selected.size || overCap}>
            <Icon as={Check} className="text-primary-foreground size-4" />
            <Text>{m('btn_create')}</Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
