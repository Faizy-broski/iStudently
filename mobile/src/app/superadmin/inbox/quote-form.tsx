import { zodResolver } from '@hookform/resolvers/zod';
import { v } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { SwitchField, TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const schema = z.object({ text_en: v.required(500), text_ar: v.required(500), is_active: z.boolean() });
type FormValues = z.infer<typeof schema>;

export default function QuoteForm() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const quotes = useApi(['platform', 'quotes'], () => platform.listQuotes());
  const quote = quotes.data?.find((q) => q.id === id);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text_en: '', text_ar: '', is_active: true },
  });
  useEffect(() => {
    if (quote) reset({ text_en: quote.text_en, text_ar: quote.text_ar, is_active: quote.is_active });
  }, [quote, reset]);

  const refresh = () => mutate((key) => Array.isArray(key) && key[1] === 'quotes');
  const save = useAction(
    (values: FormValues) =>
      editing ? platform.updateQuote(id!, values) : platform.createQuote({ ...values, sort_order: quotes.data?.length ?? 0 }),
    { success: editing ? t('app.saved') : t('app.bl_created') },
  );
  const remove = useAction(platform.deleteQuote, { success: t('app.bl_deleted') });

  const onSubmit = handleSubmit(async (values) => {
    if ((await save.run(values)).ok) {
      refresh();
      router.back();
    }
  });

  async function onDelete() {
    const ok = await confirm({ title: t('app.ib_delete_quote_title'), destructive: true, confirmLabel: t('app.bl_delete') });
    if (ok && (await remove.run(id!)).ok) {
      refresh();
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('app.bl_edit') : t('app.ib_new_quote') }} />
      <Screen scroll edges={['bottom']}>
        <TextField control={control} name="text_en" label={t('app.ib_quote_en')} multiline />
        <TextField control={control} name="text_ar" label={t('app.ib_quote_ar')} multiline style={{ writingDirection: 'rtl', textAlign: 'right' }} />
        <SwitchField control={control} name="is_active" label={t('app.ib_quote_active')} />
        <Button onPress={onSubmit} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? (
          <Button variant="ghost" onPress={onDelete} disabled={remove.running}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
