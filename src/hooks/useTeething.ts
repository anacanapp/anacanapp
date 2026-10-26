import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useChildren } from './useChildren';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface BabyTooth {
  id: string;
  tooth_code: string;
  name: string;
  name_az: string | null;
  position: 'upper' | 'lower';
  side: 'left' | 'right' | 'center';
  tooth_type: 'incisor' | 'canine' | 'molar';
  typical_emergence_months_min: number | null;
  typical_emergence_months_max: number | null;
  svg_path_id: string | null;
  sort_order: number;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
}

export interface TeethingLog {
  id: string;
  user_id: string;
  child_id: string | null;
  tooth_id: string;
  emerged_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface TeethingCareTip {
  id: string;
  title: string;
  title_az: string | null;
  content: string;
  content_az: string | null;
  category: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface TeethingSymptom {
  id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  emoji: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  relief_tips: string[] | null;
  relief_tips_az: string[] | null;
  sort_order: number;
  is_active: boolean;
}

export const useTeething = () => {
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const [teeth, setTeeth] = useState<BabyTooth[]>([]);
  const [logs, setLogs] = useState<TeethingLog[]>([]);
  const [tips, setTips] = useState<TeethingCareTip[]>([]);
  const [symptoms, setSymptoms] = useState<TeethingSymptom[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useUserStore((state) => state.language);

  const mappedTeeth = useMemo(() => {
    return mapRowsTranslation(teeth, language, ['name', 'description']) as BabyTooth[];
  }, [teeth, language]);

  const mappedTips = useMemo(() => {
    return mapRowsTranslation(tips, language, ['title', 'content']) as TeethingCareTip[];
  }, [tips, language]);

  const mappedSymptoms = useMemo(() => {
    return mapRowsTranslation(symptoms, language, ['name', 'description', 'relief_tips']) as TeethingSymptom[];
  }, [symptoms, language]);

  const fetchTeeth = useCallback(async () => {
    const { data, error } = await supabase
      .from('baby_teeth_db')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!error && data) {
      setTeeth(data as BabyTooth[]);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!user) return;

    let query = supabase
      .from('user_teething_logs')
      .select('*')
      .eq('user_id', user.id);

    // Filter by selected child if available
    if (selectedChild) {
      query = query.eq('child_id', selectedChild.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setLogs(data as TeethingLog[]);
    }
  }, [user, selectedChild]);

  const fetchTips = useCallback(async () => {
    const { data, error } = await supabase
      .from('teething_care_tips')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!error && data) {
      setTips(data as TeethingCareTip[]);
    }
  }, []);

  const fetchSymptoms = useCallback(async () => {
    const { data, error } = await supabase
      .from('teething_symptoms')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!error && data) {
      setSymptoms(data as TeethingSymptom[]);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchTeeth(), fetchLogs(), fetchTips(), fetchSymptoms()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchTeeth, fetchLogs, fetchTips, fetchSymptoms]);

  const toggleTooth = useCallback(async (toothId: string, emerged: boolean, date?: string) => {
    if (!user) return;

    if (emerged) {
      const { error } = await supabase
        .from('user_teething_logs')
        .upsert({
          user_id: user.id,
          child_id: selectedChild?.id || null,
          tooth_id: toothId,
          emerged_date: date || new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id,child_id,tooth_id' });

      if (!error) {
        await fetchLogs();
      }
    } else {
      let query = supabase
        .from('user_teething_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('tooth_id', toothId);
      
      if (selectedChild) {
        query = query.eq('child_id', selectedChild.id);
      }

      const { error } = await query;

      if (!error) {
        await fetchLogs();
      }
    }
  }, [user, selectedChild, fetchLogs]);

  const updateToothNote = useCallback(async (toothId: string, notes: string) => {
    if (!user) return;

    let query = supabase
      .from('user_teething_logs')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('tooth_id', toothId);
    
    if (selectedChild) {
      query = query.eq('child_id', selectedChild.id);
    }

    const { error } = await query;

    if (!error) {
      await fetchLogs();
    }
  }, [user, selectedChild, fetchLogs]);

  const isToothEmerged = useCallback((toothId: string) => {
    return logs.some(log => log.tooth_id === toothId);
  }, [logs]);

  const getToothLog = useCallback((toothId: string) => {
    return logs.find(log => log.tooth_id === toothId);
  }, [logs]);

  const emergedCount = logs.length;
  const totalTeeth = teeth.length;
  const progress = totalTeeth > 0 ? (emergedCount / totalTeeth) * 100 : 0;

  return {
    teeth: mappedTeeth,
    logs,
    tips: mappedTips,
    symptoms: mappedSymptoms,
    loading,
    toggleTooth,
    updateToothNote,
    isToothEmerged,
    getToothLog,
    emergedCount,
    totalTeeth,
    progress,
    refetch: () => Promise.all([fetchTeeth(), fetchLogs(), fetchTips(), fetchSymptoms()]),
  };
};
