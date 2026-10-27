import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Thermometer, Droplets, Wind, Sun,
  AlertTriangle, Shirt, RefreshCw, Shield, Flower2, CloudSun, Baby, User, Home } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPosition } from '@/lib/permissions';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { differenceInMonths, differenceInDays } from 'date-fns';
import { getPregnancyWeek } from '@/lib/pregnancy-utils';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr, getPersistedLanguage } from "@/lib/tr";

interface WeatherClothingProps {
  onBack: () => void;
}

interface WeatherAdvice {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  weatherDescription: string;
  clothingAdvice: string;
  clothingItems: string[];
  indoorClothingAdvice?: string;
  indoorClothingItems?: string[];
  idealRoomTemperature?: string;
  roomTemperatureAdvice?: string;
  warnings: string[];
  pollenWarning: string | null;
  uvWarning: string | null;
  outdoorAdvice: string;
  safeToGoOut: boolean;
  alertLevel: 'safe' | 'caution' | 'warning' | 'danger';
}

const WeatherClothing = ({ onBack }: WeatherClothingProps) => {
  useScreenAnalytics('WeatherClothing', 'Tools');
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [usingFallbackLocation, setUsingFallbackLocation] = useState(false);
  const [cityName, setCityName] = useState<string>('');
  const [advice, setAdvice] = useState<WeatherAdvice | null>(null);

  const { toast } = useToast();
  const { profile } = useAuthContext();
  const { lifeStage, babyBirthDate, lastPeriodDate } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, babyBirthDate: s.babyBirthDate, lastPeriodDate: s.lastPeriodDate }))
  );

  // Calculate user context data
  const getUserContext = () => {
    const context: {
      babyAgeMonths?: number;
      babyAgeDays?: number;
      pregnancyWeek?: number;
      lifeStage?: string;
    } = {
      lifeStage: lifeStage || profile?.life_stage
    };

    // Calculate baby age
    const babyDob = babyBirthDate || (profile?.baby_birth_date ? new Date(profile.baby_birth_date) : null);
    if (babyDob) {
      const now = new Date();
      context.babyAgeMonths = differenceInMonths(now, new Date(babyDob));
      context.babyAgeDays = differenceInDays(now, new Date(babyDob));
    }

    // Calculate pregnancy week
    const lmp = lastPeriodDate || (profile?.last_period_date ? new Date(profile.last_period_date) : null);
    if (lmp && context.lifeStage === 'bump') {
      context.pregnancyWeek = getPregnancyWeek(lmp);
    }

    return context;
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    setIsLoading(true);
    setLocationError(null);
    setUsingFallbackLocation(false);
    setAdvice(null);

    try {
      let latitude: number;
      let longitude: number;

      try {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        // Fallback to Baku if geolocation fails entirely
        latitude = 40.4093;
        longitude = 49.8671;
        setUsingFallbackLocation(true);
      }

      // Get user context for AI
      const userContext = getUserContext();

      const { data, error } = await supabase.functions.invoke('weather-clothing', {
        body: {
          lat: latitude,
          lng: longitude,
          userContext,
          language: getPersistedLanguage()
        }
      });

      if (error) throw error;

      if (data?.success) {
        setCityName(data.cityName);
        setAdvice(data.advice);
      } else {
        throw new Error(data?.error || tr("weatherclothing_hava_melumati_alinmadi_f903fd", "Hava m\u0259lumat\u0131 al\u0131nmad\u0131"));
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
      const errorMsg = tr("weatherclothing_hava_melumati_alinarken_xeta_b_9b0a67", "Hava m\u0259lumat\u0131 al\u0131nark\u0259n x\u0259ta ba\u015F verdi.");


      setLocationError(errorMsg);
      toast({
        title: tr("weatherclothing_xeta_3cdbb6", 'Xəta'),
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Alert level → anacan palette
  const getAlertColor = (level: string) => {
    switch (level) {
      case 'danger':return 'var(--a-pink-2)';
      case 'warning':return 'var(--a-peach-2)';
      case 'caution':return 'var(--a-yellow-2)';
      default:return 'var(--a-green-2)';
    }
  };

  const getWeatherIcon = (temp: number) => {
    if (temp < 5) return '❄️';
    if (temp < 15) return '🌤️';
    if (temp < 25) return '☀️';
    return '🔥';
  };

  const userContext = getUserContext();

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={
        userContext.babyAgeMonths !== undefined ?
        tr("weatherclothing_baby_age_for", "{months} aylıq körpə üçün").replace("{months}", String(userContext.babyAgeMonths)) :
        userContext.pregnancyWeek ?
        tr("weatherclothing_pregnancy_week_for", "Hamiləliyin {week}. həftəsi üçün").replace("{week}", String(userContext.pregnancyWeek)) : tr("weatherclothing_korpeniz_ucun_geyim_mesleheti_f5cbde", "Körpəniz üçün geyim məsləhəti")
        }
        title={tr("weatherclothing_title", "Hava & Geyim")}
        actions={
        <button className="a-icon-btn" onClick={fetchWeather} disabled={isLoading} aria-label="Refresh">
            <RefreshCw size={16} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
          </button>
        } />

      <div className="space-y-3">
        {usingFallbackLocation && advice && !isLoading && (
          <p role="status" className="a-card text-sm" style={{ padding: '12px 14px' }}>
            {tr('weather_location_fallback', 'Məkan təyin edilmədi. Bakı üçün hava göstərilir. Məkan xidmətlərini yoxlayıb yenidən cəhd edin.')}
          </p>
        )}
        {/* User Context Card */}
        {(userContext.babyAgeMonths !== undefined || userContext.pregnancyWeek) &&
        <div className="a-card" style={{ padding: '12px 14px' }}>
            <div className="flex items-center gap-3">
              {userContext.babyAgeMonths !== undefined ?
            <>
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)' }}>
                    <Baby size={17} strokeWidth={2.2} style={{ color: 'var(--a-blue-ink)' }} />
                  </span>
                  <div>
                    <p className="a-list-title" style={{ margin: 0 }}>{tr("weatherclothing_korpenin_yasi_1dfff9", "Körpənin yaşı")}</p>
                    <p className="a-list-sub" style={{ margin: 0 }}>
                      {userContext.babyAgeMonths} {tr("weatherclothing_ay_suffix_3c7a2d", "ay")} ({userContext.babyAgeDays} {tr("weatherclothing_gun_4835dd", "g\xFCn)")}
                    </p>
                  </div>
                </> :
            userContext.pregnancyWeek ?
            <>
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)' }}>
                    <User size={17} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} />
                  </span>
                  <div>
                    <p className="a-list-title" style={{ margin: 0 }}>{tr("weatherclothing_hamilelik_heftesi_c9e362", "Hamiləlik həftəsi")}</p>
                    <p className="a-list-sub" style={{ margin: 0 }}>{userContext.pregnancyWeek}{tr("weatherclothing_hefte_459cfe", ". h\u0259ft\u0259")}</p>
                  </div>
                </> :
            null}
            </div>
          </div>
        }

        {/* Loading State */}
        {isLoading &&
        <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin" style={{ animationDuration: '2s' }}>

              <CloudSun className="w-16 h-16 mb-4" style={{ color: 'var(--a-blue-2)' }} />
            </div>
            <p style={{ color: 'var(--a-on-bg-soft)' }}>{tr("weatherclothing_mekan_teyin_edilir_526792", "Məkan təyin edilir...")}</p>
          </div>
        }

        {/* Error State */}
        {locationError && !isLoading &&
        <div className="rounded-2xl p-4" style={{ background: 'var(--a-alert-bg)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0" style={{ color: 'var(--a-alert-ink)' }} />
              <div>
                <h3 className="font-bold" style={{ margin: 0, color: 'var(--a-alert-ink)' }}>{tr("weatherclothing_xeta_3cdbb6", 'Xəta')}</h3>
                <p className="text-sm mt-1" style={{ margin: '4px 0 0', color: 'var(--a-alert-soft)' }}>{locationError}</p>
                <button className="a-btn-soft mt-3" style={{ height: 38, padding: '0 16px' }} onClick={fetchWeather}>
                  {tr("weatherclothing_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}
                </button>
              </div>
            </div>
          </div>
        }

        {/* Weather Data */}
        <AnimatePresence>
          {advice && !isLoading &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3">
            
              {/* Location & Current Weather */}
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                <div style={{ height: 6, background: getAlertColor(advice.alertLevel) }} />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
                    <span className="a-list-title" style={{ margin: 0 }}>{cityName}</span>
                    <span
                    className="ms-auto px-3 py-1 rounded-full text-xs font-bold"
                    style={advice.safeToGoOut ?
                    { background: 'var(--a-green-1)', color: 'var(--a-green-ink)' } :
                    { background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}>
                      {advice.safeToGoOut ? tr("weatherclothing_cixmaq_olar_ab7b33", "\u2713 \xC7\u0131xmaq olar") : tr("weatherclothing_diqqetli_olun_c597f9", "\u26A0 Diqq\u0259tli olun")}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-6xl">{getWeatherIcon(advice.temperature)}</div>
                    <div>
                      <div className="a-heading" style={{ fontSize: 44, color: 'var(--a-ink)' }}>{Math.round(advice.temperature)}°C</div>
                      <p className="a-list-sub mt-1" style={{ margin: '4px 0 0' }}>
                        {tr("weatherclothing_feels_like", "Hiss:")} {Math.round(advice.feelsLike)}°C
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm mt-3" style={{ margin: '12px 0 0', color: 'var(--a-body-text)' }}>{advice.weatherDescription}</p>
                  
                  {/* Weather Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--a-blue-1)' }}>
                      <Droplets className="w-5 h-5 mx-auto" style={{ color: 'var(--a-blue-ink)' }} />
                      <p className="text-xs mt-1" style={{ margin: '4px 0 0', color: 'var(--a-blue-ink)', opacity: 0.8 }}>{tr("weatherclothing_rutubet_3d8e74", "Rütubət")}</p>
                      <p className="font-bold text-sm" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>{advice.humidity}%</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--a-green-1)' }}>
                      <Wind className="w-5 h-5 mx-auto" style={{ color: 'var(--a-green-ink)' }} />
                      <p className="text-xs mt-1" style={{ margin: '4px 0 0', color: 'var(--a-green-ink)', opacity: 0.8 }}>{tr("weatherclothing_kulek_cc8bf6", "Külək")}</p>
                      <p className="font-bold text-sm" style={{ margin: 0, color: 'var(--a-green-ink)' }}>{Math.round(advice.windSpeed)} km/h</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--a-yellow-1)' }}>
                      <Sun className="w-5 h-5 mx-auto" style={{ color: 'var(--a-warn-ink)' }} />
                      <p className="text-xs mt-1" style={{ margin: '4px 0 0', color: 'var(--a-warn-ink)', opacity: 0.8 }}>UV</p>
                      <p className="font-bold text-sm" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>{advice.uvIndex}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clothing Advice */}
              <div className="a-card">
                <h3 className="a-card-title a-heading flex items-center gap-2 mb-3" style={{ margin: '0 0 12px' }}>
                  <Shirt className="w-5 h-5" style={{ color: 'var(--a-peach-2)' }} />
                  {userContext.babyAgeMonths !== undefined ?
                tr("weatherclothing_baby_outdoor_clothing", "{months} aylıq körpə üçün bayır geyimi").replace("{months}", String(userContext.babyAgeMonths)) : tr("weatherclothing_bayirda_geyim_tovsiyesi_650ba0", "Bayırda Geyim Tövsiyəsi")
                }
                </h3>
                <p className="a-cta-text mb-4" style={{ margin: '0 0 16px' }}>{advice.clothingAdvice}</p>
                
                <div className="flex flex-wrap gap-2">
                  {advice.clothingItems.map((item, idx) =>
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                  
                      {item}
                    </motion.span>
                )}
                </div>
              </div>

              {/* Indoor Clothing & Room Temperature */}
              {(advice.indoorClothingAdvice || advice.idealRoomTemperature) &&
            <div className="a-card" style={{ background: 'var(--a-lav-1)', border: 'none' }}>
                  <h3 className="font-bold flex items-center gap-2 mb-3 a-heading" style={{ margin: '0 0 12px', color: 'var(--a-lav-ink)' }}>
                    <Home className="w-5 h-5" style={{ color: 'var(--a-lav-ink)' }} />
                    {tr("weatherclothing_ev_daxilinde_d10128", "Ev daxilind\u0259")}
                  </h3>
                  
                  {/* Room Temperature */}
                  {advice.idealRoomTemperature &&
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.5)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-4 h-4" style={{ color: 'var(--a-lav-ink)' }} />
                        <span className="font-bold text-sm" style={{ color: 'var(--a-lav-ink)' }}>{tr("weatherclothing_ideal_otaq_temperaturu_6bf977", "İdeal otaq temperaturu")}</span>
                      </div>
                      <p className="a-heading" style={{ margin: 0, fontSize: 24, color: 'var(--a-lav-ink)' }}>{advice.idealRoomTemperature}</p>
                      {advice.roomTemperatureAdvice &&
                <p className="text-xs mt-1" style={{ margin: '4px 0 0', color: 'var(--a-lav-ink)', opacity: 0.8 }}>{advice.roomTemperatureAdvice}</p>
                }
                    </div>
              }

                  {/* Indoor Clothing */}
                  {advice.indoorClothingAdvice &&
              <>
                      <p className="text-sm mb-3" style={{ margin: '0 0 12px', color: 'var(--a-lav-ink)', opacity: 0.85 }}>{advice.indoorClothingAdvice}</p>
                      {advice.indoorClothingItems && advice.indoorClothingItems.length > 0 &&
                <div className="flex flex-wrap gap-2">
                          {advice.indoorClothingItems.map((item, idx) =>
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold"
                    style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-lav-ink)' }}>
                    
                              {item}
                            </motion.span>
                  )}
                        </div>
                }
                    </>
              }
                </div>
            }

              {/* Outdoor Advice */}
              <div className="a-card" style={{ background: advice.safeToGoOut ? 'var(--a-green-1)' : 'var(--a-peach-1)', border: 'none' }}>
                <h3 className="font-bold flex items-center gap-2 mb-2 a-heading" style={{ margin: '0 0 8px', color: advice.safeToGoOut ? 'var(--a-green-ink)' : 'var(--a-accent-ink)' }}>
                  <CloudSun className="w-5 h-5" />
                  {tr("weatherclothing_bayirda_gezme_0ae215", "Bay\u0131rda g\u0259zm\u0259")}
                </h3>
                <p className="text-sm" style={{ margin: 0, color: advice.safeToGoOut ? 'var(--a-green-ink)' : 'var(--a-accent-ink)', opacity: 0.9 }}>{advice.outdoorAdvice}</p>
              </div>

              {/* Warnings */}
              {advice.warnings.length > 0 &&
            <div className="rounded-2xl p-4" style={{ background: 'var(--a-alert-bg)' }}>
                  <h3 className="font-bold flex items-center gap-2 mb-3 a-heading" style={{ margin: '0 0 12px', color: 'var(--a-alert-ink)' }}>
                    <AlertTriangle className="w-5 h-5" />
                    {tr("weatherclothing_xeberdarliqlar_5542c4", "X\u0259b\u0259rdarl\u0131qlar")}
                  </h3>
                  <ul className="space-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {advice.warnings.map((warning, idx) =>
                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: 'var(--a-alert-soft)' }}>
                        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--a-pink-2)' }} />
                        {warning}
                      </li>
                )}
                  </ul>
                </div>
            }

              {/* Pollen Warning */}
              {advice.pollenWarning &&
            <div className="rounded-2xl p-4" style={{ background: 'var(--a-yellow-1)' }}>
                  <div className="flex items-start gap-3">
                    <Flower2 className="w-5 h-5 shrink-0" style={{ color: 'var(--a-warn-ink)' }} />
                    <div>
                      <h3 className="font-bold" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>{tr("weatherclothing_polen_xeberdarligi_1ae540", "Polen Xəbərdarlığı")}</h3>
                      <p className="text-sm mt-1" style={{ margin: '4px 0 0', color: 'var(--a-warn-ink)', opacity: 0.85 }}>{advice.pollenWarning}</p>
                    </div>
                  </div>
                </div>
            }

              {/* UV Warning */}
              {advice.uvWarning &&
            <div className="rounded-2xl p-4" style={{ background: 'var(--a-peach-1)' }}>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 shrink-0" style={{ color: 'var(--a-accent-ink)' }} />
                    <div>
                      <h3 className="font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{tr("weatherclothing_uv_xeberdarligi_327432", "UV Xəbərdarlığı")}</h3>
                      <p className="text-sm mt-1" style={{ margin: '4px 0 0', color: 'var(--a-accent-ink)', opacity: 0.85 }}>{advice.uvWarning}</p>
                    </div>
                  </div>
                </div>
            }
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </ToolPage>);

};

export default WeatherClothing;
