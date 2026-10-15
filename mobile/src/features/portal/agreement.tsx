import { htmlToText } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { agreement } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The school agreement for the user's role, read-only (web: /<role>/agreement). */
export function AgreementScreen() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_ag_${key}`);
  const data = useApi(['portal', 'my-agreement'], () => agreement.mine());
  const list = data.data?.agreements ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={FileText} className="size-5 text-[#022172] dark:text-blue-400" />
          <Text variant="muted">{k('subtitle')}</Text>
        </View>
        {data.isLoading ? (
          <LoadingList rows={3} />
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-10">
              <Text className="text-muted-foreground text-center">{k('none')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.title || k('default')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="text-sm">{htmlToText(a.content)}</Text>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
