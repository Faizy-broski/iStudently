import type { BillingElement, ElementCategory } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/**
 * Billing element categories (title, order, element count; add, rename, delete) and their elements,
 * opened per category (web: /admin/billing-elements).
 */
export default function BillingElements() {
  const { t } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`admin.billing_elements.elements.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const categories = useApi(['admin', 'be-categories'], () => adminBillingElements.categories());
  const elements = useApi(['admin', 'billing-elements'], () => adminBillingElements.elements());
  const [newTitle, setNewTitle] = useState('');
  const [newOrder, setNewOrder] = useState('0');
  const [editing, setEditing] = useState<{ id: string; title: string; order: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    categories.mutate();
    elements.mutate();
  };

  async function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.success) return toast.error(res.error || e('toast.operation_failed'));
    toast.success(ok);
    refresh();
    return true;
  }

  async function create() {
    if (!newTitle.trim()) return toast.error(e('toast.title_required'));
    if (await run(() => adminBillingElements.createCategory(newTitle.trim(), Number(newOrder) || 0), e('toast.category_created'))) {
      setNewTitle('');
      setNewOrder('0');
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.title.trim()) return toast.error(e('toast.title_required'));
    if (await run(() => adminBillingElements.updateCategory(editing.id, { title: editing.title.trim(), sort_order: Number(editing.order) || 0 }), e('toast.category_updated'))) setEditing(null);
  }

  async function removeCategory(c: ElementCategory) {
    if (!(await confirm({ title: e('confirm.delete_category'), body: c.title, destructive: true, confirmLabel: t('common.delete') }))) return;
    await run(() => adminBillingElements.deleteCategory(c.id), e('toast.category_deleted'));
  }

  async function removeElement(el: BillingElement) {
    if (!(await confirm({ title: e('confirm.delete_element'), body: el.title, destructive: true, confirmLabel: t('common.delete') }))) return;
    await run(() => adminBillingElements.deleteElement(el.id), e('toast.element_deleted'));
  }

  if (categories.isLoading) return <LoadingList rows={6} />;
  if (categories.error) return <ErrorState message={categories.error.message || e('toast.load_categories_failed')} onRetry={refresh} />;
  const list = [...(categories.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  return (
    <>
      <Stack.Screen options={{ title: e('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{e('subtitle')}</Text>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{e('new_category')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            <View className="flex-row gap-2">
              <Input className="flex-1" value={newTitle} onChangeText={setNewTitle} placeholder={e('category_title_placeholder')} />
              <Input className="w-20" value={newOrder} onChangeText={(v) => setNewOrder(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={e('sort_order')} accessibilityLabel={e('sort_order')} />
            </View>
            <Button onPress={create} disabled={busy}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{e('new_category')}</Text>
            </Button>
          </CardContent>
        </Card>

        {list.length === 0 ? <EmptyState title={e('no_categories')} /> : null}
        {list.map((c) => {
          const items = (elements.data ?? []).filter((x) => x.category_id === c.id).sort((a, b) => a.sort_order - b.sort_order);
          const expanded = open === c.id;
          const isEditing = editing?.id === c.id;
          return (
            <Card key={c.id} className={cn('gap-0 py-0', !c.is_active && 'opacity-60')}>
              {isEditing ? (
                <View className="flex-row items-center gap-2 p-3">
                  <Input className="flex-1" value={editing.title} onChangeText={(v) => setEditing({ ...editing, title: v })} />
                  <Input className="w-16" value={editing.order} onChangeText={(v) => setEditing({ ...editing, order: v.replace(/\D/g, '') })} keyboardType="number-pad" accessibilityLabel={e('sort_order')} />
                  <Pressable onPress={saveEdit} accessibilityRole="button" accessibilityLabel={t('common.save')} hitSlop={8}>
                    <Icon as={Check} className="text-primary size-5" />
                  </Pressable>
                  <Pressable onPress={() => setEditing(null)} accessibilityRole="button" accessibilityLabel={t('common.cancel')} hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-5" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setOpen(expanded ? null : c.id)} className="active:bg-muted flex-row items-center gap-2 p-3">
                  <Icon as={expanded ? ChevronDown : ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
                  <View className="flex-1">
                    <Text className="font-medium">{c.title}</Text>
                    <Text className="text-muted-foreground text-xs">{`${e('order')}: ${c.sort_order} · ${e('elements_count', { count: c.elements_count ?? items.length })}`}</Text>
                  </View>
                  <Pressable onPress={() => setEditing({ id: c.id, title: c.title, order: String(c.sort_order) })} accessibilityRole="button" accessibilityLabel={t('common.edit')} hitSlop={8}>
                    <Icon as={Pencil} className="text-muted-foreground size-4" />
                  </Pressable>
                  <Pressable onPress={() => removeCategory(c)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </Pressable>
              )}
              {expanded ? (
                <CardContent className="border-border gap-2 border-t px-3 py-3">
                  {items.map((el) => (
                    <Pressable
                      key={el.id}
                      onPress={() => router.push({ pathname: '/admin/billing/elements/form', params: { id: el.id } })}
                      className="active:bg-muted border-border flex-row items-start gap-2 rounded-md border p-2.5">
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium">{el.title}</Text>
                        <Text className="text-muted-foreground text-xs">
                          {[`${e('grade')}: ${el.grade_name ?? e('dash')}`, el.comment ? `${e('comment')}: ${el.comment}` : null, `${e('order')}: ${el.sort_order}`].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Text className="font-semibold">{money(el.amount)}</Text>
                        {!el.is_active ? (
                          <Badge variant="secondary">
                            <Text>{t('common.inactive')}</Text>
                          </Badge>
                        ) : null}
                      </View>
                      <Pressable onPress={() => removeElement(el)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8}>
                        <Icon as={Trash2} className="text-muted-foreground size-4" />
                      </Pressable>
                    </Pressable>
                  ))}
                  <Button variant="outline" size="sm" onPress={() => router.push({ pathname: '/admin/billing/elements/form', params: { category: c.id } })}>
                    <Icon as={Plus} className="size-4" />
                    <Text>{e('add_element')}</Text>
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </>
  );
}
