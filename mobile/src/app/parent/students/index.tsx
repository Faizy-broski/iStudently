import type { StudentInfoData } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Calendar, Droplets, GraduationCap, Hash, Mail, MapPin, Phone, School, User, Users, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

type Tab = 'general' | 'contacts';
const longDate = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' }) : '—');

function Row({ label, value, icon, iconClass, onPress }: { label: string; value?: ReactNode; icon?: LucideIcon; iconClass?: string; onPress?: () => void }) {
  const body = (
    <View className="flex-row items-start gap-2">
      {icon ? <Icon as={icon} className={iconClass ?? 'text-muted-foreground mt-0.5 size-3.5'} /> : null}
      <Text className={onPress ? 'flex-1 text-sm text-blue-600' : 'flex-1 text-sm'} selectable={!onPress}>
        {value || '—'}
      </Text>
    </View>
  );
  return (
    <View className="border-border gap-1 border-b py-2.5 last:border-b-0">
      <Text className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link">
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

/** The selected child's record: identity banner, general info + enrollment history, addresses & contacts (web: /parent/students). */
export default function ParentStudentInfo() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_si_${key}`, o);
  const { child } = useChild();
  const childId = child?.id ?? null;
  const info = useApi(childId ? ['parent', 'student-info', childId] : null, ([, , id]) => parent.getStudentInfo(id as string));
  const [tab, setTab] = useState<Tab>('general');

  if (!child) return <NoChild />;
  if (info.isLoading) return <LoadingList rows={6} />;
  const s = info.data;
  if (info.error || !s) {
    return (
      <View className="bg-background flex-1 p-4">
        <Card>
          <CardContent className="items-center gap-3 py-12">
            <Icon as={User} className="text-muted-foreground size-12" />
            <Text className="text-muted-foreground text-center">{info.error?.message || k('not_available')}</Text>
          </CardContent>
        </Card>
      </View>
    );
  }
  const fullName = `${s.first_name} ${s.last_name}`.trim();
  const gender = s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1).toLowerCase() : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => info.mutate()} />}>
        <View>
          <Text className="text-xl font-bold text-[#022172] dark:text-white">{k('title')}</Text>
          <Text className="text-muted-foreground text-sm">
            {fullName}
            {s.student_number ? <Text className="text-sm font-medium text-[#022172] dark:text-blue-400">{` — ${s.student_number}`}</Text> : null}
          </Text>
        </View>

        <Card>
          <CardContent className="flex-row items-center gap-4 p-4">
            <PersonAvatar url={s.profile_photo_url} name={fullName} size={64} />
            <View className="flex-1 gap-1.5">
              <Text className="text-lg font-bold text-[#022172] dark:text-white" numberOfLines={1}>
                {fullName}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {s.grade_level ? <Chip icon={GraduationCap} label={s.grade_level} secondary /> : null}
                {s.section_name ? <Chip icon={Users} label={s.section_name} /> : null}
                {s.campus_name ? <Chip icon={School} label={s.campus_name} /> : null}
              </View>
            </View>
          </CardContent>
        </Card>

        <FilterChips<Tab> value={tab} onChange={setTab} options={[{ value: 'general', label: k('general') }, { value: 'contacts', label: k('contacts') }]} />

        {tab === 'general' ? (
          <>
            <Card>
              <CardContent className="px-4 py-1">
                <Row label={k('number')} value={s.student_number} icon={Hash} />
                <Row label={k('first_name')} value={s.first_name} />
                <Row label={k('last_name')} value={s.last_name} />
                <Row label={k('father')} value={s.father_name} />
                <Row label={k('grandfather')} value={s.grandfather_name} />
                <Row label={k('gender')} value={gender} />
                <Row label={k('birthdate')} value={longDate(s.date_of_birth)} icon={Calendar} />
                <Row label={k('age')} value={ageText(s.age, k)} />
                <Row label={k('grade')} value={s.grade_level} />
                <Row label={k('section')} value={s.section_name} />
                <Row label={k('admission')} value={longDate(s.admission_date)} />
                {s.blood_group ? <Row label={k('blood')} value={s.blood_group} icon={Droplets} iconClass="mt-0.5 size-3.5 text-red-500" /> : null}
              </CardContent>
            </Card>
            {s.enrollments.length ? (
              <View className="gap-2">
                <Text className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">{k('enrollments')}</Text>
                <Card>
                  <CardContent className="px-4 py-1">
                    {s.enrollments.map((e) => (
                      <View key={e.id} className="border-border gap-1 border-b py-2.5 last:border-b-0">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 text-sm font-medium">{e.academic_year || '—'}</Text>
                          {e.end_date ? null : (
                            <Badge variant="outline" className="border-green-300">
                              <Text className="text-xs text-green-600">{k('active')}</Text>
                            </Badge>
                          )}
                        </View>
                        <Text className="text-muted-foreground text-xs">{e.school_name || '—'}</Text>
                        <Text className="text-xs">{`${k('start')}: ${longDate(e.start_date)}${e.end_date ? ` · ${k('end')}: ${longDate(e.end_date)}` : ''}`}</Text>
                      </View>
                    ))}
                  </CardContent>
                </Card>
              </View>
            ) : null}
          </>
        ) : (
          <Card>
            <CardContent className="px-4 py-1">
              <Row label={k('address')} value={s.address} icon={MapPin} />
              <Row label={k('email')} value={s.email} icon={Mail} onPress={s.email ? () => Linking.openURL(`mailto:${s.email}`) : undefined} />
              <Row label={k('phone')} value={s.phone} icon={Phone} onPress={s.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined} />
              <Row label={k('father')} value={s.father_name} />
              <Row label={k('grandfather')} value={s.grandfather_name} />
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

function ageText(age: StudentInfoData['age'], k: (key: string, o?: Record<string, unknown>) => string) {
  if (!age) return null;
  const parts = [];
  if (age.years > 0) parts.push(k('age_years', { count: age.years }));
  if (age.months > 0) parts.push(k('age_months', { count: age.months }));
  if (age.days > 0) parts.push(k('age_days', { count: age.days }));
  return parts.join(', ') || k('age_under_day');
}

function Chip({ icon, label, secondary }: { icon: LucideIcon; label: string; secondary?: boolean }) {
  return (
    <Badge variant={secondary ? 'secondary' : 'outline'} className="flex-row items-center gap-1">
      <Icon as={icon} className="text-foreground size-3" />
      <Text className="text-xs">{label}</Text>
    </Badge>
  );
}
