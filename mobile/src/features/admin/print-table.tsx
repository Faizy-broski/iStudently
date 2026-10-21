import { Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { usePrintContext } from '@/features/admin/print-context';
import { colors } from '@/lib/colors';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';

export type PrintSection = { heading?: string; columns: string[]; rows: (string | number)[][]; footer?: (string | number)[] };

/** One or more tables as print HTML (title, optional subtitle, a table per section). */
export function tablesHtml(title: string, subtitle: string | undefined, sections: PrintSection[]) {
  const td = `border:1px solid ${colors.printBorder};padding:4px 6px;text-align:start`;
  const body = sections
    .map(
      (s) =>
        `${s.heading ? `<h3 style="margin:12px 0 6px">${escapeHtml(s.heading)}</h3>` : ''}<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>${s.columns
          .map((c) => `<th style="${td};background:${colors.printSurface}">${escapeHtml(c)}</th>`)
          .join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td style="${td}">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}${
          s.footer ? `<tr>${s.footer.map((c) => `<td style="${td};font-weight:bold">${escapeHtml(c)}</td>`).join('')}</tr>` : ''
        }</tbody></table>`,
    )
    .join('');
  return `<h2 style="margin:0">${escapeHtml(title)}</h2>${subtitle ? `<p style="margin:2px 0 8px;color:${colors.printMuted}">${escapeHtml(subtitle)}</p>` : ''}${body}`;
}

/** Header "Print" button: the screen's data as a table, with the school header (web: window.print()). */
export function PrintTableButton({ title, subtitle, sections, disabled }: { title: string; subtitle?: string; sections: () => PrintSection[]; disabled?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const ctx = usePrintContext();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled || busy || !ctx.ready}
      accessibilityLabel={t('common.print')}
      onPress={async () => {
        setBusy(true);
        try {
          await printHtml(buildPrintHtml({ title, pages: [tablesHtml(title, subtitle, sections())], school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, reportLabel: title }));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t('common.error'));
        } finally {
          setBusy(false);
        }
      }}>
      {busy ? <ActivityIndicator size="small" /> : <Icon as={Printer} className="size-5" />}
    </Button>
  );
}
