import { supabase } from '../../config/supabase';

// Private Supabase Storage bucket — must be created in the Supabase Dashboard
// (this codebase creates buckets manually there, not via migration; see
// vault-media/fina-media for the same convention). Downscaled to <40KB per
// spec §7, so storage cost stays negligible even at scale.
export const MIQAT_PHOTOS_BUCKET = 'miqat-attendance-photos';

export interface MiqatSchoolConfig {
  school_id: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  max_accuracy_m: number;
  card_signing_key_ref: string;
  previous_key_ref: string | null;
  photo_retention_days: number;
  policy_json: Record<string, any>;
}

export interface MiqatDevice {
  id?: string;
  school_id: string;
  label?: string;
  role: 'gate' | 'teacher' | 'admin';
  public_key: string;
  enrolled_by?: string;
  status?: 'active' | 'revoked';
  app_version?: string;
  os_version?: string;
}

export interface MiqatEvent {
  id: string; // device-generated, idempotency key
  school_id: string;
  campus_id?: string | null;
  person_id: string;
  device_id?: string | null;
  event_type: 'check_in' | 'check_out' | 'period_present' | 'period_absent';
  scope: 'gate' | 'period';
  period_id?: string | null;
  beacon_id?: string | null;
  device_time: string;
  distance_from_centre_m?: number | null;
  accuracy_m?: number | null;
  verification_flags: number;
  photo_ref?: string | null;
  source: 'scan' | 'manual' | 'rotating_code';
  created_by_user_id?: string | null;
  reason_code?: string | null;
  notes?: string | null;
}

