import type { ReadingSessionLog } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Headphones, Printer, SpellCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { FormSection, Initials, StatTile, StatTiles } from '@/components/app/layout';
import { ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

const STATUS_CLASS = { correct: 'text-success font-medium', incorrect: 'text-destructive font-semibold underline', unread: 'text-muted-foreground' } as const;
const STATUS_CSS = { correct: `color:${colors.success};font-weight:500`, incorrect: `color:${colors.destructive};font-weight:600;text-decoration:underline`, unread: `color:${colors.printMuted}` } as const;

/** Review one reading session: stats, recording, word-by-word marks; print as PDF (web: ReadingReview). */
export function SessionReviewScreen() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['admin', 'sr-log', id] : null, ([, , x]) => adminSpeedReading.log(x as string));
  const log = res.data;

  if (res.isLoading) return <LoadingList rows={4} />;
  if (res.error || !log) return <ErrorState message={a('sr_not_found')} onRetry={() => res.mutate()} />;

  const words = (log.text_content ?? '').trim().split(/\s+/).filter(Boolean);
  const results = log.word_results ?? [];
  const rtl = log.text_language === 'ar';
  const counts = { correct: results.filter((r) => r.status === 'correct').length, incorrect: results.filter((r) => r.status === 'incorrect').length, unread: results.filter((r) => r.status === 'unread').length };
  const stats: [string, string, boolean?][] = [
    [a('sr_accuracy'), `${log.accuracy_percentage.toFixed(1)}%`, true],
    ['WPM', String(log.target_wpm)],
    [a('sr_correct'), String(log.correct_words)],
    [a('sr_incorrect'), String(log.incorrect_words)],
    [a('sr_points'), a('sr_pts', { count: log.points_earned }), log.comprehension_bonus],
  ];

  async function printReview(l: ReadingSessionLog) {
    const body = `<h2>${escapeHtml(l.text_title ?? '')}</h2><p>${escapeHtml(l.student_name ?? '')} · ${escapeHtml(new Date(l.created_at).toLocaleString(i18n.language))}</p>
<table><tr>${stats.map(([k, v]) => `<td><b>${escapeHtml(v)}</b><br/>${escapeHtml(k)}</td>`).join('')}</tr></table>
${results.length ? `<p dir="${rtl ? 'rtl' : 'ltr'}" style="font-size:16px;line-height:2">${words.map((w, i) => `<span style="${STATUS_CSS[results[i]?.status ?? 'unread']}">${escapeHtml(w)}</span>`).join(' ')}</p>` : ''}`;
    try {
      await sharePdf(buildPrintHtml({ title: l.text_title ?? 'Reading', pages: [body], school: print.school, layout: print.layout, withHeader: print.withHeader }), `reading-review-${l.id.slice(0, 8)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '');
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: log.text_title ?? a('sr_session') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">
          {log.grading_mode === 'voice' ? a('sr_voice_mode') : a('sr_manual_mode')} · {rtl ? a('sr_arabic') : a('sr_english')}
        </Text>
        <View className="flex-row items-center gap-3">
          {log.student_name ? <Initials name={log.student_name} size={40} /> : null}
          <View className="flex-1">
            {log.student_name ? <Text className="font-semibold">{log.student_name}</Text> : null}
            <Text className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString(i18n.language)}</Text>
          </View>
        </View>
        <StatTiles>
          {stats.map(([k, v, hi]) => (
            <StatTile key={k} label={k} value={v} tone={hi ? 'success' : 'brand'} />
          ))}
        </StatTiles>
        <FormSection title={a('sr_recording')} icon={Headphones}>
          {log.audio_url ? (
            <Button variant="outline" size="sm" onPress={() => openBrowserAsync(log.audio_url as string)}>
              <Text>{a('sr_play_recording')}</Text>
            </Button>
          ) : (
            <Text className="text-muted-foreground text-sm">{a('sr_no_recording')}</Text>
          )}
        </FormSection>
        <FormSection title={a('sr_word_review')} icon={SpellCheck}>
          {results.length ? (
            <>
              <Text className="text-lg leading-9" style={{ writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                {words.map((w, i) => (
                  <Text key={i} className={cn('text-lg', STATUS_CLASS[results[i]?.status ?? 'unread'])}>
                    {w}{' '}
                  </Text>
                ))}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                <StatusChip label={`${a('sr_correct')} (${counts.correct})`} tone="success" />
                <StatusChip label={`${a('sr_incorrect')} (${counts.incorrect})`} tone="destructive" />
                <StatusChip label={`${a('sr_not_reached')} (${counts.unread})`} tone="muted" />
              </View>
            </>
          ) : (
            <Text className="text-muted-foreground text-sm">{a('sr_no_word_results')}</Text>
          )}
        </FormSection>
        <Button variant="outline" onPress={() => printReview(log)}>
          <Icon as={Printer} className="text-foreground size-4" />
          <Text>{a('sr_print_review')}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
