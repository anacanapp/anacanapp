import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: tools, error } = await supabase.from('tool_configs').select('id, tool_id, description_az, description_en');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const tool of tools) {
    if (tool.tool_id === 'photoshoot') {
      await supabase.from('tool_configs').update({ 
        description_en: 'Create magical photoshoots for your baby' 
      }).eq('id', tool.id);
      console.log('Updated photoshoot');
    }
    if (tool.tool_id === 'recipes') {
      await supabase.from('tool_configs').update({ 
        description_en: 'Healthy and delicious recipes' 
      }).eq('id', tool.id);
      console.log('Updated recipes');
    }
  }
}

main();
