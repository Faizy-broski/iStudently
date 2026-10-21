import type { JcDoc } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Lock, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { JcError, Note, pickDefaultDay, useDays, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';

const GROUPS: { key: string; docs: JcDoc[] }[] = [
  { key: 'lists', docs: ['general_list', 'secret_lists', 'committee_mirror', 'seating_map', 'student_cards', 'booklet_covers'] },
  { key: 'planning', docs: ['timetable', 'invigilation'] },
  { key: 'examday', docs: ['attendance_sheet', 'envelope_mirror', 'delivery_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident'] },
  { key: 'outcome', docs: ['results', 'honor_board', 'certificates'] },
];
const CONFIDENTIAL: JcDoc[] = ['general_list', 'secret_lists', 'booklet_covers'];
const NEEDS_DAY: JcDoc[] = ['attendance_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident'];
const PER_COMMITTEE: JcDoc[] = ['committee_mirror', 'seating_map', 'student_cards', 'booklet_covers', 'attendance_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident', 'secret_lists'];
const NEEDS_UNMASK: JcDoc[] = ['results', 'honor_board', 'certificates'];
const ALL = '__all__';

/** Printable documents, shared as PDF (web: exam control › Prints). */
export default function ExamControlPrints() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const committees = useApi(id ? (['jc', 'committees', id] as const) : null, ([, , s]) => jahbadhControl.committees(s));
  const days = useDays(id);
  const [committee, setCommittee] = useState(ALL);
  const [dayId, setDayId] = useState<string | null>(null);
  const print = usePrintDoc(id);
  if (ov.error) return <JcError error={ov.error} />;
  if (!o) return <LoadingList />;
  const day = dayId ?? (days.data ? pickDefaultDay(days.data) : null);
  const r = o.rights;
  const allowed = (doc: JcDoc) => (CONFIDENTIAL.includes(doc) ? r.secret : r.manage || r.examday) && (!NEEDS_UNMASK.includes(doc) || r.unmasked);
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_prints') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="gap-1.5">
          <Label>{t('examControl.committee')}</Label>
          <Picker value={committee} onChange={setCommittee} options={[{ value: ALL, label: t('examControl.allCommittees') }, ...(committees.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        </View>
        {days.data?.length ? (
          <View className="gap-1.5">
            <Label>{t('examControl.date')}</Label>
            <Picker value={day} onChange={setDayId} options={days.data.map((d) => ({ value: d.id, label: `${d.exam_date} — ${d.subject_name}` }))} />
          </View>
        ) : null}
        <Note text={t('examControl.printsHint')} />
        {GROUPS.map((g) => {
          const docs = g.docs.filter(allowed);
          if (!docs.length) return null;
          return (
            <FormSection key={g.key} title={t(`examControl.docGroup_${g.key}`)}>
              {docs.map((doc) => {
                const disabled = NEEDS_DAY.includes(doc) && !day;
                return (
                  <Pressable
                    key={doc}
                    disabled={disabled}
                    onPress={() => print(doc, { committeeId: PER_COMMITTEE.includes(doc) && committee !== ALL ? committee : null, dayId: day })}
                    accessibilityRole="button"
                    className={`flex-row items-center gap-3 py-1.5 active:opacity-70 ${disabled ? 'opacity-40' : ''}`}>
                    <Icon as={CONFIDENTIAL.includes(doc) ? Lock : Printer} className={CONFIDENTIAL.includes(doc) ? 'text-warning size-4' : 'text-brand dark:text-brand-secondary size-4'} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{t(`examControl.doc_${doc}`)}</Text>
                      <Text variant="muted" className="text-[11px]">
                        {t(`examControl.docHint_${doc}`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </FormSection>
          );
        })}
      </ScrollView>
    </>
  );
}
