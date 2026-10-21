import { zodResolver } from '@hookform/resolvers/zod';
import type { GlobalPageRole, GlobalPageType } from '@studently/api-client';
import { v } from '@studently/shared-utils';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarRange, FileText, ImagePlus, Trash2, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips, MultiChips } from '@/components/app/filter-chips';
import { FormError, SwitchField, TextField } from '@/components/app/form';
import { FormSection } from '@/components/app/layout';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { media, platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const TYPES: GlobalPageType[] = ['url', 'embed', 'text', 'image'];
const ROLES: GlobalPageRole[] = ['admin', 'teacher', 'student', 'parent'];
const optionalDate = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'app.v_date');

const schema = z
  .object({
    title: v.required(200),
    page_type: z.enum(TYPES),
    url: z.string().trim().optional(),
    content: z.string().optional(),
    image_url: z.string().optional(),
    isActive: z.boolean(),
    is_template: z.boolean(),
    start_date: optionalDate,
    end_date: optionalDate,
    visible_to_roles: z.array(z.enum(ROLES)),
  })
  .refine((f) => !['url', 'embed'].includes(f.page_type) || /^https?:\/\/\S+$/.test(f.url ?? ''), { path: ['url'], message: 'app.v_url_required' })
  .refine((f) => f.page_type !== 'text' || !!f.content?.trim(), { path: ['content'], message: 'app.v_content_required' })
  .refine((f) => f.page_type !== 'image' || !!f.image_url, { path: ['image_url'], message: 'app.v_image_required' });
type FormValues = z.infer<typeof schema>;

export default function PublicPageForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const pages = useApi(['platform', 'global-pages'], () => platform.listGlobalPages());
  const page = pages.data?.find((p) => p.id === id);
  const [uploading, setUploading] = useState(false);

  const { control, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', page_type: 'text', url: '', content: '', image_url: '', isActive: true, is_template: false, start_date: '', end_date: '', visible_to_roles: [] },
  });
  useEffect(() => {
    if (page)
      reset({
        title: page.title,
        page_type: page.page_type,
        url: page.url ?? '',
        content: page.content ?? '',
        image_url: page.image_url ?? '',
        isActive: page.isActive,
        is_template: !!page.is_template,
        start_date: page.start_date?.slice(0, 10) ?? '',
        end_date: page.end_date?.slice(0, 10) ?? '',
        visible_to_roles: page.visible_to_roles ?? [],
      });
  }, [page, reset]);
  const [type, imageUrl] = useWatch({ control, name: ['page_type', 'image_url'] });

  const refresh = () => mutate((key) => Array.isArray(key) && key[1] === 'global-pages');
  const save = useAction(
    (f: FormValues) => {
      const body = {
        ...f,
        url: ['url', 'embed'].includes(f.page_type) ? f.url : undefined,
        content: f.page_type === 'text' ? f.content : undefined,
        image_url: f.page_type === 'image' ? f.image_url : undefined,
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
      };
      return editing ? platform.updateGlobalPage(id!, body) : platform.createGlobalPage(body);
    },
    { success: editing ? t('app.saved') : t('app.bl_created') },
  );
  const remove = useAction(platform.deleteGlobalPage, { success: t('app.bl_deleted') });

  async function uploadImage() {
    const picked = await pickImage({ maxDimension: 1600 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setValue('image_url', res.data.url, { shouldDirty: true, shouldValidate: true });
    else toast.error(res.error || t('app.error_title'));
  }

  if (editing && pages.isLoading && !page) return <LoadingList rows={4} />;

  const onSubmit = handleSubmit(async (f) => {
    if ((await save.run(f)).ok) {
      refresh();
      router.back();
    }
  });

  return (
    <>
      <Stack.Screen options={{ title: editing ? page?.title ?? '' : t('app.pp_new') }} />
      <Screen scroll edges={['bottom']}>
        <FormSection title={t('app.sa_details')} icon={FileText}>
          <TextField control={control} name="title" label={t('app.pp_page_title')} />
          <Label>{t('app.pp_type')}</Label>
          <FilterChips<GlobalPageType> value={type} onChange={(v) => setValue('page_type', v, { shouldDirty: true })} options={TYPES.map((x) => ({ value: x, label: t(`app.pp_type_${x}`) }))} />
          {type === 'url' || type === 'embed' ? (
            <TextField control={control} name="url" label={t('app.pp_url')} keyboardType="url" autoCapitalize="none" placeholder="https://" />
          ) : null}
          {type === 'text' ? <TextField control={control} name="content" label={t('app.pp_content')} hint={t('app.pp_content_hint')} multiline numberOfLines={10} className="min-h-48" /> : null}
          {type === 'image' ? (
            <View className="gap-2">
              <Label>{t('app.pp_image')}</Label>
              {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 180, borderRadius: 16 }} contentFit="contain" /> : null}
              <Button variant="outline" size="sm" onPress={uploadImage} disabled={uploading}>
                <Icon as={ImagePlus} className="size-4" />
                <Text>{uploading ? t('app.ob_uploading') : imageUrl ? t('app.ob_change_logo') : t('app.ob_pick_logo')}</Text>
              </Button>
              <FormError message={formState.errors.image_url?.message} />
            </View>
          ) : null}
        </FormSection>

        <FormSection title={t('app.pp_roles')} description={t('app.pp_roles_hint')} icon={Users}>
          <Controller
            control={control}
            name="visible_to_roles"
            render={({ field }) => <MultiChips<GlobalPageRole> value={field.value} onChange={field.onChange} options={ROLES.map((r) => ({ value: r, label: t(`app.pp_role_${r}`) }))} />}
          />
        </FormSection>

        <FormSection title={t('app.bl_status')} icon={CalendarRange}>
          <SwitchField control={control} name="isActive" label={t('app.pp_active')} />
          <SwitchField control={control} name="is_template" label={t('app.pp_draft')} />
          <TextField control={control} name="start_date" label={t('app.pp_start')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
          <TextField control={control} name="end_date" label={t('app.pp_end')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
        </FormSection>

        <Button onPress={onSubmit} disabled={save.running || uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing && page ? (
          <Button
            variant="ghost"
            className="bg-destructive-soft rounded-full"
            onPress={async () => {
              const ok = await confirm({ title: t('app.pp_delete_title', { title: page.title }), destructive: true, confirmLabel: t('app.bl_delete') });
              if (ok && (await remove.run(page.id)).ok) {
                refresh();
                router.back();
              }
            }}
            disabled={remove.running}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
