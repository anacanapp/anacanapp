import { createClient } from '@supabase/supabase-js'; 
const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data, error } = await supabase.from('vitamins').select('*').ilike('name', '%B Complex%'); 
  console.log(JSON.stringify({ data, error }, null, 2));

  // If there's any Turkish error, let's fix it
  if (data && data.length > 0) {
    const v = data[0];
    const updatePayload: any = {};
    for (const key of Object.keys(v)) {
      if (typeof v[key] === 'string' && v[key].toLowerCase().includes('hata')) {
        console.log(`Found 'hata' in ${key}`);
        updatePayload[key] = '1 tablet daily (consult doctor)'; // Fallback fix
      }
    }
    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('vitamins').update(updatePayload).eq('id', v.id);
      console.log('Fixed B Complex error fields', updatePayload);
    }
  }
} 
run();
