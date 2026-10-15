import { Stack } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import QRCode from 'react-qr-code';

import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

/** Same QR as the web's UserQRCode: <web>/verify/<profile id>. Dark modules on white so any scanner reads it. */
export default function MyQr() {
  const { t } = useTranslation();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  if (!profile) return null;
  const value = `${env.webUrl}/verify/${profile.id}`;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('app.qr_title') }} />
      <Screen contentContainerClassName="items-center justify-center gap-6 p-6">
        <Text variant="muted" className="text-center">
          {t('app.qr_body')}
        </Text>
        <View className="rounded-xl bg-white p-4" accessibilityRole="image" accessibilityLabel={t('app.qr_title')}>
          <QRCode value={value} size={220} bgColor="#FFFFFF" fgColor="#000000" />
        </View>
        <Text className="text-center font-medium">{[name, t(`app.role_${profile.role}`, { defaultValue: profile.role })].filter(Boolean).join(' · ')}</Text>
        <Button variant="outline" onPress={() => Share.share({ message: value })}>
          <Icon as={Share2} className="size-4" />
          <Text>{t('app.qr_share')}</Text>
        </Button>
      </Screen>
    </>
  );
}
