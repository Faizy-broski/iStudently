import { router, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { StatusScreen } from '@/components/status-screen';
import type { GateKind } from '@/features/auth/destination';
import { useSession } from '@/features/auth/session';
import { env } from '@/lib/env';

// Placeholder for the sign-in gates. Native screens arrive in Sprint 3 (password) and Sprint 4
// (2FA, agreement); until then the user completes the step on the website and retries.
export default function Gate() {
  const { t } = useTranslation();
  const { gate } = useLocalSearchParams<{ gate: GateKind }>();
  const { refreshMe, signOut } = useSession();

  async function retry() {
    await refreshMe();
    router.replace('/');
  }

  return (
    <StatusScreen
      title={t('app.gate_title')}
      body={`${t(`app.gate_${gate}`)}\n\n${t('app.gate_coming_soon')}`}
      actions={[
        { label: t('app.open_website'), onPress: () => openBrowserAsync(env.webUrl), primary: true },
        { label: t('app.retry'), onPress: retry },
        { label: t('app.sign_out'), onPress: signOut },
      ]}
    />
  );
}
