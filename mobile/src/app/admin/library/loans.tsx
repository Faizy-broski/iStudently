import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Text } from '@/components/ui/text';
import { isLibraryKey } from '@/features/admin/library';
import { LoanDirectory } from '@/features/admin/library-loans';
import { useCampus } from '@/features/campus/campus';

/** All book loans of the selected campus (web: /admin/library/loans). */
export default function LibraryLoans() {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { campus } = useCampus();
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('admin.library.overview.loan_directory') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate(isLibraryKey)} />}>
        <Text className="text-muted-foreground text-sm">{campus ? `${t('admin.library.overview.showing_for')} ${campus.name}` : t('app.lb_loans_subtitle')}</Text>
        <LoanDirectory title={false} />
      </ScrollView>
    </View>
  );
}
