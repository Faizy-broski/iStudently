import type { Campus } from '@studently/api-client';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useSession } from '@/features/auth/session';
import { campuses as campusesApi } from '@/lib/api';
import { useApi } from '@/lib/data';

interface CampusState {
  /** Branch campuses the user may pick from (admins); one entry when locked (staff). */
  campuses: Campus[];
  campus: Campus | null;
  /**
   * Send as campus_id on every campus-aware call. Undefined = the school itself (a school
   * without branches, or before the list loads), which the backend treats as the main school.
   */
  campusId: string | undefined;
  /** campusId, or the user's own school when there is no campus to pick (for APIs that require a school id). */
  scopeId: string | undefined;
  canSwitch: boolean;
  setCampus(id: string): void;
  isLoading: boolean;
  error?: unknown;
  refresh(): void;
}

const CampusContext = createContext<CampusState | null>(null);

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used inside CampusProvider');
  return ctx;
}

/**
 * Selected campus for the admin shell, same rules as the web's CampusContext:
 * admins pick from GET /setup/campuses (default: the saved choice, else the first branch);
 * staff are locked to their own campus. Saved per user on this device.
 */
export function CampusProvider({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const isAdmin = profile?.role === 'admin';
  const ownCampusId = profile ? profile.campus_id || profile.school_id : null;
  const storageKey = profile ? `admin.campus.${profile.id}` : null;

  const schoolId = profile?.school_id ?? null;
  const list = useApi(isAdmin && schoolId ? ['admin', 'campuses', schoolId] : null, () => campusesApi.list());
  const own = useApi(!isAdmin && ownCampusId ? ['admin', 'campus', ownCampusId] : null, ([, , cid]) => campusesApi.get(cid));

  const [savedId, setSavedId] = useState<string | null>(() => (storageKey ? Storage.getItemSync(storageKey) : null));

  const campuses = useMemo<Campus[]>(() => (isAdmin ? (list.data ?? []) : own.data ? [own.data] : []), [isAdmin, list.data, own.data]);
  const campus = isAdmin ? (campuses.find((c) => c.id === savedId) ?? campuses[0] ?? null) : (campuses[0] ?? null);
  const campusId = isAdmin ? campus?.id : (ownCampusId ?? undefined);

  const setCampus = useCallback(
    (id: string) => {
      if (!isAdmin || !storageKey) return;
      Storage.setItemSync(storageKey, id);
      setSavedId(id);
    },
    [isAdmin, storageKey],
  );

  const source = isAdmin ? list : own;
  const value: CampusState = {
    campuses,
    campus,
    campusId,
    scopeId: campusId ?? profile?.school_id ?? undefined,
    // Like the web's campus dropdown: shown to admins even with a single campus.
    canSwitch: isAdmin && campuses.length > 0,
    setCampus,
    isLoading: source.isLoading,
    error: source.error,
    refresh: () => source.mutate(),
  };
  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}
