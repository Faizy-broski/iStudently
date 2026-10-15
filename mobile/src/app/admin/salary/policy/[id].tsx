import { Stack, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const fullName = (p?: { first_name: string; last_name: string }) => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();

/** Teachers in a policy group: remove, or add from the campus staff (web: Manage Teachers dialog). */
export default function PolicyMembers() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`salary.settings.${k}`, o);
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const campusKey = campusId ?? 'school';
  const group = useApi(['admin', 'salary-policy', id], ([, , gid]) => adminSalary.policy(gid as string));
  const staff = useApi(schoolId ? ['admin', 'salary-policy-staff', schoolId, campusKey] : null, ([, , sid, cid]) =>
    adminSalary.staffWithPolicy(sid as string, cid === 'school' ? null : (cid as string)),
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const refresh = () => {
    group.mutate();
    staff.mutate();
    mutate((k) => Array.isArray(k) && k[1] === 'salary-policies');
  };
  const remove = useAction((staffId: string) => adminSalary.removeFromPolicy(id, staffId), { success: s('teacherRemoved'), onSuccess: refresh });
  const assign = useAction((ids: string[]) => adminSalary.assignToPolicy(schoolId!, id, ids), {
    success: s('teachersAssigned', { count: picked.size }),
    onSuccess: () => {
      setPicked(new Set());
      refresh();
    },
  });

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (staff.data ?? [])
      .filter((x) => x.assigned_policy?.policy_group_id !== id)
      .filter((x) => !q || fullName(x.profile).toLowerCase().includes(q) || (x.employee_number ?? '').toLowerCase().includes(q));
  }, [staff.data, query, id]);

  if (group.isLoading) return <LoadingList rows={5} />;
  if (group.error || !group.data) return <ErrorState message={group.error?.message} onRetry={() => group.mutate()} />;
  const assigned = group.data.assigned_teachers;

  return (
    <>
      <Stack.Screen options={{ title: group.data.name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{s('manageTeachersDesc')}</Text>
        <Text className="font-semibold">{s('assignedToPolicy')}</Text>
        {assigned.length === 0 ? <Text variant="muted">{s('noTeachersAssigned')}</Text> : null}
        {assigned.length ? (
          <Card className="gap-0 py-0">
            {assigned.map((a, i) => (
              <View key={a.staff_id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-3 px-4 py-2.5">
                  <PersonAvatar url={a.staff.profile.profile_photo_url} name={fullName(a.staff.profile)} size={32} />
                  <View className="flex-1">
                    <Text className="font-medium">{fullName(a.staff.profile)}</Text>
                    <Text className="text-muted-foreground text-xs">{[a.staff.employee_number, a.staff.title].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable hitSlop={8} disabled={remove.running} onPress={() => remove.run(a.staff_id)} accessibilityLabel={t('app.bl_delete')}>
                    <Icon as={X} className="text-muted-foreground size-5" />
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Text className="mt-2 font-semibold">{s('availableTeachers')}</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder={s('searchTeachersPlaceholder')} />
        {staff.isLoading ? <LoadingList rows={3} /> : null}
        {staff.data && available.length === 0 ? <Text variant="muted">{s('noTeachersFound')}</Text> : null}
        {available.length ? (
          <Card className="gap-0 py-0">
            {available.map((x, i) => {
              const on = picked.has(x.id);
              const toggle = () =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (on) next.delete(x.id);
                  else next.add(x.id);
                  return next;
                });
              return (
                <View key={x.id}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable onPress={toggle} className="flex-row items-center gap-3 px-4 py-2.5" accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Checkbox checked={on} onCheckedChange={toggle} />
                    <View className="flex-1">
                      <Text className="font-medium">{fullName(x.profile)}</Text>
                      <Text className="text-muted-foreground text-xs">{[x.employee_number, x.assigned_policy?.policy_name ?? s('unassigned')].filter(Boolean).join(' · ')}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
      {picked.size ? (
        <View className="bg-background border-border absolute inset-x-0 bottom-0 border-t p-4 pb-8">
          <Button disabled={assign.running} onPress={() => assign.run([...picked])}>
            <Text>{assign.running ? s('assigning') : s('addSelected', { count: picked.size })}</Text>
          </Button>
        </View>
      ) : null}
    </>
  );
}
