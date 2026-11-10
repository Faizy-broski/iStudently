import type { ReadingLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen, Calendar, CheckCircle, ChevronDown, ChevronUp, FileAudio, FileText, Mic, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { voiceRecorder } from '@/features/inspector/native';
import { AudioClip } from '@/features/reading/audio-clip';
import { media, readingLogs } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { pickDocuments } from '@/lib/upload';

type AudioFile = { uri: string; name: string; type: string };
const AUDIO_DAYS = 14;
/** Null on builds without expo-audio; the screen then offers picking an audio file. */
const Recorder = voiceRecorder();
const AUDIO_TYPES = ['audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'];
const normAudio = (type: string, name: string) => {
  const n = name.toLowerCase();
  if (type === 'audio/m4a' || type === 'audio/x-m4a' || n.endsWith('.m4a')) return 'audio/mp4';
  if (type === 'audio/x-wav' || n.endsWith('.wav')) return 'audio/wav';
  return type;
};

/** Log a reading session with an optional voice recording; past sessions below (web: /student/reading). */
export default function StudentReading() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_rd_${key}`, o);
  const toast = useToast();
  const logs = useApi(['student', 'reading-logs'], () => readingLogs.my());

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [pages, setPages] = useState('');
  const [notes, setNotes] = useState('');
  const [audio, setAudio] = useState<AudioFile | null>(null);
  const [attach, setAttach] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const [saving, setSaving] = useState(false);

  function gotAudio(f: AudioFile) {
    setAudio(f);
    setAttach(true);
  }
  function discard() {
    setAudio(null);
    setAttach(false);
    setRecorderKey((n) => n + 1);
  }
  async function pickAudio() {
    const [doc] = await pickDocuments({ multiple: false });
    if (!doc) return;
    const type = normAudio(doc.type, doc.name);
    if (!AUDIO_TYPES.includes(type)) return toast.error(t('app.in_audio_type'));
    gotAudio({ uri: doc.uri, name: doc.name, type });
  }

  async function save() {
    if (!title.trim()) return toast.error(k('title_required'));
    const n = pages.trim() ? parseInt(pages, 10) : null;
    setSaving(true);
    try {
      const created = await readingLogs.create({
        book_title: title.trim(),
        book_author: author.trim() || null,
        session_date: date || null,
        pages_read: n != null && Number.isFinite(n) ? n : null,
        notes: notes.trim() || null,
      });
      if (!created.success || !created.data) return toast.error(created.error || k('save_failed'));
      if (attach && audio) {
        const up = await media.uploadRecording(audio);
        if (up.success && up.data?.path) {
          const linked = await readingLogs.attachAudio(created.data.id, up.data.path);
          if (!linked.success) toast.info(k('audio_not_attached'));
        } else {
          toast.info(k('audio_upload_failed', { error: up.error || t('common.error') }));
        }
      }
      toast.success(k('saved'));
      setTitle('');
      setAuthor('');
      setDate(todayYmd());
      setPages('');
      setNotes('');
      discard();
      logs.mutate();
    } finally {
      setSaving(false);
    }
  }

  const list = logs.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => logs.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <Panel className="gap-4 p-4">
          <Text className="text-base font-semibold">{k('details')}</Text>
          <View className="gap-1.5">
            <Label>{k('book_title')}</Label>
            <Input value={title} onChangeText={setTitle} placeholder={k('book_title_ph')} />
          </View>
          <View className="gap-1.5">
            <Label>{k('author')}</Label>
            <Input value={author} onChangeText={setAuthor} placeholder={k('author_ph')} />
          </View>
          <DateField label={k('session_date')} value={date} onChange={setDate} />
          <View className="gap-1.5">
            <Label>{k('pages_read')}</Label>
            <Input value={pages} onChangeText={(v) => setPages(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder={k('pages_ph')} />
          </View>
          <View className="gap-1.5">
            <Label>{k('notes')}</Label>
            <Textarea value={notes} onChangeText={setNotes} placeholder={k('notes_ph')} numberOfLines={3} />
          </View>

          <View className="bg-muted/40 gap-3 rounded-xl p-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Icon as={Mic} className="text-brand dark:text-brand-secondary size-4" />
              <Text className="text-sm font-medium">{k('audio_title')}</Text>
              <Text className="text-muted-foreground text-xs">{k('audio_optional')}</Text>
            </View>
            {audio ? (
              <View className="gap-2">
                <AudioClip key={audio.uri} url={audio.uri} />
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => setAttach(!attach)} className="flex-1 flex-row items-center gap-2" accessibilityRole="checkbox" accessibilityState={{ checked: attach }}>
                    <Checkbox checked={attach} onCheckedChange={setAttach} />
                    <Text className="flex-1 text-sm">{k('attach')}</Text>
                  </Pressable>
                  <Button size="sm" variant="ghost" onPress={discard}>
                    <Icon as={RefreshCw} className="size-3.5" />
                    <Text className="text-xs">{k('record_again')}</Text>
                  </Button>
                </View>
              </View>
            ) : Recorder ? (
              <Recorder key={recorderKey} onDone={gotAudio} disabled={saving} />
            ) : (
              <Button size="sm" variant="outline" className="self-start" onPress={pickAudio}>
                <Icon as={FileAudio} className="size-4" />
                <Text>{k('choose_audio')}</Text>
              </Button>
            )}
          </View>

          <Button onPress={save} disabled={saving}>
            <Icon as={CheckCircle} className="text-primary-foreground size-4" />
            <Text>{saving ? k('saving') : k('save')}</Text>
          </Button>
        </Panel>

        <Text className="text-lg font-semibold">{k('past')}</Text>
        {logs.isLoading ? (
          <LoadingList rows={3} />
        ) : logs.error && !list.length ? (
          <ErrorState message={logs.error.message} onRetry={() => logs.mutate()} />
        ) : !list.length ? (
          <EmptyState icon={BookOpen} title={k('empty')} />
        ) : (
          list.map((l) => <LogCard key={l.id} log={l} />)
        )}
      </ScrollView>
    </>
  );
}

function LogCard({ log }: { log: ReadingLog }) {
  const { t } = useTranslation();
  const r = (key: string, o?: Record<string, unknown>) => t(`teacherPages.readingLogs.${key}`, o);
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const age = Math.floor((now - new Date(log.created_at).getTime()) / 86400000);
  const expired = age > AUDIO_DAYS;
  const hasAudio = !!log.audio_url && !expired;
  return (
    <Panel className="flex-row gap-3 p-4">
      <IconTile icon={BookOpen} size={36} />
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold">{log.book_title}</Text>
        {log.book_author ? <Text className="text-muted-foreground text-xs">{log.book_author}</Text> : null}
        <View className="flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Icon as={Calendar} className="text-muted-foreground size-3" />
            <Text className="text-muted-foreground text-xs">{formatDate(log.session_date)}</Text>
          </View>
          {log.pages_read != null ? (
            <View className="flex-row items-center gap-1">
              <Icon as={FileText} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs">{r('pagesCount', { count: log.pages_read })}</Text>
            </View>
          ) : null}
          {hasAudio ? <StatusChip label={r('audio')} tone="success" /> : null}
          {log.audio_file_path && expired ? <StatusChip label={r('audioExpired')} tone="muted" /> : null}
        </View>
        {log.notes ? (
          <>
            <Button variant="link" size="sm" className="h-auto self-start px-0" onPress={() => setOpen(!open)}>
              <Icon as={open ? ChevronUp : ChevronDown} className="text-brand dark:text-brand-secondary size-3" />
              <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{open ? r('hideNotes') : t('app.st_rd_show_notes')}</Text>
            </Button>
            {open ? (
              <Text variant="muted" className="text-xs">
                {log.notes}
              </Text>
            ) : null}
          </>
        ) : null}
        {hasAudio && log.audio_url ? <AudioClip url={log.audio_url} /> : null}
      </View>
    </Panel>
  );
}
