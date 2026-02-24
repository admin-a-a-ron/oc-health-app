import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl ? '✓ Present' : '✗ Missing');
console.log('Key:', supabaseKey ? `✓ Present (${supabaseKey.length} chars)` : '✗ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('\nTesting database connection...');
    
    // Try to fetch something simple like tables
    const { data, error } = await supabase
      .from('pg_tables')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Connection error:', error.message);
      
      // Try a different approach - get server info
      const { data: info, error: infoError } = await supabase.rpc('version');
      if (infoError) {
        console.error('RPC error:', infoError.message);
        return false;
      }
      console.log('Server info:', info);
      return true;
    }
    
    console.log('Successfully connected to Supabase!');
    console.log('Sample data:', data);
    return true;
    
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n✅ Supabase connection successful!');
  } else {
    console.log('\n❌ Supabase connection failed.');
  }
  process.exit(success ? 0 : 1);
});