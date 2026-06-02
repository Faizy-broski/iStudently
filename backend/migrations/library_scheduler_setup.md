# Library Overdue Loan Scheduler Setup

This document explains how to set up automated overdue loan detection for the library module.

## Option 1: Using pg_cron (Recommended for Supabase/PostgreSQL)

### Prerequisites
- PostgreSQL with pg_cron extension enabled
- Supabase: pg_cron is available on paid plans

### Setup Steps

#### 1. Enable pg_cron Extension

```sql
-- Run this as a superuser or in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### 2. Schedule the Overdue Loan Job

```sql
-- Schedule to run daily at 00:05 (5 minutes past midnight)
SELECT cron.schedule(
    'mark-overdue-loans',           -- Job name
    '5 0 * * *',                    -- Cron expression (daily at 00:05)
    $$SELECT mark_overdue_loans()$$ -- SQL to execute
);
```

#### 3. Verify the Job

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

#### 4. Manual Execution (for testing)

```sql
-- Run the function manually to test
SELECT * FROM mark_overdue_loans();
```

### Cron Expression Examples

```
5 0 * * *       -- Daily at 00:05 (5 minutes past midnight)
0 */6 * * *     -- Every 6 hours
0 9 * * *       -- Daily at 9:00 AM
0 0 * * 0       -- Weekly on Sunday at midnight
0 2 1 * *       -- Monthly on the 1st at 2:00 AM
```

### Unscheduling the Job

```sql
-- If you need to remove the scheduled job
SELECT cron.unschedule('mark-overdue-loans');
```

---

## Option 2: Using Node.js Cron (For Self-Hosted)

If you're self-hosting and don't have pg_cron, you can use Node.js cron:

### 1. Install Dependencies

```bash
cd backend
npm install node-cron
```

### 2. Create Scheduler Service

Create `backend/src/services/scheduler.service.ts`:

```typescript
import cron from 'node-cron';
import { supabase } from '../config/supabase';

export class SchedulerService {
  static startSchedulers() {
    // Run daily at 00:05 (5 minutes past midnight)
    cron.schedule('5 0 * * *', async () => {
      console.log('Running overdue loan detection...');
      try {
        const { data, error } = await supabase.rpc('mark_overdue_loans');
        
        if (error) {
          console.error('Error marking overdue loans:', error);
        } else {
          console.log(`Marked ${data?.[0]?.updated_count || 0} loans as overdue`);
        }
      } catch (err) {
        console.error('Failed to mark overdue loans:', err);
      }
    });

    console.log('Library schedulers initialized');
  }
}
```

### 3. Initialize in App

Update `backend/src/app.ts`:

```typescript
import { SchedulerService } from './services/scheduler.service';

// After app initialization
if (process.env.NODE_ENV === 'production') {
  SchedulerService.startSchedulers();
}
```

---

## Option 3: External Cron Service (For Serverless)

If deploying to serverless platforms (Vercel, Netlify), use external cron services:

### Using EasyCron, cron-job.org, or similar

1. Create an API endpoint in your backend:

```typescript
// backend/src/routes/scheduler.routes.ts
import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.post('/cron/mark-overdue-loans', async (req, res) => {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase.rpc('mark_overdue_loans');
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      updated: data?.[0]?.updated_count || 0 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

2. Register the route in `app.ts`:

```typescript
import schedulerRoutes from './routes/scheduler.routes';
app.use('/api', schedulerRoutes);
```

3. Set up external cron service to POST to:
   ```
   POST https://your-api.com/api/cron/mark-overdue-loans
   Headers: x-cron-secret: YOUR_SECRET_KEY
   ```

---

## Option 4: GitHub Actions (For Projects on GitHub)

Create `.github/workflows/library-cron.yml`:

```yaml
name: Library Overdue Loans

on:
  schedule:
    - cron: '5 0 * * *'  # Daily at 00:05 UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  mark-overdue:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cron Endpoint
        run: |
          curl -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://your-api.com/api/cron/mark-overdue-loans
```

---

## Monitoring and Logs

### Database Function Returns

The `mark_overdue_loans()` function returns:
- `updated_count`: Number of loans marked as overdue
- `affected_students`: Array of student IDs affected

### Recommended Logging

1. **Create a cron_log table** (optional):

```sql
CREATE TABLE library_cron_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name TEXT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_count INTEGER,
    affected_students UUID[],
    error TEXT,
    execution_time_ms INTEGER
);
```

2. **Enhanced logging function**:

```sql
CREATE OR REPLACE FUNCTION mark_overdue_loans_with_logging()
RETURNS TABLE(
    updated_count INTEGER,
    affected_students UUID[]
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_updated_count INTEGER;
    v_affected_students UUID[];
    v_execution_time INTEGER;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Call the actual function
    SELECT * INTO v_updated_count, v_affected_students 
    FROM mark_overdue_loans();
    
    v_end_time := clock_timestamp();
    v_execution_time := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;
    
    -- Log the execution
    INSERT INTO library_cron_logs (
        job_name, 
        updated_count, 
        affected_students, 
        execution_time_ms
    ) VALUES (
        'mark_overdue_loans',
        v_updated_count,
        v_affected_students,
        v_execution_time
    );
    
    RETURN QUERY SELECT v_updated_count, v_affected_students;
END;
$$ LANGUAGE plpgsql;
```

---

## Testing

### Manual Test

```sql
-- 1. Create a test loan that should be overdue
INSERT INTO library_loans (
    book_copy_id, 
    student_id, 
    school_id, 
    issue_date, 
    due_date, 
    status
) VALUES (
    'your-copy-id',
    'your-student-id',
    'your-school-id',
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE - INTERVAL '5 days',
    'active'
);

-- 2. Run the function
SELECT * FROM mark_overdue_loans();

-- 3. Verify the loan status changed
SELECT id, status, due_date 
FROM library_loans 
WHERE due_date < CURRENT_DATE AND status = 'overdue';
```

---

## Recommendations

1. **For Supabase Users**: Use **pg_cron** (Option 1) - most reliable and native
2. **For Self-Hosted**: Use **Node.js cron** (Option 2) - easy to maintain
3. **For Serverless**: Use **External Cron Service** (Option 3) - platform agnostic
4. **For GitHub Projects**: Use **GitHub Actions** (Option 4) - free and simple

---

## Troubleshooting

### pg_cron Job Not Running

1. Check if extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check job status:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'mark-overdue-loans')
   ORDER BY start_time DESC;
   ```

3. Check permissions:
   ```sql
   GRANT EXECUTE ON FUNCTION mark_overdue_loans() TO cron;
   ```

### Function Not Found

Ensure you've run the migration scripts in order:
1. `create_library_tables.sql` (your schema)
2. `library_optimizations.sql` (optimization script)

---

## Security Considerations

1. **For API Endpoints**: Always use authentication/secret tokens
2. **For pg_cron**: Ensure proper database permissions
3. **Rate Limiting**: Implement rate limiting on cron endpoints
4. **Monitoring**: Set up alerts for failed executions

---

## Next Steps

1. Choose the appropriate option for your deployment
2. Set up monitoring and logging
3. Test thoroughly in a staging environment
4. Document the chosen approach in your deployment docs
