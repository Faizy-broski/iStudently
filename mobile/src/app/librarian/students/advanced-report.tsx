import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ReportFieldPicker } from '@/features/portal/report-field-picker';

/** Pick fields for a report of the school's students (web: /librarian/students/advanced-report). */
export default function LibrarianAdvancedReport() {
  const { t } = useTranslation();
  return (
    <ReportFieldPicker
      title={t('sidebar.advanced_report')}
      subtitle={t('app.li_ar_subtitle')}
      onGenerate={(fields) => router.push({ pathname: '/librarian/students/advanced-report-results', params: { fields: JSON.stringify(fields) } })}
    />
  );
}
