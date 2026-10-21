import type { AttendanceCode } from '@studently/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { Picker } from '@/components/app/picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckMark } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

export const ALL = 'all';

/**
 * Like the web attendance pages: school_id is the main school (profile.school_id) and the
 * selected campus goes separately as campus_id.
 */
export function useAttendanceScope() {
  const { me } = useSession();
  const { campusId } = useCampus();
  const schoolId = me.status === 'ready' ? me.me.profile.school_id : null;
  return { schoolId: schoolId ?? '', campusId, ready: !!schoolId };
}

export function useAttendanceCodes(includeInactive = false) {
  const { schoolId, campusId } = useAttendanceScope();
  return useApi(schoolId ? ['admin', 'attendance-codes', schoolId, campusId ?? 'school', includeInactive] : null, () =>
    adminAttendance.getCodes(schoolId, campusId, includeInactive),
  );
}

/** Grade + section filters (section only once a grade is picked), same as the web pages. */
export function useGradeSection() {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const [grade, setGradeRaw] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const sections = useApi(grade !== ALL ? ['admin', 'sections', campusId ?? 'school', grade] : null, ([, , , g]) =>
    adminAcademics.sections(campusId, g as string),
  );
  const gradeList = grades.data ?? [];
  const sectionList = sections.data ?? [];
  return {
    grade,
    section,
    gradeId: grade === ALL ? undefined : grade,
    sectionId: section === ALL ? undefined : section,
    gradeName: gradeList.find((g) => g.id === grade)?.name,
    setGrade: (g: string) => {
      setGradeRaw(g);
      setSection(ALL);
    },
    setSection,
    gradeOptions: [{ value: ALL, label: t('attendance.allGrades') }, ...gradeList.map((g) => ({ value: g.id, label: g.name }))],
    sectionOptions: [{ value: ALL, label: t('attendance.allSections') }, ...sectionList.map((s) => ({ value: s.id, label: s.name }))],
    hasSections: grade !== ALL && sectionList.length > 0,
  };
}

export function GradeSectionPickers({ gs }: { gs: ReturnType<typeof useGradeSection> }) {
  return (
    <View className="flex-row gap-2">
      <Picker className="flex-1" value={gs.grade} onChange={gs.setGrade} options={gs.gradeOptions} />
      {gs.hasSections ? <Picker className="flex-1" value={gs.section} onChange={gs.setSection} options={gs.sectionOptions} /> : null}
    </View>
  );
}

/** Colored short-name chip (the web's code swatch). */
export function CodeChip({ code, size = 'md' }: { code: Pick<AttendanceCode, 'short_name' | 'color'> | null | undefined; size?: 'sm' | 'md' }) {
  if (!code) return <Text className="text-muted-foreground text-xs">--</Text>;
  return (
    <View
      className={cn('items-center justify-center rounded-md', size === 'sm' ? 'h-5 min-w-5 px-1' : 'h-7 min-w-7 px-1.5')}
      style={{ backgroundColor: code.color || colors.printMuted }}>
      <Text className={cn('font-bold text-white', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{code.short_name}</Text>
    </View>
  );
}

/** Tap target showing the current code; opens a sheet listing every code (plus "--" to clear). */
export function CodeSelect({
  codes,
  value,
  onChange,
  pending,
  allowEmpty = true,
  showTitle,
}: {
  codes: AttendanceCode[];
  value: string;
  onChange: (id: string) => void;
  pending?: boolean;
  allowEmpty?: boolean;
  showTitle?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = codes.find((c) => c.id === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className={cn('min-h-9 flex-row items-center gap-1.5 rounded-xl border px-2 py-1 active:opacity-70', pending ? 'border-warning bg-warning-soft' : 'border-info-soft dark:border-border bg-card')}>
        <CodeChip code={current} size="sm" />
        {showTitle && current ? <Text className="text-sm">{current.title}</Text> : null}
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('attendance.attendanceCodes')}</DialogTitle>
          </DialogHeader>
          <ScrollView className="max-h-96">
            {allowEmpty ? (
              <Pressable onPress={() => (onChange(''), setOpen(false))} className="flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:opacity-70">
                <CodeChip code={null} />
                <Text className="text-muted-foreground">--</Text>
              </Pressable>
            ) : null}
            {codes.map((c) => (
              <Pressable key={c.id} onPress={() => (onChange(c.id), setOpen(false))} className={cn('flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:opacity-70', c.id === value && 'bg-info-soft')}>
                <CodeChip code={c} />
                <Text className={cn('flex-1 text-sm', c.id === value && 'font-semibold')}>{c.title}</Text>
                {c.id === value ? <CheckMark on /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Legend of all codes (the web's "Attendance codes" popover). */
export function CodeLegend({ codes }: { codes: AttendanceCode[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} className="bg-info-soft flex-row items-center gap-1.5 rounded-full px-3 py-2 active:opacity-70" accessibilityRole="button">
        <View className="bg-brand dark:bg-brand-secondary size-3 rounded-sm" />
        <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t('attendance.attendanceCodes')}</Text>
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('attendance.attendanceCodes')}</DialogTitle>
          </DialogHeader>
          <View className="gap-2">
            {codes.map((c) => (
              <View key={c.id} className="flex-row items-center gap-3">
                <CodeChip code={c} />
                <Text className="text-sm">{c.title}</Text>
              </View>
            ))}
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Checkbox-style row used across attendance forms. */
export function CheckRow({ checked, onPress, label, disabled, tone }: { checked: boolean; onPress: () => void; label: string; disabled?: boolean; tone?: 'danger' }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} className={cn('flex-row items-center gap-2 py-1', disabled && 'opacity-40')}>
      <CheckMark on={checked} />
      <Text className={cn('text-sm', tone === 'danger' && 'font-medium text-destructive')}>{label}</Text>
    </Pressable>
  );
}
