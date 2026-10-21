import type { MarkingPeriodGroup } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, CalendarRange, Info, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { usePluginActive } from '@/features/admin/plugins';
import { useCampus } from '@/features/campus/campus';
import { plainMessage } from '@/i18n/plain';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Marking period groups (plugin): groups of marking periods for different grade levels (web: /admin/settings/marking-period-groups). */
export default function MarkingPeriodGroups() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.marking_period_groups_page.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const active = usePluginActive('marking_period_groups');
  const res = useApi(['admin', 'mp-groups', campusId ?? 'school'], () => adminAcademics.markingPeriodGroups(campusId));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarkingPeriodGroup | null>(null);
  const [name, setName] = useState('');
  const [wholeSchool, setWholeSchool] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openForm = (group: MarkingPeriodGroup | null) => {
    setEditing(group);
    setName(group?.name ?? '');
    setWholeSchool(group ? !group.campus_id : false);
    setOpen(true);
  };

  async function submit() {
    if (!name.trim()) return toast.error(g('name_required'));
    setSaving(true);
    try {
      const r = editing ? await adminAcademics.updateMarkingPeriodGroup(editing.id, { name }) : await adminAcademics.createMarkingPeriodGroup({ name, campus_id: wholeSchool ? null : campusId });
      if (!r.success) return toast.error(r.error || g('update_error'));
      toast.success(editing ? g('update_success') : g('create_success'));
      setOpen(false);
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: MarkingPeriodGroup) {
    if (group.is_default) return;
    if (!(await confirm({ title: g('delete_confirm', { name: group.name }), destructive: true, confirmLabel: t('common.delete') }))) return;
    setDeleting(group.id);
    try {
      const r = await adminAcademics.deleteMarkingPeriodGroup(group.id);
      if (!r.success) return toast.error(r.error || g('delete_error'));
      toast.success(g('delete_success'));
      res.mutate();
    } finally {
      setDeleting(null);
    }
  }

  const banner = plainMessage('school.marking_period_groups_page.info_banner');

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        {!active ? (
          <View className="flex-row gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
            <Icon as={AlertTriangle} className="size-5 text-warning" />
            <Text className="flex-1 text-sm text-warning ">{g('inactive_notice')}</Text>
          </View>
        ) : (
          <>
            <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
            <View className="flex-row gap-2 rounded-xl border border-info-soft bg-info-soft p-3">
              <Icon as={Info} className="size-4 text-brand dark:text-brand-secondary" />
              <Text className="flex-1 text-sm text-brand dark:text-brand-secondary ">{banner}</Text>
            </View>
            <Card>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-semibold">{g('card_title')}</Text>
                    <Text className="text-muted-foreground text-xs">{g('card_desc')}</Text>
                  </View>
                  <Button size="sm" onPress={() => openForm(null)}>
                    <Icon as={Plus} className="text-primary-foreground size-4" />
                    <Text>{g('btn_add')}</Text>
                  </Button>
                </View>
                {res.isLoading ? (
                  <LoadingList rows={3} />
                ) : !(res.data ?? []).length ? (
                  <EmptyState title={g('no_groups')} />
                ) : (
                  (res.data ?? []).map((group, i) => (
                    <View key={group.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="flex-row items-center gap-2 py-2.5">
                        <Icon as={CalendarRange} className="text-muted-foreground size-4" />
                        <View className="flex-1 gap-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="text-sm font-semibold">{group.name}</Text>
                            {group.is_default ? (
                              <View className="rounded-full bg-success px-2 py-0.5">
                                <Text className="text-xs text-white">{g('badge_default')}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View className="border-border self-start rounded-full border px-2 py-0.5">
                            <Text className="text-xs">{group.campus_id ? g('scope_campus') : g('scope_whole_school')}</Text>
                          </View>
                        </View>
                        <Pressable onPress={() => openForm(group)} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                          <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                        </Pressable>
                        {!group.is_default ? (
                          <Button size="icon" variant="ghost" disabled={deleting === group.id} onPress={() => remove(group)} accessibilityLabel={t('common.delete')}>
                            <Icon as={Trash2} className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? g('dialog_edit_title') : g('dialog_add_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{g('label_name')}</Label>
            <Input value={name} onChangeText={setName} placeholder={g('placeholder_name')} />
          </View>
          {!editing ? <CheckRow checked={wholeSchool} onPress={() => setWholeSchool((v) => !v)} label={g('checkbox_whole_school')} /> : null}
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>{g('btn_cancel')}</Text>
            </Button>
            <Button onPress={submit} disabled={saving}>
              <Text>{editing ? g('btn_update') : g('btn_create')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
