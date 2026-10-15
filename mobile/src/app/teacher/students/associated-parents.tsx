import type { Parent } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
        <Text variant="muted">{t('app.te_ap_subtitle')}</Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={k('searchParentPlaceholder')} />
        <Text className="text-muted-foreground text-xs">{res.isLoading ? k('searchingParents') : list.length ? k('foundParents', { count: list.length }) : k('noParentsFound')}</Text>
        {res.isLoading ? <LoadingList rows={4} /> : null}
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
    <Card>
      <CardContent className="gap-2 p-3">
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3">
          <PersonAvatar url={parent.profile?.profile_photo_url ?? null} name={name} size={40} />
          <View className="flex-1">
            <Text className="font-semibold">{name}</Text>
            <Text className="text-muted-foreground text-xs">{parent.profile?.email || k('noEmail')}</Text>
            <Text className="text-muted-foreground text-xs">{parent.profile?.phone || k('noPhone')}</Text>
          </View>
          <Badge className="bg-blue-100">
            <Text className="text-xs text-blue-800">{k('existingChildren', { count: parent.children?.length ?? 0 })}</Text>
          </Badge>
          <Icon as={open ? ChevronDown : ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
        </Pressable>
        {open ? (
          detail.isLoading ? (
            <LoadingList rows={2} />
          ) : !children.length ? (
            <View className="items-center py-3">
              <Icon as={Users} className="text-muted-foreground/40 size-6" />
            </View>
          ) : (
            children.map((c) => (
              <View key={c.id} className="border-border flex-row items-center gap-2 border-t pt-2">
                <Text className="flex-1 text-sm">{`${c.profile?.first_name ?? ''} ${c.profile?.last_name ?? ''}`.trim() || '—'}</Text>
                {c.student_number ? <Text className="text-muted-foreground text-xs">{c.student_number}</Text> : null}
                {c.relationship || c.relation_type ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{k(c.relationship ?? c.relation_type ?? '', { defaultValue: c.relationship ?? c.relation_type ?? '' })}</Text>
                  </Badge>
                ) : null}
              </View>
            ))
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
