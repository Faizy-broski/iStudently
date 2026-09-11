// verification_flags bitfield shared by miqat_events writers/readers (the
// batch ingest path and the photo-retention job both need it — see
// attendance.controller.ts and jobs/miqat-recompute-days.job.ts).
export const MIQAT_FLAG = {
  SIGNATURE_OK: 1,
  GEOFENCE_OK: 2,
  BEACON_OK: 4,
  DEVICE_OK: 8,
  PHOTO_CAPTURED: 16,
  TIME_DRIFT: 32,
  ANOMALY: 64,
  FLAGGED_FOR_INVESTIGATION: 128, // set by an admin action (future work) — exempts a photo from auto-deletion, spec §16
} as const;
