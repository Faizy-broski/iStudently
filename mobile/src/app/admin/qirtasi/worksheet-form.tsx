import type { UploadFile } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FileText, UploadCloud, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { TAG_FACET_KEYS, tt, WORKSHEET_TYPES } from '@/features/admin/qirtasi';
import { useCampus } from '@/features/campus/campus';
import { adminQirtasi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, pickImage, type PickedDocument } from '@/lib/upload';
import { cn } from '@/lib/utils';

const MAX_FILE_MB = 25;
type Picked = PickedDocument | null;

function FileSlot({ label, hint, file, onPick, onClear }: { label: string; hint: string; file: Picked; onPick: () => void; onClear: () => void }) {
  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      <Pressable onPress={onPick} className="border-info-soft dark:border-border flex-row items-center gap-2 rounded-xl border border-dashed p-3">
        <Icon as={file ? FileText : UploadCloud} className={cn('size-4', file ? 'text-primary' : 'text-muted-foreground')} />
        <Text className={cn('flex-1 text-sm', !file && 'text-muted-foreground')} numberOfLines={1}>
          {file ? file.name : hint}
        </Text>
        {file ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={tt('Remove', 'إزالة')}>
            <Icon as={X} className="text-muted-foreground size-4" />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Upload or edit a worksheet: titles, curriculum placement, tags, visibility, files (web: UploadWorksheetDialog). */
export default function WorksheetForm() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const cid = campusId ?? 'school';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useApi(id ? ['admin', 'qirtasi-worksheet', id, cid] : null, ([, , wid]) => adminQirtasi.worksheet(wid as string, campusId));

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('drill');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId, setTermId] = useState('none');
  const [unitId, setUnitId] = useState('none');
  const [lessonId, setLessonId] = useState('none');
  const [visibility, setVisibility] = useState<'private' | 'school' | 'public'>('school');
  const [facetIds, setFacetIds] = useState<string[]>([]);
  const [file, setFile] = useState<Picked>(null);
  const [thumbnail, setThumbnail] = useState<Picked>(null);
  const [answerKey, setAnswerKey] = useState<Picked>(null);
  const [saving, setSaving] = useState(false);

  const stages = useApi(['admin', 'qirtasi-nodes', 'stages', '', cid], () => adminQirtasi.nodes('stages', undefined, campusId));
  const stageId = stages.data?.[0]?.id ?? null;
  const grades = useApi(stageId ? ['admin', 'qirtasi-nodes', 'grades', stageId, cid] : null, ([, , , , sid]) => adminQirtasi.nodes('grades', sid as string, campusId));
  const terms = useApi(['admin', 'qirtasi-nodes', 'terms', '', cid], () => adminQirtasi.nodes('terms', undefined, campusId));
  const subjects = useApi(gradeId ? ['admin', 'qirtasi-nodes', 'subjects', gradeId, cid] : null, ([, , , g]) => adminQirtasi.nodes('subjects', g as string, campusId));
  const units = useApi(subjectId ? ['admin', 'qirtasi-nodes', 'units', subjectId, cid] : null, ([, , , s]) => adminQirtasi.nodes('units', s as string, campusId));
  const lessons = useApi(unitId !== 'none' ? ['admin', 'qirtasi-nodes', 'lessons', unitId, cid] : null, ([, , , u]) => adminQirtasi.nodes('lessons', u as string, campusId));
  const facets = useApi(['admin', 'qirtasi-facets', cid], () => adminQirtasi.facets(campusId));

  const w = existing.data;
  const wid = w ? w.id : null;
  useEffect(() => {
    if (!w) return;
    setTitleAr(w.title_ar);
    setTitleEn(w.title_en ?? '');
    setDescription(w.description ?? '');
    setType(w.worksheet_type);
    setGradeId(w.grade_id);
    setSubjectId(w.subject_id);
    setTermId(w.term_id ?? 'none');
    setUnitId(w.unit_id ?? 'none');
    setLessonId(w.lesson_id ?? 'none');
    setVisibility(w.visibility_scope === 'marketplace' ? 'school' : w.visibility_scope);
    setFacetIds((w.facet_values ?? []).map((f) => f.facet_value_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wid]);

  const pickDoc = async (set: (p: Picked) => void) => {
    const [d] = await pickDocuments({ multiple: false });
    if (d) set(d);
  };
  const pickThumb = async () => {
    const r = await pickImage({ maxDimension: 1200, keepTransparency: false });
    if (r.ok) setThumbnail({ uri: r.file.uri, name: `thumbnail-${Date.now()}.jpg`, type: 'image/jpeg' });
  };

  async function save() {
    if (!titleAr.trim()) return toast.error(tt('Arabic title is required', 'العنوان بالعربية مطلوب'));
    if (!gradeId || !subjectId) return toast.error(tt('Grade and subject are required', 'الصف والمادة مطلوبان'));
    if (!wid && !file) return toast.error(tt('Please attach a worksheet file', 'يرجى إرفاق ملف ورقة العمل'));
    if (file?.size && file.size > MAX_FILE_MB * 1024 * 1024) return toast.error(tt(`File must be under ${MAX_FILE_MB}MB`, `يجب ألا يتجاوز حجم الملف ${MAX_FILE_MB} ميغابايت`));
    const fields = {
      title_ar: titleAr,
      title_en: titleEn || undefined,
      description: description || undefined,
      worksheet_type: type,
      grade_id: gradeId,
      subject_id: subjectId,
      term_id: termId === 'none' ? null : termId,
      unit_id: unitId === 'none' ? null : unitId,
      lesson_id: lessonId === 'none' ? null : lessonId,
      visibility_scope: visibility,
      facet_value_ids: facetIds,
    };
    const asUpload = (p: Picked): UploadFile | null => (p ? { uri: p.uri, name: p.name, type: p.type } : null);
    setSaving(true);
    try {
      const r = wid ? await adminQirtasi.update(wid, fields, campusId) : await adminQirtasi.upload(fields, { file: asUpload(file)!, thumbnail: asUpload(thumbnail), answerKey: asUpload(answerKey) }, campusId);
      if (!r.success) return toast.error(r.error || (wid ? tt('Update failed', 'فشل التحديث') : tt('Upload failed', 'فشل الرفع')));
      toast.success(wid ? tt('Worksheet updated', 'تم تحديث ورقة العمل') : tt('Worksheet uploaded', 'تم رفع ورقة العمل'));
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('qirtasi-'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (id && existing.isLoading) return <LoadingList />;
  const chipFacets = (facets.data ?? []).filter((f) => TAG_FACET_KEYS.includes(f.key));
  const opts = (rows: { id: string; name_ar: string }[] | undefined) => (rows ?? []).map((r) => ({ value: r.id, label: r.name_ar }));
  const disabled = (on: boolean) => ({ pointerEvents: on ? ('none' as const) : ('auto' as const), style: { opacity: on ? 0.5 : 1 } });

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: wid ? tt('Edit Worksheet', 'تعديل ورقة العمل') : tt('Upload Worksheet', 'رفع ورقة عمل') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-3 pt-4">
            <Input placeholder={tt('Title (Arabic)', 'العنوان بالعربية')} value={titleAr} onChangeText={setTitleAr} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
            <Input placeholder={tt('Title (English, optional)', 'العنوان بالإنجليزية (اختياري)')} value={titleEn} onChangeText={setTitleEn} />
            <Textarea placeholder={tt('Description (optional)', 'الوصف (اختياري)')} value={description} onChangeText={setDescription} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{tt('Curriculum placement', 'التصنيف المنهجي')}</Text>
            {!grades.isLoading && !(grades.data ?? []).length ? (
              <Text className="text-xs text-warning ">
                {tt(
                  'No curriculum data exists yet. Ask an admin to add at least one grade and subject in Curriculum Manager before uploading.',
                  'لا توجد بيانات منهج حتى الآن. اطلب من المسؤول إضافة صف ومادة واحدة على الأقل في إدارة المنهج قبل الرفع.',
                )}
              </Text>
            ) : null}
            <View {...disabled(!(grades.data ?? []).length)}>
              <Picker
                value={gradeId}
                placeholder={tt('Grade *', 'الصف *')}
                onChange={(v) => {
                  setGradeId(v);
                  setSubjectId('');
                  setUnitId('none');
                  setLessonId('none');
                }}
                options={opts(grades.data)}
              />
            </View>
            <View {...disabled(!gradeId)}>
              <Picker
                value={subjectId}
                placeholder={tt('Subject *', 'المادة *')}
                onChange={(v) => {
                  setSubjectId(v);
                  setUnitId('none');
                  setLessonId('none');
                }}
                options={opts(subjects.data)}
              />
            </View>
            <Picker value={termId} onChange={setTermId} options={[{ value: 'none', label: tt('Any term', 'أي فصل') }, ...opts(terms.data)]} />
            <Picker value={type} onChange={setType} options={WORKSHEET_TYPES.map((x) => ({ value: x.value, label: tt(x.en, x.ar) }))} />
            <View {...disabled(!subjectId)}>
              <Picker
                value={unitId}
                onChange={(v) => {
                  setUnitId(v);
                  setLessonId('none');
                }}
                options={[{ value: 'none', label: tt('No unit', 'بدون وحدة') }, ...opts(units.data)]}
              />
            </View>
            <View {...disabled(unitId === 'none')}>
              <Picker value={lessonId} onChange={setLessonId} options={[{ value: 'none', label: tt('No lesson', 'بدون درس') }, ...opts(lessons.data)]} />
            </View>
          </CardContent>
        </Card>

        {chipFacets.length ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="font-semibold">{tt('Tags', 'الوسوم')}</Text>
              {chipFacets.map((f) => (
                <View key={f.id} className="gap-1.5">
                  <Text className="text-muted-foreground text-xs">{f.name_ar}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {f.values.map((v) => {
                      const on = facetIds.includes(v.id);
                      return (
                        <Pressable key={v.id} onPress={() => setFacetIds((p) => (on ? p.filter((x) => x !== v.id) : [...p, v.id]))} className={cn('rounded-full border px-2.5 py-0.5', on ? 'border-primary bg-primary' : 'border-border')}>
                          <Text className={cn('text-xs', on && 'text-primary-foreground')}>{v.label_ar}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="gap-3 pt-4">
            <Picker
              value={visibility}
              onChange={(v) => setVisibility(v as typeof visibility)}
              options={[
                { value: 'private', label: tt('Private (only me)', 'خاص (لي فقط)') },
                { value: 'school', label: tt('My school', 'مدرستي') },
                { value: 'public', label: tt('Public (all schools)', 'عام (كل المدارس)') },
              ]}
            />
            {!wid ? (
              <>
                <FileSlot label={tt('Worksheet file (PDF/image)', 'ملف ورقة العمل (PDF/صورة)')} hint={tt('Tap to choose a file', 'اضغط لاختيار ملف')} file={file} onPick={() => pickDoc(setFile)} onClear={() => setFile(null)} />
                <FileSlot label={tt('Thumbnail (optional)', 'صورة مصغرة (اختياري)')} hint={tt('Tap to choose an image', 'اضغط لاختيار صورة')} file={thumbnail} onPick={pickThumb} onClear={() => setThumbnail(null)} />
                <FileSlot label={tt('Answer key (optional)', 'نموذج الإجابة (اختياري)')} hint={tt('Tap to choose a file', 'اضغط لاختيار ملف')} file={answerKey} onPick={() => pickDoc(setAnswerKey)} onClear={() => setAnswerKey(null)} />
              </>
            ) : null}
          </CardContent>
        </Card>

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{tt('Cancel', 'إلغاء')}</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Text>{saving ? tt('Saving…', 'جارٍ الحفظ…') : tt('Save', 'حفظ')}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
