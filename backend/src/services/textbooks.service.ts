import { supabase } from '../config/supabase';
import { isCampus, getAllCampusIds } from '../utils/school-helpers';

export interface Textbook {
  id: string;
  school_id: string;
  campus_id: string;
  grade_level_id: string;
  title: string;
  subject: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class TextbooksService {
  /**
   * Resolves the set of school/campus IDs to query.
   * Same convention as library.service.ts's private resolveSchoolIds — an
   * admin at a parent school with no campus selected sees the union across
   * all campuses; a campus-scoped user (librarian, campus admin) sees only
   * their own campus.
   */
  private async resolveSchoolIds(schoolId: string, userRole?: string, campusId?: string): Promise<string[]> {
    if (campusId) return [campusId];
    const isParentSchool = !(await isCampus(schoolId));
    if (userRole === 'admin' && isParentSchool) {
      return getAllCampusIds(schoolId);
    }
    return [schoolId];
  }

  async getTextbooks(
    schoolId: string,
    userRole?: string,
    filters: { grade_level_id?: string; is_active?: boolean; campus_id?: string } = {}
  ): Promise<Textbook[]> {
    const schoolIds = await this.resolveSchoolIds(schoolId, userRole, filters.campus_id);

    let query = supabase
      .from('textbooks')
      .select('*')
      .in('school_id', schoolIds)
      .order('title');

    if (filters.grade_level_id) query = query.eq('grade_level_id', filters.grade_level_id);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Textbook[];
  }

  async getTextbookById(id: string, schoolId: string): Promise<Textbook> {
    const { data, error } = await supabase
      .from('textbooks')
      .select('*')
      .eq('id', id)
      .eq('campus_id', schoolId)
      .single();
    if (error) throw error;
    return data as Textbook;
  }

  async createTextbook(
    input: { title: string; grade_level_id: string; subject?: string; stock_quantity?: number },
    schoolId: string,
    campusId: string
  ): Promise<Textbook> {
    const { data, error } = await supabase
      .from('textbooks')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        grade_level_id: input.grade_level_id,
        title: input.title,
        subject: input.subject ?? null,
        stock_quantity: input.stock_quantity ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Textbook;
  }

  async updateTextbook(
    id: string,
    input: { title?: string; grade_level_id?: string; subject?: string; is_active?: boolean },
    schoolId: string
  ): Promise<Textbook> {
    const { data, error } = await supabase
      .from('textbooks')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('campus_id', schoolId)
      .select()
      .single();
    if (error) throw error;
    return data as Textbook;
  }

  async deleteTextbook(id: string, schoolId: string): Promise<{ success: true }> {
    // Block deletion if any delivery rows reference this book — mirrors
    // library.service.ts::deleteBook's guard against deleting a book with
    // existing copies.
    const { count } = await supabase
      .from('textbook_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', id);

    if (count && count > 0) {
      throw new Error('Cannot delete a textbook with existing delivery records. Deactivate it instead.');
    }

    const { error } = await supabase
      .from('textbooks')
      .delete()
      .eq('id', id)
      .eq('campus_id', schoolId);
    if (error) throw error;
    return { success: true };
  }

  /**
   * Explicit restock endpoint (rather than letting a plain PUT overwrite
   * stock_quantity) since stock is concurrently decremented elsewhere by the
   * delivery listener — a naive PUT could clobber that under a race.
   * `amount` is a signed delta (positive to add stock, negative to correct it).
   */
  async restock(id: string, amount: number, schoolId: string): Promise<Textbook> {
    const { data: existing, error: fetchErr } = await supabase
      .from('textbooks')
      .select('stock_quantity')
      .eq('id', id)
      .eq('campus_id', schoolId)
      .single();
    if (fetchErr) throw fetchErr;

    const newQuantity = Math.max(0, (existing?.stock_quantity ?? 0) + amount);

    const { data, error } = await supabase
      .from('textbooks')
      .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('campus_id', schoolId)
      .select()
      .single();
    if (error) throw error;
    return data as Textbook;
  }

  /**
   * Fire-and-forget guarded decrement, called from textbook-delivery.listener.ts
   * after a delivery flips is_delivered false->true. Uses the
   * decrement_textbook_stock() RPC (migration 258) so the decrement is a single
   * atomic UPDATE (GREATEST(stock_quantity - 1, 0)) rather than a
   * read-then-write that could race under concurrent deliveries.
   */
  async decrementTextbookStock(bookId: string): Promise<void> {
    const { error } = await supabase.rpc('decrement_textbook_stock', { p_book_id: bookId });
    if (error) throw error;
  }
}

export const textbooksService = new TextbooksService();
