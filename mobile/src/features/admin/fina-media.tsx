import { Check, UserRound, Video, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { GatedImage, personName, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickMedia } from '@/lib/upload';
import { cn } from '@/lib/utils';

/** Upload photos/videos one by one, toasting each failure (web: the upload buttons in the media library and composer). */
export function useFinaUpload(onDone: () => void) {
  const { a } = useFn();
  const toast = useToast();
  const { campusId } = useCampus();
  const [uploading, setUploading] = useState(false);
  async function upload() {
    const picked = await pickMedia();
    if (!picked.length) return;
    setUploading(true);
    try {
      for (const p of picked) {
        if (!p.ok) {
          toast.error(`${p.name}: ${a('fn_video_format')}`);
          continue;
        }
        const r = await fina.uploadMedia(p.file, campusId);
        if (!r.success) toast.error(`${p.file.name}: ${r.error || ''}`);
      }
      onDone();
    } finally {
      setUploading(false);
    }
  }
  return { upload, uploading };
}

/**
 * Tag the students in a photo, or mark it as having no identifiable students, then confirm it
 * (web: MediaTaggingScreen and the composer's inline tagging). Uses the raw staff preview.
 */
export function TaggingPanel({ mediaId, onConfirmed, footer }: { mediaId: string; onConfirmed: () => void; footer?: React.ReactNode }) {
  const { f } = useFn('media');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-tagging', mediaId, campusId ?? 'school'], ([, , m]) => fina.tagging(m as string, campusId));
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const data = res.data;

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.success) return toast.error(r.error || '');
      if (after) after();
      else res.mutate();
    } finally {
      setBusy(false);
    }
  }

  if (res.isLoading || !data) return <LoadingList rows={3} />;
  const { media, tags, candidateStudents } = data;
  const tagged = new Set(tags.map((t) => t.student_id).filter(Boolean));
  const q = search.trim().toLowerCase();
  const candidates = candidateStudents.filter((c) => !tagged.has(c.id) && (!q || personName(c.profile).toLowerCase().includes(q)));
  const canConfirm = tags.length > 0 || media.no_identifiable_students;

  return (
    <View className="gap-3">
      {media.kind === 'image' ? (
        <GatedImage mediaId={mediaId} raw className="aspect-[4/3] w-full rounded-md" />
      ) : (
        <View className="bg-muted aspect-video w-full items-center justify-center gap-1 rounded-md">
          <Icon as={Video} className="text-muted-foreground size-8" />
          <Text className="text-muted-foreground text-xs">{f('kind_video')}</Text>
        </View>
      )}
      {tags.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {tags.map((t) => (
            <View key={t.id} className="flex-row items-center gap-1 rounded-full bg-blue-100 py-1 ps-3 pe-1 dark:bg-blue-900">
              <Text className="text-xs">{personName(t.student?.profile) || '—'}</Text>
              <Pressable onPress={() => run(() => fina.removeFaceTag(mediaId, t.id, campusId))} disabled={busy} hitSlop={6} className="p-0.5">
                <Icon as={X} className="text-foreground size-3.5" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Button variant={media.no_identifiable_students ? 'default' : 'outline'} onPress={() => run(() => fina.setNoIdentifiable(mediaId, !media.no_identifiable_students, campusId))} disabled={busy || tags.length > 0}>
        {media.no_identifiable_students ? <Icon as={Check} className="text-primary-foreground size-4" /> : null}
        <Text>{media.no_identifiable_students ? f('no_identifiable_active') : f('no_identifiable_button')}</Text>
      </Button>
      {!media.no_identifiable_students ? (
        <View className="gap-2">
          <SearchBar value={search} onChangeText={setSearch} placeholder={f('student_search_placeholder')} />
          <View className="border-border max-h-72 rounded-md border">
            {candidates.slice(0, 60).map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable onPress={() => run(() => fina.addFaceTag(mediaId, c.id, campusId))} disabled={busy} className="flex-row items-center gap-2 px-3 py-2">
                  <Icon as={UserRound} className="text-muted-foreground size-4" />
                  <Text className="flex-1 text-sm">{personName(c.profile)}</Text>
                  {c.section?.name ? <Text className="text-muted-foreground text-xs">{c.section.name}</Text> : null}
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View className={cn('flex-row gap-2')}>
        {footer}
        <Button
          className="flex-1"
          onPress={() =>
            run(
              () => fina.confirmTagging(mediaId, campusId),
              () => {
                toast.success(f('confirm_success'));
                onConfirmed();
              },
            )
          }
          disabled={busy || !canConfirm}>
          <Icon as={Check} className="text-primary-foreground size-4" />
          <Text>{f('confirm_button')}</Text>
        </Button>
      </View>
      {!canConfirm ? <Text className="text-muted-foreground text-center text-xs">{f('confirm_disabled_hint')}</Text> : null}
    </View>
  );
}
