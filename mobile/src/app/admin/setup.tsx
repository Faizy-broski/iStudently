import { router, Stack } from 'expo-router';
import { Building2, Calendar, CheckCircle2, ChevronRight, Clock, School, SkipForward, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { BrandGradient } from '@/components/app/brand-gradient';
import { DateField } from '@/components/app/date-field';
import { Panel } from '@/components/app/panel';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { adminAcademics, adminGrades, campuses } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'campus' | 'academic-year' | 'quarters' | 'complete';
type Quarter = { title: string; short_name: string; start_date: string; end_date: string };
const STEPS: { id: Step; icon: LucideIcon }[] = [
  { id: 'welcome', icon: School },
  { id: 'campus', icon: Building2 },
  { id: 'academic-year', icon: Calendar },
  { id: 'quarters', icon: Clock },
  { id: 'complete', icon: CheckCircle2 },
];

const ymd = (d: Date) => d.toISOString().split('T')[0];

/** The web's even split of the year into 4 quarters. */
function splitIntoQuarters(startDate: string, endDate: string): Quarter[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const quarterMs = Math.floor((end.getTime() - start.getTime()) / 4);
  return [1, 2, 3, 4].map((q) => ({
    title: `Quarter ${q}`,
    short_name: `Q${q}`,
    start_date: ymd(new Date(start.getTime() + (q - 1) * quarterMs)),
    end_date: ymd(q === 4 ? end : new Date(start.getTime() + q * quarterMs - 86400000)),
  }));
}

/** Web default: September to June, the year starting this September once it has begun. */
function suggestedYear() {
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 8 ? y : y - 1;
  return { name: `${startYear}-${startYear + 1}`, start: `${startYear}-09-01`, end: `${startYear + 1}-06-30` };
}

/** First-run setup: campus (optional) → academic year → FY, 2 semesters, 4 quarters (web: /admin/setup). */
export default function AdminSetup() {
  const status = useApi(['admin', 'setup-status'], () => campuses.setupStatus());
  if (status.isLoading) return <LoadingList rows={4} />;
  // Web: a school with campuses but no year starts at the academic year step.
  const first: Step = status.data?.hasCampuses && !status.data.hasAcademicYear ? 'academic-year' : 'welcome';
  return <Wizard first={first} />;
}

function Wizard({ first }: { first: Step }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.su_${key}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const suggested = suggestedYear();
  const [step, setStep] = useState<Step>(first);
  const [busy, setBusy] = useState(false);
  const [campus, setCampus] = useState({ name: '', address: '', email: '', phone: '' });
  const [createdCampusId, setCreatedCampusId] = useState<string | null>(null);
  const [yearName, setYearName] = useState(suggested.name);
  const [startDate, setStartDate] = useState(suggested.start);
  const [endDate, setEndDate] = useState(suggested.end);
  const [quarters, setQuarters] = useState<Quarter[]>(() => splitIntoQuarters(suggested.start, suggested.end));
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const setDates = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    if (s && e) setQuarters(splitIntoQuarters(s, e));
  };
  const updateQuarter = (i: number, patch: Partial<Quarter>) => setQuarters((list) => list.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function createCampus() {
    if (!campus.name.trim()) return toast.error(k('campus_name_required'));
    setBusy(true);
    const r = await campuses.create({ name: campus.name.trim(), address: campus.address || undefined, contact_email: campus.email || undefined, phone: campus.phone || undefined });
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || k('campus_failed'));
    setCreatedCampusId(r.data.id);
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'campuses');
    toast.success(k('campus_created'));
    setStep('academic-year');
  }

  async function createYear() {
    if (!yearName.trim() || !startDate || !endDate) return toast.error(t('common.fill_required_fields'));
    setBusy(true);
    const r = await adminAcademics.createAcademicYear({ name: yearName.trim(), start_date: startDate, end_date: endDate, is_current: true });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('year_failed'));
    setQuarters(splitIntoQuarters(startDate, endDate));
    toast.success(k('year_created'));
    setStep('quarters');
  }

  async function createQuarters() {
    setBusy(true);
    const campus_id = createdCampusId;
    const base = { does_grades: true, does_comments: true, campus_id };
    try {
      const fy = await adminGrades.createMarkingPeriod({ ...base, mp_type: 'FY', title: yearName || 'Full Year', short_name: 'FY', sort_order: 1, start_date: quarters[0].start_date, end_date: quarters[3].end_date });
      if (!fy.success || !fy.data) throw new Error(fy.error ?? '');
      const [s1, s2] = await Promise.all([
        adminGrades.createMarkingPeriod({ ...base, mp_type: 'SEM', parent_id: fy.data.id, title: 'Semester 1', short_name: 'S1', sort_order: 1, start_date: quarters[0].start_date, end_date: quarters[1].end_date }),
        adminGrades.createMarkingPeriod({ ...base, mp_type: 'SEM', parent_id: fy.data.id, title: 'Semester 2', short_name: 'S2', sort_order: 2, start_date: quarters[2].start_date, end_date: quarters[3].end_date }),
      ]);
      if (!s1.success || !s1.data || !s2.success || !s2.data) throw new Error(s1.error ?? s2.error ?? '');
      const parents = [s1.data.id, s1.data.id, s2.data.id, s2.data.id];
      const qs = await Promise.all(
        quarters.map((q, i) => adminGrades.createMarkingPeriod({ ...base, mp_type: 'QTR', parent_id: parents[i], title: q.title, short_name: q.short_name, sort_order: i + 1, start_date: q.start_date, end_date: q.end_date })),
      );
      if (qs.some((r) => !r.success)) throw new Error(qs.find((r) => !r.success)?.error ?? '');
      toast.success(k('quarters_created'));
    } catch {
      toast.error(k('quarters_failed'));
    } finally {
      setBusy(false);
      mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'setup-status' || key[1] === 'marking-periods'));
      setStep('complete');
    }
  }

  const spinner = busy ? <ActivityIndicator size="small" /> : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <Screen scroll edges={['bottom']}>
        {/* Progress */}
        <View className="flex-row items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <View key={s.id} className="flex-row items-center gap-1">
              <View className={cn('size-9 items-center justify-center rounded-full', i === stepIndex ? 'bg-brand' : i < stepIndex ? 'bg-success-soft' : 'bg-muted')}>
                <Icon as={s.icon} className={cn('size-4', i === stepIndex ? 'text-white' : i < stepIndex ? 'text-success' : 'text-muted-foreground')} />
              </View>
              {i < STEPS.length - 1 ? <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-3" /> : null}
            </View>
          ))}
        </View>
        <Text variant="muted" className="text-center text-xs">
          {k(`step_${step.replace('-', '_')}`)}
        </Text>

        {step === 'welcome' ? (
          <Panel className="gap-4 p-4">
            <View className="items-center gap-2">
              <BrandGradient variant="primary" style={{ width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon as={School} className="text-white size-8" />
              </BrandGradient>
              <Text className="text-center text-xl font-bold">{k('welcome_title')}</Text>
              <Text variant="muted" className="text-center">
                {k('welcome_desc')}
              </Text>
            </View>
            {[
              { icon: Building2, n: 1 },
              { icon: Calendar, n: 2 },
              { icon: Clock, n: 3 },
            ].map(({ icon, n }) => (
              <View key={n} className="bg-info-soft flex-row items-start gap-3 rounded-xl p-3">
                <Icon as={icon} className="text-brand dark:text-brand-secondary mt-0.5 size-5" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{k(`welcome_step${n}_title`)}</Text>
                  <Text variant="muted" className="text-sm">
                    {k(`welcome_step${n}_desc`)}
                  </Text>
                </View>
              </View>
            ))}
            <Button onPress={() => setStep('campus')}>
              <Text>{k('get_started')}</Text>
            </Button>
            <Button variant="ghost" onPress={() => router.push('/admin/import/school-data')}>
              <Text>{k('import_instead')}</Text>
            </Button>
          </Panel>
        ) : null}

        {step === 'campus' ? (
          <Panel className="gap-3 p-4">
            <Text className="text-lg font-semibold">{k('campus_title')}</Text>
            <Text variant="muted" className="text-sm">
              {k('campus_desc')}
            </Text>
            <View className="gap-1.5">
              <Label>{`${k('campus_name')} *`}</Label>
              <Input value={campus.name} onChangeText={(v) => setCampus((c) => ({ ...c, name: v }))} placeholder={k('campus_name_placeholder')} />
            </View>
            <View className="gap-1.5">
              <Label>{k('address')}</Label>
              <Textarea value={campus.address} onChangeText={(v) => setCampus((c) => ({ ...c, address: v }))} />
            </View>
            <View className="gap-1.5">
              <Label>{k('contact_email')}</Label>
              <Input value={campus.email} onChangeText={(v) => setCampus((c) => ({ ...c, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="campus@school.com" />
            </View>
            <View className="gap-1.5">
              <Label>{k('phone')}</Label>
              <Input value={campus.phone} onChangeText={(v) => setCampus((c) => ({ ...c, phone: v }))} keyboardType="phone-pad" />
            </View>
            <Button onPress={createCampus} disabled={busy || !campus.name.trim()}>
              {spinner}
              <Text>{k('create_campus')}</Text>
            </Button>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setStep('welcome')} disabled={busy}>
                <Text>{k('back')}</Text>
              </Button>
              <Button variant="outline" className="flex-1" onPress={() => setStep('academic-year')} disabled={busy}>
                <Icon as={SkipForward} className="size-4" />
                <Text>{k('no_branches')}</Text>
              </Button>
            </View>
          </Panel>
        ) : null}

        {step === 'academic-year' ? (
          <Panel className="gap-3 p-4">
            <Text className="text-lg font-semibold">{k('year_title')}</Text>
            <Text variant="muted" className="text-sm">
              {k('year_desc')}
            </Text>
            <View className="gap-1.5">
              <Label>{`${k('year_name')} *`}</Label>
              <Input value={yearName} onChangeText={setYearName} placeholder="2026-2027" />
            </View>
            <DateField label={`${k('start_date')} *`} value={startDate} onChange={(v) => setDates(v, endDate)} />
            <DateField label={`${k('end_date')} *`} value={endDate} onChange={(v) => setDates(startDate, v)} />
            <Button onPress={createYear} disabled={busy || !yearName.trim() || !startDate || !endDate}>
              {spinner}
              <Text>{k('create_year')}</Text>
            </Button>
            <Button variant="outline" onPress={() => setStep('campus')} disabled={busy}>
              <Text>{k('back')}</Text>
            </Button>
          </Panel>
        ) : null}

        {step === 'quarters' ? (
          <Panel className="gap-3 p-4">
            <Text className="text-lg font-semibold">{k('quarters_title')}</Text>
            <Text variant="muted" className="text-sm">
              {k('quarters_desc')}
            </Text>
            {quarters.map((q, i) => (
              <View key={i} className="border-border gap-2 rounded-xl border p-3">
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Label className="text-xs">{k('quarter_name')}</Label>
                    <Input value={q.title} onChangeText={(v) => updateQuarter(i, { title: v })} placeholder={`Quarter ${i + 1}`} />
                  </View>
                  <View className="w-24 gap-1">
                    <Label className="text-xs">{k('short_name')}</Label>
                    <Input value={q.short_name} onChangeText={(v) => updateQuarter(i, { short_name: v })} placeholder={`Q${i + 1}`} />
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <DateField className="flex-1" label={k('start_date')} value={q.start_date} onChange={(v) => updateQuarter(i, { start_date: v })} />
                  <DateField className="flex-1" label={k('end_date')} value={q.end_date} onChange={(v) => updateQuarter(i, { end_date: v })} />
                </View>
              </View>
            ))}
            <Button onPress={createQuarters} disabled={busy}>
              {spinner}
              <Text>{k('create_quarters')}</Text>
            </Button>
            <Button variant="outline" onPress={() => setStep('complete')} disabled={busy}>
              <Icon as={SkipForward} className="size-4" />
              <Text>{k('skip')}</Text>
            </Button>
          </Panel>
        ) : null}

        {step === 'complete' ? (
          <Panel className="gap-4 p-4">
            <View className="items-center gap-2">
              <View className="bg-success-soft size-16 items-center justify-center rounded-full">
                <Icon as={CheckCircle2} className="text-success size-10" />
              </View>
              <Text className="text-success text-xl font-bold">{k('complete_title')}</Text>
              <Text variant="muted" className="text-center">
                {k('complete_desc')}
              </Text>
            </View>
            <View className="bg-success-soft gap-1 rounded-xl p-4">
              <Text className="text-success font-medium">{k('whats_next')}</Text>
              {[1, 2, 3, 4].map((n) => (
                <Text key={n} className="text-success text-sm">{`• ${k(`next_${n}`)}`}</Text>
              ))}
            </View>
            <Button
              onPress={() => {
                mutate((key) => Array.isArray(key) && key[0] === 'admin');
                router.replace('/admin');
              }}>
              <Text>{k('go_dashboard')}</Text>
            </Button>
          </Panel>
        ) : null}
      </Screen>
    </>
  );
}
