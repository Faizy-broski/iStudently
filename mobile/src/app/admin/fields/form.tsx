import { zodResolver } from '@hookform/resolvers/zod';
import type { CampusScope, CustomFieldType } from '@studently/shared-types';
import { v } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { MultiSelect } from '@/components/app/multi-select';
import { SwitchField, TextField } from '@/components/app/form';
import { SelectField } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ENTITY_TABS, isPersonEntity, tabsFor, type PersonEntity } from '@/features/admin/field-tabs';
import { FIELD_TYPES, OPTION_TYPES, tabIdFor } from '@/features/superadmin/fields';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const NEW_TAB = '__new__';
/** School admins choose between this campus and the whole school family (super admin has more). */
const SCOPES: CampusScope[] = ['this_campus', 'selected_campuses', 'all_campuses'];

const lines = (text: string) =>
  text
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

const schema = z
  .object({
    tab: z.string(),
    new_tab_name: z.string().trim().max(60, 'app.v_too_long'),
    label: v.required(120),
    label_ar: z.string().trim().max(120, 'app.v_too_long'),
    type: z.enum(FIELD_TYPES as [CustomFieldType, ...CustomFieldType[]]),
    options: z.string(),
    options_ar: z.string(),
    required: z.boolean(),
    campus_scope: z.enum(SCOPES as [CampusScope, ...CampusScope[]]),
    applicable_school_ids: z.array(z.string()),
  })
  .refine((f) => f.tab !== NEW_TAB || f.new_tab_name.length > 0, { path: ['new_tab_name'], message: 'app.v_required' })
  .refine((f) => !OPTION_TYPES.includes(f.type) || lines(f.options).length > 0, { path: ['options'], message: 'app.cf_v_options' })
  .refine((f) => !OPTION_TYPES.includes(f.type) || !f.options_ar.trim() || lines(f.options_ar).length === lines(f.options).length, {
    path: ['options_ar'],
    message: 'app.cf_v_options_ar',
  });
type FormValues = z.infer<typeof schema>;

