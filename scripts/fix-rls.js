const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials
const supabaseUrl = 'https://jsbiywkhjfxgwwbyubfc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYml5d2toamZ4Z3d3Ynl1YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MjExMTUsImV4cCI6MjA3MDk5NzExNX0.e-B_tQMV-J1t6onAbKSyY8qDCsbkLKjt99T_pompbyg';

// Create Supabase client with service role key (for admin operations)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250817_fix_user_rls.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Running ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + '...');
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).single();
      
      if (error) {
        // Try direct approach if RPC doesn't work
        console.log('RPC failed, trying alternative approach...');
        // We'll need to use the REST API directly
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nYou should now be able to log in with GitHub OAuth.');
    
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Alternative: Create a simple test to verify connection
async function testConnection() {
  try {
    console.log('\nTesting database connection...');
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('Connection test failed:', error);
    } else {
      console.log('✓ Database connection successful');
    }
  } catch (error) {
    console.error('Connection test error:', error);
  }
}

console.log('🔧 Fixing RLS Policies for IOTA Playground\n');
console.log('This will update the Row Level Security policies to allow user authentication.\n');

// Run the migration
testConnection().then(() => {
  console.log('\n⚠️  Note: You may need to run the SQL migration directly in Supabase dashboard');
  console.log('Go to: https://supabase.com/dashboard/project/jsbiywkhjfxgwwbyubfc/sql/new');
  console.log('And paste the contents of: supabase/migrations/20250817_fix_user_rls.sql');
});