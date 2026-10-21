import type { GradingScale } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Form = { id?: string; title: string; sort_order: string; is_default: boolean; is_active: boolean; hhr: string; hr: string; hr_subject: string; comment: string };
const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Grading scales of the campus: add / edit / delete; tap to edit its grades (web: /admin/grades/grading-scales). */
export default function GradingScales() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.grading_scales.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const scales = useApi(['admin', 'grading-scales', campusId ?? 'school'], () => adminGrades.scales(campusId));
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  function edit(x?: GradingScale) {
    setForm({
      id: x?.id,
      title: x?.title ?? '',
      sort_order: String(x?.sort_order ?? (scales.data?.length ?? 0) + 1),
      is_default: x?.is_default ?? false,
      is_active: x?.is_active ?? true,
      hhr: x?.hhr_gpa_value != null ? String(x.hhr_gpa_value) : '',
      hr: x?.hr_gpa_value != null ? String(x.hr_gpa_value) : '',
      hr_subject: x?.hr_subject_gpa_value != null ? String(x.hr_subject_gpa_value) : '',
      comment: x?.comment ?? '',
    });
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim()) return toast.error(s('title_required'));
    const input = {
      title: form.title.trim(),
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_default: form.is_default,
      is_active: form.is_active,
      hhr_gpa_value: num(form.hhr),
      hr_gpa_value: num(form.hr),
      hr_subject_gpa_value: num(form.hr_subject),
      comment: form.comment.trim() || null,
    };
    setBusy(true);
    const res = form.id ? await adminGrades.updateScale(form.id, input) : await adminGrades.createScale({ ...input, campus_id: campusId ?? undefined });
    setBusy(false);
    if (!res.success) return toast.error(res.error || s('toast_save_failed'));
    toast.success(s('toast_scales_saved'));
    setForm(null);
    scales.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: s('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => edit()} accessibilityLabel={s('create_scale')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          header={<Text className="text-muted-foreground px-4 pt-4 pb-2 text-sm">{s('subtitle')}</Text>}
          items={scales.data}
          error={scales.error}
          isLoading={scales.isLoading}
          isRefreshing={scales.isValidating && !scales.isLoading}
          onRefresh={() => scales.mutate()}
          emptyTitle={s('no_scales')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <Pressable className="gap-1 px-4 py-3" accessibilityRole="button" onPress={() => router.push({ pathname: '/admin/grades/scales/[id]', params: { id: x.id } })}>
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-sm font-semibold">{x.title}</Text>
                {x.is_default ? (
                  <Badge>
                    <Text>{s('default_badge')}</Text>
                  </Badge>
                ) : null}
                {x.is_active === false ? (
                  <Badge variant="secondary">
                    <Text>{t('common.inactive')}</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="text-muted-foreground text-xs">
                {[
                  t('app.gr_scale_rows', { count: x.grades?.length ?? 0 }),
                  x.hhr_gpa_value != null ? `${s('hhr_gpa')} ${x.hhr_gpa_value}` : null,
                  x.hr_gpa_value != null ? `${s('hr_gpa')} ${x.hr_gpa_value}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <View className="flex-row gap-5 pt-1">
                <Pressable onPress={() => edit(x)} accessibilityLabel={t('app.bl_edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                  <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={t('app.bl_delete')}
                  onPress={async () => {
                    if ((x.grades?.length ?? 0) > 0) return toast.error(s('toast_cannot_delete_scale_with_grades'));
                    if (!(await confirm({ title: t('app.bl_delete'), body: x.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                    const res = await adminGrades.deleteScale(x.id);
                    if (!res.success) return toast.error(res.error || s('toast_save_failed'));
                    scales.mutate();
                  }}>
                  <Icon as={Trash2} className="text-muted-foreground size-4" />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      </View>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? form.title : s('create_scale')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-2">
              <Label>{s('scale_title')}</Label>
              <Input value={form.title} onChangeText={(v) => set({ title: v })} />
              <View className="flex-row items-center gap-3">
                <View className="w-24 gap-1.5">
                  <Label>{s('scale_sort')}</Label>
                  <Input value={form.sort_order} onChangeText={(v) => set({ sort_order: v.replace(/\D/g, '') })} keyboardType="number-pad" />
                </View>
                <View className="flex-1 flex-row items-center justify-between pt-5">
                  <Label>{s('scale_default')}</Label>
                  <Switch checked={form.is_default} onCheckedChange={(v) => set({ is_default: v })} />
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Label>{s('active')}</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
              </View>
              <Label>{s('hhr_gpa_label')}</Label>
              <Input value={form.hhr} onChangeText={(v) => set({ hhr: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              <Label>{s('hr_gpa_label')}</Label>
              <Input value={form.hr} onChangeText={(v) => set({ hr: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              <Label>{s('hr_subject_gpa_label')}</Label>
              <Input value={form.hr_subject} onChangeText={(v) => set({ hr_subject: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              <Label>{s('th_comment')}</Label>
              <Input value={form.comment} onChangeText={(v) => set({ comment: v })} />
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={save} disabled={busy}>
              <Text>{s('save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
