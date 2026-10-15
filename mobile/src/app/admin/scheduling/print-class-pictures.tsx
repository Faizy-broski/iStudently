import { coursePeriodTeacherName, type CoursePeriod } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Check, Download, FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { adminCourses, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const STYLES = `.class-page{padding:8px 0}.rh{display:flex;justify-content:space-between;font-weight:600;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px 8px}.role{font-size:11px;font-weight:700}.teacher{font-size:12px;font-weight:600;color:#b45309}.student{font-size:12px;font-weight:500;color:#1d4ed8}`;

/** Class rosters (teacher + students) per chosen course period, for photos (web: /admin/scheduling/print-class-pictures). */
export default function PrintClassPictures() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.print_class_pictures.${k}`, o);
  const toast = useToast();
  const ctx = usePrintContext();
  const { campusId, campus } = useCampus();
  const cps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [withTeacher, setWithTeacher] = useState(true);
  const [withInactive, setWithInactive] = useState(false);
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);

  const label = (cp: CoursePeriod) => [cp.marking_period?.title, cp.period?.period_name, cp.course?.short_name || cp.course?.title, coursePeriodTeacherName(cp)].filter(Boolean).join(' - ') || t('common.course_period');
  const term = q.trim().toLowerCase();
  const shown = (cps.data ?? []).filter((cp) => !term || label(cp).toLowerCase().includes(term));
  const all = shown.length > 0 && shown.every((cp) => selected.has(cp.id));
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
      const pages = lists.map((cl) => {
        const students = cl.students.filter((s) => withInactive || !s.end_date);
        let html = `<div class="class-page" dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}"><div class="rh"><span>${escapeHtml(cl.course_title)}${cl.teacher_name ? ` — ${escapeHtml(cl.teacher_name)}` : ''}</span><span>${escapeHtml(campus?.name ?? '')}</span></div><div class="grid">`;
        if (withTeacher && cl.teacher_name) html += `<div><div class="role">${escapeHtml(p('label_teacher'))}</div><div class="teacher">${escapeHtml(cl.teacher_name)}</div></div>`;
        for (const s of students) html += `<div><div class="role">${escapeHtml(p('label_student'))}</div><div class="student">${escapeHtml(s.student_name)}</div></div>`;
        return html + '</div></div>';
      });
      const doc = buildPrintHtml({ title: p('pdf_title'), pages, school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, extraCss: STYLES });
      if (mode === 'print') await printHtml(doc);
      else await sharePdf(doc, 'class-pictures.pdf');
      toast.success(p('msg_gen_success', { count: lists.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const download = () =>
    shareTextFile('course-periods.csv', toCsv([p('th_course_period')], shown.map((cp) => [label(cp)])), 'text/csv', 'public.comma-separated-values-text').catch((e) => toast.error(e instanceof Error ? e.message : ''));

  const actions = (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready}>
        <Icon as={FileDown} className="text-foreground size-4" />
        <Text>PDF</Text>
      </Button>
      <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !ctx.ready}>
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
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-3">
              <Switch checked={withTeacher} onCheckedChange={setWithTeacher} />
              <Text className="flex-1 text-sm">{p('include_teacher')}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Switch checked={withInactive} onCheckedChange={setWithInactive} />
              <Text className="flex-1 text-sm">{p('include_inactive')}</Text>
            </View>
          </CardContent>
        </Card>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{p('found_cps', { count: shown.length })}</Text>
          <Pressable onPress={download} hitSlop={8} className="p-1" accessibilityLabel={t('common.download')}>
            <Icon as={Download} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
        <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
        {cps.isLoading ? (
          <LoadingList rows={5} />
        ) : (
          <Card>
            <CardContent className="py-1">
              <Pressable onPress={() => setSelected(all ? new Set() : new Set([...selected, ...shown.map((c) => c.id)]))} className="flex-row items-center gap-3 py-2.5">
                <View className={cn('size-5 items-center justify-center rounded border', all ? 'border-primary bg-primary' : 'border-border')}>{all ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}</View>
                <Text className="text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
              </Pressable>
              {!shown.length ? <Text className="text-muted-foreground py-4 text-center text-sm">{p('no_cps_found')}</Text> : null}
              {shown.map((cp) => (
                <View key={cp.id}>
                  <Separator />
                  <Pressable onPress={() => toggle(cp.id)} className="flex-row items-center gap-3 py-2.5" accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(cp.id) }}>
                    <View className={cn('size-5 items-center justify-center rounded border', selected.has(cp.id) ? 'border-primary bg-primary' : 'border-border')}>
                      {selected.has(cp.id) ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}
                    </View>
                    <Text className="flex-1 text-sm">{label(cp)}</Text>
                  </Pressable>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
        {actions}
      </ScrollView>
    </View>
  );
}
