import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLc } from '@/features/admin/jitsi';
import { useCampus } from '@/features/campus/campus';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';

function Form({ initial }: { initial: string }) {
  const l = useLc();
  const toast = useToast();
  const { campusId } = useCampus();
  const [domain, setDomain] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await jitsi.saveSettings({ jitsi_domain: domain }, campusId);
      if (!r.success) return toast.error(r.error || l('toast_config_error'));
      toast.success(l('toast_config_saved'));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="text-muted-foreground text-sm">{l('configuration_desc')}</Text>
        <View className="gap-1.5">
          <Label>{l('jitsi_domain_label')}</Label>
          <Input value={domain} onChangeText={setDomain} placeholder={l('jitsi_domain_placeholder')} autoCapitalize="none" keyboardType="url" />
          <Text className="text-muted-foreground text-xs">{l('jitsi_domain_help')}</Text>
        </View>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? l('saving') : l('save')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

/** The school's Jitsi host for live classes (web: /admin/jitsi-meet/configuration). */
export default function JitsiConfiguration() {
  const l = useLc();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'jitsi-settings', campusId ?? 'school'], () => jitsi.settings(campusId));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('configuration') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {res.isLoading ? <LoadingList rows={2} /> : <Form key={campusId ?? 'school'} initial={res.data?.jitsi_domain ?? ''} />}
      </ScrollView>
    </View>
  );
}
