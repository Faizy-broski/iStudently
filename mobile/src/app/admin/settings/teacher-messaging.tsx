import { Stack } from 'expo-router';
import { Info, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useCampus } from '@/features/campus/campus';
import { messaging } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Which staff members teachers may message (web: /admin/settings/teacher-messaging). */
export default function TeacherMessagingSettings() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`app.tm_${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['messaging', 'teacher-allowed', campusId ?? 'school'], () => messaging.getTeacherAllowedStaff(campusId));
  const staff = res.data ?? [];
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (res.data) setAllowed(new Set(res.data.filter((x) => x.isAllowed).map((x) => x.profileId)));
  }, [res.data]);

  const q = search.trim().toLowerCase();
  const filtered = q ? staff.filter((x) => x.name.toLowerCase().includes(q) || x.role.toLowerCase().includes(q)) : staff;
  const allVisible = filtered.length > 0 && filtered.every((x) => allowed.has(x.profileId));
  const toggle = (id: string) =>
    setAllowed((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function save() {
    setSaving(true);
    try {
      const r = await messaging.setTeacherAllowedStaff([...allowed], campusId);
      if (!r.success) return toast.error(r.error || s('save_failed'));
      toast.success(s('saved'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>
        <View className="flex-row gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
          <Icon as={Info} className="size-5 text-blue-600" />
          <View className="flex-1">
            <Text className="text-sm font-medium text-blue-800 dark:text-blue-300">{s('how_title')}</Text>
            <Text className="text-sm text-blue-800 dark:text-blue-300">{s('how_body')}</Text>
          </View>
        </View>
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{s('staff')}</Text>
            <Text className="text-muted-foreground text-xs">{s('approved_count', { allowed: allowed.size, total: staff.length })}</Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder={s('search_ph')} />
            {res.isLoading ? (
              <LoadingList rows={4} />
            ) : !staff.length ? (
              <Text className="text-muted-foreground py-8 text-center text-sm">{s('none')}</Text>
            ) : (
              <View>
                <CheckRow
                  checked={allVisible}
                  onPress={() =>
                    setAllowed((p) => {
                      const n = new Set(p);
                      for (const x of filtered) (allVisible ? n.delete(x.profileId) : n.add(x.profileId));
                      return n;
                    })
                  }
                  label={s('select_all', { count: filtered.length })}
                />
                <Separator className="my-1" />
                {filtered.map((x) => (
                  <View key={x.profileId} className="py-1">
                    <CheckRow checked={allowed.has(x.profileId)} onPress={() => toggle(x.profileId)} label={`${x.name || s('unnamed')} · ${x.title || x.role}`} />
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{s('save')}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
