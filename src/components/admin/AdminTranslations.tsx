import { useState, useMemo, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BookOpen, Download, Upload, Save, Search, Filter, Plus, Database, AlertCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface TranslationRow {
  id: string;
  key: string;
  lang: string;
  value: string;
  namespace: string;
}

const NAMESPACES = [
'common', 'nav', 'tools', 'dashboard', 'settings', 'auth',
'community', 'blog', 'partner', 'ai', 'admin', 'onboarding', 'ai_prompts'];

const HARDCODED_TABLES = [
  'translations',
  'mommy_daily_messages',
  'baby_daily_info',
  'pregnancy_daily_content',
  'weekly_tips',
  'admin_recipes',
  'blog_posts',
  'banners',
  'faqs',
  'exercises',
  'vitamins',
  'vaccines',
  'baby_crisis_periods',
  'teething_care_tips',
  'white_noise_sounds',
  'affiliate_products',
  'age_ranges',
  'ai_suggested_questions'
];

const TABLE_LABELS: Record<string, string> = {
  translations: 'translations (UI tərcümələri)',
  mommy_daily_messages: 'mommy_daily_messages (Anaya gündəlik mesaj)',
  baby_daily_info: 'baby_daily_info (Körpə üçün günlük məlumatlar)',
  pregnancy_daily_content: 'pregnancy_daily_content (Hamiləlik günlük kontenti)',
  weekly_tips: 'weekly_tips (Həftəlik məsləhətlər)',
  admin_recipes: 'admin_recipes (Reseptlər)',
  blog_posts: 'blog_posts (Bloq yazıları)',
  banners: 'banners (Bannerlər)',
  faqs: 'faqs (FAQ / Sual-cavab)',
  exercises: 'exercises (Məşqlər)',
  vitamins: 'vitamins (Vitaminlər)',
  vaccines: 'vaccines (Peyvəndlər)',
  baby_crisis_periods: 'baby_crisis_periods (Kriz dövrləri)',
  teething_care_tips: 'teething_care_tips (Diş çıxarma tövsiyələri)',
  white_noise_sounds: 'white_noise_sounds (Ağ küy səsləri)',
  affiliate_products: 'affiliate_products (Tərəfdaş məhsulları)',
  age_ranges: 'age_ranges (Yaş diapazonları)',
  ai_suggested_questions: 'ai_suggested_questions (Süni intellekt sualları)'
};

const TABLE_PRIMARY_KEYS: Record<string, string> = {
  translations: 'key',
  mommy_daily_messages: 'day_number',
  baby_daily_info: 'day_number',
  pregnancy_daily_content: 'pregnancy_day',
  weekly_tips: 'week_number',
};


const AdminTranslations = () => {
    const localize = useAdminLocalize();
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState('en');
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'empty' | 'filled'>('all');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState({ key: '', namespace: 'common', defaultValue: '' });
  const [showAddKey, setShowAddKey] = useState(false);

  // States for DB Translation Uploader
  const [uploadTable, setUploadTable] = useState('translations');
  const [customTable, setCustomTable] = useState('');
  const [uploadLang, setUploadLang] = useState('en');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  
  // Dynamic uploader key/column selections
  const [idColumn, setIdColumn] = useState('day_number');
  const [selectedUpdateColumns, setSelectedUpdateColumns] = useState<string[]>([]);
  
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Fetch ALL available languages
  const { data: allLanguages = [] } = useQuery({
    queryKey: ['admin-all-languages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_languages')
        .select('code, native_name')
        .order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Fetch ALL tables from database
  const { data: dbTables = [] } = useQuery({
    queryKey: ['admin-db-tables'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('database_tables')
        .select('table_name');
      if (error) {
        console.warn('Failed to load dynamic tables:', error);
        throw error;
      }
      return data.map((d: any) => d.table_name);
    },
    retry: 1,
  });

  const tablesList = useMemo(() => {
    if (dbTables && dbTables.length > 0) {
      // Ensure 'translations' is first, and combine with any hardcoded ones to preserve labels
      const uniqueTables = Array.from(new Set([...dbTables, ...HARDCODED_TABLES]));
      return uniqueTables;
    }
    return HARDCODED_TABLES;
  }, [dbTables]);

  // Fetch columns for selected table
  const { data: dbColumns = [] } = useQuery({
    queryKey: ['admin-db-columns', uploadTable, customTable],
    queryFn: async () => {
      const targetTable = uploadTable === 'custom' ? customTable.trim() : uploadTable;
      if (!targetTable) return [];
      const { data, error } = await (supabase as any)
        .from('database_columns')
        .select('column_name, data_type')
        .eq('table_name', targetTable);
      if (error) throw error;
      return data as { column_name: string; data_type: string }[];
    },
    enabled: !!uploadTable && (uploadTable !== 'custom' || !!customTable),
    retry: false
  });

  // Fetch constraints (primary keys) for selected table
  const { data: dbConstraints = [] } = useQuery({
    queryKey: ['admin-db-constraints', uploadTable, customTable],
    queryFn: async () => {
      const targetTable = uploadTable === 'custom' ? customTable.trim() : uploadTable;
      if (!targetTable) return [];
      const { data, error } = await (supabase as any)
        .from('database_table_constraints')
        .select('column_name, constraint_type')
        .eq('table_name', targetTable);
      if (error) throw error;
      return data as { column_name: string; constraint_type: string }[];
    },
    enabled: !!uploadTable && (uploadTable !== 'custom' || !!customTable),
    retry: false
  });

  const dbIdColumn = useMemo(() => {
    const targetTable = uploadTable === 'custom' ? customTable.trim() : uploadTable;
    
    // Clean target table name
    const table = targetTable.toLowerCase();
    
    // 1. If the user-selected idColumn exists directly in the database columns, use it!
    if (dbColumns && dbColumns.some(c => c.column_name === idColumn)) {
      return idColumn;
    }

    // 2. If the user-selected idColumn exists case-insensitively in the database columns, use that database column!
    if (dbColumns && dbColumns.length > 0) {
      const matchedDbCol = dbColumns.find(c => c.column_name.toLowerCase() === idColumn.toLowerCase());
      if (matchedDbCol) return matchedDbCol.column_name;
    }

    // 3. Try to match by guessing from CSV column name
    if (dbColumns && dbColumns.length > 0) {
      const dbColNames = dbColumns.map(c => c.column_name);
      
      if (idColumn.toLowerCase() === 'day' || idColumn.toLowerCase() === 'day_number') {
        if (dbColNames.includes('day_number')) return 'day_number';
        if (dbColNames.includes('pregnancy_day')) return 'pregnancy_day';
      }
      if (idColumn.toLowerCase() === 'week' || idColumn.toLowerCase() === 'week_number') {
        if (dbColNames.includes('week_number')) return 'week_number';
      }
    }

    // 4. Hardcoded logical key mappings for daily content tables as a fallback
    if (table === 'mommy_daily_messages' || table === 'baby_daily_info') {
      return 'day_number';
    }
    if (table === 'pregnancy_daily_content') {
      return 'pregnancy_day';
    }
    if (table === 'weekly_tips') {
      return 'week_number';
    }
    if (table === 'translations') {
      return 'key';
    }

    // 5. Try to find primary key from database constraints
    if (dbConstraints && dbConstraints.length > 0) {
      const pk = dbConstraints.find(c => c.constraint_type === 'PRIMARY KEY');
      if (pk) return pk.column_name;
      return dbConstraints[0].column_name;
    }

    // Default fallback
    return TABLE_PRIMARY_KEYS[targetTable] || 'id';
  }, [dbConstraints, dbColumns, uploadTable, customTable, idColumn, parsedRows]);

  // Reset preview and selections on table change
  useEffect(() => {
    setUploadFile(null);
    setParsedRows([]);
    setCsvColumns([]);
    setSelectedUpdateColumns([]);
    
    // Initial guess for default ID column based on table name
    const targetTable = uploadTable === 'custom' ? customTable.trim() : uploadTable;
    if (targetTable === 'translations') {
      setIdColumn('key');
    } else if (targetTable === 'pregnancy_daily_content') {
      setIdColumn('pregnancy_day');
    } else {
      setIdColumn('day_number');
    }
  }, [uploadTable, customTable]);

  // Auto-guess ID column when parsedRows or database constraints change
  useEffect(() => {
    if (parsedRows.length === 0) return;
    const csvCols = Object.keys(parsedRows[0]);
    
    // 1. Try to find a primary key from the database that is also in the CSV
    const dbPk = dbConstraints.find(c => csvCols.includes(c.column_name));
    if (dbPk) {
      setIdColumn(dbPk.column_name);
      return;
    }

    // 2. Fall back to hardcoded guesses (looping over guess priority first to avoid matching surrogate 'id' first)
    const idGuesses = ['day_number', 'pregnancy_day', 'key', 'id', 'code', 'day', 'week_number'];
    const matchedId = idGuesses.find(guess => 
      csvCols.some(c => c.toLowerCase() === guess.toLowerCase())
    );
    
    // Find the exact casing of the column in the CSV
    const exactMatchedCol = matchedId 
      ? csvCols.find(c => c.toLowerCase() === matchedId.toLowerCase()) 
      : null;

    if (exactMatchedCol) {
      setIdColumn(exactMatchedCol);
    } else {
      setIdColumn(csvCols[0] || 'id');
    }
  }, [parsedRows, dbConstraints]);

  const availableCsvColumns = useMemo(() => {
    if (parsedRows.length === 0) return [];
    const csvCols = Object.keys(parsedRows[0]);
    
    if (dbColumns && dbColumns.length > 0) {
      // Filter CSV columns to only those that exist in the database
      const dbColNames = dbColumns.map(c => c.column_name);
      return csvCols.filter(col => dbColNames.includes(col));
    }
    
    return csvCols;
  }, [parsedRows, dbColumns]);

  // Auto-select update columns when file is parsed or language / table changes
  useEffect(() => {
    if (parsedRows.length === 0) return;
    const csvCols = Object.keys(parsedRows[0]);
    
    // Filter to columns that exist in the database (or all if dbColumns is empty)
    const validCols = dbColumns.length > 0 
      ? csvCols.filter(c => dbColumns.some(dbc => dbc.column_name === c)) 
      : csvCols;

    const suffix = `_${uploadLang}`;
    const guessedUpdateCols = validCols.filter(c => 
      c.toLowerCase().endsWith(suffix.toLowerCase()) || 
      (uploadTable === 'translations' && (c === 'value' || c === 'value_en'))
    );
    
    setSelectedUpdateColumns(
      guessedUpdateCols.length > 0 
        ? guessedUpdateCols 
        : validCols.filter(c => c !== idColumn)
    );
  }, [parsedRows, uploadLang, uploadTable, dbColumns, idColumn]);

  const parseCSV = (text: string): Record<string, string>[] => {
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
    const header = rows.shift();
    if (!header) return [];
    
    // Clean headers from BOM or extra whitespace
    const cleanHeader = header.map(h => h.replace(/^\uFEFF/, '').trim());

    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""))
      .map(r => Object.fromEntries(cleanHeader.map((h, i) => [h, r[i] ?? ""])));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setUploadResults(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('Faylda heç bir məlumat tapılmadı.');
        return;
      }
      
      const cols = Object.keys(rows[0]);
      setCsvColumns(cols);
      setParsedRows(rows);
      
      toast.success(`Fayl oxundu: ${rows.length} sətir tapıldı.`);
    } catch (err: any) {
      toast.error(`Fayl oxunarkən xəta: ${err.message}`);
    }
  };

  const handleDbUpload = async () => {
    if (parsedRows.length === 0) {
      toast.error('Zəhmət olmasa əvvəlcə CSV faylı yükləyin');
      return;
    }

    const castFieldValue = (valStr: string, dbCol?: { data_type: string }) => {
      const trimmed = valStr.trim();
      if (dbCol) {
        const type = dbCol.data_type.toLowerCase();
        if (type.includes('int') || type.includes('num') || type.includes('double') || type.includes('real')) {
          return trimmed === '' ? null : Number(trimmed);
        } else if (type.includes('bool')) {
          return trimmed === '' ? null : (trimmed.toLowerCase() === 'true' || trimmed === '1');
        } else if (type.includes('array') || type.includes('[]') || type.startsWith('_')) {
          try {
            return trimmed === '' ? null : JSON.parse(trimmed);
          } catch (e) {
            return trimmed === '' ? null : trimmed.split(',').map(s => s.trim());
          }
        } else {
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              return JSON.parse(trimmed);
            } catch (e) {
              return trimmed;
            }
          }
          return trimmed;
        }
      } else {
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            return trimmed;
          }
        }
        return trimmed;
      }
    };

    const targetTable = uploadTable === 'custom' ? customTable.trim() : uploadTable;
    if (!targetTable) {
      toast.error('Zəhmət olmasa hədəf cədvəl adını daxil edin');
      return;
    }

    if (!idColumn) {
      toast.error('Zəhmət olmasa ID sütununu seçin');
      return;
    }

    if (selectedUpdateColumns.length === 0) {
      toast.error('Zəhmət olmasa yenilənəcək sütunları seçin');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults({
      total: parsedRows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    });

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // 1. Fetch existing rows (selecting ID and update columns to optimize) - Paginated to bypass 1000 limit
      const allDbData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        let pageQuery: any = (supabase as any)
          .from(targetTable)
          .select([dbIdColumn, ...selectedUpdateColumns].join(', '))
          .range(from, from + pageSize - 1);
          
        if (targetTable === 'translations') {
          pageQuery = pageQuery.eq('lang', uploadLang);
        }

        const { data: page, error: pageErr } = await pageQuery;
        
        if (pageErr) {
          throw new Error(`Məlumat bazasından oxuma xətası: ${pageErr.message}`);
        }
        
        if (!page || page.length === 0) break;
        allDbData.push(...page);
        
        if (page.length < pageSize) break;
        from += pageSize;
      }

      const dbData = allDbData;

      const dbMap = new Map(dbData?.map(r => [String(r[dbIdColumn]), r]) || []);

      const batchSize = 100;
      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize);
        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const item of batch) {
          const idVal = (item[idColumn] || '').trim();
          if (!idVal) {
            failed++;
            errors.push(`ID dəyəri boş olan sətir keçildi`);
            continue;
          }

          // Also skip if the dbIdColumn is numeric and the value can't be parsed
          if (['day_number', 'pregnancy_day', 'week_number'].includes(dbIdColumn) || 
              (dbColumns.find(c => c.column_name === dbIdColumn)?.data_type || '').toLowerCase().includes('int')) {
            const numVal = parseInt(idVal);
            if (isNaN(numVal)) {
              failed++;
              errors.push(`ID dəyəri rəqəm deyil (${dbIdColumn}: "${idVal}") – sətir keçildi`);
              continue;
            }
          }

          // Build fields dictionary with casting
          const fields: Record<string, any> = {};
          selectedUpdateColumns.forEach(col => {
            if (item[col] !== undefined) {
              const valStr = item[col];
              const dbCol = dbColumns.find(c => c.column_name === col);
              fields[col] = castFieldValue(valStr, dbCol);
            }
          });

          // Check if exists
          if (dbMap.has(idVal)) {
            const dbRow = dbMap.get(idVal);
            const updateFields: Record<string, any> = {};
            let hasUpdates = false;

            selectedUpdateColumns.forEach(col => {
              const csvVal = fields[col];
              const dbVal = dbRow ? dbRow[col] : null;

              // Strict "eyni olanlara dəyməsin" - only update if database field is empty/null, and CSV has a value
              const isEmptyDb = dbVal === null || dbVal === undefined || dbVal === '';
              const hasCsvVal = csvVal !== null && csvVal !== undefined && csvVal !== '';

              if (isEmptyDb && hasCsvVal) {
                updateFields[col] = csvVal;
                hasUpdates = true;
              }
            });

            if (hasUpdates) {
              toUpdate.push({ idVal, ...updateFields });
            } else {
              skipped++;
            }
          } else {
            // New record insertion
            const dbIdCol = dbColumns.find(c => c.column_name === dbIdColumn);
            let castedIdVal: any = idVal;
            if (dbIdCol) {
              const type = dbIdCol.data_type.toLowerCase();
              if (type.includes('int') || type.includes('num') || type.includes('double') || type.includes('real')) {
                castedIdVal = parseInt(idVal);
              }
            } else {
              if (dbIdColumn === 'day_number' || dbIdColumn === 'pregnancy_day' || dbIdColumn === 'week_number') {
                castedIdVal = parseInt(idVal);
              }
            }

            const insertFields: Record<string, any> = {
              [dbIdColumn]: castedIdVal,
              ...fields
            };

            // For inserts, also include ALL other CSV columns that exist in the DB
            // (not just selectedUpdateColumns) to avoid NOT NULL constraint violations
            const dbColNames = dbColumns.map(c => c.column_name);
            Object.keys(item).forEach(csvCol => {
              if (csvCol === idColumn) return; // already set via dbIdColumn
              if (insertFields[csvCol] !== undefined) return; // already set
              if (dbColNames.length > 0 && !dbColNames.includes(csvCol)) return; // not in DB

              // Prevent inserting 'id' if it's not the matching column (avoids unique constraint errors when users copy-paste rows in CSV)
              if (csvCol === 'id' && dbIdColumn !== 'id') return;

              const val = item[csvCol];
              const dbCol = dbColumns.find(c => c.column_name === csvCol);
              insertFields[csvCol] = castFieldValue(val, dbCol);
            });

            // Set default is_active if column exists in schema
            if (item.is_active !== undefined) {
              insertFields['is_active'] = item.is_active !== 'false' && item.is_active !== false;
            }

            // Set lang if translations table
            if (targetTable === 'translations') {
              insertFields['lang'] = uploadLang;
            }

            toInsert.push(insertFields);
          }
        }

        // Execute inserts in batch
        if (toInsert.length > 0) {
          const { error: insErr } = await (supabase as any).from(targetTable).insert(toInsert);
          if (insErr) {
            failed += toInsert.length;
            errors.push(`Insert xətası: ${insErr.message}`);
          } else {
            inserted += toInsert.length;
          }
        }

        // Execute updates one by one
        if (toUpdate.length > 0) {
          const updatePromises = toUpdate.map(async (up) => {
            const { idVal, ...fieldsToUpdate } = up;
            
            const dbIdCol = dbColumns.find(c => c.column_name === dbIdColumn);
            let castedIdVal: any = idVal;
            if (dbIdCol) {
              const type = dbIdCol.data_type.toLowerCase();
              if (type.includes('int') || type.includes('num') || type.includes('double') || type.includes('real')) {
                castedIdVal = parseInt(idVal);
              }
            } else {
              if (dbIdColumn === 'day_number' || dbIdColumn === 'pregnancy_day' || dbIdColumn === 'week_number') {
                castedIdVal = parseInt(idVal);
              }
            }

            const updatePayload: Record<string, any> = { ...fieldsToUpdate };
            const hasUpdatedAt = dbColumns.some(c => c.column_name === 'updated_at');
            if (hasUpdatedAt) {
              updatePayload['updated_at'] = new Date().toISOString();
            }

            const { error: updErr } = await (supabase as any)
              .from(targetTable)
              .update(updatePayload)
              .eq(dbIdColumn, castedIdVal);
            if (updErr) {
              failed++;
              errors.push(`Update xətası (${dbIdColumn}: ${idVal}): ${updErr.message}`);
            } else {
              updated++;
            }
          });
          await Promise.all(updatePromises);
        }

        setUploadProgress(Math.min(100, Math.round(((i + batch.length) / parsedRows.length) * 100)));
        setUploadResults({
          total: parsedRows.length,
          inserted,
          updated,
          skipped,
          failed,
          errors: errors.slice(0, 10)
        });
      }
      toast.success('Yükləmə tamamlandı!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Xəta baş verdi: ${err.message}`);
      errors.push(err.message);
    } finally {
      setUploading(false);
      queryClient.invalidateQueries();
    }
  };

  // Fetch available languages (non-az)
  const { data: languages = [] } = useQuery({
    queryKey: ['admin-languages-for-translations'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('app_languages').
      select('code, native_name').
      neq('code', 'az').
      order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Fetch translations for selected language
  const { data: translations = [], isLoading } = useQuery({
    queryKey: ['admin-translations', selectedLang],
    queryFn: async () => {
      let query = supabase.
      from('translations').
      select('*').
      eq('lang', selectedLang).
      order('namespace').
      order('key');

      const allData: TranslationRow[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (data) allData.push(...(data as TranslationRow[]));
        hasMore = (data?.length ?? 0) === batchSize;
        from += batchSize;
      }

      return allData;
    },
    enabled: !!selectedLang
  });

  const filtered = useMemo(() => {
    let result = translations;
    if (selectedNamespace !== 'all') {
      result = result.filter((t) => t.namespace === selectedNamespace);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.key.toLowerCase().includes(q) || t.value.toLowerCase().includes(q));
    }
    if (filterMode === 'empty') {
      result = result.filter((t) => !t.value);
    } else if (filterMode === 'filled') {
      result = result.filter((t) => !!t.value);
    }
    return result;
  }, [translations, selectedNamespace, searchQuery, filterMode]);

  const saveTranslation = useMutation({
    mutationFn: async ({ id, value }: {id: string;value: string;}) => {
      const { error } = await supabase.
      from('translations').
      update({ value, updated_at: new Date().toISOString() }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-translations', selectedLang] });
    }
  });

  const saveAll = async () => {
    const entries = Object.entries(editedValues);
    if (entries.length === 0) return;

    let saved = 0;
    for (const [id, value] of entries) {
      try {
        await saveTranslation.mutateAsync({ id, value });
        saved++;
      } catch {/* skip */}
    }
    setEditedValues({});
    toast.success(`${saved} tərcümə yadda saxlanıldı`);
  };

  const addTranslationKey = useMutation({
    mutationFn: async () => {
      // Add for all non-az languages
      const langs = languages.map((l) => l.code);
      const inserts = langs.map((lang) => ({
        key: newKey.key.trim(),
        lang,
        value: '',
        namespace: newKey.namespace
      }));
      const { error } = await supabase.from('translations').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-translations'] });
      setShowAddKey(false);
      setNewKey({ key: '', namespace: 'common', defaultValue: '' });
      toast.success(tr("admintranslations_acar_elave_edildi_15fb4c", "A\xE7ar \u0259lav\u0259 edildi"));
    },
    onError: (err) => toast.error((err as Error).message)
  });

  // CSV Export
  const handleExport = () => {
    const rows = [['key', 'namespace', 'value'].join(',')];
    translations.forEach((t) => {
      rows.push([
      `"${t.key}"`,
      `"${t.namespace}"`,
      `"${(t.value || '').replace(/"/g, '""')}"`].
      join(','));
    });
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations_${selectedLang}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').slice(1); // skip header
      let imported = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        // Simple CSV parse: key,namespace,value
        const match = line.match(/^"?([^",]+)"?,\s*"?([^",]+)"?,\s*"?(.*)"?$/);
        if (!match) continue;

        const [, key, namespace, value] = match;
        const cleanValue = value.replace(/""/g, '"').replace(/"$/, '');

        const { error } = await supabase.
        from('translations').
        upsert(
          { key: key.trim(), lang: selectedLang, value: cleanValue, namespace: namespace.trim() },
          { onConflict: 'key,lang' }
        );
        if (!error) imported++;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-translations', selectedLang] });
      toast.success(`${imported} tərcümə idxal edildi`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filledCount = translations.filter((t) => !!t.value).length;
  const totalCount = translations.length;
  const progress = totalCount > 0 ? Math.round(filledCount / totalCount * 100) : 0;

  return (
    <Tabs defaultValue="list" className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
        <TabsList>
          <TabsTrigger value="list">{tr("admintranslations_tercume_siyahisi_tab", "Tərcümə Siyahısı")}</TabsTrigger>
          <TabsTrigger value="upload">{tr("admintranslations_verilenler_bazasi_yukle_tab", "Verilənlər Bazasına Dil Yüklə")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="list" className="space-y-6 mt-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">{tr("admintranslations_tercumeler_f31ad6", "Tərcümələr")}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowAddKey(!showAddKey)}>
                <Plus className="w-4 h-4 me-1" /> {tr("admintranslations_acar_644193", "Açarlar")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 me-1" /> CSV İxrac
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="w-4 h-4 me-1" />{tr("admintranslations_csv_idxal_f88021", "CSV İdxal")}</span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              {Object.keys(editedValues).length > 0 &&
              <Button size="sm" onClick={saveAll}>
                  <Save className="w-4 h-4 me-1" /> {tr("admintranslations_hamisini_saxla_7a6f24", "Hamısını Saxla (")}{Object.keys(editedValues).length})
                </Button>
              }
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-40">
              <Label>Dil</Label>
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {languages.map((l) =>
                  <SelectItem key={l.code} value={l.code}>{l.native_name} ({l.code})</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label>Namespace</Label>
              <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("admintranslations_hamisi_c73c4d", "Hamısı")}</SelectItem>
                  {NAMESPACES.map((ns) =>
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label>Filtr</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as typeof filterMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("admintranslations_hamisi_c73c4d", "Hamısı")}</SelectItem>
                  <SelectItem value="empty">{tr("admintranslations_bos_485510", "Boş")}</SelectItem>
                  <SelectItem value="filled">Dolu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Axtar</Label>
              <div className="relative">
                <Search className="absolute start-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="ps-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={tr("admintranslations_acar_ve_ya_deyer_axtar_7422e0", "Açar və ya dəyər axtar...")} />
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">{filledCount}/{totalCount} ({progress}%)</span>
          </div>

          {/* Add Key Form */}
          {showAddKey &&
          <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{tr("admintranslations_acar_644193", "Açar")}</Label>
                    <Input value={newKey.key} onChange={(e) => setNewKey((p) => ({ ...p, key: e.target.value }))} placeholder="nav.home" />
                  </div>
                  <div>
                    <Label>Namespace</Label>
                    <Select value={newKey.namespace} onValueChange={(v) => setNewKey((p) => ({ ...p, namespace: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NAMESPACES.map((ns) => <SelectItem key={ns} value={ns}>{ns}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tr("admintranslations_az_deyeri_referans_814983", "AZ Dəyəri (referans)")}</Label>
                    <Input value={newKey.defaultValue} onChange={(e) => setNewKey((p) => ({ ...p, defaultValue: e.target.value }))} placeholder={tr("admintranslations_esas_6d87f7", "Əsas")} />
                  </div>
                </div>
                <Button onClick={() => addTranslationKey.mutate()} disabled={!newKey.key} size="sm">
                  {tr("admintranslations_butun_dillere_elave_et_422b49", "Bütün dillərə əlavə et")}
                </Button>
              </CardContent>
            </Card>
          }

          {/* Translation List */}
          {isLoading ?
          <div className="text-center py-8 text-muted-foreground">{tr("admintranslations_yuklenir_5557de", "Yüklənir...")}</div> :
          filtered.length === 0 ?
          <div className="text-center py-8 text-muted-foreground">{tr("admintranslations_tercume_tapilmadi_6b4f34", "Tərcümə tapılmadı")}</div> :

          <div className="space-y-2">
              {filtered.map((t) =>
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.key}</code>
                      <Badge variant="outline" className="text-[10px]">{t.namespace}</Badge>
                    </div>
                    <Textarea
                  className="text-sm min-h-[36px] resize-none"
                  value={editedValues[t.id] !== undefined ? editedValues[t.id] : t.value}
                  onChange={(e) => setEditedValues((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder={tr("admintranslations_tercumeni_daxil_edin_3e150c", "Tərcüməni daxil edin...")}
                  rows={1} />
                
                  </div>
                  {editedValues[t.id] !== undefined &&
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await saveTranslation.mutateAsync({ id: t.id, value: editedValues[t.id] });
                  setEditedValues((prev) => {
                    const next = { ...prev };
                    delete next[t.id];
                    return next;
                  });
                  toast.success(tr("admintranslations_saxlanildi_66ffe7", "Saxlanıldı"));
                }}>
                
                      <Save className="w-4 h-4" />
                    </Button>
              }
                </div>
            )}
            </div>
          }
        </div>
      </TabsContent>

      <TabsContent value="upload" className="mt-0">
        <Card className="border-border/50">
          <CardContent className="pt-6 space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl text-sm flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Mühüm Xəbərdarlıq ("Eyni olanlara dəyməsin")</h4>
                <p className="leading-relaxed">
                  Bu alət verilənlər bazasındakı mövcud yazıları qoruyur. Seçilmiş dil sütunlarında (məsələn, <code>message_en</code> və ya <code>info_en</code>) artıq mətn varsa, o dəyişdirilməyəcək (üzərindən yazılmayacaq). Yalnız həmin sütun boş (NULL və ya boş sətir) olduqda və ya yeni sətir əlavə edildikdə məlumat yazılacaq.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hədəf Cədvəl</Label>
                <Select value={uploadTable} onValueChange={setUploadTable}>
                  <SelectTrigger><SelectValue placeholder="Cədvəl seçin" /></SelectTrigger>
                  <SelectContent>
                    {tablesList.map(table => (
                      <SelectItem key={table} value={table}>
                        {TABLE_LABELS[table] || table}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">-- Digər (Cədvəl adını əllə yazın) --</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uploadTable === 'custom' && (
                <div className="space-y-2">
                  <Label>Cədvəl Adı (Database Table Name)</Label>
                  <Input 
                    placeholder="Məs: affiliate_products" 
                    value={customTable} 
                    onChange={(e) => setCustomTable(e.target.value)} 
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Hədəf Dil</Label>
                <Select value={uploadLang} onValueChange={setUploadLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allLanguages.map((l: any) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.native_name} ({l.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>CSV / Excel (CSV formatlı) Faylı Seçin</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {uploadFile && (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg space-y-1">
                  <div><strong>Fayl adı:</strong> {uploadFile.name}</div>
                  <div><strong>Tapılan sətirlər:</strong> {parsedRows.length}</div>
                  <div><strong>Sütunlar:</strong> {csvColumns.join(', ')}</div>
                </div>
              )}
            </div>

            {parsedRows.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl bg-card">
                <div className="space-y-2">
                  <Label>ID / Unikal Açar Sütunu (Primary Key)</Label>
                  <Select value={idColumn} onValueChange={setIdColumn}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {csvColumns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Sətirləri verilənlər bazasındakı uyğun qeydlərlə eşləşdirmək üçün istifadə olunur.</p>
                </div>

                <div className="space-y-2">
                  <Label>Yüklənəcək / Yenilənəcək Sütunlar</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border p-3 rounded-lg bg-muted/20">
                    {availableCsvColumns.map(col => {
                      if (col === idColumn) return null;
                      return (
                        <div key={col} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`col-chk-${col}`}
                            checked={selectedUpdateColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUpdateColumns([...selectedUpdateColumns, col]);
                              } else {
                                setSelectedUpdateColumns(selectedUpdateColumns.filter(c => c !== col));
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <label htmlFor={`col-chk-${col}`} className="text-xs font-medium cursor-pointer">
                            {col}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {csvColumns.some(c => !availableCsvColumns.includes(c)) && (
                    <p className="text-[10px] text-amber-500 font-semibold mt-1">
                      ⚠️ Diqqət: CSV-dəki bəzi sütunlar verilənlər bazasında yoxdur və keçiləcək: {' '}
                      {csvColumns.filter(c => !availableCsvColumns.includes(c)).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Seçilmiş sütunlardakı mətnlər verilənlər bazasına yüklənəcək.</p>
                </div>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Yüklənir...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadResults && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-muted/40 rounded-xl">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Cəmi</div>
                  <div className="text-lg font-bold">{uploadResults.total}</div>
                </div>
                <div className="text-center text-emerald-600 dark:text-emerald-400">
                  <div className="text-xs text-muted-foreground font-semibold">Yeni yaradılan</div>
                  <div className="text-lg font-bold">{uploadResults.inserted}</div>
                </div>
                <div className="text-center text-blue-600 dark:text-blue-400">
                  <div className="text-xs text-muted-foreground font-semibold">Yenilənən sütun</div>
                  <div className="text-lg font-bold">{uploadResults.updated}</div>
                </div>
                <div className="text-center text-amber-600 dark:text-amber-400">
                  <div className="text-xs text-muted-foreground font-semibold">Dəyişməyən (Keçilən)</div>
                  <div className="text-lg font-bold">{uploadResults.skipped}</div>
                </div>
                <div className="text-center text-destructive">
                  <div className="text-xs text-muted-foreground font-semibold">Uğursuz</div>
                  <div className="text-lg font-bold">{uploadResults.failed}</div>
                </div>
              </div>
            )}

            {uploadResults && uploadResults.errors.length > 0 && (
              <div className="space-y-1 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-mono">
                <div className="font-semibold mb-1">Xətalar (Maks 10):</div>
                {uploadResults.errors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}

            <Button
              onClick={handleDbUpload}
              disabled={uploading || parsedRows.length === 0}
              className="w-full gradient-primary gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Yüklənir...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Verilənlər Bazasına Göndər
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default AdminTranslations;