import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { PageCard } from '@/features/pages/page-card';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';

/** One "About" page from the sign-in screen (web: CustomPageModal on the login page). */
export default function AboutPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const links = useApi(['public', 'login-links'], () => platform.getLoginLinks(), { shouldRetryOnError: false });
  const page = links.data?.find((p) => p.id === id) ?? null;
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: page?.title ?? '' }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-10">
        {page ? <PageCard page={page} /> : <LoadingList rows={2} />}
      </ScrollView>
    </>
  );
}
