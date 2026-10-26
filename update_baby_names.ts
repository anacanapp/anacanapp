import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

async function run() {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .ilike('prompt_text_en', '%Azerbaijani%');
    
  console.log('Query result:', data, error);
  
  if (data && data.length > 0) {
    for (const tool of data) {
      if (tool.prompt_text_en?.includes('Azerbaijani')) {
        const newText = tool.prompt_text_en.replace(/Choose Azerbaijani names/gi, 'Choose baby names');
        const { error: updateError } = await supabase
          .from('tools')
          .update({ prompt_text_en: newText })
          .eq('id', tool.id);
        console.log(`Updated ${tool.id}:`, updateError || 'Success');
      }
    }
  }
}

run().catch(console.error);
