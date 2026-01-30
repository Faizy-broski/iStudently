# Database Migration Sequence for Academics Module

## ⚠️ Important: Migration Order

The academics module requires **TWO** migrations to be run in sequence:

## Migration 1: Create Academics Tables (Run First)

**File:** `create_academics_tables.sql`

**What it does:**
- Creates `grade_levels`, `sections`, and `subjects` tables
- Sets up indexes and constraints
- Creates helper functions (get_grade_with_stats, get_sections_by_grade, etc.)
- Creates `update_section_strength()` function (but NOT the trigger yet)
- Sets up RLS policies

**Status:** ✅ Ready to run immediately

**How to run:**
1. Open Supabase SQL Editor
2. Copy entire contents of `create_academics_tables.sql`
3. Paste and click **RUN**
4. Verify success

## Migration 2: Link Students to Sections (Run Second)

**File:** `link_students_to_sections.sql`

**What it does:**
- Adds `grade_level_id` and `section_id` columns to `students` table
- **NOW creates the trigger** to auto-update section strength
- Initializes current_strength for existing sections
- Updates `get_grade_with_stats()` to show real student counts
- Adds validation to ensure students match section grades
- Creates helper view for student-section-grade lookups

**Prerequisites:**
- ✅ Migration 1 completed
- ✅ Students table exists
- ✅ At least one grade level created
- ✅ At least one section created

**Status:** ⏸️ Run AFTER you've created at least one grade and section

**How to run:**
1. First create at least one grade level through the UI
2. First create at least one section through the UI
3. Open Supabase SQL Editor
4. Copy entire contents of `link_students_to_sections.sql`
5. Paste and click **RUN**
6. Verify success

## Why Two Migrations?

### The Circular Dependency Problem

```
┌─────────────────────────────────────────────────┐
│  We want sections to auto-update their         │
│  current_strength when students are added.     │
└─────────────────────────────────────────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  Need a TRIGGER on     │
         │  students table        │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  But trigger needs     │
         │  section_id column     │
         │  in students table     │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  But students table    │
         │  already exists and    │
         │  may have data         │
         └────────────────────────┘
```

**Solution:** 
1. First migration creates the infrastructure
2. Second migration connects the pieces once everything exists

## Current Status

```
✅ Migration 1: create_academics_tables.sql
   - Tables: Created
   - Functions: Created
   - Trigger: NOT YET (function exists, trigger doesn't)

⏸️ Migration 2: link_students_to_sections.sql
   - Status: WAITING
   - Run when: After creating first grade & section
   - Purpose: Activate the trigger
```

## Quick Start Workflow

### Phase 1: Basic Setup (Day 1)
```bash
1. Run Migration 1 (create_academics_tables.sql)
2. Start your backend and frontend
3. Login as admin
4. Create your first grade level (e.g., "Grade 10")
5. Create your first section (e.g., "Section A")
```

### Phase 2: Student Integration (Day 2)
```bash
6. Run Migration 2 (link_students_to_sections.sql)
7. Now when you assign students to sections:
   - section.current_strength auto-updates ✅
   - section.available_seats auto-calculates ✅
   - Capacity validation works ✅
```

## Testing the Integration

After running both migrations:

### Test 1: Assign a student to a section
```sql
UPDATE students 
SET 
    grade_level_id = (SELECT id FROM grade_levels WHERE name = 'Grade 10' LIMIT 1),
    section_id = (SELECT id FROM sections WHERE name = 'Section A' LIMIT 1)
WHERE student_number = 'STU001';
```

### Test 2: Verify section strength updated
```sql
SELECT 
    name,
    capacity,
    current_strength,
    (capacity - current_strength) AS available_seats
FROM sections
WHERE name = 'Section A';
```

Expected: `current_strength` should be 1

### Test 3: View the student academic info
```sql
SELECT * FROM student_academic_info 
WHERE section_name = 'Section A';
```

Expected: Shows student with grade and section details

## What Happens When You Assign Students?

```
BEFORE Migration 2:
──────────────────
Student assigned to section → Section strength stays 0 ❌
Manual tracking needed ❌

AFTER Migration 2:
─────────────────
Student assigned to section → Trigger fires automatically
                            → Section strength increases ✅
                            → Available seats decreases ✅
                            → Grade validation checks ✅
                            → Capacity limits enforced ✅
```

## Features Unlocked After Migration 2

1. **Auto-updating Strength**
   - Add student → strength++
   - Remove student → strength--
   - Move student → old section--, new section++

2. **Capacity Enforcement**
   - Cannot add more students than capacity
   - Error thrown automatically

3. **Grade Validation**
   - Student grade must match section grade
   - Auto-assigns grade if not set

4. **Real-time Stats**
   - Grade stats show actual student counts
   - Section availability always accurate

5. **Student View**
   - `student_academic_info` view for easy queries
   - Join student + profile + grade + section in one query

## Troubleshooting

### "Trigger already exists" error
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'update_student_section_strength';

-- If it exists and you need to recreate:
DROP TRIGGER IF EXISTS update_student_section_strength ON students;
-- Then run migration 2 again
```

### "Column already exists" error
```sql
-- Check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name IN ('grade_level_id', 'section_id');

-- If they exist, skip the ALTER TABLE part
-- Just run the trigger creation part
```

### Section strength is wrong
```sql
-- Recalculate all section strengths
UPDATE sections s
SET current_strength = (
    SELECT COUNT(*) 
    FROM students st 
    WHERE st.section_id = s.id
),
updated_at = NOW();
```

## Files Reference

| File | Purpose | When to Run |
|------|---------|-------------|
| `create_academics_tables.sql` | Create core tables | Immediately |
| `link_students_to_sections.sql` | Connect students | After creating grades/sections |
| `ACADEMICS_MIGRATION_SEQUENCE.md` | This file | Reference |

## Summary Checklist

- [ ] Run Migration 1: `create_academics_tables.sql`
- [ ] Verify tables created: grade_levels, sections, subjects
- [ ] Create at least one grade through UI
- [ ] Create at least one section through UI
- [ ] Run Migration 2: `link_students_to_sections.sql`
- [ ] Verify trigger created on students table
- [ ] Test: Assign a student to a section
- [ ] Verify: Section strength auto-updated
- [ ] Success! 🎉

---

**Note:** You can use the academics module (grades, sections, subjects) immediately after Migration 1. Migration 2 is only needed when you're ready to start assigning students to sections.
