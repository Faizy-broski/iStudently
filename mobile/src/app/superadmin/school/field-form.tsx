import { zodResolver } from '@hookform/resolvers/zod';
import type { CampusScope, CustomFieldType } from '@studently/shared-types';
import { v } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { FormError, SwitchField, TextField } from '@/components/app/form';
import { Picker, SelectField } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { DEFAULT_TAB, FIELD_SCOPES, FIELD_TYPES, OPTION_TYPES, fieldTabs, tabIdFor } from '@/features/superadmin/fields';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const NEW_TAB = '__new__';

const schema = z
  .object({
    tab: z.string(),
    new_tab_name: z.string().trim().max(60, 'app.v_too_long'),
    label: v.required(120),
    type: z.enum(FIELD_TYPES as [CustomFieldType, ...CustomFieldType[]]),
    options: z.string(),
    required: z.boolean(),
    campus_scope: z.enum(FIELD_SCOPES as [CampusScope, ...CampusScope[]]),
    applicable_school_ids: z.array(z.string()),
  })
  .refine((f) => f.tab !== NEW_TAB || f.new_tab_name.length > 0, { path: ['new_tab_name'], message: 'app.v_required' })
  .refine((f) => !OPTION_TYPES.includes(f.type) || splitOptions(f.options).length > 0, { path: ['options'], message: 'app.cf_v_options' })
  .refine((f) => f.campus_scope !== 'selected_campuses' || f.applicable_school_ids.length > 0, {
    path: ['applicable_school_ids'],
    message: 'app.cf_v_schools',
  });
type FormValues = z.infer<typeof schema>;

function splitOptions(text: string) {
  return text
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);
}

export default function SchoolFieldForm() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { schoolId, fieldId, tab } = useLocalSearchParams<{ schoolId: string; fieldId?: string; tab?: string }>();
  const editing = !!fieldId;
  const fields = useApi(['platform', 'school-fields', schoolId], () => platform.listSchoolFields(schoolId));
  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  const field = fields.data?.find((f) => f.id === fieldId);
  const tabs = useMemo(() => fieldTabs(fields.data ?? []), [fields.data]);

  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tab: tab || DEFAULT_TAB.id,
      new_tab_name: '',
      label: '',
      type: 'text',
      options: '',
      required: false,
      campus_scope: 'all_campuses',
      applicable_school_ids: [],
    },
  });
  useEffect(() => {
    if (field)
      reset({
        tab: field.category_id,
        new_tab_name: '',
        label: field.label,
        type: field.type,
        options: (field.options ?? []).join('\n'),
        required: field.required,
        campus_scope: field.campus_scope,
        applicable_school_ids: field.applicable_school_ids ?? [],
      });
  }, [field, reset]);
  const [type, scope, tabValue] = useWatch({ control, name: ['type', 'campus_scope', 'tab'] });

  const save = useAction(
    (f: FormValues) => {
      const isNew = f.tab === NEW_TAB;
      const category_id = isNew ? tabIdFor(f.new_tab_name) : f.tab;
      const category_name = isNew ? f.new_tab_name : (tabs.find((x) => x.id === f.tab)?.name ?? DEFAULT_TAB.name);
      const body = {
        category_id,
        category_name,
        label: f.label,
        type: f.type,
        options: OPTION_TYPES.includes(f.type) ? splitOptions(f.options) : undefined,
        required: f.required,
        campus_scope: f.campus_scope,
        applicable_school_ids: f.campus_scope === 'selected_campuses' ? f.applicable_school_ids : undefined,
      };
      return editing ? platform.updateSchoolField(schoolId, fieldId!, body) : platform.createSchoolField(schoolId, body);
    },
    { success: editing ? t('app.saved') : t('app.bl_created'), onSuccess: () => fields.mutate() },
  );
  const remove = useAction(() => platform.deleteSchoolField(schoolId, fieldId!), { success: t('app.bl_deleted'), onSuccess: () => fields.mutate() });

  if (editing && fields.isLoading && !field) return <LoadingList rows={4} />;

  const onSubmit = handleSubmit(async (f) => {
    if ((await save.run(f)).ok) router.back();
  });

  return (
    <>
      <Stack.Screen options={{ title: editing ? (field?.label ?? '') : t('app.cf_new') }} />
      <Screen scroll edges={['bottom']}>
        <SelectField
          control={control}
          name="tab"
          label={t('app.cf_tab')}
          options={[...tabs.map((x) => ({ value: x.id, label: x.name })), { value: NEW_TAB, label: t('app.cf_new_tab') }]}
        />
        {tabValue === NEW_TAB ? <TextField control={control} name="new_tab_name" label={t('app.cf_new_tab_name')} /> : null}
        <TextField control={control} name="label" label={t('app.cf_label')} />
        <SelectField control={control} name="type" label={t('app.cf_type')} options={FIELD_TYPES.map((x) => ({ value: x, label: t(`app.cf_type_${x}`) }))} />
        {OPTION_TYPES.includes(type) ? (
          <TextField control={control} name="options" label={t('app.cf_options')} hint={t('app.cf_options_hint')} multiline numberOfLines={5} className="min-h-28" />
        ) : null}
        <SwitchField control={control} name="required" label={t('app.cf_required')} />

        <View className="gap-1.5">
          <Label>{t('app.cf_scope')}</Label>
          <Picker
            value={scope}
            onChange={(x) => setValue('campus_scope', x as CampusScope, { shouldDirty: true })}
            options={FIELD_SCOPES.map((x) => ({ value: x, label: t(`app.cf_scope_long_${x}`) }))}
          />
        </View>
        {scope === 'selected_campuses' ? (
          <Controller
            control={control}
            name="applicable_school_ids"
            render={({ field: f }) => (
              <View className="border-border gap-1 rounded-md border p-2">
                {(schools.data ?? []).map((s) => {
                  const checked = f.value.includes(s.id);
                  const toggle = () => f.onChange(checked ? f.value.filter((x) => x !== s.id) : [...f.value, s.id]);
                  return (
                    <Pressable key={s.id} onPress={toggle} className="flex-row items-center gap-3 px-1 py-2" accessibilityRole="checkbox" accessibilityState={{ checked }}>
                      <Checkbox checked={checked} onCheckedChange={toggle} />
                      <Text className="flex-1">{s.name}</Text>
                    </Pressable>
                  );
                })}
                {schools.isLoading ? <LoadingList rows={2} /> : null}
              </View>
            )}
          />
        ) : null}
        <FormError message={formState.errors.applicable_school_ids?.message} />

        <Button onPress={onSubmit} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing && field ? (
          <Button
            variant="ghost"
            onPress={async () => {
              const ok = await confirm({ title: t('app.cf_delete_title', { label: field.label }), body: t('app.cf_delete_body'), destructive: true, confirmLabel: t('app.bl_delete') });
              if (ok && (await remove.run()).ok) router.back();
            }}
            disabled={remove.running}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
