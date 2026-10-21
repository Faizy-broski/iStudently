import { router, Stack } from 'expo-router';
import { BookOpen, Globe, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Reading texts of the selected campus, filtered by grade (web: /admin/speed-reading/texts). */
export default function SpeedReadingTexts() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const { campusId } = useCampus();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? undefined) : undefined;
  const scope = campusId ?? schoolId;
  const texts = useApi(scope ? ['admin', 'sr-texts', scope] : null, ([, , sc]) => adminSpeedReading.texts(schoolId, sc as string));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [grade, setGrade] = useState('all');

  async function remove(id: string) {
    if (!(await confirm({ title: s('deleteText'), body: s('deleteTextConfirm'), destructive: true, confirmLabel: s('deleteText') }))) return;
    const r = await adminSpeedReading.deleteText(id);
    if (!r.success) return toast.error(r.error || s('errSave'));
    texts.mutate();
  }

  const list = (texts.data ?? []).filter((x) => grade === 'all' || x.grade_level_id === grade);
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: s('manageTexts'),
          headerRight: () => (
            <Pressable onPress={() => router.push('/admin/speed-reading/texts/form')} hitSlop={8} className="p-1" accessibilityLabel={s('addText')}>
              <Icon as={Plus} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => texts.mutate()} />}>
        <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: s('allGradeLevels') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
        {texts.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState
            icon={BookOpen}
            title={grade !== 'all' ? s('noTextsForGrade') : s('noTexts')}
            actionLabel={grade === 'all' ? s('addText') : undefined}
            onAction={grade === 'all' ? () => router.push('/admin/speed-reading/texts/form') : undefined}
          />
        ) : (
          list.map((x) => (
            <Card key={x.id}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-start gap-2">
                  <Text className="flex-1 font-semibold">{x.title}</Text>
                  <Pressable onPress={() => router.push({ pathname: '/admin/speed-reading/texts/form', params: { id: x.id } })} accessibilityLabel={t('app.sr_edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(x.id)} accessibilityLabel={s('deleteText')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  {x.grade_level_name ? (
                    <Badge variant="secondary">
                      <Text className="text-xs">{x.grade_level_name}</Text>
                    </Badge>
                  ) : null}
                  <Badge variant="outline">
                    <Icon as={Globe} className="text-muted-foreground size-3" />
                    <Text className="text-xs">{x.language === 'ar' ? s('languageAr') : s('languageEn')}</Text>
                  </Badge>
                  <Text className="text-muted-foreground text-xs">
                    {x.word_count} {s('words')}
                    {x.quiz_questions?.length ? ` · ${x.quiz_questions.length} Q` : ''}
                  </Text>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
