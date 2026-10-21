import type { StudentInfoData } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Calendar, Clock, Droplets, GraduationCap, Hash, Info, Mail, MapPin, Phone, School, User, Users, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, PersonHero, RowItem, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';

type Tab = 'general' | 'contacts';
const longDate = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' }) : '—');

function Row({ label, value, icon, tone, onPress, last }: { label: string; value?: ReactNode; icon?: LucideIcon; tone?: 'destructive'; onPress?: () => void; last?: boolean }) {
  const body = (
    <View className={cn('flex-row items-center gap-3 px-4 py-2.5', !last && 'border-info-soft dark:border-border border-b')}>
      <View className={cn('size-8 items-center justify-center rounded-full', tone === 'destructive' ? 'bg-destructive-soft' : 'bg-info-soft')}>
        <Icon as={icon ?? Info} className={cn('size-4', tone === 'destructive' ? 'text-destructive' : 'text-brand dark:text-brand-secondary')} />
      </View>
      <View className="flex-1">
        <Text variant="muted" className="text-[11px]">
          {label}
        </Text>
        <Text className={onPress ? 'text-sm font-medium text-brand dark:text-brand-secondary' : 'text-sm font-medium'} selectable={!onPress}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" className="active:opacity-70">
      {body}
    </Pressable>
  ) : (
    body
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
      <View className="bg-background flex-1">
        <EmptyState icon={User} title={info.error?.message || k('not_available')} />
      </View>
    );
  }
  const fullName = `${s.first_name} ${s.last_name}`.trim();
  const gender = s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1).toLowerCase() : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => info.mutate()} />}>
        <PersonHero
          name={fullName}
          photo={s.profile_photo_url}
          subtitle={s.student_number ? `${k('title')} — ${s.student_number}` : k('title')}
          chips={
            <>
              {s.grade_level ? <Chip icon={GraduationCap} label={s.grade_level} /> : null}
              {s.section_name ? <Chip icon={Users} label={s.section_name} /> : null}
              {s.campus_name ? <Chip icon={School} label={s.campus_name} /> : null}
            </>
          }
        />

        <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: 'general', label: k('general') }, { value: 'contacts', label: k('contacts') }]} />

        {tab === 'general' ? (
          <>
            <Panel>
              <Row label={k('number')} value={s.student_number} icon={Hash} />
              <Row label={k('first_name')} value={s.first_name} icon={User} />
              <Row label={k('last_name')} value={s.last_name} icon={User} />
              <Row label={k('father')} value={s.father_name} icon={User} />
              <Row label={k('grandfather')} value={s.grandfather_name} icon={User} />
              <Row label={k('gender')} value={gender} icon={User} />
              <Row label={k('birthdate')} value={longDate(s.date_of_birth)} icon={Calendar} />
              <Row label={k('age')} value={ageText(s.age, k)} icon={Clock} />
              <Row label={k('grade')} value={s.grade_level} icon={GraduationCap} />
              <Row label={k('section')} value={s.section_name} icon={Users} />
              <Row label={k('admission')} value={longDate(s.admission_date)} icon={Calendar} last={!s.blood_group} />
              {s.blood_group ? <Row label={k('blood')} value={s.blood_group} icon={Droplets} tone="destructive" last /> : null}
            </Panel>
            {s.enrollments.length ? (
              <Section title={k('enrollments')}>
                <Panel>
                  {s.enrollments.map((e, i) => (
                    <RowItem
                      key={e.id}
                      leading={<IconTile icon={School} size={40} />}
                      title={e.academic_year || '—'}
                      meta={e.school_name || '—'}
                      trailing={e.end_date ? undefined : <StatusChip label={k('active')} tone="success" />}
                      last={i === s.enrollments.length - 1}>
                      <Text className="text-muted-foreground text-xs">{`${k('start')}: ${longDate(e.start_date)}${e.end_date ? ` · ${k('end')}: ${longDate(e.end_date)}` : ''}`}</Text>
                    </RowItem>
                  ))}
                </Panel>
              </Section>
            ) : null}
          </>
        ) : (
          <Panel>
            <Row label={k('address')} value={s.address} icon={MapPin} />
            <Row label={k('email')} value={s.email} icon={Mail} onPress={s.email ? () => Linking.openURL(`mailto:${s.email}`) : undefined} />
            <Row label={k('phone')} value={s.phone} icon={Phone} onPress={s.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined} />
            <Row label={k('father')} value={s.father_name} icon={User} />
            <Row label={k('grandfather')} value={s.grandfather_name} icon={User} last />
          </Panel>
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

function Chip({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
      <Icon as={icon} className="size-3 text-white" />
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </View>
  );
}
