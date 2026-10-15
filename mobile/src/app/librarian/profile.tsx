import { Stack } from 'expo-router';
import { Briefcase, Building, Calendar, Clock, Hash, Mail, Phone, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import QRCode from 'react-qr-code';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth, librarian } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/format';

/** The librarian's profile: photo, contact, staff details, identity QR (web: /profile). */
export default function LibrarianProfile() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.li_${key}`);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const profileId = profile?.id ?? null;
  const staff = useApi(profileId ? ['librarian', 'staff-me', profileId] : null, () => librarian.myStaffRecord());
  const last = useApi(profileId ? ['portal', 'last-login', profileId] : null, ([, , id]) => auth.lastLogin(id as string));
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const role = t(`app.role_${profile.role}`, { defaultValue: profile.role });
  const s = staff.data;
  const na = k('na');

  return (
    <>
      <Stack.Screen options={{ title: k('my_profile') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => staff.mutate()} />}>
        <Text variant="muted">{k('profile_subtitle')}</Text>
        <Card>
          <CardContent className="items-center gap-3 p-5">
            <PersonAvatar url={profile.profile_photo_url} name={name} size={96} />
            <Text className="text-xl font-bold">{name}</Text>
            <Text className="text-muted-foreground">{profile.email ?? ''}</Text>
            <Badge className="bg-[#57A3CC]">
              <Text className="text-xs text-white">{role}</Text>
            </Badge>
            {s ? (
              <View className="w-full gap-2 pt-2">
                <Row icon={Hash} label={k('employee_id')} value={s.employee_number || na} />
                <Row icon={Briefcase} label={k('job_title')} value={s.title || na} />
                <Row icon={Building} label={k('department')} value={s.department || na} />
                <Row icon={Calendar} label={k('joined')} value={s.date_of_joining ? formatDate(s.date_of_joining) : na} />
              </View>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k('contact_info')}</CardTitle>
            <CardDescription>{k('contact_info_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <Row icon={Mail} label={k('email_address')} value={profile.email || na} />
            <Row icon={Phone} label={k('phone_number')} value={profile.phone || na} />
            <Row icon={Clock} label={k('last_login')} value={last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k('my_qr')}</CardTitle>
            <CardDescription>{k('my_qr_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="items-center gap-2">
            <View className="rounded-xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('my_qr')}>
              <QRCode value={`${env.webUrl}/verify/${profile.id}`} size={160} bgColor="#FFFFFF" fgColor="#000000" />
            </View>
            <Text className="font-medium">{`${name} · ${role}`}</Text>
          </CardContent>
        </Card>
        {s ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{k('employment_details')}</CardTitle>
              <CardDescription>{k('employment_details_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <View className="gap-1">
                <Text className="text-muted-foreground text-sm">{k('employment_type')}</Text>
                <Text className="font-medium capitalize">{s.employment_type?.replace('_', ' ') || na}</Text>
              </View>
              <View className="gap-1">
                <Text className="text-muted-foreground text-sm">{k('status')}</Text>
                <Badge variant={s.is_active ? 'default' : 'secondary'} className="self-start">
                  <Text className="text-xs">{s.is_active ? k('active') : k('inactive')}</Text>
                </Badge>
              </View>
              {s.specialization ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-sm">{k('specialization')}</Text>
                  <Text className="font-medium">{s.specialization}</Text>
                </View>
              ) : null}
              {Array.isArray(s.qualifications) && s.qualifications.length ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-sm">{k('qualifications')}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {s.qualifications.map((q, i) => (
                      <Badge key={i} variant="outline">
                        <Text className="text-xs">{q}</Text>
                      </Badge>
                    ))}
                  </View>
                </View>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function Row({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="flex-1 text-end text-sm font-medium">{value}</Text>
    </View>
  );
}
