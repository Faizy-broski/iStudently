import type { AdminTimetableEntry } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, DoorOpen, Download, FileText, ListChecks, Plus, RefreshCw, Settings, Sparkles, Upload, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { colors } from '@/lib/colors';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile } from '@/components/app/layout';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { Tile, TileGrid } from '@/components/app/tile-grid';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { entryAt, periodTime, periodTitle, SlotDialog, sortPeriods, TimetableBuilder, TimetableGrid, TT_DAYS, type SlotTarget } from '@/features/admin/timetable';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminPeriods, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

/** Timetable for every section of a grade: overview grid or one-section builder, PDF/CSV (web: /admin/timetable). */
export default function Timetable() {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`school.timetable.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.tt_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { campusId, campus } = useCampus();
  const print = usePrintContext();
  const years = useAcademicYear();
  const yearId = years.id;
  const [gradeId, setGradeId] = useState('');
  const [mode, setMode] = useState<'grid' | 'single'>('grid');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const [settingUp, setSettingUp] = useState(false);

  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const gradeList = (grades.data ?? []).filter((g) => g.is_active !== false).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
  const gradeName = gradeList.find((g) => g.id === gradeId)?.name;
  const sectionsRes = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g));
  const sections = (sectionsRes.data ?? []).filter((s) => s.is_active !== false && s.grade_level_id === gradeId);
  const periodsRes = useApi(['admin', 'bell-periods', campusId ?? 'school'], () => adminPeriods.list(campusId));
  const periods = useMemo(() => sortPeriods(periodsRes.data ?? []), [periodsRes.data]);
  const sectionIds = sections.map((s) => s.id).join(',');
  const entriesRes = useApi(yearId && sectionIds ? ['admin', 'tt-entries', yearId, sectionIds] : null, async ([, , y, ids]) => {
    const list = await Promise.all(ids.split(',').map(async (id) => [id, (await adminTimetable.bySection(id, y)).data ?? []] as const));
    return { success: true, data: Object.fromEntries(list) as Record<string, AdminTimetableEntry[]> };
  });
  const entries = entriesRes.data ?? {};
  const reload = () => entriesRes.mutate();

  const currentId = expanded && sections.some((s) => s.id === expanded) ? expanded : (sections[0]?.id ?? null);
  const currentIdx = sections.findIndex((s) => s.id === currentId);
  const yearName = years.years.find((y) => y.id === yearId)?.name ?? '';
  const minLabel = tt('unit_min');

  async function remove(entry: AdminTimetableEntry) {
    if (!(await confirm({ title: tt('confirm_remove'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminTimetable.deleteEntry(entry.id);
    if (!r.success) return toast.error(r.error || tt('err_delete'));
    toast.success(tt('success_removed'));
    reload();
  }

  async function setupGrade() {
    if (!gradeId) return;
    setSettingUp(true);
    try {
      const r = await adminTimetable.ensureGradeSection(gradeId, campusId);
      if (!r.success || !r.data) return toast.error(r.error || tt('err_setup_grade'));
      await sectionsRes.mutate();
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'sections');
      toast.success(tt('grade_timetable_ready', { grade: gradeName ?? '', count: r.data.studentsAssigned }));
    } finally {
      setSettingUp(false);
    }
  }

  const cellText = (e?: AdminTimetableEntry) => (e ? `${e.subject_name} (${e.teacher_name})` : '-');

  async function downloadCsv() {
    if (!gradeId || !sections.length) return toast.error(tt('err_select_grade_first'));
    const days = TT_DAYS.map((d) => t(`school.timetable.days.${d}`));
    const rows: string[][] = [[`${tt('filter_year')}: ${yearName}`], []];
    for (const s of sections) {
      rows.push([], [`Section: ${s.name}`], [tt('csv_period'), tt('csv_time'), ...days]);
      for (const p of periods) rows.push([periodTitle(p), periodTime(p, minLabel), ...TT_DAYS.map((_, i) => cellText(entryAt(entries[s.id] ?? [], i, p.id)))]);
    }
    await shareTextFile(`timetable_${(gradeName ?? 'grade').replace(/\s+/g, '_')}.csv`, toCsv([tt('csv_title', { grade: gradeName })], rows), 'text/csv', 'public.comma-separated-values-text');
    toast.success(tt('success_csv'));
  }

  async function downloadPdf() {
    if (!gradeId || !sections.length) return toast.error(tt('err_select_grade_first'));
    const list = mode === 'grid' ? sections : sections.filter((s) => s.id === currentId);
    if (!list.length) return toast.error(tt('err_no_section'));
    const days = TT_DAYS.map((d) => t(`school.timetable.days.${d}`));
    const title = mode === 'grid' ? tt('pdf_title_all', { grade: gradeName }) : tt('pdf_title_single', { grade: gradeName, section: list[0].name });
    const tables = list
      .map((s) => {
        const head = `<tr><th>${escapeHtml(tt('csv_time'))}</th>${days.map((d) => `<th>${escapeHtml(d)}</th>`).join('')}</tr>`;
        const body = periods
          .map(
            (p) =>
              `<tr><td><b>${escapeHtml(periodTime(p, minLabel))}</b><br/>${escapeHtml(periodTitle(p))}</td>${TT_DAYS.map((_, i) => {
                const e = entryAt(entries[s.id] ?? [], i, p.id);
                return `<td>${e ? `${escapeHtml(e.subject_name)}<br/><span class="muted">${escapeHtml(e.teacher_name)}</span>` : '-'}</td>`;
              }).join('')}</tr>`,
          )
          .join('');
        return `<h3>Section: ${escapeHtml(s.name)}</h3><table class="tt">${head}${body}</table>`;
      })
      .join('');
    const body = `<h2 style="text-align:center;color:${colors.brand}">${escapeHtml(title)}</h2><p style="text-align:center;color:${colors.printMuted}">${escapeHtml(`${tt('filter_year')}: ${yearName}`)}</p>${tables}`;
    const css = `.tt{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10px}.tt th{background:${colors.brand};color:${colors.white};padding:5px}.tt td{border:1px solid ${colors.printBorder};padding:5px;text-align:center;vertical-align:middle}.tt td:first-child{width:80px}.muted{color:${colors.printMuted}}h3{color:${colors.brand};margin:10px 0 4px}`;
    try {
      const landscape = mode === 'grid' && list.length > 1;
      await sharePdf(
        buildPrintHtml({ title, pages: [body], school: print.school, layout: print.layout, withHeader: print.withHeader, reportLabel: title, extraCss: css }),
        mode === 'grid' ? `timetable_${(gradeName ?? '').replace(/\s+/g, '_')}_all_sections.pdf` : `timetable_${(gradeName ?? '').replace(/\s+/g, '_')}_${list[0].name}.pdf`,
        landscape ? { width: 842, height: 595 } : undefined,
      );
      toast.success(tt('success_pdf'));
    } catch {
      toast.error(a('pdf_failed'));
    }
  }

  const loading = grades.isLoading || periodsRes.isLoading || years.years.length === 0;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: tt('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{tt('subtitle')}</Text>
        <TileGrid>
          <Tile icon={Sparkles} label={a('auto_generate')} onPress={() => router.push('/admin/timetable/generate')} />
          <Tile icon={ListChecks} label={a('requirements')} onPress={() => router.push('/admin/timetable/requirements')} />
          <Tile icon={DoorOpen} label={a('rooms')} onPress={() => router.push('/admin/timetable/rooms')} />
          <Tile icon={Settings} label={tt('btn_manage_periods')} onPress={() => router.push('/admin/periods')} />
          <Tile icon={Upload} label={a('import')} onPress={() => router.push('/admin/timetable/import')} />
          <Tile icon={RefreshCw} label={tt('btn_refresh')} onPress={reload} />
        </TileGrid>
        <View className="flex-row gap-2">
          <Button className="flex-1" size="sm" variant="outline" onPress={downloadPdf} disabled={!gradeId || !sections.length}>
            <Icon as={FileText} className="text-foreground size-4" />
            <Text>{tt('btn_pdf')}</Text>
          </Button>
          <Button className="flex-1" size="sm" variant="outline" onPress={downloadCsv} disabled={!gradeId || !sections.length}>
            <Icon as={Download} className="text-foreground size-4" />
            <Text>{tt('btn_csv')}</Text>
          </Button>
        </View>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-sm font-medium">{tt('filter_year')}</Text>
            <Picker value={yearId ?? ''} onChange={years.pick} placeholder={tt('placeholder_year')} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` ${tt('current_label')}` : ''}` }))} />
            <Text className="text-sm font-medium">{tt('filter_grade')}</Text>
            <FilterChips
              value={gradeId ?? ''}
              onChange={(v) => {
                setGradeId(v);
                setExpanded(null);
              }}
              options={gradeList.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Text className="text-sm font-medium">{tt('filter_view_mode')}</Text>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'grid', label: tt('view_overview') },
                { value: 'single', label: tt('view_builder') },
              ]}
            />
            <Text className="text-sm font-medium">{tt('filter_layout')}</Text>
            <Segmented
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'vertical', label: tt('layout_vertical') },
                { value: 'horizontal', label: tt('layout_horizontal') },
              ]}
            />
            <Text className="text-muted-foreground text-xs">{orientation === 'vertical' ? tt('layout_vertical_tip') : tt('layout_horizontal_tip')}</Text>
            {gradeId ? <StatusChip label={tt('sections_count', { count: sections.length })} tone="info" className="self-start px-2.5 py-1" /> : null}
          </CardContent>
        </Card>

        {loading || (gradeId && sectionsRes.isLoading) ? (
          <LoadingList />
        ) : !campus && !campusId ? (
          <EmptyState icon={Calendar} title={tt('no_campus_title')} body={tt('no_campus_desc')} />
        ) : !gradeId ? (
          <EmptyState icon={Calendar} title={tt('no_grade_title')} body={tt('no_grade_desc')} />
        ) : sections.length === 0 ? (
          <View className="gap-2">
            <EmptyState icon={Calendar} title={tt('no_sections_title')} body={tt('no_sections_desc', { grade: gradeName })} actionLabel={settingUp ? undefined : tt('btn_setup_grade_timetable', { grade: gradeName ?? '' })} onAction={settingUp ? undefined : setupGrade} />
            <Text className="text-muted-foreground text-center text-xs">{tt('setup_grade_hint')}</Text>
          </View>
        ) : periods.length === 0 ? (
          <EmptyState icon={Settings} title={tt('no_periods_title')} body={tt('no_periods_desc')} actionLabel={tt('btn_configure_periods')} onAction={() => router.push('/admin/periods')} />
        ) : mode === 'grid' ? (
          <View className="gap-4">
            <Text className="text-lg font-semibold">{tt('grade_all_sections', { grade: gradeName })}</Text>
            {sections.map((s) => {
              const list = entries[s.id] ?? [];
              return (
                <Card key={s.id}>
                  <CardContent className="gap-2 pt-4">
                    <View className="flex-row items-center gap-3">
                      <IconTile icon={Calendar} />
                      <Text className="flex-1 font-semibold">{s.name}</Text>
                      <StatusChip label={tt('classes_count', { count: list.length })} tone="info" className="px-2 py-0.5" />
                    </View>
                    {entriesRes.isLoading ? (
                      <LoadingList rows={3} />
                    ) : (
                      <TimetableGrid
                        periods={periods}
                        orientation={orientation}
                        cellWidth={92}
                        renderCell={(_d, dayIdx, p) => {
                          const e = entryAt(list, dayIdx, p.id);
                          return (
                            <Pressable
                              onPress={() => setSlot({ sectionId: s.id, sectionName: s.name, gradeId, gradeName, dayIdx, period: p, existing: e })}
                              className={cn('min-h-12 justify-center p-1', e && 'bg-info-soft ')}>
                              {e ? (
                                <View>
                                  <View className="flex-row items-start justify-between gap-1">
                                    <Text className="text-primary flex-1 text-[11px] font-medium" numberOfLines={1}>
                                      {e.subject_name}
                                    </Text>
                                    <Pressable onPress={() => remove(e)} hitSlop={6} accessibilityLabel={t('common.delete')}>
                                      <Icon as={X} className="text-muted-foreground size-3" />
                                    </Pressable>
                                  </View>
                                  <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
                                    {e.teacher_name}
                                  </Text>
                                </View>
                              ) : (
                                <Icon as={Plus} className="text-muted-foreground/30 size-4 self-center" />
                              )}
                            </Pressable>
                          );
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-lg font-semibold">{tt('grade_all_sections', { grade: gradeName })}</Text>
            <View className="flex-row items-center gap-2">
              <Button size="icon" variant="outline" disabled={currentIdx <= 0} onPress={() => setExpanded(sections[currentIdx - 1].id)} accessibilityLabel={t('common.previous')}>
                <Icon flipRtl as={ChevronLeft} className="text-foreground size-4" />
              </Button>
              <View className="flex-1">
                <Picker value={currentId ?? ''} onChange={setExpanded} placeholder={tt('placeholder_select_section')} options={sections.map((s) => ({ value: s.id, label: `${s.name} (${tt('classes_count', { count: (entries[s.id] ?? []).length })})` }))} />
              </View>
              <Button size="icon" variant="outline" disabled={currentIdx >= sections.length - 1} onPress={() => setExpanded(sections[currentIdx + 1].id)}>
                <Icon flipRtl as={ChevronRight} className="text-foreground size-4" />
              </Button>
            </View>
            {currentId && yearId ? (
              <TimetableBuilder
                key={currentId}
                sectionId={currentId}
                sectionName={sections[currentIdx]?.name ?? ''}
                gradeId={gradeId}
                gradeName={gradeName}
                periods={periods}
                entries={entries[currentId] ?? []}
                academicYearId={yearId}
                orientation={orientation}
                loading={entriesRes.isLoading}
                onChange={reload}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
      {yearId ? <SlotDialog target={slot} academicYearId={yearId} withCoursePeriods onClose={() => setSlot(null)} onSaved={reload} /> : null}
    </View>
  );
}
