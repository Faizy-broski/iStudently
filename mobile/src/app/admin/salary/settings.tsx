import type { PayrollRules } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PayrollRulesForm, pickRules, rulesValid } from '@/features/admin/salary-rules';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

/** Default payroll rules and named policy groups for the selected campus (web: /admin/salary/settings). */
export default function SalarySettings() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`salary.settings.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  // Settings and policies are keyed by the main school plus the selected campus (like the web).
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const { code } = useCurrency();
  const campusKey = campusId ?? 'school';
  const settings = useApi(schoolId ? ['admin', 'payroll-settings', schoolId, campusKey] : null, ([, , sid, cid]) =>
    adminSalary.settings(sid as string, cid === 'school' ? null : (cid as string)),
  );
  const policies = useApi(schoolId ? ['admin', 'salary-policies', schoolId, campusKey] : null, ([, , sid, cid]) =>
    adminSalary.policies(sid as string, cid === 'school' ? null : (cid as string)),
  );
  const staff = useApi(schoolId ? ['admin', 'salary-policy-staff', schoolId, campusKey] : null, ([, , sid, cid]) =>
    adminSalary.staffWithPolicy(sid as string, cid === 'school' ? null : (cid as string)),
  );
  // Unsaved changes over the saved settings (the web's defaults when none are saved yet).
  const [edits, setEdits] = useState<{ key: string; patch: Partial<PayrollRules> }>({ key: campusKey, patch: {} });
  const patch = edits.key === campusKey ? edits.patch : {};

  const save = useAction((r: PayrollRules) => adminSalary.updateSettings(schoolId!, campusId, r), { success: s('defaultSettingsSaved'), onSuccess: () => settings.mutate() });
  const remove = useAction((id: string) => adminSalary.deletePolicy(schoolId!, id), {
    success: s('policyDeleted'),
    onSuccess: () => {
      policies.mutate();
      staff.mutate();
    },
  });

  if (settings.error) return <ErrorState message={settings.error.message} onRetry={() => settings.mutate()} />;
  if (settings.data === undefined) return <LoadingList rows={6} />;
  const rules: PayrollRules = { ...pickRules(settings.data), ...patch };
  const members = (groupId: string) => (staff.data ?? []).filter((x) => x.assigned_policy?.policy_group_id === groupId).length;
  const unassigned = (staff.data ?? []).filter((x) => !x.assigned_policy).length;

  return (
    <>
      <Stack.Screen options={{ title: s('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-semibold">{s('defaultSettings')}</Text>
        <Text variant="muted">{`${s('appliedToAll')} · ${s('teachersCount', { count: unassigned })}`}</Text>
        <PayrollRulesForm key={campusKey} value={rules} onChange={(p) => setEdits({ key: campusKey, patch: { ...patch, ...p } })} currency={code} />
        <Button
          disabled={save.running}
          onPress={() => {
            if (!rulesValid(rules)) return toast.error(t('app.sl_time_hint'));
            save.run(rules);
          }}>
          <Text>{save.running ? s('saving') : s('saveDefaultSettings')}</Text>
        </Button>

        <View className="mt-4 flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-lg font-semibold">{s('policyGroups')}</Text>
          <Button size="sm" onPress={() => router.push('/admin/salary/policy/form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{s('newPolicy')}</Text>
          </Button>
        </View>
        <Text variant="muted">{s('policyGroupsDesc')}</Text>
        {policies.isLoading ? <LoadingList rows={2} /> : null}
        {policies.data && policies.data.length === 0 ? <EmptyState title={s('noPolicyGroupsYet')} body={s('noPolicyGroupsDesc')} /> : null}
        {(policies.data ?? []).map((g) => (
          <Card key={g.id} className="py-3">
            <CardContent className="gap-1 px-4">
              <Text className="font-semibold">{g.name}</Text>
              {g.description ? <Text variant="muted">{g.description}</Text> : null}
              <Text className="text-muted-foreground text-xs">
                {[
                  `${s('checkIn')} ${String(g.expected_check_in).slice(0, 5)}`,
                  `${s('workDays')} ${g.working_days_per_month}`,
                  `${s('absence')} ${g.absence_deduction_percent}%`,
                  s('teachersCount', { count: members(g.id) }),
                ].join(' · ')}
              </Text>
              <View className="flex-row gap-5 pt-2">
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/admin/salary/policy/[id]', params: { id: g.id } })} accessibilityRole="button">
                  <View className="flex-row items-center gap-1">
                    <Icon as={Users} className="text-primary size-4" />
                    <Text className="text-primary text-sm">{s('manageTeachersBtn')}</Text>
                  </View>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/admin/salary/policy/form', params: { id: g.id } })} accessibilityRole="button">
                  <View className="flex-row items-center gap-1">
                    <Icon as={Pencil} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-sm">{s('edit')}</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel={s('deletePolicy')}
                  onPress={async () => {
                    if (await confirm({ title: s('deletePolicyTitle', { name: g.name }), body: s('deletePolicyDesc'), destructive: true, confirmLabel: s('deletePolicy') })) remove.run(g.id);
                  }} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Pressable>
              </View>
            </CardContent>
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
