import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CustomFieldInputs, missingRequired } from '@/features/admin/custom-field-inputs';
import { hostelCustomFields, hostelInitialValues, ROOM_TYPES, scopeKey, useHostelScope } from '@/features/admin/hostel';
import { adminCustomFields, adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Add / edit a hostel room with its custom fields (web: rooms page dialog). */
export default function HostelRoomForm() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.rooms.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const campusId = scope ? scope.campusId : undefined;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rooms = useApi(key && id ? ['admin', 'hostel-rooms', key, ''] : null, () => adminHostel.rooms(scope!));
  const buildings = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));
  const defs = useApi(['admin', 'custom-fields', 'hostel_room', campusId ?? 'school'], () => adminCustomFields.list('hostel_room', campusId));
  const editing = id ? ((rooms.data ?? []).find((x) => x.id === id) ?? null) : null;
  const sortedDefs = [...(defs.data ?? [])].sort((a, c) => (a.sort_order || 0) - (c.sort_order || 0));

  const [buildingId, setBuildingId] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [capacity, setCapacity] = useState('1');
  const [type, setType] = useState('standard');
  const [price, setPrice] = useState('0');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const editingId = editing ? editing.id : null;
  const defsKey = (defs.data ?? []).map((x) => x.id).join(',');
  useEffect(() => {
    if (editing) {
      setBuildingId(editing.building_id);
      setNumber(editing.room_number);
      setFloor(String(editing.floor ?? 1));
      setCapacity(String(editing.capacity ?? 1));
      setType(editing.room_type || 'standard');
      setPrice(String(editing.price_per_month ?? 0));
      setDescription(editing.description ?? '');
    }
    setValues(hostelInitialValues(defs.data, editing?.custom_fields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, defsKey]);

  async function save() {
    if (!scope || !number.trim() || (!editingId && !buildingId)) return;
    const missing = missingRequired(sortedDefs, values);
    if (missing.length) return toast.error(t('app.hs_required_fields', { fields: missing.join(', ') }));
    setSaving(true);
    try {
      const body = {
        room_number: number,
        floor: parseInt(floor, 10) || 0,
        capacity: Math.max(1, parseInt(capacity, 10) || 1),
        room_type: type,
        price_per_month: parseFloat(price) || 0,
        description: description || undefined,
        custom_fields: hostelCustomFields(sortedDefs, values, editing?.custom_fields),
      };
      const res = editingId ? await adminHostel.updateRoom(scope, editingId, body) : await adminHostel.createRoom(scope, buildingId, body);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'hostel-rooms' || k[1] === 'hostel-buildings' || k[1] === 'hostel-stats'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if ((id && rooms.isLoading) || buildings.isLoading || defs.isLoading) return <LoadingList />;
  const field = (label: string, node: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {node}
    </View>
  );

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? r('dialog_edit_title') : r('dialog_add_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-4 pt-4">
            {!editingId
              ? field(
                  r('label_building'),
                  <Picker value={buildingId} onChange={setBuildingId} placeholder={r('placeholder_building')} options={(buildings.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />,
                )
              : null}
            <View className="flex-row gap-3">
              <View className="flex-1">{field(r('label_room_number'), <Input value={number} onChangeText={setNumber} placeholder={r('placeholder_room_number')} />)}</View>
              <View className="flex-1">{field(r('label_floor'), <Input value={floor} onChangeText={setFloor} keyboardType="number-pad" />)}</View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">{field(r('label_capacity'), <Input value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />)}</View>
              <View className="flex-1">{field(r('label_type'), <Picker value={type} onChange={setType} options={ROOM_TYPES.map((x) => ({ value: x, label: r(`type_${x}`) }))} />)}</View>
            </View>
            {field(r('label_price'), <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" />)}
            {field(r('label_description'), <Input value={description} onChangeText={setDescription} placeholder={r('placeholder_description')} />)}
          </CardContent>
        </Card>
        {sortedDefs.length ? <CustomFieldInputs defs={sortedDefs} values={values} onChange={(fid, v) => setValues((p) => ({ ...p, [fid]: v }))} tabName={() => r('section_additional_fields')} /> : null}
        <Button onPress={save} disabled={saving || !number.trim() || (!editingId && !buildingId)}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? r('btn_saving') : editingId ? r('btn_update') : r('btn_create')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
