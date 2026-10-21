import type { EscalationStage, PerformanceAction, PerformanceActionType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, BarChart3, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { ESCALATIONS, EscalationPill } from '@/features/admin/performance';
import { adminPerformance } from '@/lib/api';
import { useApi } from '@/lib/data';

type Form = Partial<PerformanceAction>;
const EMPTY: Form = { action_name_ar: '', action_name_en: '', action_type: 'violation_demerit', escalation_stage: 'none', default_points: 0, default_fine: 0, is_active: true, sort_order: 0 };

/** Violations and rewards catalog: add, edit, activate, delete (web: /admin/performance/catalog). */
export default function PerformanceCatalog() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const list = useApi(['admin', 'performance-catalog', 'all'], () => adminPerformance.catalog());
  const [editing, setEditing] = useState<PerformanceAction | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = list.data ?? [];
  const violations = rows.filter((a) => a.action_type === 'violation_demerit');
  const rewards = rows.filter((a) => a.action_type === 'reward_redemption');

  async function save() {
    if (!form) return;
    if (!form.action_name_ar || !form.action_name_en || !form.action_type) return toast.error(p('names_required'));
    setSaving(true);
    try {
      const res = editing ? await adminPerformance.updateAction(editing.id, form) : await adminPerformance.createAction(form);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(editing ? p('action_updated') : p('action_created'));
      setForm(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: p('delete_action'), body: p('cannot_undo'), destructive: true }))) return;
    const res = await adminPerformance.deleteAction(id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(p('deleted'));
    list.mutate();
  }

  async function toggle(a: PerformanceAction) {
    const res = await adminPerformance.updateAction(a.id, { is_active: !a.is_active });
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    list.mutate();
  }

  const section = (title: string, icon: typeof AlertCircle, tone: string, items: PerformanceAction[], reward: boolean) => (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Icon as={icon} className={`size-5 ${tone}`} />
        <CardTitle className={tone}>{`${title} (${items.length})`}</CardTitle>
      </CardHeader>
      <CardContent className="gap-2">
        {!items.length ? <Text variant="muted" className="py-4 text-center text-sm">{reward ? p('no_rewards') : p('no_violations')}</Text> : null}
        {items.map((a) => (
          <View key={a.id} className="border-info-soft dark:border-border gap-1.5 rounded-xl border p-3">
            <View className="flex-row items-start gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold">{a.action_name_en}</Text>
                <Text className="text-muted-foreground text-sm" style={{ writingDirection: 'rtl' }}>
                  {a.action_name_ar}
                </Text>
              </View>
              <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} />
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              <EscalationPill stage={a.escalation_stage} />
              <Text className={reward ? 'font-semibold text-success' : 'font-semibold text-destructive'}>{`${reward ? '+' : ''}${a.default_points} pts`}</Text>
              <Text className="text-muted-foreground text-xs">{`${reward ? p('bonus') : p('fine')}: ${a.default_fine > 0 ? `${reward ? '+' : ''}${a.default_fine}` : '—'}`}</Text>
            </View>
            <View className="flex-row justify-end gap-4">
              <Pressable
                onPress={() => {
                  setEditing(a);
                  setForm({ ...a });
                }} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
              </Pressable>
              <Pressable onPress={() => remove(a.id)} hitSlop={8}>
                <Icon as={Trash2} className="size-4 text-destructive" />
              </Pressable>
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );

  const num = (v: string) => Number(v.replace(/[^0-9.-]/g, '')) || 0;

  return (
    <>
      <Stack.Screen options={{ title: p('catalog_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">{p('catalog_subtitle')}</Text>
        <Button
          onPress={() => {
            setEditing(null);
            setForm({ ...EMPTY });
          }}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{p('add_action')}</Text>
        </Button>
        {list.isLoading ? (
          <LoadingList rows={4} />
        ) : (
          <>
            {section(p('violations_title'), AlertCircle, 'text-destructive', violations, false)}
            {section(p('rewards_title'), BarChart3, 'text-success', rewards, true)}
          </>
        )}
      </ScrollView>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? p('edit_action') : p('add_action')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              <View className="gap-1.5">
                <Label>{`${p('arabic_name')} *`}</Label>
                <Input value={form.action_name_ar ?? ''} onChangeText={(v) => setForm({ ...form, action_name_ar: v })} placeholder="الاسم بالعربية" style={{ writingDirection: 'rtl', textAlign: 'right' }} />
              </View>
              <View className="gap-1.5">
                <Label>{`${p('english_name')} *`}</Label>
                <Input value={form.action_name_en ?? ''} onChangeText={(v) => setForm({ ...form, action_name_en: v })} placeholder={p('english_name_placeholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{`${p('type')} *`}</Label>
                <Picker
                  value={form.action_type ?? 'violation_demerit'}
                  onChange={(v) => setForm({ ...form, action_type: v as PerformanceActionType })}
                  options={[
                    { value: 'violation_demerit', label: p('violation_demerit') },
                    { value: 'reward_redemption', label: p('reward_redemption') },
                  ]}
                />
              </View>
              <View className="gap-1.5">
                <Label>{p('escalation_stage')}</Label>
                <Picker value={form.escalation_stage ?? 'none'} onChange={(v) => setForm({ ...form, escalation_stage: v as EscalationStage })} options={ESCALATIONS.map((e) => ({ value: e, label: p(`esc_${e}`) }))} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{p('default_points_label')}</Label>
                  <Input value={String(form.default_points ?? 0)} onChangeText={(v) => setForm({ ...form, default_points: num(v) })} keyboardType="numbers-and-punctuation" />
                  <Text className="text-muted-foreground text-xs">{p('negative_hint')}</Text>
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{p('default_fine_label')}</Label>
                  <Input value={String(form.default_fine ?? 0)} onChangeText={(v) => setForm({ ...form, default_fine: num(v) })} keyboardType="decimal-pad" />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{p('sort_order')}</Label>
                <Input className="w-24" value={String(form.sort_order ?? 0)} onChangeText={(v) => setForm({ ...form, sort_order: num(v) })} keyboardType="number-pad" />
              </View>
              <View className="flex-row items-center gap-3">
                <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{p('active')}</Label>
              </View>
            </ScrollView>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setForm(null)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{editing ? p('save_changes') : p('create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
