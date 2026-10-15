import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ReportFieldPicker } from '@/features/portal/report-field-picker';

/** Pick fields for the children report (web: /parent/students/advanced-report). */
export default function ParentAdvancedReport() {
  const { t } = useTranslation();
  return (
    <ReportFieldPicker
      title={t('app.pa_ar_title')}
      subtitle={t('app.pa_ar_subtitle')}
      onGenerate={(fields) => router.push({ pathname: '/parent/students/advanced-report-results', params: { fields: JSON.stringify(fields) } })}
    />
  );
}
