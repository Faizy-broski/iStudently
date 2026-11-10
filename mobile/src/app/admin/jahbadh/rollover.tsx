import type { JgRolloverKind, JgRolloverResult } from '@studently/api-client';
import { fmtPct } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { StatTile, StatTiles, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { jahbadhData } from '@/features/jahbadh/data';
import { JgBlocked, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { useApi } from '@/lib/data';

const KIND_TONE: Record<JgRolloverKind, ChipTone> = { promote: 'success', graduate: 'success', repeat: 'destructive', hold: 'warning' };
const KINDS: JgRolloverKind[] = ['promote', 'repeat', 'graduate', 'hold'];

/** «النقل للعام القادم» (web: /admin/jahbadh-grades/rollover): next year's plan, carried out by the school's year-end rollover. */
export default function JahbadhRollover() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const preview = useApi(sectionId ? (['jg', 'rollover', sectionId, campusId ?? 'own'] as const) : null, ([, , s, c]) => jahbadhData.rolloverPreview(s, c === 'own' ? null : c));
  const [next, setNext] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<JgRolloverResult | null>(null);
  const [busy, setBusy] = useState(false);
  const data = preview.data;

  const apply = async () => {
    const sid = sectionId;
    const d = data;
    if (!sid || !d) return;
    const students = d.rows
      .map((r) => ({ student_id: r.student.id, next_grade_id: next[r.student.id], hold: held[r.student.id] }))
      .filter((s) => s.next_grade_id !== undefined || s.hold !== undefined);
    setBusy(true);
    const res = await jahbadhData.rolloverApply(sid, students, campusId);
    setBusy(false);
    if (!res.success) {
      const msg = res.code === 'no_enrollment' ? t('app.jgd_err_no_enrollment') : res.code === 'invalid_next_grade' ? t('app.jgd_err_invalid_next_grade') : (res.error ?? t('app.error_title'));
      return toast.error(msg);
    }
    setResult(res.data ?? null);
    toast.success(t('app.jgd_rollover_saved'));
    await preview.mutate();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('app.jgd_rollover_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <Text variant="muted" className="text-xs">
          {t('app.jgd_rollover_subtitle')}
        </Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={(id) => { setSection(id); setNext({}); setHeld({}); setResult(null); }} isAdmin={isAdmin} />
        {!sectionId ? null : preview.error ? (
          <JgBlocked error={preview.error} isAdmin={isAdmin} />
        ) : !data ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <>
            <StatTiles>
              {KINDS.map((k) => (
                <StatTile key={k} label={t(`app.jgd_kind_${k}`)} value={String(data.counts[k] ?? 0)} tone={k === 'repeat' ? 'destructive' : k === 'hold' ? 'warning' : 'success'} />
              ))}
            </StatTiles>
            <Panel className="gap-2 p-4">
              <Text className="text-sm">{t('app.jgd_rollover_note')}</Text>
              <Button variant="outline" size="sm" className="self-start" onPress={() => router.push('/admin/rollover')}>
                <Icon as={ExternalLink} className="text-foreground size-4" />
                <Text>{t('app.jgd_open_rollover')}</Text>
              </Button>
            </Panel>
            {data.rows.map((r, i) => {
              const chosen = next[r.student.id] ?? r.next_grade_id ?? null;
              const isHeld = held[r.student.id] ?? false;
              return (
                <Panel key={r.student.id} className="gap-2 p-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>{`${i + 1}. ${r.student.name}`}</Text>
                    <StatusChip label={t(`app.jgd_kind_${r.kind}`)} tone={KIND_TONE[r.kind]} />
                  </View>
                  <Text variant="muted" className="text-xs">
                    {[r.decision, r.pct === null ? null : fmtPct(r.pct, 1), r.enrollment_label].filter(Boolean).join(' · ')}
                  </Text>
                  {r.no_enrollment ? <Text className="text-destructive text-xs">{t('app.jgd_no_enrollment')}</Text> : null}
                  {(r.kind === 'promote' || r.kind === 'repeat') && !r.no_enrollment ? (
                    <Picker
                      value={chosen}
                      onChange={(v) => setNext((n) => ({ ...n, [r.student.id]: v }))}
                      placeholder={t('app.jgd_pick_track')}
                      options={data.next_grade_options.map((o) => ({ value: o.id, label: o.name }))}
                    />
                  ) : null}
                  {!r.no_enrollment ? (
                    <View className="flex-row items-center gap-2">
                      <Checkbox checked={isHeld} onCheckedChange={(v) => setHeld((h) => ({ ...h, [r.student.id]: !!v }))} accessibilityLabel={t('app.jgd_hold')} />
                      <Text className="text-sm">{t('app.jgd_hold')}</Text>
                    </View>
                  ) : null}
                </Panel>
              );
            })}
            {result ? (
              <Panel className="gap-1.5 p-4">
                <Text className="text-sm font-semibold">{t('app.jgd_rollover_result', { planned: result.planned, held: result.held })}</Text>
                {result.missing_next_grade.length ? <Text className="text-warning text-xs">{`${t('app.jgd_missing_next_grade')}: ${result.missing_next_grade.join('، ')}`}</Text> : null}
                {result.no_enrollment.length ? <Text className="text-destructive text-xs">{`${t('app.jgd_no_enrollment')}: ${result.no_enrollment.join('، ')}`}</Text> : null}
              </Panel>
            ) : null}
          </>
        )}
      </ScrollView>
      {data ? (
        <StickyActions>
          <Button className="flex-1" disabled={busy} onPress={apply}>
            <Text>{t('app.jgd_rollover_apply')}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}
