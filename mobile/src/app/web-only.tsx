import { openBrowserAsync } from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { StatusScreen } from '@/components/status-screen';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

// Roles whose work stays on the website (super admin, counselor, media officer, ...).
export default function WebOnly() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <StatusScreen
      title={t('app.web_only_title')}
      body={t('app.web_only_body')}
      actions={[
        { label: t('app.open_website'), onPress: () => openBrowserAsync(env.webUrl), primary: true },
        { label: t('app.sign_out'), onPress: signOut },
      ]}
    />
  );
}
