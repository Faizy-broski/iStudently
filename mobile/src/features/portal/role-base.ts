import { useSegments, type Href } from 'expo-router';

import { useSession } from '@/features/auth/session';

/**
 * Admin screens reused by teachers and librarians link inside the shell they are shown in: `/admin/...` for admins,
 * `/teacher/...` in the teacher app. `href('/scheduling/x')` returns the path under that base.
 */
export function useRoleBase() {
  const segments = useSegments();
  const base = segments[0] === 'teacher' ? '/teacher' : segments[0] === 'librarian' ? '/librarian' : '/admin';
  const { me } = useSession();
  const role = me.status === 'ready' ? me.me.profile.role : null;
  return {
    base,
    isTeacher: base === '/teacher',
    isLibrarian: base === '/librarian',
    /** Admins (and super admins) may change school data; teachers see the same screens read-only where the API is admin-only. */
    isAdmin: role === 'admin' || role === 'super_admin',
    href: (path: string, params?: Record<string, string>) => (params ? { pathname: `${base}${path}`, params } : `${base}${path}`) as Href,
  };
}
