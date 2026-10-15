import { Stack } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { quran } from '@/lib/api';
import { useApi } from '@/lib/data';

const RIWAYAH = 'hafs'; // the only riwayah seeded so far
const NOT_VERIFIED = 'not been signed off';

/** Read-only surah browser (web: /admin/hifzi/quran, QuranReader). The text stays hidden until an edition is verified. */
export function QuranReader() {
  const { h, isAr } = useHz('quranReader');
  const [surah, setSurah] = useState(1);
  const surahs = useApi(['quran-surahs', RIWAYAH], () => quran.surahs(RIWAYAH));
  const editions = useApi(['quran-editions', RIWAYAH], () => quran.editions(RIWAYAH));
  const verified = editions.data ? editions.data.some((e) => !!e.verified_at) : null;
  const text = useApi(surahs.data?.length && verified !== false ? ['quran-surah-text', RIWAYAH, surah] : null, async ([, r, n]) => {
    const range = await quran.resolveRange({ riwayah: r as string, unitType: 'surah', number: n as number });
    if (!range.success || !range.data) return { ...range, data: undefined };
    return quran.ayahsInRange(r as string, range.data.startAyahId, range.data.endAyahId);
  });
  const list = surahs.data ?? [];
  const current = list.find((s) => s.number === surah);
  const notVerified = verified === false || !!text.error?.message?.includes(NOT_VERIFIED);
  const ayahs = text.data ?? [];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
        {surahs.isLoading ? (
          <LoadingList rows={3} />
        ) : surahs.error ? (
          <ErrorState message={surahs.error.message || h('loadError')} onRetry={() => surahs.mutate()} />
        ) : (
          <>
            <Card>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  <Button variant="outline" size="icon" onPress={() => setSurah((n) => Math.max(1, n - 1))} disabled={surah <= 1} accessibilityLabel={h('previousSurah')}>
                    <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
                  </Button>
                  <View className="flex-1">
                    <Picker value={String(surah)} onChange={(v) => setSurah(Number(v))} options={list.map((s) => ({ value: String(s.number), label: `${s.number}. ${isAr ? s.nameAr : `${s.nameTransliterated} (${s.nameEn})`}` }))} />
                  </View>
                  <Button variant="outline" size="icon" onPress={() => setSurah((n) => Math.min(114, n + 1))} disabled={surah >= 114} accessibilityLabel={h('nextSurah')}>
                    <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
                  </Button>
                </View>
                {current ? (
                  <View className="flex-row gap-2">
                    <Badge variant="secondary">
                      <Text className="text-xs">{current.revelationPlace === 'meccan' ? h('meccan') : h('medinan')}</Text>
                    </Badge>
                    <Badge variant="secondary">
                      <Text className="text-xs">{h('ayahCount', { count: current.ayahCount })}</Text>
                    </Badge>
                  </View>
                ) : null}
              </CardContent>
            </Card>
            {notVerified ? (
              <Card className="border-dashed">
                <CardContent className="items-center gap-2 pt-6 pb-6">
                  <Text className="font-medium">{h('notVerifiedTitle')}</Text>
                  <Text className="text-muted-foreground text-center text-sm">{h('notVerifiedBody')}</Text>
                </CardContent>
              </Card>
            ) : text.isLoading || editions.isLoading ? (
              <LoadingList rows={4} />
            ) : text.error ? (
              <ErrorState message={text.error.message || h('loadError')} onRetry={() => text.mutate()} />
            ) : (
              <Card>
                <CardContent className="gap-4 pt-4">
                  <Text className="text-2xl" style={{ writingDirection: 'rtl', textAlign: 'right', lineHeight: 52 }}>
                    {ayahs.map((ay) => (
                      <Text key={ay.id} className="text-2xl">
                        {ay.textUthmani}
                        <Text className="text-muted-foreground text-base">{` ﴿${ay.ayahNumber.toLocaleString('ar-EG')}﴾ `}</Text>
                      </Text>
                    ))}
                  </Text>
                  {ayahs.length ? (
                    <Text className="text-muted-foreground border-border border-t pt-3 text-center text-xs" onPress={() => openBrowserAsync('https://tanzil.net')}>
                      Quran text: <Text className="text-muted-foreground text-xs underline">Tanzil Project</Text> (CC BY 3.0)
                    </Text>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
