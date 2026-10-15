import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';

function Form({ initial }: { initial: boolean }) {
  const q = useQz();
  const toast = useToast();
  const { campusId } = useCampus();
  const [own, setOwn] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await adminQuiz.updateConfig({ campus_id: campusId ?? undefined, teacher_edit_own_only: own });
      if (!r.success) return toast.error(r.error || q('errors.failedToSave'));
      toast.success(q('premium.settingsSaved'));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="font-semibold">{q('questionAccessControl')}</Text>
        <Text className="text-muted-foreground text-sm">{q('questionAccessControlDescription')}</Text>
        <View className="flex-row items-start gap-3">
          <Switch checked={own} onCheckedChange={setOwn} />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-medium">{q('teacherEditOwn')}</Text>
            <Text className="text-muted-foreground text-xs">{q('teacherEditOwnHelp')}</Text>
          </View>
        </View>
        <Button onPress={save} disabled={saving}>
          <Text>{saving ? q('saving') : q('saveSettings')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Who may edit bank questions, and the premium quiz features (web: /admin/quiz/configuration). */
export default function QuizConfiguration() {
  const q = useQz();
  const { campusId } = useCampus();
  const cfg = useApi(['admin', 'quiz-config', campusId ?? 'school'], () => adminQuiz.config(campusId));
  const li = (label: string, text: string) => (
    <Text className="text-muted-foreground text-sm">
      • <Text className="text-foreground text-sm font-semibold">{q(label)}</Text> {q(text)}
    </Text>
  );
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: q('configuration') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        <Text className="text-muted-foreground text-xs">{q('premiumBadge')}</Text>
        {cfg.isLoading ? <LoadingList rows={2} /> : cfg.error ? <ErrorState message={cfg.error.message} onRetry={() => cfg.mutate()} /> : <Form key={campusId ?? 'school'} initial={cfg.data?.teacher_edit_own_only ?? false} />}
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{q('premium.title')}</Text>
            <Text className="text-muted-foreground text-sm">{q('premium.quizModuleFeatures')}</Text>
            {li('premium.copyQuizLabel', 'premium.duplicateQuiz')}
            {li('premium.answerBreakdownLabel', 'premium.questionAnalysis')}
            {li('premium.teacherAccessControlLabel', 'premium.restrictEditing')}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
