import type { AdminActivity } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAc } from '@/features/admin/activities';
import { useCampus } from '@/features/campus/campus';
import { adminActivities } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Form = { title: string; start_date: string; end_date: string; comment: string };

function ActivityForm({ initial, submitLabel, saving, onSubmit, onCancel }: { initial: Form; submitLabel: string; saving: boolean; onSubmit: (f: Form) => void; onCancel: () => void }) {
  const a = useAc();
  const { t } = useTranslation();
  const [f, setF] = useState(initial);
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>
          {a('titleField')} <Text className="text-destructive">*</Text>
        </Label>
        <Input value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder={a('titlePlaceholder')} />
      </View>
      <View className="flex-row gap-2">
        <DateField className="flex-1" label={a('startDate')} value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} clearable />
        <DateField className="flex-1" label={a('endDate')} value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} clearable min={f.start_date || undefined} />
      </View>
      <View className="gap-1.5">
        <Label>{a('comment')}</Label>
        <Input value={f.comment} onChangeText={(v) => setF({ ...f, comment: v })} placeholder={a('commentPlaceholder')} multiline className="min-h-20" textAlignVertical="top" />
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onCancel} disabled={saving}>
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button className="flex-1" onPress={() => onSubmit(f)} disabled={saving}>
          <Text>{submitLabel}</Text>
        </Button>
      </View>
    </View>
  );
}

/** Add, edit, enable/disable and delete activities (web: /admin/activities/setup/activities). */
export default function ActivitiesSetup() {
  const a = useAc();
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'activities', campusId ?? 'school', 'all'], () => adminActivities.activities(campusId, true));
  const [mode, setMode] = useState<'none' | 'new' | AdminActivity>('none');
  const [saving, setSaving] = useState(false);
  const list = res.data ?? [];

  async function submit(f: Form) {
    if (!f.title.trim()) return toast.error(a('titleRequired'));
    const editing = typeof mode === 'object' ? mode : null;
    const input = { title: f.title.trim(), start_date: f.start_date || null, end_date: f.end_date || null, comment: f.comment || null };
    setSaving(true);
    try {
      const r = editing ? await adminActivities.updateActivity(editing.id, input) : await adminActivities.createActivity({ ...input, campus_id: campusId ?? null });
      if (!r.success) return toast.error(r.error || a(editing ? 'failedToUpdateActivity' : 'failedToCreateActivity'));
      toast.success(a(editing ? 'activityUpdated' : 'activityAdded'));
      setMode('none');
      res.mutate();
    } finally {
      setSaving(false);
    }
  }
  async function toggle(x: AdminActivity) {
    const r = await adminActivities.updateActivity(x.id, { is_active: !x.is_active });
    if (!r.success) return toast.error(r.error || a('failedToToggleActivity'));
    res.mutate();
  }
  async function remove(x: AdminActivity) {
    if (!(await confirm({ title: t('common.delete'), body: x.title, destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminActivities.deleteActivity(x.id);
    if (!r.success) return toast.error(r.error || a('failedToDeleteActivity'));
    toast.success(a('activityDeleted', { title: x.title }));
    res.mutate();
  }

  const editing = typeof mode === 'object' ? mode : null;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: a('title'),
          headerRight: () =>
            mode === 'none' ? (
              <Pressable onPress={() => setMode('new')} hitSlop={8} className="p-1" accessibilityLabel={a('addActivity')}>
                <Icon as={Plus} className="text-foreground size-6" />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
          <Text className="text-muted-foreground text-sm">{a('subtitle')}</Text>
          {mode !== 'none' ? (
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{editing ? a('editActivityDialogTitle') : a('addActivityDialogTitle')}</Text>
                <ActivityForm
                  key={editing?.id ?? 'new'}
                  initial={{ title: editing?.title ?? '', start_date: editing?.start_date ?? '', end_date: editing?.end_date ?? '', comment: editing?.comment ?? '' }}
                  submitLabel={editing ? a('saveChanges') : a('addActivity')}
                  saving={saving}
                  onSubmit={submit}
                  onCancel={() => setMode('none')}
                />
              </CardContent>
            </Card>
          ) : null}
          {res.isLoading ? (
            <LoadingList rows={4} />
          ) : res.error ? (
            <ErrorState message={res.error.message || a('failedToLoadActivities')} onRetry={() => res.mutate()} />
          ) : !list.length ? (
            <Text className="text-muted-foreground py-8 text-center text-sm">{a('noActivitiesConfigured')}</Text>
          ) : (
            list.map((x) => (
              <Card key={x.id} className={cn(!x.is_active && 'opacity-60')}>
                <CardContent className="flex-row items-center gap-2 py-3">
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-medium">{x.title}</Text>
                      {!x.is_active ? (
                        <View className="bg-muted rounded-full px-2 py-0.5">
                          <Text className="text-muted-foreground text-xs">{t('common.inactive')}</Text>
                        </View>
                      ) : null}
                    </View>
                    {x.start_date || x.end_date ? (
                      <Text className="text-muted-foreground text-xs">
                        {x.start_date ?? '-'} - {x.end_date ?? '-'}
                      </Text>
                    ) : null}
                    {x.comment ? (
                      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                        {x.comment}
                      </Text>
                    ) : null}
                  </View>
                  <Button size="sm" variant="ghost" onPress={() => toggle(x)}>
                    <Text className="text-xs">{x.is_active ? a('disable') : a('enable')}</Text>
                  </Button>
                  <Pressable onPress={() => setMode(x)} hitSlop={8} className="p-1.5" accessibilityLabel={a('editActivityDialogTitle')}>
                    <Icon as={Pencil} className="text-muted-foreground size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(x)} hitSlop={8} className="p-1.5" accessibilityLabel={t('common.delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </CardContent>
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
