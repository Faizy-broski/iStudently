import type { GraduationPath } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Form = { id?: string; title: string; comment: string };

/** Graduation paths list (web: /admin/grades/graduation-paths). */
export default function GraduationPaths() {
  const { t } = useTranslation();
  const gp = (k: string, o?: Record<string, unknown>) => t(`app.gp_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();

  const paths = useApi(['admin', 'graduation-paths', campusId ?? 'school'], () => adminGrades.graduationPaths(campusId));
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(x?: GraduationPath) {
    setForm({ id: x?.id, title: x?.title ?? '', comment: x?.comment ?? '' });
  }

  async function save() {
    if (!form?.title.trim()) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = form.id
      ? await adminGrades.updateGraduationPath(form.id, { title: form.title.trim(), comment: form.comment.trim() || undefined })
      : await adminGrades.createGraduationPath({ title: form.title.trim(), comment: form.comment.trim() || undefined, campus_id: campusId ?? undefined });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.saved'));
    toast.success(t('app.saved'));
    setForm(null);
    paths.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('school.grades_module.graduation_paths.title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => edit()} accessibilityLabel={gp('new_path')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={paths.data}
          error={paths.error}
          isLoading={paths.isLoading}
          isRefreshing={paths.isValidating && !paths.isLoading}
          onRefresh={() => paths.mutate()}
          emptyTitle={gp('no_paths')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <Pressable
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/admin/grades/graduation-paths/[id]', params: { id: x.id } })}>
              <View className="flex-1">
                <Text className="text-sm font-semibold">{x.title}</Text>
                <Text className="text-muted-foreground text-xs">
                  {[
                    gp('grade_levels_count', { count: x.grade_levels?.length ?? 0 }),
                    gp('subjects_count', { count: x.subjects?.length ?? 0 }),
                    gp('students_count', { count: x.student_count ?? 0 }),
                  ].join(' · ')}
                </Text>
                {x.comment ? <Text className="text-muted-foreground text-xs mt-0.5">{x.comment}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel={t('app.bl_delete')}
                onPress={async () => {
                  if (!(await confirm({ title: t('app.bl_delete'), body: x.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                  const res = await adminGrades.deleteGraduationPath(x.id);
                  if (!res.success) return toast.error(res.error || t('app.bl_delete'));
                  paths.mutate();
                }} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
              <Icon as={ChevronRight} className="text-muted-foreground size-4" />
            </Pressable>
          )}
        />
      </View>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? form.title : gp('new_path')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-2">
              <Label>{t('school.grades_module.graduation_paths.th_title')}</Label>
              <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              <Label>{t('school.grades_module.graduation_paths.th_comment')}</Label>
              <Input value={form.comment} onChangeText={(v) => setForm({ ...form, comment: v })} multiline numberOfLines={3} />
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={save} disabled={busy}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
