import { jcPrintPath, type ApiResponse, type JcArea, type JcDay, type JcDoc, type JcOverview, type JcStatus } from '@studently/api-client';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useRoleBase } from '@/features/portal/role-base';
import { jahbadhControl } from '@/lib/api';
import { useApi, type ApiError } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/**
 * Exam control («كنترول جهبذ», web: /admin/exam-control, /teacher/exam-control). Admins are control chiefs;
 * teachers and staff open the sessions they are members of. Every screen takes the session as `?id=`;
 * the server decides what each member may see (blind entry hides names until unmasking).
 */
export function useJcBase() {
  const role = useRoleBase();
  const base = `${role.base}/exam-control`;
  return { ...role, base, to: (area: JcArea | 'session', id: string) => ({ pathname: `${base}/${area === 'overview' ? 'session' : area}`, params: { id } }) as unknown as Href };
}

export function useSessionId() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ?? null;
}

export function useOverview(id: string | null) {
  return useApi(id ? (['jc', 'overview', id] as const) : null, ([, , s]): Promise<ApiResponse<JcOverview>> => jahbadhControl.overview(s));
}

export function useDays(id: string | null) {
  return useApi(id ? (['jc', 'days', id] as const) : null, ([, , s]): Promise<ApiResponse<JcDay[]>> => jahbadhControl.schedule(s));
}

const STATUS_TONE: Record<JcStatus, ChipTone> = {
  draft: 'muted',
  registration: 'info',
  committees_locked: 'warning',
  exam_running: 'destructive',
  grading: 'warning',
  unmasked: 'success',
  published: 'success',
  archived: 'muted',
};

export function JcStatusChip({ status, className }: { status: JcStatus; className?: string }) {
  const { t } = useTranslation();
  return <StatusChip label={t(`examControl.status_${status}`)} tone={STATUS_TONE[status]} className={className} />;
}

/** Shares a printable control document (PDF). */
export function usePrintDoc(sessionId: string | null) {
  const { t } = useTranslation();
  const toast = useToast();
  return async (doc: JcDoc, opts: { committeeId?: string | null; dayId?: string | null } = {}) => {
    if (!sessionId) return;
    try {
      await shareApiFile(jcPrintPath(sessionId, doc, opts), `${doc}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };
}

export function PrintButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="p-2">
      <Icon as={Printer} className="text-brand dark:text-brand-secondary size-5" />
    </Pressable>
  );
}

/** Error state of a control screen (no rights, not unmasked, plugin off…). */
export function JcError({ error }: { error: ApiError }) {
  const { t } = useTranslation();
  return (
    <View className="py-6">
      <EmptyState title={t('grades.loadError')} body={error.message} actionLabel={t('examControl.back')} onAction={() => router.back()} />
    </View>
  );
}

export function Note({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'warning' | 'success' | 'destructive' }) {
  const cls = { muted: 'bg-muted', warning: 'bg-warning/15', success: 'bg-success/15', destructive: 'bg-destructive/15' }[tone];
  const txt = { muted: 'text-muted-foreground', warning: 'text-warning', success: 'text-success', destructive: 'text-destructive' }[tone];
  return (
    <View className={`rounded-xl px-3 py-2 ${cls}`}>
      <Text className={`text-xs ${txt}`}>{text}</Text>
    </View>
  );
}

export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits).replace(/\.0+$/, '')}%`);

/** Today's exam day if there is one, else the next, else the first. */
export function pickDefaultDay(days: JcDay[]): string | null {
  if (!days.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (days.find((d) => d.exam_date === today) ?? days.find((d) => d.exam_date > today) ?? days[0]).id;
}

/** Small number tile. */
export function MiniTile({ label, value, tone = 'muted' }: { label: string; value: string | number; tone?: 'muted' | 'warning' | 'success' | 'destructive' }) {
  const txt = { muted: 'text-foreground', warning: 'text-warning', success: 'text-success', destructive: 'text-destructive' }[tone];
  return (
    <View className="bg-card border-border min-w-[30%] flex-1 rounded-2xl border p-3">
      <Text variant="muted" className="text-[11px]">
        {label}
      </Text>
      <Text className={`text-lg font-bold ${txt}`}>{String(value)}</Text>
    </View>
  );
}
