import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MyReportCards } from '@/features/jahbadh/my-report-cards';

/** Web: /student/jahbadh-report-cards. */
export default function Screen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grades.reportCards') }} />
      <MyReportCards />
    </>
  );
}
