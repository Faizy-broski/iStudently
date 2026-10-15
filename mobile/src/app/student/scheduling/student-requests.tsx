import { Stack } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner } from '@/features/admin/settings-ui';

/** Course requests placeholder, as on the web (web: /student/scheduling/student-requests). */
export default function StudentRequestsPage() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_sr_${key}`);
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={ClipboardList} className="size-5" />
            <CardTitle>{k('card')}</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="items-center py-10">
              <Icon as={ClipboardList} className="text-muted-foreground mb-3 size-12" />
              <Text className="mb-1 text-lg font-medium">{k('none')}</Text>
              <Text className="text-muted-foreground text-center text-sm">{k('none_body')}</Text>
            </View>
          </CardContent>
        </Card>
        <InfoBanner>{k('contact')}</InfoBanner>
      </ScrollView>
    </>
  );
}
