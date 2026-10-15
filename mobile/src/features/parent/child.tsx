import type { ParentStudent } from '@studently/api-client';
import Storage from 'expo-sqlite/kv-store';
import { ChevronDown, User } from 'lucide-react-native';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

interface ChildState {
  children: ParentStudent[];
  /** The selected child, or null while loading / when the parent has no linked children. */
  child: ParentStudent | null;
  childId: string | null;
  setChild: (id: string) => void;
  isLoading: boolean;
  error?: Error;
  refresh: () => void;
}

const Ctx = createContext<ChildState | null>(null);

export function useChild() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChild must be used inside ParentChildProvider');
  return v;
}

/** The parent's linked children and the selected one (web: ParentDashboardContext); the choice is kept per user. */
export function ParentChildProvider({ children: node }: { children: ReactNode }) {
  const { me } = useSession();
  const uid = me.status === 'ready' ? me.me.profile.id : null;
  const list = useApi(uid ? ['parent', 'children', uid] : null, () => parent.getStudents());
  const key = `parent.child.${uid ?? ''}`;
  const [saved, setSaved] = useState<string | null>(() => (uid ? Storage.getItemSync(key) : null));
  const kids = list.data ?? [];
  const child = kids.find((c) => c.id === saved) ?? kids[0] ?? null;
  const setChild = useCallback(
    (id: string) => {
      Storage.setItemSync(key, id);
      setSaved(id);
    },
    [key],
  );
  const value: ChildState = { children: kids, child, childId: child?.id ?? null, setChild, isLoading: list.isLoading, error: list.error, refresh: () => list.mutate() };
  return <Ctx.Provider value={value}>{node}</Ctx.Provider>;
}

/** Web sidebar child selector: the selected child, tap to switch. */
export function ChildSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_${key}`);
  const { children: kids, child, setChild, isLoading } = useChild();
  const [open, setOpen] = useState(false);
  const name = (c: ParentStudent) => `${c.first_name} ${c.last_name}`;
  return (
    <>
      <Pressable
        onPress={() => kids.length > 0 && setOpen(true)}
        disabled={isLoading || kids.length === 0}
        accessibilityRole="button"
        accessibilityLabel={k('select_child')}
        className={cn('border-border bg-card flex-row items-center gap-2 rounded-lg border px-3 py-2', className)}>
        {child ? <PersonAvatar url={child.profile_photo_url} name={name(child)} size={28} /> : <Icon as={User} className="text-muted-foreground size-5" />}
        <View className="flex-1">
          <Text className="font-medium" numberOfLines={1}>
            {isLoading ? k('loading') : child ? name(child) : kids.length === 0 ? k('no_children') : k('select_child')}
          </Text>
          {child ? <Text className="text-muted-foreground text-xs" numberOfLines={1}>{`${child.grade_level} — ${child.section}`}</Text> : null}
        </View>
        {kids.length > 1 ? <Icon as={ChevronDown} className="text-muted-foreground size-4" /> : null}
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{k('select_child')}</DialogTitle>
          </DialogHeader>
          <View className="gap-2">
            {kids.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setChild(c.id);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: c.id === child?.id }}
                className={cn('flex-row items-center gap-3 rounded-lg border p-3', c.id === child?.id ? 'border-primary bg-primary/5' : 'border-border')}>
                <PersonAvatar url={c.profile_photo_url} name={name(c)} size={36} />
                <View className="flex-1">
                  <Text className="font-medium">{name(c)}</Text>
                  <Text className="text-muted-foreground text-xs">{`${c.grade_level} — ${c.section} · ${c.campus_name}`}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Shown by parent pages while there is no selected child. */
export function NoChild() {
  const { t } = useTranslation();
  const { isLoading } = useChild();
  if (isLoading) return null;
  return (
    <View className="bg-background flex-1 items-center justify-center gap-2 p-6">
      <Icon as={User} className="text-muted-foreground size-10" />
      <Text className="font-semibold">{t('app.pa_no_child_title')}</Text>
      <Text className="text-muted-foreground text-center text-sm">{t('app.pa_no_child_body')}</Text>
      <ChildSwitcher className="mt-2 self-stretch" />
    </View>
  );
}
