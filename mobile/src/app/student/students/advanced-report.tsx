import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ReportFieldPicker } from '@/features/portal/report-field-picker';

/** Pick fields for the student's personal report (web: /student/students/advanced-report). */
export default function StudentMyReport() {
  const { t } = useTranslation();
  return (
    <ReportFieldPicker
      title={t('app.st_ar_title')}
      subtitle={t('app.st_ar_subtitle')}
      onGenerate={(fields) => router.push({ pathname: '/student/students/advanced-report-results', params: { fields: JSON.stringify(fields) } })}
    />
  );
}
