import type { EventCategory, MarkingPeriod, SchoolEvent } from '@studently/api-client';

import { colors } from '@/lib/colors';
import { monthNames, weekdayNames } from '@/components/app/date-field';
import { escapeHtml } from '@/lib/print';

// Port of frontend/src/components/academic-calendar/AcademicCalendarPrint.tsx as an HTML string for expo-print.

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  academic: colors.success,
  holiday: colors.warning,
  exam: colors.destructive,
  meeting: colors.brand,
  activity: colors.chart6,
  reminder: colors.chart7,
};
const CATEGORY_PRIORITY: Record<EventCategory, number> = { exam: 6, holiday: 5, academic: 4, meeting: 3, activity: 2, reminder: 1 };
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const eventColor = (ev: SchoolEvent) => (HEX_RE.test(ev.color_code || '') ? ev.color_code : CATEGORY_COLORS[ev.category]);

function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function datesInRange(start: string, end: string) {
  const set = new Set<string>();
  const cur = new Date(`${start}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  while (cur <= endD) {
    set.add(iso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return set;
}

function isWeekend(date: string, weekStart: number, weekEnd: number) {
  const dow = new Date(`${date}T00:00:00`).getDay();
  const work = new Set<number>();
  let day = weekStart;
  for (let i = 0; i < 7; i++) {
    work.add(day % 7);
    if (day % 7 === weekEnd) break;
    day++;
  }
  return !work.has(dow);
}

function monthDays(year: number, month: number, weekStart: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0).getDate();
  const days: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < (first.getDay() - weekStart + 7) % 7; i++) days.push(null);
  for (let d = 1; d <= last; d++) days.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d });
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

/** Events aimed at grades only show when one of them is selected (or All Grades); school-wide events always show. */
export const visibleCalendarEvents = (events: SchoolEvent[], gradeIds: string[]) =>
  events.filter((ev) => !ev.target_grades?.length || gradeIds.length === 0 || ev.target_grades.some((g) => gradeIds.includes(g)));

/** First and last marking-period date (the calendar span). */
export function calendarSpan(mps: MarkingPeriod[]) {
  const dates = mps.flatMap((m) => [m.start_date, m.end_date]).filter(Boolean) as string[];
  if (!dates.length) return { startDate: undefined, endDate: undefined };
  dates.sort();
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

export interface CalendarLabels {
  title: string;
  allGrades: string;
  schoolWeek: string;
  gradePeriod: string;
  schoolPeriod: string;
  weekend: string;
  datesToRemember: string;
  begins: (title: string) => string;
  ends: (title: string) => string;
  category: (c: EventCategory) => string;
}

export interface CalendarInput {
  markingPeriods: MarkingPeriod[];
  events: SchoolEvent[];
  selectedGradeIds: string[];
  grades: { id: string; name: string }[];
  schoolName: string;
  schoolAddress?: string;
  schoolLogoUrl?: string | null;
  academicYearLabel?: string;
  calendarTitle?: string;
  footerNote?: string;
  weekStartDay?: number;
  weekEndDay?: number;
  locale: string;
  rtl: boolean;
  labels: CalendarLabels;
}

export function buildAcademicCalendarHtml(p: CalendarInput) {
  const weekStart = p.weekStartDay ?? 0;
  const weekEnd = p.weekEndDay ?? 4;
  const L = p.labels;
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(p.locale, { day: 'numeric', month: 'short', year: 'numeric' });

  const { startDate, endDate } = calendarSpan(p.markingPeriods);
  const now = new Date();
  const first = startDate ? new Date(`${startDate}T00:00:00`) : new Date(now.getFullYear(), 8, 1);
  const last = endDate ? new Date(`${endDate}T00:00:00`) : new Date(now.getFullYear() + 1, 5, 1);
  const months: { year: number; month: number }[] = [];
  for (let y = first.getFullYear(), m = first.getMonth(); y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth()); ) {
    months.push({ year: y, month: m });
    if (++m > 11) {
      m = 0;
      y++;
    }
  }

  const visible = visibleCalendarEvents(p.events, p.selectedGradeIds);
  const byDate = new Map<string, SchoolEvent[]>();
  for (const ev of visible)
    datesInRange(ev.start_at.slice(0, 10), ev.end_at.slice(0, 10)).forEach((d) => {
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(ev);
    });

  const schoolWide = new Set<string>();
  const gradeSpecific = new Set<string>();
  for (const mp of p.markingPeriods) if (mp.start_date && mp.end_date) datesInRange(mp.start_date, mp.end_date).forEach((d) => schoolWide.add(d));
  if (p.selectedGradeIds.length)
    for (const ev of visible)
      if (ev.category === 'academic' && ev.target_grades?.some((g) => p.selectedGradeIds.includes(g))) datesInRange(ev.start_at.slice(0, 10), ev.end_at.slice(0, 10)).forEach((d) => gradeSpecific.add(d));

  const remember: { label: string; date: string; sort: string; bold?: boolean }[] = [];
  for (const mp of p.markingPeriods) {
    if (mp.start_date) remember.push({ label: L.begins(mp.title), date: fmt(mp.start_date), sort: mp.start_date, bold: true });
    if (mp.end_date) remember.push({ label: L.ends(mp.title), date: fmt(mp.end_date), sort: mp.end_date });
  }
  for (const ev of visible) {
    const s = ev.start_at.slice(0, 10);
    const e = ev.end_at.slice(0, 10);
    remember.push({ label: ev.title, date: s === e ? fmt(s) : `${fmt(s)} – ${fmt(e)}`, sort: s, bold: ev.category === 'exam' || ev.category === 'holiday' });
  }
  remember.sort((a, b) => a.sort.localeCompare(b.sort));

  const legendSeen = new Map<EventCategory, string>();
  for (const ev of visible) if (!legendSeen.has(ev.category)) legendSeen.set(ev.category, eventColor(ev));
  const legendCats = [...legendSeen.entries()].sort((a, b) => CATEGORY_PRIORITY[b[0]] - CATEGORY_PRIORITY[a[0]]);

  const gradeLabel = p.selectedGradeIds.length
    ? p.grades
        .filter((g) => p.selectedGradeIds.includes(g.id))
        .map((g) => g.name)
        .join(' & ')
        .toUpperCase()
    : L.allGrades;
  const yearLabel = p.academicYearLabel || `${first.getFullYear()} / ${last.getFullYear()}`;
  const shortDays = weekdayNames(p.locale, 'short');
  const longDays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(p.locale, { weekday: 'long' }).format(new Date(2000, 0, 2 + i)));
  const mNames = monthNames(p.locale);
  const dayHeaders = Array.from({ length: 7 }, (_, i) => shortDays[(weekStart + i) % 7]);

  const monthHtml = months
    .map(({ year, month }) => {
      const cells = monthDays(year, month, weekStart)
        .map((cell) => {
          if (!cell) return '<div></div>';
          const evs = byDate.get(cell.date) || [];
          const weekend = isWeekend(cell.date, weekStart, weekEnd);
          const top = evs.slice().sort((a, b) => CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category])[0];
          let bg = 'transparent';
          let fg = colors.printText;
          let fw = 'normal';
          if (schoolWide.has(cell.date)) {
            bg = colors.successSoft;
            fg = colors.success;
          }
          if (gradeSpecific.has(cell.date)) {
            bg = colors.success;
            fg = colors.success;
          }
          if (weekend) {
            bg = colors.printBorder;
            fg = colors.printMuted;
          }
          if (top && !(weekend && top.category === 'academic')) {
            bg = tint(eventColor(top), 0.35);
            fg = colors.printText;
            fw = 'bold';
          }
          return `<div style="background:${bg};color:${fg};font-weight:${fw};font-size:9px;text-align:center;border-radius:2px;line-height:14px;min-height:14px">${cell.day}</div>`;
        })
        .join('');
      return `<div><div style="font-weight:bold;font-size:11px;margin-bottom:3px">${escapeHtml(mNames[month])} ${year}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px">${dayHeaders.map((d) => `<div style="text-align:center;font-size:8.5px;color:${colors.printMuted};font-weight:bold">${escapeHtml(d)}</div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">${cells}</div></div>`;
    })
    .join('');

  const leg = (color: string, label: string) =>
    `<span style="display:flex;align-items:center;gap:4px"><span style="width:13px;height:9px;background:${color};border:1px solid ${colors.printBorder};border-radius:2px;display:inline-block"></span>${escapeHtml(label)}</span>`;
  const size = Math.ceil(remember.length / 3);
  const cols = [0, 1, 2]
    .map(
      (ci) =>
        `<div>${remember
          .slice(ci * size, (ci + 1) * size)
          .map(
            (r) =>
              `<div style="display:flex;justify-content:space-between;font-size:9px;padding:1px 0;border-bottom:1px dotted ${colors.printSurface};gap:6px"><span style="font-weight:${r.bold ? 'bold' : 'normal'};color:${colors.printText};flex:1;min-width:0">${escapeHtml(r.label)}</span><span style="color:${r.bold ? colors.printText : colors.printMuted};font-weight:${r.bold ? 'bold' : 'normal'};white-space:nowrap">${escapeHtml(r.date)}</span></div>`,
          )
          .join('')}</div>`,
    )
    .join('');

  const body = `<div style="font-family:Arial,sans-serif;background:${colors.white};color:${colors.printText};padding:18px 22px;box-sizing:border-box">
<div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid ${colors.destructive};padding-bottom:8px;margin-bottom:10px">
<div style="display:flex;align-items:center;gap:12px">${p.schoolLogoUrl ? `<img src="${escapeHtml(p.schoolLogoUrl)}" style="width:64px;height:64px;object-fit:contain;border-radius:6px"/>` : ''}<div>
<div style="font-size:24px;font-weight:bold;color:${colors.destructive};line-height:1.15">${escapeHtml(p.calendarTitle?.trim() || L.title)} &nbsp; ${escapeHtml(yearLabel)}</div>
<div style="font-size:12px;font-weight:bold;color:${colors.warning};margin-top:2px;letter-spacing:0.07em">${escapeHtml(gradeLabel)}</div>
<div style="font-size:10px;color:${colors.printMuted};margin-top:3px">${escapeHtml([p.schoolName, p.schoolAddress].filter(Boolean).join(' · '))}</div></div></div>
<div style="text-align:end;font-size:10px;color:${colors.printMuted}"><div style="font-weight:bold">${escapeHtml(L.schoolWeek)}</div><div>${escapeHtml(`${longDays[weekStart]} – ${longDays[weekEnd]}`)}</div></div></div>
<div style="display:grid;grid-template-columns:repeat(${months.length <= 10 ? 5 : 6},1fr);gap:8px 12px;margin-bottom:10px">${monthHtml}</div>
<div style="display:flex;align-items:center;gap:14px;font-size:9.5px;border-top:1px solid ${colors.printBorder};border-bottom:1px solid ${colors.printBorder};padding:4px 0;margin-bottom:8px;flex-wrap:wrap">${leg(colors.success, L.gradePeriod)}${leg(colors.successSoft, L.schoolPeriod)}${leg(colors.printBorder, L.weekend)}${legendCats.map(([c, color]) => leg(tint(color, 0.35), L.category(c))).join('')}</div>
<div style="border:1px solid ${colors.printBorder};border-radius:6px;padding:6px 10px"><div style="font-weight:bold;font-size:11px;color:${colors.destructive};margin-bottom:5px;border-bottom:1px solid ${colors.printBorder};padding-bottom:3px">${escapeHtml(L.datesToRemember)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 16px">${cols}</div></div>
${p.footerNote?.trim() ? `<div style="margin-top:8px;font-size:9.5px;color:${colors.printText};white-space:pre-wrap">${escapeHtml(p.footerNote.trim())}</div>` : ''}
</div>`;

  return `<!DOCTYPE html><html dir="${p.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(L.title)}</title><style>*{box-sizing:border-box}body{margin:0;padding:0;background:${colors.white};-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 landscape;margin:6mm}</style></head><body>${body}</body></html>`;
}
