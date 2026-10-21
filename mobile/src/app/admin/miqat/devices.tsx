import type { MiqatDevice, MiqatDeviceRole } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { Ban, Copy, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Miqat devices: enrolment codes (gate/teacher/admin) and revoke (web: /admin/miqat/devices). */
export default function MiqatDevices() {
  const { t, i18n } = useTranslation();
  const d = (k: string) => t(`miqat.devices.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [role, setRole] = useState<MiqatDeviceRole>('gate');
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const [teacher, setTeacher] = useState<{ profileId: string; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const devices = useApi(['admin', 'miqat-devices', campusId ?? 'school'], () => adminMiqat.devices(campusId));
  const teachers = useApi(role === 'teacher' && !teacher && term.length >= 2 ? ['admin', 'miqat-teacher-search', campusId ?? 'school', term] : null, () => adminEmployees.list('teacher', campusId, { search: term, limit: 10 }));

  async function generate() {
    if (role === 'teacher' && !teacher) return toast.error(d('selectTeacherFirst'));
    setGenerating(true);
    try {
      const res = await adminMiqat.generateCode(role, role === 'teacher' ? teacher?.profileId : undefined, campusId);
      if (!res.success || !res.data) return toast.error(res.error || d('generateError'));
      setCode(res.data);
      setTeacher(null);
      setQuery('');
    } finally {
      setGenerating(false);
    }
  }

  async function revoke(dev: MiqatDevice) {
    const res = await adminMiqat.revokeDevice(dev.id, campusId);
    if (!res.success) return toast.error(res.error || d('revokeError'));
    toast.success(d('revokeSuccess'));
    devices.mutate();
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <>
      <Stack.Screen options={{ title: d('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="p-4">
              <Card>
                <CardContent className="gap-3 pt-4">
                  <Picker
                    value={role}
                    onChange={(v) => {
                      setRole(v as MiqatDeviceRole);
                      setTeacher(null);
                    }}
                    options={[
                      { value: 'gate', label: d('roleGate') },
                      { value: 'teacher', label: d('roleTeacher') },
                      { value: 'admin', label: d('roleAdmin') },
                    ]}
                  />
                  {role === 'teacher' ? (
                    teacher ? (
                      <View className="border-info-soft dark:border-border flex-row items-center justify-between rounded-xl border p-2">
                        <Text className="text-sm">{teacher.name}</Text>
                        <Pressable onPress={() => setTeacher(null)} hitSlop={8} accessibilityLabel={d('change')}>
                          <Icon as={X} className="text-muted-foreground size-4" />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="gap-1">
                        <SearchBar value={query} onChangeText={setQuery} placeholder={d('searchTeacherPlaceholder')} />
                        {(teachers.data ?? []).map((s, i) => (
                          <View key={s.id}>
                            {i > 0 ? <Separator /> : null}
                            <Pressable className="px-2 py-2.5" onPress={() => setTeacher({ profileId: s.profile_id ?? '', name: shortName(s.profile) || s.employee_number || s.id })}>
                              <Text className="text-sm">{shortName(s.profile) || s.employee_number}</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )
                  ) : null}
                  <Button onPress={generate} disabled={generating || (role === 'teacher' && !teacher)}>
                    <Icon as={Plus} className="text-primary-foreground size-4" />
                    <Text>{d('generateCode')}</Text>
                  </Button>
                  {code ? (
                    <View className="border-info-soft dark:border-border bg-muted/40 flex-row items-center justify-between rounded-xl border p-4">
                      <View>
                        <Text className="font-mono text-2xl tracking-widest">{code.code}</Text>
                        <Text className="text-muted-foreground text-xs">{`${d('expiresAt')}: ${new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(new Date(code.expires_at))}`}</Text>
                      </View>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={async () => {
                          await Clipboard.setStringAsync(code.code);
                          toast.success(d('codeCopied'));
                        }}>
                        <Icon as={Copy} className="text-foreground size-4" />
                      </Button>
                    </View>
                  ) : null}
                </CardContent>
              </Card>
            </View>
          }
          items={devices.data}
          error={devices.error}
          isLoading={devices.isLoading}
          isRefreshing={devices.isValidating && !devices.isLoading}
          onRefresh={() => devices.mutate()}
          emptyTitle={d('noDevices')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold">{x.label || x.id.slice(0, 8)}</Text>
                <Text className="text-muted-foreground text-xs">{`${d('colRole')}: ${x.role} · ${d('colLastSeen')}: ${x.last_seen_at ? fmt(x.last_seen_at) : d('never')}`}</Text>
              </View>
              <Badge variant={x.status === 'active' ? 'default' : 'destructive'}>
                <Text>{x.status}</Text>
              </Badge>
              {x.status === 'active' ? (
                <Button size="sm" variant="ghost" onPress={() => revoke(x)}>
                  <Icon as={Ban} className="text-foreground size-4" />
                  <Text>{d('revoke')}</Text>
                </Button>
              ) : null}
            </View>
          )}
        />
      </View>
    </>
  );
}
