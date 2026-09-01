import { supabase } from '../config/supabase';
import { isCampus, getAllCampusIds } from '../utils/school-helpers';
import { onTextbookDelivered } from '../listeners/textbook-delivery.listener';

/** Roles allowed to override a financial (overdue-fees) block. Matches the
 * "simple role bypass" decision — no granular per-user permission row. */
const OVERRIDE_ROLES = ['super_admin', 'admin', 'librarian'];

export class FinancialBlockError extends Error {
  code = 'FINANCIAL_BLOCK';
  constructor(message: string) {
    super(message);
    this.name = 'FinancialBlockError';
  }
}

interface Actor {
  id: string;
  role: string;
}

class TextbookDeliveriesService {
  /** Same convention as library.service.ts's private resolveSchoolIds. */
  private async resolveSchoolIds(schoolId: string, userRole?: string, campusId?: string): Promise<string[]> {
    if (campusId) return [campusId];
    const isParentSchool = !(await isCampus(schoolId));
    if (userRole === 'admin' && isParentSchool) {
      return getAllCampusIds(schoolId);
    }
    return [schoolId];
  }

  /**
   * Live financial-gate check. No boolean column is stored anywhere for this —
   * it's computed fresh from student_fees on every matrix fetch and every
   * write, per the module's design.
   */
  async hasOverduePayments(studentId: string): Promise<boolean> {
    const { data } = await supabase
      .from('student_fees')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'overdue')
      .limit(1);
    return (data?.length ?? 0) > 0;
  }

  private async overdueStudentIds(studentIds: string[]): Promise<Set<string>> {
    if (studentIds.length === 0) return new Set();
    const { data } = await supabase
      .from('student_fees')
      .select('student_id')
      .in('student_id', studentIds)
      .eq('status', 'overdue');
    return new Set((data ?? []).map((r: any) => r.student_id));
  }

  // ==================== MATRIX FETCH (Feature 1) ====================

  async getMatrix(params: {
    schoolId: string;
    sectionId?: string;
    gradeLevelId?: string;
  }) {
    const { schoolId, sectionId } = params;
    let gradeLevelId = params.gradeLevelId;
    let section: any = null;

    if (sectionId) {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, grade_level_id')
        .eq('id', sectionId)
        .single();
      if (error) throw error;
      section = data;
      gradeLevelId = data.grade_level_id;
    }

    if (!gradeLevelId) {
      throw new Error('Either section_id or grade_level_id is required');
    }

    // Students: filtered by students.school_id, which stores the CAMPUS id
    // (see migration 256's header comment) — schoolId here is already the
    // resolved campus id from the controller's tbSchoolId() helper.
    let studentsQuery = supabase
      .from('students')
      .select('id, student_number, section_id, profile:profiles(first_name, last_name)')
      .eq('school_id', schoolId);
    studentsQuery = sectionId
      ? studentsQuery.eq('section_id', sectionId)
      : studentsQuery.eq('grade_level_id', gradeLevelId);

    const { data: students, error: studentsErr } = await studentsQuery;
    if (studentsErr) throw studentsErr;

    const { data: books, error: booksErr } = await supabase
      .from('textbooks')
      .select('*')
      .eq('campus_id', schoolId)
      .eq('grade_level_id', gradeLevelId)
      .eq('is_active', true)
      .order('title');
    if (booksErr) throw booksErr;

    const studentIds = (students ?? []).map((s: any) => s.id);
    const bookIds = (books ?? []).map((b: any) => b.id);

    let deliveries: any[] = [];
    if (studentIds.length > 0 && bookIds.length > 0) {
      const { data, error } = await supabase
        .from('textbook_deliveries')
        .select('*')
        .in('student_id', studentIds)
        .in('book_id', bookIds);
      if (error) throw error;
      deliveries = data ?? [];
    }

    const overdueSet = await this.overdueStudentIds(studentIds);

    const deliveryMap = new Map<string, any>();
    for (const d of deliveries) deliveryMap.set(`${d.student_id}:${d.book_id}`, d);

    return {
      section,
      books,
      students: (students ?? []).map((s: any) => ({
        id: s.id,
        student_number: s.student_number,
        name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') || 'Unnamed',
        has_overdue_payments: overdueSet.has(s.id),
        deliveries: Object.fromEntries(
          (books ?? []).map((b: any) => [b.id, deliveryMap.get(`${s.id}:${b.id}`) ?? null])
        ),
      })),
    };
  }

  // ==================== SINGLE-CELL SYNC (Feature 1) ====================

  async syncDelivery(params: {
    schoolId: string;
    campusId: string;
    actor: Actor;
    student_id: string;
    book_id: string;
    is_delivered: boolean;
    condition?: string;
    override?: boolean;
  }) {
    const { schoolId, campusId, actor, student_id, book_id, is_delivered, condition, override } = params;

    const { data: existing } = await supabase
      .from('textbook_deliveries')
      .select('id, is_delivered')
      .eq('student_id', student_id)
      .eq('book_id', book_id)
      .maybeSingle();

    let overrideUsed = false;
    if (is_delivered) {
      const blocked = await this.hasOverduePayments(student_id);
      if (blocked) {
        const actorCanOverride = OVERRIDE_ROLES.includes(actor.role);
        if (!actorCanOverride || !override) {
          throw new FinancialBlockError(
            actorCanOverride
              ? 'Student has overdue fees. Confirm override to proceed.'
              : 'Student has overdue fees. Only an admin/librarian can override.'
          );
        }
        overrideUsed = true;
      }
    }

    const { data: studentRow } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', student_id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('textbook_deliveries')
      .upsert(
        {
          school_id: schoolId,
          campus_id: campusId,
          student_id,
          book_id,
          section_id: studentRow?.section_id ?? null,
          is_delivered,
          delivered_at: is_delivered ? new Date().toISOString() : null,
          delivered_by: is_delivered ? actor.id : null,
          override_by: overrideUsed ? actor.id : null,
          condition: condition ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,book_id' }
      )
      .select()
      .single();
    if (error) throw error;

    const wasDelivered = existing?.is_delivered ?? false;
    if (is_delivered && !wasDelivered) {
      // Fire-and-forget — never awaited into the response path.
      onTextbookDelivered(schoolId, campusId, book_id, student_id).catch(() => {});
    }

    return data;
  }

  // ==================== BULK SYNC — "Check All" (Feature 1) ====================

  async bulkSyncDelivery(params: {
    schoolId: string;
    campusId: string;
    actor: Actor;
    items: Array<{ student_id: string; book_id: string; is_delivered: boolean; condition?: string }>;
    override?: boolean;
  }) {
    const { schoolId, campusId, actor, items, override } = params;

    const studentIds = [...new Set(items.map((i) => i.student_id))];
    const overdueSet = await this.overdueStudentIds(studentIds);
    const actorCanOverride = OVERRIDE_ROLES.includes(actor.role) && !!override;

    const allowed: typeof items = [];
    const blocked: Array<{ student_id: string; book_id: string; reason: string }> = [];
    for (const item of items) {
      if (item.is_delivered && overdueSet.has(item.student_id) && !actorCanOverride) {
        blocked.push({ student_id: item.student_id, book_id: item.book_id, reason: 'FINANCIAL_BLOCK' });
      } else {
        allowed.push(item);
      }
    }

    if (allowed.length === 0) {
      return { updated: [], blocked };
    }

    // Look up existing rows (to detect false->true transitions) and each
    // student's current section_id in two batch queries.
    const bookIds = [...new Set(allowed.map((i) => i.book_id))];
    const [{ data: existingRows }, { data: studentRows }] = await Promise.all([
      supabase.from('textbook_deliveries').select('student_id, book_id, is_delivered')
        .in('student_id', studentIds).in('book_id', bookIds),
      supabase.from('students').select('id, section_id').in('id', studentIds),
    ]);

    const existingMap = new Map<string, boolean>();
    for (const r of existingRows ?? []) existingMap.set(`${r.student_id}:${r.book_id}`, r.is_delivered);
    const sectionMap = new Map<string, string | null>();
    for (const s of studentRows ?? []) sectionMap.set(s.id, s.section_id ?? null);

    const now = new Date().toISOString();
    const overrideUsedFor = new Set(
      allowed.filter((i) => i.is_delivered && overdueSet.has(i.student_id)).map((i) => `${i.student_id}:${i.book_id}`)
    );

    const payload = allowed.map((item) => ({
      school_id: schoolId,
      campus_id: campusId,
      student_id: item.student_id,
      book_id: item.book_id,
      section_id: sectionMap.get(item.student_id) ?? null,
      is_delivered: item.is_delivered,
      delivered_at: item.is_delivered ? now : null,
      delivered_by: item.is_delivered ? actor.id : null,
      override_by: overrideUsedFor.has(`${item.student_id}:${item.book_id}`) ? actor.id : null,
      condition: item.condition ?? null,
      updated_at: now,
    }));

    const { data: updated, error } = await supabase
      .from('textbook_deliveries')
      .upsert(payload, { onConflict: 'student_id,book_id' })
      .select();
    if (error) throw error;

    // Fire the delivery listener once per newly-delivered pair, each isolated
    // in its own try/catch inside onTextbookDelivered so one failure never
    // stops the loop.
    for (const item of allowed) {
      const wasDelivered = existingMap.get(`${item.student_id}:${item.book_id}`) ?? false;
      if (item.is_delivered && !wasDelivered) {
        onTextbookDelivered(schoolId, campusId, item.book_id, item.student_id).catch(() => {});
      }
    }

    return { updated: updated ?? [], blocked };
  }

  // ==================== RETURN MODE (Feature 4) ====================
  // No financial gate applies to returns — only to new deliveries.

  async returnDelivery(
    id: string,
    schoolId: string,
    input: { return_status: string; condition?: string; notes?: string },
    actor: Actor
  ) {
    const { data, error } = await supabase
      .from('textbook_deliveries')
      .update({
        return_status: input.return_status,
        condition: input.condition ?? null,
        notes: input.notes ?? null,
        returned_at: new Date().toISOString(),
        returned_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('campus_id', schoolId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async bulkReturnDelivery(
    schoolId: string,
    items: Array<{ id: string; return_status: string; condition?: string; notes?: string }>,
    actor: Actor
  ) {
    const now = new Date().toISOString();
    const results = await Promise.all(
      items.map(async (item) => {
        const { data, error } = await supabase
          .from('textbook_deliveries')
          .update({
            return_status: item.return_status,
            condition: item.condition ?? null,
            notes: item.notes ?? null,
            returned_at: now,
            returned_by: actor.id,
            updated_at: now,
          })
          .eq('id', item.id)
          .eq('campus_id', schoolId)
          .select()
          .maybeSingle();
        if (error) return { id: item.id, error: error.message };
        return data;
      })
    );
    return results;
  }

  // ==================== MISSING BOOKS DASHBOARD (Feature 5) ====================
  // Fetch-and-reduce-in-JS, matching library.service.ts::getLibraryStats's
  // convention rather than a raw SQL GROUP BY through the Supabase client.

  async getMissingSummary(schoolId: string, userRole?: string, campusId?: string) {
    const schoolIds = await this.resolveSchoolIds(schoolId, userRole, campusId);

    const { data: books } = await supabase
      .from('textbooks')
      .select('id, title, grade_level_id, grade_level:grade_levels(name)')
      .in('school_id', schoolIds)
      .eq('is_active', true);

    const { data: sections } = await supabase
      .from('sections')
      .select('id, name, grade_level_id')
      .in('school_id', schoolIds)
      .eq('is_active', true);

    const { data: students } = await supabase
      .from('students')
      .select('id, grade_level_id, section_id')
      .in('school_id', schoolIds);

    const { data: deliveredRows } = await supabase
      .from('textbook_deliveries')
      .select('book_id, section_id')
      .in('school_id', schoolIds)
      .eq('is_delivered', true);

    const studentCountByGrade = new Map<string, number>();
    const studentCountBySection = new Map<string, number>();
    for (const s of students ?? []) {
      if (s.grade_level_id) studentCountByGrade.set(s.grade_level_id, (studentCountByGrade.get(s.grade_level_id) ?? 0) + 1);
      if (s.section_id) studentCountBySection.set(s.section_id, (studentCountBySection.get(s.section_id) ?? 0) + 1);
    }

    const deliveredCountByBook = new Map<string, number>();
    const deliveredCountBySection = new Map<string, number>();
    for (const r of deliveredRows ?? []) {
      deliveredCountByBook.set(r.book_id, (deliveredCountByBook.get(r.book_id) ?? 0) + 1);
      if (r.section_id) deliveredCountBySection.set(r.section_id, (deliveredCountBySection.get(r.section_id) ?? 0) + 1);
    }

    const by_book = (books ?? []).map((b: any) => {
      const totalStudents = studentCountByGrade.get(b.grade_level_id) ?? 0;
      const delivered = deliveredCountByBook.get(b.id) ?? 0;
      return {
        book_id: b.id,
        title: b.title,
        grade_level_name: b.grade_level?.name ?? null,
        total_students: totalStudents,
        missing_count: Math.max(0, totalStudents - delivered),
      };
    });

    const booksPerGrade = new Map<string, number>();
    for (const b of books ?? []) booksPerGrade.set(b.grade_level_id, (booksPerGrade.get(b.grade_level_id) ?? 0) + 1);

    const by_section = (sections ?? []).map((sec: any) => {
      const totalStudents = studentCountBySection.get(sec.id) ?? 0;
      const expectedAssignments = totalStudents * (booksPerGrade.get(sec.grade_level_id) ?? 0);
      const delivered = deliveredCountBySection.get(sec.id) ?? 0;
      return {
        section_id: sec.id,
        section_name: sec.name,
        total_students: totalStudents,
        missing_count: Math.max(0, expectedAssignments - delivered),
      };
    });

    return { by_book, by_section };
  }
}

export const textbookDeliveriesService = new TextbookDeliveriesService();
