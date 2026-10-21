import type { FinaAudienceType, FinaPostInput, FinaPostType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Check, ImagePlus, RefreshCw, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { GatedImage, POST_TYPE_META, POST_TYPES, useFn } from '@/features/admin/fina';
import { TaggingPanel, useFinaUpload } from '@/features/admin/fina-media';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useRoleBase } from '@/features/portal/role-base';

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
/** "YYYY-MM-DD" + "HH:MM" -> local ISO-like value the web's datetime-local input sends. */
const joinDateTime = (d: string, t: string) => (d ? `${d}T${t || '00:00'}` : '');

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={cn('rounded-full border px-3 py-1', on ? 'border-brand bg-brand' : 'border-border')}>
      <Text className={cn('text-xs', on && 'text-white')}>{label}</Text>
    </Pressable>
  );
}

/** Attach ready photos; upload new ones and tag them inline without leaving the draft (web: composer's add-photos dialog). */
function MediaDialog({ selected, onToggle, onClose }: { selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const { f } = useFn('composer');
  const { campusId } = useCampus();
  const ready = useApi(['admin', 'fina-media-ready', campusId ?? 'school'], () => fina.myReadyMedia(campusId));
  const pending = useApi(['admin', 'fina-media-pending', campusId ?? 'school'], () => fina.pendingTagging(campusId));
  const reload = () => (ready.mutate(), pending.mutate());
  const { upload, uploading } = useFinaUpload(reload);
  const [tagging, setTagging] = useState<string | null>(null);
  const readyList = ready.data ?? [];
  const pendingList = pending.data ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92%] w-[96vw] max-w-lg">
        <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          {tagging ? (
            <>
              <DialogHeader>
                <DialogTitle>{f('inline_tagging_title')}</DialogTitle>
              </DialogHeader>
              <TaggingPanel
                mediaId={tagging}
                onConfirmed={() => {
                  setTagging(null);
                  reload();
                }}
                footer={
                  <Button variant="outline" className="flex-1" onPress={() => setTagging(null)}>
                    <Text>{f('back_button')}</Text>
                  </Button>
                }
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{f('add_photos')}</DialogTitle>
              </DialogHeader>
              <View className="flex-row gap-2">
                <Button variant="outline" size="sm" className="flex-1" onPress={upload} disabled={uploading}>
                  <Icon as={Upload} className="text-foreground size-4" />
                  <Text>{uploading ? f('uploading') : f('upload_from_device')}</Text>
                </Button>
                <Button variant="ghost" size="icon" onPress={reload} accessibilityLabel={f('refresh_button')}>
                  <Icon as={RefreshCw} className="text-foreground size-4" />
                </Button>
              </View>
              {!readyList.length && !pendingList.length ? <Text className="text-muted-foreground text-sm">{f('ready_section_empty_composer')}</Text> : null}
              <View className="flex-row flex-wrap gap-1.5">
                {readyList.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <Pressable key={m.id} onPress={() => onToggle(m.id)} className={cn('aspect-square w-[31.5%] overflow-hidden rounded-md border-2', on ? 'border-brand' : 'border-transparent')}>
                      <GatedImage mediaId={m.id} variant="thumb" className="size-full" />
                      {on ? (
                        <View className="absolute end-1 top-1 rounded-full bg-brand p-0.5">
                          <Icon as={Check} className="size-3 text-white" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {pendingList.length ? (
                <View className="gap-2">
                  <Text className="text-xs text-warning ">{f('needs_tagging_notice')}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {pendingList.map((m) => (
                      <Pressable key={m.id} onPress={() => setTagging(m.id)} className="aspect-square w-[31.5%] overflow-hidden rounded-md">
                        <GatedImage mediaId={m.id} raw thumb className="size-full opacity-60" />
                        <View className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5">
                          <Text className="text-center text-[10px] text-white">{f('tap_to_tag')}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <Button onPress={onClose}>
                <Text>{f('done_button')}</Text>
              </Button>
            </>
          )}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}

/** Type-first composer: pick the post type, then only that type's fields (web: /admin/fina/compose). */
export default function FinaCompose() {
  const role = useRoleBase();
  const { f, t } = useFn('composer');
  const toast = useToast();
  const { campusId } = useCampus();
  const opts = useApi(['admin', 'fina-composer-options', campusId ?? 'school'], () => fina.composerOptions(campusId));
  const sections = opts.data?.sections ?? [];
  const students = opts.data?.students ?? [];

  const [type, setType] = useState<FinaPostType | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [audience, setAudience] = useState<FinaAudienceType>('classes');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [pollDate, setPollDate] = useState('');
  const [pollTime, setPollTime] = useState('');
  const [remDate, setRemDate] = useState('');
  const [remTime, setRemTime] = useState('09:00');
  const [url, setUrl] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [comments, setComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = (() => {
    if (!type) return false;
    if (type === 'poll') return !!pollQ.trim() && pollOpts.filter((o) => o.trim()).length >= 2;
    if (type === 'achievement') return studentIds.length === 1 && !!title.trim();
    if (type === 'reminder') return !!title.trim() && !!remDate;
    if (type === 'resource') return !!title.trim() && !!url.trim();
    return !!body.trim() || !!title.trim();
  })();

  async function submit() {
    if (!type) return;
    setSubmitting(true);
    try {
      const input: FinaPostInput = { type, title: title.trim() || undefined, body: body.trim() || undefined, media_ids: media.length ? media : undefined, comments_enabled: comments };
      const ref = audience === 'classes' ? { section_ids: sectionIds } : audience === 'students' ? { student_ids: studentIds } : {};
      if (type === 'achievement') {
        input.audience_type = 'students';
        input.audience_ref = { student_ids: studentIds };
        input.type_data = { student_id: studentIds[0] };
      } else if (type === 'urgent') {
        input.audience_type = 'school';
        input.is_emergency = emergency;
      } else {
        input.audience_type = audience;
        input.audience_ref = ref;
        if (type === 'poll') input.type_data = { question: pollQ.trim(), options: pollOpts.filter((o) => o.trim()), closes_at: joinDateTime(pollDate, pollTime) || null };
        if (type === 'reminder') input.type_data = { datetime: joinDateTime(remDate, remTime) };
        if (type === 'resource') input.type_data = { url: url.trim() };
      }
      const created = await fina.createPost(input, campusId);
      if (!created.success || !created.data) return toast.error(created.error || f('error_generic'));
      const submitted = await fina.submitPost(created.data.id, campusId);
      if (!submitted.success) return toast.error(submitted.error || f('error_generic'));
      toast.success(f('submit_success'));
      router.replace(role.href('/fina/wall'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!type) {
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: f('step_choose_type') }} />
        <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 p-4 pb-10">
          {POST_TYPES.map((pt) => {
            const meta = POST_TYPE_META[pt];
            return (
              <Pressable key={pt} onPress={() => setType(pt)} className="border-border w-[47.5%] items-center gap-2 rounded-xl border p-4">
                <View className="size-12 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
                  <Icon as={meta.icon} className="size-6" color={meta.color} />
                </View>
                <Text className="text-sm font-medium">{t(`fina.posts.type_${pt}`)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const meta = POST_TYPE_META[type];
  const has = (...types: FinaPostType[]) => types.includes(type);
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: t(`fina.posts.type_${type}`),
          headerLeft: () => (
            <Pressable onPress={() => setType(null)} hitSlop={8} className="p-1" accessibilityLabel={f('back_button')}>
              <Icon flipRtl as={ArrowLeft} className="text-foreground size-5" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center gap-2">
            <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
              <Icon as={meta.icon} className="size-4" color={meta.color} />
            </View>
            <Text className="flex-1 text-lg font-semibold">{t(`fina.posts.type_${type}`)}</Text>
          </View>
          <Card>
            <CardContent className="gap-4 pt-4">
              {type === 'achievement' ? (
                <View className="gap-1.5">
                  <Label>{f('field_achievement_student')}</Label>
                  <View className="flex-row flex-wrap gap-1.5">
                    {students.map((s) => (
                      <Chip key={s.id} label={s.name} on={studentIds[0] === s.id} onPress={() => setStudentIds([s.id])} />
                    ))}
                  </View>
                </View>
              ) : null}
              {has('activity', 'announcement', 'achievement', 'congratulation', 'resource', 'reminder') ? (
                <View className="gap-1.5">
                  <Label>{f('field_title')}</Label>
                  <Input value={title} onChangeText={setTitle} />
                </View>
              ) : null}
              {has('activity', 'announcement', 'achievement', 'congratulation', 'resource', 'urgent') ? (
                <View className="gap-1.5">
                  <Label>{f('field_body')}</Label>
                  <Input value={body} onChangeText={setBody} multiline numberOfLines={4} className="min-h-24" textAlignVertical="top" />
                </View>
              ) : null}
              {type === 'resource' ? (
                <View className="gap-1.5">
                  <Label>{f('field_resource_url')}</Label>
                  <Input value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" />
                </View>
              ) : null}
              {type === 'reminder' ? (
                <View className="gap-1.5">
                  <Label>{f('field_reminder_datetime')}</Label>
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={remDate} onChange={setRemDate} />
                    <TimeField className="w-36" value={remTime} onChange={setRemTime} />
                  </View>
                </View>
              ) : null}
              {type === 'poll' ? (
                <>
                  <View className="gap-1.5">
                    <Label>{f('field_poll_question')}</Label>
                    <Input value={pollQ} onChangeText={setPollQ} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{f('field_poll_options')}</Label>
                    {pollOpts.map((o, i) => (
                      <Input key={i} value={o} onChangeText={(v) => setPollOpts((p) => p.map((x, j) => (j === i ? v : x)))} />
                    ))}
                    <Button variant="outline" size="sm" onPress={() => setPollOpts((p) => [...p, ''])}>
                      <Text>{f('add_option')}</Text>
                    </Button>
                  </View>
                  <View className="gap-1.5">
                    <Label>{f('field_poll_closes_at')}</Label>
                    <View className="flex-row gap-2">
                      <DateField className="flex-1" value={pollDate} onChange={setPollDate} clearable />
                      <TimeField className="w-36" value={pollTime} onChange={setPollTime} />
                    </View>
                  </View>
                </>
              ) : null}
              {has('activity', 'announcement', 'achievement', 'congratulation') ? (
                <View className="gap-2">
                  <Label>{f('field_photos')}</Label>
                  {media.length ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {media.map((id) => (
                        <View key={id} className="size-20 overflow-hidden rounded-md">
                          <GatedImage mediaId={id} variant="thumb" className="size-full" />
                          <Pressable onPress={() => setMedia((m) => m.filter((x) => x !== id))} className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5" hitSlop={6}>
                            <Icon as={X} className="size-3 text-white" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Button variant="outline" size="sm" className="self-start" onPress={() => setMediaOpen(true)}>
                    <Icon as={ImagePlus} className="text-foreground size-4" />
                    <Text>{f('add_photos')}</Text>
                  </Button>
                </View>
              ) : null}
              {type === 'urgent' ? (
                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Label>{f('emergency_toggle')}</Label>
                    <Text className="text-muted-foreground text-xs">{f('emergency_notice')}</Text>
                  </View>
                  <Switch checked={emergency} onCheckedChange={setEmergency} />
                </View>
              ) : type !== 'achievement' ? (
                <View className="gap-2">
                  <Label>{f('field_audience')}</Label>
                  <FilterChips
                    value={audience}
                    onChange={setAudience}
                    options={[
                      { value: 'classes', label: f('audience_classes') },
                      { value: 'students', label: f('audience_students') },
                      { value: 'school', label: f('audience_school') },
                    ]}
                  />
                  {audience === 'classes' ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {sections.map((s) => (
                        <Chip key={s.id} label={s.name} on={sectionIds.includes(s.id)} onPress={() => setSectionIds((p) => toggle(p, s.id))} />
                      ))}
                    </View>
                  ) : audience === 'students' ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {students.map((s) => (
                        <Chip key={s.id} label={s.name} on={studentIds.includes(s.id)} onPress={() => setStudentIds((p) => toggle(p, s.id))} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {type !== 'achievement' ? (
                <View className="flex-row items-center gap-3">
                  <Label className="flex-1">{f('comments_enabled_label')}</Label>
                  <Switch checked={comments} onCheckedChange={setComments} />
                </View>
              ) : null}
            </CardContent>
          </Card>
          <Button onPress={submit} disabled={!canSubmit || submitting}>
            <Text>{submitting ? f('submitting') : f('submit_button')}</Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      {mediaOpen ? <MediaDialog selected={media} onToggle={(id) => setMedia((m) => toggle(m, id))} onClose={() => setMediaOpen(false)} /> : null}
    </View>
  );
}
