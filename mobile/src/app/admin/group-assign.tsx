import { CONFIDENTIAL_FAMILY_STATUSES, type ConfidentialFamilyStatus, type GroupAssignChanges, type GroupEntity } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CustomFieldInputs } from '@/features/admin/custom-field-inputs';
import { PeoplePicker } from '@/features/admin/people-picker';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCustomFields, adminGroupAssign } from '@/lib/api';
import { useApi } from '@/lib/data';

const ENTITIES: GroupEntity[] = ['student', 'teacher', 'staff', 'parent'];
const KEEP = '__keep__';

/** Apply grade/section, status, confidential status and custom field values to many people at once; untouched settings are left as they are (web: Group Assign pages). */
export default function GroupAssign() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ entity?: string }>();
  const entity: GroupEntity = ENTITIES.includes(params.entity as GroupEntity) ? (params.entity as GroupEntity) : 'student';
  const isStudent = entity === 'student';
  const { campusId } = useCampus();
  const [status, setStatus] = useState<'unchanged' | 'active' | 'inactive'>('unchanged');
  const [gradeId, setGradeId] = useState(KEEP);
  const [sectionId, setSectionId] = useState(KEEP);
  const [confidential, setConfidential] = useState<string>(KEEP);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const grades = useApi(isStudent ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const sections = useApi(gradeId !== KEEP ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const defs = useApi(['admin', 'custom-fields', entity, campusId ?? 'school'], () => adminCustomFields.list(entity, campusId));
  const editable = useMemo(() => (defs.data ?? []).filter((d) => d.is_active !== false && d.type !== 'file'), [defs.data]);
  const keep = t('school.students.group_assign.dont_change', { defaultValue: "Don't change" });

  function changes(): GroupAssignChanges & { confidential_family_status?: ConfidentialFamilyStatus } {
    // Blank = skip; a checkbox has no blank state, so once touched it is always sent (web rule).
    const updates = [...touched].flatMap((id) => {
      const d = editable.find((x) => x.id === id);
      if (!d) return [];
      const v = values[id];
      const blank = d.type === 'checkbox' ? false : d.type === 'multi-select' ? !Array.isArray(v) || !v.length : v === '' || v === null || v === undefined;
      return blank ? [] : [{ category_id: d.category_id, field_key: d.field_key, value: v }];
    });
    return {
      grade_level_id: gradeId !== KEEP ? gradeId : undefined,
      section_id: gradeId !== KEEP && sectionId !== KEEP ? sectionId : undefined,
      is_active: status !== 'unchanged' ? status === 'active' : undefined,
      confidential_family_status: confidential !== KEEP ? (confidential as ConfidentialFamilyStatus) : undefined,
      custom_field_updates: updates,
    };
  }

  async function apply() {
    if (!selected.size) return toast.error(t('school.students.group_assign.toast.select_student'));
    const c = changes();
    if (c.grade_level_id === undefined && c.is_active === undefined && c.confidential_family_status === undefined && !c.custom_field_updates?.length) {
      return toast.error(t('school.students.group_assign.toast.nothing_to_assign'));
    }
    if (!(await confirm({ title: t('app.ga_confirm_title', { count: selected.size }), body: t('app.ga_confirm_body'), confirmLabel: t('app.ga_apply') }))) return;
    setBusy(true);
    const res = await adminGroupAssign.assign(entity, campusId, [...selected], c);
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error || t('school.students.group_assign.toast.operation_failed'));
    const { updated, errors } = res.data;
    if (errors.length) toast.error(t('app.ga_partial', { updated, failed: errors.length }));
    else toast.success(t('app.ga_done', { count: updated }));
    mutate((key) => typeof key === 'string' && key.startsWith('admin-'));
    mutate((key) => Array.isArray(key) && key[0] === 'admin');
    setSelected(new Set());
    if (!errors.length) router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: t(`app.ga_title_${entity}`) }} />
      <PeoplePicker
        entity={entity}
        campusId={campusId}
        selected={selected}
        onChange={setSelected}
        header={
          <View className="gap-3">
            {isStudent ? (
              <View className="gap-1.5">
                <Label>{t('school.students.fields.grade_level')}</Label>
                <Picker
                  value={gradeId}
                  onChange={(v) => {
                    setGradeId(v);
                    setSectionId(KEEP);
                  }}
                  options={[{ value: KEEP, label: keep }, ...(grades.data ?? []).filter((g) => g.is_active !== false).map((g) => ({ value: g.id, label: g.name }))]}
                />
                {gradeId !== KEEP ? (
                  <>
                    <Label>{t('school.students.fields.section')}</Label>
                    <Picker value={sectionId} onChange={setSectionId} options={[{ value: KEEP, label: keep }, ...(sections.data ?? []).filter((s) => s.is_active !== false).map((x) => ({ value: x.id, label: x.name }))]} />
                  </>
                ) : null}
              </View>
            ) : null}
            <View className="gap-1.5">
              <Label>{t('school.students.fields.status', { defaultValue: t('common.status') })}</Label>
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'unchanged', label: keep },
                  { value: 'active', label: t('school.students.fields.active') },
                  { value: 'inactive', label: t('school.students.fields.inactive') },
                ]}
              />
            </View>
            {isStudent ? (
              <View className="gap-1.5">
                <Label>{t('app.pe_cfs_title')}</Label>
                <Picker value={confidential} onChange={setConfidential} options={[{ value: KEEP, label: keep }, ...CONFIDENTIAL_FAMILY_STATUSES.map((x) => ({ value: x, label: t(`app.pe_cfs_opt_${x}`) }))]} />
              </View>
            ) : null}
            {editable.length ? (
              <CustomFieldInputs
                defs={editable}
                values={values}
                onChange={(id, v) => {
                  setValues((p) => ({ ...p, [id]: v }));
                  setTouched((p) => new Set(p).add(id));
                }}
                tabName={(cat, fallback) => (['personal', 'academic', 'medical', 'family', 'system', 'professional', 'qualifications', 'employment', 'contact', 'emergency'].includes(cat) ? t(`app.cf_tab_${cat}`) : fallback)}
              />
            ) : null}
          </View>
        }
        footer={
          <View className="border-border border-t p-4">
            <Button onPress={apply} disabled={busy || selected.size === 0}>
              <Text>{t('app.ga_apply_count', { count: selected.size })}</Text>
            </Button>
          </View>
        }
      />
    </>
  );
}
