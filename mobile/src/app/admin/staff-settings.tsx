import type { StaffDesignation } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminDesignations } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Scope = 'school' | 'campus';

/** Job titles offered when adding staff, school-wide or per campus (web: /admin/staff/settings). */
export default function StaffSettings() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`staff.settings.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId, campus } = useCampus();
  const list = useApi(['admin', 'designations', campusId ?? 'school'], () => adminDesignations.list(campusId));
  const [name, setName] = useState('');
  const [scope, setScope] = useState<Scope>('school');
  const [editing, setEditing] = useState<StaffDesignation | null>(null);
  const [editName, setEditName] = useState('');
  const refresh = () => list.mutate();
  const add = useAction(() => adminDesignations.create({ name: name.trim(), campus_id: scope === 'campus' ? (campusId ?? null) : null }), {
    onSuccess: () => {
      setName('');
      refresh();
    },
  });
  const toggle = useAction((d: StaffDesignation) => adminDesignations.update(d.id, { is_active: !d.is_active }), { onSuccess: refresh });
  const rename = useAction((d: StaffDesignation) => adminDesignations.update(d.id, { name: editName.trim() }), { success: t('app.saved'), onSuccess: refresh });
  const remove = useAction((d: StaffDesignation) => adminDesignations.remove(d.id), { success: t('app.bl_deleted'), onSuccess: refresh });
  const seed = useAction(() => adminDesignations.seedDefaults(), { onSuccess: refresh });

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-3 pb-2">
          <Text variant="muted">{s('manageDesignationsDesc')}</Text>
          <View className="flex-row gap-2">
            <Input className="flex-1" value={name} onChangeText={setName} placeholder={s('designationPlaceholder')} />
            <Button onPress={() => (name.trim() ? add.run() : toast.error(t('app.v_required')))} disabled={add.running}>
              <Text>{s('addRole')}</Text>
            </Button>
          </View>
          {campusId ? (
            <FilterChips<Scope>
              value={scope}
              onChange={setScope}
              options={[
                { value: 'school', label: s('schoolWide') },
                { value: 'campus', label: `${s('campusOnly')}: ${campus?.name ?? ''}` },
              ]}
            />
          ) : null}
          {list.data && list.data.length === 0 ? (
            <Button variant="outline" onPress={() => seed.run()} disabled={seed.running}>
              <Text>{s('addDefaults')}</Text>
            </Button>
          ) : null}
        </View>
        <DataList
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={refresh}
          emptyTitle={s('noDesignations')}
          emptyBody={s('noDesignationsHint')}
          keyExtractor={(d) => d.id}
          renderItem={(d) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-0.5">
                <Text className={d.is_active ? 'font-medium' : 'text-muted-foreground font-medium'}>{d.name}</Text>
                <View className="flex-row gap-2">
                  <Badge variant="outline">
                    <Text>{d.campus_id ? s('campusOnly') : s('schoolWide')}</Text>
                  </Badge>
                  {d.is_system ? (
                    <Badge variant="secondary">
                      <Text>{s('system')}</Text>
                    </Badge>
                  ) : null}
                </View>
              </View>
              <Switch checked={d.is_active} onCheckedChange={() => toggle.run(d)} accessibilityLabel={d.name} />
              {!d.is_system ? (
                <>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={t('app.edit')}
                    onPress={() => {
                      setEditName(d.name);
                      setEditing(d);
                    }}>
                    <Icon as={Pencil} className="text-muted-foreground size-5" />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={t('app.bl_delete')}
                    onPress={async () => {
                      if (await confirm({ title: t('app.ds_delete_title', { name: d.name }), body: t('app.ds_delete_body'), destructive: true, confirmLabel: t('app.bl_delete') })) remove.run(d);
                    }}>
                    <Icon as={Trash2} className="text-muted-foreground size-5" />
                  </Pressable>
                </>
              ) : null}
            </View>
          )}
        />
      </View>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{t('app.ds_rename')}</DialogTitle>
          </DialogHeader>
          <Input value={editName} onChangeText={setEditName} autoFocus />
          <DialogFooter>
            <Button
              disabled={rename.running || !editName.trim()}
              onPress={async () => {
                if (editing && (await rename.run(editing)).ok) setEditing(null);
              }}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
