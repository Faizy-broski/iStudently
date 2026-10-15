import type { Book, LibraryCategory } from '@studently/shared-types';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { AlertTriangle, Barcode, BookOpen, CheckCircle, FolderOpen, ImageIcon, Layers, Pencil, Plus, RotateCcw, Trash2, Upload, Users, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ColorSwatches, isLibraryKey, useLibraryCategories } from '@/features/admin/library';
import { useRoleBase } from '@/features/portal/role-base';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Library inventory: categories, search, books with copies/issue/return/lost actions (web: /admin/library/books). */
export default function LibraryBooks() {
  const { t } = useTranslation();
  const v = (k: string, o?: Record<string, unknown>) => t(`admin.library.inventory.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const role = useRoleBase();
  const { mutate } = useSWRConfig();
  const books = useApi(['admin', 'library-books'], () => adminLibrary.books());
  const cats = useLibraryCategories();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Category dialog (web: CategorySidebar)
  const [catOpen, setCatOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3B82F6');
  const [catParent, setCatParent] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  const categories = cats.data ?? [];
  const topLevel = categories.filter((c) => !c.parent_category_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_category_id === id);
  const catOf = (id: string | null) => (id ? categories.find((c) => c.id === id) : undefined);

  const openCat = (cat: LibraryCategory | null, parentId: string | null = null) => {
    setEditing(cat);
    setCatName(cat?.name ?? '');
    setCatColor(cat?.color_code || '#3B82F6');
    setCatParent(cat ? cat.parent_category_id : parentId);
    setCatOpen(true);
  };
  async function saveCat() {
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      const body = { name: catName.trim(), color_code: catColor, parent_category_id: catParent };
      const r = editing ? await adminLibrary.updateCategory(editing.id, body) : await adminLibrary.createCategory(body);
      if (!r.success) return toast.error(r.error || t('app.lb_cat_save_failed'));
      toast.success(editing ? t('app.lb_cat_updated') : t('app.lb_cat_created'));
      setCatOpen(false);
      cats.mutate();
    } finally {
      setSavingCat(false);
    }
  }
  async function deleteCat(cat: LibraryCategory) {
    if (!(await confirm({ title: t('app.lb_cat_delete', { name: cat.name }), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminLibrary.deleteCategory(cat.id);
    if (!r.success) return toast.error(r.error || t('app.error_title'));
    toast.success(t('app.lb_cat_deleted'));
    if (category === cat.id) setCategory(null);
    cats.mutate();
  }

  async function deleteBook(b: Book) {
    if (b.total_copies > 0) return toast.error(t('app.lb_delete_has_copies', { count: b.total_copies }));
    if (!(await confirm({ title: t('app.lb_delete_book'), body: t('app.lb_delete_book_body', { title: b.title }), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminLibrary.deleteBook(b.id);
    if (!r.success) return toast.error(r.error || t('app.lb_delete_failed'));
    toast.success(t('app.lb_deleted', { title: b.title }));
    mutate(isLibraryKey);
  }

  const q = search.trim().toLowerCase();
  const list = (books.data ?? [])
    .filter((b) => !category || b.category_id === category)
    .filter((b) => !q || [b.title, b.author, b.isbn, b.reference].some((x) => x?.toLowerCase().includes(q)));

  const chip = (cat: LibraryCategory, child = false) => {
    const active = category === cat.id;
    const readOnly = cat.is_global;
    return (
      <View key={cat.id} className={cn('flex-row items-center gap-1 rounded-full border px-3 py-1', child && 'ms-4', active ? 'border-primary/30 bg-primary/10' : 'border-border bg-background')}>
        <Pressable onPress={() => setCategory(cat.id)} className="flex-row items-center gap-2">
          <View className="size-2.5 rounded-full" style={{ backgroundColor: cat.color_code || '#6B7280' }} />
          <Text className={cn('text-sm', active ? 'text-primary font-medium' : 'text-muted-foreground')}>{cat.name}</Text>
        </Pressable>
        {!readOnly ? (
          <>
            {!child ? (
              <Pressable onPress={() => openCat(null, cat.id)} hitSlop={6} accessibilityLabel={t('app.lb_add_subcategory')} className="p-1">
                <Icon as={Plus} className="text-muted-foreground size-3" />
              </Pressable>
            ) : null}
            <Pressable onPress={() => openCat(cat)} hitSlop={6} accessibilityLabel={t('common.edit')} className="p-1">
              <Icon as={Pencil} className="text-muted-foreground size-3" />
            </Pressable>
            <Pressable onPress={() => deleteCat(cat)} hitSlop={6} accessibilityLabel={t('common.delete')} className="p-1">
              <Icon as={Trash2} className="text-destructive size-3" />
            </Pressable>
          </>
        ) : null}
      </View>
    );
  };

  const action = (icon: typeof Pencil, label: string, onPress: () => void, opts: { destructive?: boolean; disabled?: boolean } = {}) => (
    <Button size="sm" variant={opts.destructive ? 'destructive' : 'outline'} disabled={opts.disabled} onPress={onPress} accessibilityLabel={label}>
      <Icon as={icon} className={cn('size-3.5', opts.destructive ? 'text-white' : 'text-foreground')} />
      <Text className="text-xs">{label}</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: v('title') }} />
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              books.mutate();
              cats.mutate();
            }}
          />
        }>
        <Text className="text-muted-foreground text-sm">{v('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" onPress={() => router.push(role.href('/library/quick-loan'))}>
            <Icon as={Zap} className="text-foreground size-4" />
            <Text>{v('actions.quick_loan')}</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => router.push(role.href('/library/upload-document', category ? { category } : undefined))}>
            <Icon as={Upload} className="text-foreground size-4" />
            <Text>{v('actions.upload_document')}</Text>
          </Button>
          <Button size="sm" onPress={() => router.push(role.href('/library/book-form'))}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{v('actions.add_book')}</Text>
          </Button>
        </View>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{t('app.lb_categories')}</Text>
              <Button size="sm" variant="ghost" onPress={() => openCat(null)}>
                <Icon as={Plus} className="text-foreground size-3.5" />
                <Text>{t('app.lb_new_category')}</Text>
              </Button>
            </View>
            <Pressable
              onPress={() => setCategory(null)}
              className={cn('flex-row items-center gap-2 self-start rounded-full border px-3 py-1', category === null ? 'border-primary bg-primary' : 'border-border')}>
              <Icon as={FolderOpen} className={cn('size-3.5', category === null ? 'text-primary-foreground' : 'text-muted-foreground')} />
              <Text className={cn('text-sm', category === null ? 'text-primary-foreground' : 'text-muted-foreground')}>{t('app.lb_all_documents')}</Text>
              <View className="bg-secondary rounded-full px-1.5">
                <Text className="text-xs">{categories.length}</Text>
              </View>
            </Pressable>
            {cats.isLoading ? (
              <LoadingList rows={1} />
            ) : (
              <View className="gap-2">
                {topLevel.map((c) => (
                  <View key={c.id} className="gap-2">
                    <View className="flex-row">{chip(c)}</View>
                    {childrenOf(c.id).map((ch) => (
                      <View key={ch.id} className="flex-row">
                        {chip(ch, true)}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        <SearchBar value={search} onChangeText={setSearch} placeholder={v('search_placeholder')} />
        <View className="flex-row items-center gap-2">
          <Icon as={BookOpen} className="text-foreground size-4" />
          <Text className="font-semibold">{v('documents_count', { count: list.length })}</Text>
          {category ? (
            <View className="bg-secondary rounded-full px-2 py-0.5">
              <Text className="text-xs">{catOf(category)?.name}</Text>
            </View>
          ) : null}
        </View>

        {books.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={BookOpen} title={q ? v('no_books_search') : v('no_books')} />
        ) : (
          list.map((b) => {
            const cat = catOf(b.category_id);
            const available = b.available_copies > 0;
            return (
              <Card key={b.id}>
                <CardContent className="gap-3 pt-4">
                  <View className="flex-row gap-3">
                    <View className="bg-muted h-16 w-12 items-center justify-center overflow-hidden rounded">
                      {b.cover_image_url ? <Image source={{ uri: b.cover_image_url }} style={{ width: 48, height: 64 }} contentFit="cover" /> : <Icon as={ImageIcon} className="text-muted-foreground size-5" />}
                    </View>
                    <View className="flex-1 gap-1">
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        {cat ? <View className="size-2.5 rounded-full" style={{ backgroundColor: cat.color_code || '#6B7280' }} /> : null}
                        <Text className="font-semibold">{b.title}</Text>
                        {b.document_type && b.document_type !== 'book' ? (
                          <View className="border-border rounded border px-1.5">
                            <Text className="text-[10px]">{b.document_type}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-muted-foreground text-sm">{b.author}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {t('app.lb_ref_isbn')}: {b.reference || b.isbn || t('common.na', { defaultValue: 'N/A' })} · {t('app.lb_copies')}: {b.available_copies} / {b.total_copies}
                      </Text>
                      <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2 py-0.5', available ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                        <Icon as={available ? CheckCircle : AlertTriangle} className={cn('size-3', available ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400')} />
                        <Text className={cn('text-xs', available ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400')}>{available ? v('status.available') : v('status.unavailable')}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5">
                    {action(Pencil, t('common.edit'), () => router.push(role.href('/library/book-form', { id: b.id })))}
                    {action(Layers, v('actions.add_copies'), () => router.push(role.href('/library/add-copies', { id: b.id })))}
                    {action(Barcode, v('actions.issue'), () => router.push(role.href('/library/issue', { id: b.id })), { disabled: b.available_copies === 0 })}
                    {action(RotateCcw, v('actions.return'), () => router.push(role.href('/library/return', { title: b.title })))}
                    {action(Users, v('actions.lost'), () => router.push(role.href('/library/lost')), { destructive: true })}
                    {action(Trash2, t('common.delete'), () => deleteBook(b), { destructive: true })}
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('app.lb_edit_category') : catParent ? t('app.lb_new_subcategory') : t('app.lb_new_category')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{t('app.lb_cat_name')}</Label>
            <Input value={catName} onChangeText={setCatName} placeholder={t('app.lb_cat_name_ph')} autoFocus />
          </View>
          <View className="gap-1.5">
            <Label>{t('app.lb_parent_category')}</Label>
            <Picker
              value={catParent ?? 'NONE'}
              onChange={(x) => setCatParent(x === 'NONE' ? null : x)}
              options={[{ value: 'NONE', label: t('app.lb_top_level') }, ...topLevel.filter((c) => c.id !== editing?.id).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </View>
          <View className="gap-1.5">
            <Label>{t('app.lb_color')}</Label>
            <ColorSwatches value={catColor} onChange={setCatColor} />
          </View>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setCatOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button onPress={saveCat} disabled={savingCat || !catName.trim()}>
              <Text>{editing ? t('common.update') : t('common.create')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
