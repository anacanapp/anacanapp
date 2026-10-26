import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Job {
  bucket: string;
  path: string;
  table: string;
  conflict: string;
  intCols?: string[];
  numCols?: string[];
  boolCols?: string[];
  arrayCols?: string[];
  skipCols?: string[]; // columns to drop from CSV before upsert
}

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const header = rows.shift()!;
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function coerce(row: Record<string, string>, job: Job): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (job.skipCols?.includes(k)) continue;
    if (v === "" || v === undefined) { out[k] = null; continue; }
    if (job.intCols?.includes(k)) { out[k] = parseInt(v, 10); continue; }
    if (job.numCols?.includes(k)) { out[k] = parseFloat(v); continue; }
    if (job.boolCols?.includes(k)) { out[k] = String(v).toLowerCase() === "true"; continue; }
    if (job.arrayCols?.includes(k)) {
      // Postgres array literal like {a,b,c} or JSON
      const s = v.trim();
      if (s.startsWith("{") && s.endsWith("}")) {
        const inner = s.slice(1, -1);
        out[k] = inner === "" ? [] : inner.split(",").map(x => x.replace(/^"|"$/g, ""));
      } else if (s.startsWith("[")) {
        try { out[k] = JSON.parse(s); } catch { out[k] = [s]; }
      } else out[k] = [s];
      continue;
    }
    out[k] = v;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jobs: Job[] = [
    {
      bucket: "assets", path: "csv-import/baby_daily_info.csv",
      table: "baby_daily_info", conflict: "id",
      intCols: ["day_number"], boolCols: ["is_active"],
      skipCols: ["created_at", "updated_at"],
    },
    {
      bucket: "assets", path: "csv-import/mommy_daily_messages.csv",
      table: "mommy_daily_messages", conflict: "id",
      intCols: ["day_number"], boolCols: ["is_active"],
      skipCols: ["created_at", "updated_at"],
    },
    {
      bucket: "assets", path: "csv-import/mommy_day_notifications.csv",
      table: "mommy_day_notifications", conflict: "id",
      intCols: ["day_number"], boolCols: ["is_active"],
      skipCols: ["created_at", "updated_at"],
    },
    {
      bucket: "assets", path: "csv-import/pregnancy_day_notifications.csv",
      table: "pregnancy_day_notifications", conflict: "id",
      intCols: ["day_number"], boolCols: ["is_active"],
      skipCols: ["created_at", "updated_at"],
    },
    {
      bucket: "assets", path: "csv-import/pregnancy_daily_content.csv",
      table: "pregnancy_daily_content", conflict: "id",
      intCols: ["week_number", "day_number", "pregnancy_day", "days_until_birth"],
      numCols: ["baby_size_cm", "baby_weight_gram"],
      boolCols: ["is_active"],
      arrayCols: ["mother_symptoms", "recommended_foods", "foods_to_avoid", "recommended_exercises", "tests_to_do"],
      skipCols: ["created_at", "updated_at"],
    },
  ];

  const results: any[] = [];

  for (const job of jobs) {
    try {
      const { data: file, error: dlErr } = await supabase.storage.from(job.bucket).download(job.path);
      if (dlErr || !file) { results.push({ table: job.table, error: dlErr?.message ?? "download failed" }); continue; }
      const text = await file.text();
      const rawRows = parseCSV(text);
      const rows = rawRows.map(r => coerce(r, job));

      let inserted = 0;
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from(job.table).upsert(batch, { onConflict: job.conflict });
        if (error) { results.push({ table: job.table, batchStart: i, error: error.message }); break; }
        inserted += batch.length;
      }
      results.push({ table: job.table, total: rows.length, upserted: inserted });
    } catch (e: any) {
      results.push({ table: job.table, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
