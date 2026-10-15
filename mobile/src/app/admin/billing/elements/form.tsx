import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';

const NEW = '__new__';
const ALL = '__all__';

/** Add or edit a billing element; a new category can be created here too. */
export default function BillingElementForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id, category } = useLocalSearchParams<{ id?: string; category?: string }>();
  const editing = !!id;
  const { campusId } = useCampus();
  const categories = useApi(['admin', 'be-categories'], () => adminBillingElements.categories());
  const elements = useApi(['admin', 'billing-elements'], () => adminBillingElements.elements());
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const existing = elements.data?.find((e) => e.id === id);
  const [categoryId, setCategoryId] = useState(category ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [gradeId, setGradeId] = useState(ALL);
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [comment, setComment] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setCategoryId(existing.category_id);
    setTitle(existing.title);
    setAmount(String(existing.amount));
    setGradeId(existing.grade_level_id ?? ALL);
    setSectionId(existing.course_period_section_id ?? '');
    setSubjectId(existing.course_period_subject_id ?? '');
    setSortOrder(String(existing.sort_order ?? 0));
    setComment(existing.comment ?? '');
    setActive(existing.is_active);
  }, [existing]);

  // Section and subject (course period) come from the chosen grade, as on the web.
  const gradeKey = gradeId === ALL ? null : gradeId;
  const sections = useApi(gradeKey ? ['admin', 'sections', campusId ?? 'school', gradeKey] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const subjects = useApi(gradeKey ? ['admin', 'subjects', campusId ?? 'school', gradeKey] : null, ([, , , g]) => adminAcademics.subjects(campusId, g as string));
  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'billing-elements' || k[1] === 'be-categories'));

  async function save() {
    const amt = parseFloat(amount);
    if (!title.trim() || !(amt >= 0) || !amount || !categoryId || (categoryId === NEW && !newCategory.trim())) return toast.error(t('fees.structures.fillRequired'));
    setBusy(true);
    let cat = categoryId;
    if (cat === NEW) {
      const c = await adminBillingElements.createCategory(newCategory.trim());
      if (!c.success || !c.data) {
        setBusy(false);
        return toast.error(c.error || t('app.error_title'));
      }
      cat = c.data.id;
    }
    const body = {
      category_id: cat,
      title: title.trim(),
      amount: amt,
      grade_level_id: gradeId === ALL ? null : gradeId,
      course_period_section_id: gradeId === ALL ? null : sectionId || null,
      course_period_subject_id: gradeId === ALL ? null : subjectId || null,
      comment: comment.trim() || null,
      sort_order: Number(sortOrder) || 0,
    };
    const res = editing ? await adminBillingElements.updateElement(id!, { ...body, is_active: active }) : await adminBillingElements.createElement(body);
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(t('app.saved'));
    refresh();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('app.edit') : t('app.be_new') }} />
      <Screen scroll edges={['bottom']}>
        <View className="gap-1.5">
          <Label>{t('app.be_category')}</Label>
          <Picker
            value={categoryId}
            onChange={setCategoryId}
            options={[...(categories.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.title })), { value: NEW, label: t('app.be_new_category') }]}
          />
          {categoryId === NEW ? <Input value={newCategory} onChangeText={setNewCategory} placeholder={t('app.be_new_category_name')} /> : null}
        </View>
        <View className="gap-1.5">
          <Label>{t('app.be_name')}</Label>
          <Input value={title} onChangeText={setTitle} />
        </View>
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        </View>
        <View className="gap-1.5">
          <Label>{t('school.students.fields.grade_level')}</Label>
          <Picker
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setSectionId('');
              setSubjectId('');
            }}
            options={[{ value: ALL, label: t('fees.generate.allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
          />
        </View>
        {gradeKey ? (
          <>
            <View className="gap-1.5">
              <Label>{t('admin.billing_elements.elements.section_course_period')}</Label>
              <Picker value={sectionId} onChange={setSectionId} options={[{ value: '', label: t('admin.billing_elements.elements.dash') }, ...(sections.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{t('admin.billing_elements.elements.subject_course_period')}</Label>
              <Picker value={subjectId} onChange={setSubjectId} options={[{ value: '', label: t('admin.billing_elements.elements.dash') }, ...(subjects.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
            </View>
          </>
        ) : null}
        <View className="gap-1.5">
          <Label>{t('admin.billing_elements.elements.sort_order')}</Label>
          <Input value={sortOrder} onChangeText={(v) => setSortOrder(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </View>
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_comment')}</Label>
          <Input value={comment} onChangeText={setComment} />
        </View>
        {editing ? (
          <View className="flex-row items-center justify-between">
            <Text>{t('school.students.fields.active')}</Text>
            <Switch checked={active} onCheckedChange={setActive} />
          </View>
        ) : null}
        <Button onPress={save} disabled={busy}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            onPress={async () => {
              if (!(await confirm({ title: t('app.be_delete'), body: t('app.be_delete_body'), destructive: true, confirmLabel: t('app.bl_delete') }))) return;
              const res = await adminBillingElements.deleteElement(id!);
              if (!res.success) return toast.error(res.error || t('app.error_title'));
              refresh();
              router.back();
            }}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
