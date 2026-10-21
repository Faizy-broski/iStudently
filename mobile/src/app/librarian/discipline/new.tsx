import type { LibraryStudentHit } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CalendarDays, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FormSection, StickyActions } from '@/components/app/layout';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { DisciplineFieldInput } from '@/features/admin/discipline';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { StudentSelectCard } from '@/features/library/librarian';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Report a library incident about a student (e.g. damaged or lost book), filed as a library-related referral. */
export default function LibraryIncidentForm() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.li_${key}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const fields = useApi(schoolId ? ['librarian', 'discipline-fields', schoolId] : null, ([, , s]) => adminDiscipline.getFields(s as string, 'student'));
  const [student, setStudent] = useState<LibraryStudentHit | null>(null);
  const [date, setDate] = useState(todayYmd);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!schoolId) return;
    if (!student) return toast.error(t('discipline.validation.selectStudent'));
    setBusy(true);
    const r = await adminDiscipline.createReferral({ school_id: schoolId, campus_id: campusId ?? null, student_id: student.id, incident_date: date, field_values: values, library_related: true });
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('discipline.errors.addReferral'));
    toast.success(k('incident_reported'));
    mutate((key) => Array.isArray(key) && key[0] === 'librarian' && key[1] === 'library-referrals');
    router.back();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: k('report_incident') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="bg-info-soft flex-row items-start gap-2.5 rounded-2xl p-3.5">
          <Icon as={Info} className="size-4 text-brand dark:text-brand-secondary" />
          <Text className="flex-1 text-sm text-brand dark:text-brand-secondary">{k('incident_note')}</Text>
        </View>
        <StudentSelectCard value={student} onChange={setStudent} />
        <FormSection title={t('common.details')} icon={CalendarDays}>
          <DateField label={`${t('discipline.incidentDate')} *`} value={date} onChange={(v) => v && setDate(v)} />
          {fields.isLoading ? (
            <LoadingList rows={2} />
          ) : !(fields.data ?? []).length ? (
            <Text className="text-muted-foreground text-sm">{t('teacherPages.disciplineAddReferral.noFieldsConfigured')}</Text>
          ) : (
            (fields.data ?? []).map((f, i) => (
              <View key={f.id} className="gap-1.5">
                {i > 0 ? <Separator className="mb-2" /> : null}
                <Label>{f.name}</Label>
                <DisciplineFieldInput field={f} value={values[f.id]} onChange={(v) => setValues((x) => ({ ...x, [f.id]: v }))} />
              </View>
            ))
          )}
        </FormSection>
      </ScrollView>
      <StickyActions>
        <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={busy}>
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button className="flex-1" onPress={submit} disabled={busy || !student}>
          <Text>{busy ? t('discipline.submitting') : k('report_incident')}</Text>
        </Button>
      </StickyActions>
    </View>
  );
}
