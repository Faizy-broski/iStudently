import type { AdminQuizCategory, AdminQuizQuestion } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { FileText, FolderOpen, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useQuizCategories, useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

function CategoryDialog({ category, onClose, onSaved }: { category: AdminQuizCategory | null; onClose: () => void; onSaved: () => void }) {
  const q = useQz();
  const toast = useToast();
  const { campusId } = useCampus();
  const [title, setTitle] = useState(category?.title ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0));
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const input = { title: title.trim(), sort_order: Number(sortOrder) || 0 };
      const r = category ? await adminQuiz.updateCategory(category.id, input) : await adminQuiz.createCategory({ ...input, campus_id: campusId ?? null });
      if (!r.success) return toast.error(r.error || q('errors.failedToSave'));
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[92vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? q('editCategory') : q('newCategory')}</DialogTitle>
        </DialogHeader>
        <View className="gap-3">
          <View className="gap-1">
            <Label>{q('table.title')} *</Label>
            <Input value={title} onChangeText={setTitle} placeholder={q('placeholders.categoryName')} />
          </View>
          <View className="gap-1">
            <Label>{q('sortOrder')}</Label>
            <Input value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />
          </View>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={saving}>
            <Text>{q('cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving || !title.trim()}>
            <Text>{saving ? q('saving') : q('save')}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Question bank: categories, search, add/edit/delete questions (web: /admin/quiz/questions). */
export default function Questions() {
  const q = useQz();
  const confirm = useConfirm();
  const toast = useToast();
  const { campusId } = useCampus();
  const categories = useQuizCategories();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [catDialog, setCatDialog] = useState<'new' | AdminQuizCategory | null>(null);
  const questions = useApi(['admin', 'quiz-questions', campusId ?? 'school', categoryId ?? 'all', term], ([, , , c, s]) =>
    adminQuiz.questions({ campus_id: campusId, category_id: c === 'all' ? undefined : (c as string), search: (s as string) || undefined }),
  );

  async function deleteCategory(c: AdminQuizCategory) {
    if (!(await confirm({ title: q('deleteCategory'), body: q('deleteCategoryWarning'), destructive: true, confirmLabel: q('delete') }))) return;
    const r = await adminQuiz.deleteCategory(c.id);
    if (!r.success) return toast.error(r.error || '');
    if (categoryId === c.id) setCategoryId(null);
    categories.mutate();
    questions.mutate();
  }
  async function deleteQuestion(x: AdminQuizQuestion) {
    if (!(await confirm({ title: q('deleteQuestion'), body: q('removeFromQuizzes'), destructive: true, confirmLabel: q('delete') }))) return;
    const r = await adminQuiz.deleteQuestion(x.id);
    if (!r.success) return toast.error(r.error || '');
    questions.mutate();
  }

  const selected = (categories.data ?? []).find((c) => c.id === categoryId);
  return (
    <>
      <Stack.Screen
        options={{
          title: q('questionBank'),
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/admin/quiz/question-form', params: { categoryId: categoryId ?? '' } })} hitSlop={8} className="p-1" accessibilityLabel={q('addQuestionAction')}>
              <Icon as={Plus} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />
      <DataList
        items={questions.data}
        error={questions.error}
        isLoading={questions.isLoading}
        isRefreshing={questions.isValidating && !questions.isLoading}
        onRefresh={() => {
          categories.mutate();
          questions.mutate();
        }}
        emptyTitle={q('noQuestions')}
        keyExtractor={(x: AdminQuizQuestion) => x.id}
        header={
          <View className="gap-3 px-4 pt-3 pb-1">
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" className="flex-1" onPress={() => router.push('/admin/quiz/ai-import')}>
                <Icon as={Sparkles} className="text-foreground size-4" />
                <Text>AI Import</Text>
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onPress={() => router.push('/admin/quiz/exam-builder')}>
                <Icon as={FileText} className="text-foreground size-4" />
                <Text>Exam Builder</Text>
              </Button>
            </View>
            <Card>
              <CardContent className="gap-2 py-3">
                <View className="flex-row items-center gap-1.5">
                  <Icon as={FolderOpen} className="text-muted-foreground size-4" />
                  <Text className="flex-1 font-semibold">{q('categories')}</Text>
                  <Pressable onPress={() => setCatDialog('new')} hitSlop={8} className="p-1" accessibilityLabel={q('newCategory')}>
                    <Icon as={Plus} className="text-foreground size-4" />
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                  {[{ id: null, title: q('allQuestions') }, ...(categories.data ?? [])].map((c) => (
                    <Pressable key={c.id ?? 'all'} onPress={() => setCategoryId(c.id)} className={cn('rounded-full border px-3 py-1.5', categoryId === c.id ? 'border-primary bg-primary' : 'border-border')}>
                      <Text className={cn('text-sm', categoryId === c.id ? 'text-primary-foreground' : 'text-foreground')}>{c.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {selected ? (
                  <View className="flex-row gap-2">
                    <Button size="sm" variant="ghost" onPress={() => setCatDialog(selected)}>
                      <Icon as={Pencil} className="text-foreground size-3.5" />
                      <Text>{q('editCategory')}</Text>
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => deleteCategory(selected)}>
                      <Icon as={Trash2} className="text-destructive size-3.5" />
                      <Text className="text-destructive">{q('delete')}</Text>
                    </Button>
                  </View>
                ) : null}
              </CardContent>
            </Card>
            <SearchBar value={search} onChangeText={setSearch} placeholder={q('searchQuestions')} />
          </View>
        }
        renderItem={(x: AdminQuizQuestion) => (
          <Pressable className="flex-row items-start gap-2 px-4 py-3" onPress={() => router.push({ pathname: '/admin/quiz/question-form', params: { id: x.id } })}>
            <View className="flex-1 gap-1">
              <Text className="text-sm font-medium" numberOfLines={2}>
                {x.title}
              </Text>
              <View className="flex-row flex-wrap gap-1">
                <Badge variant="secondary">
                  <Text className="text-xs">{q(`questionTypes.${x.type}`)}</Text>
                </Badge>
                {x.difficulty_level ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{q(`difficulty.${x.difficulty_level}`)}</Text>
                  </Badge>
                ) : null}
                {x.category?.title ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{x.category.title}</Text>
                  </Badge>
                ) : null}
              </View>
            </View>
            <Pressable onPress={() => deleteQuestion(x)} hitSlop={8} className="p-1.5" accessibilityLabel={q('delete')}>
              <Icon as={Trash2} className="text-destructive size-4" />
            </Pressable>
          </Pressable>
        )}
      />
      {catDialog ? (
        <CategoryDialog
          category={catDialog === 'new' ? null : catDialog}
          onClose={() => setCatDialog(null)}
          onSaved={() => {
            setCatDialog(null);
            categories.mutate();
            questions.mutate();
          }}
        />
      ) : null}
    </>
  );
}
