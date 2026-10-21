import { Stack } from 'expo-router';
import { Briefcase, Building, Calendar, Clock, Hash, Mail, Phone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { PersonHero } from '@/components/app/layout';
import { InfoRow, Panel, PanelTitle } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
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
        <Text variant="muted" className="text-sm">
          {k('profile_subtitle')}
        </Text>
        <PersonHero
          name={name}
          subtitle={profile.email ?? ''}
          photo={profile.profile_photo_url}
          chips={
            <View className="rounded-full bg-white/15 px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-white">{role}</Text>
            </View>
          }
        />
        {s ? (
          <Panel>
            <InfoRow icon={Hash} label={k('employee_id')} value={s.employee_number || na} />
            <InfoRow icon={Briefcase} label={k('job_title')} value={s.title || na} />
            <InfoRow icon={Building} label={k('department')} value={s.department || na} />
            <InfoRow icon={Calendar} label={k('joined')} value={s.date_of_joining ? formatDate(s.date_of_joining) : na} last />
          </Panel>
        ) : null}
        <Panel>
          <PanelTitle title={k('contact_info')} />
          <Text variant="muted" className="px-4 pb-1 text-xs">
            {k('contact_info_desc')}
          </Text>
          <InfoRow icon={Mail} label={k('email_address')} value={profile.email || na} />
          <InfoRow icon={Phone} label={k('phone_number')} value={profile.phone || na} />
          <InfoRow icon={Clock} label={k('last_login')} value={last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'} last />
        </Panel>
        <Panel className="pb-4">
          <PanelTitle title={k('my_qr')} />
          <Text variant="muted" className="px-4 pb-3 text-xs">
            {k('my_qr_desc')}
          </Text>
          <View className="items-center gap-2">
            <View className="rounded-2xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('my_qr')}>
              <QRCode value={`${env.webUrl}/verify/${profile.id}`} size={160} bgColor={colors.white} fgColor={colors.black} />
            </View>
            <Text className="text-sm font-semibold">{`${name} · ${role}`}</Text>
          </View>
        </Panel>
        {s ? (
          <Panel className="pb-4">
            <PanelTitle title={k('employment_details')} />
            <Text variant="muted" className="px-4 pb-3 text-xs">
              {k('employment_details_desc')}
            </Text>
            <View className="gap-3 px-4">
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs">{k('employment_type')}</Text>
                <Text className="text-sm font-medium capitalize">{s.employment_type?.replace('_', ' ') || na}</Text>
              </View>
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs">{k('status')}</Text>
                <StatusChip label={s.is_active ? k('active') : k('inactive')} tone={s.is_active ? 'success' : 'muted'} className="self-start" />
              </View>
              {s.specialization ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-xs">{k('specialization')}</Text>
                  <Text className="text-sm font-semibold">{s.specialization}</Text>
                </View>
              ) : null}
              {Array.isArray(s.qualifications) && s.qualifications.length ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-xs">{k('qualifications')}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {s.qualifications.map((q, i) => (
                      <StatusChip key={i} label={String(q)} tone="info" />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </Panel>
        ) : null}
      </ScrollView>
    </>
  );
}
