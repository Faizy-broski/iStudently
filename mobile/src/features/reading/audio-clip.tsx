import * as WebBrowser from 'expo-web-browser';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { audioPlayerFactory } from '@/features/speed-reading/native';

/** Play / pause a recording in the app (expo-audio), or open it in the browser on builds without it. */
export function AudioClip({ url }: { url: string }) {
  const { t } = useTranslation();
  const player = useRef<ReturnType<NonNullable<ReturnType<typeof audioPlayerFactory>>> | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => player.current?.remove(), []);
  function toggle() {
    const make = audioPlayerFactory();
    if (!make) return WebBrowser.openBrowserAsync(url);
    if (playing) {
      player.current?.pause();
      return setPlaying(false);
    }
    if (!player.current) player.current = make(url);
    player.current.play();
    setPlaying(true);
  }
  return (
    <Button size="sm" variant="outline" className="self-start rounded-full" onPress={toggle}>
      <Icon as={playing ? Pause : Play} className="text-brand dark:text-brand-secondary size-4" />
      <Text>{playing ? t('app.srs_stop') : t('app.srs_play')}</Text>
    </Button>
  );
}
