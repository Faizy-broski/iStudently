import type { RcCode, RcCodeScale, RcComment, RcCommentCategory } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Tab = 'categories' | 'comments' | 'codes';

// ── Category form ─────────────────────────────────────────────────────────────
type CatForm = { id?: string; title: string; sort_order: string };
type CommentForm = { id?: string; title: string; category_id: string; sort_order: string };
type CodeScaleForm = { id?: string; title: string };
type CodeForm = { id?: string; title: string; short_name: string; comment: string; sort_order: string };

/** Report card comments: categories, comment templates, and code scales (web: /admin/grades/report-card-comments). */
export default function ReportCardComments() {
  const { t } = useTranslation();
  const rc = (k: string) => t(`app.rc_${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [tab, setTab] = useState<Tab>('categories');

  // ── Data ────────────────────────────────────────────────────────────────────
  const categories = useApi(['admin', 'rc-categories', campusId ?? 'school'], () => adminGrades.rcCategories(campusId));
  const comments = useApi(['admin', 'rc-comments', campusId ?? 'school'], () => adminGrades.rcComments(campusId));
  const codeScales = useApi(['admin', 'rc-code-scales', campusId ?? 'school'], () => adminGrades.rcCodeScales(campusId));

  // ── Category forms ──────────────────────────────────────────────────────────
  const [catForm, setCatForm] = useState<CatForm | null>(null);
  const [commentForm, setCommentForm] = useState<CommentForm | null>(null);
  const [codeScaleForm, setCodeScaleForm] = useState<CodeScaleForm | null>(null);
  const [selectedScaleId, setSelectedScaleId] = useState<string | null>(null);
  const [codeForm, setCodeForm] = useState<CodeForm | null>(null);
  const [busy, setBusy] = useState(false);

  // Codes are embedded in each scale's `.codes` array — no separate fetch needed.
  const selectedScaleCodes = (codeScales.data ?? []).find((s) => s.id === selectedScaleId)?.codes ?? [];

  // ── Category CRUD ────────────────────────────────────────────────────────────
  async function saveCat() {
    if (!catForm?.title.trim()) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = catForm.id
      ? await adminGrades.updateRcCategory(catForm.id, { title: catForm.title.trim(), sort_order: parseInt(catForm.sort_order, 10) || 0 })
      : await adminGrades.createRcCategory({ title: catForm.title.trim(), sort_order: parseInt(catForm.sort_order, 10) || 0 });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.saved'));
    toast.success(t('app.saved'));
    setCatForm(null);
    categories.mutate();
  }

  async function deleteCat(cat: RcCommentCategory) {
    if (!(await confirm({ title: t('app.bl_delete'), body: cat.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
    const res = await adminGrades.deleteRcCategory(cat.id);
    if (!res.success) return toast.error(res.error || t('app.bl_delete'));
    categories.mutate();
  }

  // ── Comment CRUD ─────────────────────────────────────────────────────────────
  async function saveComment() {
    if (!commentForm?.title.trim()) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = commentForm.id
      ? await adminGrades.updateRcComment(commentForm.id, { title: commentForm.title.trim(), category_id: commentForm.category_id || null, sort_order: parseInt(commentForm.sort_order, 10) || 0 })
      : await adminGrades.createRcComment({ title: commentForm.title.trim(), category_id: commentForm.category_id || null, sort_order: parseInt(commentForm.sort_order, 10) || 0 });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.saved'));
    toast.success(t('app.saved'));
    setCommentForm(null);
    comments.mutate();
  }

  // ── Code scale CRUD ───────────────────────────────────────────────────────────
  async function saveCodeScale() {
    if (!codeScaleForm?.title.trim()) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = await adminGrades.createRcCodeScale({ title: codeScaleForm.title.trim() });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.saved'));
    toast.success(t('app.saved'));
    setCodeScaleForm(null);
    codeScales.mutate();
    setSelectedScaleId(res.data?.id ?? null);
  }

  async function deleteCodeScale(scale: RcCodeScale) {
    if (!(await confirm({ title: t('app.bl_delete'), body: scale.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
    const res = await adminGrades.deleteRcCodeScale(scale.id);
    if (!res.success) return toast.error(res.error || t('app.bl_delete'));
    if (selectedScaleId === scale.id) setSelectedScaleId(null);
    codeScales.mutate();
  }

  // ── Code CRUD ─────────────────────────────────────────────────────────────────
  async function saveCode() {
    if (!codeForm?.title.trim() || !selectedScaleId) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = await adminGrades.createRcCode(selectedScaleId, {
      title: codeForm.title.trim(),
      short_name: codeForm.short_name.trim() || undefined,
      comment: codeForm.comment.trim() || undefined,
      sort_order: parseInt(codeForm.sort_order, 10) || 0,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.saved'));
    toast.success(t('app.saved'));
    setCodeForm(null);
    codeScales.mutate();
  }

  async function deleteCode(code: RcCode) {
    if (!(await confirm({ title: t('app.bl_delete'), body: code.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
    const res = await adminGrades.deleteRcCode(code.id);
    if (!res.success) return toast.error(res.error || t('app.bl_delete'));
    codeScales.mutate();
  }

  const catOptions = [{ value: '', label: '—' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.title }))];

  return (
    <>
      <Stack.Screen options={{ title: t('school.grades_module.report_card_comments.title') }} />
      <View className="bg-background flex-1">
        <FilterChips<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'categories', label: rc('cat_tab') },
            { value: 'comments', label: rc('comments_tab') },
            { value: 'codes', label: rc('codes_tab') },
          ]}
        />

        {/* ── Categories tab ── */}
        {tab === 'categories' ? (
          <DataList
            items={categories.data}
            error={categories.error}
            isLoading={categories.isLoading}
            isRefreshing={categories.isValidating && !categories.isLoading}
            onRefresh={() => categories.mutate()}
            emptyTitle={rc('no_categories')}
            keyExtractor={(x) => x.id}
            header={
              <View className="items-end px-2 pt-2">
                <Button size="sm" variant="ghost" onPress={() => setCatForm({ title: '', sort_order: String((categories.data?.length ?? 0) + 1) })} accessibilityLabel={rc('new_category')}>
                  <Icon as={Plus} className="size-5" />
                </Button>
              </View>
            }
            renderItem={(x) => (
              <Pressable className="flex-row items-center gap-2 px-4 py-3" onPress={() => setCatForm({ id: x.id, title: x.title, sort_order: String(x.sort_order ?? 0) })}>
                {x.color ? <View className="size-3 rounded-full" style={{ backgroundColor: x.color }} /> : null}
                <Text className="flex-1 font-medium">{x.title}</Text>
                <Text className="text-muted-foreground text-xs">{x.comment_count ?? 0}</Text>
                <Pressable hitSlop={8} onPress={() => deleteCat(x)} accessibilityLabel={t('app.bl_delete')}>
                  <Icon as={Trash2} className="text-muted-foreground size-4" />
                </Pressable>
              </Pressable>
            )}
          />
        ) : null}

        {/* ── Comments tab ── */}
        {tab === 'comments' ? (
          <DataList
            items={comments.data}
            error={comments.error}
            isLoading={comments.isLoading}
            isRefreshing={comments.isValidating && !comments.isLoading}
            onRefresh={() => comments.mutate()}
            emptyTitle={rc('no_comments')}
            keyExtractor={(x) => x.id}
            header={
              <View className="items-end px-2 pt-2">
                <Button size="sm" variant="ghost" onPress={() => setCommentForm({ title: '', category_id: '', sort_order: String((comments.data?.length ?? 0) + 1) })} accessibilityLabel={rc('new_comment')}>
                  <Icon as={Plus} className="size-5" />
                </Button>
              </View>
            }
            renderItem={(x) => (
              <Pressable className="flex-row items-center gap-2 px-4 py-3" onPress={() => setCommentForm({ id: x.id, title: x.title, category_id: x.category_id ?? '', sort_order: String(x.sort_order ?? 0) })}>
                <View className="flex-1">
                  <Text className="font-medium">{x.title}</Text>
                  {x.scale_title ? <Text className="text-muted-foreground text-xs">{x.scale_title}</Text> : null}
                </View>
                <Pressable hitSlop={8} onPress={async () => {
                  if (!(await confirm({ title: t('app.bl_delete'), body: x.title, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                  const res = await adminGrades.deleteRcComment(x.id);
                  if (!res.success) return toast.error(res.error || t('app.bl_delete'));
                  comments.mutate();
                }} accessibilityLabel={t('app.bl_delete')}>
                  <Icon as={Trash2} className="text-muted-foreground size-4" />
                </Pressable>
              </Pressable>
            )}
          />
        ) : null}

        {/* ── Code scales tab ── */}
        {tab === 'codes' ? (
          <DataList
            items={codeScales.data}
            error={codeScales.error}
            isLoading={codeScales.isLoading}
            isRefreshing={codeScales.isValidating && !codeScales.isLoading}
            onRefresh={() => codeScales.mutate()}
            emptyTitle={rc('no_codes')}
            keyExtractor={(x) => x.id}
            header={
              <View className="items-end px-2 pt-2">
                <Button size="sm" variant="ghost" onPress={() => setCodeScaleForm({ title: '' })} accessibilityLabel={rc('new_scale')}>
                  <Icon as={Plus} className="size-5" />
                </Button>
              </View>
            }
            renderItem={(x) => (
              <View>
                <Pressable className="flex-row items-center gap-2 px-4 py-3" onPress={() => setSelectedScaleId(selectedScaleId === x.id ? null : x.id)}>
                  <Text className="flex-1 font-medium">{x.title}</Text>
                  <Pressable hitSlop={8} onPress={() => deleteCodeScale(x)} accessibilityLabel={t('app.bl_delete')}>
                    <Icon as={Trash2} className="text-muted-foreground size-4" />
                  </Pressable>
                </Pressable>
                {selectedScaleId === x.id ? (
                  <View className="border-border mx-4 mb-3 rounded-lg border">
                    <View className="flex-row items-center justify-between px-3 py-2">
                      <Text className="text-sm font-semibold">{t('app.rc_codes_count', { count: selectedScaleCodes.length })}</Text>
                      <Button size="sm" variant="ghost" onPress={() => setCodeForm({ title: '', short_name: '', comment: '', sort_order: String(selectedScaleCodes.length + 1) })} accessibilityLabel={rc('new_code')}>
                        <Icon as={Plus} className="size-4" />
                      </Button>
                    </View>
                    {selectedScaleCodes.map((code, i) => (
                      <View key={code.id}>
                        {i > 0 ? <Separator /> : null}
                        <Pressable className="flex-row items-center gap-2 px-3 py-2" onPress={() => setCodeForm({ id: code.id, title: code.title, short_name: code.short_name ?? '', comment: code.comment ?? '', sort_order: String(code.sort_order ?? 0) })}>
                          <Text className="w-12 font-bold text-sm">{code.short_name || code.title}</Text>
                          <Text className="flex-1 text-sm">{code.title}</Text>
                          <Pressable hitSlop={8} onPress={() => deleteCode(code)} accessibilityLabel={t('app.bl_delete')}>
                            <Icon as={Trash2} className="text-muted-foreground size-3" />
                          </Pressable>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          />
        ) : null}
      </View>

      {/* ── Category dialog ── */}
      <Dialog open={!!catForm} onOpenChange={(o) => !o && setCatForm(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>{catForm?.id ? catForm.title : rc('new_category')}</DialogTitle></DialogHeader>
          {catForm ? (
            <View className="gap-2">
              <Label>{rc('cat_title')}</Label>
              <Input value={catForm.title} onChangeText={(v) => setCatForm({ ...catForm, title: v })} />
              <Label>{t('school.grades_module.report_card_comments.category_sort')}</Label>
              <Input value={catForm.sort_order} onChangeText={(v) => setCatForm({ ...catForm, sort_order: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            </View>
          ) : null}
          <DialogFooter><Button onPress={saveCat} disabled={busy}><Text>{t('app.bl_save')}</Text></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Comment dialog ── */}
      <Dialog open={!!commentForm} onOpenChange={(o) => !o && setCommentForm(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>{commentForm?.id ? t('app.bl_edit') : rc('new_comment')}</DialogTitle></DialogHeader>
          {commentForm ? (
            <View className="gap-2">
              <Label>{rc('comment_text')}</Label>
              <Input value={commentForm.title} onChangeText={(v) => setCommentForm({ ...commentForm, title: v })} multiline numberOfLines={3} />
              <Label>{rc('pick_category')}</Label>
              <FilterChips value={commentForm.category_id} onChange={(v) => setCommentForm({ ...commentForm, category_id: v })} options={catOptions} />
            </View>
          ) : null}
          <DialogFooter><Button onPress={saveComment} disabled={busy}><Text>{t('app.bl_save')}</Text></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Code scale dialog ── */}
      <Dialog open={!!codeScaleForm} onOpenChange={(o) => !o && setCodeScaleForm(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>{rc('new_scale')}</DialogTitle></DialogHeader>
          {codeScaleForm ? (
            <View className="gap-2">
              <Label>{t('school.grades_module.comment_codes.scale_title')}</Label>
              <Input value={codeScaleForm.title} onChangeText={(v) => setCodeScaleForm({ ...codeScaleForm, title: v })} />
            </View>
          ) : null}
          <DialogFooter><Button onPress={saveCodeScale} disabled={busy}><Text>{t('app.bl_save')}</Text></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Code dialog ── */}
      <Dialog open={!!codeForm} onOpenChange={(o) => !o && setCodeForm(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>{codeForm?.id ? t('app.bl_edit') : rc('new_code')}</DialogTitle></DialogHeader>
          {codeForm ? (
            <View className="gap-2">
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1">
                  <Label>{rc('code_title')}</Label>
                  <Input value={codeForm.title} onChangeText={(v) => setCodeForm({ ...codeForm, title: v })} />
                </View>
                <View className="w-20 gap-1">
                  <Label>{rc('code_short')}</Label>
                  <Input value={codeForm.short_name} onChangeText={(v) => setCodeForm({ ...codeForm, short_name: v })} />
                </View>
              </View>
              <Label>{rc('code_comment')}</Label>
              <Input value={codeForm.comment} onChangeText={(v) => setCodeForm({ ...codeForm, comment: v })} />
            </View>
          ) : null}
          <DialogFooter><Button onPress={saveCode} disabled={busy}><Text>{t('app.bl_save')}</Text></Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
