import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { shortName } from '@/features/admin/people';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Hourly-paid teachers; open one to see hours and pay for a period (web: /admin/accounting/teacher-hours). */
export default function TeacherHours() {
  const { t } = useTranslation();
  const { scopeId } = useCampus();
  const h = (k: string, o?: Record<string, unknown>) => t(`admin.accounting.teacher_hours_list.${k}`, o);
  const list = useApi(scopeId ? ['admin', 'acc-teacher-hours', scopeId] : null, ([, , sid]) => adminAccounting.teachersWithHours(sid as string));
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const items = list.data?.filter((x) => !q || `${shortName(x.profile)} ${x.employee_number ?? ''}`.toLowerCase().includes(q));
  return (
    <>
      <Stack.Screen options={{ title: t('app.ac_teacher_hours') }} />
      <View className="bg-background flex-1">
        <DataList
          items={items}
          header={
            <View className="gap-2 p-4">
              <Text variant="muted">{h('subtitle')}</Text>
              <SearchBar value={search} onChangeText={setSearch} />
              {items ? <Text className="text-muted-foreground text-sm">{h('found_count', { count: items.length })}</Text> : null}
            </View>
          }
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={t('app.ac_no_hourly')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => {
            const name = shortName(x.profile) || x.employee_number || '—';
            return (
              <ListRow
                title={name}
                subtitle={[x.employee_number ? `${h('studently_id')}: ${x.employee_number}` : null, x.payment_type === 'hourly' ? t('app.ppl_pay_hourly') : null].filter(Boolean).join(' · ')}
                leading={<PersonAvatar name={name} />}
                onPress={() => router.push({ pathname: '/admin/accounting/teacher-hours/[id]', params: { id: x.id, name } })}
              />
            );
          }}
        />
      </View>
    </>
  );
}
