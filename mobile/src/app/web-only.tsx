import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StatusScreen } from '@/components/status-screen';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

// Roles without app screens (counselor, financial admin): their work stays on the website.
export default function WebOnly() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <StatusScreen
      icon={Globe}
      title={t('app.web_only_title')}
      body={t('app.web_only_body')}
      actions={[
        { label: t('app.open_website'), onPress: () => openBrowserAsync(env.webUrl), primary: true },
        // Settings stays reachable: privacy and terms links, and account deletion (store requirement).
        { label: t('app.set_title'), onPress: () => router.push('/settings') },
        { label: t('app.sign_out'), onPress: signOut },
      ]}
    />
  );
}
