-- =========================================
-- SUPABASE pg_cron SETUP FOR LIBRARY MODULE
-- =========================================
-- This script sets up automated overdue loan detection using pg_cron
-- Run this in your Supabase SQL Editor after applying library_optimizations.sql

-- =========================================
-- 1. ENABLE pg_cron EXTENSION
-- =========================================
-- Note: pg_cron is available on Supabase paid plans
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================================
-- 2. SCHEDULE THE OVERDUE LOAN JOB
-- =========================================
-- This job runs daily at 00:05 (5 minutes past midnight)
-- to mark loans as overdue if they're past the due date

SELECT cron.schedule(
    'library-mark-overdue-loans',        -- Job name
    '5 0 * * *',                         -- Cron expression: daily at 00:05
    $$SELECT mark_overdue_loans()$$      -- SQL command to execute
);

-- =========================================
-- 3. VERIFY THE JOB WAS CREATED
-- =========================================
-- Check that the job appears in the cron.job table
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active
FROM cron.job
WHERE jobname = 'library-mark-overdue-loans';

-- Expected output:
-- jobid | jobname                      | schedule   | command                        | active
-- ------|------------------------------|------------|--------------------------------|-------
-- X     | library-mark-overdue-loans   | 5 0 * * *  | SELECT mark_overdue_loans()    | t

-- =========================================
-- 4. MANUAL TEST (OPTIONAL)
-- =========================================
-- Test the function manually to ensure it works
-- SELECT * FROM mark_overdue_loans();

-- =========================================
-- 5. MONITOR JOB EXECUTION
-- =========================================
-- View the last 10 job runs to check for errors
-- Run this query after the job has executed at least once:

-- SELECT 
--     runid,
--     jobid,
--     start_time,
--     end_time,
--     status,
--     return_message
-- FROM cron.job_run_details
-- WHERE jobid = (
--     SELECT jobid 
--     FROM cron.job 
--     WHERE jobname = 'library-mark-overdue-loans'
-- )
-- ORDER BY start_time DESC
-- LIMIT 10;

-- =========================================
-- 6. ADDITIONAL SCHEDULE OPTIONS (OPTIONAL)
-- =========================================
-- If you want to change the schedule, first unschedule the old job:
-- SELECT cron.unschedule('library-mark-overdue-loans');

-- Then create a new schedule with your preferred timing:

-- Every 6 hours:
-- SELECT cron.schedule('library-mark-overdue-loans', '0 */6 * * *', $$SELECT mark_overdue_loans()$$);

-- Twice daily (9 AM and 9 PM):
-- SELECT cron.schedule('library-mark-overdue-loans', '0 9,21 * * *', $$SELECT mark_overdue_loans()$$);

-- Every Monday at 8 AM:
-- SELECT cron.schedule('library-mark-overdue-loans', '0 8 * * 1', $$SELECT mark_overdue_loans()$$);

-- =========================================
-- SETUP COMPLETE
-- =========================================
-- Your library module will now automatically mark overdue loans daily at 00:05
-- No additional configuration or external services needed!
-- =========================================
