import type { ApiResponse, JgGrid, JgSectionListItem } from '@studently/api-client';
import { resultTone, type JgDecisionTone, type JgRound2Need } from '@studently/shared-utils';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import type { ChipTone } from '@/components/app/status-chip';
import { useCampus } from '@/features/campus/campus';
import { useRoleBase } from '@/features/portal/role-base';
import { jahbadhGrades } from '@/lib/api';
import type { ApiError } from '@/lib/data';
import { useApi } from '@/lib/data';

/** Engine tone → chip tone. */
export const chipTone = (tone: JgDecisionTone): ChipTone => tone;
export const resultChipTone = (r: Parameters<typeof resultTone>[0]): ChipTone => resultTone(r);

/**
 * Role context of the Jahbadh grades screens (admin shell or teacher portal). Admins send the
 * selected campus; teachers are resolved by the server to their own campus and classes.
 */
export function useJg() {
  const role = useRoleBase();
  const { campusId } = useCampus();
  const cid = role.isTeacher ? null : (campusId ?? null);
  return { ...role, campusId: cid, isAdmin: role.isAdmin && !role.isTeacher };
}

export function useJgSections(campusId: string | null) {
  return useApi(['jg', 'sections', campusId ?? 'own'] as const, ([, , c]) => jahbadhGrades.sections(c === 'own' ? null : c));
}

/** The grid of one section × subject (shared SWR key: the subject list and the student screen read the same cache). */
export function useJgGrid(sectionId: string | null, subjectId: string | null, campusId: string | null) {
  const key = sectionId && subjectId ? (['jg', 'grid', sectionId, subjectId, campusId ?? 'own'] as const) : null;
  return useApi(key, ([, , s, sub, c]): Promise<ApiResponse<JgGrid>> => jahbadhGrades.grid(s, sub, c === 'own' ? null : c));
}

/**
 * The section a screen works on: `?section=` (from the class home), else the first available section,
 * so screens opened from the menu show data at once. Changing it updates the route params.
 */
export function useJgSection(campusId: string | null) {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const sections = useJgSections(campusId);
  const list = sections.data ?? [];
  const param = section ?? null;
  const sectionId = param && (!sections.data || list.some((s) => s.id === param)) ? param : (list[0]?.id ?? null);
  const setSection = (id: string) => router.setParams({ section: id });
  return { sections, sectionId, setSection };
}

/**
 * Top of a section screen: the section picker, or why there is nothing to show yet (loading, error,
 * no sections: setup not done for admins, no classes for teachers).
 */
export function SectionHeader({
  sections,
  sectionId,
  onChange,
  isAdmin,
}: {
  sections: { data?: JgSectionListItem[]; error?: ApiError; isLoading?: boolean };
  sectionId: string | null;
  onChange: (id: string) => void;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  if (sections.error) return <JgBlocked error={sections.error} isAdmin={isAdmin} />;
  if (!sections.data) return <LoadingList rows={2} />;
  if (!sections.data.length) return <JgBlocked code={isAdmin ? 'not_mapped' : 'no_sections'} message={t('grades.noSectionsTeacher')} isAdmin={isAdmin} />;
  return <SectionPicker sections={sections.data} value={sectionId} onChange={onChange} />;
}

export function SectionPicker({ sections, value, onChange }: { sections: JgSectionListItem[]; value: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <Picker
      value={value}
      onChange={onChange}
      placeholder={t('grades.selectSection')}
      options={sections.map((s) => ({ value: s.id, label: `${s.grade_level_name} — ${s.name}` }))}
    />
  );
}

/** Why the module can't open yet (not set up / grade not mapped), with a way forward for admins. */
export function JgBlocked({ error, code: codeProp, message, isAdmin }: { error?: ApiError | null; code?: string; message?: string; isAdmin: boolean }) {
  const { t } = useTranslation();
  const code = codeProp ?? error?.code;
  const key = code === 'not_setup' || code === 'not_seeded' ? 'notSetup' : code === 'not_mapped' ? 'notMapped' : null;
  if (code === 'no_sections') {
    return (
      <View className="py-6">
        <EmptyState icon={AlertTriangle} title={t('grades.noSectionsTitle')} body={message} />
      </View>
    );
  }
  return (
    <View className="py-6">
      <EmptyState
        icon={AlertTriangle}
        title={key ? t(`grades.${key}Title`) : t('grades.loadError')}
        body={key ? t(`grades.${key}Body`) : (message ?? error?.message)}
        actionLabel={isAdmin && key ? t('grades.goToSetup') : undefined}
        onAction={isAdmin && key ? () => router.push('/admin/jahbadh/setup') : undefined}
      />
    </View>
  );
}

/** Text of a second-round cell (≥ n / ✓ n / ✗ n / not reachable). */
export function needText(need: JgRound2Need, fmt: (n: number) => string, impossible: string): { text: string; tone: ChipTone } | null {
  if (!need) return null;
  if (need.kind === 'need') return { text: `≥ ${fmt(need.value)}`, tone: 'warning' };
  if (need.kind === 'impossible') return { text: impossible, tone: 'destructive' };
  if (need.kind === 'passed') return { text: `✓ ${fmt(need.value)}`, tone: 'success' };
  return { text: `✗ ${fmt(need.value)}`, tone: 'destructive' };
}

/** Accepts Arabic digits and comma decimals; «غ» or A = absent; "" = cleared. */
export function parseMark(text: string): { ok: true; value: number | null; absent: boolean } | { ok: false } {
  const s = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace('٫', '.')
    .replace(',', '.');
  if (s === '') return { ok: true, value: null, absent: false };
  if (/^(غ|a|abs)$/i.test(s)) return { ok: true, value: null, absent: true };
  const n = Number(s);
  return Number.isFinite(n) ? { ok: true, value: n, absent: false } : { ok: false };
}

/** Horizontal share bar (0–1). */
export function ShareBar({ value, tone = 'brand' }: { value: number | null; tone?: 'brand' | 'success' | 'warning' | 'destructive' }) {
  const fill = { brand: 'bg-brand dark:bg-brand-secondary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive' }[tone];
  return (
    <View className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <View className={`h-2 rounded-full ${fill}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%` }} />
    </View>
  );
}
