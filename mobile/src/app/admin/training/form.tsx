import type { TrainingAudience, TrainingCertificateSettings, TrainingDeliveryMode, TrainingSkillLevel } from '@studently/api-client';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ExternalLink, FileText, Upload, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { openAdminPage } from '@/features/admin/module-list';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminTraining, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, pickImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Robotics & AI', 'Web Development', 'Data Science & Analytics', 'Mobile App Development', 'Cyber Security', 'Soft Skills & Leadership', 'Language & Communication', 'Other'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TABS = ['basic', 'schedule', 'access', 'media', 'certificate'] as const;
const NEW_CATEGORY = '__new__';

/** ISO → { date, time } in local time; and back. */
const split = (iso?: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
const join = (date: string, time: string) => (date ? new Date(`${date}T${time || '00:00'}:00`).toISOString() : '');

type Form = {
  title: string;
  description: string;
  category: string;
  skill_level: TrainingSkillLevel;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  weekly_days: string[];
  daily_time_range: string;
  total_duration_hours: string;
  delivery_mode: TrainingDeliveryMode;
  location_venue_link: string;
  instructor_id: string;
  instructor_name: string;
  total_seats: string;
  target_audience: TrainingAudience;
  course_fee: string;
  deadline_date: string;
  deadline_time: string;
  status: 'open' | 'closed';
  cover_image_url: string;
  syllabus_pdf_url: string;
  enable_auto_issuance: boolean;
  certificate_template_id: string | null;
  require_attendance_rate: boolean;
  min_attendance_rate: string;
  require_passing_grade: boolean;
  min_passing_grade: string;
  require_payment_cleared: boolean;
  authorized_signatory: string;
  digital_signature_url: string;
  enable_verification_qr: boolean;
  distribute_dashboard: boolean;
  distribute_email: boolean;
};

const DEFAULTS: Form = {
  title: '',
  description: '',
  category: 'Robotics & AI',
  skill_level: 'beginner',
  start_date: '',
  start_time: '09:00',
  end_date: '',
  end_time: '17:00',
  weekly_days: ['Sun', 'Tue', 'Thu'],
  daily_time_range: '04:00 PM – 06:00 PM',
  total_duration_hours: '20',
  delivery_mode: 'in_person',
  location_venue_link: 'Lab 2 - Main Campus',
  instructor_id: '',
  instructor_name: '',
  total_seats: '15',
  target_audience: 'both',
  course_fee: '0',
  deadline_date: '',
  deadline_time: '23:59',
  status: 'open',
  cover_image_url: '',
  syllabus_pdf_url: '',
  enable_auto_issuance: true,
  certificate_template_id: null,
  require_attendance_rate: true,
  min_attendance_rate: '80',
  require_passing_grade: true,
  min_passing_grade: '75',
  require_payment_cleared: true,
  authorized_signatory: 'Dr. Ali Ahmad - Center Director',
  digital_signature_url: '',
  enable_verification_qr: true,
  distribute_dashboard: true,
  distribute_email: true,
};

/** Create or edit a training session with schedule, access, media and certificate rules (web: TrainingSessionFormModal). */
export default function TrainingForm() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`adminTrainingSessions.form.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ id?: string }>();
  const sessionId = params.id || null;
  const { campusId } = useCampus();
  const existing = useApi(sessionId ? ['admin', 'training-session', sessionId, campusId ?? 'school'] : null, ([, , id]) => adminTraining.session(String(id), campusId));
  const staff = useApi(['admin', 'training-staff', campusId ?? 'school'], () => adminEmployees.list('employees', campusId, { limit: 200 }));
  const templates = useApi(['admin', 'cert-templates', 'training'], () => adminTraining.certificateTemplates());
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [tab, setTab] = useState<(typeof TABS)[number]>('basic');
  const [categories, setCategories] = useState(CATEGORIES);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [timeMode, setTimeMode] = useState<'uniform' | 'per_day'>('uniform');
  const [perDay, setPerDay] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<'cover' | 'syllabus' | 'signature' | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  const loaded = existing.data ?? null;
  const loadedId = loaded?.id ?? null;
  useEffect(() => {
    if (!loaded) return;
    const s = loaded;
    const c = s.certificate_settings;
    if (s.category && !CATEGORIES.includes(s.category)) setCategories((p) => [...new Set([...p, s.category!])]);
    if (s.daily_times && Object.keys(s.daily_times).length) {
      setTimeMode('per_day');
      setPerDay(s.daily_times);
    } else if (s.daily_time_range?.includes(':') && s.daily_time_range.includes('|')) setTimeMode('per_day');
    const st = split(s.start_date);
    const en = split(s.end_date);
    const dl = split(s.registration_deadline);
    setForm({
      title: s.title || '',
      description: s.description || '',
      category: s.category || 'Robotics & AI',
      skill_level: s.skill_level || 'beginner',
      start_date: st.date,
      start_time: st.time || '09:00',
      end_date: en.date,
      end_time: en.time || '17:00',
      weekly_days: s.weekly_days || ['Sun', 'Tue', 'Thu'],
      daily_time_range: s.daily_time_range || '',
      total_duration_hours: String(s.total_duration_hours || 20),
      delivery_mode: s.delivery_mode || 'in_person',
      location_venue_link: s.location_venue_link || '',
      instructor_id: s.instructor_id || '',
      instructor_name: s.instructor_name || '',
      total_seats: String(s.total_seats || 15),
      target_audience: s.target_audience || 'both',
      course_fee: String(s.course_fee || 0),
      deadline_date: dl.date,
      deadline_time: dl.time || '23:59',
      status: s.status === 'closed' ? 'closed' : 'open',
      cover_image_url: s.cover_image_url || '',
      syllabus_pdf_url: s.syllabus_pdf_url || '',
      enable_auto_issuance: c?.enable_auto_issuance ?? true,
      certificate_template_id: c?.certificate_template_id ?? null,
      require_attendance_rate: (c?.min_attendance_rate ?? 0) > 0,
      min_attendance_rate: String(c?.min_attendance_rate || 80),
      require_passing_grade: (c?.min_passing_grade ?? 0) > 0,
      min_passing_grade: String(c?.min_passing_grade || 75),
      require_payment_cleared: c?.require_payment_cleared ?? true,
      authorized_signatory: c?.authorized_signatory || '',
      digital_signature_url: c?.digital_signature_url || '',
      enable_verification_qr: c?.enable_verification_qr ?? true,
      distribute_dashboard: c?.distribution_methods?.dashboard ?? true,
      distribute_email: c?.distribution_methods?.email ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));
  const staffList = staff.data ?? [];

  async function uploadCover(kind: 'cover' | 'signature') {
    const picked = await pickImage({ maxDimension: kind === 'cover' ? 1600 : 800 });
    if (!picked.ok) return;
    setUploading(kind);
    try {
      const r = await media.uploadImage(picked.file);
      if (!r.success || !r.data) return toast.error(r.error || f(kind === 'cover' ? 'coverUploadFailed' : 'signatureUploadFailed'));
      set(kind === 'cover' ? { cover_image_url: r.data.url } : { digital_signature_url: r.data.url });
      toast.success(f(kind === 'cover' ? 'coverUploaded' : 'signatureUploaded'));
    } finally {
      setUploading(null);
    }
  }

  async function uploadSyllabus() {
    const [file] = await pickDocuments({ multiple: false });
    if (!file) return;
    setUploading('syllabus');
    try {
      const r = await media.uploadAttachment(file, campusId);
      if (!r.success || !r.data) return toast.error(r.error || f('syllabusUploadFailed'));
      set({ syllabus_pdf_url: r.data.url });
      toast.success(f('syllabusUploaded'));
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    const e: typeof errors = {};
    if (form.title.trim().length < 2) e.title = t('app.trn_err_title');
    if (!form.start_date) e.start_date = t('app.trn_err_start');
    if (!form.end_date) e.end_date = t('app.trn_err_end');
    else if (form.start_date && join(form.start_date, form.start_time) >= join(form.end_date, form.end_time)) e.end_date = t('app.trn_err_order');
    if (!(parseInt(form.total_seats, 10) >= 1)) e.total_seats = t('app.trn_err_seats');
    setErrors(e);
    if (Object.keys(e).length) {
      setTab(e.title ? 'basic' : e.total_seats ? 'access' : 'schedule');
      return;
    }
    setSaving(true);
    try {
      let instructorName = form.instructor_name;
      const st = staffList.find((x) => x.id === form.instructor_id);
      if (st) instructorName = shortName(st.profile);
      let dailyTimeRange = form.daily_time_range;
      let dailyTimes: Record<string, string> | undefined;
      if (timeMode === 'per_day' && form.weekly_days.length) {
        const active: Record<string, string> = {};
        const parts: string[] = [];
        for (const d of form.weekly_days) {
          if (perDay[d]?.trim()) {
            active[d] = perDay[d].trim();
            parts.push(`${d}: ${perDay[d].trim()}`);
          }
        }
        if (Object.keys(active).length) {
          dailyTimes = active;
          dailyTimeRange = parts.join(' | ');
        }
      }
      const certificate_settings: TrainingCertificateSettings = {
        enable_auto_issuance: form.enable_auto_issuance,
        certificate_template_id: form.certificate_template_id,
        min_attendance_rate: form.require_attendance_rate ? Number(form.min_attendance_rate) || 0 : 0,
        min_passing_grade: form.require_passing_grade ? Number(form.min_passing_grade) || 0 : 0,
        require_payment_cleared: form.require_payment_cleared,
        authorized_signatory: form.authorized_signatory || '',
        digital_signature_url: form.digital_signature_url || null,
        enable_verification_qr: form.enable_verification_qr,
        distribution_methods: { dashboard: form.distribute_dashboard, email: form.distribute_email },
      };
      const body = {
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        skill_level: form.skill_level,
        start_date: join(form.start_date, form.start_time),
        end_date: join(form.end_date, form.end_time),
        weekly_days: form.weekly_days,
        daily_time_range: dailyTimeRange || undefined,
        daily_times: dailyTimes,
        total_duration_hours: Number(form.total_duration_hours) || undefined,
        delivery_mode: form.delivery_mode,
        location_venue_link: form.location_venue_link || undefined,
        instructor_id: form.instructor_id || undefined,
        instructor_name: instructorName || undefined,
        total_seats: parseInt(form.total_seats, 10),
        course_fee: Number(form.course_fee) || 0,
        registration_deadline: form.deadline_date ? join(form.deadline_date, form.deadline_time) : undefined,
        status: form.status,
        target_audience: form.target_audience,
        cover_image_url: form.cover_image_url || undefined,
        syllabus_pdf_url: form.syllabus_pdf_url || undefined,
        certificate_settings,
      };
      const r = sessionId ? await adminTraining.update(sessionId, body, campusId) : await adminTraining.create(body, campusId);
      if (!r.success) return toast.error(r.error || f(sessionId ? 'updateFailed' : 'createFailed'));
      toast.success(f(sessionId ? 'sessionUpdated' : 'sessionCreated'));
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && String(k[1]).startsWith('training'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (sessionId && existing.isLoading) return <LoadingList />;
  const err = (k: keyof Form) => (errors[k] ? <Text className="text-destructive text-xs">{errors[k]}</Text> : null);
  const lbl = (text: string, required = false) => (
    <Label>
      {text}
      {required ? <Text className="text-destructive"> *</Text> : null}
    </Label>
  );
  const num = (k: keyof Form, placeholder?: string) => <Input value={String(form[k])} keyboardType="decimal-pad" placeholder={placeholder} onChangeText={(v) => set({ [k]: v.replace(/[^0-9.]/g, '') } as Partial<Form>)} />;
  const toggleRow = (k: keyof Form, label: string, hint?: string) => (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
      </View>
      <Switch checked={!!form[k]} onCheckedChange={(v) => set({ [k]: v } as Partial<Form>)} />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: sessionId ? f('editTitle') : f('createTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{f('dialogDesc')}</Text>
        <FilterChips value={tab} onChange={setTab} options={TABS.map((x, i) => ({ value: x, label: f(`tab${i + 1}`) }))} />

        <Card>
          <CardContent className="gap-4 pt-4">
            {tab === 'basic' ? (
              <>
                <View className="gap-1.5">
                  {lbl(f('sessionTitle'), true)}
                  <Input value={form.title} onChangeText={(v) => set({ title: v })} placeholder={f('sessionTitlePlaceholder')} />
                  {err('title')}
                </View>
                <View className="gap-1.5">
                  {lbl(f('descriptionLabel'))}
                  <Textarea value={form.description} onChangeText={(v) => set({ description: v })} placeholder={f('descriptionPlaceholder')} className="min-h-28" />
                </View>
                <View className="gap-1.5">
                  {lbl(f('courseCategory'))}
                  {newCategory !== null ? (
                    <View className="flex-row gap-2">
                      <Input className="flex-1" value={newCategory} onChangeText={setNewCategory} placeholder={f('customCategoryPlaceholder')} />
                      <Button
                        size="sm"
                        onPress={() => {
                          const v = newCategory.trim();
                          if (!v) return toast.error(f('categoryEmpty'));
                          setCategories((p) => (p.includes(v) ? p : [...p, v]));
                          set({ category: v });
                          setNewCategory(null);
                          toast.success(f('categoryAdded', { name: v }));
                        }}>
                        <Text>{f('add')}</Text>
                      </Button>
                      <Button size="sm" variant="outline" onPress={() => setNewCategory(null)}>
                        <Text>{f('cancel')}</Text>
                      </Button>
                    </View>
                  ) : (
                    <Picker value={form.category} onChange={(v) => (v === NEW_CATEGORY ? setNewCategory('') : set({ category: v }))} placeholder={f('selectCategory')} options={[...categories.map((c) => ({ value: c, label: c })), { value: NEW_CATEGORY, label: f('addCustomCategoryOption') }]} />
                  )}
                </View>
                <View className="gap-1.5">
                  {lbl(f('skillLevel'))}
                  <Picker value={form.skill_level} onChange={(v) => set({ skill_level: v as TrainingSkillLevel })} options={(['beginner', 'intermediate', 'advanced'] as const).map((x) => ({ value: x, label: f(x) }))} />
                </View>
              </>
            ) : null}

            {tab === 'schedule' ? (
              <>
                <View className="gap-1.5">
                  {lbl(f('startDateTime'), true)}
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={form.start_date} onChange={(v) => set({ start_date: v })} />
                    <TimeField className="w-36" value={form.start_time} onChange={(v) => set({ start_time: v })} />
                  </View>
                  {err('start_date')}
                </View>
                <View className="gap-1.5">
                  {lbl(f('endDateTime'), true)}
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={form.end_date} onChange={(v) => set({ end_date: v })} />
                    <TimeField className="w-36" value={form.end_time} onChange={(v) => set({ end_time: v })} />
                  </View>
                  {err('end_date')}
                </View>
                <View className="gap-1.5">
                  {lbl(f('weeklyDays'))}
                  <View className="flex-row flex-wrap gap-2">
                    {DAYS.map((d) => {
                      const on = form.weekly_days.includes(d);
                      return (
                        <Pressable key={d} onPress={() => set({ weekly_days: on ? form.weekly_days.filter((x) => x !== d) : [...form.weekly_days, d] })} className={cn('rounded-md border px-3 py-1.5', on ? 'border-primary bg-primary' : 'border-border')}>
                          <Text className={cn('text-sm', on ? 'text-primary-foreground' : 'text-foreground')}>{f(`day${d}`)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View className="gap-1.5">
                  {lbl(f('dailySessionTimes'))}
                  <Text className="text-muted-foreground text-xs">{f('dailyTimesHint')}</Text>
                  <FilterChips
                    value={timeMode}
                    onChange={setTimeMode}
                    options={[
                      { value: 'uniform', label: f('uniformTime') },
                      { value: 'per_day', label: f('differentTimePerDay') },
                    ]}
                  />
                  {timeMode === 'uniform' ? (
                    <View className="gap-3">
                      <View className="gap-1">
                        <Label className="text-xs">{f('sessionTimeRange')}</Label>
                        <Input value={form.daily_time_range} onChangeText={(v) => set({ daily_time_range: v })} placeholder={f('sessionTimeRangePlaceholder')} />
                      </View>
                      <View className="gap-1">
                        <Label className="text-xs">{f('totalDurationHours')}</Label>
                        {num('total_duration_hours', f('totalDurationPlaceholder'))}
                      </View>
                    </View>
                  ) : form.weekly_days.length ? (
                    <View className="gap-2">
                      <Text className="text-xs font-medium">{f('perDayBreakdown', { count: form.weekly_days.length })}</Text>
                      {DAYS.filter((d) => form.weekly_days.includes(d)).map((d) => (
                        <View key={d} className="flex-row items-center gap-2">
                          <Text className="w-12 text-sm">{f(`day${d}`)}</Text>
                          <Input className="flex-1" value={perDay[d] ?? ''} onChangeText={(v) => setPerDay((p) => ({ ...p, [d]: v }))} placeholder={f('perDayTimePlaceholder')} />
                        </View>
                      ))}
                      <View className="gap-1">
                        <Label className="text-xs">{f('totalHours')}</Label>
                        {num('total_duration_hours', f('totalDurationPlaceholder'))}
                      </View>
                    </View>
                  ) : (
                    <Text className="text-xs text-amber-600">{f('selectDaysHint')}</Text>
                  )}
                </View>
                <View className="gap-1.5">
                  {lbl(f('deliveryMode'))}
                  <Picker value={form.delivery_mode} onChange={(v) => set({ delivery_mode: v as TrainingDeliveryMode })} options={[{ value: 'in_person', label: f('inPerson') }, { value: 'online', label: f('online') }, { value: 'hybrid', label: f('hybrid') }]} />
                </View>
                <View className="gap-1.5">
                  {lbl(form.delivery_mode === 'in_person' ? f('locationVenueAddress') : form.delivery_mode === 'online' ? f('onlineVideoLink') : f('locationAndOnlineLink'))}
                  <Input value={form.location_venue_link} onChangeText={(v) => set({ location_venue_link: v })} placeholder={form.delivery_mode === 'in_person' ? f('locationPlaceholderInPerson') : f('locationPlaceholderOnline')} autoCapitalize="none" />
                </View>
              </>
            ) : null}

            {tab === 'access' ? (
              <>
                <View className="gap-1.5">
                  {lbl(f('instructorTrainer'))}
                  <Picker
                    value={form.instructor_id}
                    onChange={(v) => {
                      const st = staffList.find((x) => x.id === v);
                      set({ instructor_id: v, instructor_name: st ? shortName(st.profile) : form.instructor_name });
                    }}
                    placeholder={f('selectInstructor')}
                    options={staffList.map((s) => ({ value: s.id, label: `${shortName(s.profile)} (${s.title || f('staffFallback')})` }))}
                  />
                </View>
                <View className="gap-1.5">
                  {lbl(f('customInstructorName'))}
                  <Input value={form.instructor_name} onChangeText={(v) => set({ instructor_name: v })} placeholder={f('customInstructorPlaceholder')} />
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1.5">
                    {lbl(f('totalSeats'), true)}
                    {num('total_seats', f('totalSeatsPlaceholder'))}
                    {err('total_seats')}
                  </View>
                  <View className="flex-1 gap-1.5">
                    {lbl(f('courseFee'))}
                    {num('course_fee', f('courseFeePlaceholder'))}
                  </View>
                </View>
                <View className="gap-1.5">
                  {lbl(f('initialStatus'))}
                  <Picker value={form.status} onChange={(v) => set({ status: v as 'open' | 'closed' })} options={[{ value: 'open', label: f('statusOpenOption') }, { value: 'closed', label: f('statusClosedOption') }]} />
                </View>
                <View className="gap-2">
                  {lbl(f('targetAudience'))}
                  {(['both', 'internal', 'external'] as const).map((a) => {
                    const key = a === 'both' ? 'audienceBoth' : a === 'internal' ? 'audienceInternal' : 'audienceExternal';
                    return (
                      <Pressable key={a} onPress={() => set({ target_audience: a })} className={cn('rounded-lg border p-3', form.target_audience === a ? 'border-primary bg-primary/10' : 'border-border')}>
                        <Text className="text-sm font-semibold">{f(key)}</Text>
                        <Text className="text-muted-foreground text-xs">{f(`${key}Desc`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="gap-1.5">
                  {lbl(f('registrationDeadline'))}
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={form.deadline_date} onChange={(v) => set({ deadline_date: v })} clearable />
                    {form.deadline_date ? <TimeField className="w-36" value={form.deadline_time} onChange={(v) => set({ deadline_time: v })} /> : null}
                  </View>
                </View>
              </>
            ) : null}

            {tab === 'media' ? (
              <>
                <View className="gap-2">
                  <Text className="text-sm font-semibold">{f('coverImageBanner')}</Text>
                  <Text className="text-muted-foreground text-xs">{f('coverImageHint')}</Text>
                  {form.cover_image_url ? (
                    <View className="gap-2">
                      <Image source={{ uri: form.cover_image_url }} style={{ width: '100%', height: 140, borderRadius: 8 }} contentFit="cover" />
                      <Button size="sm" variant="outline" className="self-start" onPress={() => set({ cover_image_url: '' })}>
                        <Icon as={X} className="text-foreground size-4" />
                        <Text>{f('removeCoverImage')}</Text>
                      </Button>
                    </View>
                  ) : (
                    <Button size="sm" variant="outline" className="self-start" disabled={uploading === 'cover'} onPress={() => uploadCover('cover')}>
                      <Icon as={Upload} className="text-foreground size-4" />
                      <Text>{uploading === 'cover' ? t('common.loading') : f('uploadCoverImage')}</Text>
                    </Button>
                  )}
                </View>
                <View className="gap-2">
                  <Text className="text-sm font-semibold">{f('syllabusAttachment')}</Text>
                  <Text className="text-muted-foreground text-xs">{f('syllabusHint')}</Text>
                  {form.syllabus_pdf_url ? (
                    <View className="flex-row items-center gap-2">
                      <Icon as={FileText} className="text-primary size-4" />
                      <Text className="flex-1 text-sm">{f('syllabusFilename')}</Text>
                      <Text className="text-xs text-green-600">{f('uploaded')}</Text>
                      <Button size="sm" variant="ghost" onPress={() => set({ syllabus_pdf_url: '' })}>
                        <Text>{f('removePdf')}</Text>
                      </Button>
                    </View>
                  ) : (
                    <Button size="sm" variant="outline" className="self-start" disabled={uploading === 'syllabus'} onPress={uploadSyllabus}>
                      <Icon as={Upload} className="text-foreground size-4" />
                      <Text>{uploading === 'syllabus' ? t('common.loading') : f('uploadSyllabusPdf')}</Text>
                    </Button>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'certificate' ? (
              <>
                {toggleRow('enable_auto_issuance', f('enableAutoIssuance'), f('autoIssuanceHint'))}
                {form.enable_auto_issuance ? (
                  <>
                    <View className="gap-1.5">
                      {lbl(f('certTemplateDesign'))}
                      {templates.isLoading ? (
                        <Text className="text-muted-foreground text-sm">{f('loadingCertTemplates')}</Text>
                      ) : !(templates.data ?? []).length ? (
                        <Text className="text-muted-foreground text-sm">{f('noCertTemplates')}</Text>
                      ) : (
                        <Picker value={form.certificate_template_id ?? ''} onChange={(v) => set({ certificate_template_id: v || null })} placeholder={f('selectCertTemplate')} options={(templates.data ?? []).map((x) => ({ value: x.id, label: x.name }))} />
                      )}
                      <Button size="sm" variant="ghost" className="self-start" onPress={() => openAdminPage({ href: '/admin/certificate-templates', title: 'certificate_templates' })}>
                        <Icon as={ExternalLink} className="text-foreground size-4" />
                        <Text>{f('manageCertTemplates')}</Text>
                      </Button>
                    </View>
                    <Text className="text-sm font-semibold">{f('qualificationCriteria')}</Text>
                    <View className="gap-2">
                      <CheckRow checked={form.require_attendance_rate} onPress={() => set({ require_attendance_rate: !form.require_attendance_rate })} label={f('minAttendanceRequired')} />
                      {form.require_attendance_rate ? <View className="ms-7 w-28">{num('min_attendance_rate', '80')}</View> : null}
                      <CheckRow checked={form.require_passing_grade} onPress={() => set({ require_passing_grade: !form.require_passing_grade })} label={f('minGradeRequired')} />
                      {form.require_passing_grade ? <View className="ms-7 w-28">{num('min_passing_grade', '75')}</View> : null}
                      <CheckRow checked={form.require_payment_cleared} onPress={() => set({ require_payment_cleared: !form.require_payment_cleared })} label={f('paymentClearedRequired')} />
                    </View>
                    <View className="gap-1.5">
                      {lbl(f('authorizedSignatory'))}
                      <Input value={form.authorized_signatory} onChangeText={(v) => set({ authorized_signatory: v })} placeholder={f('authorizedSignatoryPlaceholder')} />
                    </View>
                    <View className="gap-2">
                      {lbl(f('digitalSignature'))}
                      {form.digital_signature_url ? (
                        <View className="flex-row items-center gap-3">
                          <Image source={{ uri: form.digital_signature_url }} style={{ width: 120, height: 60 }} contentFit="contain" />
                          <Button size="sm" variant="ghost" onPress={() => set({ digital_signature_url: '' })}>
                            <Text>{f('remove')}</Text>
                          </Button>
                        </View>
                      ) : (
                        <Button size="sm" variant="outline" className="self-start" disabled={uploading === 'signature'} onPress={() => uploadCover('signature')}>
                          <Icon as={Upload} className="text-foreground size-4" />
                          <Text>{uploading === 'signature' ? t('common.loading') : f('uploadTransparentSeal')}</Text>
                        </Button>
                      )}
                    </View>
                    {toggleRow('enable_verification_qr', f('verificationQr'), f('verificationQrHint'))}
                    <Text className="text-sm font-semibold">{f('distributionMethods')}</Text>
                    <CheckRow checked={form.distribute_dashboard} onPress={() => set({ distribute_dashboard: !form.distribute_dashboard })} label={f('distDashboard')} />
                    <CheckRow checked={form.distribute_email} onPress={() => set({ distribute_email: !form.distribute_email })} label={f('distEmail')} />
                  </>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{f('cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Text>{sessionId ? f('updateSession') : f('savePublish')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
