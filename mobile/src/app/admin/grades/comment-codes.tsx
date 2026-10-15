import type { RcCode, RcCodeScale } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Minus, Plus, Save, Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Row<T> = T & { _new?: boolean; _dirty?: boolean; _deleted?: boolean };
const sortNum = (v: string) => (v.trim() ? parseInt(v, 10) || 0 : null);

/** Codes of one scale, edited in place and saved together (web: one tab of /admin/grades/comment-codes). */
function ScaleCodes({ scale, onSaved }: { scale: RcCodeScale; onSaved: () => void }) {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o);
  const toast = useToast();
  const [rows, setRows] = useState<Row<RcCode>[]>(() => (scale.codes ?? []).filter((c) => c.is_active !== false).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0)));
  const [draft, setDraft] = useState({ title: '', short: '', comment: '', sort: '' });
  const [saving, setSaving] = useState(false);
  const dirty = rows.some((r) => r._new || r._dirty || r._deleted);
  const visible = rows.filter((r) => !r._deleted);

  const patch = (rid: string, p: Partial<RcCode>) => setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...p, _dirty: true } : r)));
  const remove = (rid: string) => setRows((rs) => rs.flatMap((r) => (r.id !== rid ? [r] : r._new ? [] : [{ ...r, _deleted: true }])));
  const add = () => {
    if (!draft.title.trim()) return toast.error(a('cc_title_required'));
    setRows((rs) => [...rs, { id: `new-${Date.now()}`, scale_id: scale.id, title: draft.title.trim(), short_name: draft.short.trim() || null, comment: draft.comment.trim() || null, sort_order: sortNum(draft.sort), _new: true }]);
    setDraft({ title: '', short: '', comment: '', sort: '' });
  };

  async function save() {
    setSaving(true);
    let errors = 0;
    try {
      for (const r of rows.filter((x) => x._deleted && !x._new)) if (!(await adminGrades.deleteRcCode(r.id)).success) errors++;
      for (const r of rows.filter((x) => x._new && !x._deleted))
        if (!(await adminGrades.createRcCode(scale.id, { title: r.title, short_name: r.short_name || undefined, comment: r.comment || undefined, sort_order: r.sort_order ?? undefined })).success) errors++;
      for (const r of rows.filter((x) => x._dirty && !x._new && !x._deleted))
        if (!(await adminGrades.updateRcCode(r.id, { title: r.title, short_name: r.short_name ?? null, comment: r.comment ?? null, sort_order: r.sort_order ?? null })).success) errors++;
      if (errors) toast.error(a('cc_ops_failed', { count: errors }));
      else toast.success(a('cc_codes_saved'));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{a('cc_codes_in', { count: visible.length, scale: scale.title })}</Text>
          <Button size="sm" onPress={save} disabled={saving || !dirty}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{a('cc_save')}</Text>
          </Button>
        </View>
        {visible.map((r, i) => (
          <View key={r.id} className="gap-2">
            {i > 0 ? <Separator /> : null}
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => remove(r.id)} hitSlop={6} className="bg-destructive/10 rounded-full p-1" accessibilityLabel={a('cc_remove')}>
                <Icon as={Minus} className="text-destructive size-3.5" />
              </Pressable>
              <Input className="flex-1" value={r.title} onChangeText={(v) => patch(r.id, { title: v })} placeholder={a('cc_title')} />
              <Input className="w-20" value={r.short_name ?? ''} onChangeText={(v) => patch(r.id, { short_name: v || null })} placeholder={a('cc_short')} />
              <Input className="w-14" value={r.sort_order != null ? String(r.sort_order) : ''} onChangeText={(v) => patch(r.id, { sort_order: sortNum(v) })} keyboardType="number-pad" placeholder="#" />
            </View>
            <Input value={r.comment ?? ''} onChangeText={(v) => patch(r.id, { comment: v || null })} placeholder={a('cc_comment')} multiline />
          </View>
        ))}
        <Separator />
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={add} hitSlop={6} className="bg-primary/10 rounded-full p-1" accessibilityLabel={a('cc_add')}>
              <Icon as={Plus} className="text-primary size-3.5" />
            </Pressable>
            <Input className="flex-1" value={draft.title} onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder={a('cc_code_title')} onSubmitEditing={add} />
            <Input className="w-20" value={draft.short} onChangeText={(v) => setDraft((d) => ({ ...d, short: v }))} placeholder={a('cc_short')} />
            <Input className="w-14" value={draft.sort} onChangeText={(v) => setDraft((d) => ({ ...d, sort: v.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="#" />
          </View>
          <Input value={draft.comment} onChangeText={(v) => setDraft((d) => ({ ...d, comment: v }))} placeholder={a('cc_comment_placeholder')} multiline />
        </View>
      </CardContent>
    </Card>
  );
}

/** The scales themselves: rename, reorder, add, remove (web: the Scales tab). */
function ScalesEditor({ scales, onSaved }: { scales: RcCodeScale[]; onSaved: () => void }) {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o);
  const toast = useToast();
  const [rows, setRows] = useState<Row<RcCodeScale>[]>(() => scales.map((s) => ({ ...s })));
  const [title, setTitle] = useState('');
  const [sort, setSort] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = rows.some((r) => r._new || r._dirty || r._deleted);
  const patch = (rid: string, p: Partial<RcCodeScale>) => setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...p, _dirty: true } : r)));

  async function save() {
    setSaving(true);
    let errors = 0;
    try {
      for (const r of rows.filter((x) => x._deleted && !x._new)) if (!(await adminGrades.deleteRcCodeScale(r.id)).success) errors++;
      for (const r of rows.filter((x) => x._new && !x._deleted)) if (!(await adminGrades.createRcCodeScale({ title: r.title, sort_order: r.sort_order ?? undefined })).success) errors++;
      for (const r of rows.filter((x) => x._dirty && !x._new && !x._deleted)) if (!(await adminGrades.updateRcCodeScale(r.id, { title: r.title, sort_order: r.sort_order ?? null })).success) errors++;
      if (errors) toast.error(a('cc_ops_failed', { count: errors }));
      else toast.success(a('cc_scales_saved'));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-semibold">{a('cc_scales_title')}</Text>
          <Button size="sm" onPress={save} disabled={saving || !dirty}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{a('cc_save')}</Text>
          </Button>
        </View>
        {rows
          .filter((r) => !r._deleted)
          .map((r) => (
            <View key={r.id} className="flex-row items-center gap-2">
              <Pressable onPress={() => setRows((rs) => rs.flatMap((x) => (x.id !== r.id ? [x] : x._new ? [] : [{ ...x, _deleted: true }])))} hitSlop={6} className="bg-destructive/10 rounded-full p-1">
                <Icon as={Minus} className="text-destructive size-3.5" />
              </Pressable>
              <Input className="flex-1" value={r.title} onChangeText={(v) => patch(r.id, { title: v })} />
              <Input className="w-14" value={r.sort_order != null ? String(r.sort_order) : ''} onChangeText={(v) => patch(r.id, { sort_order: sortNum(v) })} keyboardType="number-pad" placeholder="#" />
            </View>
          ))}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              if (!title.trim()) return toast.error(a('cc_title_required'));
              setRows((rs) => [...rs, { id: `new-${Date.now()}`, title: title.trim(), sort_order: sortNum(sort), _new: true }]);
              setTitle('');
              setSort('');
            }}
            hitSlop={6}
            className="bg-primary/10 rounded-full p-1">
            <Icon as={Plus} className="text-primary size-3.5" />
          </Pressable>
          <Input className="flex-1" value={title} onChangeText={setTitle} placeholder={a('cc_scale_title')} />
          <Input className="w-14" value={sort} onChangeText={(v) => setSort(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="#" />
        </View>
      </CardContent>
    </Card>
  );
}

