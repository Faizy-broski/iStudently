import { router, Stack } from 'expo-router';
import { BookOpen, GraduationCap, TriangleAlert, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { HeroCard, IconTile, RowItem, Section, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

type Href = '/admin/academics/grades' | '/admin/academics/sections' | '/admin/academics/subjects';

/** School setup overview: grade levels → sections → subjects (web: /admin/academics). */
export default function AcademicsOverview() {
  const { t } = useTranslation();
  const o = (k: string, v?: Record<string, unknown>) => t(`school.overview.${k}`, v);
  const { campusId } = useCampus();
  const c = campusId ?? undefined;
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(c));
  const sections = useApi(['admin', 'sections-all', campusId ?? 'school'], () => adminAcademics.sections(c));
  const subjects = useApi(['admin', 'subjects-all', campusId ?? 'school'], () => adminAcademics.subjects(c));
  const count = (d: unknown[] | undefined) => (d ? String(d.length) : '—');

  const items: { title: string; desc: string; icon: LucideIcon; tone: Tone; href: Href; n: string }[] = [
    { title: o('grades_title'), desc: o('grades_desc'), icon: GraduationCap, tone: 'brand', href: '/admin/academics/grades', n: count(grades.data) },
    { title: o('sections_title'), desc: o('sections_desc'), icon: Users, tone: 'success', href: '/admin/academics/sections', n: count(sections.data) },
    { title: o('subjects_title'), desc: o('subjects_desc'), icon: BookOpen, tone: 'warning', href: '/admin/academics/subjects', n: count(subjects.data) },
  ];
  const steps: [LucideIcon, Tone, string, string][] = [
    [GraduationCap, 'brand', o('step1_title'), o('step1_desc')],
    [Users, 'success', o('step2_title'), o('step2_desc')],
    [BookOpen, 'warning', o('step3_title'), o('step3_desc')],
  ];

  return (
    <>
      <Stack.Screen options={{ title: o('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <HeroCard>
          <Text className="text-lg font-bold text-white">{o('title')}</Text>
          <Text className="text-sm text-white/80">{o('subtitle')}</Text>
          <View className="flex-row gap-2">
            {items.map((s) => (
              <View key={s.href} className="flex-1 rounded-2xl bg-white/15 px-3 py-2">
                <Text className="text-xl font-bold text-white">{s.n}</Text>
                <Text className="text-[11px] text-white/80" numberOfLines={1}>
                  {s.title}
                </Text>
              </View>
            ))}
          </View>
        </HeroCard>

        <Panel>
          {items.map((s, i) => (
            <RowItem
              key={s.href}
              leading={<IconTile icon={s.icon} tone={s.tone} size={40} />}
              title={o('manage', { title: s.title })}
              meta={s.desc}
              onPress={() => router.push(s.href)}
              last={i === items.length - 1}
            />
          ))}
        </Panel>

        <Section title={o('dependency_title')}>
          <Text variant="muted" className="text-sm">
            {o('dependency_subtitle')}
          </Text>
          <Panel>
            {steps.map(([icon, tone, title, desc], i) => (
              <RowItem key={title} leading={<IconTile icon={icon} tone={tone} round />} title={`${i + 1}. ${title}`} meta={desc} last={i === steps.length - 1} />
            ))}
          </Panel>
          <View className="bg-warning-soft flex-row gap-3 rounded-2xl p-4">
            <Icon as={TriangleAlert} className="text-warning size-5" />
            <Text className="text-warning flex-1 text-sm">
              <Text className="text-warning text-sm font-bold">{`${o('important')} `}</Text>
              {o('rule')}
            </Text>
          </View>
        </Section>
      </ScrollView>
    </>
  );
}
