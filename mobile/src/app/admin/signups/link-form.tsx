import { signupUrl, type SignupLink, type SignupRole } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { FilterChips } from '@/components/app/filter-chips';
import { NumberField, TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminSignups } from '@/lib/api';
import { env } from '@/lib/env';
import { useAction } from '@/lib/use-action';

const ROLES: SignupRole[] = ['teacher', 'student', 'parent', 'staff', 'librarian'];
const schema = z.object({
  role: z.enum(ROLES as [SignupRole, ...SignupRole[]]),
  label: z.string().trim().max(120, 'app.v_too_long'),
  max_uses: z.number({ error: 'app.v_number' }).int().min(1, 'app.v_min_one').nullable(),
  expires_at: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'app.v_date'),
});
type FormValues = z.infer<typeof schema>;

/** Generate a signup link for the selected campus (web: /admin/signup-links/new, basic options). */
export default function SignupLinkForm() {
  const { t } = useTranslation();
  const s = (k: string) => t(`signupLinks.${k}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const [created, setCreated] = useState<SignupLink | null>(null);
  const { control, handleSubmit, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'teacher', label: '', max_uses: null, expires_at: '' } });
  const role = useWatch({ control, name: 'role' });
  const save = useAction((f: FormValues) =>
    adminSignups.createLink({ role: f.role, label: f.label || null, max_uses: f.max_uses, expires_at: f.expires_at ? `${f.expires_at}T23:59:59` : null, campus_id: campusId ?? null }),
  );

  if (created) {
    const url = signupUrl(env.webUrl, created.token);
    return (
      <>
        <Stack.Screen options={{ title: s('generateSuccessTitle') }} />
        <Screen scroll edges={['bottom']}>
          <Text variant="muted">{s('generateSuccessDesc')}</Text>
          <Card className="py-3">
            <CardContent className="px-4">
              <Text selectable className="font-mono text-sm">
                {url}
              </Text>
            </CardContent>
          </Card>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="outline"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                toast.success(s('copied'));
              }}>
              <Text>{s('copyLink')}</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={() => Share.share({ message: url })}>
              <Text>{s('share')}</Text>
            </Button>
          </View>
          <Button onPress={() => router.back()}>
            <Text>{s('done')}</Text>
          </Button>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: s('generateTitle') }} />
      <Screen scroll edges={['bottom']}>
        <Label>{s('fieldRole')}</Label>
        <FilterChips<SignupRole> value={role} onChange={(v) => setValue('role', v)} options={ROLES.map((r) => ({ value: r, label: t(`app.role_${r}`) }))} />
        <TextField control={control} name="label" label={s('fieldLabel')} placeholder={s('fieldLabelPlaceholder')} hint={s('fieldLabelHint')} />
        <NumberField control={control} name="max_uses" label={s('fieldMaxUses')} placeholder={s('fieldMaxUsesUnlimited')} keyboardType="number-pad" />
        <TextField control={control} name="expires_at" label={s('fieldExpiry')} placeholder={`${s('fieldExpiryNever')} · ${t('app.bl_date_hint')}`} keyboardType="numbers-and-punctuation" />
        <Button
          disabled={save.running}
          onPress={handleSubmit(async (f) => {
            const res = await save.run(f);
            if (res.ok && res.data) {
              mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'signup-links');
              setCreated(res.data as SignupLink);
            }
          })}>
          <Text>{save.running ? s('generating') : s('generateSubmit')}</Text>
        </Button>
      </Screen>
    </>
  );
}
