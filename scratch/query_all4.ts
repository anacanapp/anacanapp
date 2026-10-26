import { createClient } from '@supabase/supabase-js'; 
const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data, error } = await supabase.from('vitamins').select('id, name, name_az, dosage'); 
  console.log(JSON.stringify({ data, error }, null, 2));

  // Let's also update the dosage where it contains the turkish error
  if (data) {
    for (const v of data) {
      if (v.dosage && v.dosage.toLowerCase().includes('hata')) {
         await supabase.from('vitamins').update({ dosage: '1 tablet daily (consult doctor)' }).eq('id', v.id);
         console.log('Fixed', v.name);
      }
    }
  }
} 
run();
