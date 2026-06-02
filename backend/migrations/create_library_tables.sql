-- Library Management System Tables

-- 1. Library Books Table
CREATE TABLE IF NOT EXISTS library_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20),
  category VARCHAR(100),
  publisher VARCHAR(255),
  publication_year INTEGER,
  description TEXT,
  total_copies INTEGER DEFAULT 0,
  available_copies INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Library Book Copies Table
CREATE TABLE IF NOT EXISTS library_book_copies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  accession_number VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'issued', 'lost', 'maintenance', 'damaged')),
  purchase_date DATE,
  price DECIMAL(10, 2),
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_accession_per_school UNIQUE (school_id, accession_number)
);

-- 3. Library Loans Table
CREATE TABLE IF NOT EXISTS library_loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  fine_amount DECIMAL(10, 2) DEFAULT 0,
  fine_paid BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Library Fines Table
CREATE TABLE IF NOT EXISTS library_fines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES library_loans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_library_books_school ON library_books(school_id);
CREATE INDEX idx_library_books_title ON library_books(title);
CREATE INDEX idx_library_books_author ON library_books(author);
CREATE INDEX idx_library_books_isbn ON library_books(isbn);

CREATE INDEX idx_library_copies_book ON library_book_copies(book_id);
CREATE INDEX idx_library_copies_school ON library_book_copies(school_id);
CREATE INDEX idx_library_copies_status ON library_book_copies(status);
CREATE INDEX idx_library_copies_accession ON library_book_copies(accession_number);

CREATE INDEX idx_library_loans_copy ON library_loans(book_copy_id);
CREATE INDEX idx_library_loans_student ON library_loans(student_id);
CREATE INDEX idx_library_loans_school ON library_loans(school_id);
CREATE INDEX idx_library_loans_status ON library_loans(status);
CREATE INDEX idx_library_loans_due_date ON library_loans(due_date);

CREATE INDEX idx_library_fines_loan ON library_fines(loan_id);
CREATE INDEX idx_library_fines_student ON library_fines(student_id);
CREATE INDEX idx_library_fines_school ON library_fines(school_id);
CREATE INDEX idx_library_fines_paid ON library_fines(paid);

-- RLS Policies (Row Level Security)
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;

-- Library Books Policies
CREATE POLICY library_books_select ON library_books FOR SELECT USING (true);
CREATE POLICY library_books_insert ON library_books FOR INSERT WITH CHECK (true);
CREATE POLICY library_books_update ON library_books FOR UPDATE USING (true);
CREATE POLICY library_books_delete ON library_books FOR DELETE USING (true);

-- Library Book Copies Policies
CREATE POLICY library_copies_select ON library_book_copies FOR SELECT USING (true);
CREATE POLICY library_copies_insert ON library_book_copies FOR INSERT WITH CHECK (true);
CREATE POLICY library_copies_update ON library_book_copies FOR UPDATE USING (true);
CREATE POLICY library_copies_delete ON library_book_copies FOR DELETE USING (true);

-- Library Loans Policies
CREATE POLICY library_loans_select ON library_loans FOR SELECT USING (true);
CREATE POLICY library_loans_insert ON library_loans FOR INSERT WITH CHECK (true);
CREATE POLICY library_loans_update ON library_loans FOR UPDATE USING (true);
CREATE POLICY library_loans_delete ON library_loans FOR DELETE USING (true);

-- Library Fines Policies
CREATE POLICY library_fines_select ON library_fines FOR SELECT USING (true);
CREATE POLICY library_fines_insert ON library_fines FOR INSERT WITH CHECK (true);
CREATE POLICY library_fines_update ON library_fines FOR UPDATE USING (true);
CREATE POLICY library_fines_delete ON library_fines FOR DELETE USING (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_library_books_updated_at BEFORE UPDATE ON library_books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_copies_updated_at BEFORE UPDATE ON library_book_copies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_loans_updated_at BEFORE UPDATE ON library_loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_fines_updated_at BEFORE UPDATE ON library_fines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
