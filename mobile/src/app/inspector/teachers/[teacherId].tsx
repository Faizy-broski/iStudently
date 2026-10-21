import { Stack, useLocalSearchParams } from 'expo-router';
import { Award, FileText, GraduationCap, Languages, Sparkles, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DetailHeader, FormSection } from '@/components/app/layout';
import { ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

/** A teacher's portfolio: education, certifications, languages, skills, past reports (web: /inspector/teachers/[teacherId]/portfolio). */
export default function TeacherPortfolio() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.portfolio.${key}`);
  const { teacherId } = useLocalSearchParams<{ teacherId: string }>();
  const res = useApi(teacherId ? ['inspector', 'portfolio', teacherId] : null, ([, , id]) => inspector.portfolio(id as string));
  if (res.isLoading) return <LoadingList rows={4} />;
  const p = res.data;
  if (!p) return <ErrorState message={res.error?.message || k('not_found')} onRetry={() => res.mutate()} />;
  const { teacher, qualifications: q } = p;
  const name = `${teacher.first_name} ${teacher.last_name}`;
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <DetailHeader name={name} subtitle={teacher.school?.name || teacher.school_id} photo={teacher.profile_photo_url} />
        <Section icon={GraduationCap} title={k('education_title')} empty={!q.education.length} none={k('no_data')}>
          {q.education.map((e) => (
            <Text key={e.id} className="text-sm">
              <Text className="text-sm font-medium">{e.qualification}</Text>
              {e.institute ? <Text className="text-muted-foreground text-sm">{` — ${e.institute}`}</Text> : null}
              {e.completed_on ? <Text className="text-muted-foreground text-xs">{` (${e.completed_on})`}</Text> : null}
            </Text>
          ))}
        </Section>
        <Section icon={Award} title={k('certifications_title')} empty={!q.certifications.length} none={k('no_data')}>
          {q.certifications.map((c) => (
            <Text key={c.id} className="text-sm">
              <Text className="text-sm font-medium">{c.title}</Text>
              {c.institute ? <Text className="text-muted-foreground text-sm">{` — ${c.institute}`}</Text> : null}
              {c.valid_through ? <Text className="text-muted-foreground text-xs">{` (${k('valid_through')} ${c.valid_through})`}</Text> : null}
            </Text>
          ))}
        </Section>
        <Section icon={Languages} title={k('languages_title')} empty={!q.languages.length} none={k('no_data')} row>
          {q.languages.map((l) => (
            <StatusChip key={l.id} label={l.title} tone="info" />
          ))}
        </Section>
        <Section icon={Sparkles} title={k('skills_title')} empty={!q.skills.length} none={k('no_data')} row>
          {q.skills.map((s) => (
            <StatusChip key={s.id} label={s.title} tone="info" />
          ))}
        </Section>
        <Section icon={FileText} title={k('historical_reports_title')} empty={!p.historical_reports.length} none={k('no_historical_reports')}>
          {null}
        </Section>
      </ScrollView>
    </>
  );
}

function Section({ icon, title, empty, none, row, children }: { icon: LucideIcon; title: string; empty: boolean; none: string; row?: boolean; children: ReactNode }) {
  return (
    <FormSection title={title} icon={icon}>
      <View className={row ? 'flex-row flex-wrap gap-2' : 'gap-2'}>{empty ? <Text className="text-muted-foreground text-sm">{none}</Text> : children}</View>
    </FormSection>
  );
}
