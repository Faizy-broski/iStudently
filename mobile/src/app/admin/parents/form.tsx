import { zodResolver } from '@hookform/resolvers/zod';
import type { Parent, ParentInput } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImagePlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { FormError, TextField } from '@/components/app/form';
import { PersonAvatar } from '@/components/app/person-avatar';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/app/toast';
import { CustomFieldInputs, initialCustomValues, mergeCustomValues, missingRequired } from '@/features/admin/custom-field-inputs';
import { ENTITY_TABS } from '@/features/admin/field-tabs';
import { useRequiredFields } from '@/features/admin/required-fields';
import { applyPermissionProfile, PermissionsSelect } from '@/features/admin/people-extras';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields, adminParents, media } from '@/lib/api';
import { pickImage } from '@/lib/upload';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useAction } from '@/lib/use-action';

const baseSchema = z.object({
  first_name: z.string().trim(),
  last_name: z.string().trim(),
  cnic: z.string().trim().max(40, 'app.v_too_long'),
  phone: z.string().trim().max(30, 'app.v_too_long'),
  email: z.union([z.literal(''), z.string().trim().email('app.v_email')]),
  occupation: z.string().trim().max(100, 'app.v_too_long'),
  workplace: z.string().trim().max(150, 'app.v_too_long'),
  income: z.string().trim().max(40, 'app.v_too_long'),
  address: z.string().trim().max(300, 'app.v_too_long'),
  city: z.string().trim().max(80, 'app.v_too_long'),
  state: z.string().trim().max(80, 'app.v_too_long'),
  zip_code: z.string().trim().max(20, 'app.v_too_long'),
  country: z.string().trim().max(80, 'app.v_too_long'),
  emergency_contact_name: z.string().trim().max(120, 'app.v_too_long'),
  emergency_contact_relation: z.string().trim().max(60, 'app.v_too_long'),
  emergency_contact_phone: z.string().trim().max(30, 'app.v_too_long'),
  notes: z.string().trim().max(2000, 'app.v_too_long'),
  username: z.string().trim().max(60, 'app.v_too_long'),
  password: z.union([z.literal(''), z.string().min(8, 'app.v_min8').max(128, 'app.v_too_long')]),
});
type FormValues = z.infer<typeof baseSchema>;

/** Form field -> web field id (AddParentForm STANDARD_FIELDS). */
const WEB_ID: Partial<Record<keyof FormValues, string>> = {
  first_name: 'primaryFirstName', last_name: 'primaryLastName', cnic: 'primaryCNIC', phone: 'primaryPhone', email: 'primaryEmail',
  occupation: 'primaryOccupation', workplace: 'primaryWorkplace', income: 'primaryIncome', address: 'address', city: 'city', state: 'state',
  zip_code: 'zipCode', country: 'country', emergency_contact_name: 'emergencyContactName', emergency_contact_relation: 'emergencyContactRelation',
  emergency_contact_phone: 'emergencyContactPhone', notes: 'notes',
};

function buildSchema(isRequired: (id: string) => boolean) {
  return baseSchema.superRefine((f, ctx) => {
    for (const [key, webId] of Object.entries(WEB_ID) as [keyof FormValues, string][]) {
      if (isRequired(webId) && !String(f[key] ?? '').trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'app.v_required' });
    }
  });
}

function fromParent(p: Parent): FormValues {
  return {
    first_name: p.profile?.first_name ?? '', last_name: p.profile?.last_name ?? '', cnic: p.cnic ?? '', phone: p.profile?.phone ?? '',
    email: p.profile?.email ?? '', occupation: p.occupation ?? '', workplace: p.workplace ?? '', income: p.income ?? '', address: p.address ?? '',
    city: p.city ?? '', state: p.state ?? '', zip_code: p.zip_code ?? '', country: p.country ?? '', emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_relation: p.emergency_contact_relation ?? '', emergency_contact_phone: p.emergency_contact_phone ?? '', notes: p.notes ?? '',
    username: '', password: '',
  };
}

