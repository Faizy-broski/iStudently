import { Stack } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Tamper-evident Fina audit log, filtered by action and date range (web: /admin/fina/audit). */
export default function FinaAudit() {
  const { f, lang } = useFn('supervisor');
  const { campusId } = useCampus();
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Filters apply on "Apply", like the web.
  const [applied, setApplied] = useState({ action: '', from: '', to: '' });
  const res = useApi(['admin', 'fina-audit', applied.action, applied.from, applied.to, campusId ?? 'school'], ([, , ac, fr, tt]) =>
    fina.audit(campusId, {
      action: (ac as string) || undefined,
      from: fr ? new Date(`${fr as string}T00:00:00`).toISOString() : undefined,
      to: tt ? new Date(`${tt as string}T00:00:00`).toISOString() : undefined,
    }),
  );
  const rows = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('audit_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{f('audit_subtitle')}</Text>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{f('filter_action')}</Label>
              <Input value={action} onChangeText={setAction} placeholder={f('filter_all_actions')} autoCapitalize="none" />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={f('filter_from')} value={from} onChange={setFrom} clearable />
              <DateField className="flex-1" label={f('filter_to')} value={to} onChange={setTo} clearable />
            </View>
            <Button onPress={() => setApplied({ action: action.trim(), from, to })}>
              <Icon as={Search} className="text-primary-foreground size-4" />
              <Text>{f('filter_apply')}</Text>
            </Button>
          </CardContent>
        </Card>
        {res.isLoading ? (
          <LoadingList rows={5} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !rows.length ? (
          <EmptyState title={f('audit_empty')} />
        ) : (
          <Card>
            <CardContent className="py-1">
              {rows.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-0.5 py-2.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 font-mono text-xs font-semibold">{r.action}</Text>
                      <Text className="text-muted-foreground text-[11px]">{new Date(r.occurred_at).toLocaleString(lang)}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {f('col_actor')}: {r.actor_role || '—'} · {f('col_subject')}: {r.subject_type || '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
