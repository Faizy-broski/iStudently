import type { StudentPrintInfo } from '@studently/api-client';
import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { htmlToText } from '@studently/shared-utils';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { RichTextField } from '@/components/app/rich-text-field';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { fullName } from '@/features/admin/people';
import { PeoplePicker } from '@/features/admin/people-picker';
import { usePrintContext } from '@/features/admin/print-context';
import { LetterTemplatePicker } from '@/features/admin/letter-templates';
import { useCampus } from '@/features/campus/campus';
import { adminStudents } from '@/lib/api';
import { StudentChecklist } from '@/features/admin/scheduling-tools';
import { useRoleBase } from '@/features/portal/role-base';
import { useTeacherStudents } from '@/features/teacher/students';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';

/** Same placeholders as the web's Print Letters page. */
const PLACEHOLDERS = ['__FULL_NAME__', '__FIRST_NAME__', '__FATHER_NAME__', '__GRANDFATHER_NAME__', '__LAST_NAME__', '__STUDENT_ID__', '__GRADE_LEVEL__', '__SECTION__', '__CAMPUS__', '__EMAIL__', '__PHONE__', '__DATE__'];
const SIZES = { small: 12, normal: 14, large: 17, huge: 21 } as const;
type Size = keyof typeof SIZES;

/** Personalised letters for selected students (web: /admin/students/print-letters). */
export default function PrintLetters() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.students.print_letters.${k}`, o);
  const toast = useToast();
  const { campusId, campus } = useCampus();
  const ctx = usePrintContext();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyKey, setBodyKey] = useState(0);
  const insertRef = useRef<(content: string) => void>(() => {});
  const [size, setSize] = useState<Size>('normal');
  const [step, setStep] = useState<'write' | 'students'>('write');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  // Teachers (web: /teacher/students/print-letters): their own students; the details endpoint is admin-only, so the list fills the letters.
  const role = useRoleBase();
  const mine = useTeacherStudents(role.isTeacher);

  function fill(text: string, s: StudentPrintInfo, asHtml = false) {
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const values: Record<string, string> = {
      __FULL_NAME__: fullName(s.profile), __FIRST_NAME__: s.profile.first_name ?? '', __FATHER_NAME__: s.profile.father_name ?? '',
      __GRANDFATHER_NAME__: s.profile.grandfather_name ?? '', __LAST_NAME__: s.profile.last_name ?? '', __STUDENT_ID__: s.student_number ?? '',
      __GRADE_LEVEL__: s.academic.grade_level ?? '', __SECTION__: s.academic.section ?? '', __CAMPUS__: campus?.name ?? ctx.school.name,
      __EMAIL__: s.profile.email ?? '', __PHONE__: s.profile.phone ?? '', __DATE__: date,
    };
    // `text` is the letter's HTML (rich editor, like the web) or a plain title: escape a title, then put the (escaped) values in.
    let html = asHtml ? text : escapeHtml(text);
    for (const [k, v] of Object.entries(values)) html = html.split(k).join(escapeHtml(v));
    return html;
  }

  async function run(mode: 'print' | 'pdf') {
    if (selected.size === 0) return toast.error(t('app.pr_pick_students'));
    setBusy(mode);
    try {
      let list: StudentPrintInfo[];
      if (role.isTeacher) {
        list = (mine.data ?? [])
          .filter((x) => selected.has(x.id))
          .map((x) => ({
            id: x.id,
            student_number: x.student_number,
            profile: { first_name: x.profile?.first_name ?? '', father_name: '', grandfather_name: '', last_name: x.profile?.last_name ?? '', email: x.profile?.email ?? '', phone: x.profile?.phone ?? '', profile_photo_url: null, is_active: true },
            academic: { grade_level: x.grade_level ?? '', section: x.section?.name ?? '', admission_date: '' },
            medical_info: {},
            custom_fields: {},
            parent_links: [],
            created_at: '',
          }));
      } else {
        const res = await adminStudents.printInfo(campusId, [...selected], ['personal', 'academic']);
        if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
        list = res.data.students;
      }
      const pages = list.map(
        (s) => `<div dir="auto" style="font-size:${SIZES[size]}px;line-height:1.7">${title ? `<h2 style="margin:8px 0 16px;font-size:${SIZES[size] + 6}px">${fill(title, s)}</h2>` : ''}${fill(body, s, true)}</div>`,
      );
      const html = buildPrintHtml({ title: title || p('title'), pages, school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, reportLabel: p('title') });
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `letters-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  }

  if (step === 'write') {
    return (
      <>
        <Stack.Screen options={{ title: p('title') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text variant="muted">{p('subtitle')}</Text>
          <View className="gap-1.5">
            <Label nativeID="ltitle">{t('app.pr_letter_title')}</Label>
            <Input aria-labelledby="ltitle" value={title} onChangeText={setTitle} />
          </View>
          <View className="gap-1.5">
            <Label nativeID="lbody">{p('letter_editor')}</Label>
            <LetterTemplatePicker
              context="print_letters"
              onLoad={(html) => {
                setBody(html);
                setBodyKey((k) => k + 1);
              }}
              getContent={() => body}
            />
            <RichTextField key={bodyKey} value={body} onChange={setBody} placeholder={p('letter_editor_desc')} campusId={campus?.id} minHeight={260} insertRef={(fn) => (insertRef.current = fn)} />
            <Text className="text-muted-foreground text-xs">{p('insert_field')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {PLACEHOLDERS.map((k) => (
                <Pressable key={k} onPress={() => insertRef.current(k)} className="border-border rounded-full border px-3 py-1.5" accessibilityRole="button">
                  <Text className="font-mono text-xs">{k}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View className="gap-1.5">
            <Label>{p('font_size_placeholder')}</Label>
            <FilterChips<Size> value={size} onChange={setSize} options={(Object.keys(SIZES) as Size[]).map((k) => ({ value: k, label: p(`size_${k}`) }))} />
          </View>
          <Button onPress={() => (htmlToText(body).trim() ? setStep('students') : toast.error(t('app.pr_write_letter')))}>
            <Text>{p('select_students')}</Text>
          </Button>
        </ScrollView>
      </>
    );
  }

  const footer = (
          <View className="border-border gap-2 border-t p-4">
            <Text className="text-muted-foreground text-center text-xs">{p('selected_count', { count: selected.size })}</Text>
            <View className="flex-row gap-2">
              <Button variant="outline" onPress={() => setStep('write')}>
                <Text>{t('twoFa.back')}</Text>
              </Button>
              <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready}>
                <Icon as={FileDown} className="size-4" />
                <Text>{busy === 'pdf' ? p('generating_pdf') : 'PDF'}</Text>
              </Button>
              <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !ctx.ready}>
                <Icon as={Printer} className="text-primary-foreground size-4" />
                <Text>{p('print')}</Text>
              </Button>
            </View>
          </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: p('select_students') }} />
      {role.isTeacher ? (
        <View className="bg-background flex-1">
          <ScrollView contentContainerClassName="p-4">
            <StudentChecklist students={mine.data ?? []} loading={mine.isLoading} selected={selected} onChange={setSelected} countKey="common.found_students" />
          </ScrollView>
          {footer}
        </View>
      ) : (
      <PeoplePicker
        entity="student"
        campusId={campusId}
        selected={selected}
        onChange={setSelected}
        footer={footer}
      />
      )}
    </>
  );
}
