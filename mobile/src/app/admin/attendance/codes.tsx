import type { AttendanceCodeType, AttendanceStateCode } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Minus, Plus, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceCodes, useAttendanceScope } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';

interface CodeRow {
  id?: string;
  title: string;
  short_name: string;
  sort_order: number;
  type: AttendanceCodeType;
  is_default: boolean;
  state_code: AttendanceStateCode;
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

const EMPTY_NEW = { title: '', short_name: '', sort_order: '', type: 'both' as AttendanceCodeType, is_default: false, state_code: 'P' as AttendanceStateCode };

/** Attendance codes: inline edit, add, delete, save all (web: /admin/attendance/codes). */
export default function AttendanceCodes() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId, campusId } = useAttendanceScope();
  const codes = useAttendanceCodes(true);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [nw, setNw] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (codes.data) setRows(codes.data.map((c) => ({ id: c.id, title: c.title, short_name: c.short_name, sort_order: c.sort_order, type: c.type, is_default: c.is_default, state_code: c.state_code })));
  }, [codes.data]);

  const typeOptions = (['both', 'teacher', 'official'] as const).map((v) => ({ value: v, label: a(`codeTypes.${v}`) }));
  const stateOptions = (['P', 'A', 'H'] as const).map((v) => ({ value: v, label: a(`stateCodes.${v}`) }));

  const update = (idx: number, patch: Partial<CodeRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : patch.is_default ? { ...r, is_default: false, _dirty: true } : r)));
    if (patch.is_default) setNw((n) => ({ ...n, is_default: false }));
  };

  async function markDelete(idx: number) {
    const row = rows[idx];
    if (!row.id) return setRows((p) => p.filter((_, i) => i !== idx));
    if (await confirm({ title: a('codes_deleteConfirm', { title: row.title }), destructive: true })) {
      setRows((p) => p.map((r, i) => (i === idx ? { ...r, _deleted: true } : r)));
    }
  }

  const newRow = (sortFallback: number): CodeRow => ({
    title: nw.title.trim(),
    short_name: nw.short_name.trim(),
    sort_order: nw.sort_order ? parseInt(nw.sort_order, 10) : sortFallback,
    type: nw.type,
    is_default: nw.is_default,
    state_code: nw.state_code,
    _isNew: true,
    _dirty: true,
  });

  function addNew() {
    if (!nw.title.trim() || !nw.short_name.trim()) return toast.error(a('codes_required'));
    setRows((p) => [...p, newRow(0)]);
    setNw(EMPTY_NEW);
  }

  async function save() {
    if (!schoolId) return;
    const current = [...rows];
    if (nw.title.trim() || nw.short_name.trim()) {
      if (!nw.title.trim() || !nw.short_name.trim()) return toast.error(a('codes_required'));
      current.push(newRow((current.length + 1) * 10));
      setNw(EMPTY_NEW);
    }
    setSaving(true);
    let errors = 0;
    try {
      for (const r of current.filter((x) => x._deleted && x.id)) {
        const res = await adminAttendance.deleteCode(r.id!);
        if (!res.success) (errors++, toast.error(`${r.title}: ${res.error ?? ''}`));
      }
      for (const r of current.filter((x) => x._isNew && !x._deleted)) {
        const res = await adminAttendance.createCode({ school_id: schoolId, campus_id: campusId ?? null, title: r.title, short_name: r.short_name, state_code: r.state_code, type: r.type, is_default: r.is_default, sort_order: r.sort_order });
        if (!res.success) (errors++, toast.error(`${r.title}: ${res.error ?? ''}`));
      }
      for (const r of current.filter((x) => x._dirty && !x._isNew && !x._deleted && x.id)) {
        const res = await adminAttendance.updateCode(r.id!, { title: r.title, short_name: r.short_name, sort_order: r.sort_order, type: r.type, is_default: r.is_default, state_code: r.state_code });
        if (!res.success) (errors++, toast.error(`${r.title}: ${res.error ?? ''}`));
      }
      if (!errors) toast.success(a('codes_saved'));
      await codes.mutate();
    } catch {
      toast.error(a('codes_saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const canSave = rows.some((r) => r._dirty || r._deleted || r._isNew) || !!nw.title.trim() || !!nw.short_name.trim();

  const editor = (row: Pick<CodeRow, 'title' | 'short_name' | 'type' | 'is_default' | 'state_code'> & { sort: string }, set: (p: Partial<CodeRow> & { sort?: string }) => void) => (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{a('codes_th_title')}</Label>
          <Input value={row.title} onChangeText={(v) => set({ title: v })} placeholder={a('codes_titlePlaceholder')} />
        </View>
        <View className="w-20 gap-1">
          <Label>{a('codes_th_code')}</Label>
          <Input value={row.short_name} onChangeText={(v) => set({ short_name: v })} placeholder={a('codes_codePlaceholder')} />
        </View>
        <View className="w-16 gap-1">
          <Label>{a('codes_th_sortOrder')}</Label>
          <Input value={row.sort} onChangeText={(v) => set({ sort: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{a('codes_th_type')}</Label>
          <Picker value={row.type} onChange={(v) => set({ type: v as AttendanceCodeType })} options={typeOptions} />
        </View>
        <View className="flex-1 gap-1">
          <Label>{a('codes_th_stateCode')}</Label>
          <Picker value={row.state_code} onChange={(v) => set({ state_code: v as AttendanceStateCode })} options={stateOptions} />
        </View>
      </View>
      <CheckRow checked={row.is_default} onPress={() => set({ is_default: !row.is_default })} label={`${a('codes_th_default')}: ${row.is_default ? t('common.yes') : t('common.no')}`} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: a('codes_title') }} />
      <View className="bg-background flex-1">
        {codes.isLoading && !rows.length ? (
          <LoadingList />
        ) : (
          <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
            {rows.map((r, idx) =>
              r._deleted ? null : (
                <Card key={r.id ?? `new-${idx}`}>
                  <CardContent className="gap-2 pt-4">
                    <View className="flex-row justify-end">
                      <Pressable onPress={() => markDelete(idx)} hitSlop={8} className="flex-row items-center gap-1" accessibilityLabel={t('common.delete')}>
                        <Icon as={Minus} className="text-destructive size-4" />
                        <Text className="text-destructive text-xs">{t('common.delete')}</Text>
                      </Pressable>
                    </View>
                    {editor({ ...r, sort: r.sort_order ? String(r.sort_order) : '' }, ({ sort, ...p }) => update(idx, sort !== undefined ? { ...p, sort_order: parseInt(sort, 10) || 0 } : p))}
                  </CardContent>
                </Card>
              ),
            )}
            <Card className="bg-muted/30">
              <CardContent className="gap-2 pt-4">
                {editor({ ...nw, sort: nw.sort_order }, ({ sort, ...p }) => {
                  setNw((n) => ({ ...n, title: p.title ?? n.title, short_name: p.short_name ?? n.short_name, type: p.type ?? n.type, is_default: p.is_default ?? n.is_default, state_code: p.state_code ?? n.state_code, sort_order: sort ?? n.sort_order }));
                  if (p.is_default) setRows((prev) => prev.map((r) => ({ ...r, is_default: false, _dirty: true })));
                })}
                <Button variant="outline" onPress={addNew}>
                  <Icon as={Plus} className="text-foreground size-4" />
                  <Text>{t('common.add')}</Text>
                </Button>
              </CardContent>
            </Card>
          </ScrollView>
        )}
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={save} disabled={saving || !canSave}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{t('common.save')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
