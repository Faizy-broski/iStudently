import { Stack } from 'expo-router';
import { AlertCircle, Mail, MapPin, School } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

type Tab = 'general' | 'contacts';
const longDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: '2-digit', year: 'numeric' }) : null);

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="border-border gap-0.5 border-b py-2 last:border-b-0">
      <Text className="text-muted-foreground text-xs uppercase">{label}</Text>
      <Text className="text-sm font-medium" selectable>
        {value || '—'}
      </Text>
    </View>
  );
}

/** The student's own record: general info and contacts (web: /student/students). */
export default function StudentInfo() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_info_${key}`, o);
  const info = useApi(['student', 'info'], () => student.getStudentInfo());
  const [tab, setTab] = useState<Tab>('general');

  if (info.isLoading) return <LoadingList rows={6} />;
  if (info.error) {
    return (
      <View className="bg-background flex-1 p-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="flex-row items-center gap-3 p-4">
            <Icon as={AlertCircle} className="size-8 text-red-600" />
            <View className="flex-1">
              <Text className="font-semibold text-red-900 dark:text-red-200">{k('error')}</Text>
              <Text className="text-sm text-red-700 dark:text-red-300">{info.error.message}</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    );
  }
  const s = info.data;
  if (!s) return null;
  const fullName = [s.first_name, s.father_name, s.grandfather_name, s.last_name].filter(Boolean).join(' ');
  const admission = longDate(s.admission_date);

  return (
    <>
      <Stack.Screen options={{ title: fullName || t('sidebar.students') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => info.mutate()} />}>
        <View className="flex-row items-center gap-3">
          <PersonAvatar url={s.profile_photo_url} name={fullName} size={56} />
          <View className="flex-1">
            <Text className="text-xl font-bold">{fullName || '—'}</Text>
            <Text className="text-muted-foreground text-sm">{s.school_name}</Text>
          </View>
        </View>
        <FilterChips<Tab> value={tab} onChange={setTab} options={[{ value: 'general', label: k('general') }, { value: 'contacts', label: k('contacts') }]} />

        {tab === 'general' ? (
          <>
            <Card>
              <CardContent className="p-4">
                <Row label={k('name')} value={fullName} />
                <Row label={k('number')} value={s.student_number} />
                <Row label={k('admission')} value={admission} />
                <Row label={k('grade')} value={s.grade_level_name || s.grade_level} />
                <Row label={k('section')} value={s.section_name} />
                <Row label={k('school')} value={s.school_name} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Row label={k('gender')} value={s.gender} />
                <Row label={k('birthdate')} value={longDate(s.date_of_birth)} />
                <Row label={k('age')} value={s.age} />
                <Row label={k('first')} value={s.first_name} />
                <Row label={k('father')} value={s.father_name} />
                <Row label={k('grandfather')} value={s.grandfather_name} />
                <Row label={k('last')} value={s.last_name} />
              </CardContent>
            </Card>
            <Text className="text-muted-foreground text-sm">{k('enroll_found')}</Text>
            <Card>
              <CardContent className="p-4">
                <Row label={k('enroll_start')} value={admission ? k('begin_year', { date: admission }) : null} />
                <Row label={k('dropped')} value="- - N/A" />
                <Row label={k('school')} value={s.school_name} />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <SectionTitle icon={Mail} label={k('contact')} />
                <Row label={k('email')} value={s.email} />
                <Row label={k('phone')} value={s.phone} />
              </CardContent>
            </Card>
            {s.address ? (
              <Card>
                <CardContent className="p-4">
                  <SectionTitle icon={MapPin} label={k('address')} />
                  <Text className="text-sm">{s.address}</Text>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="p-4">
                <SectionTitle icon={School} label={k('school_contact')} />
                <Row label={k('school_name')} value={s.school_name} />
                <Row label={k('school_address')} value={s.school_address} />
                <Row label={k('school_phone')} value={s.school_phone} />
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </>
  );
}

function SectionTitle({ icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground text-sm font-semibold uppercase">{label}</Text>
    </View>
  );
}
