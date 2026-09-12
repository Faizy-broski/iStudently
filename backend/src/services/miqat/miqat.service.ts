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
  person_id?: string | null; // which teacher this device belongs to — required for role='teacher', see migration comment
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

  async createEnrolmentCode(schoolId: string, role: 'gate' | 'teacher' | 'admin', createdBy: string, personId?: string) {
    const code = require('crypto').randomBytes(9).toString('base64url'); // 12-char single-use code
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('miqat_enrolment_codes')
      .insert({ code, school_id: schoolId, role, created_by: createdBy, expires_at: expiresAt, person_id: personId ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Today's timetabled (period, section) slots for one teacher, resolved from their profile_id. */
  async getTeacherPeriodsForDate(teacherProfileId: string, schoolId: string, dayOfWeek: number) {
    const { data: staffRow } = await supabase.from('staff').select('id').eq('profile_id', teacherProfileId).maybeSingle();
    if (!staffRow) return [];

    const { data, error } = await supabase
      .from('timetable_entries')
      .select('period_id, section_id, periods(period_name, sort_order), sections(name)')
      .eq('school_id', schoolId)
      .eq('teacher_id', staffRow.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('sort_order', { foreignTable: 'periods', ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      periodId: r.period_id,
      sectionId: r.section_id,
      periodName: r.periods?.period_name ?? '',
      sectionName: r.sections?.name ?? '',
    }));
  }

  /**
   * Full roster for one (section, period, date): every active student in the
   * section, each tagged with whether they were present at the gate that day
   * (pre-fill/grey-out, spec §7) and whether a period scan already exists
   * for them (idempotent re-open of the class-scan screen).
   */
  async getPeriodRoster(schoolId: string, sectionId: string, periodId: string, date: string) {
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('profile_id, profile:profiles(first_name, last_name)')
      .eq('section_id', sectionId)
      .eq('school_id', schoolId);
    if (studentsError) throw studentsError;

    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    const { data: gateEvents, error: gateError } = await supabase
      .from('miqat_events')
      .select('person_id')
      .eq('school_id', schoolId)
      .eq('scope', 'gate')
      .eq('event_type', 'check_in')
      .gte('device_time', dayStart)
      .lte('device_time', dayEnd);
    if (gateError) throw gateError;
    const presentAtGate = new Set((gateEvents || []).map((e) => e.person_id));

    const { data: periodEvents, error: periodError } = await supabase
      .from('miqat_events')
      .select('person_id, event_type')
      .eq('school_id', schoolId)
      .eq('scope', 'period')
      .eq('period_id', periodId)
      .gte('device_time', dayStart)
      .lte('device_time', dayEnd);
    if (periodError) throw periodError;
    const alreadyScanned = new Map((periodEvents || []).map((e) => [e.person_id, e.event_type]));

    return (students || []).map((s: any) => ({
      personId: s.profile_id,
      firstName: s.profile?.first_name ?? '',
      lastName: s.profile?.last_name ?? '',
      gateAbsent: !presentAtGate.has(s.profile_id),
      periodStatus: alreadyScanned.get(s.profile_id) ?? null,
    }));
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

  /** Resolves a guardian's linked children to {studentId, profileId, name} — profileId is what Miqat's person_id actually is. */
  async getChildrenForGuardian(guardianProfileId: string): Promise<{ studentId: string; profileId: string; firstName: string; lastName: string }[]> {
    const { data: parentRow } = await supabase.from('parents').select('id').eq('profile_id', guardianProfileId).maybeSingle();
    if (!parentRow) return [];
    const { data, error } = await supabase
      .from('parent_student_links')
      .select('student:students(id, profile_id, profile:profiles(first_name, last_name))')
      .eq('parent_id', parentRow.id)
      .eq('is_active', true);
    if (error) throw error;
    return (data || [])
      .map((r: any) => r.student)
      .filter(Boolean)
      .map((s: any) => ({ studentId: s.id, profileId: s.profile_id, firstName: s.profile?.first_name ?? '', lastName: s.profile?.last_name ?? '' }));
  }

  async getDaysForPerson(personId: string, dateFrom: string, dateTo: string) {
    const { data, error } = await supabase
      .from('miqat_days')
      .select('*')
      .eq('person_id', personId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  }

  /** De-dup guard so a persistent pattern doesn't re-raise a flag every single night it's checked. */
  async hasRecentPatternFlag(personId: string, flagType: string, sinceIso: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('miqat_pattern_flags')
      .select('id')
      .eq('person_id', personId)
      .eq('flag_type', flagType)
      .gte('detected_at', sinceIso)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  /** Which (teacher, period) combos are timetabled for a given day-of-week (0=Monday..6=Sunday, matching this codebase's existing convention). */
  async getExpectedPeriodScans(schoolId: string, dayOfWeek: number): Promise<{ teacherProfileId: string; periodId: string }[]> {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select('period_id, staff!inner(profile_id)')
      .eq('school_id', schoolId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true);
    if (error) throw error;
    return (data || [])
      .filter((r: any) => r.staff?.profile_id)
      .map((r: any) => ({ teacherProfileId: r.staff.profile_id, periodId: r.period_id }));
  }

  /** Set of "periodId:date" keys that had at least one period-scope scan, for cheap in-memory lookup across many (period, date) checks. */
  async listScannedPeriodDateKeys(schoolId: string, dateFrom: string, dateTo: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('miqat_events')
      .select('period_id, device_time')
      .eq('school_id', schoolId)
      .eq('scope', 'period')
      .gte('device_time', `${dateFrom}T00:00:00.000Z`)
      .lte('device_time', `${dateTo}T23:59:59.999Z`);
    if (error) throw error;
    return new Set((data || []).map((r: any) => `${r.period_id}:${r.device_time.slice(0, 10)}`));
  }

  async getStaffSecretRef(personId: string): Promise<string | null> {
    const { data, error } = await supabase.from('miqat_staff_rotating_secrets').select('secret_ref').eq('person_id', personId).maybeSingle();
    if (error) throw error;
    return data?.secret_ref ?? null;
  }

  async createStaffSecretRef(personId: string, secretRef: string): Promise<void> {
    const { error } = await supabase.from('miqat_staff_rotating_secrets').insert({ person_id: personId, secret_ref: secretRef });
    if (error) throw error;
  }

  async insertPatternFlag(schoolId: string, personId: string, flagType: string, details: Record<string, any>) {
    const { error } = await supabase.from('miqat_pattern_flags').insert({ school_id: schoolId, person_id: personId, flag_type: flagType, details });
    if (error) throw error;
  }

  async listActivePersonIds(schoolId: string, sinceDate: string): Promise<string[]> {
    const { data, error } = await supabase.from('miqat_days').select('person_id').eq('school_id', schoolId).gte('date', sinceDate);
    if (error) throw error;
    return [...new Set((data || []).map((r) => r.person_id))];
  }

  async listPermissions(schoolId: string, status?: 'pending' | 'approved' | 'rejected') {
    let query = supabase
      .from('miqat_permissions')
      .select('*, profiles!miqat_permissions_person_id_fkey(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
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
