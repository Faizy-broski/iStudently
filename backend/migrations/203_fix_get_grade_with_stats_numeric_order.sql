-- 202_grade_levels_fractional_order.sql widened grade_levels.order_index to
-- NUMERIC(10,4), but its auto-patch step failed silently: it searched for
-- the literal "INTEGER" (uppercase), while pg_get_functiondef() always
-- normalizes type names to lowercase ("integer"), so the regex never
-- matched and get_grade_with_stats() was left declaring order_index as
-- integer. Recreate it here explicitly, based on the confirmed live
-- definition, with order_index as numeric(10,4).

-- CREATE OR REPLACE cannot change the row type defined by OUT
-- parameters/RETURNS TABLE, so the old integer-returning version must be
-- dropped first (error 42P13 otherwise).
DROP FUNCTION IF EXISTS public.get_grade_with_stats(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_grade_with_stats(p_campus_id uuid DEFAULT NULL::uuid, p_school_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, campus_id uuid, school_id uuid, name character varying, order_index numeric(10,4), base_fee numeric, is_active boolean, next_grade_id uuid, group_id uuid, sections_count bigint, subjects_count bigint, students_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        g.id              AS id,
        g.campus_id       AS campus_id,
        g.school_id       AS school_id,
        g.name::VARCHAR   AS name,
        g.order_index     AS order_index,
        g.base_fee        AS base_fee,
        g.is_active       AS is_active,
        g.next_grade_id   AS next_grade_id,
        g.group_id        AS group_id,
        COUNT(DISTINCT sec.id)                  AS sections_count,
        COUNT(DISTINCT sub.id)                  AS subjects_count,
        COALESCE(SUM(sec.current_strength), 0)  AS students_count
    FROM grade_levels g
    LEFT JOIN sections sec ON sec.grade_level_id = g.id AND sec.is_active = true
    LEFT JOIN subjects sub ON sub.grade_level_id = g.id AND sub.is_active = true
    WHERE
        g.is_active = true AND
        (
            (p_campus_id IS NOT NULL AND g.campus_id = p_campus_id) OR
            (p_campus_id IS NULL AND p_school_id IS NOT NULL AND g.school_id = p_school_id) OR
            (p_campus_id IS NULL AND p_school_id IS NULL)
        )
    GROUP BY g.id, g.campus_id, g.school_id, g.name, g.order_index, g.base_fee, g.is_active, g.next_grade_id, g.group_id
    ORDER BY g.order_index;
END;
$function$;

-- Sanity check: confirm the function no longer declares order_index as integer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_grade_with_stats'
      AND pg_get_functiondef(p.oid) ~ '(order_index|grade_order)\s+integer\b'
  ) THEN
    RAISE WARNING 'get_grade_with_stats still declares order_index/grade_order as integer somewhere — check for other overloads.';
  ELSE
    RAISE NOTICE 'get_grade_with_stats now returns order_index as numeric.';
  END IF;
END $$;
