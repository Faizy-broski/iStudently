import { isRunDone, type BulkSendRun, type DisciplineLogFields } from '@studently/api-client';
import { htmlToText, textToHtml } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { RichTextField } from '@/components/app/rich-text-field';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useAcademicYears } from '@/features/admin/grades';
import { PeoplePicker, type PeopleEntity } from '@/features/admin/people-picker';
import { MultiSelect } from '@/components/app/multi-select';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminAcademics, adminEmployees, adminGrades, adminMail } from '@/lib/api';
import { useApi } from '@/lib/data';

type Audience = 'students' | 'staff' | 'balances' | 'balances-parents' | 'days-absent' | 'discipline' | 'discipline-parents' | 'report-cards' | 'report-cards-parents';
const TOKENS: Record<Audience, string[]> = {
  'days-absent': ['parent_name', 'full_name', 'first_name', 'last_name', 'grade', 'student_id', 'days_absent', 'start_date', 'end_date', 'days_absent_list'],
  discipline: ['full_name', 'first_name', 'last_name', 'email', 'grade', 'referral_count', 'discipline_log'],
  'discipline-parents': ['full_name', 'first_name', 'last_name', 'email', 'grade', 'referral_count', 'discipline_log'],
  students: ['full_name', 'first_name', 'last_name', 'email', 'student_id', 'grade'],
  staff: ['full_name', 'first_name', 'last_name', 'email', 'staff_id'],
  balances: ['full_name', 'first_name', 'last_name', 'email', 'grade', 'student_id', 'balance', 'fees_list'],
  'balances-parents': ['full_name', 'first_name', 'last_name', 'email', 'grade', 'student_id', 'balance', 'fees_list'],
  'report-cards': ['full_name', 'first_name', 'last_name', 'email', 'grade', 'student_id', 'report_card'],
  'report-cards-parents': ['full_name', 'first_name', 'last_name', 'email', 'grade', 'student_id', 'report_card'],
};
const AUDIENCES: Audience[] = ['students', 'staff', 'balances', 'balances-parents', 'days-absent', 'discipline', 'discipline-parents', 'report-cards', 'report-cards-parents'];
const isBalances = (a: Audience) => a === 'balances' || a === 'balances-parents';
const isDiscipline = (a: Audience) => a === 'discipline' || a === 'discipline-parents';
const isReportCards = (a: Audience) => a === 'report-cards' || a === 'report-cards-parents';
const RC_FIELDS = ['teacher', 'comments', 'percents', 'credits'] as const;
type RcFields = Record<(typeof RC_FIELDS)[number], boolean>;
const LOG_FIELDS = ['entryDate', 'reporter', 'violation', 'detention', 'suspension', 'comments'] as const;
const DEFAULT_INCLUDE: DisciplineLogFields = { entryDate: true, reporter: true, violation: true, detention: false, suspension: false, comments: false };

/** Default balance email (the web's text). Kept in code: {{tokens}} would be read as placeholders by the ICU strings. */
const BALANCE_DEFAULT = {
  en: { subject: 'Outstanding balance – {{full_name}}', body: 'Dear {{full_name}},\n\nYour current outstanding balance is {{balance}}.\n\n{{fees_list}}\n\nPlease contact the school office if you have any questions.' },
  ar: { subject: 'الرصيد المستحق – {{full_name}}', body: 'عزيزي {{full_name}}،\n\nرصيدك المستحق حاليًا هو {{balance}}.\n\n{{fees_list}}\n\nيرجى التواصل مع إدارة المدرسة لأي استفسار.' },
};

/** The web's default texts for the attendance and discipline senders. */
const DEFAULTS: Partial<Record<Audience, { subject: string; body: string }>> = {
  'days-absent': {
    subject: 'Days Absent – {{full_name}}',
    body: 'Dear {{parent_name}},\n\n{{full_name}} was reported absent {{days_absent}} day(s) for the period from {{start_date}} to {{end_date}}:\n\n{{days_absent_list}}\n\nPlease contact the school if you have any questions.',
  },
  discipline: { subject: 'Discipline Log – {{full_name}}', body: 'Dear {{full_name}},\n\nPlease review the following discipline records:\n\n{{discipline_log}}' },
  'discipline-parents': { subject: 'Discipline Log – {{full_name}}', body: 'Dear {{full_name}},\n\nPlease review the following discipline records:\n\n{{discipline_log}}' },
};

/** The web's default report card email ({{report_card}} is replaced by the card itself). */
const REPORT_CARD_DEFAULT = {
  en: { subject: 'Report Card - {{full_name}}', body: 'Dear {{full_name}},\n\nPlease find your report card below:\n\n{{report_card}}' },
  ar: { subject: 'كشف الدرجات - {{full_name}}', body: 'عزيزي/عزيزتي {{full_name}}،\n\nيرجى الاطلاع على كشف الدرجات أدناه:\n\n{{report_card}}' },
};

