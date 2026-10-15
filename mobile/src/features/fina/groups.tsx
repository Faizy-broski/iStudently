import type { FinaGroup } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Groups: create, join, leave (web: /admin/fina/groups). */
export function FinaGroupsScreen({ canCreate }: { canCreate: boolean }) {
  const { f } = useFn('groups');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-groups', campusId ?? 'school'], () => fina.groups(campusId));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setBusy(key);
    try {
      const r = await fn();
      if (!r.success) return toast.error(r.error || '');
      after?.();
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  const toggle = (g: FinaGroup) => run(g.id, () => (g.isMember ? fina.leaveGroup(g.id, campusId) : fina.joinGroup(g.id, campusId)));

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('page_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {canCreate ? (
          <View className="flex-row gap-2">
            <Input className="flex-1" value={name} onChangeText={setName} placeholder={f('name_placeholder')} />
            <Button
              size="icon"
              onPress={() =>
                run(
                  'new',
                  () => fina.createGroup({ name: name.trim() }, campusId),
                  () => setName(''),
                )
              }
              disabled={busy === 'new' || !name.trim()}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
            </Button>
          </View>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{f('empty')}</Text>
        ) : (
          list.map((g) => (
            <Card key={g.id}>
              <CardContent className="flex-row items-center gap-3 pt-4">
                <Icon as={Users} className="text-primary size-5" />
                <Text className="flex-1 font-medium">{g.name}</Text>
                <Button size="sm" variant={g.isMember ? 'outline' : 'default'} onPress={() => toggle(g)} disabled={busy === g.id}>
                  <Text>{f(g.isMember ? 'leave_button' : 'join_button')}</Text>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
