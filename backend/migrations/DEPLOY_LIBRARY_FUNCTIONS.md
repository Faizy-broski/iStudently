# Deploy Library Functions

The library system requires database functions that are defined in `library_optimizations.sql` but haven't been deployed yet.

## Error You're Seeing

```
Could not find the function public.check_student_library_eligibility(p_school_id, p_student_id) in the schema cache
```

## Solution

You need to run the SQL migration that creates the required database functions.

### Option 1: Run via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `backend/migrations/library_optimizations.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute

### Option 2: Run via psql (if you have direct database access)

```bash
cd backend/migrations
psql "your-database-connection-string" -f library_optimizations.sql
```

### Option 3: Run via Node.js migration script

```bash
cd backend/migrations
npx ts-node run_migration.ts library_optimizations.sql
```

## What This Migration Does

The migration creates:

1. **17 Performance Indexes** for faster queries
2. **3 Views** for common data aggregations
3. **Enhanced Functions**:
   - `check_student_library_eligibility()` - Check if student can borrow books
   - `mark_overdue_loans()` - Automatically mark overdue loans
   - `update_book_available_copies()` - Keep book counts accurate

4. **Triggers** for automatic updates

## After Deployment

Once deployed, the backend will automatically use the database function instead of the fallback logic, which will be:
- ✅ Faster (single database call)
- ✅ More reliable (consistent with database state)
- ✅ More detailed (returns full eligibility information)

## Note

The current code has a **fallback mechanism** that works even without the function, but it's less efficient and was trying to use a non-existent `students.status` column (now fixed to use `profiles.is_active` instead).
