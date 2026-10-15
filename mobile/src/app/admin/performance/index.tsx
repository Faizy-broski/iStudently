import type { PerformanceAction, StaffPerformanceLog } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { FileText, Plus, Settings2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { shortName } from '@/features/admin/people';
import { actionName, EscalationPill, effectiveFine, effectivePoints, logStaffName, TypePill } from '@/features/admin/performance';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminPerformance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Staff incident log: filters, record incident with overrides, delete (web: /admin/performance). */
export default function PerformanceLog() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const logs = useApi(['admin', 'performance-logs', campusId ?? 'school'], () => adminPerformance.allLogs({ campusId }));
  const catalog = useApi(['admin', 'performance-catalog', 'active'], () => adminPerformance.catalog(true));
  const staffOptions = useApi(['admin', 'performance-staff', campusId ?? 'school'], () => adminEmployees.list('all', campusId, { page: 1, limit: 500 }));
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState('');
  const staffTerm = useDebounced(staffQuery.trim());
  const [staff, setStaff] = useState<{ id: string; name: string; number: string } | null>(null);
  const [actionId, setActionId] = useState('');
  const [points, setPoints] = useState('');
  const [fine, setFine] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const staffSearch = useApi(open && !staff && staffTerm ? ['admin', 'performance-staff-search', campusId ?? 'school', staffTerm] : null, () => adminEmployees.list('all', campusId, { page: 1, limit: 50, search: staffTerm }));

  const actions = catalog.data ?? [];
  const action = actions.find((a) => a.id === actionId) ?? null;
  const q = search.toLowerCase();
  const rows = (logs.data ?? []).filter(
    (l) =>
      (!q || logStaffName(l).toLowerCase().includes(q) || (l.staff?.employee_number ?? '').toLowerCase().includes(q)) &&
      (type === 'all' || l.action?.action_type === type) &&
      (!staffIds.length || staffIds.includes(l.staff_id)),
  );

  function openRecord() {
    setStaff(null);
    setActionId('');
    setPoints('');
    setFine('');
    setNotes('');
    setStaffQuery('');
    setOpen(true);
  }

  function pickAction(id: string) {
    setActionId(id);
    const a = actions.find((x) => x.id === id);
    if (a) {
      setPoints(String(a.default_points));
      setFine(String(a.default_fine));
    }
  }

  async function record() {
    if (!staff || !action) return toast.error(p('select_staff_action'));
    setSaving(true);
    try {
      const res = await adminPerformance.createLog({
        staff_id: staff.id,
        action_id: action.id,
        campus_id: campusId || undefined,
        custom_points: points !== '' && points !== String(action.default_points) ? Number(points) : null,
        custom_fine: fine !== '' && fine !== String(action.default_fine) ? Number(fine) : null,
        notes: notes || undefined,
      });
      if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
      toast.success(p('recorded'));
      if (res.data.letter_generated) toast.info(p('letter_flagged'));
      setOpen(false);
      logs.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: StaffPerformanceLog) {
    if (!(await confirm({ title: p('delete_title'), body: p('delete_body'), destructive: true }))) return;
    const res = await adminPerformance.deleteLog(l.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(p('deleted'));
    logs.mutate();
  }

  const optionLabel = (a: PerformanceAction) => `${actionName(a, i18n.language)} (${a.action_type === 'reward_redemption' ? '+' : ''}${a.default_points} pts)`;

  return (
    <>
      <Stack.Screen options={{ title: p('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted" className="text-sm">{p('subtitle')}</Text>
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => router.push('/admin/performance/catalog')}>
                  <Icon as={Settings2} className="text-foreground size-4" />
                  <Text>{p('manage_catalog')}</Text>
                </Button>
                <Button className="flex-1" onPress={openRecord}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{p('record_incident')}</Text>
                </Button>
              </View>
              <SearchBar value={search} onChangeText={setSearch} placeholder={p('search_staff')} />
              <Picker
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: p('all_types') },
                  { value: 'violation_demerit', label: p('violations_only') },
                  { value: 'reward_redemption', label: p('rewards_only') },
                ]}
              />
              <MultiSelect
                options={(staffOptions.data ?? []).map((s) => ({ id: s.id, label: shortName(s.profile) || s.employee_number, hint: `#${s.employee_number}` }))}
                value={staffIds}
                onChange={setStaffIds}
                placeholder={p('all_staff')}
                emptyMessage={p('no_staff')}
              />
              <Text variant="muted" className="text-xs">{p('count', { count: rows.length })}</Text>
            </View>
          }
          items={logs.data ? rows : undefined}
          error={logs.error}
          isLoading={logs.isLoading}
          isRefreshing={logs.isValidating && !logs.isLoading}
          onRefresh={() => logs.mutate()}
          emptyTitle={p('no_incidents')}
          keyExtractor={(l) => l.id}
          renderItem={(l) => {
            const demerit = l.action?.action_type === 'violation_demerit';
            const pts = effectivePoints(l);
            const f = effectiveFine(l);
            return (
              <View className="gap-1.5 px-4 py-3">
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="font-medium">{logStaffName(l)}</Text>
                    <Text className="text-muted-foreground text-xs">{l.staff?.employee_number}</Text>
                  </View>
                  {l.letter_generated ? <Icon as={FileText} className="size-4 text-orange-500" /> : null}
                  <Pressable onPress={() => remove(l)} hitSlop={8}>
                    <Icon as={Trash2} className="size-4 text-red-500" />
                  </Pressable>
                </View>
                <Text className="text-sm">{actionName(l.action, i18n.language)}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <TypePill demerit={demerit} />
                  <EscalationPill stage={l.action?.escalation_stage || 'none'} />
                  <Text className={demerit ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>{`${demerit ? pts : `+${pts}`} pts`}</Text>
                  {f !== 0 ? <Text className={demerit ? 'text-red-600' : 'text-green-600'}>{`${demerit ? '-' : '+'}${Math.abs(f)}`}</Text> : null}
                </View>
                <Text className="text-muted-foreground text-xs">{`${l.created_at ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(l.created_at)) : '—'}${l.notes ? ` · ${l.notes}` : ''}`}</Text>
              </View>
            );
          }}
        />
      </View>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('record_incident')}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
            <View className="gap-1.5">
              <Label>{`${p('staff_member')} *`}</Label>
              {staff ? (
                <View className="border-border flex-row items-center gap-2 rounded-md border p-2">
                  <Text className="flex-1 text-sm text-green-700">{`${staff.name} (${staff.number})`}</Text>
                  <Pressable onPress={() => setStaff(null)} hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              ) : (
                <View className="gap-1">
                  <SearchBar value={staffQuery} onChangeText={setStaffQuery} placeholder={p('staff_search_placeholder')} />
                  {(staffSearch.data ?? []).map((s, i) => (
                    <View key={s.id}>
                      {i > 0 ? <Separator /> : null}
                      <Pressable className="px-2 py-2.5" onPress={() => setStaff({ id: s.id, name: shortName(s.profile) || s.employee_number, number: s.employee_number })}>
                        <Text className="text-sm">
                          <Text className="font-medium">{shortName(s.profile) || s.employee_number}</Text>
                          <Text className="text-muted-foreground">{`  #${s.employee_number}`}</Text>
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View className="gap-1.5">
              <Label>{`${p('action')} *`}</Label>
              <Picker
                value={actionId}
                onChange={pickAction}
                placeholder={p('select_action')}
                options={[...actions.filter((a) => a.action_type === 'violation_demerit'), ...actions.filter((a) => a.action_type === 'reward_redemption')].map((a) => ({ value: a.id, label: optionLabel(a) }))}
              />
            </View>
            {action ? (
              <View className="gap-2">
                <View className="flex-row flex-wrap items-center gap-2">
                  <TypePill demerit={action.action_type === 'violation_demerit'} />
                  <EscalationPill stage={action.escalation_stage} />
                </View>
                {['written_warning', 'final_warning'].includes(action.escalation_stage) ? <Text className="text-xs text-orange-600">{p('letter_will_generate')}</Text> : null}
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Label>{p('points_override')}</Label>
                <Input value={points} onChangeText={(v) => setPoints(v.replace(/[^0-9.-]/g, ''))} keyboardType="numbers-and-punctuation" placeholder={p('leave_default')} />
                <Text className="text-muted-foreground text-xs">{action ? p('default_points', { value: action.default_points }) : p('select_to_see_default')}</Text>
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{p('fine_override')}</Label>
                <Input value={fine} onChangeText={(v) => setFine(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={p('leave_default')} />
                <Text className="text-muted-foreground text-xs">{action ? p('default_fine', { value: action.default_fine }) : p('select_to_see_default')}</Text>
              </View>
            </View>
            <View className="gap-1.5">
              <Label>{p('notes')}</Label>
              <Textarea value={notes} onChangeText={setNotes} placeholder={p('notes_placeholder')} className="min-h-20" />
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button onPress={record} disabled={saving || !staff || !action}>
              <Text>{p('record')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
