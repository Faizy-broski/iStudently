/**
 * Profile columns that may be returned to clients for a person record (student, parent, staff).
 * Never select `profiles(*)` for a response: the row includes TOTP secrets, recovery codes and the
 * encrypted login password.
 */
export const SAFE_PROFILE_COLUMNS =
  'id, first_name, father_name, grandfather_name, last_name, email, phone, gender, date_of_birth, national_id, avatar_url, profile_photo_url, is_active, role, username'
