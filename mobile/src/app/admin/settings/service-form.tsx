import type { ChargeFrequency, ServiceType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminServices } from '@/lib/api';
import { useApi } from '@/lib/data';

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Add / edit a school service: details tab + per-grade pricing tab (web: services page dialog). */
export default function ServiceForm() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.services.${k}`, o);
  const toast = useToast();
  const { money } = useCurrency();
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useApi(['admin', 'services', campusId ?? 'school'], () => adminServices.list(campusId));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const editing = id ? ((list.data ?? []).find((x) => x.id === id) ?? null) : null;

  const [tab, setTab] = useState<'details' | 'pricing'>('details');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('recurring');
  const [frequency, setFrequency] = useState<ChargeFrequency>('monthly');
  const [defaultCharge, setDefaultCharge] = useState('0');
  const [mandatory, setMandatory] = useState(false);
  const [gradeCharges, setGradeCharges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editingId = editing ? editing.id : null;
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setCode(editing.code);
    setDescription(editing.description ?? '');
    setServiceType(editing.service_type);
    setFrequency(editing.charge_frequency);
    setDefaultCharge(String(editing.default_charge ?? 0));
    setMandatory(editing.is_mandatory);
    const charges: Record<string, string> = {};
    for (const gc of editing.grade_charges ?? []) charges[gc.grade_level_id] = String(gc.charge_amount);
    setGradeCharges(charges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  async function save() {
    if (!name.trim() || !code.trim()) return toast.error(s('msg_required'));
    setSaving(true);
    try {
      const body = { name, code, description, service_type: serviceType, charge_frequency: frequency, default_charge: num(defaultCharge), is_mandatory: mandatory };
      const r = editingId ? await adminServices.update(editingId, body) : await adminServices.create(body, campusId);
      if (!r.success) return toast.error(r.error || t('app.svc_save_failed'));
      const serviceId = editingId ?? r.data?.id;
      if (serviceId && Object.keys(gradeCharges).length > 0) {
        const charges = Object.entries(gradeCharges)
          .map(([grade_level_id, v]) => ({ grade_level_id, charge_amount: num(v) }))
          .filter((c) => c.charge_amount > 0);
        const g = await adminServices.setGradeCharges(serviceId, charges);
        if (!g.success) return toast.error(g.error || t('app.svc_save_failed'));
      }
      toast.success(editingId ? s('update_success') : s('create_success'));
      await list.mutate();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (list.isLoading) return <LoadingList />;

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? s('dialog_edit') : s('dialog_add') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{s('dialog_subtitle')}</Text>
        <FilterChips
          value={tab}
          onChange={setTab}
          options={[
            { value: 'details', label: s('tab_details') },
            { value: 'pricing', label: s('tab_pricing') },
          ]}
        />
        {tab === 'details' ? (
          <Card>
            <CardContent className="gap-4 pt-4">
              <View className="gap-1.5">
                <Label>{s('label_name')}</Label>
                <Input value={name} onChangeText={setName} placeholder={s('placeholder_name')} />
              </View>
              <View className="gap-1.5">
                <Label>{s('label_code')}</Label>
                <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder={s('placeholder_code')} />
              </View>
              <View className="gap-1.5">
                <Label>{s('label_desc')}</Label>
                <Input value={description} onChangeText={setDescription} placeholder={s('placeholder_desc')} />
              </View>
              <View className="gap-1.5">
                <Label>{s('label_type')}</Label>
                <Picker
                  value={serviceType}
                  onChange={(v) => setServiceType(v as ServiceType)}
                  options={[
                    { value: 'recurring', label: s('type_recurring') },
                    { value: 'one_time', label: s('type_one_time') },
                  ]}
                />
              </View>
              <View className="gap-1.5">
                <Label>{s('label_frequency')}</Label>
                <Picker
                  value={frequency}
                  onChange={(v) => setFrequency(v as ChargeFrequency)}
                  options={(['monthly', 'quarterly', 'yearly', 'one_time'] as const).map((f) => ({ value: f, label: s(`freq_${f}`) }))}
                />
              </View>
              <View className="gap-1.5">
                <Label>{s('label_default_charge')}</Label>
                <Input value={defaultCharge} onChangeText={setDefaultCharge} keyboardType="decimal-pad" />
              </View>
              <View className="flex-row items-center gap-3">
                <Switch checked={mandatory} onCheckedChange={setMandatory} />
                <Label onPress={() => setMandatory((v) => !v)}>{s('label_mandatory_switch')}</Label>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="text-muted-foreground text-sm">{s('pricing_hint')}</Text>
              {grades.isLoading ? (
                <LoadingList rows={4} />
              ) : (
                (grades.data ?? []).map((g, i) => (
                  <View key={g.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="flex-row items-center gap-3 py-2">
                      <Text className="flex-1">{g.name}</Text>
                      <Input
                        className="w-32"
                        keyboardType="decimal-pad"
                        value={gradeCharges[g.id] ?? ''}
                        placeholder={s('placeholder_grade_charge', { amount: money(num(defaultCharge)) })}
                        onChangeText={(v) => setGradeCharges((p) => ({ ...p, [g.id]: v }))}
                      />
                    </View>
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        )}
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{s('btn_cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? s('btn_saving') : s('btn_save')}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
