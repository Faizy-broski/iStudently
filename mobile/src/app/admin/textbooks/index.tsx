import type { Textbook } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminTextbooks } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Textbook titles per grade with stock: add, edit, adjust stock, delete (web: /admin/textbooks). */
export default function TextbookCatalog() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`textbooks.catalog.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const books = useApi(['admin', 'textbooks', campusId ?? 'school'], () => adminTextbooks.list({ campus_id: campusId }));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Textbook | null>(null);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [stock, setStock] = useState('0');
  const [saving, setSaving] = useState(false);
  const [restock, setRestock] = useState<Textbook | null>(null);
  const [amount, setAmount] = useState('');

  const gradeName = (id: string) => (grades.data ?? []).find((g) => g.id === id)?.name || '—';
  const openForm = (b: Textbook | null) => {
    setEditing(b);
    setTitle(b?.title ?? '');
    setGrade(b?.grade_level_id ?? '');
    setSubject(b?.subject ?? '');
    setStock(String(b?.stock_quantity ?? 0));
    setOpen(true);
  };

  async function save() {
    if (!title.trim() || !grade) return toast.error(c('titleRequiredError'));
    setSaving(true);
    try {
      const r = editing
        ? await adminTextbooks.update(editing.id, { title: title.trim(), grade_level_id: grade, subject: subject.trim() || undefined })
        : await adminTextbooks.create({ title: title.trim(), grade_level_id: grade, subject: subject.trim() || undefined, stock_quantity: Number(stock) || 0, campus_id: campusId });
      if (!r.success) return toast.error(r.error || c('saveError'));
      toast.success(editing ? c('updateSuccess') : c('createSuccess'));
      setOpen(false);
      books.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: Textbook) {
    if (!(await confirm({ title: c('deleteConfirm', { title: b.title }), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminTextbooks.remove(b.id);
    if (!r.success) return toast.error(r.error || c('deleteError'));
    toast.success(c('deleteSuccess'));
    books.mutate();
  }

  async function doRestock() {
    if (!restock) return;
    const n = Number(amount);
    if (!n) return toast.error(c('restockAmountRequired'));
    const r = await adminTextbooks.restock(restock.id, n);
    if (!r.success) return toast.error(r.error || c('restockError'));
    toast.success(c('restockSuccess'));
    setRestock(null);
    setAmount('');
    books.mutate();
  }

  const list = books.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => books.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{c('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/textbooks/matrix')}>
            <Text>{c('deliveryMatrixLink')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/textbooks/dashboard')}>
            <Text>{c('missingBooksLink')}</Text>
          </Button>
          <Button size="sm" onPress={() => openForm(null)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{c('addButton')}</Text>
          </Button>
        </View>
        {books.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={BookOpen} title={c('noTextbooks')} />
        ) : (
          <Card className="py-0">
            {list.map((b, i) => (
              <View key={b.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-1 px-4 py-3">
                  <View className="flex-1 gap-1">
                    <Text className="font-medium">{b.title}</Text>
                    <Text className="text-muted-foreground text-sm">
                      {[gradeName(b.grade_level_id), b.subject].filter(Boolean).join(' · ')} · {c('thStock')}: {b.stock_quantity}
                    </Text>
                    <View className={`self-start rounded-full px-2 py-0.5 ${b.is_active ? 'bg-primary' : 'bg-secondary'}`}>
                      <Text className={`text-xs ${b.is_active ? 'text-primary-foreground' : ''}`}>{b.is_active ? c('active') : c('inactive')}</Text>
                    </View>
                  </View>
                  <Button size="icon" variant="ghost" onPress={() => setRestock(b)} accessibilityLabel={c('restockTitleAttr')}>
                    <Icon as={PackagePlus} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => openForm(b)} accessibilityLabel={c('editTitleAttr')}>
                    <Icon as={Pencil} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => remove(b)} accessibilityLabel={c('deleteTitleAttr')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? c('dialogEditTitle') : c('dialogAddTitle')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{c('labelTitle')}</Label>
            <Input value={title} onChangeText={setTitle} />
          </View>
          <View className="gap-1.5">
            <Label>{c('labelGradeLevel')}</Label>
            <Picker value={grade} onChange={setGrade} placeholder={c('selectGradePlaceholder')} options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
          </View>
          <View className="gap-1.5">
            <Label>{c('labelSubject')}</Label>
            <Input value={subject} onChangeText={setSubject} />
          </View>
          {!editing ? (
            <View className="gap-1.5">
              <Label>{c('labelInitialStock')}</Label>
              <Input value={stock} onChangeText={setStock} keyboardType="number-pad" />
            </View>
          ) : null}
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>{c('cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{c('save')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restock} onOpenChange={(o) => !o && setRestock(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{c('restockDialogTitle', { title: restock?.title ?? '' })}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{c('restockLabel')}</Label>
            <Input value={amount} onChangeText={setAmount} keyboardType="numbers-and-punctuation" />
            <Text className="text-muted-foreground text-xs">{c('currentStock', { count: restock?.stock_quantity ?? 0 })}</Text>
          </View>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setRestock(null)}>
              <Text>{c('cancel')}</Text>
            </Button>
            <Button onPress={doRestock}>
              <Text>{c('save')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
