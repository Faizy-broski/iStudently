import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { resolveDestination } from '@/features/auth/destination';
import { useSession } from '@/features/auth/session';

import { pushEnabled, registerPush } from './push';

/**
 * Registers the phone for push once the user reaches their home (past every sign-in step), and opens
 * the related screen when a notification is tapped. Links outside the user's own section open home.
 */
export function PushRegistrar() {
  const { me } = useSession();
  const dest = me.status === 'ready' ? resolveDestination(me.me) : null;
  const home = dest?.kind === 'home' ? dest.href : null;
  const userId = me.status === 'ready' ? me.me.profile.id : null;

  useEffect(() => {
    if (!userId || !home || !pushEnabled()) return;
    registerPush(true);
  }, [userId, home]);

  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!last || !home) return;
    const id = `${last.notification.request.identifier}:${last.notification.date}`;
    if (handled.current === id) return;
    handled.current = id;
    const url = last.notification.request.content.data?.url;
    router.push((typeof url === 'string' && (url === home || url.startsWith(`${home}/`)) ? url : home) as Href);
  }, [last, home]);

  return null;
}
