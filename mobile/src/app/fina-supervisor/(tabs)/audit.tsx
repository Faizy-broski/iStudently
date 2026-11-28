import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSupervisorOverview } from '@/features/fina-supervisor/data';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

const ALL = '__all__';

/** Audit log across the municipality, filtered by school, action and dates (web: /fina-supervisor/audit). */
export default function FinaSupervisorAudit() {
  const { t, i18n } = useTranslation();
  const f = (k: string) => t(`fina.supervisor.${k}`);
  const overview = useSupervisorOverview();
  const [school, setSchool] = useState(ALL);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Filters apply on "Search", like the web.
  const [applied, setApplied] = useState({ school: ALL, action: '', from: '', to: '' });
  const res = useApi(['fina-supervisor', 'audit', applied.school, applied.action, applied.from, applied.to], ([, , sc, ac, fr, tt]) =>
    fina.audit(undefined, {
      schoolId: sc === ALL ? undefined : (sc as string),
      action: (ac as string) || undefined,
      from: fr ? new Date(`${fr as string}T00:00:00`).toISOString() : undefined,
      to: tt ? new Date(`${tt as string}T23:59:59`).toISOString() : undefined,
    }),
  );
  const rows = res.data ?? [];
  const schools = overview.data?.schools ?? [];
  const names = new Map(schools.map((s) => [s.id, s.name]));
  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{f('audit_subtitle')}</Text>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{f('filter_school')}</Label>
              <Picker value={school} onChange={setSchool} options={[{ value: ALL, label: f('filter_all_schools') }, ...schools.map((s) => ({ value: s.id, label: s.name }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{f('filter_action')}</Label>
              <Input value={action} onChangeText={setAction} placeholder={f('filter_all_actions')} autoCapitalize="none" />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={f('filter_from')} value={from} onChange={setFrom} clearable />
              <DateField className="flex-1" label={f('filter_to')} value={to} onChange={setTo} clearable />
            </View>
            <Button onPress={() => setApplied({ school, action: action.trim(), from, to })}>
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
                      <Text className="flex-1 text-xs font-semibold">{r.action}</Text>
                      <Text className="text-muted-foreground text-xs">{new Date(r.occurred_at).toLocaleString(i18n.language)}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {f('col_actor')}: {r.actor_role || '—'} · {f('col_subject')}: {r.subject_type || '—'}
                    </Text>
                    {names.has(r.school_id) ? <Text className="text-muted-foreground text-xs">{names.get(r.school_id)}</Text> : null}
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
