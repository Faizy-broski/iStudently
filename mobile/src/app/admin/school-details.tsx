import type { CustomFieldDefinition } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Building2, ChevronDown, ChevronUp, Compass, GraduationCap, Layers, ListPlus, Mail, MapPin, Pencil, Phone, Save, SlidersHorizontal, Target, ThumbsUp, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CustomFieldInputs } from '@/features/admin/custom-field-inputs';
import { useCampus } from '@/features/campus/campus';
import { adminCustomFields, campuses as campusesApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Form = Record<'name' | 'address' | 'city' | 'state' | 'zip_code' | 'phone' | 'contact_email' | 'principal_name' | 'short_name' | 'school_number' | 'latitude' | 'longitude' | 'vision' | 'mission', string>;
const STANDARD = ['school_details', 'school_vision', 'school_mission'] as const;

/** Campus profile with standard and custom-field tabs, stats, tab order and edit (web: /admin/school-details). */
export default function SchoolDetails() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`school.details.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campus, campusId } = useCampus();
  const fields = useApi(campusId ? ['admin', 'custom-fields', 'school', campusId] : null, () => adminCustomFields.list('school', campusId));
  const orders = useApi(campusId ? ['admin', 'cf-orders', 'school', campusId] : null, () => adminCustomFields.categoryOrders('school', campusId));
  const stats = useApi(campusId ? ['admin', 'campus-stats', campusId] : null, ([, , id]) => campusesApi.stats(String(id)));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('school_details');
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<{ id: string; name: string }[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const custom = (campus?.custom_fields ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? '' : String(v));
  const fromCampus = (): Form => ({
    name: str(campus?.name),
    address: str(campus?.address),
    city: str(campus?.city),
    state: str(campus?.state),
    zip_code: str(campus?.zip_code),
    phone: str(campus?.phone),
    contact_email: str(campus?.contact_email),
    principal_name: str(campus?.principal_name),
    short_name: str(campus?.short_name),
    school_number: str(campus?.school_number),
    latitude: campus?.latitude != null ? String(campus.latitude) : '',
    longitude: campus?.longitude != null ? String(campus.longitude) : '',
    vision: str(custom.vision_statement ?? custom.school_vision ?? d('vision_default')),
    mission: str(custom.mission_statement ?? custom.school_mission ?? d('mission_default')),
  });
  const [form, setForm] = useState<Form>(fromCampus);
  const [values, setValues] = useState<Record<string, unknown>>(custom);
  const campusKey = campus ? `${campus.id}:${JSON.stringify(campus.custom_fields ?? {})}:${campus.name}` : null;
  useEffect(() => {
    setForm(fromCampus());
    setValues(custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusKey]);

  const tabs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; standard: boolean; fields: CustomFieldDefinition[] }>();
    for (const id of STANDARD) map.set(id, { id, name: d(id), standard: true, fields: [] });
    for (const f of fields.data ?? []) {
      if (!map.has(f.category_id)) map.set(f.category_id, { id: f.category_id, name: f.category_name || f.category_id, standard: false, fields: [] });
      map.get(f.category_id)!.fields.push(f);
    }
    const list = [...map.values()];
    const order = new Map((orders.data ?? []).map((o) => [o.category_id, o.category_order]));
    if (order.size) list.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.data, orders.data]);
  const activeTab = tabs.find((x) => x.id === tab) ?? tabs[0];

  async function save() {
    if (!campusId) return;
    setSaving(true);
    try {
      const r = await campusesApi.update(campusId, {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        phone: form.phone,
        contact_email: form.contact_email,
        principal_name: form.principal_name,
        short_name: form.short_name,
        school_number: form.school_number,
        latitude: form.latitude.trim() ? parseFloat(form.latitude) : null,
        longitude: form.longitude.trim() ? parseFloat(form.longitude) : null,
        custom_fields: { ...values, vision_statement: form.vision, school_vision: form.vision, mission_statement: form.mission, school_mission: form.mission },
      });
      if (!r.success) return toast.error(r.error || d('update_error'));
      toast.success(d('update_success'));
      setEditing(false);
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'campuses' || k[1] === 'campus'));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setForm(fromCampus());
    setValues(custom);
    setEditing(false);
    toast.info(t('app.sd_edit_cancelled'));
  }

  async function saveOrder() {
    if (!campusId) return;
    setSavingOrder(true);
    try {
      const r = await adminCustomFields.saveCategoryOrders('school', reorderList.map((x, i) => ({ category_id: x.id, category_order: i + 1 })), campusId);
      if (!r.success) return toast.error(r.error || d('tab_order_error'));
      toast.success(d('tab_order_updated'));
      setReorderOpen(false);
      orders.mutate();
    } finally {
      setSavingOrder(false);
    }
  }
  const move = (i: number, dir: -1 | 1) =>
    setReorderList((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  if (!campus || !campusId) return <EmptyState icon={Building2} title={d('no_campus_selected')} body={d('no_campus_desc')} />;

  const s = stats.data;
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof Form, label: string, opts: { multiline?: boolean; keyboard?: 'email-address' | 'phone-pad' | 'decimal-pad'; placeholder?: string } = {}) => (
    <View key={k} className="gap-1.5">
      <Label>{label}</Label>
      {opts.multiline ? (
        <Textarea value={form[k]} onChangeText={set(k)} placeholder={opts.placeholder ?? label} />
      ) : (
        <Input value={form[k]} onChangeText={set(k)} placeholder={opts.placeholder ?? label} keyboardType={opts.keyboard} autoCapitalize={opts.keyboard === 'email-address' ? 'none' : undefined} />
      )}
    </View>
  );
  const info = (icon: typeof Phone, label: string, value?: string | null, extra?: string) => (
    <View className="flex-row gap-3">
      <Icon as={icon} className="text-muted-foreground mt-0.5 size-4" />
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs font-semibold uppercase">{label}</Text>
        {value ? <Text className="font-medium">{value}</Text> : <Text className="text-muted-foreground text-sm italic">{d('not_provided')}</Text>}
        {extra ? <Text className="text-muted-foreground text-xs">{extra}</Text> : null}
      </View>
    </View>
  );
  const customBlock = (defs: CustomFieldDefinition[]) =>
    defs.length ? (
      editing ? (
        <CustomFieldInputs defs={defs} values={values} onChange={(id, v) => setValues((x) => ({ ...x, [id]: v }))} tabName={(_, fb) => fb} />
      ) : (
        <View className="gap-2">
          {defs.map((f) => (
            <View key={f.id}>
              <Text className="text-muted-foreground text-xs font-semibold">
                {f.label}
                {f.required ? ' *' : ''}
              </Text>
              <Text className="text-sm">{values[f.id] != null && values[f.id] !== '' ? (Array.isArray(values[f.id]) ? (values[f.id] as string[]).join(', ') : String(values[f.id])) : d('not_provided')}</Text>
            </View>
          ))}
        </View>
      )
    ) : null;
  const tabIcon = (id: string) => (id === 'school_details' ? Building2 : id === 'school_vision' ? Target : id === 'school_mission' ? Compass : Layers);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{d('manage_details', { name: campus.name })}</Text>
          <View className={cn('rounded-full px-2.5 py-1', campus.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-slate-100 dark:bg-slate-800')}>
            <Text className={cn('text-xs font-semibold', campus.status === 'active' ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300')}>{campus.status === 'active' ? d('active') : d('inactive')}</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {!editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setReorderList(tabs.map((x) => ({ id: x.id, name: x.name })));
                  setReorderOpen(true);
                }}>
                <Icon as={SlidersHorizontal} className="text-foreground size-4" />
                <Text>{d('reorder_tabs')}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/fields', params: { entity: 'school' } })}>
                <Icon as={ListPlus} className="text-foreground size-4" />
                <Text>{t('app.sd_custom_fields')}</Text>
              </Button>
              <Button size="sm" onPress={() => setEditing(true)}>
                <Icon as={Pencil} className="text-primary-foreground size-4" />
                <Text>{d('edit_campus')}</Text>
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onPress={cancel} disabled={saving}>
                <Icon as={X} className="text-foreground size-4" />
                <Text>{d('cancel')}</Text>
              </Button>
              <Button size="sm" onPress={save} disabled={saving}>
                <Icon as={Save} className="text-primary-foreground size-4" />
                <Text>{d('save_changes')}</Text>
              </Button>
            </>
          )}
        </View>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Building2} className="text-primary size-5" />
              <Text className="text-primary flex-1 text-lg font-bold">{campus.name}</Text>
              {editing ? (
                <View className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 dark:bg-amber-950">
                  <Text className="text-xs text-amber-800 dark:text-amber-300">{t('app.sd_editing')}</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-muted-foreground text-xs">{editing ? d('edit_desc') : d('details_for', { name: campus.name })}</Text>
            <FilterChips value={activeTab?.id ?? 'school_details'} onChange={setTab} options={tabs.map((x) => ({ value: x.id, label: x.fields.length ? `${x.name} (${x.fields.length})` : x.name }))} />
            <View className="flex-row items-center gap-2">
              <Icon as={tabIcon(activeTab?.id ?? '')} className="text-primary size-4" />
              <Text className="font-semibold">{activeTab?.name}</Text>
            </View>

            {activeTab?.id === 'school_details' ? (
              editing ? (
                <View className="gap-3">
                  {field('name', `${d('campus_name')} *`)}
                  {field('short_name', d('short_name'), { placeholder: 'e.g. SMS, Main Campus' })}
                  {field('school_number', d('campus_number'))}
                  {field('phone', d('phone'), { keyboard: 'phone-pad' })}
                  {field('contact_email', d('email'), { keyboard: 'email-address', placeholder: 'campus@school.com' })}
                  {field('principal_name', d('principal'))}
                  {field('address', d('address'), { multiline: true })}
                  {field('city', d('city'))}
                  {field('state', d('state'))}
                  {field('zip_code', d('zip_code'))}
                  <View className="flex-row gap-2">
                    <View className="flex-1">{field('latitude', t('app.sd_latitude'), { keyboard: 'decimal-pad', placeholder: '24.7136' })}</View>
                    <View className="flex-1">{field('longitude', t('app.sd_longitude'), { keyboard: 'decimal-pad', placeholder: '46.6753' })}</View>
                  </View>
                  <Text className="text-muted-foreground text-xs">{t('app.sd_coordinates_hint')}</Text>
                  {customBlock(activeTab.fields)}
                </View>
              ) : (
                <View className="gap-3">
                  {info(Building2, d('campus_name'), campus.name, campus.short_name ? `${d('short_name')}: ${campus.short_name}` : undefined)}
                  {campus.school_number ? info(Layers, d('campus_number'), campus.school_number) : null}
                  {campus.principal_name ? info(GraduationCap, d('principal'), campus.principal_name) : null}
                  {info(MapPin, d('address'), campus.address, [campus.city, campus.state, campus.zip_code].filter(Boolean).join(', ') || undefined)}
                  {info(Phone, d('phone'), campus.phone)}
                  {info(Mail, d('email'), campus.contact_email)}
                  <View className="gap-1">
                    <Text className="text-muted-foreground text-xs font-semibold uppercase">{t('app.sd_location_on_map')}</Text>
                    {campus.latitude != null && campus.longitude != null ? (
                      <Button size="sm" variant="outline" className="self-start" onPress={() => Linking.openURL(`https://www.google.com/maps?q=${campus.latitude},${campus.longitude}`)}>
                        <Icon as={MapPin} className="text-foreground size-4" />
                        <Text>{t('app.sd_open_in_google_maps')}</Text>
                      </Button>
                    ) : (
                      <Text className="text-muted-foreground text-sm italic">{d('not_provided')}</Text>
                    )}
                  </View>
                  {customBlock(activeTab.fields)}
                </View>
              )
            ) : activeTab?.id === 'school_vision' || activeTab?.id === 'school_mission' ? (
              <View className="gap-3">
                {(() => {
                  const k = activeTab.id === 'school_vision' ? 'vision' : 'mission';
                  return editing ? (
                    <View className="gap-1.5">
                      <Label>{d(`${k}_statement`)}</Label>
                      <Textarea value={form[k]} onChangeText={set(k)} placeholder={d(`${k}_placeholder`)} className="min-h-28" />
                    </View>
                  ) : (
                    <View className="bg-muted/40 rounded-lg p-4">
                      <Text className="text-muted-foreground mb-1 text-xs font-semibold uppercase">{d(`${k}_statement`)}</Text>
                      <Text className="italic">“{form[k] || d(`${k}_default`)}”</Text>
                    </View>
                  );
                })()}
                {customBlock(activeTab.fields)}
              </View>
            ) : activeTab ? (
              activeTab.fields.length ? (
                customBlock(activeTab.fields)
              ) : (
                <View className="gap-1 py-4">
                  <Text className="text-muted-foreground text-center text-sm">{t('app.sd_no_fields', { name: activeTab.name })}</Text>
                  <Text className="text-muted-foreground text-center text-xs">{t('app.sd_no_fields_hint')}</Text>
                </View>
              )
            ) : null}
          </CardContent>
        </Card>

        <View className="flex-row flex-wrap gap-2">
          <StatTile icon={Users} label={d('students')} value={s?.total_students ?? 0} sub={`${d('boys')}: ${s?.boys_count ?? 0}  ${d('girls')}: ${s?.girls_count ?? 0}`} tone="bg-blue-600" />
          <StatTile icon={Users} label={d('parents')} value={s?.total_parents ?? 0} sub={d('total_registered_parents')} tone="bg-violet-600" />
          <StatTile icon={GraduationCap} label={d('teachers')} value={s?.total_teachers ?? 0} sub={`${d('male')}: ${s?.male_teachers ?? 0}  ${d('female')}: ${s?.female_teachers ?? 0}`} tone="bg-emerald-600" />
          <StatTile icon={Users} label={d('staff')} value={s?.total_staff ?? 0} sub={`${d('male')}: ${s?.male_staff ?? 0}  ${d('female')}: ${s?.female_staff ?? 0}`} tone="bg-amber-600" />
          <StatTile icon={ThumbsUp} label={d('present_students_today')} value={s?.present_today ?? 0} sub={`${d('attendance_percentage')}: ${s ? parseFloat(s.attendance_percentage_today.toFixed(1)) : 0}%`} tone="bg-teal-600" />
        </View>
      </ScrollView>

      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{d('reorder_tabs')}</DialogTitle>
          </DialogHeader>
          <Text className="text-muted-foreground text-xs">{d('tab_reorder_desc')}</Text>
          <View className="gap-1.5">
            {reorderList.map((x, i) => (
              <View key={x.id} className="border-border flex-row items-center gap-2 rounded-md border px-3 py-2">
                <Text className="text-muted-foreground w-5 text-xs">{i + 1}</Text>
                <Text className="flex-1 text-sm">{x.name}</Text>
                <Button size="icon" variant="ghost" disabled={i === 0} onPress={() => move(i, -1)} accessibilityLabel={t('app.sd_move_up')}>
                  <Icon as={ChevronUp} className="text-foreground size-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={i === reorderList.length - 1} onPress={() => move(i, 1)} accessibilityLabel={t('app.sd_move_down')}>
                  <Icon as={ChevronDown} className="text-foreground size-4" />
                </Button>
              </View>
            ))}
          </View>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setReorderOpen(false)}>
              <Text>{d('cancel')}</Text>
            </Button>
            <Button onPress={saveOrder} disabled={savingOrder}>
              <Text>{d('save_tab_order')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}

function StatTile({ icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: number; sub: string; tone: string }) {
  return (
    <View className={cn('min-w-[47%] flex-1 gap-1 rounded-xl p-3', tone)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-white uppercase opacity-90" numberOfLines={1}>
          {label}
        </Text>
        <Icon as={icon} className="size-5 text-white" />
      </View>
      <Text className="text-2xl font-bold text-white">{value}</Text>
      <Text className="text-xs text-white opacity-90">{sub}</Text>
    </View>
  );
}