/** Add or edit a custom field for students / teachers / staff / parents. */
export default function PeopleFieldForm() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ entity?: string; fieldId?: string; tab?: string }>();
  const entity: PersonEntity = isPersonEntity(params.entity) ? params.entity : 'student';
  const { fieldId } = params;
  const editing = !!fieldId;
  const { campusId, campuses } = useCampus();
  const fields = useApi(['admin', 'custom-fields', entity, campusId ?? 'school'], () => adminCustomFields.list(entity, campusId));
  const field = fields.data?.find((f) => f.id === fieldId);
  const tabs = useMemo(() => tabsFor(entity, fields.data ?? []), [entity, fields.data]);
  const tabName = (x: { id: string; name: string; builtIn: boolean }) => (x.builtIn ? t(`app.cf_tab_${x.id}`) : x.name);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tab: params.tab || ENTITY_TABS[entity][0], new_tab_name: '', label: '', label_ar: '', type: 'text', options: '', options_ar: '',
      required: false, campus_scope: 'this_campus', applicable_school_ids: [],
    },
  });
  useEffect(() => {
    if (field)
      reset({
        tab: field.category_id,
        new_tab_name: '',
        label: field.label,
        label_ar: field.label_ar ?? '',
        type: field.type,
        options: (field.options ?? []).join('\n'),
        options_ar: (field.options_ar ?? []).join('\n'),
        required: field.required,
        campus_scope: field.campus_scope === 'all_campuses' || field.campus_scope === 'selected_campuses' ? field.campus_scope : 'this_campus',
        applicable_school_ids: field.applicable_school_ids ?? [],
      });
  }, [field, reset]);
  const [type, tabValue, scope] = useWatch({ control, name: ['type', 'tab', 'campus_scope'] });

  const save = useAction(
    (f: FormValues) => {
      const isNew = f.tab === NEW_TAB;
      const tabMeta = tabs.find((x) => x.id === f.tab);
      const hasOptions = OPTION_TYPES.includes(f.type);
      const body = {
        category_id: isNew ? tabIdFor(f.new_tab_name) : f.tab,
        category_name: isNew ? f.new_tab_name : tabMeta?.builtIn ? t(`app.cf_tab_${f.tab}`, { lng: 'en' }) : (tabMeta?.name ?? f.tab),
        label: f.label,
        label_ar: f.label_ar || null,
        type: f.type,
        options: hasOptions ? lines(f.options) : undefined,
        options_ar: hasOptions && f.options_ar.trim() ? lines(f.options_ar) : undefined,
        required: f.required,
        campus_scope: f.campus_scope,
        applicable_school_ids: f.campus_scope === 'selected_campuses' ? f.applicable_school_ids : [],
      };
      return editing ? adminCustomFields.update(campusId, fieldId!, body) : adminCustomFields.create(entity, campusId, body);
    },
    { success: editing ? t('app.saved') : t('app.bl_created'), onSuccess: () => fields.mutate() },
  );
  const remove = useAction(() => adminCustomFields.remove(campusId, fieldId!), { success: t('app.bl_deleted'), onSuccess: () => fields.mutate() });

  if (editing && fields.isLoading && !field) return <LoadingList rows={4} />;
  const fieldLabel = field?.label ?? '';

  return (
    <>
      <Stack.Screen options={{ title: editing ? fieldLabel : t('app.cf_new') }} />
      <Screen scroll edges={['bottom']}>
        <SelectField
          control={control}
          name="tab"
          label={t('app.cf_tab')}
          options={[...tabs.map((x) => ({ value: x.id, label: tabName(x) })), { value: NEW_TAB, label: t('app.cf_new_tab') }]}
        />
        {tabValue === NEW_TAB ? <TextField control={control} name="new_tab_name" label={t('app.cf_new_tab_name')} /> : null}
        <TextField control={control} name="label" label={t('app.cf_label')} />
        <TextField control={control} name="label_ar" label={t('app.cf_label_ar')} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
        <SelectField control={control} name="type" label={t('app.cf_type')} options={FIELD_TYPES.map((x) => ({ value: x, label: t(`app.cf_type_${x}`) }))} />
        {OPTION_TYPES.includes(type) ? (
          <>
            <TextField control={control} name="options" label={t('app.cf_options')} hint={t('app.cf_options_hint')} multiline numberOfLines={5} className="min-h-28" />
            <TextField
              control={control}
              name="options_ar"
              label={t('app.cf_options_ar')}
              hint={t('app.cf_options_ar_hint')}
              multiline
              numberOfLines={5}
              className="min-h-28"
              style={{ writingDirection: 'rtl', textAlign: 'right' }}
            />
          </>
        ) : null}
        <SwitchField control={control} name="required" label={t('app.cf_required')} />
        <Controller
          control={control}
          name="campus_scope"
          render={({ field: f }) => (
            <View className="gap-1.5">
              <Label>{t('app.cf_scope')}</Label>
              <FilterChips<CampusScope> value={f.value} onChange={f.onChange} options={SCOPES.filter((x) => x !== 'selected_campuses' || campuses.length > 1).map((x) => ({ value: x, label: t(`app.cf_scope_admin_${x}`) }))} />
            </View>
          )}
        />
        {scope === 'selected_campuses' ? (
          <Controller
            control={control}
            name="applicable_school_ids"
            render={({ field: f }) => (
              <View className="gap-1.5">
                <Label>{t('app.cf_select_campuses')}</Label>
                <MultiSelect value={f.value} onChange={f.onChange} title={t('app.cf_select_campuses')} options={campuses.map((c) => ({ id: c.id, label: c.name }))} />
              </View>
            )}
          />
        ) : null}

        <Button
          onPress={handleSubmit(async (f) => {
            if ((await save.run(f)).ok) router.back();
          })}
          disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing && field ? (
          <Button
            variant="ghost"
            onPress={async () => {
              const ok = await confirm({ title: t('app.cf_delete_title', { label: fieldLabel }), body: t('app.cf_delete_body'), destructive: true, confirmLabel: t('app.bl_delete') });
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
