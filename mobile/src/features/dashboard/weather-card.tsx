import type { WeatherWidgetData } from '@studently/api-client';
import { Image } from 'expo-image';
import { AlertTriangle, Cloud, Droplets, Wind } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Web WeatherWidget: live alert, current conditions, next days. */
export function WeatherCard({ data, loading, failed }: { data?: WeatherWidgetData; loading: boolean; failed: boolean }) {
  const { t } = useTranslation();
  return (
    <Card className="py-3">
      <CardContent className="gap-3 px-4">
        {data?.activeAlert ? (
          <View className="flex-row gap-2 rounded-md border border-red-300 bg-red-50 p-2 dark:bg-red-950/40">
            <Icon as={AlertTriangle} className="mt-0.5 size-4 text-red-800 dark:text-red-200" />
            <Text className="flex-1 text-xs font-semibold text-red-800 dark:text-red-200">{data.activeAlert.headline}</Text>
          </View>
        ) : null}
        {loading ? (
          <Text variant="muted">{t('weather_alerts.widget.loading')}</Text>
        ) : failed || !data ? (
          <Text variant="muted">{t('weather_alerts.widget.error')}</Text>
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-muted-foreground text-xs">{data.weather.location.name}</Text>
                <Text className="text-2xl font-bold">{`${Math.round(data.weather.current.temp_c)}°C`}</Text>
                <Text className="text-muted-foreground text-xs">{data.weather.current.condition.text}</Text>
              </View>
              {data.weather.current.condition.icon ? (
                <Image source={{ uri: `https:${data.weather.current.condition.icon}` }} style={{ width: 48, height: 48 }} />
              ) : (
                <Icon as={Cloud} className="text-muted-foreground size-10" />
              )}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-row items-center gap-1">
                <Icon as={Droplets} className="text-muted-foreground size-3" />
                <Text className="text-muted-foreground text-xs">{`${data.weather.current.humidity}%`}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon as={Wind} className="text-muted-foreground size-3" />
                <Text className="text-muted-foreground text-xs">{`${Math.round(data.weather.current.wind_kph)} km/h`}</Text>
              </View>
            </View>
            {data.weather.forecastDays.length ? (
              <View className="border-border flex-row justify-between border-t pt-2">
                {data.weather.forecastDays.map((d) => (
                  <View key={d.date} className="items-center">
                    <Text className="text-muted-foreground text-[10px]">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
                    <Text className="text-xs font-medium">{`${Math.round(d.day.maxtemp_c)}°/${Math.round(d.day.mintemp_c)}°`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
