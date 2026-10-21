import type { GradingScaleGrade } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, WandSparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type RowForm = { id?: string; title: string; break_off: string; gpa_value: string; sort_order: string; comment: string };
type GenForm = { min: string; max: string; step: string; sep: '.' | ',' };
const decimal = (v: string) => v.replace(/[^0-9.]/g, '');

/** Grades of one scale (title, break-off %, GPA): add / edit / delete, or generate a numeric scale. */
export default function ScaleGrades() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.grading_scales.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scale = useApi(['admin', 'grading-scale', id], ([, , sid]) => adminGrades.scale(sid as string));
  const rows = useApi(['admin', 'grading-scale-grades', id], ([, , sid]) => adminGrades.scaleGrades(sid as string));
  const [form, setForm] = useState<RowForm | null>(null);
  const [gen, setGen] = useState<GenForm | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<RowForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const sorted = [...(rows.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || b.break_off - a.break_off);

  function edit(x?: GradingScaleGrade) {
    setForm({
      id: x?.id,
      title: x?.title ?? '',
      break_off: x ? String(x.break_off) : '',
      gpa_value: x ? String(x.gpa_value) : '',
      sort_order: String(x?.sort_order ?? sorted.length + 1),
      comment: x?.comment ?? '',
    });
  }

  async function save() {
    if (!form) return;
    if (!form.title.trim() || form.break_off === '' || form.gpa_value === '') return toast.error(t('fees.structures.fillRequired'));
    const input = { title: form.title.trim(), break_off: Number(form.break_off), gpa_value: Number(form.gpa_value), sort_order: parseInt(form.sort_order, 10) || 0, comment: form.comment.trim() || null };
    setBusy(true);
    const res = form.id ? await adminGrades.updateScaleGrade(id, form.id, input) : await adminGrades.createScaleGrade(id, input);
    setBusy(false);
    if (!res.success) return toast.error(res.error || s('toast_save_failed'));
    toast.success(s('toast_grades_saved'));
    setForm(null);
    rows.mutate();
  }

  async function generate() {
    if (!gen) return;
    const [min, max, step] = [Number(gen.min), Number(gen.max), Number(gen.step)];
    if (!(max > min)) return toast.error(s('toast_max_gt_min'));
    if (!(step > 0)) return toast.error(t('fees.structures.fillRequired'));
    if (!(await confirm({ title: s('generate_scale'), body: s('confirm_generate_replace', { min, max, step }), destructive: true, confirmLabel: s('generate') }))) return;
    setBusy(true);
    const res = await adminGrades.generateScaleGrades(id, { grade_min: min, grade_max: max, grade_step: step, decimal_separator: gen.sep });
    setBusy(false);
    if (!res.success) return toast.error(res.error || s('toast_generation_failed'));
    toast.success(s('toast_generated_success'));
    setGen(null);
    rows.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: scale.data?.title ?? s('title'),
          headerRight: () => (
            <View className="flex-row">
              <Button size="sm" variant="ghost" onPress={() => setGen({ min: '0', max: '10', step: '1', sep: '.' })} accessibilityLabel={s('generate_scale')}>
                <Icon as={WandSparkles} className="size-5" />
              </Button>
              <Button size="sm" variant="ghost" onPress={() => edit()} accessibilityLabel={t('app.gr_new_grade')}>
                <Icon as={Plus} className="size-5" />
              </Button>
            </View>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={rows.data ? sorted : undefined}
          error={rows.error}
          isLoading={rows.isLoading}
          isRefreshing={rows.isValidating && !rows.isLoading}
          onRefresh={() => rows.mutate()}
          emptyTitle={t('app.gr_scale_rows', { count: 0 })}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <Pressable className="flex-row items-center gap-3 px-4 py-3" accessibilityRole="button" onPress={() => edit(x)}>
              <Text className="w-14 text-lg font-bold">{x.title}</Text>
              <View className="flex-1">
                <Text className="text-sm">{`≥ ${x.break_off}% · ${s('th_gpa')} ${x.gpa_value}`}</Text>
                {x.comment ? <Text className="text-muted-foreground text-xs">{x.comment}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel={t('app.bl_delete')}
                onPress={async () => {
                  if (!(await confirm({ title: t('app.bl_delete'), body: x.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                  const res = await adminGrades.deleteScaleGrade(id, x.id);
                  if (!res.success) return toast.error(res.error || s('toast_save_failed'));
                  rows.mutate();
                }} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </Pressable>
          )}
        />
      </View>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? form.title : t('app.gr_new_grade')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-2">
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{s('th_title')}</Label>
                  <Input value={form.title} onChangeText={(v) => set({ title: v })} placeholder={s('placeholder_letter')} />
                </View>
                <View className="w-20 gap-1.5">
                  <Label>{s('th_sort')}</Label>
                  <Input value={form.sort_order} onChangeText={(v) => set({ sort_order: v.replace(/\D/g, '') })} keyboardType="number-pad" />
                </View>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{s('th_break_off')}</Label>
                  <Input value={form.break_off} onChangeText={(v) => set({ break_off: decimal(v) })} keyboardType="decimal-pad" placeholder={s('placeholder_min')} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{s('th_gpa')}</Label>
                  <Input value={form.gpa_value} onChangeText={(v) => set({ gpa_value: decimal(v) })} keyboardType="decimal-pad" placeholder={s('placeholder_gpa')} />
                </View>
              </View>
              <Label>{s('th_comment')}</Label>
              <Input value={form.comment} onChangeText={(v) => set({ comment: v })} placeholder={s('placeholder_title')} />
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={save} disabled={busy}>
              <Text>{s('save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gen} onOpenChange={(o) => !o && setGen(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{s('generate_scale')}</DialogTitle>
          </DialogHeader>
          {gen ? (
            <View className="gap-2">
              <Text className="text-muted-foreground text-xs">{s('generate_help')}</Text>
              <View className="flex-row gap-2">
                {(['min', 'max', 'step'] as const).map((k) => (
                  <View key={k} className="flex-1 gap-1.5">
                    <Label>{s(`generate_${k}`)}</Label>
                    <Input value={gen[k]} onChangeText={(v) => setGen({ ...gen, [k]: decimal(v) })} keyboardType="decimal-pad" />
                  </View>
                ))}
              </View>
              <Label>{s('generate_decimal')}</Label>
              <FilterChips<'.' | ','>
                value={gen.sep}
                onChange={(v) => setGen({ ...gen, sep: v })}
                options={[
                  { value: '.', label: '1.5' },
                  { value: ',', label: '1,5' },
                ]}
              />
              <Text className="text-warning text-xs">{s('generate_warning')}</Text>
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="destructive" onPress={generate} disabled={busy}>
              <Text>{s('generate')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
