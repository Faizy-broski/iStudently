import { zodResolver } from '@hookform/resolvers/zod';
import type { LibrarySettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { NumberField } from '@/components/app/form';
import { FormSection, StickyActions } from '@/components/app/layout';
import { Screen } from '@/components/app/screen';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

/**
 * Library policies: overdue fine per day, books per borrower, default loan length
 * (web: /librarian/settings; GET/PUT /schools/settings/library, admins and librarians).
 */
export function LibrarySettingsScreen() {
  const { t } = useTranslation();
  const k = (key: string) => t(`library_settings.${key}`);
  const res = useApi(['library', 'settings'], () => adminLibrary.settings());
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      {res.isLoading ? (
        <LoadingList rows={3} />
      ) : res.error || !res.data ? (
        <ErrorState message={res.error?.message} onRetry={() => res.mutate()} />
      ) : (
        // Keyed by the loaded values so the form starts from them (and again after a save).
        <SettingsForm key={JSON.stringify(res.data)} initial={res.data} onSaved={() => res.mutate()} />
      )}
    </>
  );
}

function SettingsForm({ initial, onSaved }: { initial: LibrarySettings; onSaved: () => void }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`library_settings.${key}`);
  // Same limits as the website form and the API.
  const [schema] = useState(() =>
    z.object({
      fine_per_day: z.number({ message: k('v_fine_min') }).min(0, k('v_fine_min')).max(100, k('v_fine_max')),
      max_books_per_student: z.number({ message: k('v_books_min') }).int().min(1, k('v_books_min')).max(20, k('v_books_max')),
      loan_duration_days: z.number({ message: k('v_days_min') }).int().min(1, k('v_days_min')).max(365, k('v_days_max')),
    }),
  );
  const { control, handleSubmit, reset } = useForm<LibrarySettings>({ resolver: zodResolver(schema), defaultValues: initial });
  const save = useAction((v: LibrarySettings) => adminLibrary.saveSettings(v), { success: k('saved'), onSuccess: onSaved });

  return (
    <View className="bg-background flex-1">
      <Screen scroll edges={['bottom']}>
        <Text variant="muted" className="text-sm">
          {k('subtitle')}
        </Text>
        <FormSection title={k('policies')} description={k('policies_desc')} icon={BookOpen}>
          <NumberField control={control} name="fine_per_day" label={k('fine')} hint={k('fine_desc')} />
          <NumberField control={control} name="max_books_per_student" label={k('max_books')} hint={k('max_books_desc')} />
          <NumberField control={control} name="loan_duration_days" label={k('loan_days')} hint={k('loan_days_desc')} />
        </FormSection>
      </Screen>
      <StickyActions>
        <Button variant="outline" onPress={() => reset(initial)} disabled={save.running}>
          <Text>{k('reset')}</Text>
        </Button>
        <Button className="flex-1" onPress={handleSubmit((v) => save.run(v))} disabled={save.running}>
          <Text>{save.running ? k('saving') : k('save')}</Text>
        </Button>
      </StickyActions>
    </View>
  );
}
