import { zodResolver } from '@hookform/resolvers/zod';
import type { Student, StudentInput } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { FilterChips } from '@/components/app/filter-chips';
import { FormError, TextField } from '@/components/app/form';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SelectField } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CustomFieldInputs, initialCustomValues, mergeCustomValues, missingRequired } from '@/features/admin/custom-field-inputs';
import { ENTITY_TABS } from '@/features/admin/field-tabs';
import { useRequiredFields } from '@/features/admin/required-fields';
import { applyPermissionProfile, PermissionsSelect } from '@/features/admin/people-extras';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCustomFields, adminStudents, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const NONE = '__none__';
const V = 'school.students.validation.';
const optionalDate = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'app.v_date');

const baseSchema = z.object({
  first_name: z.string().trim(),
  father_name: z.string().trim(),
  grandfather_name: z.string().trim(),
  last_name: z.string().trim(),
  gender: z.enum(['male', 'female', '']),
  date_of_birth: optionalDate,
  national_id: z.string().trim().max(40, 'app.v_too_long'),
  email: z.union([z.literal(''), z.string().trim().email(`${V}email_invalid`)]),
  phone: z.string().trim().max(30, 'app.v_too_long'),
  address: z.string().trim().max(300, 'app.v_too_long'),
  student_number: z.string().trim().min(1, 'app.v_required').max(40, 'app.v_too_long'),
  grade_level_id: z.string(),
  section_id: z.string(),
  admission_date: optionalDate,
  blood_group: z.string(),
  allergies: z.string().trim(),
  medical_notes: z.string().trim(),
  username: z.string().trim().max(60, 'app.v_too_long'),
  password: z.union([z.literal(''), z.string().min(8, 'app.v_min8').max(128, 'app.v_too_long')]),
  photo: z.string().nullable(),
});

/** Form field -> web field id (Default field order settings) and its "required" message. */
const REQUIRED_RULES: [keyof z.infer<typeof baseSchema>, string, string][] = [
  ['first_name', 'firstName', `${V}first_name_min`],
  ['father_name', 'fatherName', `${V}father_name_min`],
  ['grandfather_name', 'grandfatherName', `${V}field_required`],
  ['last_name', 'lastName', `${V}last_name_min`],
  ['date_of_birth', 'dateOfBirth', `${V}dob_required`],
  ['gender', 'gender', `${V}gender_required`],
  ['address', 'address', `${V}field_required`],
  ['email', 'email', `${V}email_required`],
  ['phone', 'phoneNumber', `${V}field_required`],
  ['national_id', 'nationalId', `${V}field_required`],
  ['grade_level_id', 'grade_level_id', `${V}grade_required`],
  ['section_id', 'section_id', `${V}section_required`],
  ['admission_date', 'admissionDate', `${V}admission_date_required`],
  ['blood_group', 'bloodGroup', `${V}blood_group_required`],
  ['medical_notes', 'medicalNotes', `${V}field_required`],
];
const NAME_FIELDS = new Set(['first_name', 'father_name', 'last_name']);

/** Same rules as the web form: required per school settings; names at least 2 characters. */
function buildSchema(isRequired: (id: string) => boolean, gradeHasSections: boolean) {
  return baseSchema.superRefine((f, ctx) => {
    for (const [key, webId, message] of REQUIRED_RULES) {
      if (key === 'section_id' && !gradeHasSections) continue;
      const value = String(f[key] ?? '').trim();
      if (isRequired(webId) && !value) ctx.addIssue({ code: 'custom', path: [key], message });
      else if (NAME_FIELDS.has(key) && value && value.length < 2) ctx.addIssue({ code: 'custom', path: [key], message });
    }
  });
}
type FormValues = z.infer<typeof baseSchema>;

