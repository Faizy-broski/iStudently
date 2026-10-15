import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Hostel configuration, stored on the school-wide settings row (web: /admin/hostel/settings). */
export default function HostelSettings() {
  const { t } = useTranslation();
  const s = (k: string) => t(`admin.hostel.settings.${k}`);
  const toast = useToast();
  const res = useApi(['admin', 'school-settings', 'school'], () => adminSchool.getSettings());
  const [autoRemove, setAutoRemove] = useState(false);
  const [saving, setSaving] = useState(false);

  const stored = (res.data?.hostel as { auto_remove_inactive?: boolean } | undefined)?.auto_remove_inactive;
  useEffect(() => {
    if (stored !== undefined) setAutoRemove(!!stored);
  }, [stored]);

  async function save() {
    setSaving(true);
    try {
      const r = await adminSchool.updateSettings({ hostel: { auto_remove_inactive: autoRemove } });
      if (!r.success) return toast.error(r.error || s('msg_save_error'));
      toast.success(s('msg_save_success'));
      res.mutate();
    } catch {
      toast.error(s('msg_save_error'));
    } finally {
      setSaving(false);
    }
  }

  if (res.isLoading) return <LoadingList />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('header_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-4 pt-4">
            <View>
              <Text className="font-semibold">{s('card_rooms')}</Text>
              <Text className="text-muted-foreground text-sm">{s('card_rooms_desc')}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-medium">{s('label_auto_remove')}</Text>
                <Text className="text-muted-foreground text-sm">{s('label_auto_remove_desc')}</Text>
              </View>
              <Switch checked={autoRemove} onCheckedChange={setAutoRemove} />
            </View>
            <Button className="self-start" onPress={save} disabled={saving}>
              <Icon as={Save} className="text-primary-foreground size-4" />
              <Text>{saving ? s('btn_saving') : s('btn_save')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
