import type { StudentScheduleEntry } from '@studently/api-client';
import type { PrintSchool } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { dayIndexes } from '@/features/admin/scheduling-tools';
import { adminGrades, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

type TitleOf = 'subject' | 'course' | 'course_period';

const STYLES = `.schedule-page{padding:8px 0}.page-title{font-size:20px;font-style:italic;color:${colors.printText};margin:8px 0}.rh{display:flex;justify-content:space-between;font-weight:600}.sub{display:flex;justify-content:space-between;color:${colors.printMuted};font-size:12px}.count{font-size:12px;color:${colors.warning};margin:6px 0}
table{width:100%;border-collapse:collapse;font-size:12px}th{background:${colors.chart6};color:${colors.white};padding:6px 8px;text-align:start;font-size:11px}td{padding:6px 8px;border:1px solid ${colors.printBorder};vertical-align:top}.period-cell{font-weight:600;color:${colors.warning};background:${colors.warningSoft}}.course{color:${colors.warning};font-weight:500}.teacher,.room{font-size:11px;color:${colors.printMuted}}`;

function titleOf(s: StudentScheduleEntry, mode: TitleOf) {
  if (mode === 'subject') return s.course?.subject?.name || s.course?.title || '—';
  if (mode === 'course') return s.course?.title || '—';
  return s.course_period?.short_name || s.course?.title || '—';
}

const teacherOf = (s: StudentScheduleEntry) => {
  const tr = s.course_period?.teacher;
  return [tr?.profile?.first_name ?? tr?.first_name, tr?.profile?.last_name ?? tr?.last_name].filter(Boolean).join(' ');
};

export type PrintStudent = { id: string; name: string; number: string; grade: string | null };
export type PrintCtx = { school: PrintSchool; withHeader: boolean; layout: Parameters<typeof buildPrintHtml>[0]['layout']; ready: boolean };

/**
 * Printable weekly schedules, as a grid or a list (web: /admin and /parent scheduling/print-schedules).
 * `chosen()` returns the students to print (null when none is picked); `list` renders the picker.
 */
export function PrintSchedulesView({ ctx, campusId, yearId, chosen: pick, list }: { ctx: PrintCtx; campusId?: string | null; yearId: string | null; chosen: () => PrintStudent[] | null; list: ReactNode }) {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.print_schedules.${k}`, o);
  const toast = useToast();
  const mps = useApi(['portal', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId ?? undefined));
  const [mp, setMp] = useState('na');
  const [asOf, setAsOf] = useState(todayYmd());
  const [view, setView] = useState<'table' | 'list'>('table');
  const [horizontal, setHorizontal] = useState(false);
  const [titleMode, setTitleMode] = useState<TitleOf>('course');
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const days = [0, 1, 2, 3, 4].map((i) => t(`common.days_full.${i}`));

  async function run(mode: 'print' | 'pdf') {
    const chosen = pick();
    if (!chosen?.length) return toast.error(t('common.msg_select_student'));
    if (!yearId) return toast.error(t('common.error'));
    setBusy(mode);
    try {
      const results = await Promise.allSettled(chosen.map((s) => adminScheduling.studentSchedule(s.id, yearId)));
      const today = new Date().toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' });
      const pages: string[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !r.value.success) return;
        const st = chosen[i];
        // Courses active on the chosen date, in the chosen marking period (or all).
        const list = (r.value.data ?? []).filter((x) => x.start_date <= asOf && (!x.end_date || x.end_date >= asOf) && (mp === 'na' || !x.marking_period_id || x.marking_period_id === mp));
        const byPeriod = new Map<string, Map<number, StudentScheduleEntry>>();
        for (const x of list) {
          const cp = x.course_period;
          if (!cp) continue;
          const key = cp.period?.title || cp.period?.short_name || cp.short_name || t('common.period');
          if (!byPeriod.has(key)) byPeriod.set(key, new Map());
          const d = dayIndexes(cp.days);
          for (const di of d.length ? d : [0, 1, 2, 3, 4]) byPeriod.get(key)!.set(di, x);
        }
        let html = `<div class="schedule-page" dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}"><div class="page-title">${escapeHtml(p('pdf_title'))}</div>`;
        html += `<div class="rh"><span>${escapeHtml(st.name)}</span><span>${escapeHtml(st.number)}</span></div>`;
        html += `<div class="sub"><span>${escapeHtml(st.grade || '—')}</span><span>${escapeHtml(today)}</span></div>`;
        html += `<div class="count">${escapeHtml(t('common.found_items', { count: byPeriod.size, label: t('common.period') }))}</div>`;
        if (view === 'table') {
          html += `<table><thead><tr><th>${escapeHtml(p('th_period'))}</th>${days.map((d) => `<th>${escapeHtml(d)}</th>`).join('')}</tr></thead><tbody>`;
          for (const [period, dayMap] of byPeriod) {
            html += `<tr><td class="period-cell">${escapeHtml(period)}</td>`;
            for (let d = 0; d < 5; d++) {
              const x = dayMap.get(d);
              html += x
                ? `<td><div class="course">${escapeHtml(titleOf(x, titleMode))}</div>${teacherOf(x) ? `<div class="teacher">${escapeHtml(teacherOf(x))}</div>` : ''}${x.course_period?.room ? `<div class="room">${escapeHtml(p('label_room', { room: x.course_period.room }))}</div>` : ''}</td>`
                : '<td></td>';
            }
            html += '</tr>';
          }
          html += '</tbody></table>';
        } else {
          html += `<table><thead><tr><th>${escapeHtml(p('th_period'))}</th><th>${escapeHtml(p('opt_course'))}</th><th>${escapeHtml(t('common.teacher'))}</th><th>${escapeHtml(t('common.room'))}</th></tr></thead><tbody>`;
          for (const [period, dayMap] of byPeriod) {
            const x = dayMap.values().next().value;
            if (x) html += `<tr><td>${escapeHtml(period)}</td><td>${escapeHtml(titleOf(x, titleMode))}</td><td>${escapeHtml(teacherOf(x))}</td><td>${escapeHtml(x.course_period?.room ?? '')}</td></tr>`;
          }
          html += '</tbody></table>';
        }
        pages.push(html + '</div>');
      });
      if (!pages.length) return toast.error(p('msg_no_schedules'));
      const doc = buildPrintHtml({ title: p('pdf_title'), pages, school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, extraCss: `${STYLES}${horizontal ? '@page{size:A4 landscape}' : ''}` });
      if (mode === 'print') await printHtml(doc);
      else await sharePdf(doc, `schedules-${todayYmd()}.pdf`, horizontal ? { width: 842, height: 595 } : undefined);
      toast.success(p('msg_gen_success', { count: pages.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const actions = (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready}>
        <Icon as={FileDown} className="text-foreground size-4" />
        <Text>PDF</Text>
      </Button>
      <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !ctx.ready}>
        <Icon as={Printer} className="text-primary-foreground size-4" />
        <Text>{p('btn_create_schedules')}</Text>
      </Button>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {actions}
        <Panel className="gap-4 p-4">
          <View className="gap-1.5">
            <Label>{p('label_marking_period')}</Label>
            <Picker value={mp} onChange={setMp} options={[{ value: 'na', label: 'N/A' }, ...(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))]} />
          </View>
          <DateField label={p('label_active_as_of')} value={asOf} onChange={setAsOf} />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: p('view_table') },
              { value: 'list', label: p('view_list') },
            ]}
          />
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 text-sm font-medium">{p('label_horizontal')}</Text>
            <Switch checked={horizontal} onCheckedChange={setHorizontal} />
          </View>
          <View className="gap-1.5">
            <Label>{p('label_display_title')}</Label>
            <FilterChips
              value={titleMode}
              onChange={setTitleMode}
              options={[
                { value: 'subject', label: p('opt_subject') },
                { value: 'course', label: p('opt_course') },
                { value: 'course_period', label: p('opt_course_period') },
              ]}
            />
          </View>
        </Panel>
        {list}
        {actions}
      </ScrollView>
    </View>
  );
}
