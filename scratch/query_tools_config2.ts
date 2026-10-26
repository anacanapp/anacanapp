import { createClient } from '@supabase/supabase-js'; 

const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data, error } = await supabase.from('tool_configs').select('*').ilike('tool_id', '%baby_names%'); 
  console.log(JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    const t = data[0];
    const updatePayload: any = {};
    for (const key of Object.keys(t)) {
      if (typeof t[key] === 'string' && t[key].toLowerCase().includes('azerbaijani names')) {
        updatePayload[key] = t[key].replace(/Choose Azerbaijani names/gi, 'Choose Baby Names');
        updatePayload[key] = updatePayload[key].replace(/Azerbaijani names/gi, 'Baby Names');
        console.log(`Will update tool ${t.tool_id} key ${key} from "${t[key]}" to "${updatePayload[key]}"`);
      }
    }
    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('tool_configs').update(updatePayload).eq('id', t.id);
      console.log(`Successfully updated ${t.tool_id}!`);
    }
  }
} 
run();
