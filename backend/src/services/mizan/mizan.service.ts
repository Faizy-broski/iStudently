import { supabase } from '../../config/supabase';

// Minimal Mizan foundation — see supabase/migrations/20260912_create_mizan_minimal.sql
// for why this exists (a Miqat v3 dependency, not a full economy platform).
// The only mutation path is credit; there is no debit/spend flow here.

export class MizanService {
  /** Guards against crediting the same rolling streak every single night it happens to still hold true. */
  async hasRecentCredit(personId: string, reason: string, sinceIso: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('mizan_ledger_entries')
      .select('id')
      .eq('person_id', personId)
      .eq('reason', reason)
      .gte('created_at', sinceIso)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  /**
   * Read-then-write, not atomic — acceptable here because credits are
   * infrequent (weekly punctuality streaks at most) and low-stakes
   * (an in-app reward, not real currency). A genuine economy platform would
   * need an atomic increment (Postgres function); out of scope for this
   * minimal build, called out explicitly rather than silently risking a
   * subtle bug under real concurrency.
   */
  async creditNuqra(personId: string, schoolId: string, amount: number, reason: string, sourceEventRef?: string): Promise<void> {
    const { error: ledgerError } = await supabase
      .from('mizan_ledger_entries')
      .insert({ person_id: personId, school_id: schoolId, delta: amount, reason, source_event_ref: sourceEventRef });
    if (ledgerError) throw ledgerError;

    const { data: existing } = await supabase.from('mizan_accounts').select('nuqra_balance').eq('person_id', personId).maybeSingle();
    const newBalance = (existing?.nuqra_balance ?? 0) + amount;
    const { error: accountError } = await supabase
      .from('mizan_accounts')
      .upsert({ person_id: personId, school_id: schoolId, nuqra_balance: newBalance, updated_at: new Date().toISOString() });
    if (accountError) throw accountError;
  }

  async issueVoucher(schoolId: string, classId: string, title: string, reason: string): Promise<void> {
    const { error } = await supabase.from('mizan_vouchers').insert({ school_id: schoolId, class_id: classId, title, reason });
    if (error) throw error;
  }
}

export const mizanService = new MizanService();