function defaultText(a: Audience) {
  if (isBalances(a)) return BALANCE_DEFAULT[locale === 'ar' ? 'ar' : 'en'];
  if (isReportCards(a)) return REPORT_CARD_DEFAULT[locale === 'ar' ? 'ar' : 'en'];
  return DEFAULTS[a] ?? { subject: '', body: '' };
}

/** Email selected students, staff, balances, days absent or discipline logs (web: /admin/email/*, attendance/email-parents, discipline/email-*). */
export default function SendEmail() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.students.send_email.${k}`, o);
  const toast = useToast();
  const params = useLocalSearchParams<{ audience?: string }>();
  const audience: Audience = AUDIENCES.includes(params.audience as Audience) ? (params.audience as Audience) : 'students';
  const { campusId } = useCampus();
  const [step, setStep] = useState<'compose' | 'recipients' | 'sending'>('compose');
  // Balance emails start from the web's default text; the server fills {{balance}} and {{fees_list}}.
  const [subject, setSubject] = useState(() => defaultText(audience).subject);
  // Rich-text body (HTML), like the web's RichTextEditor; the default texts start as paragraphs.
  const [body, setBody] = useState(() => textToHtml(defaultText(audience).body));
  const insertToken = useRef<(content: string) => void>(() => {});
  const [startDate, setStartDate] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [endDate, setEndDate] = useState(todayYmd);
  const [yearId, setYearId] = useState('');
  const [include, setInclude] = useState<DisciplineLogFields>(DEFAULT_INCLUDE);
  const [rcInclude, setRcInclude] = useState<RcFields>({ teacher: false, comments: true, percents: true, credits: false });
  const [mpId, setMpId] = useState('');
  const mps = useApi(isReportCards(audience) ? ['admin', 'marking-periods', campusId ?? 'school'] : null, () => adminGrades.markingPeriods(campusId));
  const years = useAcademicYears();
  const [testEmail, setTestEmail] = useState('');
  // Web staff email: all employees by default, or one role.
  const [staffKind, setStaffKind] = useState<PeopleEntity>('employees');
  // Web student emails: grade/section filters (sections of the chosen grades) and CC staff.
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const studentAudience = audience !== 'staff';
  const gradesQ = useApi(studentAudience ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const sectionsQ = useApi(studentAudience ? ['admin', 'sections', campusId ?? 'school', 'all'] : null, () => adminAcademics.sections(campusId));
  const ccStaff = useApi(audience === 'students' ? ['admin', 'email-cc-staff', campusId ?? 'school'] : null, () => adminEmployees.list('all', undefined, { page: 1, limit: 200 }));
  const gradeList = gradesQ.data ?? [];
  const sectionOptions = (sectionsQ.data ?? [])
    .filter((x) => gradeIds.includes(x.grade_level_id))
    .map((x) => ({ id: x.id, label: gradeIds.length > 1 ? `${gradeList.find((g) => g.id === x.grade_level_id)?.name ?? ''} - ${x.name}` : x.name }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<BulkSendRun | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (polling.current) clearInterval(polling.current);
  }, []);

  function next() {
    if (!subject.trim()) return toast.error(s('subject_required'));
    if (!htmlToText(body).trim()) return toast.error(s('body_required'));
    if (audience === 'days-absent' && startDate > endDate) return toast.error(t('app.at_range_order'));
    setStep('recipients');
  }

  async function send() {
    if (selected.size === 0) return toast.error(s('select_student_error'));
    const input = {
      recipient_ids: [...selected],
      subject: subject.trim(),
      body,
      test_email: testEmail.trim() || undefined,
      cc_emails: audience === 'students' && ccEmails.length ? ccEmails : undefined,
      campus_id: campusId,
    };
    const res =
      audience === 'staff'
        ? await adminMail.sendToStaff(input)
        : audience === 'days-absent'
          ? await adminMail.sendDaysAbsent({ ...input, start_date: startDate, end_date: endDate })
          : isDiscipline(audience)
            ? await adminMail.sendDisciplineLog({ ...input, academic_year_id: yearId || undefined, include_fields: include }, audience === 'discipline-parents')
            : isBalances(audience)
              ? await adminMail.sendBalances({ ...input, academic_year: yearId || undefined }, audience === 'balances-parents')
              : isReportCards(audience)
                ? await adminMail.sendReportCards(
                    { ...input, marking_period_id: mpId || undefined, academic_year_id: yearId || undefined, include_fields: rcInclude },
                    audience === 'report-cards-parents',
                  )
                : await adminMail.sendToStudents(input);
    if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
    const runId = res.data.run_id;
    setStep('sending');
    polling.current = setInterval(async () => {
      const r = await adminMail.bulkRun(runId);
      if (!r.success || !r.data) return;
      setRun(r.data);
      if (isRunDone(r.data) && polling.current) {
        clearInterval(polling.current);
        polling.current = null;
      }
    }, 2000);
  }

  if (step === 'sending') {
    const done = run && isRunDone(run);
    const pct = run && run.batches_total ? Math.round((run.batches_done / run.batches_total) * 100) : 0;
    return (
      <>
        <Stack.Screen options={{ title: s('results_title') }} />
        <Screen scroll edges={['bottom']}>
          <Card className="gap-3 py-4">
            <CardContent className="gap-3 px-4">
              <Text className="font-semibold">{done ? s('results_title') : s('sending')}</Text>
              <Progress value={done ? 100 : pct} />
              {run ? (
                <View className="gap-1">
                  <Text>{`${s('total_recipients')}: ${run.total_recipients}`}</Text>
                  <Text>{`${s('sent_successfully')}: ${run.success_count}`}</Text>
                  <Text className={run.fail_count ? 'text-destructive' : undefined}>{`${s('failed')}: ${run.fail_count}`}</Text>
                  {run.skipped_count ? <Text className="text-muted-foreground">{`${t('app.em_skipped')}: ${run.skipped_count}`}</Text> : null}
                </View>
              ) : null}
            </CardContent>
          </Card>
          {run?.errors?.length ? (
            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle>{s('failed_recipients')}</CardTitle>
              </CardHeader>
              <CardContent className="gap-1 px-4">
                {run.errors.slice(0, 50).map((e) => (
                  <Text key={e.id} className="text-sm">{`${e.name} (${e.email}): ${e.error}`}</Text>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Button onPress={() => router.back()} disabled={!done}>
            <Text>{t('app.cs_close')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  if (step === 'recipients') {
    const entity: PeopleEntity = audience === 'staff' ? staffKind : 'student';
    return (
      <>
        <Stack.Screen options={{ title: s('recipients_title') }} />
        <PeoplePicker
          entity={entity}
          campusId={campusId}
          selected={selected}
          onChange={setSelected}
          selectAllWithEmail
          filter={studentAudience ? { gradeIds, sectionIds: sectionIds.filter((id) => sectionOptions.some((o) => o.id === id)) } : undefined}
          subtitle={(r) => r.email || s('no_email')}
          header={
            audience === 'staff' ? (
              <FilterChips<PeopleEntity>
                value={staffKind}
                onChange={setStaffKind}
                options={[
                  { value: 'employees', label: t('email.role_all') },
                  { value: 'teacher', label: t('email.role_teachers') },
                  { value: 'librarian', label: t('email.role_librarians') },
                  { value: 'staff', label: t('email.role_staff') },
                  { value: 'counselor', label: t('email.role_counselors') },
                ]}
              />
            ) : (
              <View className="gap-2">
                <MultiSelect
                  options={gradeList.map((g) => ({ id: g.id, label: g.name }))}
                  value={gradeIds}
                  onChange={setGradeIds}
                  placeholder={t('app.em_all_grades')}
                  title={t('app.em_grades')}
                />
                {gradeIds.length && sectionOptions.length ? (
                  <MultiSelect options={sectionOptions} value={sectionIds} onChange={setSectionIds} placeholder={t('app.em_all_sections')} title={t('app.em_sections')} />
                ) : null}
              </View>
            )
          }
          footer={
            <View className="border-border flex-row gap-2 border-t p-4">
              <Button variant="outline" onPress={() => setStep('compose')}>
                <Text>{t('twoFa.back')}</Text>
              </Button>
              <Button className="flex-1" onPress={send} disabled={selected.size === 0}>
                <Text>{t('app.em_send_count', { count: selected.size })}</Text>
              </Button>
            </View>
          }
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            audience === 'staff'
              ? t('app.em_title_staff')
              : isBalances(audience)
                ? t(`app.em_title_${audience}`)
                : audience === 'days-absent'
                  ? t('app.em_title_days_absent')
                  : isReportCards(audience)
                    ? t(`school.grades_module.${audience === 'report-cards' ? 'email_students' : 'email_parents'}.title`)
                  : audience === 'discipline-parents'
                    ? t('discipline.sendLogToParents')
                    : audience === 'discipline'
                      ? t('app.em_title_discipline')
                      : s('title'),
        }}
      />
      <Screen scroll edges={['bottom']}>
        {audience === 'days-absent' ? (
          <View className="gap-1.5">
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={t('app.at_from')} value={startDate} onChange={(d) => d && setStartDate(d)} />
              <DateField className="flex-1" label={t('app.at_to')} value={endDate} onChange={(d) => d && setEndDate(d)} />
            </View>
            <Text className="text-muted-foreground text-xs">{t('app.em_absence_range_hint')}</Text>
          </View>
        ) : null}
        {isReportCards(audience) ? (
          <View className="gap-3">
            <Text className="text-muted-foreground text-sm">{t(`school.grades_module.${audience === 'report-cards' ? 'email_students' : 'email_parents'}.subtitle`)}</Text>
            <View className="gap-1">
              <Label>{t('school.grades_module.send_report_cards.include_in_report_card')}</Label>
              <View className="flex-row flex-wrap gap-x-4">
                {RC_FIELDS.map((f) => (
                  <CheckRow key={f} checked={rcInclude[f]} onPress={() => setRcInclude((x) => ({ ...x, [f]: !x[f] }))} label={t(`school.grades_module.send_report_cards.include_fields.${f}`)} />
                ))}
              </View>
            </View>
            <View className="gap-1.5">
              <Label>{t('school.grades_module.common.marking_period')}</Label>
              <Picker
                value={mpId}
                onChange={setMpId}
                options={[{ value: '', label: t('school.grades_module.common.marking_period_placeholder') }, ...(mps.data ?? []).filter((m) => m.does_grades).map((m) => ({ value: m.id, label: m.title }))]}
              />
            </View>
            <View className="gap-1.5">
              <Label>{t('school.grades_module.send_report_cards.academic_year')}</Label>
              <Picker value={yearId} onChange={setYearId} options={[{ value: '', label: t('school.grades_module.send_report_cards.all_years') }, ...years.list.map((y) => ({ value: y.id, label: y.name }))]} />
            </View>
          </View>
        ) : null}
        {isBalances(audience) ? (
          <View className="gap-1.5">
            <Label>{t('app.em_academic_year')}</Label>
            <Picker value={yearId} onChange={setYearId} placeholder={t('app.em_all_years')} options={[{ value: '', label: t('app.em_all_years') }, ...years.list.map((y) => ({ value: y.id, label: y.name }))]} />
          </View>
        ) : null}
        {isDiscipline(audience) ? (
          <View className="gap-3">
            <View className="gap-1.5">
              <Label>{t('app.em_academic_year')}</Label>
              <Picker value={yearId} onChange={setYearId} placeholder={t('app.em_all_years')} options={[{ value: '', label: t('app.em_all_years') }, ...years.list.map((y) => ({ value: y.id, label: y.name }))]} />
            </View>
            <View className="gap-1">
              <Label>{t('app.em_include_fields')}</Label>
              <View className="flex-row flex-wrap gap-x-4">
                {LOG_FIELDS.map((f) => (
                  <CheckRow key={f} checked={include[f]} onPress={() => setInclude((x) => ({ ...x, [f]: !x[f] }))} label={t(`app.em_log_${f}`)} />
                ))}
              </View>
            </View>
          </View>
        ) : null}
        <View className="gap-1.5">
          <Label nativeID="subject">{s('subject_label')}</Label>
          <Input aria-labelledby="subject" value={subject} onChangeText={setSubject} />
        </View>
        <View className="gap-1.5">
          <Label nativeID="body">{s('body_label')}</Label>
          <RichTextField value={body} onChange={setBody} placeholder={s('body_placeholder')} campusId={campusId} minHeight={200} insertRef={(fn) => (insertToken.current = fn)} />
          <Text className="text-muted-foreground text-xs">{s('substitution_chips_label')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {TOKENS[audience].map((k) => (
              <Pressable key={k} onPress={() => insertToken.current(`{{${k}}}`)} className="border-border rounded-full border px-3 py-1.5" accessibilityRole="button">
                <Text className="font-mono text-xs">{`{{${k}}}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {audience === 'students' && (ccStaff.data ?? []).some((x) => x.profile?.email) ? (
          <View className="gap-1.5">
            <Label>{s('cc_staff')}</Label>
            <MultiSelect
              options={(ccStaff.data ?? [])
                .filter((x) => !!x.profile?.email)
                .map((x) => ({ id: x.profile?.email as string, label: `${x.profile?.first_name ?? ''} ${x.profile?.last_name ?? ''}`.trim() || (x.profile?.email as string) }))}
              value={ccEmails}
              onChange={setCcEmails}
              placeholder={t('app.em_no_cc')}
              title={s('cc_staff')}
            />
          </View>
        ) : null}
        <View className="gap-1.5">
          <Label nativeID="test">{s('test_mode')}</Label>
          <Input aria-labelledby="test" value={testEmail} onChangeText={setTestEmail} placeholder={s('test_mode_placeholder')} keyboardType="email-address" autoCapitalize="none" />
          {testEmail.trim() ? <Text className="text-warning text-xs">{s('test_mode_desc', { email: testEmail.trim() })}</Text> : null}
        </View>
        <Button onPress={next}>
          <Text>{s('recipients_title')}</Text>
        </Button>
      </Screen>
    </>
  );
}
