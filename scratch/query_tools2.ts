import { createClient } from '@supabase/supabase-js'; 
const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data, error } = await supabase.from('tools').select('*').ilike('tool_id', '%baby_names%'); 
  console.log(JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    const t = data[0];
    const updatePayload: any = {};
    for (const key of Object.keys(t)) {
      if (typeof t[key] === 'string' && t[key].toLowerCase().includes('choose azerbaijani names')) {
        updatePayload[key] = t[key].replace(/Choose Azerbaijani names/gi, 'Choose Baby Names');
        console.log(`Will update ${key} from "${t[key]}" to "${updatePayload[key]}"`);
      }
    }
    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('tools').update(updatePayload).eq('id', t.id);
      console.log('Successfully updated tools table!');
    }
  }
} 
run();
