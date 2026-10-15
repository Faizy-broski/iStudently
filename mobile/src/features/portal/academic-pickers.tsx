import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';

import { usePortalAcademic } from './academic';

/** Web sidebar pickers: academic year + quarter, and for teachers the course period (AppSidebar). */
export function AcademicPickers({ coursePeriod }: { coursePeriod?: boolean }) {
  const { t } = useTranslation();
  const a = usePortalAcademic();
  if (!a.years.length) return null;
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Picker value={a.year?.id ?? null} onChange={a.setYear} options={a.years.map((y) => ({ value: y.id, label: y.name }))} placeholder={t('app.st_year')} />
        </View>
        <View className="flex-1">
          <Picker
            value={a.quarter?.id ?? null}
            onChange={a.setQuarter}
            options={a.quarters.map((q) => ({ value: q.id, label: q.title }))}
            placeholder={a.quarters.length ? t('app.st_quarter') : t('app.st_no_quarters')}
          />
        </View>
      </View>
      {coursePeriod ? (
        <Picker
          value={a.coursePeriod?.id ?? null}
          onChange={a.setCoursePeriod}
          options={a.coursePeriods.map((c) => {
            const name = c.short_name || c.title || c.course?.title || '—';
            return { value: c.id, label: c.course?.title && c.course.title !== name ? `${name} — ${c.course.title}` : name };
          })}
          placeholder={a.coursePeriodsLoading ? t('common.loading') : a.coursePeriods.length ? t('app.te_select_course') : t('app.te_no_courses')}
        />
      ) : null}
    </View>
  );
}
