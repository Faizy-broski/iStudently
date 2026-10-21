import type { ClassPicturesData } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { AlertCircle, Camera, Printer, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { FilterChips } from '@/components/app/filter-chips';
import { HeaderButton, IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
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
      <View className={cn('bg-muted h-24 w-20 items-center justify-center overflow-hidden rounded-xl border', self ? 'border-brand-secondary border-2' : 'border-info-soft dark:border-border')}>
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon as={User} className="text-muted-foreground size-8" />}
      </View>
      {teacher ? <StatusChip label={teacherLabel} tone="warning" className="px-2 py-0.5" /> : null}
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
        <View className="border-destructive/30 bg-destructive-soft flex-row items-center gap-3 rounded-2xl border p-4">
          <Icon as={AlertCircle} className="text-destructive size-8" />
          <View className="flex-1">
            <Text className="text-destructive font-semibold">{k('error')}</Text>
            <Text className="text-destructive text-sm">{data.error.message}</Text>
          </View>
        </View>
      </View>
    );
  }
  const cps = data.data?.course_periods ?? [];
  const students = data.data?.students ?? [];
  const shown: Cp[] = cpId === 'all' ? cps : cps.filter((c) => c.id === cpId);
  const footer = (cp: Cp) => `${k('count', { count: students.length })}${withTeacher && cp.teacher_name ? k('plus_teacher') : ''}`;

  async function print() {
    const card = (name: string, url: string | null, extra = '') =>
      `<div style="width:84px;text-align:center;font-size:11px">${url ? `<img src="${escapeHtml(url)}" style="width:80px;height:96px;object-fit:cover;border:1px solid ${colors.printBorder};border-radius:4px"/>` : `<div style="width:80px;height:96px;border:1px solid ${colors.printBorder};border-radius:4px;background:${colors.printSurface}"></div>`}${extra}<div>${escapeHtml(name)}</div></div>`;
    const pages = shown.map(
      (cp) =>
        `<h2>${escapeHtml(cp.title || cp.course_title || '')}${cp.teacher_name ? ` — ${escapeHtml(cp.teacher_name)}` : ''}</h2><div style="display:flex;flex-wrap:wrap;gap:12px">${
          withTeacher && cp.teacher_name ? card(cp.teacher_name, cp.teacher_photo_url, `<div style="color:${colors.warning};font-weight:700;font-size:9px">${escapeHtml(k('teacher').toUpperCase())}</div>`) : ''
        }${students.map((s) => card(s.name, s.photo_url)).join('')}</div><p style="color:${colors.printMuted};font-size:11px">${escapeHtml(footer(cp))}</p>`,
    );
    try {
      await printHtml(buildPrintHtml({ title: k('title'), school: { name: campus?.name ?? '' }, pages: pages.length ? pages : [`<p>${escapeHtml(k('empty'))}</p>`] }));
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title'), headerRight: () => <HeaderButton icon={Printer} label={t('app.st_ps_print')} onPress={print} /> }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <FilterChips value={cpId} onChange={setCpId} options={[{ value: 'all', label: k('all') }, ...cps.map((c) => ({ value: c.id, label: c.title || c.course_title || '' }))]} />
        <Panel className="flex-row items-center gap-3 px-4 py-3">
          <Switch checked={withTeacher} onCheckedChange={setWithTeacher} />
          <Text className="flex-1 text-sm font-medium">{k('include_teacher')}</Text>
        </Panel>
        {students.length === 0 ? (
          <EmptyState icon={Camera} title={k('empty')} body={k('empty_body')} />
        ) : (
          shown.map((cp) => (
            <Panel key={cp.id} className="gap-4 p-4">
              <View className="flex-row items-center gap-3">
                <IconTile icon={Camera} size={40} />
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold">{cp.title || cp.course_title}</Text>
                  {cp.teacher_name ? <StatusChip label={cp.teacher_name} tone="info" className="self-start px-2 py-0.5" /> : null}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-4">
                {withTeacher && cp.teacher_name ? <PhotoCard name={cp.teacher_name} url={cp.teacher_photo_url} teacher teacherLabel={k('teacher')} /> : null}
                {students.map((s) => (
                  <PhotoCard key={s.id} name={s.name} url={s.photo_url} self={s.is_self} teacherLabel={k('teacher')} />
                ))}
              </View>
              <Text className="text-muted-foreground text-xs">{footer(cp)}</Text>
            </Panel>
          ))
        )}
      </ScrollView>
    </>
  );
}
