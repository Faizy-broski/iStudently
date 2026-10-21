import type { Campus } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Building2, ExternalLink, Globe, Hash, Mail, MapPin, Phone, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { SchoolLogo } from '@/components/app/school-logo';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

/** Campus details (web: /student and /parent school-information); `who` names the child for parents. */
export function SchoolInformationView({ campus, isLoading, refresh, who }: { campus: Campus | null; isLoading: boolean; refresh: () => unknown; who?: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_si_${key}`, o);

  if (isLoading && !campus) return <LoadingList rows={5} />;
  if (!campus) {
    return (
      <>
        <Stack.Screen options={{ title: k('title') }} />
        <EmptyState icon={Building2} title={k('no_campus')} body={k('no_campus_body')} />
      </>
    );
  }
  const rows = [
    { icon: Hash, label: k('code'), value: campus.school_number },
    { icon: Users, label: k('principal'), value: campus.principal_name },
    { icon: Phone, label: k('phone'), value: campus.phone },
    { icon: Mail, label: k('email'), value: campus.contact_email },
    { icon: Globe, label: k('short'), value: campus.short_name },
  ];
  const site = campus.website ? (campus.website.startsWith('http') ? campus.website : `https://${campus.website}`) : null;
  const cityLine = [campus.city, campus.state, campus.zip_code].filter(Boolean).join(', ');

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <Text variant="muted">{who ? `${k('details_for', { name: campus.name })} — ${who}` : k('details_for', { name: campus.name })}</Text>
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <View className="flex-1 flex-row items-center gap-3">
              {campus.logo_url ? <SchoolLogo url={campus.logo_url} shape={campus.logo_shape} size={64} /> : null}
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Building2} className="size-5 text-brand dark:text-brand-secondary " />
                  <CardTitle className="flex-1 text-base">{campus.name}</CardTitle>
                </View>
                {campus.short_name ? <CardDescription>{k('short_name', { name: campus.short_name })}</CardDescription> : null}
              </View>
            </View>
            <Badge variant={campus.status === 'active' ? 'default' : 'secondary'}>
              <Text>{campus.status === 'active' ? k('active') : k('inactive')}</Text>
            </Badge>
          </CardHeader>
          <CardContent className="gap-4">
            <Separator />
            <View className="flex-row items-start gap-3">
              <Icon as={MapPin} className="text-muted-foreground mt-0.5 size-4" />
              <View className="flex-1">
                <Text className="text-sm font-medium">{k('address')}</Text>
                <Text className="text-muted-foreground text-sm">{campus.address || k('not_provided')}</Text>
                {campus.address && cityLine ? <Text className="text-muted-foreground text-sm">{cityLine}</Text> : null}
              </View>
            </View>
            {rows.map((r) => (
              <View key={r.label} className="flex-row items-center gap-3">
                <Icon as={r.icon} className="text-muted-foreground size-4" />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{r.label}</Text>
                  <Text className="text-muted-foreground text-sm" selectable>
                    {r.value || k('not_provided')}
                  </Text>
                </View>
              </View>
            ))}
            {site ? (
              <View className="flex-row items-center gap-3">
                <Icon as={ExternalLink} className="text-muted-foreground size-4" />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{k('website')}</Text>
                  <Pressable onPress={() => WebBrowser.openBrowserAsync(site)} accessibilityRole="link">
                    <Text className="text-sm text-brand dark:text-brand-secondary">{campus.website}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
