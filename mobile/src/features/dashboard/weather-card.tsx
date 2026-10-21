import type { WeatherWidgetData } from '@studently/api-client';
import { Image } from 'expo-image';
import { AlertTriangle, Cloud, Droplets, Wind } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Web WeatherWidget: live alert, current conditions, next days. */
export function WeatherCard({ data, loading, failed }: { data?: WeatherWidgetData; loading: boolean; failed: boolean }) {
  const { t } = useTranslation();
  return (
    <Panel className="gap-3 p-4">
        {data?.activeAlert ? (
          <View className="flex-row gap-2 rounded-2xl border border-destructive/30 bg-destructive-soft p-3">
            <Icon as={AlertTriangle} className="mt-0.5 size-4 text-destructive" />
            <Text className="flex-1 text-xs font-semibold text-destructive">{data.activeAlert.headline}</Text>
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
                <Text className="text-brand dark:text-foreground text-2xl font-bold">{`${Math.round(data.weather.current.temp_c)}°C`}</Text>
                <Text className="text-muted-foreground text-xs">{data.weather.current.condition.text}</Text>
              </View>
              {data.weather.current.condition.icon ? (
                <Image source={{ uri: `https:${data.weather.current.condition.icon}` }} style={{ width: 48, height: 48 }} />
              ) : (
                <IconTile icon={Cloud} size={48} round />
              )}
            </View>
            <View className="flex-row gap-2">
              <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                <Icon as={Droplets} className="text-brand dark:text-brand-secondary size-3" />
                <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{`${data.weather.current.humidity}%`}</Text>
              </View>
              <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                <Icon as={Wind} className="text-brand dark:text-brand-secondary size-3" />
                <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{`${Math.round(data.weather.current.wind_kph)} km/h`}</Text>
              </View>
            </View>
            {data.weather.forecastDays.length ? (
              <View className="flex-row gap-2">
                {data.weather.forecastDays.map((d) => (
                  <View key={d.date} className="bg-muted/60 flex-1 items-center gap-0.5 rounded-xl py-2">
                    <Text className="text-muted-foreground text-[10px]">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
                    <Text className="text-xs font-semibold">{`${Math.round(d.day.maxtemp_c)}°/${Math.round(d.day.mintemp_c)}°`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
    </Panel>
  );
}
