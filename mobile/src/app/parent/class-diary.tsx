import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { ClassDiaryList } from '@/features/portal/class-diary';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Daily notes from the selected child's teachers (web: /parent/class-diary). */
export default function ParentClassDiary() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_cd_${key}`);
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'class-diary', childId] : null, ([, , id]) => parent.getStudentClassDiary(id as string));

  if (!childId) return <NoChild />;
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ClassDiaryList entries={data.data} isLoading={data.isLoading} error={data.error} onRefresh={() => data.mutate()} subtitle={k('subtitle')} emptyBody={k('empty_body')} />
    </>
  );
}
