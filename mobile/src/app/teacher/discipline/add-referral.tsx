import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { DisciplineFieldInput, LibraryRelatedSwitch } from '@/features/admin/discipline';
import { useSession } from '@/features/auth/session';
import { useTeacherStudents } from '@/features/teacher/students';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';

/** File a behaviour referral about one of the teacher's own students (web: /teacher/discipline/add-referral). */
export default function TeacherAddReferral() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.disciplineAddReferral.${key}`);
  const toast = useToast();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const students = useTeacherStudents(true);
  const fields = useApi(schoolId ? ['teacher', 'discipline-fields', schoolId] : null, ([, , s]) => adminDiscipline.getFields(s as string, 'student'));
  const [studentId, setStudentId] = useState<string | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [library, setLibrary] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!studentId) return toast.error(k('pleaseSelectStudent'));
    setBusy(true);
    const r = await adminDiscipline.createStaffReferral({ student_id: studentId, incident_date: date, field_values: values, library_related: library });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('failedToSubmit'));
    toast.success(k('referralSubmitted'));
    router.replace('/teacher/discipline/referrals');
  }

  const list = students.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('pageDescription')}</Text>
        <Card>
          <CardContent className="gap-4 pt-5">
            <View className="gap-1.5">
              <Label>{`${k('selectStudent')} *`}</Label>
              {students.isLoading ? (
                <Text className="text-muted-foreground text-sm">{k('fetchingStudents')}</Text>
              ) : !list.length ? (
                <Text className="text-muted-foreground text-sm">{k('noEnrolledStudents')}</Text>
              ) : (
                <Picker
                  value={studentId}
                  onChange={setStudentId}
                  placeholder={k('selectStudentPlaceholder')}
                  options={list.map((s) => ({ value: s.id, label: `${s.profile?.last_name || k('unknown')}, ${s.profile?.first_name || k('nameFallback')} (${s.student_number})` }))}
                />
              )}
              <Text className="text-muted-foreground text-xs">{k('listRestrictedNote')}</Text>
            </View>
            <DateField label={k('incidentDate')} value={date} onChange={setDate} />
            <LibraryRelatedSwitch value={library} onChange={setLibrary} />
            {fields.isLoading ? (
              <LoadingList rows={2} />
            ) : !(fields.data ?? []).length ? (
              <Text className="text-muted-foreground text-sm">{`${k('noFieldsConfigured')} ${k('contactAdminHint')}`}</Text>
            ) : (
              (fields.data ?? []).map((f, i) => (
                <View key={f.id} className="gap-1.5">
                  {i > 0 ? <Separator className="mb-2" /> : null}
                  <Label>{f.name}</Label>
                  <DisciplineFieldInput field={f} value={values[f.id]} onChange={(v) => setValues((x) => ({ ...x, [f.id]: v }))} />
                </View>
              ))
            )}
            <View className="flex-row justify-end gap-2">
              <Button variant="outline" onPress={() => router.back()} disabled={busy}>
                <Text>{k('cancel')}</Text>
              </Button>
              <Button onPress={submit} disabled={busy || !studentId}>
                <Text>{busy ? k('submitting') : k('submitReferral')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
