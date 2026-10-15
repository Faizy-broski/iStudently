import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceSubmitScreen } from '@/features/grievances/submit-screen';

/** Submit a complaint (web: /student/grievances/submit). */
export default function StudentGrievanceSubmit() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.submit.title') }} />
      <GrievanceSubmitScreen onDone={() => router.back()} />
    </>
  );
}
