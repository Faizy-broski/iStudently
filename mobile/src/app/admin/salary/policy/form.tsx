import type { PayrollRules } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { DEFAULT_RULES, PayrollRulesForm, pickRules, rulesValid } from '@/features/admin/salary-rules';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Create or edit a salary policy group (web: PolicyGroupDialog on /admin/salary/settings). */
export default function PolicyForm() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`salary.settings.${k}`, o);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const { code } = useCurrency();
  const existing = useApi(id ? ['admin', 'salary-policy', id] : null, ([, , gid]) => adminSalary.policy(gid as string));
  // Edits over the loaded group (or the web's defaults for a new one).
  const [nameEdit, setName] = useState<string | null>(null);
  const [descriptionEdit, setDescription] = useState<string | null>(null);
  const [patch, setPatch] = useState<Partial<PayrollRules>>({});
  const [busy, setBusy] = useState(false);

  if (id && existing.error) return <ErrorState message={existing.error.message} onRetry={() => existing.mutate()} />;
  if (id && !existing.data) return <LoadingList rows={6} />;
  const g = existing.data;
  const name = nameEdit ?? g?.name ?? '';
  const description = descriptionEdit ?? g?.description ?? '';
  const rules: PayrollRules = { ...(g ? pickRules(g) : DEFAULT_RULES), ...patch };

  async function save() {
    if (!schoolId) return;
    if (!name.trim()) return toast.error(s('policyNameRequired'));
    if (!rulesValid(rules)) return toast.error(t('app.sl_time_hint'));
    setBusy(true);
    const input = { ...rules, name: name.trim(), description: description.trim() };
    const res = id ? await adminSalary.updatePolicy(schoolId, campusId, id, input) : await adminSalary.createPolicy(schoolId, campusId, input);
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(id ? s('policyUpdated') : s('policyCreated'));
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'salary-policies' || k[1] === 'salary-policy'));
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: id ? s('editPolicyGroup') : s('newPolicyGroup') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{id ? s('updatePolicyDesc') : s('createPolicyDesc')}</Text>
        <View className="gap-1.5">
          <Label>{s('policyName')}</Label>
          <Input value={name} onChangeText={setName} placeholder={s('policyNamePlaceholder')} />
        </View>
        <View className="gap-1.5">
          <Label>{s('description')}</Label>
          <Input value={description} onChangeText={setDescription} placeholder={s('descriptionPlaceholder')} />
        </View>
        <PayrollRulesForm key={g?.id ?? 'new'} value={rules} onChange={(p) => setPatch((prev) => ({ ...prev, ...p }))} currency={code} />
        <Button onPress={save} disabled={busy}>
          <Text>{busy ? s('saving') : s('savePolicy')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
