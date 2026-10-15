import { coursePeriodTeacherName, ELIGIBILITY_CODES, type EligibilityCode } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ELIGIBILITY_TEXT, ELIGIBILITY_TONE, useAc } from '@/features/admin/activities';
import { useCampus } from '@/features/campus/campus';
import { adminActivities, adminCourses, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Row = { student_id: string; name: string; student_number: string; eligibility_code: EligibilityCode };

function CodeChips({ value, onChange }: { value: EligibilityCode | null; onChange: (c: EligibilityCode) => void }) {
  const a = useAc();
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {ELIGIBILITY_CODES.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          className={cn('rounded-full border px-2.5 py-1', value === c ? cn(ELIGIBILITY_TONE[c], 'border-transparent') : 'border-border')}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === c }}>
          <Text className={cn('text-xs', value === c ? cn('font-semibold', ELIGIBILITY_TEXT[c]) : 'text-muted-foreground')}>{a(`eligibilityCodes.${c}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Mark each student of a course period Passing / Borderline / Failing / Incomplete for a date (web: /admin/activities/enter-eligibility). */
export default function EnterEligibility() {
  const a = useAc();
  const toast = useToast();
  const { campusId } = useCampus();
  const cps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const [cpId, setCpId] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cpLabel = (cp: NonNullable<typeof cps.data>[number]) => {
    const teacher = cp.teacher?.profile?.last_name ?? cp.teacher?.last_name ?? coursePeriodTeacherName(cp);
    return [cp.period?.period_name, cp.course?.title ?? cp.title, teacher ? `(${teacher})` : ''].filter(Boolean).join(' ') || cp.id;
  };

  async function load() {
    if (!cpId || !date) return;
    setLoading(true);
    try {
      // The course period's own students (the web lists the whole school here).
      const [cl, el] = await Promise.all([adminScheduling.classListForPeriod(cpId), adminActivities.eligibility(cpId, date, campusId)]);
      if (!cl.success || !el.success) return toast.error(cl.error || el.error || a('failedToLoadStudents'));
      const existing = new Map((el.data ?? []).map((e) => [e.student_id, e.eligibility_code]));
      const next = (cl.data?.students ?? []).map((s) => ({
        student_id: s.student_id,
        name: s.student_name,
        student_number: s.student_number ?? '',
        eligibility_code: existing.get(s.student_id) ?? ('PASSING' as EligibilityCode),
      }));
      next.sort((x, y) => x.name.localeCompare(y.name));
      setRows(next);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!rows || !cpId) return;
    setSaving(true);
    try {
      const r = await adminActivities.saveEligibility({
        course_period_id: cpId,
        school_date: date,
        campus_id: campusId ?? null,
        records: rows.map((x) => ({ student_id: x.student_id, eligibility_code: x.eligibility_code })),
      });
      if (!r.success) return toast.error(r.error || a('failedToSaveEligibility'));
      toast.success(a('eligibilitySaved'));
    } finally {
      setSaving(false);
    }
  }

  const setOne = (id: string, c: EligibilityCode) => setRows((prev) => prev?.map((x) => (x.student_id === id ? { ...x, eligibility_code: c } : x)) ?? null);
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('enterEligibilityTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{a('coursePeriod')}</Label>
              {cps.isLoading ? (
                <LoadingList rows={1} />
              ) : !(cps.data ?? []).length ? (
                <Text className="text-muted-foreground text-sm">{campusId ? a('noCoursePeriodsFound') : a('noCoursePeriodsFoundSelectCampus')}</Text>
              ) : (
                <Picker
                  value={cpId || '__none__'}
                  onChange={(v) => {
                    setCpId(v === '__none__' ? '' : v);
                    setRows(null);
                  }}
                  placeholder={a('selectCoursePeriod')}
                  options={[{ value: '__none__', label: a('selectOption') }, ...(cps.data ?? []).map((cp) => ({ value: cp.id, label: cpLabel(cp) }))]}
                />
              )}
            </View>
            <DateField
              label={a('date')}
              value={date}
              onChange={(v) => {
                setDate(v);
                setRows(null);
              }}
            />
            <Button onPress={load} disabled={!cpId || !date || loading}>
              <Icon as={Users} className="text-primary-foreground size-4" />
              <Text>{a('loadStudents')}</Text>
            </Button>
          </CardContent>
        </Card>
        {loading ? <LoadingList rows={4} /> : null}
        {rows && !loading ? (
          <>
            <Card>
              <CardContent className="gap-2 pt-4">
                <Text className="font-semibold">{a('studentsWithCount', { count: rows.length })}</Text>
                {rows.length ? (
                  <View className="gap-1.5">
                    <Text className="text-muted-foreground text-xs">{a('setAll')}</Text>
                    <CodeChips value={null} onChange={(c) => setRows(rows.map((x) => ({ ...x, eligibility_code: c })))} />
                  </View>
                ) : (
                  <Text className="text-muted-foreground py-4 text-center text-sm">{a('noStudentsFound')}</Text>
                )}
                {rows.map((x) => (
                  <View key={x.student_id} className="gap-1.5">
                    <Separator />
                    <View className="pt-1">
                      <Text className="text-sm font-medium">{x.name}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {a('id')}: {x.student_number || '-'}
                      </Text>
                    </View>
                    <CodeChips value={x.eligibility_code} onChange={(c) => setOne(x.student_id, c)} />
                  </View>
                ))}
              </CardContent>
            </Card>
            {rows.length ? (
              <Button onPress={save} disabled={saving}>
                <Icon as={Save} className="text-primary-foreground size-4" />
                <Text>{a('saveEligibility')}</Text>
              </Button>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
