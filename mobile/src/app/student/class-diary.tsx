import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ClassDiaryList } from '@/features/portal/class-diary';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Daily notes and activities from the student's teachers (web: /student/class-diary). */
export default function StudentClassDiary() {
  const { t } = useTranslation();
  const data = useApi(['student', 'class-diary'], () => student.getStudentClassDiary());
  return (
    <>
      <Stack.Screen options={{ title: t('app.pa_cd_title') }} />
      <ClassDiaryList entries={data.data} isLoading={data.isLoading} error={data.error} onRefresh={() => data.mutate()} subtitle={t('app.st_cd_subtitle')} emptyBody={t('app.st_cd_empty_body')} />
    </>
  );
}
