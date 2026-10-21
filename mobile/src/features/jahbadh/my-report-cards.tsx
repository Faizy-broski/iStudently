import { jgPdfPath, type JgMyReportCard, type JgScope } from '@studently/api-client';
import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { IconTile, RowItem } from '@/components/app/layout';
import { useToast } from '@/components/app/toast';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Report cards released by the school (web: /student|parent/jahbadh-report-cards). Opens the PDF in the share sheet. */
export function MyReportCards() {
  const { t } = useTranslation();
  const toast = useToast();
  const list = useApi(['jg', 'my-report-cards'], () => jahbadhGrades.myReportCards());
  const [busy, setBusy] = useState<string | null>(null);
  const label = (s: JgScope) => (s === 'final' ? t('grades.finalResult') : t('grades.stageN', { n: s.slice(5) }));

  const open = async (c: JgMyReportCard) => {
    const key = `${c.student_id}-${c.scope}`;
    setBusy(key);
    try {
      await shareApiFile(jgPdfPath.myReportCard(c.student_id, c.scope), `report-card-${c.scope}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="bg-background flex-1">
      <DataList
        items={list.data}
        error={list.error}
        isLoading={list.isLoading}
        isRefreshing={list.isValidating && !list.isLoading}
        onRefresh={() => list.mutate()}
        emptyTitle={t('grades.noReleasedCards')}
        emptyBody={t('grades.myCardsSubtitle')}
        keyExtractor={(c: JgMyReportCard) => `${c.student_id}-${c.scope}`}
        renderItem={(c: JgMyReportCard) => (
          <RowItem
            title={c.student_name}
            meta={`${label(c.scope)}${c.academic_year ? ` · ${c.academic_year}` : ''}`}
            leading={<IconTile icon={FileText} />}
            onPress={busy ? undefined : () => open(c)}
          />
        )}
      />
    </View>
  );
}
