import { zodResolver } from '@hookform/resolvers/zod';
import { DEFAULT_LOGIN_PAGE_CONFIG, type LoginPageConfig } from '@studently/api-client';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { ImagePlus, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ColorField, NumberField, TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { media, platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'app.v_hex');
const text = z.string().trim().max(200, 'app.v_too_long');
const schema = z.object({
  background_type: z.enum(['gradient', 'color', 'image']),
  gradient_from: hex,
  gradient_to: hex,
  background_color: hex,
  background_image_url: z.string().nullable(),
  background_image_opacity: z.number({ error: 'app.v_opacity' }).min(0, 'app.v_opacity').max(1, 'app.v_opacity'),
  text_color_left: hex,
  text_color_right: hex,
  logo_url: z.string().nullable(),
  form_offset_x: z.number({ error: 'app.v_number' }).int(),
  form_offset_y: z.number({ error: 'app.v_number' }).int(),
  form_width: z.number({ error: 'app.v_number' }).int().min(280, 'app.v_too_short').max(900, 'app.v_too_long'),
  title_en: text,
  title_ar: text,
  subtitle_en: text,
  subtitle_ar: text,
  heading_en: text,
  heading_ar: text,
});
type FormValues = z.infer<typeof schema>;

/** Rough phone-size preview: background, two text colors and the logo. */
function Preview({ control }: { control: Control<FormValues> }) {
  const { i18n } = useTranslation();
  const f = useWatch({ control }) as Partial<FormValues>;
  const ar = i18n.language === 'ar';
  const bg = f.background_type === 'color' ? f.background_color : f.gradient_from;
  return (
    <View className="h-44 flex-row overflow-hidden rounded-lg">
      <View className="flex-1 items-start justify-center gap-1 bg-white p-3">
        {f.logo_url ? <Image source={{ uri: f.logo_url }} style={{ width: 36, height: 36 }} contentFit="contain" /> : null}
        <Text style={{ color: f.text_color_left }} className="font-semibold" numberOfLines={2}>
          {(ar ? f.heading_ar : f.heading_en) || 'Login'}
        </Text>
      </View>
      <View className="flex-1 justify-center gap-1 p-3" style={{ backgroundColor: bg }}>
        {f.background_type === 'image' && f.background_image_url ? (
          <Image
            source={{ uri: f.background_image_url }}
            style={{ position: 'absolute', inset: 0, opacity: f.background_image_opacity ?? 1 }}
            contentFit="cover"
          />
        ) : null}
        {f.background_type === 'gradient' ? <View className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundColor: f.gradient_to, opacity: 0.85 }} /> : null}
        <Text style={{ color: f.text_color_right }} className="font-bold" numberOfLines={2}>
          {(ar ? f.title_ar : f.title_en) || 'Studently'}
        </Text>
        <Text style={{ color: f.text_color_right }} className="text-xs" numberOfLines={2}>
          {ar ? f.subtitle_ar : f.subtitle_en}
        </Text>
      </View>
    </View>
  );
}

