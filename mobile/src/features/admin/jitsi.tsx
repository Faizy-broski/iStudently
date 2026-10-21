import type { JitsiRoom, JitsiRoomInput } from '@studently/api-client';
import { Lock, Mic, Users, Video } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconTile, RowActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

export function useLc() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`live_class.${k}`, o);
}

/** "Whole School" / campus / grade / grade – section, per the narrowest target (web: RoomCard audienceLabel). */
export function audienceLabel(room: JitsiRoom, l: (k: string) => string) {
  if (room.target_section?.name) return `${room.target_grade_level?.name ?? ''} – ${room.target_section.name}`.trim();
  return room.target_grade_level?.name || room.target_campus?.name || l('audience_whole_school');
}

export function RoomCard({ room, onJoin, onEdit, onDelete }: { room: JitsiRoom; onJoin: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const l = useLc();
  return (
    <Panel className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <IconTile icon={Video} size={40} />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold">{room.title || l('default_title')}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={Users} className="text-muted-foreground size-3" />
            <Text className="text-muted-foreground text-[11px]">{audienceLabel(room, l)}</Text>
          </View>
        </View>
        {room.password ? (
          <View className="bg-muted size-7 items-center justify-center rounded-full">
            <Icon as={Lock} className="text-muted-foreground size-3.5" />
          </View>
        ) : null}
        {room.start_audio_only ? (
          <View className="bg-muted size-7 items-center justify-center rounded-full">
            <Icon as={Mic} className="text-muted-foreground size-3.5" />
          </View>
        ) : null}
      </View>
      {room.description ? <Text className="text-muted-foreground text-sm">{room.description}</Text> : null}
      <View className="flex-row items-center gap-2">
        <RowActions onEdit={onEdit} onDelete={onDelete} editLabel={l('edit')} deleteLabel={l('delete')} />
        <Button size="sm" className="ms-auto rounded-full" onPress={onJoin}>
          <Icon as={Video} className="text-primary-foreground size-4" />
          <Text>{l('join')}</Text>
        </Button>
      </View>
    </Panel>
  );
}

/** Title, description, password, audio-only and audience (campus → grade → section) (web: RoomForm). */
export function RoomForm({ initial, submitting, onSubmit, onCancel }: { initial?: JitsiRoom; submitting: boolean; onSubmit: (v: JitsiRoomInput) => void; onCancel: () => void }) {
  const l = useLc();
  const { campuses, campusId } = useCampus();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [audioOnly, setAudioOnly] = useState(initial?.start_audio_only ?? false);
  const [campus, setCampus] = useState(initial ? (initial.target_campus_id ?? '') : (campusId ?? ''));
  const [grade, setGrade] = useState(initial?.target_grade_level_id ?? '');
  const [section, setSection] = useState(initial?.target_section_id ?? '');
  const grades = useApi(campus ? ['admin', 'grades', campus] : null, ([, , c]) => adminAcademics.grades(c as string));
  const sections = useApi(campus && grade ? ['admin', 'sections', campus, grade] : null, ([, , c, g]) => adminAcademics.sections(c as string, g as string));

  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>{l('room_title_label')}</Label>
        <Input value={title} onChangeText={setTitle} placeholder={l('room_title_placeholder')} />
      </View>
      <View className="gap-1.5">
        <Label>{l('room_description_label')}</Label>
        <Input value={description} onChangeText={setDescription} placeholder={l('room_description_placeholder')} />
      </View>
      <View className="gap-1.5">
        <Label>{l('room_password_label')}</Label>
        <Input value={password} onChangeText={setPassword} placeholder={l('room_password_placeholder')} autoCapitalize="none" />
      </View>
      <View className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3 py-2.5">
        <Icon as={Mic} className="text-brand dark:text-brand-secondary size-4" />
        <Text className="flex-1 text-sm font-medium">{l('start_audio_only_label')}</Text>
        <Switch checked={audioOnly} onCheckedChange={setAudioOnly} />
      </View>
      <View className="gap-1.5">
        <Label>{l('audience_label')}</Label>
        <Text className="text-muted-foreground text-xs">{l('audience_help')}</Text>
        <Picker
          value={campus}
          onChange={(v) => {
            setCampus(v);
            setGrade('');
            setSection('');
          }}
          options={[{ value: '', label: l('audience_whole_school') }, ...campuses.map((c) => ({ value: c.id, label: c.name }))]}
        />
        {campus ? (
          <Picker
            value={grade}
            onChange={(v) => {
              setGrade(v);
              setSection('');
            }}
            options={[{ value: '', label: l('audience_all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
          />
        ) : null}
        {grade ? <Picker value={section} onChange={setSection} options={[{ value: '', label: l('audience_all_sections') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]} /> : null}
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onCancel} disabled={submitting}>
          <Text>{l('cancel')}</Text>
        </Button>
        <Button
          className="flex-1"
          disabled={submitting || !title.trim()}
          onPress={() =>
            onSubmit({
              title: title.trim(),
              description: description.trim() || undefined,
              password: password.trim() || undefined,
              start_audio_only: audioOnly,
              target_campus_id: campus || null,
              target_grade_level_id: grade || null,
              target_section_id: section || null,
            })
          }>
          <Text>{submitting ? l('saving') : l('save')}</Text>
        </Button>
      </View>
    </View>
  );
}
