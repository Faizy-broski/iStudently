import { Stack } from 'expo-router';
import { Clock, Mail, Phone, Share2, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import QRCode from 'react-qr-code';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

/** The admin's own account details and identity QR (web: /admin/profile). */
export default function AdminProfile() {
  const { t, i18n } = useTranslation();
  const p = (k: string) => t(`admin.profile.${k}`);
  const { me, session } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const role = t(`app.role_${profile.role}`, { defaultValue: profile.role });
  const lastLogin = session?.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const qrValue = `${env.webUrl}/verify/${profile.id}`;

  const info = (icon: LucideIcon, tone: string, label: string, value: string) => (
    <View className="bg-muted/50 flex-row items-center gap-3 rounded-lg p-3">
      <View className={`size-10 items-center justify-center rounded-full ${tone}`}>
        <Icon as={icon} className="size-5" />
      </View>
      <View className="flex-1">
        <Text className="text-muted-foreground text-sm">{label}</Text>
        <Text className="font-medium" selectable>
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{p('subtitle')}</Text>
        <Card className="overflow-hidden">
          <View className="bg-primary h-20" />
          <CardContent className="-mt-12 items-center gap-2 pb-5">
            <View className="border-background rounded-2xl border-4">
              <PersonAvatar name={name || 'A'} url={profile.profile_photo_url ?? profile.avatar_url} size={88} />
            </View>
            <Text className="text-center text-xl font-bold">{name}</Text>
            <Text className="text-muted-foreground">{profile.email}</Text>
            <View className="bg-primary flex-row items-center gap-1 rounded-full px-2.5 py-0.5">
              <Icon as={ShieldCheck} className="text-primary-foreground size-3" />
              <Text className="text-primary-foreground text-xs capitalize">{role || p('role')}</Text>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="text-lg font-semibold">{p('account_info')}</Text>
              <Text className="text-muted-foreground text-sm">{p('account_info_desc')}</Text>
            </View>
            {info(Mail, 'bg-blue-100 dark:bg-blue-900', p('email'), profile.email || '—')}
            {info(Phone, 'bg-green-100 dark:bg-green-900', p('phone'), profile.phone || '—')}
            {info(Clock, 'bg-purple-100 dark:bg-purple-900', p('last_login'), lastLogin)}
            {info(ShieldCheck, 'bg-orange-100 dark:bg-orange-900', p('role'), role || '—')}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="items-center gap-3 pt-4">
            <View className="self-stretch">
              <Text className="text-lg font-semibold">{p('qr_title')}</Text>
              <Text className="text-muted-foreground text-sm">{p('qr_desc')}</Text>
            </View>
            <View className="rounded-xl bg-white p-4" accessibilityRole="image" accessibilityLabel={p('qr_title')}>
              <QRCode value={qrValue} size={200} bgColor="#FFFFFF" fgColor="#000000" />
            </View>
            <Text className="text-center font-medium">{[name, role].filter(Boolean).join(' · ')}</Text>
            <Button variant="outline" onPress={() => Share.share({ message: qrValue })}>
              <Icon as={Share2} className="size-4" />
              <Text>{t('app.qr_share')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