const suggestNumber = () => `S-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

function fromStudent(s: Student): FormValues {
  const personal = s.custom_fields?.personal ?? {};
  const academic = s.custom_fields?.academic ?? {};
  const medical = (s.medical_info ?? {}) as { blood_group?: string; allergies?: string[]; notes?: string; emergency_notes?: string };
  const gender = String(personal.gender ?? s.profile?.gender ?? '').toLowerCase();
  return {
    first_name: s.profile?.first_name ?? '',
    father_name: s.profile?.father_name ?? '',
    grandfather_name: s.profile?.grandfather_name ?? '',
    last_name: s.profile?.last_name ?? '',
    gender: gender === 'male' || gender === 'female' ? gender : '',
    date_of_birth: (personal.date_of_birth ?? s.profile?.date_of_birth ?? '').slice(0, 10),
    national_id: s.profile?.national_id ?? '',
    email: s.profile?.email ?? '',
    phone: s.profile?.phone ?? '',
    address: personal.address ?? '',
    student_number: s.student_number,
    grade_level_id: s.grade?.id ?? s.grade_level_id ?? '',
    section_id: s.section?.id ?? s.section_id ?? '',
    admission_date: (academic.admission_date ?? '').slice(0, 10),
    blood_group: medical.blood_group ?? '',
    allergies: (medical.allergies ?? []).join(', '),
    medical_notes: medical.notes ?? medical.emergency_notes ?? '',
    username: s.profile?.username ?? '',
    password: '',
    photo: s.profile?.profile_photo_url ?? null,
  };
}

/** Add or edit a student (web: AddStudentForm / edit). Simplified layout; same API and fields. */
export default function StudentForm() {
  const { t } = useTranslation();
  const tf = (k: string) => t(`school.students.fields.${k}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { number } = useLocalSearchParams<{ number?: string }>();
  const editing = !!number;
  const existing = useApi(editing ? ['admin', 'student', campusId ?? 'school', number] : null, ([, , , n]) => adminStudents.getByNumber(campusId, n as string));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [uploading, setUploading] = useState(false);
  const [created, setCreated] = useState<{ username?: string; password?: string } | null>(null);
  const [permission, setPermission] = useState('default');
  const defs = useApi(['admin', 'custom-fields', 'student', campusId ?? 'school'], () => adminCustomFields.list('student', campusId));
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const loadedRecord = existing.data ?? null;
  useEffect(() => {
    if (defs.data && (!editing || loadedRecord)) setCustomValues(initialCustomValues(defs.data, loadedRecord?.custom_fields));
  }, [defs.data, loadedRecord, editing]);

  const required = useRequiredFields('student', campusId);
  // Read inside the resolver at submit time, so the latest grade/sections/settings apply.
  const rules = useRef({ isRequired: required.isRequired, gradeHasSections: false });
  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    resolver: (values, ctx, opts) => zodResolver(buildSchema(rules.current.isRequired, rules.current.gradeHasSections))(values, ctx, opts),
    defaultValues: {
      first_name: '', father_name: '', grandfather_name: '', last_name: '', gender: '', date_of_birth: '', national_id: '',
      email: '', phone: '', address: '', student_number: suggestNumber(), grade_level_id: '', section_id: '', admission_date: '',
      blood_group: '', allergies: '', medical_notes: '', username: '', password: '', photo: null,
    },
  });
  useEffect(() => {
    if (existing.data) reset(fromStudent(existing.data));
  }, [existing.data, reset]);

  const [gradeId, photo, gender] = useWatch({ control, name: ['grade_level_id', 'photo', 'gender'] });
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, () => adminAcademics.sections(campusId, gradeId));
  const gradeHasSections = (sections.data?.length ?? 0) > 0;
  // Latest rules for the resolver (read at validation time), updated after render.
  useEffect(() => {
    rules.current = { isRequired: required.isRequired, gradeHasSections };
  });
  const req = (webId: string) => (required.isRequired(webId) ? ' *' : '');
  const gradeOptions = useMemo(() => (grades.data ?? []).map((g) => ({ value: g.id, label: g.name })), [grades.data]);

  const save = useAction(
    async (f: FormValues) => {
      const s = existing.data;
      const grade = grades.data?.find((g) => g.id === f.grade_level_id);
      const allergies = f.allergies.split(',').map((a) => a.trim()).filter(Boolean);
      const prev = s?.custom_fields ?? {};
      const medicalPrev = (s?.medical_info ?? {}) as Record<string, unknown>;
      // The server replaces custom_fields wholesale, so keep every existing category.
      const custom_fields = {
        ...prev,
        personal: { ...(prev.personal ?? {}), date_of_birth: f.date_of_birth || undefined, gender: f.gender || undefined, address: f.address || undefined, student_photo: f.photo || undefined },
        academic: { ...(prev.academic ?? {}), admission_date: f.admission_date || undefined },
      };
      const withCustom = mergeCustomValues(defs.data, customValues, custom_fields, 'nested');
      const body: StudentInput = {
        student_number: f.student_number,
        first_name: f.first_name,
        father_name: f.father_name,
        grandfather_name: f.grandfather_name || undefined,
        last_name: f.last_name,
        email: f.email || undefined,
        phone: f.phone || undefined,
        gender: (f.gender || undefined) as StudentInput['gender'],
        date_of_birth: f.date_of_birth || undefined,
        national_id: f.national_id || undefined,
        grade_level_id: f.grade_level_id,
        grade_level: grade?.name,
        section_id: f.section_id || (editing ? null : undefined),
        profile_photo_url: f.photo || undefined,
        custom_fields: withCustom,
        medical_info: { ...medicalPrev, blood_group: f.blood_group || undefined, allergies, notes: f.medical_notes || undefined },
      };
      if (f.username) body.username = f.username;
      if (f.password) body.password = f.password;
      return editing && s ? adminStudents.update(campusId, s.id, body) : adminStudents.create({ ...body, campus_id: campusId });
    },
    { success: editing ? t('app.saved') : t('school.students.add_student.msg_enroll_success') },
  );

  async function uploadPhoto() {
    const picked = await pickImage({ maxDimension: 800 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setValue('photo', res.data.url, { shouldDirty: true });
    else toast.error(res.error || t('app.error_title'));
  }

  const onSubmit = handleSubmit(async (f) => {
    const missing = missingRequired(defs.data, customValues);
    if (missing.length) return toast.error(t('app.cf_missing', { fields: missing.join(', ') }));
    const res = await save.run(f);
    if (!res.ok) return;
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'student' || key[1] === 'students'));
    mutate((key) => typeof key === 'string' && key.startsWith('admin-students'));
    if (!editing) {
      const permErr = await applyPermissionProfile('student', permission, (res.data as { id?: string } | undefined)?.id);
      if (permErr) toast.error(permErr);
    }
    const data = res.data as Student | undefined;
    if (!editing && data?.generated_username) setCreated({ username: data.generated_username, password: data.generated_password });
    else router.back();
  });

  if (editing && existing.isLoading) return <LoadingList rows={6} />;

  if (created) {
    return (
      <>
        <Stack.Screen options={{ title: t('school.students.add_student.credentials_title') }} />
        <Screen scroll edges={['bottom']}>
          <Text variant="muted">{t('school.students.add_student.credentials_desc')}</Text>
          <Card className="gap-2 py-4">
            <CardContent className="gap-2 px-4">
              <Text className="text-muted-foreground text-xs">{tf('username')}</Text>
              <Text selectable className="font-mono text-lg">
                {created.username}
              </Text>
              <Text className="text-muted-foreground text-xs">{tf('password')}</Text>
              <Text selectable className="font-mono text-lg">
                {created.password}
              </Text>
            </CardContent>
          </Card>
          <Button onPress={() => router.back()}>
            <Text>{t('app.cs_close')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('school.students.edit_student.title') : t('school.students.add_student.title') }} />
      <Screen scroll edges={['bottom']}>
        <View className="items-center gap-2">
          <PersonAvatar url={photo} name="" size={80} />
          <Button variant="outline" size="sm" onPress={uploadPhoto} disabled={uploading}>
            <Icon as={ImagePlus} className="size-4" />
            <Text>{uploading ? t('app.ob_uploading') : tf('student_photo')}</Text>
          </Button>
        </View>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('school.students.add_student.personal_tab')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="first_name" label={tf('first_name') + req('firstName')} />
            <TextField control={control} name="father_name" label={tf('father_name') + req('fatherName')} />
            <TextField control={control} name="grandfather_name" label={tf('grandfather_name') + req('grandfatherName')} />
            <TextField control={control} name="last_name" label={tf('last_name') + req('lastName')} />
            <Label>{tf('gender') + req('gender')}</Label>
            <FilterChips<'male' | 'female'>
              value={gender as 'male' | 'female'}
              onChange={(v) => setValue('gender', v, { shouldDirty: true })}
              options={[
                { value: 'male', label: tf('male') },
                { value: 'female', label: tf('female') },
              ]}
            />
            <TextField control={control} name="date_of_birth" label={tf('date_of_birth') + req('dateOfBirth')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
            <TextField control={control} name="national_id" label={tf('national_id') + req('nationalId')} />
            <TextField control={control} name="email" label={tf('email') + req('email')} hint={editing ? undefined : t('school.students.add_student.help_email_optional')} keyboardType="email-address" autoCapitalize="none" />
            <TextField control={control} name="phone" label={tf('phone_number') + req('phoneNumber')} keyboardType="phone-pad" />
            <TextField control={control} name="address" label={tf('address') + req('address')} multiline />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('school.students.add_student.academic_tab')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="student_number" label={tf('student_number')} autoCapitalize="characters" />
            <SelectField control={control} name="grade_level_id" label={tf('grade_level') + req('grade_level_id')} options={gradeOptions} placeholder={t('school.students.student_info.filter_grade')} />
            {gradeId && (sections.data?.length ?? 0) > 0 ? (
              <SelectField
                control={control}
                name="section_id"
                label={tf('section') + req('section_id')}
                options={[{ value: '', label: t('school.students.student_details.unassigned') }, ...(sections.data ?? []).map((x) => ({ value: x.id, label: x.name }))]}
              />
            ) : null}
            <TextField control={control} name="admission_date" label={tf('admission_date') + req('admissionDate')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('school.students.add_student.medical_tab')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <Controller
              control={control}
              name="blood_group"
              render={({ field }) => (
                <View className="gap-1.5">
                  <Label>{tf('blood_group') + req('bloodGroup')}</Label>
                  <FilterChips<string> value={field.value || NONE} onChange={(v) => field.onChange(v === NONE ? '' : v)} options={[{ value: NONE, label: '—' }, ...BLOOD.map((b) => ({ value: b, label: b }))]} />
                </View>
              )}
            />
            <TextField control={control} name="allergies" label={tf('allergies_list')} hint={t('app.ppl_comma_hint')} />
            <TextField control={control} name="medical_notes" label={tf('medical_notes') + req('medicalNotes')} multiline />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('school.students.add_student.system_tab')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="username" label={tf('username')} autoCapitalize="none" autoCorrect={false} />
            <TextField
              control={control}
              name="password"
              label={tf('password')}
              hint={editing ? t('app.ppl_password_keep') : t('school.students.add_student.help_auto_password')}
              secureTextEntry
              autoComplete="new-password"
            />
            {!editing ? <PermissionsSelect baseRole={'student'} value={permission} onChange={setPermission} /> : null}
          </CardContent>
        </Card>

        <CustomFieldInputs
          defs={defs.data}
          values={customValues}
          onChange={(fid, val) => setCustomValues((p) => ({ ...p, [fid]: val }))}
          tabName={(cid, name) => (ENTITY_TABS.student.includes(cid) ? t(`app.cf_tab_${cid}`) : name)}
        />

        <FormError message={Object.keys(formState.errors).length ? 'app.ppl_fix_errors' : null} />
        <Button onPress={onSubmit} disabled={save.running || uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
