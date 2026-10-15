import type { TwoFAConfig } from '@studently/api-client';
import { Stack } from 'expo-router';
import { RotateCcw, Save, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { twoFa } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useResetOn } from '@/lib/use-reset-on';

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent', 'staff', 'librarian', 'media_officer', 'fina_supervisor'];

/** Which roles must use 2FA for the selected campus, and resetting a user's 2FA (web: /admin/settings/two-factor-auth). */
export default function TwoFactorAuthSettings() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`twoFa.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const cfg = useApi(['admin', '2fa-config', campusId ?? 'school'], () => twoFa.adminConfig(campusId));
  const users = useApi(['admin', '2fa-users', campusId ?? 'school'], () => twoFa.adminUsers(campusId));
  const [config, setConfig] = useState<TwoFAConfig>({ roles_required: [], setup_skippable: true, skip_grace_days: 1 });
  const [grace, setGrace] = useState('1');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!cfg.data) return;
    setConfig(cfg.data);
    setGrace(String(cfg.data.skip_grace_days ?? 1));
  }, [cfg.data]);
  useResetOn(campusId ?? '', () => setSelected(''));

  const roleLabel = (r: string) => t(`twoFa.roles.${r}`, { defaultValue: r.replace('_', ' ') });
  const toggleRole = (r: string) => setConfig((p) => ({ ...p, roles_required: p.roles_required.includes(r) ? p.roles_required.filter((x) => x !== r) : [...p.roles_required, r] }));

  async function save() {
    setSaving(true);
    try {
      const r = await twoFa.saveAdminConfig({ ...config, skip_grace_days: parseInt(grace, 10) || 7 }, campusId);
      if (!r.success) return toast.error(r.error ?? f('admin_save_error'));
      toast.success(f('admin_saved'));
      cfg.mutate();
    } catch {
      toast.error(f('admin_save_error'));
    } finally {
      setSaving(false);
    }
  }

  const enrolled = (users.data ?? []).filter((u) => u.totp_enabled);
  const target = enrolled.find((u) => u.id === selected) ?? null;

  async function reset() {
    if (!target) return;
    if (!(await confirm({ title: f('admin_reset_confirm_title'), body: f('admin_reset_confirm_desc', { name: target.name || target.email || '' }), confirmLabel: f('admin_reset_confirm_btn'), destructive: true }))) return;
    setResetting(true);
    try {
      const r = await twoFa.adminReset(target.id);
      if (!r.success) return toast.error(r.error ?? f('admin_reset_error'));
      toast.success(f('admin_reset_success'));
      setSelected('');
      users.mutate();
    } catch {
      toast.error(f('admin_reset_error'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('admin_title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={ShieldCheck} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{f('admin_desc')}</Text>
        </View>

        <Card>
          <CardContent className="gap-4 pt-4">
            <View>
              <Text className="font-semibold">{f('admin_roles_title')}</Text>
              <Text className="text-muted-foreground text-sm">{f('admin_roles_desc')}</Text>
            </View>
            {cfg.isLoading ? (
              <LoadingList rows={3} />
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2">
                  {ALL_ROLES.map((r) => (
                    <Pressable key={r} onPress={() => toggleRole(r)} className="border-border active:bg-muted min-w-[46%] flex-1 flex-row items-center gap-2.5 rounded-lg border p-3">
                      <Switch checked={config.roles_required.includes(r)} onCheckedChange={() => toggleRole(r)} />
                      <Text className="flex-1 text-sm font-medium capitalize">{roleLabel(r)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="border-border gap-4 border-t pt-4">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{f('admin_skippable_label')}</Text>
                      <Text className="text-muted-foreground text-xs">{f('admin_skippable_desc')}</Text>
                    </View>
                    <Switch checked={config.setup_skippable} onCheckedChange={(v) => setConfig((p) => ({ ...p, setup_skippable: v }))} />
                  </View>
                  {config.setup_skippable ? (
                    <View className="flex-row items-center gap-3">
                      <Label className="text-muted-foreground flex-1">{f('admin_grace_days_label')}</Label>
                      <Input value={grace} onChangeText={setGrace} keyboardType="number-pad" maxLength={2} className="w-20" />
                      <Text className="text-muted-foreground text-sm">{f('admin_days')}</Text>
                    </View>
                  ) : null}
                </View>
                <Button className="self-start" onPress={save} disabled={saving}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{f('admin_save_btn')}</Text>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-4 pt-4">
            <View>
              <Text className="font-semibold">{f('admin_reset_section_title')}</Text>
              <Text className="text-muted-foreground text-sm">{f('admin_reset_section_desc')}</Text>
            </View>
            {users.isLoading ? (
              <LoadingList rows={2} />
            ) : (
              <>
                <Label className="text-muted-foreground">{f('admin_reset_select_label')}</Label>
                {enrolled.length ? (
                  <Picker value={selected} onChange={setSelected} placeholder={f('admin_reset_select_placeholder')} options={enrolled.map((u) => ({ value: u.id, label: `${u.name || u.email} (${u.role})` }))} />
                ) : (
                  <Text className="text-muted-foreground text-sm">{f('admin_no_users')}</Text>
                )}
                <Button variant="outline" className="self-start border-red-200" disabled={!target || resetting} onPress={reset}>
                  <Icon as={RotateCcw} className="size-4 text-red-600" />
                  <Text className="text-red-600">{f('admin_reset_btn')}</Text>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
