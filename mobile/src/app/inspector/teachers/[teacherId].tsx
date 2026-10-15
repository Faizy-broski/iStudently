import { Stack, useLocalSearchParams } from 'expo-router';
import { Award, Building2, FileText, GraduationCap, Languages, Sparkles, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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
  if (!p) return <Text className="text-muted-foreground p-6 text-center">{res.error?.message || k('not_found')}</Text>;
  const { teacher, qualifications: q } = p;
  const name = `${teacher.first_name} ${teacher.last_name}`;
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Card>
          <CardContent className="flex-row items-center gap-3 p-4">
            <PersonAvatar url={teacher.profile_photo_url} name={name} size={56} />
            <View className="flex-1">
              <Text className="text-lg font-semibold">{name}</Text>
              <View className="flex-row items-center gap-1">
                <Icon as={Building2} className="text-muted-foreground size-3.5" />
                <Text className="text-muted-foreground text-sm">{teacher.school?.name || teacher.school_id}</Text>
              </View>
            </View>
          </CardContent>
        </Card>
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
            <Badge key={l.id} variant="outline">
              <Text className="text-xs">{l.title}</Text>
            </Badge>
          ))}
        </Section>
        <Section icon={Sparkles} title={k('skills_title')} empty={!q.skills.length} none={k('no_data')} row>
          {q.skills.map((s) => (
            <Badge key={s.id} variant="outline">
              <Text className="text-xs">{s.title}</Text>
            </Badge>
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
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Icon as={icon} className="size-5 text-[#022172] dark:text-blue-300" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className={row ? 'flex-row flex-wrap gap-2' : 'gap-2'}>{empty ? <Text className="text-muted-foreground text-sm">{none}</Text> : children}</CardContent>
    </Card>
  );
}
