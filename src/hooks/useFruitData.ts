import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FRUIT_SIZES } from '@/types/anacan';
import { tr, mapRowsTranslation } from "@/lib/tr";
import { useUserStore } from "@/store/userStore";

interface FruitImage {
  week_number: number;
  fruit_name: string;
  fruit_name_az: string | null;
  emoji: string;
  image_url: string | null;
  length_cm: number;
  weight_g: number;
}

interface FruitData {
  fruit: string;
  emoji: string;
  imageUrl: string | null;
  lengthCm: number;
  weightG: number;
}

// Fetch all fruit images from database
export const useFruitImages = () => {
  const language = useUserStore((state) => state.language);
  return useQuery({
    queryKey: ['fruit-images', language],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('fruit_size_images').
      select('*').
      order('week_number');

      if (error) {
        console.error('Error fetching fruit images:', error);
        return [];
      }

      return mapRowsTranslation(data, language, ['fruit_name']) as FruitImage[];
    },
    staleTime: 1000 * 60 * 30 // 30 minutes
  });
};

// Unified hook to get fruit data for a specific day
// Priority: pregnancy_daily_content.baby_size_fruit > fruit_size_images.fruit_name > FRUIT_SIZES
export const useFruitDataForDay = (
pregnancyDay: number | undefined,
weekNumber: number | undefined,
dailyContentFruit?: string | null,
dailySizeCm?: number | null,
dailyWeightG?: number | null)
: FruitData => {
  const { data: fruitImages = [] } = useFruitImages();

  const week = weekNumber || Math.ceil((pregnancyDay || 1) / 7);

  // Get image data from fruit_size_images table (by week)
  const dbImageData = fruitImages.find((f) => f.week_number === week);

  // Get static fallback data
  const staticData = FRUIT_SIZES[week];

  // Priority order for fruit name:
  // 1. Daily content (pregnancy_daily_content.baby_size_fruit) - gündəlik
  // 2. Fruit images table (fruit_size_images.fruit_name) - həftəlik
  // 3. Static FRUIT_SIZES - fallback
  const fruitName = dailyContentFruit || dbImageData?.fruit_name || staticData?.fruit || tr("usefruitdata_meyve_50ca17", "Meyv\u0259");

  // Priority for size/weight:
  // 1. Daily content sizes (from pregnancy_daily_content)
  // 2. Fruit images table
  // 3. Static fallback
  const lengthCm = dailySizeCm ?? dbImageData?.length_cm ?? staticData?.lengthCm ?? 0;
  const weightG = dailyWeightG ?? dbImageData?.weight_g ?? staticData?.weightG ?? 0;

  return {
    fruit: fruitName,
    emoji: dbImageData?.emoji || staticData?.emoji || '🍎',
    imageUrl: dbImageData?.image_url || null,
    lengthCm,
    weightG
  };
};

// Legacy hook for week-based lookup (backwards compatibility)
export const useFruitDataForWeek = (week: number): FruitData => {
  const { data: fruitImages = [] } = useFruitImages();

  const dbData = fruitImages.find((f) => f.week_number === week);
  const staticData = FRUIT_SIZES[week];

  return {
    fruit: dbData?.fruit_name || staticData?.fruit || tr("usefruitdata_meyve_50ca17", "Meyv\u0259"),
    emoji: dbData?.emoji || staticData?.emoji || '🍎',
    imageUrl: dbData?.image_url || null,
    lengthCm: dbData?.length_cm || staticData?.lengthCm || 0,
    weightG: dbData?.weight_g || staticData?.weightG || 0
  };
};

// Helper function for AI chats and other components
// Returns the fruit name for a given pregnancy day, using the priority order
export const getDynamicFruitData = (
fruitImages: FruitImage[],
pregnancyDay: number | undefined,
weekNumber: number | undefined,
dailyContent?: {baby_size_fruit?: string | null;baby_size_cm?: number | null;baby_weight_gram?: number | null;} | null)
: FruitData => {
  const week = weekNumber || Math.ceil((pregnancyDay || 1) / 7);

  const dbImageData = fruitImages.find((f) => f.week_number === week);
  const staticData = FRUIT_SIZES[week];

  return {
    fruit: dailyContent?.baby_size_fruit || dbImageData?.fruit_name || staticData?.fruit || tr("usefruitdata_meyve_50ca17", "Meyv\u0259"),
    emoji: dbImageData?.emoji || staticData?.emoji || '🍎',
    imageUrl: dbImageData?.image_url || null,
    lengthCm: dailyContent?.baby_size_cm ?? dbImageData?.length_cm ?? staticData?.lengthCm ?? 0,
    weightG: dailyContent?.baby_weight_gram ?? dbImageData?.weight_g ?? staticData?.weightG ?? 0
  };
};