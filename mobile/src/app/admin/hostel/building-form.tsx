import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CustomFieldInputs, missingRequired } from '@/features/admin/custom-field-inputs';
import { hostelCustomFields, hostelInitialValues, scopeKey, useHostelScope } from '@/features/admin/hostel';
import { adminCustomFields, adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Add / edit a hostel building with its custom fields (web: buildings page dialog). */
export default function HostelBuildingForm() {
  const { t } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.buildings.${k}`, o);
  const toast = useToast();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const campusId = scope ? scope.campusId : undefined;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));
  const defs = useApi(['admin', 'custom-fields', 'hostel_building', campusId ?? 'school'], () => adminCustomFields.list('hostel_building', campusId));
  const editing = id ? ((list.data ?? []).find((x) => x.id === id) ?? null) : null;
  const sortedDefs = [...(defs.data ?? [])].sort((a, c) => (a.sort_order || 0) - (c.sort_order || 0));

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floors, setFloors] = useState('1');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const editingId = editing ? editing.id : null;
  const defsKey = (defs.data ?? []).map((x) => x.id).join(',');
  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setAddress(editing.address ?? '');
      setFloors(String(editing.floors ?? 1));
      setDescription(editing.description ?? '');
    }
    setValues(hostelInitialValues(defs.data, editing?.custom_fields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, defsKey]);

  async function save() {
    if (!scope || !name.trim()) return;
    const missing = missingRequired(sortedDefs, values);
    if (missing.length) return toast.error(t('app.hs_required_fields', { fields: missing.join(', ') }));
    setSaving(true);
    try {
      const body = { name, address: address || undefined, floors: parseInt(floors, 10) || 1, description: description || undefined, custom_fields: hostelCustomFields(sortedDefs, values, editing?.custom_fields) };
      const r = editingId ? await adminHostel.updateBuilding(scope, editingId, body) : await adminHostel.createBuilding(scope, body);
      if (!r.success) return toast.error(r.error || b('msg_save_error'));
      toast.success(b('msg_save_success'));
      await list.mutate();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (list.isLoading || defs.isLoading) return <LoadingList />;

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? b('dialog_edit_title') : b('dialog_add_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-4 pt-4">
            <View className="gap-1.5">
              <Label>{b('label_name')}</Label>
              <Input value={name} onChangeText={setName} placeholder={b('placeholder_name')} />
            </View>
            <View className="gap-1.5">
              <Label>{b('label_address')}</Label>
              <Input value={address} onChangeText={setAddress} placeholder={b('placeholder_address')} />
            </View>
            <View className="gap-1.5">
              <Label>{b('label_floors')}</Label>
              <Input value={floors} onChangeText={setFloors} keyboardType="number-pad" className="w-28" />
            </View>
            <View className="gap-1.5">
              <Label>{b('label_description')}</Label>
              <Input value={description} onChangeText={setDescription} placeholder={b('placeholder_description')} />
            </View>
          </CardContent>
        </Card>
        {sortedDefs.length ? (
          <CustomFieldInputs defs={sortedDefs} values={values} onChange={(fid, v) => setValues((p) => ({ ...p, [fid]: v }))} tabName={() => b('section_additional_fields')} />
        ) : null}
        <Button onPress={save} disabled={saving || !name.trim()}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? b('btn_saving') : editingId ? b('btn_update') : b('btn_create')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
