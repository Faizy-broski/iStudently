import type { ReadingLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, Calendar, ChevronDown, ChevronUp, Clock, FileText, MicOff, Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { audioPlayerFactory } from '@/features/speed-reading/native';
import { readingLogs } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const AUDIO_DAYS = 14;
const ageDays = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86400000);

/** Students' reading sessions across the school: search, notes, audio kept 14 days (web: /teacher/reading-logs). */
export default function TeacherReadingLogs() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.readingLogs.${key}`, o);
  const res = useApi(['teacher', 'reading-logs'], () => readingLogs.school());
  const [q, setQ] = useState('');
  const [now] = useState(() => Date.now());
  const logs = res.data ?? [];
  const term = q.trim().toLowerCase();
  const shown = term
    ? logs.filter((l) => `${l.student?.first_name ?? ''} ${l.student?.last_name ?? ''}`.toLowerCase().includes(term) || l.book_title.toLowerCase().includes(term) || (l.book_author ?? '').toLowerCase().includes(term))
    : logs;
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('pageDescription')}</Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={k('searchPlaceholder')} />
        {!res.isLoading ? (
          <Text className="text-muted-foreground text-xs">{`${k('sessionsCount', { count: shown.length })}${term ? ` ${k('filteredFromTotal', { total: logs.length })}` : ''}`}</Text>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : res.error ? (
          <Text className="text-destructive text-sm">{res.error.message}</Text>
        ) : !shown.length ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{term ? k('noSessionsMatch') : k('noSessionsYet')}</Text>
        ) : (
          shown.map((l) => <LogRow key={l.id} log={l} now={now} />)
        )}
      </ScrollView>
    </>
  );
}

function LogRow({ log, now }: { log: ReadingLog; now: number }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.readingLogs.${key}`, o);
  const [open, setOpen] = useState(false);
  const age = ageDays(log.created_at, now);
  const hasAudio = !!log.audio_url && age <= AUDIO_DAYS;
  const name = log.student ? `${log.student.first_name} ${log.student.last_name}` : k('unknown');
  return (
    <Card>
      <CardContent className="flex-row gap-3 p-4">
        <PersonAvatar url={log.student?.profile_image ?? null} name={name} size={36} />
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-sm font-semibold">{name}</Text>
            {hasAudio ? (
              <Badge variant="outline" className="border-green-500">
                <Text className="text-[10px] text-green-600">{`🎙 ${k('audio')}`}</Text>
              </Badge>
            ) : null}
            {log.audio_file_path && age > AUDIO_DAYS ? (
              <Badge variant="outline">
                <Text className="text-muted-foreground text-[10px]">{k('audioExpired')}</Text>
              </Badge>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Icon as={BookOpen} className="text-primary size-3.5" />
            <Text className="flex-shrink text-sm font-medium" numberOfLines={1}>
              {log.book_title}
            </Text>
            {log.book_author ? (
              <Text className="text-muted-foreground flex-shrink text-xs" numberOfLines={1}>
                {`— ${log.book_author}`}
              </Text>
            ) : null}
          </View>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-row items-center gap-1">
              <Icon as={Calendar} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs">{formatDate(log.session_date)}</Text>
            </View>
            {log.pages_read != null ? (
              <View className="flex-row items-center gap-1">
                <Icon as={FileText} className="text-muted-foreground size-3" />
                <Text className="text-muted-foreground text-xs">{k('pagesCount', { count: log.pages_read })}</Text>
              </View>
            ) : null}
          </View>
          {log.notes ? (
            <>
              <Button variant="link" size="sm" className="h-auto self-start px-0" onPress={() => setOpen(!open)}>
                <Icon as={open ? ChevronUp : ChevronDown} className="text-primary size-3" />
                <Text className="text-xs">{open ? k('hideNotes') : k('viewNotes')}</Text>
              </Button>
              {open ? <Text className="text-muted-foreground text-xs">{log.notes}</Text> : null}
            </>
          ) : null}
          {log.audio_file_path || log.audio_url ? (
            age > AUDIO_DAYS ? (
              <View className="flex-row items-center gap-1.5">
                <Icon as={MicOff} className="text-muted-foreground size-3.5" />
                <Text className="text-muted-foreground text-xs">{k('audioExpiredLimit')}</Text>
              </View>
            ) : log.audio_url ? (
              <View className="gap-1">
                <View className="flex-row items-center gap-1">
                  <Icon as={Clock} className="text-muted-foreground size-3" />
                  <Text className="text-muted-foreground text-xs">{k('audioDaysRemaining', { count: AUDIO_DAYS - age })}</Text>
                </View>
                <AudioClip url={log.audio_url} />
              </View>
            ) : null
          ) : null}
        </View>
      </CardContent>
    </Card>
  );
}

/** Play / pause a recording in the app (expo-audio), or open it in the browser on builds without it. */
function AudioClip({ url }: { url: string }) {
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
    <Button size="sm" variant="outline" className="self-start" onPress={toggle}>
      <Icon as={playing ? Pause : Play} className="size-4" />
      <Text>{playing ? t('app.srs_stop') : t('app.srs_play')}</Text>
    </Button>
  );
}
