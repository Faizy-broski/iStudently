import { sql } from '../src/db';

async function runMigration() {
  console.log('🔄 Running migration: add_default_field_orders...');

  try {
    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS public.default_field_orders (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('student', 'parent', 'teacher')),
        category_id VARCHAR(100) NOT NULL,
        field_label VARCHAR(255) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(school_id, entity_type, category_id, field_label)
      )
    `;

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_default_field_orders_school 
        ON public.default_field_orders(school_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_default_field_orders_entity_type 
        ON public.default_field_orders(entity_type)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_default_field_orders_lookup 
        ON public.default_field_orders(school_id, entity_type, category_id)
    `;

    // Enable RLS
    await sql`
      ALTER TABLE public.default_field_orders ENABLE ROW LEVEL SECURITY
    `;

    // Drop existing policy if it exists
    await sql`
      DROP POLICY IF EXISTS default_field_orders_policy ON public.default_field_orders
    `;

    // Create RLS policy
    await sql`
      CREATE POLICY default_field_orders_policy ON public.default_field_orders
        FOR ALL
        USING (
          school_id IN (
            SELECT s.id FROM public.schools s
            WHERE s.id = school_id
          )
        )
    `;

    // Create update trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_default_field_orders_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    // Drop existing trigger if it exists
    await sql`
      DROP TRIGGER IF EXISTS trigger_update_default_field_orders_updated_at 
        ON public.default_field_orders
    `;

    // Create trigger
    await sql`
      CREATE TRIGGER trigger_update_default_field_orders_updated_at
        BEFORE UPDATE ON public.default_field_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_default_field_orders_updated_at()
    `;

    // Grant permissions
    await sql`
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_field_orders TO authenticated
    `;

    console.log('✅ Migration completed successfully: default_field_orders table created');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
