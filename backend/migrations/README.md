# Database Migration: Add Parent Fields

## Overview
This migration adds comprehensive parent information fields to the `parents` table with a flexible metadata JSONB column for future fields.

## New Fields Added

### Professional Information
- `workplace` - Parent's place of employment
- `income` - Parent's monthly income

### Identification
- `cnic` - National identity card number (indexed for search)

### Address Information
- `address` - Street address
- `city` - City name (indexed for search)
- `state` - State or province
- `zip_code` - Postal/ZIP code
- `country` - Country name

### Emergency Contact
- `emergency_contact_name` - Emergency contact person name
- `emergency_contact_relation` - Relationship to emergency contact
- `emergency_contact_phone` - Emergency contact phone number

### Flexible Storage
- `metadata` - JSONB field for additional custom fields (stores relationship type, secondary parent info, preferences, etc.)

### Additional
- `notes` - Text field for additional notes
- `updated_at` - Timestamp (auto-updated on changes)

## Flexible Design

The `metadata` JSONB column allows you to store any additional fields without modifying the database schema:

```typescript
// Example metadata structure
{
  "secondary_parent": {
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+1234567890"
  },
  "relationship_type": "both",
  "preferred_communication": "email",
  "custom_field_1": "value1",
  "any_future_field": "value"
}
```

**To add new fields in the future:**
1. Just store them in `metadata` - no migration needed
2. Update the form to collect the data
3. Update the view/edit dialogs to display it
4. If the field becomes commonly used, optionally migrate it to a dedicated column later

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `add_parent_fields.sql`
5. Click "Run" to execute the migration

### Option 2: Supabase CLI
```bash
# Navigate to the backend directory
cd backend

# Run the migration using Supabase CLI
supabase db push

# Or apply directly
supabase db execute -f migrations/add_parent_fields.sql
```

### Option 3: Direct PostgreSQL Connection
```bash
# If you have direct PostgreSQL access
psql "your-connection-string" -f migrations/add_parent_fields.sql
```

## Verification

After running the migration, verify the columns were added:

```sql
-- Check the parents table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'parents'
ORDER BY ordinal_position;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'parents';
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
ALTER TABLE parents
DROP COLUMN IF EXISTS workplace,
DROP COLUMN IF EXISTS income,
DROP COLUMN IF EXISTS cnic,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS state,
DROP COLUMN IF EXISTS zip_code,
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS emergency_contact_name,
DROP COLUMN IF EXISTS emergency_contact_relation,
DROP COLUMN IF EXISTS emergency_contact_phone,
DROP COLUMN IF EXISTS preferred_communication,
DROP COLUMN IF EXISTS receive_notifications,
DROP COLUMN IF EXISTS is_primary_contact,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS updated_at;

DROP INDEX IF EXISTS idx_parents_cnic;
DROP INDEX IF EXISTS idx_parents_city;
DROP TRIGGER IF EXISTS parents_updated_at_trigger ON parents;
DROP FUNCTION IF EXISTS update_parents_updated_at();
```

## Impact

- **Backend**: Types and service updated to handle all new fields
- **Frontend**: AddParentForm sends all collected data to API
- **UI**: View details and edit dialogs display all parent information
- **Data**: Existing parent records will have NULL values for new fields
- **Performance**: Indexes added on `cnic` and `city` for faster searches

## Next Steps

1. Run this migration in your Supabase project
2. Test creating a new parent with all fields
3. Test viewing parent details
4. Test editing parent information
5. Verify data persistence across all fields