export default function LoginPageSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const config = useApi(['platform', 'login-page'], () => platform.getLoginPageConfig());
  const [uploading, setUploading] = useState<'logo' | 'bg' | null>(null);
  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULT_LOGIN_PAGE_CONFIG });
  const [bgType, bgImage, logo] = useWatch({ control, name: ['background_type', 'background_image_url', 'logo_url'] });

  useEffect(() => {
    if (config.data) reset({ ...DEFAULT_LOGIN_PAGE_CONFIG, ...config.data } as LoginPageConfig);
  }, [config.data, reset]);

  const save = useAction((f: FormValues) => platform.updateLoginPageConfig(f), { success: t('app.saved'), onSuccess: () => config.mutate() });
  const resetCfg = useAction(platform.resetLoginPageConfig, { success: t('app.lp_reset_ok'), onSuccess: () => config.mutate() });

  async function upload(target: 'logo' | 'bg') {
    const picked = await pickImage({ maxDimension: target === 'bg' ? 1920 : 512 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(target);
    const res = await media.uploadImage(picked.file);
    setUploading(null);
    if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
    setValue(target === 'logo' ? 'logo_url' : 'background_image_url', res.data.url, { shouldDirty: true });
  }

  if (config.isLoading && !config.data) return <LoadingList rows={4} />;

  return (
    <>
      <Stack.Screen options={{ title: t('app.lp_title') }} />
      <Screen scroll edges={['bottom']}>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.lp_preview')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <Preview control={control} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.lp_background')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <FilterChips<FormValues['background_type']>
              value={bgType}
              onChange={(v) => setValue('background_type', v, { shouldDirty: true })}
              options={[
                { value: 'gradient', label: t('app.lp_bg_gradient') },
                { value: 'color', label: t('app.lp_bg_color') },
                { value: 'image', label: t('app.lp_bg_image') },
              ]}
            />
            {bgType === 'gradient' ? (
              <>
                <ColorField control={control} name="gradient_from" label={t('app.lp_gradient_from')} />
                <ColorField control={control} name="gradient_to" label={t('app.lp_gradient_to')} />
              </>
            ) : null}
            {bgType === 'color' ? <ColorField control={control} name="background_color" label={t('app.lp_bg_color_label')} /> : null}
            {bgType === 'image' ? (
              <>
                <Label>{t('app.lp_image')}</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Button variant="outline" size="sm" onPress={() => upload('bg')} disabled={!!uploading}>
                    <Icon as={ImagePlus} className="size-4" />
                    <Text>{uploading === 'bg' ? t('app.ob_uploading') : bgImage ? t('app.ob_change_logo') : t('app.ob_pick_logo')}</Text>
                  </Button>
                  {bgImage ? (
                    <Button variant="ghost" size="sm" onPress={() => setValue('background_image_url', null, { shouldDirty: true })}>
                      <Text>{t('app.lp_remove_image')}</Text>
                    </Button>
                  ) : null}
                </View>
                <NumberField control={control} name="background_image_opacity" label={t('app.lp_image_opacity')} />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.lp_text')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <Label>{t('app.lp_logo')}</Label>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={() => upload('logo')} disabled={!!uploading}>
                <Icon as={ImagePlus} className="size-4" />
                <Text>{uploading === 'logo' ? t('app.ob_uploading') : logo ? t('app.ob_change_logo') : t('app.ob_pick_logo')}</Text>
              </Button>
              {logo ? (
                <Button variant="ghost" size="sm" onPress={() => setValue('logo_url', null, { shouldDirty: true })}>
                  <Text>{t('app.lp_remove_image')}</Text>
                </Button>
              ) : null}
            </View>
            <ColorField control={control} name="text_color_left" label={t('app.lp_text_left')} />
            <ColorField control={control} name="text_color_right" label={t('app.lp_text_right')} />
            <TextField control={control} name="title_en" label={t('app.lp_title_en')} />
            <TextField control={control} name="title_ar" label={t('app.lp_title_ar')} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
            <TextField control={control} name="subtitle_en" label={t('app.lp_subtitle_en')} />
            <TextField control={control} name="subtitle_ar" label={t('app.lp_subtitle_ar')} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
            <TextField control={control} name="heading_en" label={t('app.lp_heading_en')} />
            <TextField control={control} name="heading_ar" label={t('app.lp_heading_ar')} style={{ writingDirection: 'rtl', textAlign: 'right' }} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.lp_advanced')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <NumberField control={control} name="form_width" label={t('app.lp_form_width')} keyboardType="number-pad" />
            <NumberField control={control} name="form_offset_x" label={t('app.lp_offset_x')} keyboardType="numbers-and-punctuation" />
            <NumberField control={control} name="form_offset_y" label={t('app.lp_offset_y')} keyboardType="numbers-and-punctuation" />
          </CardContent>
        </Card>

        <Button onPress={handleSubmit((f) => save.run(f))} disabled={save.running || !!uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        <Button
          variant="ghost"
          onPress={async () => {
            if (await confirm({ title: t('app.lp_reset_title'), body: t('app.lp_reset_body'), destructive: true, confirmLabel: t('app.lp_reset') })) resetCfg.run();
          }}
          disabled={resetCfg.running}>
          <Icon as={RotateCcw} className="text-destructive size-4" />
          <Text className="text-destructive">{t('app.lp_reset')}</Text>
        </Button>
      </Screen>
    </>
  );
}
