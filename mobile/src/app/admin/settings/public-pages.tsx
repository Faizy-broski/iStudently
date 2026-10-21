import { PUBLIC_PAGE_IDS, type PublicPageId, type PublicPagesConfig } from '@studently/api-client';
import { openBrowserAsync } from 'expo-web-browser';
import { router, Stack } from 'expo-router';
import { ExternalLink, Eye, Globe, Info, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { plainMessage } from '@/i18n/plain';
import { adminPublicPages } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';

const DEFAULT_CONFIG: PublicPagesConfig = { pages: [], default_page: 'login', custom_page_title: '', custom_page_content: '' };

/** What visitors see at the school's public URL, for the selected campus's settings row (web: /admin/settings/public-pages). */
export default function PublicPagesSettings() {
  const { t } = useTranslation();
  const u = (k: string, o?: Record<string, unknown>) => t(`school.public_pages.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'public-pages', campusId ?? 'school'], () => adminPublicPages.settings(campusId));
  const [config, setConfig] = useState<PublicPagesConfig>(DEFAULT_CONFIG);
  const [loadedKey, setLoadedKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (res.isLoading) return;
    setConfig({ ...DEFAULT_CONFIG, ...(res.data?.config ?? {}) });
    setLoadedKey((k) => k + 1);
  }, [res.data, res.isLoading]);

  const togglePage = (id: PublicPageId) => setConfig((p) => ({ ...p, pages: p.pages.includes(id) ? p.pages.filter((x) => x !== id) : [...p.pages, id] }));

  async function save() {
    setSaving(true);
    try {
      const r = await adminPublicPages.save(config, campusId);
      if (!r.success) return toast.error(r.error || u('msg_save_error'));
      toast.success(u('msg_save_success'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  if (res.isLoading) return <LoadingList />;
  const slug = res.data?.slug ?? null;
  const publicUrl = slug ? `${env.webUrl}/p/${slug}` : null;
  const pageOptions = [{ value: 'login', label: u('login_default') }, ...PUBLIC_PAGE_IDS.filter((id) => config.pages.includes(id)).map((id) => ({ value: id, label: u(`pages.${id}`) }))];

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: u('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={Globe} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{u('subtitle')}</Text>
          {publicUrl ? (
            <Pressable onPress={() => openBrowserAsync(publicUrl)} accessibilityRole="link" className="flex-row items-center gap-1">
              <Icon as={Eye} className="text-primary size-4" />
              <Text className="text-primary text-sm">{u('btn_preview')}</Text>
              <Icon as={ExternalLink} className="text-primary size-3" />
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => router.push('/admin/settings/plugins')} accessibilityRole="link" className="flex-row gap-2 rounded-xl border border-info-soft bg-info-soft p-3">
          <Icon as={Info} className="mt-0.5 size-4 text-brand dark:text-brand-secondary " />
          <View className="flex-1 gap-1">
            <Text className="text-sm text-brand dark:text-brand-secondary ">{plainMessage('school.public_pages.activation_notice.text', { link: u('activation_notice.link_text'), bold: u('title') })}</Text>
            {publicUrl ? (
              <Text className="font-mono text-xs text-brand dark:text-brand-secondary " selectable>
                {publicUrl}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="font-semibold">{u('card_visible_title')}</Text>
              <Text className="text-muted-foreground text-sm">{u('card_visible_subtitle')}</Text>
            </View>
            {PUBLIC_PAGE_IDS.map((id) => (
              <View key={id} className="flex-row items-center gap-3">
                <Switch checked={config.pages.includes(id)} onCheckedChange={() => togglePage(id)} />
                <Label onPress={() => togglePage(id)}>{u(`pages.${id}`)}</Label>
              </View>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="font-semibold">{u('card_default_title')}</Text>
              <Text className="text-muted-foreground text-sm">{u('card_default_subtitle')}</Text>
            </View>
            <Picker value={config.default_page} onChange={(v) => setConfig((p) => ({ ...p, default_page: v as PublicPagesConfig['default_page'] }))} options={pageOptions} />
          </CardContent>
        </Card>

        {config.pages.includes('custom') ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <View>
                <Text className="font-semibold">{u('card_custom_title')}</Text>
                <Text className="text-muted-foreground text-sm">{u('card_custom_subtitle')}</Text>
              </View>
              <Label>{u('label_page_title')}</Label>
              <Input value={config.custom_page_title} onChangeText={(v) => setConfig((p) => ({ ...p, custom_page_title: v }))} placeholder={u('placeholder_page_title')} />
              <Label>{u('label_page_content')}</Label>
              <HtmlEditorField key={`c-${loadedKey}`} value={config.custom_page_content} onChange={(v) => setConfig((p) => ({ ...p, custom_page_content: v }))} />
            </CardContent>
          </Card>
        ) : null}

        <Separator />
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? u('btn_saving') : u('btn_save')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
