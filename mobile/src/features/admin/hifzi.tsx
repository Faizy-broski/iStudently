import type { HifziCircle, HifziEnrollment, HifziHeatmapCell } from '@studently/api-client';
import { router } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi, quran } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** `hifzi.<ns>.<key>` translator. */
export function useHz(ns?: string) {
  const { t, i18n } = useTranslation();
  return {
    h: (k: string, o?: Record<string, unknown>) => t(ns ? `hifzi.${ns}.${k}` : `hifzi.${k}`, o),
    a: (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o),
    t,
    isAr: i18n.language === 'ar',
  };
}

export const isHifziKey = (k: unknown) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('hifzi-');

export function useHifziCircles() {
  const { campusId } = useCampus();
  return useApi(['admin', 'hifzi-circles', campusId ?? 'school'], () => adminHifzi.circles(campusId));
}

export function useHifziRoster(circleId: string | null) {
  const { campusId } = useCampus();
  return useApi(circleId ? ['admin', 'hifzi-roster', circleId, campusId ?? 'school'] : null, ([, , c]) => adminHifzi.enrollments(c as string, campusId));
}

export function useRiwayat() {
  return useApi(['admin', 'quran-riwayat'], () => quran.riwayat());
}

export const enrollmentName = (e: HifziEnrollment) => (e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : (e.students?.student_number ?? '—'));

export function CirclePicker({ circles, value, onChange }: { circles: HifziCircle[]; value: string; onChange: (v: string) => void }) {
  return <Picker value={value} onChange={onChange} options={circles.map((c) => ({ value: c.id, label: c.name_ar }))} />;
}

export function RosterPicker({ roster, value, onChange }: { roster: HifziEnrollment[]; value: string; onChange: (v: string) => void }) {
  return <Picker value={value} onChange={onChange} options={roster.map((e) => ({ value: e.student_id, label: enrollmentName(e) }))} />;
}

/** Web: the "no circles yet" card with a Create circle button. */
export function NoCircles() {
  const { h } = useHz('circles');
  return <EmptyState icon={BookOpen} title={h('noCircles')} actionLabel={h('create')} onAction={() => router.push('/admin/hifzi/circles')} />;
}

/** Web: "No students in this circle. Enroll" with a link to the students page. */
export function NoRoster({ circleId }: { circleId: string }) {
  const { h } = useHz('students');
  return <EmptyState icon={BookOpen} title={h('noStudents')} actionLabel={h('enroll')} onAction={() => router.push({ pathname: '/admin/hifzi/students', params: { circle_id: circleId } })} />;
}

const BAND_COLORS: Record<HifziHeatmapCell['band'], string> = {
  mastered: 'bg-success ',
  strong: 'bg-success ',
  review_due: 'bg-warning ',
  weak: 'bg-warning ',
  critical: 'bg-destructive ',
};
const BANDS = ['mastered', 'strong', 'review_due', 'weak', 'critical'] as const;

/** Memorization strength per unit, one row per juz (web: MushafHeatmap). */
export function MushafHeatmap({ cells }: { cells: HifziHeatmapCell[] }) {
  const { h } = useHz('heatmap');
  if (!cells.length) return <EmptyState title={h('empty')} />;
  const byJuz = new Map<number, HifziHeatmapCell[]>();
  for (const c of cells) byJuz.set(c.juzNumber, [...(byJuz.get(c.juzNumber) ?? []), c]);
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        {BANDS.map((b) => (
          <View key={b} className="flex-row items-center gap-1.5">
            <View className={cn('size-3 rounded-sm', BAND_COLORS[b])} />
            <Text className="text-xs">{h(b)}</Text>
          </View>
        ))}
      </View>
      <View className="gap-1.5">
        {[...byJuz.entries()]
          .sort(([a], [b]) => a - b)
          .map(([juz, list]) => (
            <View key={juz} className="flex-row items-center gap-2">
              <Text className="text-muted-foreground w-7 text-end text-xs">{juz}</Text>
              <View className="flex-1 flex-row flex-wrap gap-0.5">
                {list.map((c) => (
                  <View key={c.unitId} accessibilityLabel={`${Math.round(c.strength)}%`} className={cn('size-4 rounded-sm', BAND_COLORS[c.band])} />
                ))}
              </View>
            </View>
          ))}
      </View>
    </View>
  );
}

const completionColor = (p: number) => (p >= 85 ? 'bg-success' : p >= 65 ? 'bg-brand' : p >= 40 ? 'bg-warning' : 'bg-destructive');

/** One completion bar per circle (web: SyllabusCompletionHeatmap). */
export function CompletionBars({ rows, emptyLabel }: { rows: { label: string; completionPercent: number; studentCount: number }[]; emptyLabel: string }) {
  if (!rows.length) return <Text className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</Text>;
  return (
    <View className="gap-3">
      {rows.map((r) => (
        <View key={r.label} className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
              {r.label}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {r.completionPercent.toFixed(1)}% · {r.studentCount}
            </Text>
          </View>
          <View className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <View className={cn('h-full rounded-full', completionColor(r.completionPercent))} style={{ width: `${Math.max(0, Math.min(100, r.completionPercent))}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}
