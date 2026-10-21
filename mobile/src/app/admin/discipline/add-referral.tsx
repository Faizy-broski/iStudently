import type { DisciplineTargetType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Info, Minus, TrendingDown, TrendingUp, User, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ALL } from '@/features/admin/attendance';
import { DisciplineFieldInput, LibraryRelatedSwitch, pointsImpact, PointsBadge } from '@/features/admin/discipline';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminDiscipline, adminEmployees, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

type Picked = { id: string; name: string; sub: string; campusId?: string | null };

/** Add a discipline referral for a student, teacher or staff member (web: /admin/discipline/add-referral-{student,teacher,staff}). */
export default function AddReferral() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const params = useLocalSearchParams<{ kind?: DisciplineTargetType }>();
  const kind: DisciplineTargetType = params.kind === 'teacher' || params.kind === 'staff' ? params.kind : 'student';
  const isStaff = kind !== 'student';
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const schoolId = profile?.school_id ?? '';
  const reporterId = profile?.id ?? null;
  const { campusId, campus } = useCampus();

  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [grade, setGrade] = useState(ALL);
  const [sectionId, setSectionId] = useState(ALL);
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const [picked, setPicked] = useState<Picked | null>(null);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [incidentDate, setIncidentDate] = useState(todayYmd);
  const [values, setValues] = useState<Record<string, any>>({});
  const [library, setLibrary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fieldsRes = useApi(schoolId ? ['admin', 'discipline-fields', schoolId, kind] : null, () => adminDiscipline.getFields(schoolId, kind));
  const fields = fieldsRes.data ?? [];
  const grades = useApi(!isStaff ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const gradeList = (grades.data ?? []).filter((g) => g.is_active !== false);
  const gradeObj = gradeList.find((g) => g.name === grade);
  const sections = useApi(!isStaff && mode === 'multiple' && gradeObj ? ['admin', 'sections', campusId ?? 'school', gradeObj.id] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));

  const search = useApi(mode === 'single' && !picked && term.length >= 2 ? ['admin', 'referral-search', kind, campusId ?? 'school', term] : null, async () => {
    if (isStaff) {
      const res = await adminEmployees.list(kind === 'teacher' ? 'teacher' : 'staff', campusId, { page: 1, limit: 20, search: term });
      return { ...res, data: (res.data ?? []).map((s) => ({ id: s.id, name: shortName(s.profile) || s.employee_number, sub: s.employee_number ?? '', campusId: null })) };
    }
    const res = await adminStudents.list(campusId, { search: term, limit: 20 });
    return {
      ...res,
      data: (res.data ?? [])
        .filter((s) => grade === ALL || s.grade_level === grade)
        .map((s) => ({ id: s.id, name: shortName(s.profile) || s.student_number, sub: [s.student_number, s.grade_level].filter(Boolean).join(' · '), campusId: s.campus_id ?? null })),
    };
  });

  const roster = useApi(
    mode === 'multiple' && (isStaff || grade !== ALL) ? ['admin', 'referral-roster', kind, campusId ?? 'school', grade, sectionId] : null,
    async () => {
      if (isStaff) {
        const res = await adminEmployees.list(kind === 'teacher' ? 'teacher' : 'staff', campusId, { page: 1, limit: 500 });
        return { ...res, data: (res.data ?? []).map((s) => ({ id: s.id, label: shortName(s.profile) || s.employee_number, hint: s.employee_number })) };
      }
      const res = await adminStudents.list(campusId, { grade_level: [grade], section_id: sectionId !== ALL ? [sectionId] : undefined, limit: 200 });
      return {
        ...res,
        data: (res.data ?? []).map((s) => ({ id: s.id, label: shortName(s.profile) || s.student_number, hint: [s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' - ') || undefined })),
      };
    },
  );
  const rosterList = roster.data ?? [];

  const impact = pointsImpact(fields, values);
  const personType = d(`personTypeLabel.${kind}`);
  const canSubmit = mode === 'single' ? !!picked : multiIds.length > 0;

  function reset() {
    setPicked(null);
    setMultiIds([]);
    setIncidentDate(todayYmd());
    setValues({});
    setLibrary(false);
    setSuccess(true);
  }

  async function submit() {
    if (!schoolId) return toast.error(d('validation.schoolNotFound'));
    const base = { school_id: schoolId, reporter_id: reporterId, incident_date: incidentDate, field_values: values, library_related: !isStaff && library };
    let body;
    if (isStaff) {
      if (!campusId) return toast.error(d('validation.personNoCampus', { type: personType.charAt(0).toUpperCase() + personType.slice(1) }));
      if (mode === 'multiple' ? !multiIds.length : !picked) return toast.error(d('validation.selectPerson', { type: personType }));
      body = mode === 'multiple' ? { ...base, campus_id: campusId, target_type: kind, staff_ids: multiIds } : { ...base, campus_id: campusId, target_type: kind, staff_id: picked!.id };
    } else if (mode === 'single') {
      const p = picked;
      if (!p) return toast.error(d('validation.selectStudent'));
      const useCampusId = campusId || p.campusId || null;
      if (!useCampusId) return toast.error(d('validation.studentNoCampus'));
      body = { ...base, campus_id: useCampusId, student_id: p.id };
    } else {
      if (!multiIds.length) return toast.error(d('validation.selectStudent'));
      if (!campusId) return toast.error(d('validation.studentNoCampus'));
      body = { ...base, campus_id: campusId, student_ids: multiIds };
    }
    setSubmitting(true);
    setSuccess(false);
    try {
      const res = await adminDiscipline.createReferral(body);
      if (!res.success) return toast.error(res.error || d('errors.addReferral'));
      toast.success(mode === 'multiple' ? t('app.dc_added_many', { count: multiIds.length }) : d('toasts.referralAdded'));
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  const modeButton = (m: 'single' | 'multiple', label: string) => (
    <Pressable
      onPress={() => setMode(m)}
      className={cn('flex-1 items-center rounded-md border px-3 py-2', mode === m ? 'border-primary bg-primary' : 'border-input')}
      accessibilityRole="radio"
      accessibilityState={{ checked: mode === m }}>
      <Text className={cn('text-center text-sm font-medium', mode === m && 'text-primary-foreground')}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ title: d(`addReferralTitles.${kind}`) }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">
          {d('addSubtitle', { type: personType })}
          {campus ? ` (${d('campus')}: ${campus.name})` : ''}
        </Text>
        {success ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-3">
            <Icon as={CheckCircle2} className="size-4 text-success" />
            <Text className="flex-1 text-sm text-success">{d('successReferralSubmitted')}</Text>
          </View>
        ) : null}
        {!schoolId ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
            <Icon as={Info} className="size-4 text-warning" />
            <Text className="flex-1 text-sm text-warning">{d('selectSchoolBeforeReferral')}</Text>
          </View>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{d('referralDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-5">
            <View className="gap-1.5">
              <Label>{`${isStaff ? t(`app.dc_person_${kind}`) : d('student')} *`}</Label>
              <View className="flex-row gap-2">
                {modeButton('single', t(`app.dc_single_${kind}`))}
                {modeButton('multiple', t(`app.dc_multiple_${kind}`))}
              </View>
            </View>

            {mode === 'single' ? (
              picked ? (
                <View className="gap-1">
                  <View className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3">
                    <Icon as={User} className="text-muted-foreground size-5" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{picked.name}</Text>
                      <Text className="text-muted-foreground text-xs">{picked.sub}</Text>
                    </View>
                    <Pressable onPress={() => setPicked(null)} hitSlop={8} accessibilityLabel={d('change')}>
                      <Icon as={X} className="text-muted-foreground size-5" />
                    </Pressable>
                  </View>
                  {!isStaff && picked.campusId && campusId && picked.campusId !== campusId ? <Text className="text-sm text-warning">{d('warnings.studentDifferentCampus')}</Text> : null}
                  {!isStaff && !picked.campusId && !campusId ? <Text className="text-sm text-destructive">{d('warnings.noCampusSelected')}</Text> : null}
                </View>
              ) : (
                <View className="gap-2">
                  {!isStaff && gradeList.length ? (
                    <Picker value={grade} onChange={setGrade} options={[{ value: ALL, label: d('allGrades') }, ...gradeList.map((g) => ({ value: g.name, label: g.name }))]} />
                  ) : null}
                  <SearchBar value={query} onChangeText={setQuery} placeholder={isStaff ? d('staff_search_placeholder') : d('search_placeholder')} />
                  {(search.data ?? []).map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <Separator /> : null}
                      <Pressable
                        className="flex-row items-center gap-2 px-2 py-2.5"
                        onPress={() => {
                          setPicked(p);
                          setQuery('');
                        }}>
                        <Icon as={User} className="text-muted-foreground size-4" />
                        <Text className="flex-1">{p.name}</Text>
                        <Text className="text-muted-foreground text-xs">{p.sub}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )
            ) : (
              <View className="gap-2">
                {!isStaff ? (
                  <View className="flex-row gap-2">
                    <Picker
                      className="flex-1"
                      value={grade}
                      onChange={(g) => {
                        setGrade(g);
                        setSectionId(ALL);
                        setMultiIds([]);
                      }}
                      placeholder={d('gradeLevel')}
                      options={[{ value: ALL, label: d('allGrades') }, ...gradeList.map((g) => ({ value: g.name, label: g.name }))]}
                    />
                    <Picker
                      className="flex-1"
                      value={sectionId}
                      onChange={(s) => {
                        setSectionId(s);
                        setMultiIds([]);
                      }}
                      placeholder={d('section')}
                      options={[{ value: ALL, label: d('allSections') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                    />
                  </View>
                ) : null}
                {!isStaff && grade === ALL ? (
                  <Text variant="muted">{t('app.dc_choose_grade')}</Text>
                ) : roster.isLoading ? (
                  <Text variant="muted">{d('loadingFields')}</Text>
                ) : (
                  <>
                    <MultiSelect options={rosterList} value={multiIds} onChange={setMultiIds} placeholder={t(`app.dc_select_many_${kind}`)} emptyMessage={t(`app.dc_none_${kind}`)} />
                    {rosterList.length ? (
                      <Button size="sm" variant="outline" className="self-start" onPress={() => setMultiIds(rosterList.map((o) => o.id))}>
                        <Text>{t('app.dc_select_all_count', { count: rosterList.length })}</Text>
                      </Button>
                    ) : null}
                  </>
                )}
              </View>
            )}

            <DateField label={`${d('incidentDate')} *`} value={incidentDate} onChange={(v) => v && setIncidentDate(v)} />
            {!isStaff ? <LibraryRelatedSwitch value={library} onChange={setLibrary} /> : null}

            {fieldsRes.isLoading ? (
              <Text variant="muted">{d('loadingFields')}</Text>
            ) : fields.length === 0 ? (
              <Text variant="muted">
                {`${d('noCustomFields')} `}
                <Text className="text-primary underline" onPress={() => router.push('/admin/discipline/referral-form')}>
                  {d('referralForm')}
                </Text>
                {` ${d('toAddFields')}`}
              </Text>
            ) : (
              fields.map((f, idx) => (
                <View key={f.id} className="gap-2">
                  {idx > 0 ? <Separator className="mb-3" /> : null}
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-base font-semibold text-brand dark:text-brand-secondary ">{f.name}</Text>
                    {f.penalty_points !== null && f.penalty_points !== undefined ? <PointsBadge pts={f.penalty_points} /> : null}
                  </View>
                  <DisciplineFieldInput field={f} value={values[f.id]} onChange={(v) => setValues((x) => ({ ...x, [f.id]: v }))} />
                </View>
              ))
            )}
          </CardContent>
        </Card>

        {fields.some((f) => f.penalty_points) ? (
          <View className={cn('flex-row items-center justify-between rounded-lg border p-3', impact > 0 ? 'border-success/30 bg-success-soft' : impact < 0 ? 'border-destructive/30 bg-destructive-soft' : 'border-border bg-muted/30')}>
            <Text className="text-muted-foreground text-sm font-medium">{t('app.dc_points_impact')}</Text>
            <View className="flex-row items-center gap-1.5">
              <Icon as={impact > 0 ? TrendingUp : impact < 0 ? TrendingDown : Minus} className={cn('size-4', impact > 0 ? 'text-success' : impact < 0 ? 'text-destructive' : 'text-muted-foreground')} />
              <Text className={cn('text-sm font-semibold', impact > 0 ? 'text-success' : impact < 0 ? 'text-destructive' : 'text-muted-foreground')}>{`${impact > 0 ? '+' : ''}${impact} pts`}</Text>
            </View>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <Button className="flex-1" onPress={submit} disabled={submitting || !canSubmit}>
            <Text>{submitting ? d('submitting') : mode === 'multiple' ? t(`app.dc_add_for_many_${kind}`, { count: multiIds.length }) : kind === 'student' ? d('addReferralForSelectedStudent') : t(`app.dc_add_for_selected_${kind}`)}</Text>
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{d('cancel')}</Text>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
