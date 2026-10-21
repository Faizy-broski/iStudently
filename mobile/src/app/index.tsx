import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { hasSeenOnboarding } from '@/features/onboarding/seen';
import { StatusScreen } from '@/components/status-screen';
import { resolveDestination } from '@/features/auth/destination';
import { useSession } from '@/features/auth/session';

// Entry point: signed-out users go to sign-in; signed-in users go wherever GET /auth/me says.
export default function Index() {
  const { t } = useTranslation();
  const { session, me, refreshMe, signOut } = useSession();

  if (!session) return <Redirect href={hasSeenOnboarding() ? '/sign-in' : '/onboarding'} />;

  if (me.status === 'loading') return <StatusScreen busy body={t('app.loading_account')} />;

  if (me.status === 'blocked') {
    return (
      <StatusScreen
        title={t('app.gate_title')}
        body={t(`app.blocked_${me.gate}`, { defaultValue: me.message })}
        actions={[{ label: t('app.sign_out'), onPress: signOut, primary: true }]}
      />
    );
  }

  if (me.status === 'error') {
    return (
      <StatusScreen
        title={t('app.load_failed')}
        body={__DEV__ ? me.message : undefined}
        actions={[
          { label: t('app.retry'), onPress: refreshMe, primary: true },
          { label: t('app.sign_out'), onPress: signOut },
        ]}
      />
    );
  }

  const dest = resolveDestination(me.me);
  if (dest.kind === 'gate') {
    // Native sign-in steps; the blocked agreement still explains itself on /gate.
    if (dest.gate === 'two_fa_verify') return <Redirect href={{ pathname: '/two-fa', params: { mode: 'verify' } }} />;
    if (dest.gate === 'two_fa_setup') return <Redirect href={{ pathname: '/two-fa', params: { mode: 'setup' } }} />;
    if (dest.gate === 'force_password_change') return <Redirect href={{ pathname: '/change-password', params: { forced: '1' } }} />;
    if (dest.gate === 'agreement') return <Redirect href="/agreement" />;
    return <Redirect href={{ pathname: '/gate', params: { gate: dest.gate } }} />;
  }
  if (dest.kind === 'coming_soon') return <Redirect href="/coming-soon" />;
  if (dest.kind === 'web_only') return <Redirect href="/web-only" />;
  return <Redirect href={dest.href} />;
}
