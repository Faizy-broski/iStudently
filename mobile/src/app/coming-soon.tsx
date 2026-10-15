import { openBrowserAsync } from 'expo-web-browser';
import { BookOpen, Briefcase, ClipboardCheck, GraduationCap, Hourglass, Library, School, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

const ROLE_ICON: Partial<Record<string, LucideIcon>> = {
  admin: School,
  staff: Briefcase,
  teacher: BookOpen,
  student: GraduationCap,
  parent: Users,
  librarian: Library,
  inspector: ClipboardCheck,
};

/** Roles whose app is not released yet (features/auth/release.ts): the role's own "coming soon" page. */
export default function ComingSoon() {
  const { t } = useTranslation();
  const { me, signOut } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const role = profile?.role ?? null;
  const roleName = role ? t(`app.role_${role}`, { defaultValue: role }) : '';
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center gap-5 px-8">
        <View className="bg-primary/10 size-24 items-center justify-center rounded-full">
          <Icon as={(role && ROLE_ICON[role]) || Hourglass} className="text-primary size-11" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-muted-foreground text-sm font-medium uppercase">{t('app.cs_role_app', { role: roleName })}</Text>
          <Text className="text-center text-3xl font-bold">{t('app.cs_title')}</Text>
          <Text variant="muted" className="text-center">
            {t('app.cs_body', { name: name || roleName, role: roleName })}
          </Text>
        </View>
        <View className="w-full gap-2 pt-2">
          <Button onPress={() => openBrowserAsync(env.webUrl)}>
            <Text>{t('app.open_website')}</Text>
          </Button>
          <Button variant="outline" onPress={signOut}>
            <Text>{t('app.sign_out')}</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
