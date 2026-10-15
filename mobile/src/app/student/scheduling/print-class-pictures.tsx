import type { ClassPicturesData } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { AlertCircle, Camera, Printer, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';

type Cp = ClassPicturesData['course_periods'][number];

function PhotoCard({ name, url, self, teacher, teacherLabel }: { name: string; url: string | null; self?: boolean; teacher?: boolean; teacherLabel: string }) {
  return (
    <View className="w-20 items-center gap-1">
      <View className={cn('bg-muted h-24 w-20 items-center justify-center overflow-hidden rounded border', self ? 'border-primary border-2' : 'border-border')}>
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon as={User} className="text-muted-foreground size-8" />}
      </View>
      {teacher ? <Text className="text-[10px] font-bold text-amber-600 uppercase">{teacherLabel}</Text> : null}
      <Text className="text-center text-xs leading-tight font-medium">{name}</Text>
    </View>
  );
}

/** Classmates' photos per course period, optionally with the teacher, printable (web: /student/scheduling/print-class-pictures). */
export default function StudentClassPictures() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_cp_${key}`, o);
  const toast = useToast();
  const { campus } = useCampus();
  const data = useApi(['student', 'class-pictures'], () => student.getStudentClassPictures());
  const [cpId, setCpId] = useState('all');
  const [withTeacher, setWithTeacher] = useState(true);

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) {
    return (
      <View className="bg-background flex-1 p-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="flex-row items-center gap-3 p-4">
            <Icon as={AlertCircle} className="size-8 text-red-600" />
            <View className="flex-1">
              <Text className="font-semibold text-red-900 dark:text-red-200">{k('error')}</Text>
              <Text className="text-sm text-red-700 dark:text-red-300">{data.error.message}</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    );
  }
  const cps = data.data?.course_periods ?? [];
  const students = data.data?.students ?? [];
  const shown: Cp[] = cpId === 'all' ? cps : cps.filter((c) => c.id === cpId);
  const footer = (cp: Cp) => `${k('count', { count: students.length })}${withTeacher && cp.teacher_name ? k('plus_teacher') : ''}`;

  async function print() {
    const card = (name: string, url: string | null, extra = '') =>
      `<div style="width:84px;text-align:center;font-size:11px">${url ? `<img src="${escapeHtml(url)}" style="width:80px;height:96px;object-fit:cover;border:1px solid #ccc;border-radius:4px"/>` : '<div style="width:80px;height:96px;border:1px solid #ccc;border-radius:4px;background:#f3f3f3"></div>'}${extra}<div>${escapeHtml(name)}</div></div>`;
    const pages = shown.map(
      (cp) =>
        `<h2>${escapeHtml(cp.title || cp.course_title || '')}${cp.teacher_name ? ` — ${escapeHtml(cp.teacher_name)}` : ''}</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${
          withTeacher && cp.teacher_name ? card(cp.teacher_name, cp.teacher_photo_url, `<div style="color:#d97706;font-weight:700;font-size:9px">${escapeHtml(k('teacher').toUpperCase())}</div>`) : ''
        }${students.map((s) => card(s.name, s.photo_url)).join('')}</div><p style="color:#666;font-size:11px">${escapeHtml(footer(cp))}</p>`,
    );
    try {
      await printHtml(buildPrintHtml({ title: k('title'), school: { name: campus?.name ?? '' }, pages: pages.length ? pages : [`<p>${escapeHtml(k('empty'))}</p>`] }));
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1">
            {k('subtitle')}
          </Text>
          <Button variant="outline" onPress={print}>
            <Icon as={Printer} className="size-4" />
            <Text>{t('app.st_ps_print')}</Text>
          </Button>
        </View>
        <Picker value={cpId} onChange={setCpId} options={[{ value: 'all', label: k('all') }, ...cps.map((c) => ({ value: c.id, label: c.title || c.course_title || '' }))]} />
        <View className="flex-row items-center gap-3">
          <Switch checked={withTeacher} onCheckedChange={setWithTeacher} />
          <Text className="text-sm">{k('include_teacher')}</Text>
        </View>
        {students.length === 0 ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Camera} className="text-muted-foreground mb-3 size-12" />
              <Text className="mb-1 text-lg font-medium">{k('empty')}</Text>
              <Text className="text-muted-foreground text-sm">{k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          shown.map((cp) => (
            <Card key={cp.id}>
              <CardHeader className="flex-row flex-wrap items-center gap-2">
                <Icon as={Camera} className="size-5" />
                <CardTitle className="text-lg">{cp.title || cp.course_title}</CardTitle>
                {cp.teacher_name ? (
                  <Badge variant="outline">
                    <Text className="text-xs font-normal">{cp.teacher_name}</Text>
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                <View className="flex-row flex-wrap gap-4">
                  {withTeacher && cp.teacher_name ? <PhotoCard name={cp.teacher_name} url={cp.teacher_photo_url} teacher teacherLabel={k('teacher')} /> : null}
                  {students.map((s) => (
                    <PhotoCard key={s.id} name={s.name} url={s.photo_url} self={s.is_self} teacherLabel={k('teacher')} />
                  ))}
                </View>
                <Text className="text-muted-foreground mt-4 text-xs">{footer(cp)}</Text>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
