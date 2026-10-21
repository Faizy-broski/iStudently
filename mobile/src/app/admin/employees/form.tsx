import { zodResolver } from '@hookform/resolvers/zod';
import type { Employee, EmployeeInput, EmploymentType, PaymentType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { FilterChips } from '@/components/app/filter-chips';
import { FormError, NumberField, TextField } from '@/components/app/form';
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
import { adminCustomFields, adminDesignations, adminEmployees, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { generatePassword } from '@/lib/password';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const optionalDate = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'app.v_date');
const baseSchema = z.object({
  first_name: z.string().trim(),
  last_name: z.string().trim(),
  email: z.union([z.literal(''), z.string().trim().email('app.v_email')]),
  phone: z.string().trim().max(30, 'app.v_too_long'),
  gender: z.enum(['male', 'female', 'other', '']),
  date_of_birth: optionalDate,
  employee_number: z.string().trim().max(40, 'app.v_too_long'),
  title: z.string().trim().max(100, 'app.v_too_long'),
  department: z.string().trim().max(100, 'app.v_too_long'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', '']),
  payment_type: z.enum(['fixed_salary', 'hourly', '']),
  date_of_joining: optionalDate,
  base_salary: z.number({ error: 'app.v_number' }).min(0, 'app.v_min_zero').nullable(),
  qualifications: z.string().trim().max(500, 'app.v_too_long'),
  specialization: z.string().trim().max(500, 'app.v_too_long'),
  username: z.string().trim().max(60, 'app.v_too_long'),
  password: z.union([z.literal(''), z.string().min(8, 'app.v_min8').max(128, 'app.v_too_long')]),
  photo: z.string().nullable(),
});
type FormValues = z.infer<typeof baseSchema>;

const VT = 'teachers.validation.';
const RULES: [keyof FormValues, string][] = [
  ['first_name', `${VT}firstNameMin`],
  ['last_name', `${VT}lastNameMin`],
  ['email', `${VT}emailRequired`],
  ['phone', 'app.v_required'],
  ['gender', 'app.v_required'],
  ['date_of_birth', 'app.v_required'],
  ['employment_type', `${VT}employmentTypeRequired`],
  ['payment_type', `${VT}paymentTypeRequired`],
  ['date_of_joining', 'app.v_required'],
  ['title', 'app.v_required'],
  ['department', 'app.v_required'],
  ['qualifications', 'app.v_required'],
  ['specialization', 'app.v_required'],
];

/** Web rules (AddTeacherForm): required per school settings, names >= 2, salary needed for fixed pay when required. */
function buildSchema(isRequired: (id: string) => boolean) {
  return baseSchema.superRefine((f, ctx) => {
    for (const [key, message] of RULES) {
      const value = String(f[key] ?? '').trim();
      if (isRequired(key) && !value) ctx.addIssue({ code: 'custom', path: [key], message });
      else if ((key === 'first_name' || key === 'last_name') && value && value.length < 2) ctx.addIssue({ code: 'custom', path: [key], message });
    }
    if (isRequired('base_salary') && f.payment_type === 'fixed_salary' && !(f.base_salary && f.base_salary > 0)) {
      ctx.addIssue({ code: 'custom', path: ['base_salary'], message: `${VT}baseSalaryRequiredForFixed` });
    }
  });
}

function fromEmployee(e: Employee): FormValues {
  const g = (e.profile?.gender ?? '').toLowerCase();
  return {
    first_name: e.profile?.first_name ?? '',
    last_name: e.profile?.last_name ?? '',
    email: e.profile?.email ?? '',
    phone: e.profile?.phone ?? '',
    gender: g === 'male' || g === 'female' || g === 'other' ? g : '',
    date_of_birth: (e.profile?.date_of_birth ?? '').slice(0, 10),
    employee_number: e.employee_number ?? '',
    title: e.title ?? '',
    department: e.department ?? '',
    employment_type: e.employment_type ?? '',
    payment_type: e.payment_type ?? '',
    date_of_joining: (e.date_of_joining ?? '').slice(0, 10),
    base_salary: e.base_salary ?? null,
    qualifications: e.qualifications ?? '',
    specialization: e.specialization ?? '',
    username: e.profile?.username ?? '',
    password: '',
    photo: e.profile?.profile_photo_url ?? null,
  };
}

/** Add or edit a teacher (kind=teacher) or staff member (kind=staff). Same API and fields as the web. */
export default function EmployeeForm() {
  const { t } = useTranslation();
  const f = (k: string) => t(`teachers.fields.${k}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const kind = kindParam === 'staff' ? 'staff' : 'teacher';
  const editing = !!id;
  const existing = useApi(editing ? ['admin', 'employee', kind, id] : null, () => adminEmployees.get(kind, id!));
  const required = useRequiredFields(kind, campusId);
  const isRequired = useRef(required.isRequired);
  // Latest rules for the resolver (read at validation time), updated after render.
  useEffect(() => {
    isRequired.current = required.isRequired;
  });
  const [uploading, setUploading] = useState(false);
  const [created, setCreated] = useState<{ username?: string; password?: string } | null>(null);
  const [permission, setPermission] = useState('default');
  const defs = useApi(['admin', 'custom-fields', kind, campusId ?? 'school'], () => adminCustomFields.list(kind, campusId));
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const loadedRecord = existing.data ?? null;
  useEffect(() => {
    if (defs.data && (!editing || loadedRecord)) setCustomValues(initialCustomValues(defs.data, loadedRecord?.custom_fields));
  }, [defs.data, loadedRecord, editing]);

  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    resolver: (values, ctx, opts) => zodResolver(buildSchema(isRequired.current))(values, ctx, opts),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', gender: '', date_of_birth: '', employee_number: '', title: '', department: '',
      employment_type: 'full_time', payment_type: 'fixed_salary', date_of_joining: '', base_salary: null, qualifications: '', specialization: '',
      username: '', password: '', photo: null,
    },
  });
  useEffect(() => {
    if (existing.data) reset(fromEmployee(existing.data));
  }, [existing.data, reset]);
  const [photo, payment, jobTitle, password] = useWatch({ control, name: ['photo', 'payment_type', 'title', 'password'] });
  // Web add-staff: the school's designations (plus Librarian), or its default list when none are set up.
  const designationsQ = useApi(kind === 'staff' ? ['admin', 'designations', campusId ?? 'school'] : null, () => adminDesignations.list(campusId));
  const designationNames = (designationsQ.data ?? []).map((d) => d.name);
  const designations = designationNames.length
    ? [...designationNames, ...(designationNames.some((n) => n.toLowerCase() === 'librarian') ? [] : ['Librarian'])]
    : ['Librarian', 'Accountant', 'Clerk', 'Driver', 'Security Guard', 'Nurse', 'Receptionist'];
  if (jobTitle && !designations.includes(jobTitle)) designations.push(jobTitle);
  const isLibrarian = kind === 'staff' && jobTitle?.toLowerCase() === 'librarian';
  // A librarian must be able to log in: generate a password when none is set (web behaviour).
  useEffect(() => {
    if (isLibrarian && !editing && !password) setValue('password', generatePassword());
  }, [isLibrarian, editing, password, setValue]);
  const req = (key: string) => (required.isRequired(key) ? ' *' : '');

  const save = useAction(
    (v: FormValues) => {
      const body: EmployeeInput = {
        first_name: v.first_name,
        last_name: v.last_name,
        email: v.email || undefined,
        phone: v.phone || undefined,
        gender: v.gender || undefined,
        date_of_birth: v.date_of_birth || undefined,
        employee_number: v.employee_number || undefined,
        title: v.title || undefined,
        department: v.department || undefined,
        employment_type: (v.employment_type || undefined) as EmploymentType | undefined,
        payment_type: (v.payment_type || undefined) as PaymentType | undefined,
        date_of_joining: v.date_of_joining || undefined,
        base_salary: v.base_salary ?? undefined,
        qualifications: v.qualifications || undefined,
        specialization: v.specialization || undefined,
        profile_photo_url: v.photo || undefined,
        custom_fields: mergeCustomValues(defs.data, customValues, loadedRecord?.custom_fields, 'flat'),
      };
      if (v.username) body.username = v.username;
      if (v.password) body.password = v.password;
      return editing ? adminEmployees.update(kind, id!, body) : adminEmployees.create(kind, { ...body, campus_id: campusId });
    },
    { success: editing ? t('app.saved') : t('app.bl_created') },
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

  const onSubmit = handleSubmit(async (v) => {
    const missing = missingRequired(defs.data, customValues);
    if (missing.length) return toast.error(t('app.cf_missing', { fields: missing.join(', ') }));
    if (!editing && kind === 'staff' && v.title.toLowerCase() === 'librarian' && !v.password) return toast.error(t('staff.errors.passwordRequiredForLibrarian'));
    const res = await save.run(v);
    if (!res.ok) return;
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'employee');
    mutate((key) => typeof key === 'string' && key.startsWith('admin-employees'));
    // Credentials the server generated (no username/password given) are shown once, like the web.
    if (!editing) {
      const permErr = await applyPermissionProfile(kind === 'teacher' ? 'teacher' : 'staff', permission, (res.data as { id?: string } | undefined)?.id);
      if (permErr) toast.error(permErr);
    }
    const data = res.data as (Employee & { generated_username?: string; generated_password?: string; credentials?: { username?: string; password?: string } }) | undefined;
    const username = data?.generated_username ?? data?.credentials?.username;
    if (!editing && username) setCreated({ username, password: data?.generated_password ?? data?.credentials?.password });
    else router.back();
  });

  if (editing && existing.isLoading) return <LoadingList rows={6} />;

  if (created) {
    return (
      <>
        <Stack.Screen options={{ title: t('school.students.add_student.credentials_title') }} />
        <Screen scroll edges={['bottom']}>
          <Card className="gap-2 py-4">
            <CardContent className="gap-2 px-4">
              <Text className="text-muted-foreground text-xs">{f('username')}</Text>
              <Text selectable className="font-mono text-lg">
                {created.username}
              </Text>
              {created.password ? (
                <>
                  <Text className="text-muted-foreground text-xs">{t('school.students.fields.password')}</Text>
                  <Text selectable className="font-mono text-lg">
                    {created.password}
                  </Text>
                </>
              ) : null}
            </CardContent>
          </Card>
          <Button onPress={() => router.back()}>
            <Text>{t('app.cs_close')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  const title = editing ? t(kind === 'teacher' ? 'teachers.editTeacher' : 'staff.editStaff') : t(kind === 'teacher' ? 'teachers.addTeacher' : 'staff.addStaff');

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen scroll edges={['bottom']}>
        <View className="items-center gap-2">
          <PersonAvatar url={photo} name="" size={80} />
          <Button variant="outline" size="sm" onPress={uploadPhoto} disabled={uploading}>
            <Icon as={ImagePlus} className="size-4" />
            <Text>{uploading ? t('app.ob_uploading') : t('teachers.profilePhoto')}</Text>
          </Button>
        </View>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('teachers.tabs.personalInformation')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="first_name" label={f('firstName') + req('first_name')} />
            <TextField control={control} name="last_name" label={f('lastName') + req('last_name')} />
            <TextField control={control} name="email" label={f('email') + req('email')} keyboardType="email-address" autoCapitalize="none" />
            <TextField control={control} name="phone" label={f('phoneNumber') + req('phone')} keyboardType="phone-pad" />
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <View className="gap-1.5">
                  <Label>{f('gender') + req('gender')}</Label>
                  <FilterChips<string>
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'male', label: t('school.students.fields.male') },
                      { value: 'female', label: t('school.students.fields.female') },
                    ]}
                  />
                </View>
              )}
            />
            <TextField control={control} name="date_of_birth" label={f('dateOfBirth') + req('date_of_birth')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('teachers.tabs.professionalDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            {kind === 'staff' ? (
              <View className="gap-1">
                <SelectField control={control} name="title" label={f('title') + req('title')} options={designations.map((d) => ({ value: d, label: d }))} placeholder={f('title')} />
                <Text variant="muted" className="text-xs">
                  {t('app.ppl_librarian_hint')}
                </Text>
              </View>
            ) : (
              <TextField control={control} name="title" label={f('title') + req('title')} />
            )}
            <TextField control={control} name="department" label={f('department') + req('department')} />
            <Controller
              control={control}
              name="employment_type"
              render={({ field }) => (
                <View className="gap-1.5">
                  <Label>{f('employmentType') + req('employment_type')}</Label>
                  <FilterChips<string>
                    value={field.value}
                    onChange={field.onChange}
                    options={(['full_time', 'part_time', 'contract'] as const).map((x) => ({ value: x, label: t(`teachers.employmentTypes.${x}`) }))}
                  />
                </View>
              )}
            />
            <Controller
              control={control}
              name="payment_type"
              render={({ field }) => (
                <View className="gap-1.5">
                  <Label>{f('paymentType') + req('payment_type')}</Label>
                  <FilterChips<string>
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'fixed_salary', label: t('app.ppl_pay_fixed_salary') },
                      { value: 'hourly', label: t('app.ppl_pay_hourly') },
                    ]}
                  />
                </View>
              )}
            />
            {payment === 'fixed_salary' ? <NumberField control={control} name="base_salary" label={f('baseSalary') + req('base_salary')} /> : null}
            <TextField control={control} name="date_of_joining" label={f('dateOfJoining') + req('date_of_joining')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
            <TextField control={control} name="qualifications" label={f('qualifications') + req('qualifications')} multiline />
            <TextField control={control} name="specialization" label={f('specialization') + req('specialization')} multiline />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('teachers.tabs.systemLogin')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="employee_number" label={f('employeeNumber')} hint={editing ? undefined : t('app.ppl_auto_if_empty')} autoCapitalize="characters" />
            <TextField control={control} name="username" label={f('username')} hint={editing ? undefined : t('app.ppl_auto_if_empty')} autoCapitalize="none" autoCorrect={false} />
            <TextField
              control={control}
              name="password"
              label={t('school.students.fields.password')}
              hint={editing ? t('app.ppl_password_keep') : t('app.ppl_auto_if_empty')}
              secureTextEntry
              autoComplete="new-password"
            />
            {!editing ? <PermissionsSelect baseRole={kind === 'teacher' ? 'teacher' : 'staff'} value={permission} onChange={setPermission} /> : null}
          </CardContent>
        </Card>

        <CustomFieldInputs
          defs={defs.data}
          values={customValues}
          onChange={(fid, val) => setCustomValues((p) => ({ ...p, [fid]: val }))}
          tabName={(cid, name) => (ENTITY_TABS[kind].includes(cid) ? t(`app.cf_tab_${cid}`) : name)}
        />

        <FormError message={Object.keys(formState.errors).length ? 'app.ppl_fix_errors' : null} />
        <Button onPress={onSubmit} disabled={save.running || uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
