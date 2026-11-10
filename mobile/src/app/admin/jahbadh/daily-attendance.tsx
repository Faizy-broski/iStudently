import type { JgAttendanceCalendar, JgAttendanceEntry, JgDayCode } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, CalendarCog, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { StatTile, StatTiles, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { jahbadhData } from '@/features/jahbadh/data';
import { JgBlocked, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Draft = JgDayCode | null | 'auto';
const CODES: (JgDayCode | null)[] = [null, 'غ', 'ع', 'ت'];
const CODE_CLASS: Record<JgDayCode, string> = { 'غ': 'bg-destructive-soft', 'ع': 'bg-warning-soft', 'ت': 'bg-info-soft' };
const CODE_TEXT: Record<JgDayCode, string> = { 'غ': 'text-destructive', 'ع': 'text-warning', 'ت': 'text-brand dark:text-brand-secondary' };
const key = (studentId: string, date: string) => `${studentId}|${date}`;

/** «الحضور اليومي» (web: /admin|teacher/jahbadh-grades/daily-attendance): one code per student per school day. */
export default function JahbadhDailyAttendance() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const [stage, setStage] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const att = useApi(sectionId ? (['jg', 'daily-att', sectionId, stage, campusId ?? 'own'] as const) : null, ([, , s, st, c]) =>
    jahbadhData.dailyAttendance(s, { stage: st || undefined }, c === 'own' ? null : c),
  );
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const data = att.data;
  const locale = i18n.language === 'ar' ? 'ar-LY' : 'en-GB';
  const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const days = data?.days ?? [];
  const current = day && days.includes(day) ? day : (days[0] ?? null);
  const dirty = Object.keys(draft).length;

  const codeOf = (studentId: string, date: string, original: JgDayCode | null) => {
    const k = key(studentId, date);
    if (!(k in draft)) return original;
    const v = draft[k];
    return v === 'auto' ? original : v;
  };

  const save = async () => {
    const sid = sectionId;
    if (!sid) return;
    const entries: JgAttendanceEntry[] = Object.entries(draft).map(([k, code]) => {
      const [student_id, date] = k.split('|');
      return { student_id, date, code };
    });
    if (!entries.length) return;
    setSaving(true);
    const res = await jahbadhData.saveDailyAttendance(sid, entries, campusId);
    setSaving(false);
    if (!res.success) return toast.error(res.code === 'not_migrated' ? t('app.jgd_not_migrated') : (res.error ?? t('app.error_title')));
    toast.success(t('app.jgd_saved'));
    setDraft({});
    await att.mutate();
  };

  const restorePlatform = () => {
    const d = data;
    const date = current;
    if (!d || !date) return;
    const next = { ...draft };
    for (const row of d.rows) if (row.days[date]?.source === 'jahbadh') next[key(row.student.id, date)] = 'auto';
    setDraft(next);
  };

  const alerts = (data?.rows ?? []).filter((r) => r.alert);
  return (
    <>
      <Stack.Screen options={{ title: t('app.jgd_attendance_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <Text variant="muted" className="text-xs">
          {t('app.jgd_attendance_subtitle')}
        </Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={(id) => { setSection(id); setDraft({}); }} isAdmin={isAdmin} />
        {isAdmin ? <CalendarPanel campusId={campusId} onSaved={() => att.mutate()} /> : null}

        {!sectionId ? null : att.error ? (
          <JgBlocked error={att.error} isAdmin={isAdmin} />
        ) : !data ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : !data.stages.some((s) => s.days.length) ? (
          <EmptyState icon={CalendarCog} title={isAdmin ? t('app.jgd_calendar_first_admin') : t('app.jgd_calendar_first_teacher')} />
        ) : (
          <>
            <FilterChips value={String(data.stage)} onChange={(v) => { setStage(Number(v)); setDay(null); setDraft({}); }} options={data.stages.map((s) => ({ value: String(s.stage), label: s.name }))} />
            <FilterChips value={current ?? ''} onChange={setDay} options={days.map((d) => ({ value: d, label: dayLabel(d) }))} />
            <StatTiles>
              <StatTile label={t('app.jgd_alert_limit')} value={String(data.calendar.alert_limit)} />
              <StatTile label={t('app.jgd_alert_count')} value={String(data.alert_count)} tone={data.alert_count ? 'destructive' : 'muted'} />
            </StatTiles>
            <Text variant="muted" className="text-xs">{t('app.jgd_attendance_hint')}</Text>
            {data.can_edit && current ? (
              <Button variant="outline" size="sm" onPress={restorePlatform} className="self-start">
                <Icon as={RotateCcw} className="text-foreground size-4" />
                <Text>{t('app.jgd_restore_platform')}</Text>
              </Button>
            ) : null}

            {current
              ? data.rows.map((row, i) => {
                  const cell = row.days[current];
                  const code = codeOf(row.student.id, current, cell?.code ?? null);
                  const fromPlatform = !(key(row.student.id, current) in draft) && cell?.source === 'platform';
                  const totals = row.totals[data.stage];
                  return (
                    <Panel key={row.student.id} className={cn('gap-2 p-3', row.alert && 'border-destructive')}>
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>{`${i + 1}. ${row.student.name}`}</Text>
                        {row.alert ? <Icon as={AlertTriangle} className="text-destructive size-4" /> : null}
                        <Text variant="muted" className="text-xs">{`غ ${totals?.['غ'] ?? 0} · ع ${totals?.['ع'] ?? 0} · ت ${totals?.['ت'] ?? 0}`}</Text>
                      </View>
                      <View className="flex-row gap-2">
                        {CODES.map((c) => {
                          const on = code === c;
                          return (
                            <Pressable
                              key={c ?? 'present'}
                              disabled={!data.can_edit}
                              onPress={() => setDraft((d) => ({ ...d, [key(row.student.id, current)]: c }))}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={`${row.student.name} — ${c ?? t('app.jgd_present')}`}
                              className={cn('h-10 flex-1 items-center justify-center rounded-xl border', on ? (c ? `${CODE_CLASS[c]} border-transparent` : 'bg-success-soft border-transparent') : 'border-info-soft dark:border-border bg-card', !data.can_edit && 'opacity-60')}>
                              <Text className={cn('text-sm font-bold', on && c ? CODE_TEXT[c] : on ? 'text-success' : 'text-muted-foreground', on && fromPlatform && 'italic')}>{c ?? '✓'}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {fromPlatform && code ? <Text variant="muted" className="text-2xs">{t('app.jgd_from_platform')}</Text> : null}
                    </Panel>
                  );
                })
              : null}

            {alerts.length ? (
              <Panel className="gap-1.5 p-4">
                <Text className="text-destructive text-sm font-bold">{t('app.jgd_alert_list')}</Text>
                {alerts.map((r) => (
                  <Text key={r.student.id} className="text-sm">{`${r.student.name} — ${t('app.jgd_unexcused_n', { count: r.unexcused_total })}`}</Text>
                ))}
              </Panel>
            ) : null}
          </>
        )}
      </ScrollView>
      {data?.can_edit && dirty ? (
        <StickyActions>
          <Button className="flex-1" disabled={saving} onPress={save}>
            <Text>{t('app.jgd_save_count', { count: dirty })}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Stage start dates, weekend days, holidays and the alert limit (admins). */
function CalendarPanel({ campusId, onSaved }: { campusId: string | null; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const cal = useApi(['jg', 'att-calendar', campusId ?? 'school'] as const, ([, , c]) => jahbadhData.attendanceCalendar(c === 'school' ? null : c));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JgAttendanceCalendar | null>(null);
  const [holidaysText, setHolidaysText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = form ?? cal.data ?? null;
  const dayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(i18n.language === 'ar' ? 'ar-LY' : 'en-GB', { weekday: 'short' });
  const patch = (p: Partial<JgAttendanceCalendar>) => {
    const v = value;
    if (v) setForm({ ...v, ...p });
  };

  const save = async () => {
    const v = value;
    if (!v) return;
    const holidays = holidaysText === null ? v.holidays : holidaysText.split(/[\s,]+/).filter(Boolean);
    setSaving(true);
    const res = await jahbadhData.saveAttendanceCalendar({ stage_starts: v.stage_starts, year_end: v.year_end, weekend_days: v.weekend_days, holidays, alert_limit: v.alert_limit }, campusId);
    setSaving(false);
    if (!res.success) return toast.error(res.code === 'not_migrated' ? t('app.jgd_not_migrated') : (res.error ?? t('app.error_title')));
    toast.success(t('app.jgd_saved'));
    setForm(null);
    setHolidaysText(null);
    await cal.mutate(res.data, { revalidate: false });
    onSaved();
  };

  return (
    <Panel className="gap-3 p-4">
      <Pressable onPress={() => setOpen((o) => !o)} className="flex-row items-center gap-2" accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Icon as={CalendarCog} className="text-brand dark:text-brand-secondary size-5" />
        <Text className="flex-1 text-base font-semibold">{t('app.jgd_calendar_title')}</Text>
        <Icon as={open ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
      </Pressable>
      {open && value ? (
        <View className="gap-3">
          {!value.configured ? <Text className="bg-warning-soft text-warning rounded-xl p-2.5 text-xs">{t('app.jgd_calendar_defaults')}</Text> : null}
          {[0, 1, 2].map((i) => (
            <DateField
              key={i}
              label={t('app.jgd_stage_start', { n: i + 1 })}
              value={value.stage_starts[i]}
              clearable={i > 0}
              onChange={(d) => {
                const next = [...value.stage_starts] as JgAttendanceCalendar['stage_starts'];
                next[i] = d || null;
                patch({ stage_starts: next });
              }}
            />
          ))}
          <DateField label={t('app.jgd_year_end')} value={value.year_end} clearable onChange={(d) => patch({ year_end: d || null })} />
          <Label>{t('app.jgd_weekend_days')}</Label>
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = value.weekend_days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => patch({ weekend_days: on ? value.weekend_days.filter((x) => x !== d) : [...value.weekend_days, d].sort() })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={cn('rounded-full border px-3 py-1.5', on ? 'border-brand bg-brand' : 'border-info-soft dark:border-border bg-card')}>
                  <Text className={cn('text-xs font-semibold', on ? 'text-white' : 'text-foreground')}>{dayName(d)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>{t('app.jgd_holidays')}</Label>
          <Textarea value={holidaysText ?? value.holidays.join('\n')} onChangeText={(v) => { setHolidaysText(v); patch({}); }} placeholder="2026-11-20" numberOfLines={3} />
          <Text variant="muted" className="text-xs">{t('app.jgd_holidays_hint')}</Text>
          <Label>{t('app.jgd_alert_limit')}</Label>
          <Input keyboardType="number-pad" value={String(value.alert_limit)} onChangeText={(v) => patch({ alert_limit: Number(v) || 0 })} />
          <Button onPress={save} disabled={saving || (!form && holidaysText === null)}>
            <Text>{t('app.jgd_save')}</Text>
          </Button>
        </View>
      ) : null}
    </Panel>
  );
}
