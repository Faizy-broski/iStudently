import { router, Stack } from 'expo-router';
import { FileText, UserCog } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Inspection reports for the campus; open one to sign (web: /admin/inspections/reports). */
export default function InspectionReports() {
  const { t } = useTranslation();
  const r = (k: string) => t(`inspections.reports.${k}`);
  const { scopeId } = useCampus();
  const list = useApi(scopeId ? ['admin', 'inspection-reports', scopeId] : null, ([, , id]) => adminInspections.reportsForSchool(id as string));
  return (
    <>
      <Stack.Screen options={{ title: r('list_page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={<Text variant="muted" className="p-4 text-sm">{r('admin_list_subtitle')}</Text>}
          items={scopeId ? list.data : []}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={scopeId ? r('no_reports') : r('select_campus_prompt')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <Pressable onPress={() => router.push({ pathname: '/admin/inspections/report/[id]', params: { id: x.id } })} className="flex-row items-center gap-3 px-4 py-3">
              <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                <Icon as={UserCog} className="size-4 text-[#022172]" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium">{`${x.teacher.first_name} ${x.teacher.last_name}`}</Text>
                <Text className="text-muted-foreground text-xs">{`${r('inspector_prefix')} ${x.inspector.first_name} ${x.inspector.last_name}`}</Text>
              </View>
              <Badge variant={x.status === 'fully_signed' ? 'secondary' : 'outline'}>
                <Icon as={FileText} className="text-foreground size-3" />
                <Text>{r(`status_${x.status}`)}</Text>
              </Badge>
            </Pressable>
          )}
        />
      </View>
    </>
  );
}
