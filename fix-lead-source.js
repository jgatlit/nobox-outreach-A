import { db } from './db/index.ts';

async function fixLeadSourceColumn() {
  try {
    console.log('🔧 Fixing lead_source column duplication...');
    
    // First, let's see what we have
    const columns = await db.execute(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'leads' AND column_name IN ('lead_source', 'source')
      ORDER BY column_name
    `);
    
    console.log('📊 Current source columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${col.column_default || ''}`);
    });
    
    // Strategy: Make lead_source nullable and set default, since it seems to be the constraint issue
    console.log('\n🔧 Making lead_source nullable with default...');
    
    // Drop NOT NULL constraint on lead_source
    await db.execute('ALTER TABLE leads ALTER COLUMN lead_source DROP NOT NULL');
    console.log('✅ Dropped NOT NULL constraint on lead_source');
    
    // Set default value for lead_source
    await db.execute("ALTER TABLE leads ALTER COLUMN lead_source SET DEFAULT 'import'");
    console.log('✅ Set default value for lead_source to "import"');
    
    // Update any existing NULL values
    await db.execute("UPDATE leads SET lead_source = 'import' WHERE lead_source IS NULL");
    console.log('✅ Updated any existing NULL values in lead_source');
    
    console.log('🎉 lead_source column fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing lead_source column:', error);
    process.exit(1);
  }
}

fixLeadSourceColumn();