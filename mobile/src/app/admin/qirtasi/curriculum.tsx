import type { CurriculumLevel, CurriculumNode } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronRight, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { nodeLabel, tt } from '@/features/admin/qirtasi';
import { useCampus } from '@/features/campus/campus';
import { adminQirtasi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

// qirtasi_education_stages.key is limited to these 5 values.
const STAGE_KEYS = [
  { value: 'kindergarten', ar: 'روضة', en: 'Kindergarten' },
  { value: 'basic', ar: 'أساسي', en: 'Basic' },
  { value: 'secondary', ar: 'ثانوي', en: 'Secondary' },
  { value: 'university', ar: 'جامعي', en: 'University' },
  { value: 'vocational', ar: 'مهني', en: 'Vocational' },
];

function Column({
  level,
  title,
  parentId,
  parentField,
  requiresParent,
  selectedId,
  onSelect,
  stageKeys,
}: {
  level: CurriculumLevel;
  title: string;
  parentId?: string;
  parentField?: string;
  requiresParent?: boolean;
  selectedId: string | null;
  onSelect: (n: CurriculumNode) => void;
  stageKeys?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const blocked = requiresParent && !parentId;
  const res = useApi(blocked ? null : ['admin', 'qirtasi-nodes', level, parentId ?? '', campusId ?? 'school'], ([, , lv, pid]) => adminQirtasi.nodes(lv as CurriculumLevel, (pid as string) || undefined, campusId));
  const [mode, setMode] = useState<'none' | 'add' | CurriculumNode>('none');
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');

  const start = (n: CurriculumNode | null) => {
    setMode(n ?? 'add');
    setCode(n ? (n.code ?? n.key ?? '') : '');
    setNameAr(n?.name_ar ?? '');
    setNameEn(n?.name_en ?? '');
  };

  async function save() {
    if (!nameAr.trim()) return toast.error(tt('Arabic name is required', 'الاسم بالعربية مطلوب'));
    if (stageKeys && !code) return toast.error(tt('Pick a stage', 'اختر مرحلة'));
    const body: Record<string, unknown> = { name_ar: nameAr, name_en: nameEn || undefined };
    if (stageKeys) body.key = code;
    else if (level !== 'outcomes') body.code = code;
    if (parentField && parentId) body[parentField] = parentId;
    const r = typeof mode === 'object' ? await adminQirtasi.updateNode(level, mode.id, body, campusId) : await adminQirtasi.createNode(level, body, campusId);
    if (!r.success) return toast.error(r.error || (typeof mode === 'object' ? tt('Update failed', 'فشل التحديث') : tt('Create failed', 'فشل الإنشاء')));
    setMode('none');
    res.mutate();
  }

  async function remove(n: CurriculumNode) {
    if (!(await confirm({ title: tt('Delete this and everything under it?', 'هل تريد حذف هذا العنصر وكل ما تحته؟'), destructive: true, confirmLabel: tt('Delete', 'حذف') }))) return;
    const r = await adminQirtasi.deleteNode(level, n.id, campusId);
    if (!r.success) return toast.error(r.error || tt('Delete failed', 'فشل الحذف'));
    res.mutate();
  }

  return (
    <Card>
      <CardContent className="gap-2 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold">{title}</Text>
          {!blocked ? (
            <Button size="icon" variant="ghost" onPress={() => start(null)} accessibilityLabel={tt('Add', 'إضافة')}>
              <Icon as={Plus} className="text-foreground size-4" />
            </Button>
          ) : null}
        </View>
        {mode !== 'none' ? (
          <View className="bg-muted/40 gap-2 rounded-md p-2">
            {stageKeys ? (
              <Picker value={code} onChange={setCode} placeholder={tt('Select stage…', 'اختر مرحلة…')} options={STAGE_KEYS.map((o) => ({ value: o.value, label: tt(o.en, o.ar) }))} />
            ) : level !== 'outcomes' ? (
              <Input placeholder={tt('Code', 'الرمز')} value={code} onChangeText={setCode} autoCapitalize="none" />
            ) : null}
            <Input placeholder={tt('Name (Arabic)', 'الاسم بالعربية')} value={nameAr} onChangeText={setNameAr} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
            <Input placeholder={tt('Name (English, optional)', 'الاسم بالإنجليزية (اختياري)')} value={nameEn} onChangeText={setNameEn} />
            <View className="flex-row gap-2">
              <Button size="sm" className="flex-1" onPress={save}>
                <Text>{tt('Save', 'حفظ')}</Text>
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onPress={() => setMode('none')}>
                <Text>{tt('Cancel', 'إلغاء')}</Text>
              </Button>
            </View>
          </View>
        ) : null}
        {blocked ? (
          <Text className="text-muted-foreground py-2 text-center text-xs">{tt('Select an item above first.', 'اختر عنصرًا من الأعلى أولاً.')}</Text>
        ) : res.isLoading ? (
          <Text className="text-muted-foreground py-2 text-center text-xs">{tt('Loading…', 'جارٍ التحميل…')}</Text>
        ) : !(res.data ?? []).length ? (
          <Text className="text-muted-foreground py-2 text-center text-xs">{tt('Nothing here yet.', 'لا يوجد شيء هنا بعد.')}</Text>
        ) : (
          (res.data ?? []).map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Separator /> : null}
              <Pressable onPress={() => onSelect(n)} className={cn('flex-row items-center gap-1 rounded px-2 py-2', selectedId === n.id && 'bg-blue-100 dark:bg-blue-900')}>
                <Text className="flex-1 text-sm">{nodeLabel(n)}</Text>
                <Pressable onPress={() => start(n)} hitSlop={6} className="p-1" accessibilityLabel={tt('Edit', 'تعديل')}>
                  <Icon as={Pencil} className="text-muted-foreground size-3.5" />
                </Pressable>
                <Pressable onPress={() => remove(n)} hitSlop={6} className="p-1" accessibilityLabel={tt('Delete', 'حذف')}>
                  <Icon as={Trash2} className="text-destructive size-3.5" />
                </Pressable>
                <Icon as={ChevronRight} className="text-muted-foreground size-3.5 rtl:rotate-180" />
              </Pressable>
            </View>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Shared curriculum tree worksheets are filed under: stage → grade → subject → unit → lesson (web: /admin/qirtasi/curriculum). */
export default function CurriculumManager() {
  const [stage, setStage] = useState<CurriculumNode | null>(null);
  const [grade, setGrade] = useState<CurriculumNode | null>(null);
  const [subject, setSubject] = useState<CurriculumNode | null>(null);
  const [unit, setUnit] = useState<CurriculumNode | null>(null);
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: tt('Curriculum Manager', 'إدارة المنهج') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={GraduationCap} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">
            {tt(
              'Build your school\'s curriculum tree that its worksheets are filed under. Each school has its own tree (shared by its campuses). Nothing is pre-loaded — enter it here as it becomes available.',
              'أنشئ شجرة منهج مدرستك التي تُصنَّف أوراق عملها بناءً عليها. لكل مدرسة شجرتها الخاصة (تشترك فيها فروعها). لا توجد بيانات محمّلة مسبقًا — أدخلها هنا كلما توفرت.',
            )}
          </Text>
        </View>
        <Column
          level="stages"
          title={tt('Education Stage', 'المرحلة')}
          stageKeys
          selectedId={stage?.id ?? null}
          onSelect={(n) => {
            setStage(n);
            setGrade(null);
            setSubject(null);
            setUnit(null);
          }}
        />
        <Column
          level="grades"
          title={tt('Grade', 'الصف')}
          parentId={stage?.id}
          parentField="stage_id"
          requiresParent
          selectedId={grade?.id ?? null}
          onSelect={(n) => {
            setGrade(n);
            setSubject(null);
            setUnit(null);
          }}
        />
        <Column
          level="subjects"
          title={tt('Subject', 'المادة')}
          parentId={grade?.id}
          parentField="grade_id"
          requiresParent
          selectedId={subject?.id ?? null}
          onSelect={(n) => {
            setSubject(n);
            setUnit(null);
          }}
        />
        <Column level="units" title={tt('Unit', 'الوحدة')} parentId={subject?.id} parentField="subject_id" requiresParent selectedId={unit?.id ?? null} onSelect={setUnit} />
        <Column level="lessons" title={tt('Lesson', 'الدرس')} parentId={unit?.id} parentField="unit_id" requiresParent selectedId={null} onSelect={() => {}} />
      </ScrollView>
    </View>
  );
}
