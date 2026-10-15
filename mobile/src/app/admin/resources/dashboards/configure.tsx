import type { DashboardElement } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

type Form = { url: string; title: string; sort_order: string; width_percent: string; height_px: string; refresh_minutes: string; custom_css: string };
const EMPTY: Form = { url: '', title: '', sort_order: '', width_percent: '100', height_px: '400', refresh_minutes: '', custom_css: '' };
const toForm = (e: DashboardElement): Form => ({
  url: e.url,
  title: e.title ?? '',
  sort_order: e.sort_order == null ? '' : String(e.sort_order),
  width_percent: String(e.width_percent ?? 100),
  height_px: String(e.height_px ?? 400),
  refresh_minutes: e.refresh_minutes == null ? '' : String(e.refresh_minutes),
  custom_css: e.custom_css ?? '',
});

function Fields({ value, onChange }: { value: Form; onChange: (p: Partial<Form>) => void }) {
  const { t } = useTranslation();
  const num = (k: keyof Form, label: string) => (
    <View className="min-w-[30%] flex-1 gap-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value[k]} onChangeText={(v) => onChange({ [k]: v })} keyboardType="number-pad" />
    </View>
  );
  return (
    <View className="gap-2">
      <View className="gap-1">
        <Label className="text-xs">URL *</Label>
        <Input value={value.url} onChangeText={(v) => onChange({ url: v })} autoCapitalize="none" placeholder="/admin/attendance  ·  https://…" />
      </View>
      <View className="gap-1">
        <Label className="text-xs">{t('app.rd_title')}</Label>
        <Input value={value.title} onChangeText={(v) => onChange({ title: v })} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {num('sort_order', t('app.rd_order'))}
        {num('width_percent', t('app.rd_width'))}
        {num('height_px', t('app.rd_height'))}
        {num('refresh_minutes', t('app.rd_refresh'))}
      </View>
      <View className="gap-1">
        <Label className="text-xs">{t('app.rd_css')}</Label>
        <Textarea value={value.custom_css} onChangeText={(v) => onChange({ custom_css: v })} className="font-mono text-xs" autoCapitalize="none" />
      </View>
    </View>
  );
}

/** Add, edit and remove a dashboard's elements (web: /admin/resources/dashboards/[id]/configure). */
export default function DashboardConfigure() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['admin', 'resource-dashboard', id] : null, ([, , did]) => adminResources.dashboard(did as string));
  const [form, setForm] = useState<Form>(EMPTY);
  const [edits, setEdits] = useState<Record<string, Partial<Form>>>({});
  const [busy, setBusy] = useState(false);

  const dash = res.data;
  const elements = [...(dash?.elements ?? dash?.dashboard_elements ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const int = (v: string) => (v.trim() ? parseInt(v, 10) : null);

  async function add() {
    if (!id || !form.url.trim()) return toast.error(t('app.rd_url_required'));
    setBusy(true);
    try {
      const r = await adminResources.addElement(id, {
        url: form.url.trim(),
        title: form.title.trim() || undefined,
        sort_order: int(form.sort_order) ?? undefined,
        width_percent: int(form.width_percent) || 100,
        height_px: int(form.height_px) || 400,
        refresh_minutes: int(form.refresh_minutes) ?? undefined,
        custom_css: form.custom_css.trim() || undefined,
      });
      if (!r.success) return toast.error(r.error || t('app.rd_add_failed'));
      toast.success(t('app.rd_added'));
      setForm(EMPTY);
      res.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!id) return;
    setBusy(true);
    try {
      for (const el of elements) {
        const e = edits[el.id];
        if (!e || !Object.keys(e).length) continue;
        const body: Record<string, unknown> = {};
        if (e.url !== undefined) body.url = e.url;
        if (e.title !== undefined) body.title = e.title;
        if (e.sort_order !== undefined) body.sort_order = int(e.sort_order);
        if (e.width_percent !== undefined) body.width_percent = int(e.width_percent) || 100;
        if (e.height_px !== undefined) body.height_px = int(e.height_px) || 400;
        if (e.refresh_minutes !== undefined) body.refresh_minutes = int(e.refresh_minutes);
        if (e.custom_css !== undefined) body.custom_css = e.custom_css || null;
        const r = await adminResources.updateElement(id, el.id, body);
        if (!r.success) return toast.error(r.error || t('app.rd_update_failed'));
      }
      toast.success(t('app.rd_updated'));
      setEdits({});
      res.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function remove(el: DashboardElement) {
    if (!id || !(await confirm({ title: t('app.rd_delete_element'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminResources.deleteElement(id, el.id);
    if (!r.success) return toast.error(r.error || t('app.rd_delete_failed'));
    toast.success(t('app.rd_deleted'));
    res.mutate();
  }

  if (res.isLoading) return <LoadingList />;
  const dirty = Object.keys(edits).length > 0;

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: `${dash?.title ?? ''} — ${t('app.rd_configuration')}` }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <View className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/30">
          <Text className="text-sm text-blue-800 dark:text-blue-300">{t('app.rd_note')}</Text>
        </View>
        <Text className="font-semibold">{t('app.rd_elements_found', { count: elements.length })}</Text>
        {elements.map((el) => (
          <Card key={el.id}>
            <CardContent className="gap-2 pt-4">
              <Fields value={{ ...toForm(el), ...edits[el.id] }} onChange={(p) => setEdits((prev) => ({ ...prev, [el.id]: { ...prev[el.id], ...p } }))} />
              <Button size="sm" variant="ghost" className="self-end" onPress={() => remove(el)}>
                <Icon as={Trash2} className="text-destructive size-4" />
                <Text className="text-destructive">{t('common.delete')}</Text>
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{t('app.rd_new_element')}</Text>
            <Fields value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
            <Button onPress={add} disabled={busy || !form.url.trim()}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{t('app.rd_add')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
      {dirty ? (
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
          <Button onPress={saveAll} disabled={busy}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{t('app.rd_save_all')}</Text>
          </Button>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
