import { Stack } from 'expo-router';
import { FileText, Info, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { RichTextField } from '@/components/app/rich-text-field';
import { ScrollView } from '@/components/app/keyboard';
import { Panel } from '@/components/app/panel';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminParentAgreement } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Title and content parents accept each academic year, per campus (web: /admin/settings/parent-agreement). */
export default function ParentAgreementSettings() {
  const { campusId } = useCampus();
  const config = useApi(['admin', 'parent-agreement', campusId ?? 'school'], () => adminParentAgreement.config(campusId));
  if (config.isLoading) return <LoadingList rows={3} />;
  return <Editor key={campusId ?? 'school'} initial={config.data ?? { title: '', content: '' }} onSaved={() => config.mutate()} />;
}

function Editor({ initial, onSaved }: { initial: { title: string; content: string }; onSaved: () => void }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pag_${key}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [title, setTitle] = useState(initial.title ?? '');
  const [content, setContent] = useState(initial.content ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error(k('title_required'));
    if (!content.trim() || content.trim() === '<p></p>') return toast.error(k('content_required'));
    setSaving(true);
    const r = await adminParentAgreement.saveConfig({ title: title.trim(), content }, campusId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('save_failed'));
    toast.success(k('saved'));
    onSaved();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <Icon as={FileText} className="text-brand dark:text-brand-secondary size-5" />
          <Text variant="muted" className="flex-1 text-sm">
            {k('subtitle')}
          </Text>
        </View>
        <Panel className="gap-2 p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Info} className="text-info size-4" />
            <Text className="text-sm font-semibold">{k('how_title')}</Text>
          </View>
          {[1, 2, 3, 4, 5].map((n) => (
            <Text key={n} variant="muted" className="text-sm">{`• ${k(`how_${n}`)}`}</Text>
          ))}
        </Panel>
        <Panel className="gap-3 p-4">
          <Text className="font-semibold">{k('config_title')}</Text>
          <Text variant="muted" className="text-xs">
            {k('config_desc')}
            {campusId ? ` ${k('campus_specific')}` : ''}
          </Text>
          <View className="gap-1.5">
            <Label>{k('field_title')}</Label>
            <Input value={title} onChangeText={setTitle} placeholder={k('field_title_placeholder')} editable={!saving} />
          </View>
          <View className="gap-1.5">
            <Label>{k('field_content')}</Label>
            <RichTextField value={content} onChange={setContent} campusId={campusId ?? undefined} minHeight={240} />
          </View>
          <Button onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator size="small" /> : <Icon as={Save} className="text-primary-foreground size-4" />}
            <Text>{k('save')}</Text>
          </Button>
        </Panel>
      </ScrollView>
    </>
  );
}
