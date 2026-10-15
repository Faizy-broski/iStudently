import type { GrievancePriority } from '@studently/api-client';
import { Send, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { PRIORITIES } from '@/features/grievances/ui';
import { adminAcademics, adminEmployees, complaints } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';
import { useDebounced } from '@/lib/use-debounced';

const DEPARTMENT_KEYS = ['department_academic', 'department_administration', 'department_finance', 'department_hr', 'department_facilities', 'department_it', 'department_transportation', 'department_other'] as const;

/** Submit a complaint with category, priority, department, grade/subject, teacher, privacy and files (web: GrievanceSubmitForm). */
export function GrievanceSubmitScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`grievances.submit.${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? me.me.profile.school_id : null;
  const { campusId } = useCampus();
  const categories = useApi(['grievance-categories'], () => complaints.getCategories());
  const settings = useApi(['grievance-settings'], () => complaints.getSettings(), { shouldRetryOnError: false });
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const subjects = useApi(['admin', 'subjects', campusId ?? 'school'], () => adminAcademics.subjects(campusId));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<GrievancePriority>('normal');
  const [department, setDepartment] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherQuery, setTeacherQuery] = useState('');
  const term = useDebounced(teacherQuery.trim());
  const [teacher, setTeacher] = useState<{ profileId: string; name: string } | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [confidential, setConfidential] = useState(false);
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const teachers = useApi(!teacher && term.length >= 2 ? ['grievance-teacher-search', campusId ?? 'school', term] : null, () => adminEmployees.list('teacher', campusId, { search: term, limit: 10 }));
  const visibleSubjects = (subjects.data ?? []).filter((x) => !gradeId || x.grade_level_id === gradeId);

  async function submit() {
    if (!title.trim() || !description.trim()) return toast.error(s('err_required'));
    if (!schoolId) return toast.error(s('err_no_school'));
    setSubmitting(true);
    try {
      const created = await complaints.create({
        title,
        description,
        category_id: categoryId || undefined,
        priority,
        department: department || undefined,
        grade_level_id: gradeId || undefined,
        subject_id: subjectId || undefined,
        person_involved_profile_id: teacher?.profileId || undefined,
        is_anonymous: anonymous,
        is_confidential: confidential,
      });
      if (!created.success || !created.data) return toast.error(created.error || s('err_submit_failed'));
      for (const f of files) {
        const up = await complaints.uploadAttachmentFile(created.data.id, f);
        if (!up.success) toast.error(s('err_upload_failed', { name: f.name, error: up.error || '' }));
      }
      toast.success(s('msg_submitted', { number: created.data.complaint_number }));
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const field = (label: string, child: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {child}
    </View>
  );

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Card>
        <CardHeader>
          <CardTitle>{s('title')}</CardTitle>
          <CardDescription>{s('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {field(s('label_title'), <Input value={title} onChangeText={setTitle} maxLength={200} />)}
          {field(s('label_description'), <Textarea value={description} onChangeText={setDescription} className="min-h-28" />)}
          {field(s('label_category'), <Picker value={categoryId} onChange={setCategoryId} placeholder={s('select_category_placeholder')} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />)}
          {field(s('label_priority'), <Picker value={priority} onChange={(v) => setPriority(v as GrievancePriority)} options={PRIORITIES.map((p) => ({ value: p, label: t(`grievances.priority.${p}`) }))} />)}
          {field(s('label_department'), <Picker value={department} onChange={setDepartment} placeholder={s('select_department_placeholder')} options={DEPARTMENT_KEYS.map((k) => ({ value: s(k), label: s(k) }))} />)}
          {field(
            s('label_grade_level'),
            <Picker
              value={gradeId}
              onChange={(v) => {
                setGradeId(v);
                setSubjectId('');
              }}
              placeholder={s('select_grade_level_placeholder')}
              options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
            />,
          )}
          {field(s('label_subject'), <Picker value={subjectId} onChange={setSubjectId} placeholder={s('select_subject_placeholder')} options={visibleSubjects.map((x) => ({ value: x.id, label: x.name }))} />)}
          {field(
            s('label_teacher'),
            teacher ? (
              <View className="border-border flex-row items-center justify-between rounded-md border p-2">
                <Text className="text-sm">{teacher.name}</Text>
                <Button size="sm" variant="ghost" onPress={() => setTeacher(null)}>
                  <Text>{s('change_teacher')}</Text>
                </Button>
              </View>
            ) : (
              <View className="gap-1">
                <SearchBar value={teacherQuery} onChangeText={setTeacherQuery} placeholder={s('search_teacher_placeholder')} />
                {(teachers.data ?? []).map((x, i) => (
                  <View key={x.id}>
                    {i > 0 ? <Separator /> : null}
                    <Pressable
                      className="px-2 py-2.5"
                      onPress={() => {
                        setTeacher({ profileId: x.profile_id ?? '', name: shortName(x.profile) || x.employee_number || x.id });
                        setTeacherQuery('');
                      }}>
                      <Text className="text-sm">{shortName(x.profile) || x.employee_number}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ),
          )}
          <View className="border-border gap-3 rounded-lg border p-4">
            {settings.data?.allow_confidential !== false ? (
              <View>
                <CheckRow checked={confidential} onPress={() => setConfidential((v) => !v)} label={s('confidential_title')} />
                <Text className="text-muted-foreground ms-7 text-sm">{s('confidential_desc')}</Text>
              </View>
            ) : null}
            {settings.data?.allow_anonymous !== false ? (
              <View>
                <CheckRow checked={anonymous} onPress={() => setAnonymous((v) => !v)} label={s('anonymous_title')} />
                <Text className="text-muted-foreground ms-7 text-sm">{s('anonymous_desc')}</Text>
              </View>
            ) : null}
          </View>
          <View className="gap-2">
            <Label>{s('label_attachments')}</Label>
            {files.length ? (
              <View className="flex-row flex-wrap gap-2">
                {files.map((f, i) => (
                  <View key={`${f.uri}-${i}`} className="bg-muted flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5">
                    <Text className="max-w-40 text-sm" numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Pressable onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} hitSlop={6}>
                      <Icon as={X} className="text-muted-foreground size-3.5" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Button variant="outline" size="sm" className="self-start" onPress={async () => setFiles([...files, ...(await pickDocuments())])}>
              <Icon as={Upload} className="text-foreground size-4" />
              <Text>{s('btn_add_files')}</Text>
            </Button>
          </View>
          <Button onPress={submit} disabled={submitting}>
            <Icon as={Send} className="text-primary-foreground size-4" />
            <Text>{submitting ? s('btn_submitting') : s('btn_submit')}</Text>
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
