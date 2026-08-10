-- Adds the "MRN" (manual receipt number) field to fee_payments — the number
-- written on the school's own paper receipt book, separate from the
-- system-generated receipt_number.
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS manual_receipt_number TEXT;
