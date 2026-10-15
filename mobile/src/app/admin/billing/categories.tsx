import type { FeeCategory } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
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
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Draft = { id?: string; name: string; code: string; is_discountable: boolean; is_active: boolean };
const EMPTY: Draft = { name: '', code: '', is_discountable: true, is_active: true };

/** Fee types such as tuition, bus, books (web: /admin/fees/fee-categories). */
export default function FeeCategories() {
  const { t } = useTranslation();
  const c = (k: string) => t(`fees.categories.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { scopeId } = useCampus();
  const list = useApi(scopeId ? ['admin', 'fee-categories', scopeId] : null, ([, , sid]) => adminFees.categories(sid as string));
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useAction(
    (d: Draft) => {
      const body = { name: d.name.trim(), code: d.code.trim().toUpperCase(), is_discountable: d.is_discountable, is_active: d.is_active };
      return d.id ? adminFees.updateCategory(scopeId!, d.id, body) : adminFees.createCategory(scopeId!, body);
    },
    { onSuccess: () => list.mutate() },
  );
  const remove = useAction((cat: FeeCategory) => adminFees.deleteCategory(scopeId!, cat.id), { success: c('deletedSuccess'), onSuccess: () => list.mutate() });

  return (
    <>
      <Stack.Screen
        options={{
          title: c('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => setDraft({ ...EMPTY })} accessibilityLabel={c('addNew')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={c('noCategoriesFound')}
          keyExtractor={(x) => x.id}
          renderItem={(cat) => (
            <Pressable onPress={() => setDraft({ id: cat.id, name: cat.name, code: cat.code, is_discountable: cat.is_discountable, is_active: cat.is_active })} className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-1">
                <Text className={cat.is_active ? 'font-medium' : 'text-muted-foreground font-medium'}>{cat.name}</Text>
                <View className="flex-row gap-2">
                  <Badge variant="outline">
                    <Text>{cat.code}</Text>
                  </Badge>
                  {cat.is_discountable ? (
                    <Badge variant="secondary">
                      <Text>{c('discountable')}</Text>
                    </Badge>
                  ) : null}
                  {!cat.is_active ? (
                    <Badge variant="secondary">
                      <Text>{t('school.students.fields.inactive')}</Text>
                    </Badge>
                  ) : null}
                </View>
              </View>
              <Pressable
                hitSlop={8}
                accessibilityLabel={t('app.bl_delete')}
                onPress={async () => {
                  if (await confirm({ title: t('app.ds_delete_title', { name: cat.name }), body: t('app.fe_category_delete_body'), destructive: true, confirmLabel: t('app.bl_delete') })) remove.run(cat);
                }}>
                <Icon as={Trash2} className="text-muted-foreground size-5" />
              </Pressable>
            </Pressable>
          )}
        />
      </View>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t('app.edit') : c('addNew')}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <View className="gap-3">
              <Label>{c('nameLabel')}</Label>
              <Input value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} autoFocus />
              <Label>{c('codeRequired')}</Label>
              <Input value={draft.code} onChangeText={(code) => setDraft({ ...draft, code })} autoCapitalize="characters" maxLength={20} />
              <View className="flex-row items-center justify-between">
                <Text>{c('discountable')}</Text>
                <Switch checked={draft.is_discountable} onCheckedChange={(v) => setDraft({ ...draft, is_discountable: v })} />
              </View>
              {draft.id ? (
                <View className="flex-row items-center justify-between">
                  <Text>{t('school.students.fields.active')}</Text>
                  <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                </View>
              ) : null}
            </View>
          ) : null}
          <DialogFooter>
            <Button
              disabled={save.running}
              onPress={async () => {
                if (!draft?.name.trim() || !draft.code.trim()) return toast.error(t('app.v_required'));
                if ((await save.run(draft)).ok) setDraft(null);
              }}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
