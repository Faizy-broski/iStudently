import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ReportFieldPicker } from '@/features/portal/report-field-picker';

/** Pick fields for a report of the teacher's students (web: /teacher/students/advanced-report). */
export default function TeacherAdvancedReport() {
  const { t } = useTranslation();
  return (
    <ReportFieldPicker
      title={t('teacherPages.studentsAdvancedReport.pageTitle')}
      subtitle={t('teacherPages.studentsAdvancedReport.pageSubtitle')}
      onGenerate={(fields) => router.push({ pathname: '/teacher/students/advanced-report-results', params: { fields: JSON.stringify(fields) } })}
    />
  );
}
