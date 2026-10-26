import { createClient } from '@supabase/supabase-js'; 
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function run() { 
  const { data, error } = await supabase.from('tool_configs').select('*').ilike('tool_id', '%cry%'); 
  console.log(JSON.stringify(data, null, 2));
} 
run();
