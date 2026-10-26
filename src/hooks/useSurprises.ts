import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { tr } from '@/lib/tr';

interface Surprise {
  id: string;
  user_id: string;
  surprise_id: string;
  surprise_title: string;
  surprise_emoji: string;
  surprise_category: string;
  surprise_points: number;
  planned_date: string;
  completed_date: string | null;
  notes: string | null;
  status: 'planned' | 'completed';
  created_at: string;
}

export const useSurprises = () => {
  const { user } = useAuth();
  const [surprises, setSurprises] = useState<Surprise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSurprises = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('partner_surprises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurprises((data || []) as Surprise[]);
    } catch (err) {
      console.error('Error fetching surprises:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurprises();
  }, [user]);

  const addSurprise = async (surprise: {
    surprise_id: string;
    surprise_title: string;
    surprise_emoji: string;
    surprise_category: string;
    surprise_points: number;
    planned_date: string;
    notes?: string;
  }) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('partner_surprises')
        .insert({
          user_id: user.id,
          ...surprise,
          status: 'planned',
        })
        .select()
        .single();

      if (error) throw error;
      
      setSurprises(prev => [data as Surprise, ...prev]);
      return data;
    } catch (err) {
      console.error('Error adding surprise:', err);
      return null;
    }
  };

  const completeSurprise = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('partner_surprises')
        .update({
          status: 'completed',
          completed_date: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSurprises(prev =>
        prev.map(s =>
          s.id === id
            ? { ...s, status: 'completed' as const, completed_date: new Date().toISOString() }
            : s
        )
      );
      return true;
    } catch (err) {
      console.error('Error completing surprise:', err);
      return false;
    }
  };

  const deleteSurprise = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('partner_surprises')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSurprises(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting surprise:', err);
      return false;
    }
  };

  const plannedSurprises = surprises.filter(s => s.status === 'planned');
  const completedSurprises = surprises.filter(s => s.status === 'completed');
  const totalPoints = completedSurprises.reduce((sum, s) => sum + s.surprise_points, 0);

  // Category statistics
  const categoryStats = completedSurprises.reduce((acc, s) => {
    acc[s.surprise_category] = (acc[s.surprise_category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Monthly points for chart
  const monthlyPoints = completedSurprises.reduce((acc, s) => {
    if (s.completed_date) {
      const month = new Date(s.completed_date).toISOString().slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + s.surprise_points;
    }
    return acc;
  }, {} as Record<string, number>);

  // Get last 6 months data for chart
  const getMonthlyChartData = () => {
    const months: { month: string; points: number; label: string }[] = [];
    const monthNames = [tr('month_jan_short', 'Yan'), tr('month_feb_short', 'Fev'), tr('month_mar_short', 'Mar'), tr('month_apr_short', 'Apr'), tr('month_may_short', 'May'), tr('month_jun_short', 'İyn'), tr('month_jul_short', 'İyl'), tr('month_aug_short', 'Avq'), tr('month_sep_short', 'Sen'), tr('month_oct_short', 'Okt'), tr('month_nov_short', 'Noy'), tr('month_dec_short', 'Dek')];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      months.push({
        month: monthKey,
        points: monthlyPoints[monthKey] || 0,
        label: monthNames[date.getMonth()],
      });
    }
    return months;
  };

  // Top category
  const topCategory = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0];

  return {
    surprises,
    plannedSurprises,
    completedSurprises,
    totalPoints,
    categoryStats,
    monthlyChartData: getMonthlyChartData(),
    topCategory: topCategory ? { category: topCategory[0], count: topCategory[1] } : null,
    isLoading,
    addSurprise,
    completeSurprise,
    deleteSurprise,
    refetch: fetchSurprises,
  };
};
