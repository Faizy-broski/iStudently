import ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase';

export interface TimesheetRow {
  personId: string;
  firstName: string;
  lastName: string;
  workedDays: number;
  latenessMinutes: number;
  absences: number;
}

export class MiqatReportsService {
  /** HR/payroll export (spec §13, §19 — presence-days, not worked-hours: staff check-out isn't mandated in this build, see plan's open question #6). */
  async generateTimesheet(schoolId: string, month: string): Promise<{ buffer: Buffer; filename: string }> {
    const monthStart = `${month}-01`;
    const monthEnd = new Date(new Date(`${monthStart}T00:00:00Z`).getFullYear(), new Date(`${monthStart}T00:00:00Z`).getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const { data: days, error } = await supabase
      .from('miqat_days')
      .select('person_id, status, lateness_minutes, profiles!miqat_days_person_id_fkey(first_name, last_name, role)')
      .eq('school_id', schoolId)
      .gte('date', monthStart)
      .lte('date', monthEnd);
    if (error) throw error;

    const staffDays = (days || []).filter((d: any) => ['teacher', 'admin', 'staff'].includes(d.profiles?.role));
    const byPerson = new Map<string, TimesheetRow>();
    for (const d of staffDays as any[]) {
      const existing = byPerson.get(d.person_id) ?? {
        personId: d.person_id,
        firstName: d.profiles?.first_name ?? '',
        lastName: d.profiles?.last_name ?? '',
        workedDays: 0,
        latenessMinutes: 0,
        absences: 0,
      };
      if (d.status === 'present' || d.status === 'late') existing.workedDays++;
      if (d.status === 'absent') existing.absences++;
      existing.latenessMinutes += d.lateness_minutes || 0;
      byPerson.set(d.person_id, existing);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Timesheet');
    sheet.columns = [
      { header: 'Staff Member', key: 'name', width: 30 },
      { header: 'Worked Days', key: 'workedDays', width: 15 },
      { header: 'Lateness (minutes)', key: 'latenessMinutes', width: 20 },
      { header: 'Absences', key: 'absences', width: 12 },
    ];
    for (const row of byPerson.values()) {
      sheet.addRow({ name: `${row.firstName} ${row.lastName}`, workedDays: row.workedDays, latenessMinutes: row.latenessMinutes, absences: row.absences });
    }
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: `Miqat_Timesheet_${month}.xlsx` };
  }

  /**
   * Statutory Ministry report — Arabic, RTL, print-ready (spec §13). Exact
   * required layout is unknown (plan's open question #5: "obtain a sample
   * early"); this is a reasonable placeholder table (student name, days
   * present/late/absent, accumulated lateness) built so the export pipeline
   * itself is proven, swappable once a real template is provided.
   */
  async generateMinistryReport(schoolId: string, dateFrom: string, dateTo: string): Promise<{ buffer: Buffer; filename: string }> {
    const { data: days, error } = await supabase
      .from('miqat_days')
      .select('person_id, status, lateness_minutes, profiles!miqat_days_person_id_fkey(first_name, last_name, role)')
      .eq('school_id', schoolId)
      .gte('date', dateFrom)
      .lte('date', dateTo);
    if (error) throw error;

    const byPerson = new Map<string, { name: string; present: number; late: number; absent: number; latenessMinutes: number }>();
    for (const d of (days || []) as any[]) {
      if (d.profiles?.role !== 'student') continue;
      const existing = byPerson.get(d.person_id) ?? { name: `${d.profiles?.first_name ?? ''} ${d.profiles?.last_name ?? ''}`, present: 0, late: 0, absent: 0, latenessMinutes: 0 };
      if (d.status === 'present') existing.present++;
      if (d.status === 'late') existing.late++;
      if (d.status === 'absent') existing.absent++;
      existing.latenessMinutes += d.lateness_minutes || 0;
      byPerson.set(d.person_id, existing);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الحضور', { views: [{ rightToLeft: true }] });
    sheet.columns = [
      { header: 'اسم الطالب', key: 'name', width: 30 },
      { header: 'أيام الحضور', key: 'present', width: 15 },
      { header: 'أيام التأخر', key: 'late', width: 15 },
      { header: 'أيام الغياب', key: 'absent', width: 15 },
      { header: 'إجمالي دقائق التأخر', key: 'latenessMinutes', width: 20 },
    ];
    for (const row of byPerson.values()) {
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: `Miqat_Ministry_Report_${dateFrom}_to_${dateTo}.xlsx` };
  }

  async listPatternFlags(schoolId: string) {
    const { data, error } = await supabase
      .from('miqat_pattern_flags')
      .select('*, profiles!miqat_pattern_flags_person_id_fkey(first_name, last_name)')
      .eq('school_id', schoolId)
      .is('acknowledged_at', null)
      .order('detected_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async acknowledgeFlag(id: string, acknowledgedBy: string) {
    const { error } = await supabase.from('miqat_pattern_flags').update({ acknowledged_by: acknowledgedBy, acknowledged_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }
}

export const miqatReportsService = new MiqatReportsService();
