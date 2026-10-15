import type { AcademicYear, MarkingPeriod, TeacherCoursePeriod } from '@studently/api-client';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useSession } from '@/features/auth/session';
import { adminAcademics, adminGrades, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

import { usePortalPlugins } from './menu';

interface PortalAcademic {
  years: AcademicYear[];
  year: AcademicYear | null;
  setYear: (id: string) => void;
  /** Quarters (QTR) of the selected year. */
  quarters: MarkingPeriod[];
  quarter: MarkingPeriod | null;
  setQuarter: (id: string) => void;
  /** Teachers: own course periods of the selected year, and the one picked (web sidebar course picker). */
  coursePeriods: TeacherCoursePeriod[];
  coursePeriod: TeacherCoursePeriod | null;
  setCoursePeriod: (id: string) => void;
  coursePeriodsLoading: boolean;
  isLoading: boolean;
}

const Ctx = createContext<PortalAcademic | null>(null);

/** The same context, or null outside a portal shell (admin screens reused by teachers). */
export function usePortalAcademicOptional() {
  return useContext(Ctx);
}

export function usePortalAcademic() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortalAcademic must be used inside PortalAcademicProvider');
  return v;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The web sidebar's academic year + quarter pickers for students and teachers (AppSidebar):
 * year = saved choice, else the current one; quarter = saved choice, else the one running today,
 * else the first. Students' marking periods come from their own campus; with the
 * marking_period_groups plugin they see their group's quarters (the web resolves that to the
 * default group, since students cannot read grade levels).
 */
/** `campusId` overrides where marking periods come from (parents: the selected child's campus). */
export function PortalAcademicProvider({ children, campusId }: { children: ReactNode; campusId?: string | null }) {
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const uid = profile?.id ?? 'anon';
  const role = profile?.role;
  const mpCampusId = campusId !== undefined ? (campusId ?? undefined) : role === 'teacher' ? undefined : (profile?.campus_id ?? undefined);
  const plugins = usePortalPlugins();
  const groupsOn = plugins.includes('marking_period_groups') && (role === 'student' || role === 'parent');

  const yearsQ = useApi(profile ? ['portal', 'academic-years'] : null, () => adminAcademics.academicYears());
  const mpsQ = useApi(profile ? ['portal', 'marking-periods', mpCampusId ?? 'school'] : null, ([, , c]) => adminGrades.markingPeriods(c === 'school' ? undefined : c));
  const groupsQ = useApi(groupsOn ? ['portal', 'mp-groups', mpCampusId ?? 'school'] : null, ([, , c]) => adminAcademics.markingPeriodGroups(c === 'school' ? undefined : c));

  const yearKey = `portal.year.${uid}`;
  const quarterKey = `portal.quarter.${uid}`;
  const [savedYear, setSavedYear] = useState<string | null>(() => Storage.getItemSync(yearKey));
  const [savedQuarter, setSavedQuarter] = useState<string | null>(() => Storage.getItemSync(quarterKey));

  const years = useMemo(() => yearsQ.data ?? [], [yearsQ.data]);
  const year = years.find((y) => y.id === savedYear) ?? years.find((y) => y.is_current) ?? years[0] ?? null;
  const groupId = groupsOn ? ((groupsQ.data ?? []).find((g) => g.is_default)?.id ?? null) : null;

  const quarters = useMemo(
    () =>
      (mpsQ.data ?? [])
        .filter((mp) => mp.mp_type === 'QTR')
        .filter((mp) => !groupId || mp.group_id === groupId)
        .filter((mp) => !year || !mp.start_date || (mp.start_date >= year.start_date && mp.start_date <= year.end_date))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [mpsQ.data, groupId, year],
  );
  const d = today();
  const quarter =
    quarters.find((q) => q.id === savedQuarter) ??
    quarters.find((q) => q.start_date && q.end_date && q.start_date <= d && d <= q.end_date) ??
    quarters[0] ??
    null;

  const setYear = useCallback(
    (id: string) => {
      Storage.setItemSync(yearKey, id);
      setSavedYear(id);
    },
    [yearKey],
  );
  const setQuarter = useCallback(
    (id: string) => {
      Storage.setItemSync(quarterKey, id);
      setSavedQuarter(id);
    },
    [quarterKey],
  );

  // Teachers: course periods of the year (never filtered by quarter); saved pick, else the first active, else the first.
  const yearId = year?.id ?? null;
  const cpsQ = useApi(role === 'teacher' && yearId ? ['portal', 'my-course-periods', yearId] : null, ([, , y]) => teacher.myCoursePeriods(y as string));
  const cpKey = `portal.course-period.${uid}`;
  const [savedCp, setSavedCp] = useState<string | null>(() => Storage.getItemSync(cpKey));
  const coursePeriods = useMemo(() => cpsQ.data ?? [], [cpsQ.data]);
  const coursePeriod = coursePeriods.find((c) => c.id === savedCp) ?? coursePeriods.find((c) => c.is_active) ?? coursePeriods[0] ?? null;
  const setCoursePeriod = useCallback(
    (id: string) => {
      Storage.setItemSync(cpKey, id);
      setSavedCp(id);
    },
    [cpKey],
  );

  const value: PortalAcademic = {
    years,
    year,
    setYear,
    quarters,
    quarter,
    setQuarter,
    coursePeriods,
    coursePeriod,
    setCoursePeriod,
    coursePeriodsLoading: cpsQ.isLoading,
    isLoading: yearsQ.isLoading || mpsQ.isLoading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
