import { jahbadhInsightApi } from '@studently/api-client';
import type { JgNeed } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import type { ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, SectionHeader, useJg, useJgSection, useJgSections } from '@/features/jahbadh/shared';
import { api, jahbadhGrades } from '@/lib/api';
import type { ApiError } from '@/lib/data';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Jahbadh Wave 5 insight and administration (brief B6-30 … B6-50). */
export const jahbadhInsight = jahbadhInsightApi(api);

/** `useApi` keys carry 'own' for "no campus". */
export const own = (c: string) => (c === 'own' ? null : c);

export function useShare() {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const share = async (path: string, name: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => {
    setBusy(true);
    try {
      await shareApiFile(path, name, 'application/pdf', init);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, share };
}

function PrintButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="p-2">
      <Icon as={Printer} className="text-brand dark:text-brand-secondary size-5" />
    </Pressable>
  );
}

/** Stack title + print button, the section picker, then the body once a section is chosen. */
export function InsightScreen({
  title,
  onPrint,
  adminOnly,
  children,
}: {
  title: string;
  onPrint?: (sectionId: string, campusId: string | null) => void;
  adminOnly?: boolean;
  children: (sectionId: string, campusId: string | null, cid: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const sid = sectionId;
  if (adminOnly && !isAdmin) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <View className="bg-background flex-1 p-4">
          <Text variant="muted">{t('grades.insAdminOnly')}</Text>
        </View>
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title, headerRight: onPrint ? () => <PrintButton label={t('grades.printPdf')} onPress={() => sid && onPrint(sid, campusId)} /> : undefined }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {sid ? children(sid, campusId, campusId ?? 'own') : null}
      </ScrollView>
    </>
  );
}

/** Campus-wide screens (no section picker): admins only. */
export function CampusScreen({ title, onPrint, children }: { title: string; onPrint?: (campusId: string | null) => void; children: (campusId: string | null, cid: string) => ReactNode }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  return (
    <>
      <Stack.Screen options={{ title, headerRight: onPrint && isAdmin ? () => <PrintButton label={t('grades.printPdf')} onPress={() => onPrint(campusId)} /> : undefined }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        {isAdmin ? children(campusId, campusId ?? 'own') : <Text variant="muted">{t('grades.insAdminOnly')}</Text>}
      </ScrollView>
    </>
  );
}

export function Loading({ error }: { error?: ApiError }) {
  const { isAdmin } = useJg();
  if (error) return <JgBlocked error={error} isAdmin={isAdmin} />;
  return <Skeleton className="h-48 rounded-2xl" />;
}

/** Stages (value = number as string) and subjects of the section's rule (same cache as the class home). */
export function useOverview(sectionId: string, cid: string) {
  const ov = useApi(['jg', 'overview', sectionId, cid] as const, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, own(c)));
  const stages = (ov.data?.rule.stage_names ?? []).map((n, i) => (n ? { value: String(i + 1), label: n } : null)).filter((x): x is { value: string; label: string } => !!x);
  return { overview: ov, stages, subjects: ov.data?.subjects ?? [] };
}

/** Grade levels of the campus, from the Jahbadh section list (same cache as the section picker). */
export function useGradeLevels(campusId: string | null) {
  const sections = useJgSections(campusId);
  const seen = new Map<string, string>();
  for (const s of sections.data ?? []) if (!seen.has(s.grade_level_id)) seen.set(s.grade_level_id, s.grade_level_name);
  return { sections, grades: [...seen.entries()].map(([id, name]) => ({ id, name })) };
}

/** «ناجح بـ N درجة»-style sentence of a need. */
export function useNeedText() {
  const { t } = useTranslation();
  return (need: JgNeed | null | undefined) => {
    if (!need) return '—';
    if (need.status === 'secured') return t('grades.insNeedSecured');
    if (need.status === 'impossible') return t('grades.insNeedImpossible', { n: need.marks });
    return t('grades.insNeedMarks', { n: need.marks });
  };
}

export const needTone = (need: JgNeed | null | undefined): ChipTone => (!need ? 'muted' : need.status === 'secured' ? 'success' : need.status === 'impossible' ? 'destructive' : 'warning');

/** Heat tint of a 0–1 share (soft background classes). */
export const shareClass = (v: number | null) => (v === null ? '' : v < 0.5 ? 'bg-destructive-soft' : v < 0.75 ? 'bg-warning-soft' : 'bg-success-soft');

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** i18n key suffix of a workflow item (`daily-attendance` → `DailyAttendance`). */
export const pascal = (s: string) => s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