/** Comment code scales and their codes, for report card comments (web: /admin/grades/comment-codes). */
export default function CommentCodes() {
  const { t } = useTranslation();
  const c = (k: string) => t(`school.grades_module.comment_codes.${k}`);
  const { campusId, campus } = useCampus();
  const res = useApi(['admin', 'rc-code-scales', campusId ?? 'school'], () => adminGrades.rcCodeScales(campusId));
  const scales = res.data ?? [];
  const [tab, setTab] = useState<string>('');
  const active = tab === 'scales' || scales.some((s) => s.id === tab) ? tab : (scales[0]?.id ?? 'scales');
  const scale = scales.find((s) => s.id === active);
  // Re-mount editors after a save so they start from the server's rows.
  const [version, setVersion] = useState(0);
  const saved = async () => {
    await res.mutate();
    setVersion((v) => v + 1);
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">
            {c('subtitle')}
            {campus ? ` — ${campus.name}` : ''}
          </Text>
          {res.isLoading ? (
            <LoadingList rows={4} />
          ) : (
            <>
              <FilterChips value={active} onChange={setTab} options={[...scales.map((s) => ({ value: s.id, label: s.title })), { value: 'scales', label: t('app.cc_scales_tab') }]} />
              {!scales.length && active !== 'scales' ? (
                <Card>
                  <CardContent className="items-center gap-3 pt-6 pb-6">
                    <Text className="text-muted-foreground">{t('app.cc_no_scales')}</Text>
                    <Button variant="outline" onPress={() => setTab('scales')}>
                      <Icon as={Settings2} className="text-foreground size-4" />
                      <Text>{t('app.cc_manage_scales')}</Text>
                    </Button>
                  </CardContent>
                </Card>
              ) : active === 'scales' ? (
                <ScalesEditor key={`scales-${version}`} scales={scales} onSaved={saved} />
              ) : scale ? (
                <ScaleCodes key={`${scale.id}-${version}`} scale={scale} onSaved={saved} />
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
