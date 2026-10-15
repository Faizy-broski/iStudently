import type { RubricCategory, RubricCriterion } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, Layers, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Rubric builder: categories with weights and their criteria (web: /admin/inspections/rubrics). */
export default function InspectionRubrics() {
  const { t } = useTranslation();
  const r = (k: string) => t(`inspections.rubrics.${k}`);
  const toast = useToast();
  const rubric = useApi(['admin', 'inspection-rubric'], () => adminInspections.activeRubric());
  const tpl = rubric.data ?? null;
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<{ editing: RubricCategory | null; name: string; weight: string } | null>(null);
  const [crit, setCrit] = useState<{ categoryId: string; editing: RubricCriterion | null; name: string; description: string } | null>(null);

  async function run(p: Promise<{ success: boolean; error?: string }>, okKey: string, after?: () => void) {
    setBusy(true);
    try {
      const res = await p;
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(r(okKey));
      after?.();
      rubric.mutate();
    } finally {
      setBusy(false);
    }
  }

  if (rubric.isLoading) return <LoadingList rows={4} />;

  if (!tpl) {
    return (
      <>
        <Stack.Screen options={{ title: r('no_rubric_title') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="p-4">
          <Card>
            <CardHeader>
              <CardTitle>{r('no_rubric_title')}</CardTitle>
              <CardDescription>{r('no_rubric_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onPress={() => run(adminInspections.ensureDefaultRubric(), 'msg_default_created')} disabled={busy}>
                <Icon as={Sparkles} className="text-primary-foreground size-4" />
                <Text>{r('btn_create_default')}</Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </>
    );
  }

  const total = tpl.categories.reduce((s, c) => s + Number(c.weight), 0);

  function saveCategory() {
    if (!cat || !tpl || !cat.name.trim()) return;
    const weight = cat.weight.trim() ? Number(cat.weight) : 0;
    run(cat.editing ? adminInspections.updateRubricCategory(cat.editing.id, { name: cat.name.trim(), weight }) : adminInspections.createRubricCategory(tpl.id, { name: cat.name.trim(), weight, sort_order: tpl.categories.length }), 'msg_category_saved', () => setCat(null));
  }

  function saveCriterion() {
    if (!crit || !crit.name.trim()) return;
    const category = tpl?.categories.find((c) => c.id === crit.categoryId);
    run(
      crit.editing
        ? adminInspections.updateCriterion(crit.editing.id, { name: crit.name.trim(), description: crit.description.trim() || undefined })
        : adminInspections.createCriterion(crit.categoryId, { name: crit.name.trim(), description: crit.description.trim() || undefined, sort_order: category?.criteria.length ?? 0 }),
      'msg_criterion_saved',
      () => setCrit(null),
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: tpl.name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-muted-foreground text-xs">{`${r('total_weight_label')}:`}</Text>
            <Badge variant={total === 100 ? 'secondary' : 'outline'} className={total !== 100 ? 'border-amber-300' : undefined}>
              <Text className={total !== 100 ? 'text-amber-700' : undefined}>{`${total}%`}</Text>
            </Badge>
            {total !== 100 ? (
              <View className="flex-row items-center gap-1">
                <Icon as={AlertTriangle} className="size-3 text-amber-700" />
                <Text className="text-xs text-amber-700">{r('weight_warning')}</Text>
              </View>
            ) : null}
          </View>
          <Button size="sm" className="self-start" onPress={() => setCat({ editing: null, name: '', weight: '' })}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{r('btn_add_category')}</Text>
          </Button>
        </View>
        {!tpl.categories.length ? <Text variant="muted" className="py-8 text-center text-sm">{r('no_categories')}</Text> : null}
        {tpl.categories.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-row items-center gap-2">
              <Icon as={Layers} className="size-4 text-[#022172]" />
              <CardTitle className="flex-1">{c.name}</CardTitle>
              <Badge variant="outline">
                <Text className="text-[10px]">{`${c.weight}%`}</Text>
              </Badge>
              <Pressable onPress={() => setCat({ editing: c, name: c.name, weight: String(c.weight) })} hitSlop={8}>
                <Icon as={Pencil} className="text-muted-foreground size-4" />
              </Pressable>
              <Pressable onPress={() => run(adminInspections.deleteRubricCategory(c.id), 'msg_category_deleted')} hitSlop={8}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </CardHeader>
            <CardContent className="gap-2">
              {!c.criteria.length ? <Text className="text-muted-foreground text-xs">{r('no_criteria')}</Text> : null}
              {c.criteria.map((cr) => (
                <View key={cr.id} className="border-border flex-row items-center gap-2 rounded-md border px-3 py-2">
                  <Text className="flex-1 text-sm">{cr.name}</Text>
                  <Pressable onPress={() => setCrit({ categoryId: c.id, editing: cr, name: cr.name, description: cr.description ?? '' })} hitSlop={8}>
                    <Icon as={Pencil} className="text-muted-foreground size-3.5" />
                  </Pressable>
                  <Pressable onPress={() => run(adminInspections.deleteCriterion(cr.id), 'msg_criterion_deleted')} hitSlop={8}>
                    <Icon as={Trash2} className="text-destructive size-3.5" />
                  </Pressable>
                </View>
              ))}
              <Button size="sm" variant="outline" className="self-start" onPress={() => setCrit({ categoryId: c.id, editing: null, name: '', description: '' })}>
                <Icon as={Plus} className="text-foreground size-3.5" />
                <Text>{r('btn_add_criterion')}</Text>
              </Button>
            </CardContent>
          </Card>
        ))}
      </ScrollView>

      <Dialog open={!!cat} onOpenChange={(o) => !o && setCat(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{cat?.editing ? r('dialog_edit_category') : r('dialog_new_category')}</DialogTitle>
          </DialogHeader>
          {cat ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{r('field_name')}</Label>
                <Input value={cat.name} onChangeText={(v) => setCat({ ...cat, name: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{r('field_weight')}</Label>
                <Input value={cat.weight} onChangeText={(v) => setCat({ ...cat, weight: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={saveCategory} disabled={busy || !cat?.name.trim()}>
              <Text>{r('btn_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!crit} onOpenChange={(o) => !o && setCrit(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{crit?.editing ? r('dialog_edit_criterion') : r('dialog_new_criterion')}</DialogTitle>
          </DialogHeader>
          {crit ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{r('field_name')}</Label>
                <Input value={crit.name} onChangeText={(v) => setCrit({ ...crit, name: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{r('field_description')}</Label>
                <Textarea value={crit.description} onChangeText={(v) => setCrit({ ...crit, description: v })} />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={saveCriterion} disabled={busy || !crit?.name.trim()}>
              <Text>{r('btn_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