export class MiqatService {
  async upsertSchoolConfig(cfg: Partial<MiqatSchoolConfig> & { school_id: string }) {
    const { data, error } = await supabase
      .from('miqat_schools_config')
      .upsert(cfg, { onConflict: 'school_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async issueCard(personId: string, issuedBy: string) {
    // A person may already have prior cards (lost/reissued) — the new one
    // gets the next revision so old physical cards stop verifying (spec §5
    // Layer 1 "Revocation": scanner devices reject anything below the
    // person's minimum accepted revision, synced via getRevocationList()).
    const { data: existing, error: existingError } = await supabase
      .from('miqat_cards')
      .select('revision')
      .eq('person_id', personId)
      .order('revision', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const nextRevision = (existing?.revision ?? 0) + 1;
    const { data, error } = await supabase
      .from('miqat_cards')
      .insert({ person_id: personId, revision: nextRevision, issued_by: issuedBy, status: 'active' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async revokeCard(personId: string, reason: string) {
    const { error } = await supabase
      .from('miqat_cards')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: reason })
      .eq('person_id', personId)
      .eq('status', 'active');
    if (error) throw error;
  }

  async getSchoolConfig(schoolId: string): Promise<MiqatSchoolConfig | null> {
    const { data, error } = await supabase
      .from('miqat_schools_config')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async createEnrolmentCode(schoolId: string, role: 'gate' | 'teacher' | 'admin', createdBy: string) {
    const code = require('crypto').randomBytes(9).toString('base64url'); // 12-char single-use code
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('miqat_enrolment_codes')
      .insert({ code, school_id: schoolId, role, created_by: createdBy, expires_at: expiresAt })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listDevices(schoolId: string) {
    const { data, error } = await supabase
      .from('miqat_devices')
      .select('id, school_id, label, role, status, last_seen_at, enrolled_at')
      .eq('school_id', schoolId)
      .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  /** Atomically consumes an enrolment code — returns null if unknown/expired/already used. */
  async consumeEnrolmentCode(code: string) {
    const { data: row, error: fetchError } = await supabase
      .from('miqat_enrolment_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return null;
    if (row.used_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    const { error: updateError } = await supabase
      .from('miqat_enrolment_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code', code)
      .is('used_at', null); // guards against a race between two simultaneous enrolment attempts
    if (updateError) throw updateError;
    return row;
  }

  async registerDevice(device: MiqatDevice) {
    const { data, error } = await supabase.from('miqat_devices').insert(device).select().single();
    if (error) throw error;
    return data;
  }

  async markEnrolmentCodeDevice(code: string, deviceId: string) {
    const { error } = await supabase.from('miqat_enrolment_codes').update({ used_by_device_id: deviceId }).eq('code', code);
    if (error) throw error;
  }

  async getDevice(deviceId: string): Promise<any | null> {
    const { data, error } = await supabase.from('miqat_devices').select('*').eq('id', deviceId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async touchDeviceLastSeen(deviceId: string) {
    const { error } = await supabase
      .from('miqat_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
  }

  async getRosterBootstrap(schoolId: string) {
    // Minimal viable bootstrap payload: active cards + person names for this
    // school's students/staff, scoped so a stolen device only ever holds one
    // school's roster. Full class/period/timetable joins are a later pass.
    const { data, error } = await supabase
      .from('miqat_cards')
      .select('person_id, revision, status, profiles!inner(id, first_name, last_name, role, school_id)')
      .eq('profiles.school_id', schoolId)
      .eq('status', 'active');
    if (error) throw error;
    return data;
  }

  async getRevocationList(schoolId: string): Promise<Record<string, number>> {
    // person_id -> minimum_accepted_revision. Any card scanned below this
    // revision is CARD_REVOKED (spec §5 Layer 1).
    const { data, error } = await supabase
      .from('miqat_cards')
      .select('person_id, revision, profiles!inner(school_id)')
      .eq('profiles.school_id', schoolId)
      .order('revision', { ascending: false });
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const row of data || []) {
      if (!(row.person_id in map)) map[row.person_id] = row.revision;
    }
    return map;
  }

  /** Idempotent insert: relies on miqat_events.id being the device-generated event_id primary key. */
  async insertEvent(event: MiqatEvent): Promise<'accepted' | 'duplicate'> {
    const { error } = await supabase.from('miqat_events').insert(event);
    if (error) {
      if (error.code === '23505') return 'duplicate'; // unique_violation on primary key
      throw error;
    }
    return 'accepted';
  }

  async getLastEventForPerson(
    personId: string,
    scope: 'gate' | 'period',
    beforeIso: string
  ): Promise<MiqatEvent | null> {
    const { data, error } = await supabase
      .from('miqat_events')
      .select('*')
      .eq('person_id', personId)
      .eq('scope', scope)
      .lte('device_time', beforeIso)
      .order('device_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getEventOfTypeWithinWindow(personId: string, eventType: string, sinceIso: string): Promise<MiqatEvent | null> {
    const { data, error } = await supabase
      .from('miqat_events')
      .select('*')
      .eq('person_id', personId)
      .eq('event_type', eventType)
      .gte('device_time', sinceIso)
      .order('device_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listEventsForDay(schoolId: string, date: string, classId?: string) {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;
    let query = supabase
      .from('miqat_events')
      .select('*, profiles!inner(id, first_name, last_name, class_id, school_id)')
      .eq('profiles.school_id', schoolId)
      .gte('device_time', start)
      .lte('device_time', end);
    if (classId) query = query.eq('profiles.class_id', classId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async upsertDay(day: Record<string, any>) {
    const { data, error } = await supabase.from('miqat_days').upsert(day, { onConflict: 'person_id,date' }).select().single();
    if (error) throw error;
    return data;
  }

  async getDay(personId: string, date: string) {
    const { data, error } = await supabase.from('miqat_days').select('*').eq('person_id', personId).eq('date', date).maybeSingle();
    if (error) throw error;
    return data;
  }

  async createPermission(permission: Record<string, any>) {
    const { data, error } = await supabase.from('miqat_permissions').insert(permission).select().single();
    if (error) throw error;
    return data;
  }

  async decidePermission(id: string, status: 'approved' | 'rejected', decidedBy: string) {
    const { data, error } = await supabase
      .from('miqat_permissions')
      .update({ status, decided_by: decidedBy, decided_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async uploadEventPhoto(schoolId: string, eventId: string, buffer: Buffer, contentType: string): Promise<string> {
    const storageKey = `${schoolId}/${eventId}.jpg`;
    const { error } = await supabase.storage.from(MIQAT_PHOTOS_BUCKET).upload(storageKey, buffer, { contentType, upsert: true });
    if (error) throw error;
    return storageKey;
  }

  async setEventPhotoRef(eventId: string, storageKey: string) {
    const { error } = await supabase.from('miqat_events').update({ photo_ref: storageKey }).eq('id', eventId);
    if (error) throw error;
  }

  /**
   * Deletes photos past photo_retention_days, per school, skipping anything
   * flagged for investigation (spec §16 — this job must ship in the same
   * milestone as photo capture, not after).
   */
  async deleteExpiredPhotos(schoolId: string, retentionDays: number, investigationFlagBit: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const { data: expired, error } = await supabase
      .from('miqat_events')
      .select('id, photo_ref, verification_flags')
      .eq('school_id', schoolId)
      .not('photo_ref', 'is', null)
      .lt('device_time', cutoff);
    if (error) throw error;

    const toDelete = (expired || []).filter((e) => (e.verification_flags & investigationFlagBit) === 0);
    if (toDelete.length === 0) return 0;

    const { error: storageError } = await supabase.storage
      .from(MIQAT_PHOTOS_BUCKET)
      .remove(toDelete.map((e) => e.photo_ref as string));
    if (storageError) throw storageError;

    const { error: clearError } = await supabase
      .from('miqat_events')
      .update({ photo_ref: null })
      .in('id', toDelete.map((e) => e.id));
    if (clearError) throw clearError;

    return toDelete.length;
  }

  async listSchoolIdsWithMiqatConfig(): Promise<string[]> {
    const { data, error } = await supabase.from('miqat_schools_config').select('school_id');
    if (error) throw error;
    return (data || []).map((r) => r.school_id);
  }

  async summary(schoolId: string, dateFrom: string, dateTo: string) {
    const { data, error } = await supabase
      .from('miqat_days')
      .select('status, lateness_minutes, early_departure_minutes')
      .eq('school_id', schoolId)
      .gte('date', dateFrom)
      .lte('date', dateTo);
    if (error) throw error;
    return data;
  }
}

export const miqatService = new MiqatService();
