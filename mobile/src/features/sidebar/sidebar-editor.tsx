import type { ApiResponse, SidebarConfig, SidebarConfigInput } from '@studently/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Eye, ImagePlus, LayoutDashboard, Palette, RotateCcw } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { colors } from '@/lib/colors';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ColorField, NumberField } from '@/components/app/form';
import { FormSection } from '@/components/app/layout';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const POSITIONS = ['top', 'center', 'bottom', 'left', 'right'] as const;
/** Same presets as the web (SidebarConfigEditor COLOR_PRESETS). */
const PRESETS = [
  ['default_blue', colors.sidebarPresetDefaultBlue],
  ['deep_navy', colors.sidebarPresetDeepNavy],
  ['forest_green', colors.sidebarPresetForestGreen],
  ['burgundy', colors.sidebarPresetBurgundy],
  ['charcoal', colors.sidebarPresetCharcoal],
  ['dark_teal', colors.sidebarPresetDarkTeal],
  ['royal_purple', colors.sidebarPresetRoyalPurple],
  ['slate', colors.sidebarPresetSlate],
] as const;
const hexOrEmpty = z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, 'app.v_hex');
const schema = z.object({
  bg_color: hexOrEmpty,
  text_color: hexOrEmpty,
  bg_image_url: z.string().nullable(),
  bg_image_opacity: z.number({ error: 'app.v_opacity' }).min(0, 'app.v_opacity').max(1, 'app.v_opacity'),
  bg_image_position: z.enum(POSITIONS),
});
type FormValues = z.infer<typeof schema>;
const DEFAULTS: FormValues = { bg_color: '', text_color: '', bg_image_url: null, bg_image_opacity: 1, bg_image_position: 'center' };

/**
 * Web sidebar look (colour, text colour, background image): preview, upload, save, reset. Used for
 * the super admin's own sidebar, a school's, and a school admin's school/campus theme.
 */
export function SidebarEditor({
  cacheKey,
  load,
  save: saveFn,
  reset: resetFn,
  header,
}: {
  cacheKey: string[];
  load: () => Promise<ApiResponse<SidebarConfig | null>>;
  save: (input: SidebarConfigInput) => Promise<ApiResponse<SidebarConfig>>;
  reset: () => Promise<ApiResponse<SidebarConfig>>;
  header?: ReactNode;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const config = useApi(cacheKey, () => load());
  const [uploading, setUploading] = useState(false);
  const { control, handleSubmit, reset, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const f = useWatch({ control }) as FormValues;

  useEffect(() => {
    if (config.data !== undefined) {
      const c = config.data;
      reset({
        bg_color: c?.bg_color ?? '',
        text_color: c?.text_color ?? '',
        bg_image_url: c?.bg_image_url ?? null,
        bg_image_opacity: c?.bg_image_opacity ?? 1,
        bg_image_position: (POSITIONS as readonly string[]).includes(c?.bg_image_position ?? '') ? (c!.bg_image_position as FormValues['bg_image_position']) : 'center',
      });
    }
  }, [config.data, reset]);

  const save = useAction(
    (v: FormValues) =>
      saveFn({ ...v, bg_color: v.bg_color || null, text_color: v.text_color || null }),
    { success: t('app.saved'), onSuccess: () => config.mutate() },
  );
  const resetCfg = useAction(() => resetFn(), { success: t('app.sb_reset_ok'), onSuccess: () => config.mutate() });

  async function uploadImage() {
    const picked = await pickImage({ maxDimension: 1200 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setValue('bg_image_url', res.data.url, { shouldDirty: true });
    else toast.error(res.error || t('app.error_title'));
  }

  if (config.isLoading && config.data === undefined) return <LoadingList rows={3} />;

  return (
    <Screen scroll edges={['bottom']}>
        {header}
        <FormSection title={t('app.sb_preview_item')} icon={Eye}>
          <View className="h-40 overflow-hidden rounded-xl" style={{ backgroundColor: f.bg_color || colors.printText }}>
            {f.bg_image_url ? (
              <Image
                source={{ uri: f.bg_image_url }}
                style={{ position: 'absolute', inset: 0, opacity: f.bg_image_opacity ?? 1 }}
                contentFit="cover"
                contentPosition={f.bg_image_position}
              />
            ) : null}
            <View className="flex-row items-center gap-2 p-4">
              <Icon as={LayoutDashboard} size={18} color={f.text_color || colors.white} />
              <Text style={{ color: f.text_color || colors.white }} className="font-medium">
                {t('app.sb_preview_item')}
              </Text>
            </View>
          </View>
        </FormSection>

        <FormSection title={t('sidebarConfig.preset_colors')} icon={Palette}>
          <View className="flex-row flex-wrap gap-2">
            {PRESETS.map(([id, color]) => (
              <Pressable
                key={id}
                onPress={() => setValue('bg_color', color, { shouldDirty: true })}
                accessibilityRole="button"
                accessibilityLabel={t(`sidebarConfig.preset_${id}`)}
                accessibilityState={{ selected: f.bg_color?.toLowerCase() === color }}
                className={f.bg_color?.toLowerCase() === color ? 'border-brand dark:border-brand-secondary rounded-xl border-2 p-0.5' : 'rounded-xl border-2 border-transparent p-0.5'}>
                <View className="h-9 w-9 rounded-lg" style={{ backgroundColor: color }} />
              </Pressable>
            ))}
          </View>
          <ColorField control={control} name="bg_color" label={t('app.sb_bg_color')} />
          <ColorField control={control} name="text_color" label={t('app.sb_text_color')} />
        </FormSection>
        <FormSection title={t('app.sb_image')} icon={ImagePlus}>
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" onPress={uploadImage} disabled={uploading}>
              <Icon as={ImagePlus} className="size-4" />
              <Text>{uploading ? t('app.ob_uploading') : f.bg_image_url ? t('app.ob_change_logo') : t('app.ob_pick_logo')}</Text>
            </Button>
            {f.bg_image_url ? (
              <Button variant="ghost" size="sm" onPress={() => setValue('bg_image_url', null, { shouldDirty: true })}>
                <Text>{t('app.lp_remove_image')}</Text>
              </Button>
            ) : null}
          </View>
          {f.bg_image_url ? (
            <>
              <NumberField control={control} name="bg_image_opacity" label={t('app.sb_opacity')} />
              <Label>{t('app.sb_position')}</Label>
              <FilterChips value={f.bg_image_position} onChange={(p) => setValue('bg_image_position', p, { shouldDirty: true })} options={POSITIONS.map((p) => ({ value: p, label: t(`app.sb_pos_${p}`) }))} />
            </>
          ) : null}
        </FormSection>

        <Button onPress={handleSubmit((v) => save.run(v))} disabled={save.running || uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        <Button
          variant="ghost"
          className="bg-destructive-soft rounded-full"
          onPress={async () => {
            if (await confirm({ title: t('app.sb_reset_title'), body: t('app.sb_reset_body'), destructive: true, confirmLabel: t('app.lp_reset') })) resetCfg.run();
          }}
          disabled={resetCfg.running}>
          <Icon as={RotateCcw} className="text-destructive size-4" />
          <Text className="text-destructive">{t('app.lp_reset')}</Text>
        </Button>
    </Screen>
  );
}