/** Add or edit one parent / guardian (web: AddParentForm, simplified to one person). */
export default function ParentForm() {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const existing = useApi(editing ? ['admin', 'parent-full', id] : null, () => adminParents.getWithChildren(id!));
  const required = useRequiredFields('parent', campusId);
  const isRequired = useRef(required.isRequired);
  // Latest rules for the resolver (read at validation time), updated after render.
  useEffect(() => {
    isRequired.current = required.isRequired;
  });
  const [created, setCreated] = useState<{ username?: string; password?: string } | null>(null);
  // Profile photo (web AddParentForm: profile_photo_url); undefined = not changed.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const shownPhoto = photo === undefined ? ((existing.data as { profile?: { profile_photo_url?: string | null } } | undefined)?.profile?.profile_photo_url ?? null) : photo;
  async function uploadPhoto() {
    const picked = await pickImage({ maxDimension: 800 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setPhoto(res.data.url);
    else toast.error(res.error || t('app.error_title'));
  }
  const [permission, setPermission] = useState('default');
  // Relationship type and the second parent / guardian, sent as metadata like the web (AddParentForm).
  type Rel = 'mother' | 'father' | 'both' | 'guardian';
  const meta = (existing.data as { metadata?: { relationship_type?: Rel; guardian_relationship?: string; secondary_parent?: Record<string, string> | null } } | undefined)?.metadata;
  const [rel, setRel] = useState<Rel | ''>('');
  const [guardianRel, setGuardianRel] = useState('');
  const [second, setSecond] = useState<Record<string, string>>({});
  const relValue = rel || meta?.relationship_type || '';
  const guardianValue = guardianRel || meta?.guardian_relationship || '';
  const secondValue = { ...(meta?.secondary_parent ?? {}), ...second };
  const showSecond = relValue === 'both' || relValue === 'guardian';
  const toast = useToast();
  const defs = useApi(['admin', 'custom-fields', 'parent', campusId ?? 'school'], () => adminCustomFields.list('parent', campusId));
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const loadedRecord = existing.data ?? null;
  useEffect(() => {
    if (defs.data && (!editing || loadedRecord)) setCustomValues(initialCustomValues(defs.data, loadedRecord?.custom_fields));
  }, [defs.data, loadedRecord, editing]);
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: (values, ctx, opts) => zodResolver(buildSchema(isRequired.current))(values, ctx, opts),
    defaultValues: fromParent({ profile: undefined } as unknown as Parent),
  });
  useEffect(() => {
    if (existing.data) reset(fromParent(existing.data));
  }, [existing.data, reset]);
  const label = (text: string, key: keyof FormValues) => text + (WEB_ID[key] && required.isRequired(WEB_ID[key]!) ? ' *' : '');

  const save = useAction(
    (v: FormValues) => {
      const body: ParentInput = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')) as unknown as ParentInput;
      body.custom_fields = mergeCustomValues(defs.data, customValues, loadedRecord?.custom_fields, 'flat');
      if (photo !== undefined) body.profile_photo_url = photo ?? undefined;
      if (relValue) (body as ParentInput & { metadata?: unknown }).metadata = { secondary_parent: showSecond ? secondValue : null, relationship_type: relValue, guardian_relationship: guardianValue };
      return editing ? adminParents.update(id!, body) : adminParents.create(body);
    },
    { success: editing ? t('parents.toasts.parentUpdated') : t('parents.toasts.parentAdded') },
  );

  const onSubmit = handleSubmit(async (v) => {
    const missing = missingRequired(defs.data, customValues);
    if (missing.length) return toast.error(t('app.cf_missing', { fields: missing.join(', ') }));
    if (!editing && !relValue) return toast.error(t('parents.relationshipTypeLabel'));
    const res = await save.run(v);
    if (!res.ok) return;
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'parent' || key[1] === 'parent-full'));
    mutate((key) => typeof key === 'string' && key.startsWith('admin-parents'));
    if (!editing) {
      const permErr = await applyPermissionProfile('parent', permission, (res.data as { id?: string } | undefined)?.id);
      if (permErr) toast.error(permErr);
    }
    const creds = (res.data as { credentials?: { username?: string; password?: string } } | undefined)?.credentials;
    if (!editing && creds?.username) setCreated(creds);
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
              <Text className="text-muted-foreground text-xs">{t('school.students.fields.username')}</Text>
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

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('parents.editParentTitle') : t('parents.addNewParentTitle') }} />
      <Screen scroll edges={['bottom']}>
        <View className="items-center gap-2">
          <PersonAvatar url={shownPhoto} name="" size={80} />
          <Button variant="outline" size="sm" onPress={uploadPhoto} disabled={uploading}>
            <Icon as={ImagePlus} className="size-4" />
            <Text>{uploading ? t('app.ob_uploading') : t('app.pa_profile_photo')}</Text>
          </Button>
        </View>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('parents.relationshipTypeLabel')}{editing ? '' : ' *'}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            {(
              [
                ['mother', 'motherOnly'],
                ['father', 'fatherOnly'],
                ['both', 'bothParents'],
                ['guardian', 'guardianOther'],
              ] as const
            ).map(([v, k]) => (
              <Pressable key={v} onPress={() => setRel(v)} className={cn('rounded-md border p-3', relValue === v ? 'border-brand-secondary bg-info-soft' : 'border-border')}>
                <Text className="text-sm font-semibold">{t(`parents.relationshipTypes.${k}`)}</Text>
                <Text className="text-muted-foreground text-xs">{t(`parents.relationshipTypes.${k}Sub`)}</Text>
              </Pressable>
            ))}
            {relValue === 'guardian' ? (
              <View className="gap-1">
                <Text className="text-sm">{t('parents.specifyRelationship')}</Text>
                <Input value={guardianValue} onChangeText={setGuardianRel} />
              </View>
            ) : null}
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{relValue === 'father' ? t('parents.relationshipLabels.fatherPossessive') : relValue === 'mother' || relValue === 'both' ? t('parents.relationshipLabels.motherPossessive') : relValue === 'guardian' ? (guardianValue ? t('parents.relationshipLabels.guardianPossessiveCustom', { relation: guardianValue }) : t('parents.relationshipLabels.guardianPossessive')) : t('parents.relationshipLabels.primaryGuardianPossessive')} · {t('parents.personalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="first_name" label={label(t('parents.firstName'), 'first_name')} />
            <TextField control={control} name="last_name" label={label(t('parents.lastName'), 'last_name')} />
            <TextField control={control} name="cnic" label={label(t('parents.fields.cnic'), 'cnic')} placeholder={t('parents.placeholders.cnic')} />
            <TextField control={control} name="phone" label={label(t('parents.fields.phone'), 'phone')} keyboardType="phone-pad" />
            <TextField control={control} name="email" label={label(t('parents.fields.email'), 'email')} keyboardType="email-address" autoCapitalize="none" />
          </CardContent>
        </Card>
        {showSecond ? (
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle>{relValue === 'both' ? t('parents.relationshipLabels.fatherPossessive') : t('parents.relationshipLabels.secondaryGuardianPossessive')} · {t('parents.contactInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3 px-4">
              {(
                [
                  ['first_name', t('parents.fields.firstName')],
                  ['last_name', t('parents.fields.lastName')],
                  ['cnic', t('parents.fields.cnic')],
                  ['email', t('parents.fields.email')],
                  ['phone', t('parents.fields.phone')],
                  ['occupation', t('parents.occupation')],
                  ['workplace', t('parents.workplace')],
                  ['income', t('parents.monthlyIncome')],
                ] as const
              ).map(([key, lbl]) => (
                <View key={key} className="gap-1">
                  <Text className="text-sm">{lbl}</Text>
                  <Input value={secondValue[key] ?? ''} onChangeText={(x) => setSecond({ ...second, [key]: x })} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} />
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('parents.professionalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="occupation" label={label(t('parents.occupation'), 'occupation')} />
            <TextField control={control} name="workplace" label={label(t('parents.workplace'), 'workplace')} />
            <TextField control={control} name="income" label={label(t('parents.monthlyIncome'), 'income')} keyboardType="decimal-pad" />
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('parents.addressInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="address" label={label(t('parents.streetAddress'), 'address')} multiline />
            <TextField control={control} name="city" label={label(t('parents.fields.city'), 'city')} />
            <TextField control={control} name="state" label={label(t('parents.fields.state'), 'state')} />
            <TextField control={control} name="zip_code" label={label(t('parents.zipCode'), 'zip_code')} />
            <TextField control={control} name="country" label={label(t('parents.fields.country'), 'country')} />
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('parents.emergencyContact')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="emergency_contact_name" label={label(t('parents.contactName'), 'emergency_contact_name')} />
            <TextField control={control} name="emergency_contact_relation" label={label(t('parents.relationship'), 'emergency_contact_relation')} />
            <TextField control={control} name="emergency_contact_phone" label={label(t('parents.fields.phone'), 'emergency_contact_phone')} keyboardType="phone-pad" />
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('parents.systemInformation')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <TextField control={control} name="notes" label={label(t('parents.additionalNotes'), 'notes')} multiline />
            <TextField control={control} name="username" label={t('school.students.fields.username')} hint={editing ? undefined : t('app.ppl_auto_if_empty')} autoCapitalize="none" autoCorrect={false} />
            <TextField
              control={control}
              name="password"
              label={t('school.students.fields.password')}
              hint={editing ? t('app.ppl_password_keep') : t('app.ppl_auto_if_empty')}
              secureTextEntry
              autoComplete="new-password"
            />
            {!editing ? <PermissionsSelect baseRole={'parent'} value={permission} onChange={setPermission} /> : null}
          </CardContent>
        </Card>
        <CustomFieldInputs
          defs={defs.data}
          values={customValues}
          onChange={(fid, val) => setCustomValues((p) => ({ ...p, [fid]: val }))}
          tabName={(cid, name) => (ENTITY_TABS.parent.includes(cid) ? t(`app.cf_tab_${cid}`) : name)}
        />

        <FormError message={Object.keys(formState.errors).length ? 'app.ppl_fix_errors' : null} />
        <Button onPress={onSubmit} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
