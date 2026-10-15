import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { SchoolLogo } from '@/components/app/school-logo';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { campuses as campusesApi, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';

const FIELDS = [
  ['name', 'label_name', 'placeholder_name'],
  ['short_name', 'label_short_name', 'placeholder_short_name'],
  ['school_number', 'label_code', 'placeholder_code'],
  ['address', 'label_address', 'placeholder_address'],
  ['city', 'label_city', 'placeholder_city'],
  ['state', 'label_state', 'placeholder_state'],
  ['zip_code', 'label_zip', 'placeholder_zip'],
  ['contact_email', 'label_email', 'placeholder_email'],
  ['phone', 'label_phone', 'placeholder_phone'],
  ['principal_name', 'label_principal', 'placeholder_principal'],
] as const;
type Key = (typeof FIELDS)[number][0];

/** Add or edit a campus; the logo goes through the API upload (web: campus dialog on /admin/settings/campuses). */
export default function CampusForm() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`school.campuses.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const campusId = id || null;
  const existing = useApi(campusId ? ['admin', 'campus', campusId] : null, ([, , cid]) => campusesApi.get(String(cid)));
  const [form, setForm] = useState<Record<Key, string>>({ name: '', short_name: '', school_number: '', address: '', city: '', state: '', zip_code: '', contact_email: '', phone: '', principal_name: '' });
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedId = existing.data?.id ?? null;
  useEffect(() => {
    const x = existing.data;
    if (!x) return;
    setForm({ name: x.name, short_name: x.short_name ?? '', school_number: x.school_number ?? '', address: x.address ?? '', city: x.city ?? '', state: x.state ?? '', zip_code: x.zip_code ?? '', contact_email: x.contact_email ?? '', phone: x.phone ?? '', principal_name: x.principal_name ?? '' });
    setLogo(x.logo_url ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  async function upload() {
    const picked = await pickImage({ maxDimension: 512 });
    if (!picked.ok) return;
    setUploading(true);
    try {
      const r = await media.uploadImage(picked.file);
      if (!r.success || !r.data) return toast.error(c('logo_upload_failed', { error: r.error ?? '' }));
      setLogo(r.data.url);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.name.trim()) return toast.error(c('name_required'));
    setSaving(true);
    try {
      const body = { ...form, logo_url: logo };
      const r = campusId ? await campusesApi.update(campusId, body) : await campusesApi.create(body);
      if (!r.success) return toast.error(r.error || (campusId ? c('update_error') : c('create_error')));
      toast.success(campusId ? c('update_success') : c('create_success'));
      await mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'campuses' || k[1] === 'campuses-settings' || k[1] === 'campus'));
      const created = r.data;
      if (!campusId && created?.id) router.replace({ pathname: '/admin/settings/copy-settings', params: { id: created.id, name: created.name } });
      else router.back();
    } finally {
      setSaving(false);
    }
  }

  if (campusId && existing.isLoading) return <LoadingList />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: campusId ? c('btn_edit') : c('btn_new') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{campusId ? c('edit_desc') : c('add_desc')}</Text>
        <Card>
          <CardContent className="gap-3 pt-4">
            <Label>{c('label_logo')}</Label>
            <View className="flex-row items-center gap-3">
              <SchoolLogo url={logo} size={56} />
              <Button size="sm" variant="outline" onPress={upload} disabled={uploading}>
                <Icon as={ImagePlus} className="text-foreground size-4" />
                <Text>{logo ? c('label_logo_change') : c('label_logo_upload')}</Text>
              </Button>
              {logo ? (
                <Button size="sm" variant="ghost" onPress={() => setLogo(null)}>
                  <Text className="text-destructive">{c('label_logo_remove')}</Text>
                </Button>
              ) : null}
            </View>
            <Text className="text-muted-foreground text-xs">{c('label_logo_hint')}</Text>
            {FIELDS.map(([k, label, ph]) => (
              <View key={k} className="gap-1.5">
                <Label>{c(label)}</Label>
                <Input value={form[k]} onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))} placeholder={c(ph)} keyboardType={k === 'contact_email' ? 'email-address' : k === 'phone' ? 'phone-pad' : 'default'} autoCapitalize={k === 'contact_email' ? 'none' : undefined} />
              </View>
            ))}
          </CardContent>
        </Card>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{c('btn_cancel')}</Text>
          </Button>
          <Button onPress={submit} disabled={saving || uploading}>
            <Text>{saving ? c('btn_saving') : campusId ? c('btn_update') : c('btn_create')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
