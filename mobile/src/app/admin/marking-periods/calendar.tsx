import type { EventCategory, MarkingPeriodType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { CalendarDays, Pencil, Printer, RotateCcw, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { formatYmd } from '@/components/app/date-field';
import { MultiChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { buildAcademicCalendarHtml, calendarSpan, eventColor, visibleCalendarEvents } from '@/features/admin/academic-calendar';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades, events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { printHtml, sharePdf } from '@/lib/print';

const MP_TYPES: MarkingPeriodType[] = ['FY', 'SEM', 'QTR', 'PRO'];
type Custom = { title: string; year: string; schoolName: string; address: string; footerNote: string };
const NO_CUSTOM: Custom = { title: '', year: '', schoolName: '', address: '', footerNote: '' };

/** Academic calendar export: grade filter, customise, edit events, print / share PDF (web: AcademicCalendarExportButton). */
export default function AcademicCalendar() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.acal_${k}`, o);
  const toast = useToast();
  const params = useLocalSearchParams<{ group?: string }>();
  const groupId = params.group || null;
  const { campusId, campus } = useCampus();
  const print = usePrintContext();

  const mps = useApi(['admin', 'mp-grouped', campusId ?? 'school', groupId ?? 'all'], ([, , , g]) => adminGrades.markingPeriodsGrouped(campusId, g === 'all' ? null : g));
  const markingPeriods = MP_TYPES.flatMap((x) => mps.data?.[x] ?? []);
  const { startDate, endDate } = calendarSpan(markingPeriods);
  const evs = useApi(mps.data ? ['admin', 'acal-events', startDate ?? '', endDate ?? ''] : null, ([, , s, e]) => eventsApi.getEvents({ start_date: s || undefined, end_date: e || undefined, limit: 500 }));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const year = useApi(['admin', 'academic-year-current'], () => adminAcademics.currentAcademicYear(), { shouldRetryOnError: false });

  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // Customisations are saved per campus on this device (web: localStorage acal-custom:<campus>).
  const storageKey = `acal-custom:${campusId ?? 'school'}`;
  const [custom, setCustom] = useState<Custom>(NO_CUSTOM);
  useEffect(() => {
    try {
      setCustom({ ...NO_CUSTOM, ...JSON.parse(Storage.getItemSync(storageKey) || '{}') });
    } catch {
      setCustom(NO_CUSTOM);
    }
  }, [storageKey]);
  const patch = (p: Partial<Custom>) =>
    setCustom((c) => {
      const next = { ...c, ...p };
      try {
        Storage.setItemSync(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable: keep in memory only
      }
      return next;
    });
  const reset = () => {
    setCustom(NO_CUSTOM);
    try {
      Storage.removeItemSync(storageKey);
    } catch {
      // ignore
    }
  };

  const schoolName = print.school.name || 'School';
  const schoolAddress = campus?.address ?? '';
  const yearLabel = year.data?.name;
  const allEvents = evs.data ?? [];
  const editable = visibleCalendarEvents(allEvents, gradeIds).sort((x, y) => x.start_at.localeCompare(y.start_at));
  const gradeList = grades.data ?? [];
  const loading = mps.isLoading || evs.isLoading;

  const html = () =>
    buildAcademicCalendarHtml({
      markingPeriods,
      events: allEvents,
      selectedGradeIds: gradeIds,
      grades: gradeList.map((g) => ({ id: g.id, name: g.name })),
      schoolName: custom.schoolName.trim() || schoolName,
      schoolAddress: custom.address.trim() || schoolAddress,
      schoolLogoUrl: print.school.logo_url,
      academicYearLabel: custom.year.trim() || yearLabel,
      calendarTitle: custom.title,
      footerNote: custom.footerNote,
      weekStartDay: 0,
      weekEndDay: 4,
      locale: i18n.language,
      rtl: i18n.language === 'ar',
      labels: {
        title: a('default_title'),
        allGrades: a('all_grades'),
        schoolWeek: a('school_week'),
        gradePeriod: a('legend_grade'),
        schoolPeriod: a('legend_school'),
        weekend: a('legend_weekend'),
        datesToRemember: a('dates_to_remember'),
        begins: (title) => a('begins', { title }),
        ends: (title) => a('ends', { title }),
        category: (c: EventCategory) => a(`cat_${c}`),
      },
    });

  async function run(kind: 'print' | 'share') {
    setBusy(true);
    try {
      if (kind === 'print') await printHtml(html());
      else await sharePdf(html(), 'academic-calendar.pdf', { width: 842, height: 595 });
    } catch {
      toast.error(a('print_failed'));
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, key: keyof Custom, placeholder: string, max: number) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} maxLength={max} onChangeText={(v) => patch({ [key]: v })} />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('preview_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-1.5">
          <Label>{a('grade_filter')}</Label>
          <MultiChips
            value={gradeIds.length ? gradeIds : ['all']}
            onChange={(v) => setGradeIds(v.includes('all') && gradeIds.length ? [] : v.filter((x) => x !== 'all'))}
            options={[{ value: 'all', label: a('all_grades_btn') }, ...gradeList.map((g) => ({ value: g.id, label: g.name }))]}
          />
        </View>

        {loading ? (
          <LoadingList rows={4} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {custom.title.trim() || a('default_title')} {custom.year.trim() || yearLabel || ''}
              </CardTitle>
              <Text className="text-muted-foreground text-sm">{[custom.schoolName.trim() || schoolName, custom.address.trim() || schoolAddress].filter(Boolean).join(' · ')}</Text>
            </CardHeader>
            <CardContent className="gap-2">
              <Text className="text-muted-foreground text-xs">
                {startDate && endDate ? `${formatYmd(startDate, i18n.language)} – ${formatYmd(endDate, i18n.language)}` : a('no_dates')}
              </Text>
              <Text className="text-sm font-semibold">{a('dates_to_remember')}</Text>
              {markingPeriods
                .filter((m) => m.start_date || m.end_date)
                .map((m) => (
                  <View key={m.id} className="flex-row justify-between gap-2">
                    <Text className="flex-1 text-sm" numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {formatYmd(m.start_date, i18n.language)} – {formatYmd(m.end_date, i18n.language)}
                    </Text>
                  </View>
                ))}
              <Text className="text-muted-foreground text-xs">{a('events_count', { count: editable.length })}</Text>
            </CardContent>
          </Card>
        )}

        {editMode ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold">{a('customize')}</Text>
                <Button variant="ghost" size="sm" onPress={reset}>
                  <Icon as={RotateCcw} className="text-foreground size-4" />
                  <Text>{a('reset')}</Text>
                </Button>
              </View>
              {field(a('f_title'), custom.title, 'title', a('default_title'), 80)}
              {field(a('f_year'), custom.year, 'year', yearLabel || '2026-2027', 40)}
              {field(a('f_school'), custom.schoolName, 'schoolName', schoolName, 120)}
              {field(a('f_address'), custom.address, 'address', schoolAddress, 160)}
              <View className="gap-1.5">
                <Label>{a('f_note')}</Label>
                <Textarea value={custom.footerNote} maxLength={500} onChangeText={(v) => patch({ footerNote: v })} />
              </View>
              <Text className="text-sm font-semibold">{a('events_title', { count: editable.length })}</Text>
              {editable.length === 0 ? (
                <Text className="text-muted-foreground text-xs">{a('no_events')}</Text>
              ) : (
                <View className="border-border rounded-md border">
                  {editable.map((ev, i) => (
                    <View key={ev.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="flex-row items-center gap-3 px-3 py-2">
                        <View className="size-3 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                        <View className="flex-1">
                          <Text className="text-sm" numberOfLines={1}>
                            {ev.title}
                          </Text>
                          <Text className="text-muted-foreground text-xs">
                            {ev.start_at.slice(0, 10)}
                            {ev.end_at.slice(0, 10) !== ev.start_at.slice(0, 10) ? ` → ${ev.end_at.slice(0, 10)}` : ''}
                          </Text>
                        </View>
                        <Button variant="ghost" size="sm" onPress={() => router.push({ pathname: '/admin/events/form', params: { id: ev.id } })}>
                          <Icon as={Pencil} className="text-foreground size-3.5" />
                          <Text>{a('edit')}</Text>
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Text className="text-muted-foreground text-xs">{a('help')}</Text>

        <View className="gap-2">
          <Button onPress={() => run('share')} disabled={loading || busy}>
            <Icon as={Share2} className="text-primary-foreground size-4" />
            <Text>{busy ? a('preparing') : a('share_pdf')}</Text>
          </Button>
          <Button variant="outline" onPress={() => run('print')} disabled={loading || busy}>
            <Icon as={Printer} className="text-foreground size-4" />
            <Text>{a('print')}</Text>
          </Button>
          <Button variant={editMode ? 'default' : 'outline'} onPress={() => setEditMode((v) => !v)}>
            <Icon as={Pencil} className={editMode ? 'text-primary-foreground size-4' : 'text-foreground size-4'} />
            <Text>{editMode ? a('done_editing') : a('edit_calendar')}</Text>
          </Button>
          <Button variant="outline" onPress={() => router.push('/admin/events/list')}>
            <Icon as={CalendarDays} className="text-foreground size-4" />
            <Text>{a('manage_events')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
