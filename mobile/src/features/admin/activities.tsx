import type { EligibilityCode } from '@studently/api-client';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '@/lib/colors';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

/** The web's `activities` namespace. */
export function useAc() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`activities.${k}`, o);
}

export const ELIGIBILITY_TONE: Record<EligibilityCode, string> = {
  PASSING: 'bg-success-soft ',
  BORDERLINE: 'bg-warning-soft ',
  FAILING: 'bg-destructive-soft ',
  INCOMPLETE: 'bg-muted',
};
export const ELIGIBILITY_TEXT: Record<EligibilityCode, string> = {
  PASSING: 'text-success ',
  BORDERLINE: 'text-warning ',
  FAILING: 'text-destructive ',
  INCOMPLETE: 'text-muted-foreground',
};
/** Print colours (web: ELIGIBILITY_COLORS). */
export const ELIGIBILITY_PRINT: Record<EligibilityCode, string> = {
  PASSING: `background:${colors.successSoft};color:${colors.success}`,
  BORDERLINE: `background:${colors.warningSoft};color:${colors.warning}`,
  FAILING: `background:${colors.destructiveSoft};color:${colors.destructive}`,
  INCOMPLETE: `background:${colors.printSurface};color:${colors.printText}`,
};

export function EligibilityBadge({ code }: { code: EligibilityCode }) {
  const a = useAc();
  return (
    <View className={cn('rounded-full px-2.5 py-1', ELIGIBILITY_TONE[code])}>
      <Text className={cn('text-[11px] font-semibold', ELIGIBILITY_TEXT[code])}>{a(`eligibilityCodes.${code}`)}</Text>
    </View>
  );
}

/** "Month DD, YYYY" in the app language, or "-" (web: formatDate on the Student Screen). */
export function longDate(value: string | null | undefined, locale: string) {
  if (!value) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return new Intl.DateTimeFormat(locale, { month: 'long', day: '2-digit', year: 'numeric' }).format(d);
}

const TABLE_CSS = `h2{font-size:16px;margin:0 0 10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid ${colors.printBorder};padding:6px 8px;text-align:start;font-size:12px}th{background:${colors.printSurface}}.c{text-align:center}.pill{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px}`;

/** One printable table: a heading, column titles and pre-escaped cell HTML. */
export function tableHtml(heading: string, head: string[], rows: string[][], center: number[] = []) {
  const cls = (i: number) => (center.includes(i) ? ' class="c"' : '');
  return `<h2>${escapeHtml(heading)}</h2><table><thead><tr>${head.map((h, i) => `<th${cls(i)}>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

/** Print and PDF buttons for a report page (web: the reports' Print button, window.print()). */
export function PrintButtons({ title, fileName, body }: { title: string; fileName: string; body: () => string }) {
  const a = useAc();
  const { t } = useTranslation();
  const toast = useToast();
  const ctx = usePrintContext();
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  async function run(mode: 'print' | 'pdf') {
    setBusy(mode);
    try {
      const doc = buildPrintHtml({ title, pages: [body()], school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, extraCss: TABLE_CSS });
      if (mode === 'print') await printHtml(doc);
      else await sharePdf(doc, fileName);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(null);
    }
  }
  return (
    <View className="flex-row gap-2">
      <Button size="sm" variant="outline" className="rounded-full" onPress={() => run('pdf')} disabled={!!busy || !ctx.ready}>
        <Icon as={FileDown} className="text-brand dark:text-brand-secondary size-4" />
        <Text>PDF</Text>
      </Button>
      <Button size="sm" variant="outline" className="rounded-full" onPress={() => run('print')} disabled={!!busy || !ctx.ready}>
        <Icon as={Printer} className="text-brand dark:text-brand-secondary size-4" />
        <Text>{a('print')}</Text>
      </Button>
    </View>
  );
}
