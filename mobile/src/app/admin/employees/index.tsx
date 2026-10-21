import type { Employee, EmployeeKind } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Plus, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { BottomSheet } from '@/components/app/bottom-sheet';
import { FilterTag, RoundIcon, SortChips } from '@/components/app/layout';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Teachers (kind=teacher) or other staff (kind=staff) for the selected campus. */
export default function EmployeesList() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kind?: string }>();
  const isTeacher = params.kind !== 'staff';
  const ns = isTeacher ? 'teachers' : 'staff';
  const { campusId } = useCampus();
  const [search, setSearch] = useState('');
  const [staffRole, setStaffRole] = useState<EmployeeKind>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState<{ key: 'name' | 'number' | 'type' | 'department' | 'status'; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const q = useDebounced(search.trim());
  const kind: EmployeeKind = isTeacher ? 'teacher' : staffRole;

  const list = usePagedApi<Employee>(`admin-employees:${kind}:${campusId ?? 'school'}:${q}`, (page) =>
    adminEmployees.list(kind, campusId, { page, limit: 30, search: q || undefined }),
  );

  const sortValue = (e: Employee) =>
    sort.key === 'name' ? shortName(e.profile) || e.employee_number : sort.key === 'number' ? e.employee_number : sort.key === 'type' ? (e.employment_type ?? '') : sort.key === 'department' ? (e.department ?? '') : e.is_active ? '0' : '1';
  const shown = list.items.filter((e) => showInactive || e.is_active !== false).sort((a, b) => sortValue(a).localeCompare(sortValue(b)) * sort.dir);

  return (
    <>
      <Stack.Screen
        options={{
          title: t(`${ns}.title`),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/employees/form', params: { kind: isTeacher ? 'teacher' : 'staff' } })} accessibilityLabel={t(isTeacher ? 'teachers.addTeacher' : 'staff.addStaff')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-3 pb-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SearchBar value={search} onChangeText={setSearch} placeholder={t(`${ns}.searchPlaceholder`)} />
            </View>
            <RoundIcon icon={SlidersHorizontal} label={t('app.st_filters')} count={showInactive ? 1 : 0} onPress={() => setSheet(true)} />
          </View>
          {!isTeacher ? (
            <Segmented<EmployeeKind>
              value={staffRole}
              onChange={setStaffRole}
              options={[
                { value: 'all', label: t('staff.filters.all') },
                { value: 'staff', label: t('staff.filters.staff') },
                { value: 'librarian', label: t('staff.filters.librarians') },
              ]}
            />
          ) : null}
          {list.data ? (
            <View className="flex-row flex-wrap gap-1.5">
              <StatusChip label={`${isTeacher ? t('teachers.totalTeachers') : t('school.grades_module.common.total')}: ${list.total ?? list.items.length}`} tone="info" className="px-2.5 py-1" />
              <StatusChip label={`${isTeacher ? t('teachers.activeTeachers') : t('staff.active')}: ${list.items.filter((x) => x.is_active !== false).length}`} tone="success" className="px-2.5 py-1" />
              {showInactive ? <FilterTag label={t('teachers.showInactive')} onClear={() => setShowInactive(false)} /> : null}
            </View>
          ) : null}
        </View>
        <DataList
          items={list.data ? shown : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={t(isTeacher ? 'teachers.noTeachersFound' : 'staff.noStaffFound')}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          renderItem={(e) => {
            const name = shortName(e.profile) || e.employee_number;
            return (
              <ListRow
                title={name}
                subtitle={[e.employee_number, e.title, e.department].filter(Boolean).join(' · ')}
                leading={<PersonAvatar url={e.profile?.profile_photo_url ?? e.profile?.avatar_url} name={name} />}
                trailing={!e.is_active ? <StatusChip label={t(`${ns}.inactive`)} tone="muted" className="px-2 py-0.5" /> : undefined}
                onPress={() => router.push({ pathname: '/admin/employees/[id]', params: { id: e.id, kind: isTeacher ? 'teacher' : 'staff' } })}
              />
            );
          }}
        />
      </View>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t('app.st_filters')}>
        <View className="gap-4 pb-2">
          <View className="flex-row items-center gap-3">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            <Text className="flex-1 text-sm">{t('teachers.showInactive')}</Text>
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-semibold">{t('app.st_sort_by')}</Text>
            <SortChips
              options={[
                ['name', t('teachers.table.name')],
                ['number', t('teachers.table.employeeNumber')],
                ['type', t('teachers.table.type')],
                ['department', t('teachers.table.department')],
                ['status', t('teachers.table.status')],
              ]}
              value={sort.key}
              dir={sort.dir === 1 ? 'asc' : 'desc'}
              onChange={(key, dir) => setSort({ key, dir: dir === 'asc' ? 1 : -1 })}
            />
          </View>
          <Button onPress={() => setSheet(false)}>
            <Text>{t('app.st_show_results')}</Text>
          </Button>
        </View>
      </BottomSheet>
    </>
  );
}
