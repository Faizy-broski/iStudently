import { Stack } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { InfoBanner } from '@/features/admin/settings-ui';

/** Course requests placeholder, as on the web (web: /student/scheduling/student-requests). */
export default function StudentRequestsPage() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_sr_${key}`);
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <Panel>
          <View className="flex-row items-center gap-3 px-4 pt-4">
            <IconTile icon={ClipboardList} size={40} />
            <Text className="flex-1 text-base font-semibold">{k('card')}</Text>
          </View>
          <EmptyState icon={ClipboardList} title={k('none')} body={k('none_body')} />
        </Panel>
        <InfoBanner>{k('contact')}</InfoBanner>
      </ScrollView>
    </>
  );
}
