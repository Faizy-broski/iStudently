import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEmployees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

/** Assign a teacher to a subject in a section for the academic year (web: workload "Assign Teacher"). */
export default function AssignTeacher() {
  const { t } = useTranslation();
  const w = (k: string, o?: Record<string, unknown>) => t(`teachers.workload.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { yearId } = useLocalSearchParams<{ yearId: string }>();
  const { campusId } = useCampus();
  const key = campusId ?? 'school';
  const [teacherId, setTeacherId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [primary, setPrimary] = useState(true);

  const teachers = useApi(['admin', 'teachers-all', key], () => adminEmployees.list('teacher', campusId, { page: 1, limit: 200 }));
  const grades = useApi(['admin', 'grades', key], () => adminAcademics.grades(campusId));
  const sections = useApi(gradeId ? ['admin', 'sections', key, gradeId] : null, () => adminAcademics.sections(campusId, gradeId));
  const subjects = useApi(gradeId ? ['admin', 'subjects', key, gradeId] : null, () => adminAcademics.subjects(campusId, gradeId));
  const save = useAction(
    () => adminEmployees.addAssignment(campusId, { teacher_id: teacherId, subject_id: subjectId, section_id: sectionId, academic_year_id: yearId, is_primary: primary }),
    { success: w('assignmentCreated') },
  );

  async function submit() {
    if (!teacherId || !gradeId || !sectionId || !subjectId) return toast.error(t('app.wl_fill_all'));
    if ((await save.run()).ok) {
      mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'assignments');
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: w('assignTeacher') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{w('steps')}</Text>
        <View className="gap-1.5">
          <Label>{t('teachers.teacher')}</Label>
          <Picker value={teacherId} onChange={setTeacherId} placeholder={w('selectTeacher')} options={(teachers.data ?? []).map((e) => ({ value: e.id, label: shortName(e.profile) || e.employee_number }))} />
        </View>
        <View className="gap-1.5">
          <Label>{t('teachers.gradeLevel')}</Label>
          <Picker
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setSectionId('');
              setSubjectId('');
            }}
            placeholder={w('step1SelectGrade')}
            options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
          />
        </View>
        {gradeId ? (
          <>
            <View className="gap-1.5">
              <Label>{t('teachers.section')}</Label>
              <Picker
                value={sectionId}
                onChange={setSectionId}
                placeholder={w('step2SelectSection')}
                options={(sections.data ?? []).map((x) => ({ value: x.id, label: x.capacity ? w('sectionCapacity', { section: x.name, capacity: x.capacity }) : x.name }))}
              />
            </View>
            <View className="gap-1.5">
              <Label>{t('teachers.subject')}</Label>
              {subjects.data && subjects.data.length === 0 ? (
                <Text className="text-warning text-sm">{w('noSubjectsForGrade')}</Text>
              ) : (
                <Picker value={subjectId} onChange={setSubjectId} placeholder={w('step3SelectSubject')} options={(subjects.data ?? []).map((x) => ({ value: x.id, label: x.code ? `${x.name} (${x.code})` : x.name }))} />
              )}
            </View>
          </>
        ) : null}
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1">{w('primaryTeacherHint')}</Text>
          <Switch checked={primary} onCheckedChange={setPrimary} />
        </View>
        <Button onPress={submit} disabled={save.running}>
          <Text>{w('createAssignment')}</Text>
        </Button>
      </Screen>
    </>
  );
}
