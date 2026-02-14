-- =============================================================
-- HOSTEL MODULE MIGRATION
-- Tables: hostel_buildings, hostel_rooms, hostel_room_assignments,
--         hostel_room_files, hostel_visits, hostel_rental_fees,
--         hostel_settings
-- =============================================================
-- 1. hostel_buildings
CREATE TABLE IF NOT EXISTS hostel_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  floors INTEGER DEFAULT 1,
  description TEXT,
  custom_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hostel_buildings_school ON hostel_buildings(school_id);
-- 2. hostel_rooms
CREATE TABLE IF NOT EXISTS hostel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES hostel_buildings(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 1,
  room_type TEXT DEFAULT 'standard',
  price_per_month NUMERIC(10, 2) DEFAULT 0,
  description TEXT,
  custom_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(building_id, room_number)
);
CREATE INDEX idx_hostel_rooms_building ON hostel_rooms(building_id);
CREATE INDEX idx_hostel_rooms_school ON hostel_rooms(school_id);
-- 3. hostel_room_assignments
CREATE TABLE IF NOT EXISTS hostel_room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  released_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hostel_assignments_room ON hostel_room_assignments(room_id);
CREATE INDEX idx_hostel_assignments_student ON hostel_room_assignments(student_id);
CREATE INDEX idx_hostel_assignments_active ON hostel_room_assignments(is_active)
WHERE is_active = true;
-- 4. hostel_room_files (attachments for buildings and rooms)
CREATE TABLE IF NOT EXISTS hostel_room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('building', 'room')),
  entity_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE
  SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hostel_files_entity ON hostel_room_files(entity_type, entity_id);
-- 5. hostel_visits
CREATE TABLE IF NOT EXISTS hostel_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id UUID REFERENCES hostel_rooms(id) ON DELETE
  SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT,
    visitor_relation TEXT,
    purpose TEXT,
    check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_out TIMESTAMPTZ,
    notes TEXT,
    recorded_by UUID REFERENCES profiles(id) ON DELETE
  SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hostel_visits_student ON hostel_visits(student_id);
CREATE INDEX idx_hostel_visits_room ON hostel_visits(room_id);
CREATE INDEX idx_hostel_visits_checkin ON hostel_visits(check_in);
-- 6. hostel_rental_fees (self-contained, not tied to student_fees)
CREATE TABLE IF NOT EXISTS hostel_rental_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_assignment_id UUID NOT NULL REFERENCES hostel_room_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  factor NUMERIC(5, 3) DEFAULT 1.000,
  final_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'partial', 'waived')
  ),
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hostel_fees_assignment ON hostel_rental_fees(room_assignment_id);
CREATE INDEX idx_hostel_fees_student ON hostel_rental_fees(student_id);
CREATE INDEX idx_hostel_fees_period ON hostel_rental_fees(period_start, period_end);
-- 7. hostel_settings
CREATE TABLE IF NOT EXISTS hostel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  auto_remove_inactive BOOLEAN DEFAULT true,
  default_room_type TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- =============================================================
-- RLS POLICIES
-- =============================================================
ALTER TABLE hostel_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_room_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_rental_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_settings ENABLE ROW LEVEL SECURITY;
-- Service role bypass policies
CREATE POLICY "service_role_hostel_buildings" ON hostel_buildings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_rooms" ON hostel_rooms FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_room_assignments" ON hostel_room_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_room_files" ON hostel_room_files FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_visits" ON hostel_visits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_rental_fees" ON hostel_rental_fees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_hostel_settings" ON hostel_settings FOR ALL TO service_role USING (true) WITH CHECK (true);