import { createClient } from '@supabase/supabase-js'; 

const supabase = createClient('https://tntbjulojatnrqmylorp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU'); 

async function run() { 
  const { data, error } = await supabase.from('tool_configs').select('*').ilike('tool_id', '%cry-translator%'); 

  if (data && data.length > 0) {
    const t = data[0];
    await supabase.from('tool_configs').update({
      display_name_az: 'Ağlama Analizi',
      name_az: 'Ağlama Analizi',
      display_name_en: 'Cry Analysis',
      name_en: 'Cry Analysis'
    }).eq('id', t.id);
    console.log('Fixed cry analysis name AZ and EN');
  }
} 
run();
