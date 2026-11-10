import { jahbadhDataApi } from '@studently/api-client';
import { router, type Href } from 'expo-router';
import { CalendarCheck2, FileInput, GraduationCap, UserRoundCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Section } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminEmployees, api } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Jahbadh Wave 2 data workflows: name import, daily attendance, rollover, homeroom teacher. */
export const jahbadhData = jahbadhDataApi(api);

const NONE = '__none__';

/** Class home block: homeroom teacher «رائد الفصل» (admin picks; teachers see it), daily attendance, import, rollover. */
export function SectionDataTools({
  sectionId,
  campusId,
  isAdmin,
  viewOnly,
  href,
}: {
  sectionId: string;
  campusId: string | null;
  isAdmin: boolean;
  viewOnly: boolean;
  href: (path: string, params?: Record<string, string>) => Href;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const homeroom = useApi(['jg', 'homeroom', sectionId, campusId ?? 'own'] as const, ([, , s, c]) => jahbadhData.homeroom(s, c === 'own' ? null : c));
  const staff = useApi(isAdmin ? (['jg', 'homeroom-staff', campusId ?? 'school'] as const) : null, ([, , c]) =>
    adminEmployees.list('teacher', c === 'school' ? undefined : c, { page: 1, limit: 500 }),
  );
  const staffId = homeroom.data?.staff_id ?? null;

  const assign = async (value: string) => {
    const res = await jahbadhData.setHomeroom(sectionId, value === NONE ? null : value, campusId);
    if (!res.success) {
      return toast.error(res.code === 'not_migrated' ? t('app.jgd_not_migrated') : res.code === 'invalid_staff' ? t('app.jgd_err_invalid_staff') : (res.error ?? t('app.error_title')));
    }
    await homeroom.mutate(res.data, { revalidate: false });
    toast.success(t('app.jgd_saved'));
  };

  const name = (e: { profile?: { first_name: string | null; last_name: string | null } | null; employee_number: string }) =>
    [e.profile?.first_name, e.profile?.last_name].filter(Boolean).join(' ') || e.employee_number;

  return (
    <Section title={t('app.jgd_section_tools')}>
      <Panel className="gap-2 p-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Icon as={UserRoundCheck} className="text-muted-foreground size-4" />
          <Text className="text-sm font-semibold">{t('app.jgd_homeroom')}</Text>
          {!isAdmin && viewOnly ? <StatusChip label={t('app.jgd_homeroom_badge')} tone="info" /> : null}
        </View>
        {isAdmin ? (
          <Picker
            value={staffId ?? NONE}
            onChange={assign}
            placeholder={t('app.jgd_pick_homeroom')}
            options={[{ value: NONE, label: t('app.jgd_no_homeroom') }, ...(staff.data ?? []).filter((e) => e.is_active !== false).map((e) => ({ value: e.id, label: name(e) }))]}
          />
        ) : (
          <Text className="text-sm">{homeroom.data?.name ?? t('app.jgd_no_homeroom')}</Text>
        )}
      </Panel>
      <Panel>
        <ActionRow icon={CalendarCheck2} title={t('app.jgd_attendance_title')} onPress={() => router.push(href('/jahbadh/daily-attendance', { section: sectionId }))} last={!isAdmin} />
        {isAdmin ? (
          <>
            <ActionRow icon={FileInput} title={t('app.jgd_import_title')} onPress={() => router.push(href('/jahbadh/import', { section: sectionId }))} />
            <ActionRow icon={GraduationCap} title={t('app.jgd_rollover_title')} onPress={() => router.push(href('/jahbadh/rollover', { section: sectionId }))} last />
          </>
        ) : null}
      </Panel>
    </Section>
  );
}
