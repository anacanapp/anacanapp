import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { mapRowsTranslation } from '@/lib/tr';

export interface MaternityConfigItem {
  id: string;
  config_key: string;
  value: number;
  label: string;
  label_az: string | null;
  description: string | null;
  description_az: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface MaternityGuideline {
  id: string;
  title: string;
  title_az: string | null;
  content: string;
  content_az: string | null;
  category: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaternityConfig {
  birthBenefit: number;
  normalDaysBefore: number;
  normalDaysAfter: number;
  complicatedDaysAfter: number;
  multipleDaysBefore: number;
  multipleDaysAfter: number;
  minSalary: number;
}

export const useMaternityBenefits = () => {
  const [config, setConfig] = useState<MaternityConfig | null>(null);
  const [guidelines, setGuidelines] = useState<MaternityGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useUserStore((state) => state.language);

  const fetchData = async () => {
    try {
      const [configRes, guidelinesRes] = await Promise.all([
        supabase
          .from('maternity_config')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('maternity_guidelines')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
      ]);

      if (configRes.error) throw configRes.error;
      if (guidelinesRes.error) throw guidelinesRes.error;

      // Parse config into structured object
      const configData = configRes.data as MaternityConfigItem[];
      const configMap: Record<string, number> = {};
      configData.forEach(item => {
        configMap[item.config_key] = item.value;
      });

      setConfig({
        birthBenefit: configMap['birth_benefit'] || 600,
        normalDaysBefore: configMap['normal_leave_days_before'] || 70,
        normalDaysAfter: configMap['normal_leave_days_after'] || 56,
        complicatedDaysAfter: configMap['complicated_leave_days_after'] || 70,
        multipleDaysBefore: configMap['multiple_leave_days_before'] || 84,
        multipleDaysAfter: configMap['multiple_leave_days_after'] || 110,
        minSalary: configMap['min_salary'] || 345,
      });

      const translatedGuidelines = mapRowsTranslation(guidelinesRes.data, language, ['title', 'content']) as MaternityGuideline[];
      setGuidelines(translatedGuidelines);
    } catch (error) {
      console.error('Error fetching maternity data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language]);

  // Calculate maternity benefit
  const calculateBenefit = (
    monthlySalary: number,
    pregnancyType: 'normal' | 'complicated' | 'multiple'
  ) => {
    if (!config) return null;

    // Validate salary
    const validSalary = Math.max(monthlySalary, config.minSalary);

    // Calculate average daily salary
    const dailySalary = (validSalary * 12) / 365;

    // Determine leave days based on pregnancy type
    let daysBefore: number;
    let daysAfter: number;

    switch (pregnancyType) {
      case 'multiple':
        daysBefore = config.multipleDaysBefore;
        daysAfter = config.multipleDaysAfter;
        break;
      case 'complicated':
        daysBefore = config.normalDaysBefore;
        daysAfter = config.complicatedDaysAfter;
        break;
      default: // normal
        daysBefore = config.normalDaysBefore;
        daysAfter = config.normalDaysAfter;
    }

    const totalLeaveDays = daysBefore + daysAfter;
    
    // Calculate total maternity benefit
    const maternityBenefit = dailySalary * totalLeaveDays;

    return {
      dailySalary: Math.round(dailySalary * 100) / 100,
      daysBefore,
      daysAfter,
      totalLeaveDays,
      maternityBenefit: Math.round(maternityBenefit * 100) / 100,
      birthBenefit: config.birthBenefit,
      totalBenefit: Math.round((maternityBenefit + config.birthBenefit) * 100) / 100,
      monthlySalaryUsed: validSalary,
    };
  };

  return {
    config,
    guidelines,
    loading,
    calculateBenefit,
    refetch: fetchData
  };
};

// Admin hook
export const useAdminMaternityBenefits = () => {
  const [configItems, setConfigItems] = useState<MaternityConfigItem[]>([]);
  const [guidelines, setGuidelines] = useState<MaternityGuideline[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [configRes, guidelinesRes] = await Promise.all([
        supabase.from('maternity_config').select('*').order('config_key'),
        supabase.from('maternity_guidelines').select('*').order('sort_order')
      ]);

      if (configRes.error) throw configRes.error;
      if (guidelinesRes.error) throw guidelinesRes.error;

      setConfigItems((configRes.data || []) as MaternityConfigItem[]);
      setGuidelines((guidelinesRes.data || []) as MaternityGuideline[]);
    } catch (error) {
      console.error('Error fetching admin maternity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfigValue = async (id: string, value: number) => {
    try {
      const { error } = await supabase
        .from('maternity_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const createGuideline = async (guideline: Omit<MaternityGuideline, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase.from('maternity_guidelines').insert(guideline);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateGuideline = async (id: string, updates: Partial<MaternityGuideline>) => {
    try {
      const { error } = await supabase
        .from('maternity_guidelines')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteGuideline = async (id: string) => {
    try {
      const { error } = await supabase.from('maternity_guidelines').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    configItems,
    guidelines,
    loading,
    updateConfigValue,
    createGuideline,
    updateGuideline,
    deleteGuideline,
    refetch: fetchData
  };
};
