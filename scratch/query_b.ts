import { createClient } from '@supabase/supabase-js'; 
const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data } = await supabase.from('vitamins').select('name, dosage, dosage_az').ilike('name', '%B Complex%'); 
  console.log(data);
  
  // Let's also fix it right away
  await supabase.from('vitamins').update({
    dosage_az: 'Gündəlik 1 tablet (həkimlə məsləhətləşin)',
    dosage: '1 tablet daily (consult doctor)'
  }).ilike('name', '%B Complex%');
  
  console.log('Fixed B Complex dosage');
} 
run();
