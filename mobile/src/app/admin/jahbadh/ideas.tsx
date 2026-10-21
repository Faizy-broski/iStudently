import { jgAssessmentContent } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';

/** Assessment ideas (web: /admin/jahbadh-grades/ideas): principles and 20 ideas linked to the memo's components. */
export default function JahbadhIdeas() {
  const { t, i18n } = useTranslation();
  const { principles, ideas } = jgAssessmentContent(i18n.language);
  return (
    <>
      <Stack.Screen options={{ title: t('grades.ideas') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">{t('grades.ideasSubtitle')}</Text>
        <FormSection title={t('grades.principles')}>
          {principles.map((p, i) => (
            <Text key={i} className="text-sm leading-6">{`• ${p}`}</Text>
          ))}
        </FormSection>
        {ideas.map((idea, i) => (
          <FormSection key={i} title={`${i + 1}. ${idea.title}`}>
            <View className="flex-row flex-wrap gap-1.5">
              <StatusChip label={idea.component} tone="success" />
              <StatusChip label={`${t('grades.gradesRange')} ${idea.grades}`} tone="muted" />
              <StatusChip label={idea.subjects} tone="muted" />
            </View>
            <Text className="text-sm leading-6">{idea.how}</Text>
            {idea.tool ? <Text className="text-brand dark:text-brand-secondary text-xs">{`${t('grades.suggestedTool')}: ${idea.tool}`}</Text> : null}
          </FormSection>
        ))}
      </ScrollView>
    </>
  );
}
