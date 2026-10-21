import type { Parent } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Initials, RowItem } from '@/components/app/layout';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminParents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/**
 * Parents / guardians and the students linked to them, read-only (web: /teacher/students/associated-parents).
 * The web page copies the admin "associate" form, but linking is admin-only on the server, so its
 * button always fails for teachers; the app shows the associations instead.
 */
export default function TeacherAssociatedParents() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.studentsAssociatedParents.${key}`, o);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 400);
  const res = useApi(['teacher', 'parent-search', term], ([, , s]) => adminParents.search(s as string));
  const [open, setOpen] = useState<string | null>(null);
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted" className="text-sm">
          {t('app.te_ap_subtitle')}
        </Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={k('searchParentPlaceholder')} />
        <Text variant="muted" className="text-xs">
          {res.isLoading ? k('searchingParents') : list.length ? k('foundParents', { count: list.length }) : k('noParentsFound')}
        </Text>
        {res.isLoading ? <LoadingList rows={4} /> : !list.length ? <EmptyState icon={Users} title={k('noParentsFound')} /> : null}
        {list.map((p) => (
          <ParentCard key={p.id} parent={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
        ))}
      </ScrollView>
    </>
  );
}

function ParentCard({ parent, open, onToggle }: { parent: Parent; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.studentsAssociatedParents.${key}`, o);
  const detail = useApi(open ? ['teacher', 'parent-children', parent.id] : null, ([, , id]) => adminParents.getWithChildren(id as string));
  const name = `${parent.profile?.first_name ?? ''} ${parent.profile?.last_name ?? ''}`.trim() || 'N/A';
  const children = detail.data?.children ?? parent.children ?? [];
  return (
    <Panel>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
        <PersonAvatar url={parent.profile?.profile_photo_url ?? null} name={name} size={40} />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold">{name}</Text>
          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
            {parent.profile?.email || k('noEmail')}
          </Text>
          <Text variant="muted" className="text-[11px]">
            {parent.profile?.phone || k('noPhone')}
          </Text>
        </View>
        <StatusChip label={k('existingChildren', { count: parent.children?.length ?? 0 })} tone="info" />
        <Icon flipRtl as={open ? ChevronDown : ChevronRight} className="text-muted-foreground size-4" />
      </Pressable>
      {open ? (
        detail.isLoading ? (
          <LoadingList rows={2} />
        ) : !children.length ? (
          <View className="border-info-soft dark:border-border items-center border-t py-3">
            <Icon as={Users} className="text-muted-foreground/40 size-6" />
          </View>
        ) : (
          children.map((c) => (
            <RowItem
              key={c.id}
              className="border-info-soft dark:border-border border-t"
              last
              leading={<Initials name={`${c.profile?.first_name ?? ''} ${c.profile?.last_name ?? ''}`.trim() || '?'} size={32} />}
              title={`${c.profile?.first_name ?? ''} ${c.profile?.last_name ?? ''}`.trim() || '—'}
              meta={c.student_number || null}
              trailing={c.relationship || c.relation_type ? <StatusChip label={k(c.relationship ?? c.relation_type ?? '', { defaultValue: c.relationship ?? c.relation_type ?? '' })} tone="muted" /> : null}
            />
          ))
        )
      ) : null}
    </Panel>
  );
}
