const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tntbjulojatnrqmylorp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  // 1. Read one row
  const { data: readData, error: readErr } = await supabase
    .from('mommy_daily_messages')
    .select('id, day_number, message_en')
    .eq('day_number', 1)
    .maybeSingle();
  
  console.log('READ result:', readData);
  console.log('READ error:', readErr);

  if (!readData) return;

  // 2. Try to update it
  const { data: updateData, error: updateErr, count, status, statusText } = await supabase
    .from('mommy_daily_messages')
    .update({ message_en: 'TEST translation' })
    .eq('id', readData.id)
    .select();
  
  console.log('\nUPDATE result:', updateData);
  console.log('UPDATE error:', updateErr);
  console.log('UPDATE status:', status, statusText);

  // 3. Re-read to verify
  const { data: verifyData } = await supabase
    .from('mommy_daily_messages')
    .select('id, day_number, message_en')
    .eq('id', readData.id)
    .single();
  
  console.log('\nVERIFY after update:', verifyData);
}

test().catch(console.error);
