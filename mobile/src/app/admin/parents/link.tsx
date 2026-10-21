import type { ParentRelationship, Student } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminParents, adminStudents } from '@/lib/api';
import { useApi, usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { IconTile } from '@/components/app/layout';

/** Link one or more students to a parent with a relationship (web: /admin/parents/associate-parent). */
export default function LinkChildren() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ id?: string }>();
  const [pickedParent, setPickedParent] = useState<string>('');
  const id = params.id || pickedParent;
  const [parentQ, setParentQ] = useState('');
  const pq = useDebounced(parentQ.trim());
  const parents = useApi(!params.id && pq ? ['admin', 'parent-search', pq] : null, ([, , s]) => adminParents.list({ page: 1, limit: 20, search: s as string }));
  const [emergency, setEmergency] = useState(false);
  const [grade, setGrade] = useState('__all__');
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [search, setSearch] = useState('');
  const [relationship, setRelationship] = useState<ParentRelationship>('father');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim());
  const list = usePagedApi<Student>(`admin-link-students:${campusId ?? 'school'}:${q}:${grade}`, (page) =>
    adminStudents.list(campusId, { page, limit: 30, search: q || undefined, is_active: true, sort_key: 'name', grade_level: grade === '__all__' ? undefined : [grade] }),
  );

  async function link() {
    setBusy(true);
    let ok = 0;
    if (!id) {
      setBusy(false);
      return toast.error(t('parents.validation.selectParent'));
    }
    for (const studentId of selected) if ((await adminParents.linkStudent(id, studentId, relationship, emergency)).success) ok++;
    setBusy(false);
    if (ok === selected.size) toast.success(t('parents.toasts.associatedSuccess'));
    else toast.error(t('parents.toasts.associatedPartial', { success: ok, total: selected.size }));
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'parent-full' || key[1] === 'student'));
    mutate((key) => typeof key === 'string' && key.startsWith('admin-parents'));
    if (ok > 0) router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('parents.linkChildren') }} />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-3 pb-2">
          {!params.id ? (
            <View className="gap-1.5">
              <Label>{t('parents.selectParent')}</Label>
              {pickedParent ? (
                <Pressable onPress={() => setPickedParent('')} className="border-brand-secondary bg-info-soft rounded-xl border p-2">
                  <Text className="text-sm font-medium">{shortName((parents.data ?? []).find((x) => x.id === pickedParent)?.profile) || t('parents.selectedParent')}</Text>
                  <Text className="text-muted-foreground text-xs">{t('parents.searchParent')}</Text>
                </Pressable>
              ) : (
                <>
                  <SearchBar value={parentQ} onChangeText={setParentQ} placeholder={t('parents.associate.parentSearchPlaceholder')} />
                  {!pq ? <Text className="text-muted-foreground text-xs">{t('parents.associate.typeToSearchParents')}</Text> : parents.isLoading ? <Text className="text-muted-foreground text-xs">{t('parents.associate.searchingParents')}</Text> : !(parents.data ?? []).length ? <Text className="text-muted-foreground text-xs">{t('parents.associate.noParentsFoundTryDifferent')}</Text> : null}
                  {(parents.data ?? []).slice(0, 8).map((x) => (
                    <Pressable key={x.id} onPress={() => setPickedParent(x.id)} className="border-info-soft dark:border-border rounded-xl border p-2">
                      <Text className="text-sm">{shortName(x.profile) || '—'}</Text>
                      <Text className="text-muted-foreground text-xs">{[x.profile?.email || t('parents.noEmail'), x.profile?.phone || t('parents.noPhone')].join(' · ')}</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          ) : null}
          <Label>{t('parents.relationshipTypeLabel')}</Label>
          <FilterChips<ParentRelationship>
            value={relationship}
            onChange={setRelationship}
            options={(['father', 'mother', 'guardian', 'other'] as const).map((r) => ({ value: r, label: t(`parents.${r}`, { defaultValue: r }) }))}
          />
          <Text className="text-muted-foreground text-xs">{t('parents.associate.relationshipAppliesAll')}</Text>
          <View className="flex-row items-center gap-3">
            <Switch checked={emergency} onCheckedChange={setEmergency} />
            <Text className="flex-1 text-sm">{t('parents.associate.markAsEmergencyContact')}</Text>
          </View>
          <Picker value={grade} onChange={setGrade} options={[{ value: '__all__', label: t('parents.associate.allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.name, label: g.name }))]} />
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('parents.associate.searchStudentsPlaceholder')} />
        </View>
        <DataList
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={t('parents.associate.noStudentsFound')}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          renderItem={(s) => {
            const name = shortName(s.profile) || s.student_number;
            const on = selected.has(s.id);
            return (
              <ListRow
                title={name}
                subtitle={[s.student_number, s.grade?.name ?? s.grade_level].filter(Boolean).join(' · ')}
                leading={<PersonAvatar url={s.profile?.profile_photo_url} name={name} size={36} />}
                trailing={on ? <IconTile icon={Check} size={32} /> : undefined}
                chevron={false}
                onPress={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  })
                }
              />
            );
          }}
        />
        <View className="border-border border-t p-4">
          <Button onPress={link} disabled={busy || selected.size === 0}>
            <Text>{busy ? t('parents.associate.associating') : t('parents.associate.associateWithStudentsCount', { count: selected.size })}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
