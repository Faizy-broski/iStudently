import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/app/panel';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { CheckMark } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalAcademic } from '@/features/portal/academic';
import { usePortalPrintContext } from '@/features/portal/print-context';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

const STYLES = `.class-page{padding:8px 0}.rh{display:flex;justify-content:space-between;font-weight:600;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px 8px}.role{font-size:11px;font-weight:700}.teacher{font-size:12px;font-weight:600;color:${colors.warning}}.student{font-size:12px;font-weight:500;color:${colors.brand}}`;

/** Class rosters (teacher + classmates) of the selected child's course periods (web: /parent/scheduling/print-class-pictures). */
export default function ParentPrintClassPictures() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.print_class_pictures.${k}`, o);
  const toast = useToast();
  const { child, childId } = useChild();
  const academic = usePortalAcademic();
  const yearId = academic.year?.id ?? null;
  const ctx = usePortalPrintContext(child?.campus_id);
  const schedule = useApi(childId && yearId ? ['parent', 'cp-pics-schedule', childId, yearId] : null, ([, , s, y]) => adminScheduling.studentSchedule(s as string, y as string));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [withTeacher, setWithTeacher] = useState(true);
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);

  if (!child) return <NoChild />;

  // One entry per course period of the child's schedule: "Period - Course - Teacher".
  const seen = new Set<string>();
  const cps: { id: string; label: string }[] = [];
  for (const s of schedule.data ?? []) {
    if (!s.course_period_id || seen.has(s.course_period_id)) continue;
    seen.add(s.course_period_id);
    const cp = s.course_period;
    const teacher = [cp?.teacher?.first_name, cp?.teacher?.last_name].filter(Boolean).join(' ');
    const period = cp?.period?.title || cp?.period?.short_name || cp?.short_name || '';
    cps.push({ id: s.course_period_id, label: [period, s.course?.title || '', teacher].filter(Boolean).join(' - ') || s.course_period_id.slice(0, 8) });
  }
  const term = q.trim().toLowerCase();
  const shown = term ? cps.filter((c) => c.label.toLowerCase().includes(term)) : cps;
  const all = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  async function run(mode: 'print' | 'pdf') {
    if (!selected.size) return toast.error(t('common.msg_select_item', { label: t('common.course_period') }));
    setBusy(mode);
    try {
      const res = await Promise.allSettled([...selected].map((id) => adminScheduling.classListForPeriod(id)));
      const lists = res.flatMap((r) => (r.status === 'fulfilled' && r.value.success && r.value.data ? [r.value.data] : []));
      if (!lists.length) return toast.error(p('msg_no_cl'));
      const campusName = ctx.school.name || child?.campus_name || '';
      const pages = lists.map((cl) => {
        let html = `<div class="class-page" dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}"><div class="rh"><span>${escapeHtml(cl.course_title)}${cl.teacher_name ? ` — ${escapeHtml(cl.teacher_name)}` : ''}</span><span>${escapeHtml(campusName)}</span></div><div class="grid">`;
        if (withTeacher && cl.teacher_name) html += `<div><div class="role">${escapeHtml(p('label_teacher'))}</div><div class="teacher">${escapeHtml(cl.teacher_name)}</div></div>`;
        for (const s of cl.students.filter((x) => !x.end_date)) html += `<div><div class="role">${escapeHtml(p('label_student'))}</div><div class="student">${escapeHtml(s.student_name)}</div></div>`;
        return html + '</div></div>';
      });
      const doc = buildPrintHtml({ title: p('pdf_title'), pages, school: { ...ctx.school, name: campusName }, layout: ctx.layout, withHeader: ctx.withHeader, extraCss: STYLES });
      if (mode === 'print') await printHtml(doc);
      else await sharePdf(doc, 'class-pictures.pdf');
      toast.success(p('msg_gen_success', { count: lists.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const actions = (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready || schedule.isLoading}>
        <Icon as={FileDown} className="text-foreground size-4" />
        <Text>PDF</Text>
      </Button>
      <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !ctx.ready || schedule.isLoading}>
        <Icon as={Printer} className="text-primary-foreground size-4" />
        <Text>{p('btn_create')}</Text>
      </Button>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {actions}
        <Panel className="flex-row items-center gap-3 px-4 py-3">
          <Text className="flex-1 text-sm font-medium">{p('include_teacher')}</Text>
          <Switch checked={withTeacher} onCheckedChange={setWithTeacher} />
        </Panel>
        <Text className="text-muted-foreground text-xs font-medium">{p('found_cps', { count: shown.length })}</Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
        {schedule.isLoading || academic.isLoading ? (
          <LoadingList rows={5} />
        ) : (
          <Panel>
            <Pressable
              onPress={() => setSelected(all ? new Set() : new Set([...selected, ...shown.map((c) => c.id)]))}
              className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3 active:opacity-70"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: all }}>
              <CheckMark on={all} />
              <Text className="text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
            </Pressable>
            {!shown.length ? <EmptyState title={p('no_cps_found')} /> : null}
            {shown.map((c, i) => {
              const on = selected.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => toggle(c.id)}
                  className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < shown.length - 1 && 'border-info-soft dark:border-border border-b', on && 'bg-info-soft')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}>
                  <CheckMark on={on} />
                  <Text className={cn('flex-1 text-sm', on && 'font-semibold')}>{c.label}</Text>
                </Pressable>
              );
            })}
          </Panel>
        )}
        {actions}
      </ScrollView>
    </View>
  );
}
