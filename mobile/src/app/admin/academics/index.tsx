import { router, Stack } from 'expo-router';
import { ArrowRight, BookOpen, GraduationCap, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** School setup overview: grade levels → sections → subjects (web: /admin/academics). */
export default function AcademicsOverview() {
  const { t } = useTranslation();
  const o = (k: string, v?: Record<string, unknown>) => t(`school.overview.${k}`, v);
  const items: { title: string; desc: string; icon: LucideIcon; href: '/admin/academics/grades' | '/admin/academics/sections' | '/admin/academics/subjects'; fg: string; bg: string }[] = [
    { title: o('grades_title'), desc: o('grades_desc'), icon: GraduationCap, href: '/admin/academics/grades', fg: 'text-blue-600', bg: 'bg-blue-100' },
    { title: o('sections_title'), desc: o('sections_desc'), icon: Users, href: '/admin/academics/sections', fg: 'text-green-600', bg: 'bg-green-100' },
    { title: o('subjects_title'), desc: o('subjects_desc'), icon: BookOpen, href: '/admin/academics/subjects', fg: 'text-purple-600', bg: 'bg-purple-100' },
  ];
  const steps: [LucideIcon, string, string, string][] = [
    [GraduationCap, 'text-blue-600', o('step1_title'), o('step1_desc')],
    [Users, 'text-green-600', o('step2_title'), o('step2_desc')],
    [BookOpen, 'text-purple-600', o('step3_title'), o('step3_desc')],
  ];
  return (
    <>
      <Stack.Screen options={{ title: o('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted">{o('subtitle')}</Text>
        {items.map((s) => (
          <Card key={s.href}>
            <CardHeader className="gap-2">
              <View className={cn('size-12 items-center justify-center rounded-lg', s.bg)}>
                <Icon as={s.icon} className={cn('size-6', s.fg)} />
              </View>
              <CardTitle>{s.title}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onPress={() => router.push(s.href)}>
                <Text>{o('manage', { title: s.title })}</Text>
                <Icon as={ArrowRight} className="text-foreground size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card className="border-s-4 border-s-blue-600">
          <CardHeader>
            <CardTitle>{o('dependency_title')}</CardTitle>
            <CardDescription>{o('dependency_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {steps.map(([icon, fg, title, desc]) => (
              <View key={title} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={icon} className={cn('size-5', fg)} />
                  <Text className="font-semibold">{title}</Text>
                </View>
                <Text variant="muted" className="text-sm">{desc}</Text>
              </View>
            ))}
            <View className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm text-amber-900">
                <Text className="text-sm font-bold text-amber-900">{`${o('important')} `}</Text>
                {o('rule')}
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
