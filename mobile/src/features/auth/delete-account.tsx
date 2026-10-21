import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { verifyCurrentPassword } from '@/features/auth/reauth';
import { useSession } from '@/features/auth/session';
import { auth } from '@/lib/api';

/**
 * In-app account deletion (App Store / Play requirement): explains what happens, confirms the
 * current password, then POST /auth/delete-account turns sign-in off and the user is signed out.
 */
export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (!(await verifyCurrentPassword(password))) return toast.error(t('app.st_current_password_wrong'));
      const r = await auth.deleteAccount(reason.trim() || undefined);
      if (!r.success) return toast.error(r.error || t('app.error_title'));
      toast.success(t('app.set_delete_done'));
      onClose();
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t('app.set_delete_account')}>
      <View className="gap-4">
        <Text variant="muted" className="text-sm">
          {t('app.set_delete_body')}
        </Text>
        <View className="gap-1.5">
          <Label>{t('app.st_current_password')}</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        </View>
        <View className="gap-1.5">
          <Label>{t('app.set_delete_reason')}</Label>
          <Textarea value={reason} onChangeText={setReason} className="min-h-20" />
        </View>
        <Button variant="destructive" onPress={submit} disabled={busy || !password}>
          <Text>{t('app.set_delete_confirm')}</Text>
        </Button>
      </View>
    </BottomSheet>
  );
}
